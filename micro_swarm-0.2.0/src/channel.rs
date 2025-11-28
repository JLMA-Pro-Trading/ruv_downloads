//! Communication channels between agents

use alloc::{vec::Vec, collections::{BTreeMap, VecDeque, BTreeSet}, string::String};
use core::mem;

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

use crate::{Result, SwarmError, AgentId, Message, MessageType, MessagePayload};

/// Channel configuration
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct ChannelConfig {
    /// Maximum messages per channel
    pub max_messages: usize,
    /// Enable message persistence
    pub persistent: bool,
    /// Enable message compression
    pub compression: bool,
    /// Channel timeout in simulation ticks
    pub timeout: u64,
}

impl Default for ChannelConfig {
    fn default() -> Self {
        Self {
            max_messages: 1000,
            persistent: false,
            compression: false,
            timeout: 10000,
        }
    }
}

/// Message channel between agents
#[derive(Debug)]
pub struct MessageChannel {
    /// Channel ID
    pub id: u64,
    /// Sender agent
    pub sender: AgentId,
    /// Receiver agent
    pub receiver: AgentId,
    /// Message queue
    queue: VecDeque<Message>,
    /// Channel configuration
    config: ChannelConfig,
    /// Channel statistics
    stats: ChannelStats,
}

impl MessageChannel {
    /// Create a new message channel
    pub fn new(sender: AgentId, receiver: AgentId, config: ChannelConfig) -> Self {
        static mut COUNTER: u64 = 0;
        let id = unsafe {
            COUNTER += 1;
            COUNTER
        };
        
        Self {
            id,
            sender,
            receiver,
            queue: VecDeque::with_capacity(config.max_messages),
            config,
            stats: ChannelStats::default(),
        }
    }
    
    /// Send a message through the channel
    pub fn send(&mut self, message: Message) -> Result<()> {
        // Validate sender
        if message.from != self.sender {
            return Err(SwarmError::channel("Invalid sender for channel"));
        }
        
        // Check queue capacity
        if self.queue.len() >= self.config.max_messages {
            return Err(SwarmError::channel("Channel queue full"));
        }
        
        // Add message to queue
        self.queue.push_back(message);
        self.stats.messages_sent += 1;
        
        Ok(())
    }
    
    /// Receive a message from the channel
    pub fn receive(&mut self) -> Result<Option<Message>> {
        if let Some(message) = self.queue.pop_front() {
            self.stats.messages_received += 1;
            Ok(Some(message))
        } else {
            Ok(None)
        }
    }
    
    /// Peek at the next message without removing it
    pub fn peek(&self) -> Option<&Message> {
        self.queue.front()
    }
    
    /// Get the number of pending messages
    pub fn pending_count(&self) -> usize {
        self.queue.len()
    }
    
    /// Check if channel is empty
    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
    
    /// Clear all messages from the channel
    pub fn clear(&mut self) {
        self.queue.clear();
        self.stats.messages_dropped += self.stats.messages_sent - self.stats.messages_received;
    }
    
    /// Get channel statistics
    pub fn stats(&self) -> &ChannelStats {
        &self.stats
    }
}

/// Channel statistics
#[derive(Debug, Clone, Default)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct ChannelStats {
    /// Number of messages sent
    pub messages_sent: u64,
    /// Number of messages received
    pub messages_received: u64,
    /// Number of messages dropped
    pub messages_dropped: u64,
    /// Average message size
    pub average_message_size: f32,
    /// Channel utilization
    pub utilization: f32,
}

/// Communication hub for managing all channels
pub struct CommunicationHub {
    /// Direct channels between agents
    channels: BTreeMap<(AgentId, AgentId), MessageChannel>,
    /// Broadcast channels for group communication
    broadcast_channels: BTreeMap<String, BroadcastChannel>,
    /// Global message statistics
    global_stats: GlobalChannelStats,
    /// Hub configuration
    config: ChannelConfig,
}

impl CommunicationHub {
    /// Create a new communication hub
    pub fn new(config: ChannelConfig) -> Self {
        Self {
            channels: BTreeMap::new(),
            broadcast_channels: BTreeMap::new(),
            global_stats: GlobalChannelStats::default(),
            config,
        }
    }
    
