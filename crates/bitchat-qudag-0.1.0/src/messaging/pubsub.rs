//! Topic-based Pub/Sub implementation for BitChat

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::RwLock;

use crate::error::{BitChatError, Result};
use crate::messaging::ReceivedMessage;

/// Topic subscriber information
#[derive(Debug, Clone)]
pub struct Subscriber {
    /// Subscriber peer ID
    pub peer_id: String,
    /// Subscription timestamp
    pub subscribed_at: SystemTime,
    /// Subscription filter (for wildcard matching)
    pub filter: Option<String>,
    /// Access level
    pub access_level: AccessLevel,
}

/// Access levels for topic-based control
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AccessLevel {
    /// Read-only access
    ReadOnly,
    /// Read and write access
    ReadWrite,
    /// Admin access (can manage subscribers)
    Admin,
}

/// Topic metadata
#[derive(Debug, Clone)]
pub struct TopicMetadata {
    /// Topic name
    pub name: String,
    /// Topic creation time
    pub created_at: SystemTime,
    /// Topic owner
    pub owner: String,
    /// Access control list
    pub acl: HashMap<String, AccessLevel>,
    /// Topic configuration
    pub config: TopicConfig,
}

/// Topic configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicConfig {
    /// Maximum message size
    pub max_message_size: usize,
    /// Whether to persist messages
    pub persistent: bool,
    /// Message retention duration (seconds)
    pub retention_duration: u64,
    /// Maximum number of subscribers
    pub max_subscribers: usize,
    /// Whether to enable multicast optimization
    pub multicast_enabled: bool,
}

impl Default for TopicConfig {
    fn default() -> Self {
        Self {
            max_message_size: 1024 * 1024, // 1MB
            persistent: false,
            retention_duration: 86400, // 24 hours
            max_subscribers: 1000,
            multicast_enabled: true,
        }
    }
}

/// Topic-based Pub/Sub system
pub struct TopicBasedPubSub {
    /// Topic subscriptions: topic -> set of subscribers
    subscriptions: Arc<RwLock<HashMap<String, HashSet<String>>>>,
    /// Subscriber details
    subscribers: Arc<RwLock<HashMap<String, Subscriber>>>,
    /// Topic metadata
    topics: Arc<RwLock<HashMap<String, TopicMetadata>>>,
    /// Wildcard subscriptions for pattern matching
    wildcard_subs: Arc<RwLock<Vec<(String, String)>>>, // (pattern, subscriber)
    /// Message history for persistent topics
    message_history: Arc<RwLock<HashMap<String, Vec<ReceivedMessage>>>>,
    /// Multicast groups for efficient routing
    multicast_groups: Arc<RwLock<HashMap<String, Vec<String>>>>,
}