    /// Create a direct channel between two agents
    pub fn create_channel(&mut self, sender: AgentId, receiver: AgentId) -> Result<()> {
        let key = (sender, receiver);
        
        if self.channels.contains_key(&key) {
            return Err(SwarmError::channel("Channel already exists"));
        }
        
        let channel = MessageChannel::new(sender, receiver, self.config.clone());
        self.channels.insert(key, channel);
        
        Ok(())
    }
    
    /// Remove a channel
    pub fn remove_channel(&mut self, sender: AgentId, receiver: AgentId) -> Result<()> {
        let key = (sender, receiver);
        
        if self.channels.remove(&key).is_none() {
            return Err(SwarmError::channel("Channel not found"));
        }
        
        Ok(())
    }
    
    /// Send a message between agents
    pub fn send_message(&mut self, message: Message) -> Result<()> {
        let key = (message.from, message.to);
        
        // Try to find existing channel
        if let Some(channel) = self.channels.get_mut(&key) {
            channel.send(message)?;
            self.global_stats.total_messages_sent += 1;
            return Ok(());
        }
        
        // Create channel if it doesn't exist
        self.create_channel(message.from, message.to)?;
        let channel = self.channels.get_mut(&key).unwrap();
        channel.send(message)?;
        self.global_stats.total_messages_sent += 1;
        
        Ok(())
    }
    
    /// Receive messages for an agent
    pub fn receive_messages(&mut self, agent_id: AgentId) -> Vec<Message> {
        let mut messages = Vec::new();
        
        // Collect messages from all channels where this agent is the receiver
        for ((_, receiver), channel) in self.channels.iter_mut() {
            if *receiver == agent_id {
                while let Ok(Some(message)) = channel.receive() {
                    messages.push(message);
                    self.global_stats.total_messages_delivered += 1;
                }
            }
        }
        
        messages
    }
    
    /// Broadcast a message to all agents
    pub fn broadcast(&mut self, sender: AgentId, message_type: MessageType, payload: MessagePayload) -> Result<()> {
        // Get all unique receivers
        let receivers: Vec<AgentId> = self.channels.keys()
            .map(|(_, receiver)| *receiver)
            .collect::<BTreeSet<_>>()
            .into_iter()
            .filter(|&id| id != sender)
            .collect();
        
        for receiver in receivers {
            let message = Message {
                from: sender,
                to: receiver,
                msg_type: message_type.clone(),
                payload: payload.clone(),
            };
            self.send_message(message)?;
        }
        
        Ok(())
    }
    
    /// Create a broadcast channel
    pub fn create_broadcast_channel(&mut self, name: String, config: BroadcastConfig) -> Result<()> {
        if self.broadcast_channels.contains_key(&name) {
            return Err(SwarmError::channel("Broadcast channel already exists"));
        }
        
        let channel = BroadcastChannel::new(name.clone(), config);
        self.broadcast_channels.insert(name, channel);
        
        Ok(())
    }
    
    /// Subscribe an agent to a broadcast channel
    pub fn subscribe(&mut self, channel_name: &str, agent_id: AgentId) -> Result<()> {
        let channel = self.broadcast_channels.get_mut(channel_name)
            .ok_or_else(|| SwarmError::channel("Broadcast channel not found"))?;
        
        channel.subscribe(agent_id)
    }
    
    /// Unsubscribe an agent from a broadcast channel
    pub fn unsubscribe(&mut self, channel_name: &str, agent_id: AgentId) -> Result<()> {
        let channel = self.broadcast_channels.get_mut(channel_name)
            .ok_or_else(|| SwarmError::channel("Broadcast channel not found"))?;
        
        channel.unsubscribe(agent_id)
    }
    
    /// Publish a message to a broadcast channel
    pub fn publish(&mut self, channel_name: &str, sender: AgentId, message_type: MessageType, payload: MessagePayload) -> Result<()> {
        let channel = self.broadcast_channels.get_mut(channel_name)
            .ok_or_else(|| SwarmError::channel("Broadcast channel not found"))?;
        
        let message = Message {
            from: sender,
            to: AgentId::from(0), // Broadcast target
            msg_type: message_type,
            payload,
        };
        
        channel.publish(message)?;
        self.global_stats.total_broadcasts += 1;
        
        Ok(())
    }
    
    /// Get pending broadcast messages for an agent
    pub fn get_broadcasts(&mut self, agent_id: AgentId) -> Vec<Message> {
        let mut messages = Vec::new();
        
        for channel in self.broadcast_channels.values_mut() {
            messages.extend(channel.get_messages(agent_id));
        }
        
        messages
    }
    