impl TopicBasedPubSub {
    /// Create a new Topic-based Pub/Sub system
    pub fn new() -> Self {
        Self {
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
            subscribers: Arc::new(RwLock::new(HashMap::new())),
            topics: Arc::new(RwLock::new(HashMap::new())),
            wildcard_subs: Arc::new(RwLock::new(Vec::new())),
            message_history: Arc::new(RwLock::new(HashMap::new())),
            multicast_groups: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Subscribe to a topic
    pub fn subscribe(&mut self, peer_id: &str, topic: &str) -> Result<()> {
        self.subscribe_with_options(peer_id, topic, None, AccessLevel::ReadWrite)
    }

    /// Subscribe to a topic with options
    pub fn subscribe_with_options(
        &mut self,
        peer_id: &str,
        topic: &str,
        filter: Option<String>,
        access_level: AccessLevel,
    ) -> Result<()> {
        let subscriber = Subscriber {
            peer_id: peer_id.to_string(),
            subscribed_at: SystemTime::now(),
            filter: filter.clone(),
            access_level,
        };

        // Check if topic has wildcard
        if topic.contains('*') || topic.contains('?') {
            // Add to wildcard subscriptions
            let mut wildcard_subs = futures::executor::block_on(self.wildcard_subs.write());
            wildcard_subs.push((topic.to_string(), peer_id.to_string()));
        } else {
            // Add to regular subscriptions
            let mut subs = futures::executor::block_on(self.subscriptions.write());
            subs.entry(topic.to_string())
                .or_insert_with(HashSet::new)
                .insert(peer_id.to_string());

            // Update multicast groups if enabled
            let topics = futures::executor::block_on(self.topics.read());
            if let Some(topic_meta) = topics.get(topic) {
                if topic_meta.config.multicast_enabled {
                    drop(topics);
                    self.update_multicast_group(topic, peer_id, true)?;
                }
            }
        }

        // Store subscriber details
        let mut subscribers = futures::executor::block_on(self.subscribers.write());
        subscribers.insert(format!("{}:{}", peer_id, topic), subscriber);

        tracing::debug!("Peer {} subscribed to topic {}", peer_id, topic);
        Ok(())
    }

    /// Unsubscribe from a topic
    pub fn unsubscribe(&mut self, peer_id: &str, topic: &str) -> Result<()> {
        // Remove from regular subscriptions
        let mut subs = futures::executor::block_on(self.subscriptions.write());
        if let Some(topic_subs) = subs.get_mut(topic) {
            topic_subs.remove(peer_id);
            if topic_subs.is_empty() {
                subs.remove(topic);
            }
        }

        // Remove from wildcard subscriptions
        let mut wildcard_subs = futures::executor::block_on(self.wildcard_subs.write());
        wildcard_subs.retain(|(pattern, sub)| !(pattern == topic && sub == peer_id));

        // Remove subscriber details
        let mut subscribers = futures::executor::block_on(self.subscribers.write());
        subscribers.remove(&format!("{}:{}", peer_id, topic));

        // Update multicast groups
        self.update_multicast_group(topic, peer_id, false)?;

        tracing::debug!("Peer {} unsubscribed from topic {}", peer_id, topic);
        Ok(())
    }

    /// Create a new topic with metadata
    pub async fn create_topic(
        &mut self,
        name: &str,
        owner: &str,
        config: TopicConfig,
    ) -> Result<()> {
        let mut topics = self.topics.write().await;

        if topics.contains_key(name) {
            return Err(BitChatError::Config(format!(
                "Topic {} already exists",
                name
            )));
        }

        // Check if persistent before moving config
        let is_persistent = config.persistent;

        let metadata = TopicMetadata {
            name: name.to_string(),
            created_at: SystemTime::now(),
            owner: owner.to_string(),
            acl: HashMap::new(),
            config,
        };

        topics.insert(name.to_string(), metadata);

        // Initialize message history if persistent
        if is_persistent {
            let mut history = self.message_history.write().await;
            history.insert(name.to_string(), Vec::new());
        }

        tracing::info!("Created topic {} with owner {}", name, owner);
        Ok(())
    }

    /// Get subscribers for a topic (including wildcard matches)
    pub async fn get_subscribers(&self, topic: &str) -> Result<Vec<String>> {
        let mut all_subscribers = HashSet::new();

        // Get direct subscribers
        let subs = self.subscriptions.read().await;
        if let Some(topic_subs) = subs.get(topic) {
            all_subscribers.extend(topic_subs.iter().cloned());
        }

        // Get wildcard subscribers
        let wildcard_subs = self.wildcard_subs.read().await;
        for (pattern, subscriber) in wildcard_subs.iter() {
            if self.matches_pattern(topic, pattern) {
                all_subscribers.insert(subscriber.clone());
            }
        }

        Ok(all_subscribers.into_iter().collect())
    }

    /// Handle incoming message for a topic
    pub async fn handle_message(&mut self, topic: &str, message: &ReceivedMessage) -> Result<()> {
        // Check access control
        if !self
            .check_access(topic, &message.sender, AccessLevel::ReadWrite)
            .await?
        {
            return Err(BitChatError::Config(
                "Insufficient permissions to publish".to_string(),
            ));
        }

        // Store in history if persistent
        let topics = self.topics.read().await;
        if let Some(topic_meta) = topics.get(topic) {
            if topic_meta.config.persistent {
                let retention_duration = topic_meta.config.retention_duration;
                drop(topics);
                let mut history = self.message_history.write().await;
                if let Some(topic_history) = history.get_mut(topic) {
                    topic_history.push(message.clone());

                    // Trim old messages based on retention
                    let retention = std::time::Duration::from_secs(retention_duration);
                    let cutoff = SystemTime::now() - retention;
                    topic_history.retain(|msg| msg.timestamp > cutoff);
                }
            }
        }

        // Use multicast if available
        if self.is_multicast_enabled(topic).await? {
            self.multicast_message(topic, message).await?;
        }

        Ok(())
    }

    /// Get message history for a topic
    pub async fn get_message_history(
        &self,
        topic: &str,
        limit: usize,
    ) -> Result<Vec<ReceivedMessage>> {
        let history = self.message_history.read().await;
        if let Some(topic_history) = history.get(topic) {
            let start = topic_history.len().saturating_sub(limit);
            Ok(topic_history[start..].to_vec())
        } else {
            Ok(Vec::new())
        }
    }

    /// Set access level for a peer on a topic
    pub async fn set_access(
        &mut self,
        topic: &str,
        peer_id: &str,
        level: AccessLevel,
    ) -> Result<()> {
        let mut topics = self.topics.write().await;
        if let Some(topic_meta) = topics.get_mut(topic) {
            topic_meta.acl.insert(peer_id.to_string(), level);
            Ok(())
        } else {
            Err(BitChatError::Config(format!("Topic {} not found", topic)))
        }
    }

    /// Check access level for a peer on a topic
    async fn check_access(
        &self,
        topic: &str,
        peer_id: &str,
        required: AccessLevel,
    ) -> Result<bool> {
        let topics = self.topics.read().await;
        if let Some(topic_meta) = topics.get(topic) {
            // Owner has full access
            if topic_meta.owner == peer_id {
                return Ok(true);
            }

            // Check ACL
            if let Some(&level) = topic_meta.acl.get(peer_id) {
                Ok(match (required, level) {
                    (AccessLevel::ReadOnly, _) => true,
                    (AccessLevel::ReadWrite, AccessLevel::ReadWrite) => true,
                    (AccessLevel::ReadWrite, AccessLevel::Admin) => true,
                    (AccessLevel::Admin, AccessLevel::Admin) => true,
                    _ => false,
                })
            } else {
                // Default access
                Ok(required == AccessLevel::ReadOnly)
            }
        } else {
            // Topic doesn't exist, allow creation
            Ok(true)
        }
    }

    /// Match topic against wildcard pattern
    fn matches_pattern(&self, topic: &str, pattern: &str) -> bool {
        let topic_parts: Vec<&str> = topic.split('/').collect();
        let pattern_parts: Vec<&str> = pattern.split('/').collect();

        if topic_parts.len() != pattern_parts.len() && !pattern.contains("**") {
            return false;
        }

        for (i, (topic_part, pattern_part)) in
            topic_parts.iter().zip(pattern_parts.iter()).enumerate()
        {
            match *pattern_part {
                "*" => continue,     // Single wildcard matches any single level
                "**" => return true, // Multi-level wildcard matches everything after
                _ => {
                    if topic_part != pattern_part {
                        return false;
                    }
                }
            }
        }

        true
    }

    /// Update multicast group membership
    fn update_multicast_group(&self, topic: &str, peer_id: &str, add: bool) -> Result<()> {
        let mut groups = futures::executor::block_on(self.multicast_groups.write());

        if add {
            groups
                .entry(topic.to_string())
                .or_insert_with(Vec::new)
                .push(peer_id.to_string());
        } else {
            if let Some(group) = groups.get_mut(topic) {
                group.retain(|id| id != peer_id);
                if group.is_empty() {
                    groups.remove(topic);
                }
            }
        }

        Ok(())
    }

    /// Check if multicast is enabled for a topic
    async fn is_multicast_enabled(&self, topic: &str) -> Result<bool> {
        let topics = self.topics.read().await;
        Ok(topics
            .get(topic)
            .map(|meta| meta.config.multicast_enabled)
            .unwrap_or(false))
    }

    /// Multicast a message to all subscribers efficiently
    async fn multicast_message(&self, topic: &str, message: &ReceivedMessage) -> Result<()> {
        let groups = self.multicast_groups.read().await;
        if let Some(group) = groups.get(topic) {
            // In a real implementation, this would use actual multicast protocols
            // For now, we just track the group membership
            tracing::debug!(
                "Multicasting to {} subscribers on topic {}",
                group.len(),
                topic
            );
        }
        Ok(())
    }

    /// Get topic statistics
    pub async fn get_topic_stats(&self, topic: &str) -> Option<TopicStats> {
        let subs = self.subscriptions.read().await;
        let topics = self.topics.read().await;
        let history = self.message_history.read().await;

        if let Some(topic_meta) = topics.get(topic) {
            let subscriber_count = subs.get(topic).map(|s| s.len()).unwrap_or(0);
            let message_count = history.get(topic).map(|h| h.len()).unwrap_or(0);

            Some(TopicStats {
                name: topic.to_string(),
                created_at: topic_meta.created_at,
                owner: topic_meta.owner.clone(),
                subscriber_count,
                message_count,
                config: topic_meta.config.clone(),
            })
        } else {
            None
        }
    }
}

/// Topic statistics
#[derive(Debug, Clone)]
pub struct TopicStats {
    /// Topic name
    pub name: String,
    /// Creation time
    pub created_at: SystemTime,
    /// Topic owner
    pub owner: String,
    /// Number of subscribers
    pub subscriber_count: usize,
    /// Number of messages in history
    pub message_count: usize,
    /// Topic configuration
    pub config: TopicConfig,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::messaging::{MessagePriority, MessageType};
    use uuid::Uuid;

    #[tokio::test]
    async fn test_basic_pubsub() {
        let mut pubsub = TopicBasedPubSub::new();

        // Subscribe to topic
        pubsub.subscribe("peer1", "test/topic").unwrap();
        pubsub.subscribe("peer2", "test/topic").unwrap();

        // Get subscribers
        let subs = pubsub.get_subscribers("test/topic").await.unwrap();
        assert_eq!(subs.len(), 2);
        assert!(subs.contains(&"peer1".to_string()));
        assert!(subs.contains(&"peer2".to_string()));

        // Unsubscribe
        pubsub.unsubscribe("peer1", "test/topic").unwrap();
        let subs = pubsub.get_subscribers("test/topic").await.unwrap();
        assert_eq!(subs.len(), 1);
        assert!(subs.contains(&"peer2".to_string()));
    }

    #[test]
    fn test_wildcard_matching() {
        let pubsub = TopicBasedPubSub::new();

        // Test single wildcard
        assert!(pubsub.matches_pattern("sensors/temp/room1", "sensors/*/room1"));
        assert!(pubsub.matches_pattern("sensors/temp/room1", "sensors/temp/*"));
        assert!(!pubsub.matches_pattern("sensors/temp/room1", "sensors/*"));

        // Test multi-level wildcard
        assert!(pubsub.matches_pattern("sensors/temp/room1", "sensors/**"));
        assert!(pubsub.matches_pattern("sensors/temp/room1/data", "sensors/**"));
    }

    #[tokio::test]
    async fn test_topic_creation_and_access() {
        let mut pubsub = TopicBasedPubSub::new();

        // Create topic
        let config = TopicConfig {
            persistent: true,
            ..Default::default()
        };
        pubsub
            .create_topic("private/data", "owner1", config)
            .await
            .unwrap();

        // Set access
        pubsub
            .set_access("private/data", "peer1", AccessLevel::ReadOnly)
            .await
            .unwrap();
        pubsub
            .set_access("private/data", "peer2", AccessLevel::ReadWrite)
            .await
            .unwrap();

        // Check access
        assert!(pubsub
            .check_access("private/data", "owner1", AccessLevel::Admin)
            .await
            .unwrap());
        assert!(pubsub
            .check_access("private/data", "peer1", AccessLevel::ReadOnly)
            .await
            .unwrap());
        assert!(!pubsub
            .check_access("private/data", "peer1", AccessLevel::ReadWrite)
            .await
            .unwrap());
        assert!(pubsub
            .check_access("private/data", "peer2", AccessLevel::ReadWrite)
            .await
            .unwrap());
    }

    #[tokio::test]
    async fn test_message_history() {
        let mut pubsub = TopicBasedPubSub::new();

        // Create persistent topic
        let config = TopicConfig {
            persistent: true,
            retention_duration: 3600,
            ..Default::default()
        };
        pubsub
            .create_topic("logs/app", "admin", config)
            .await
            .unwrap();
        pubsub
            .set_access("logs/app", "writer", AccessLevel::ReadWrite)
            .await
            .unwrap();

        // Send messages
        for i in 0..5 {
            let message = ReceivedMessage {
                id: Uuid::new_v4().to_string(),
                sender: "writer".to_string(),
                recipient: "broadcast".to_string(),
                topic: Some("logs/app".to_string()),
                data: format!("Log entry {}", i).into_bytes(),
                timestamp: SystemTime::now(),
                is_ephemeral: false,
                priority: MessagePriority::Normal,
                message_type: MessageType::Broadcast,
                encryption_info: None,
                compression_info: None,
            };

            pubsub.handle_message("logs/app", &message).await.unwrap();
        }

        // Get history
        let history = pubsub.get_message_history("logs/app", 3).await.unwrap();
        assert_eq!(history.len(), 3);
        assert!(String::from_utf8_lossy(&history[2].data).contains("Log entry 4"));
    }
}