    /// Get global channel statistics
    pub fn global_stats(&self) -> &GlobalChannelStats {
        &self.global_stats
    }
    
    /// Get channel statistics for a specific pair
    pub fn channel_stats(&self, sender: AgentId, receiver: AgentId) -> Option<&ChannelStats> {
        let key = (sender, receiver);
        self.channels.get(&key).map(|channel| channel.stats())
    }
    
    /// Clean up inactive channels
    pub fn cleanup(&mut self) {
        // Remove empty channels
        self.channels.retain(|_, channel| !channel.is_empty() || channel.stats.messages_sent > 0);
        
        // Clean up broadcast channels
        for channel in self.broadcast_channels.values_mut() {
            channel.cleanup();
        }
    }
}

/// Global channel statistics
#[derive(Debug, Clone, Default)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct GlobalChannelStats {
    /// Total messages sent across all channels
    pub total_messages_sent: u64,
    /// Total messages delivered
    pub total_messages_delivered: u64,
    /// Total broadcast messages
    pub total_broadcasts: u64,
    /// Number of active channels
    pub active_channels: usize,
    /// Number of broadcast channels
    pub broadcast_channels: usize,
}

/// Broadcast channel configuration
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct BroadcastConfig {
    /// Maximum subscribers
    pub max_subscribers: usize,
    /// Message history size
    pub history_size: usize,
    /// Enable message ordering
    pub ordered: bool,
}

impl Default for BroadcastConfig {
    fn default() -> Self {
        Self {
            max_subscribers: 100,
            history_size: 1000,
            ordered: true,
        }
    }
}

/// Broadcast channel for group communication
#[derive(Debug)]
pub struct BroadcastChannel {
    /// Channel name
    pub name: String,
    /// Subscribed agents
    subscribers: Vec<AgentId>,
    /// Message history
    message_history: VecDeque<Message>,
    /// Per-agent message queues
    agent_queues: BTreeMap<AgentId, VecDeque<Message>>,
    /// Channel configuration
    config: BroadcastConfig,
}

impl BroadcastChannel {
    /// Create a new broadcast channel
    pub fn new(name: String, config: BroadcastConfig) -> Self {
        Self {
            name,
            subscribers: Vec::new(),
            message_history: VecDeque::with_capacity(config.history_size),
            agent_queues: BTreeMap::new(),
            config,
        }
    }
    
    /// Subscribe an agent to the channel
    pub fn subscribe(&mut self, agent_id: AgentId) -> Result<()> {
        if self.subscribers.len() >= self.config.max_subscribers {
            return Err(SwarmError::channel("Maximum subscribers reached"));
        }
        
        if !self.subscribers.contains(&agent_id) {
            self.subscribers.push(agent_id);
            self.agent_queues.insert(agent_id, VecDeque::new());
        }
        
        Ok(())
    }
    
    /// Unsubscribe an agent from the channel
    pub fn unsubscribe(&mut self, agent_id: AgentId) -> Result<()> {
        self.subscribers.retain(|&id| id != agent_id);
        self.agent_queues.remove(&agent_id);
        Ok(())
    }
    
    /// Publish a message to all subscribers
    pub fn publish(&mut self, message: Message) -> Result<()> {
        // Add to history
        if self.message_history.len() >= self.config.history_size {
            self.message_history.pop_front();
        }
        self.message_history.push_back(message.clone());
        
        // Distribute to subscriber queues
        for &subscriber in &self.subscribers {
            if let Some(queue) = self.agent_queues.get_mut(&subscriber) {
                let mut subscriber_message = message.clone();
                subscriber_message.to = subscriber;
                queue.push_back(subscriber_message);
            }
        }
        
        Ok(())
    }
    
    /// Get messages for a specific agent
    pub fn get_messages(&mut self, agent_id: AgentId) -> Vec<Message> {
        if let Some(queue) = self.agent_queues.get_mut(&agent_id) {
            let messages = queue.drain(..).collect();
            messages
        } else {
            Vec::new()
        }
    }
    
    /// Get message history
    pub fn history(&self) -> &VecDeque<Message> {
        &self.message_history
    }
    
    /// Get subscriber count
    pub fn subscriber_count(&self) -> usize {
        self.subscribers.len()
    }
    
    /// Cleanup empty queues
    pub fn cleanup(&mut self) {
        self.agent_queues.retain(|_, queue| !queue.is_empty());
    }
}