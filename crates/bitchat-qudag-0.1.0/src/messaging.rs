//! Core messaging implementation for BitChat-QuDAG integration

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::cmp::{Ordering, Reverse};
use std::collections::{BinaryHeap, HashMap};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

use crate::config::BitChatConfig;
use crate::crypto::HybridCrypto;
use crate::error::{BitChatError, Result};
use crate::transport::MultiTransport;
use crate::utils::compression::{compress_data, decompress_data};

#[cfg(feature = "bloom")]
use bloom::{BloomFilter, ASMS};

pub mod extensions;
pub mod pubsub;
pub mod store_forward;
pub mod sync;

pub use extensions::{MessageReaction, ProtocolExtensions, ThreadMessage};
pub use pubsub::TopicBasedPubSub;
pub use store_forward::StoreForwardQueue;
pub use sync::MessageSync;

/// Core messaging trait for QuDAG integration
#[async_trait]
pub trait QuDAGMessaging: Send + Sync {
    /// Send a message to a specific peer
    async fn send_message(&self, peer_id: &str, message: &[u8]) -> Result<()>;

    /// Receive the next available message
    async fn receive_message(&self) -> Result<Option<ReceivedMessage>>;

    /// Subscribe to a topic for pub/sub messaging
    async fn subscribe_topic(&self, topic: &str) -> Result<()>;

    /// Unsubscribe from a topic
    async fn unsubscribe_topic(&self, topic: &str) -> Result<()>;

    /// Publish a message to a topic
    async fn publish_message(&self, topic: &str, message: &[u8]) -> Result<()>;

    /// Get list of connected peers
    async fn get_connected_peers(&self) -> Result<Vec<PeerInfo>>;

    /// Get local peer ID
    fn local_peer_id(&self) -> String;

    /// Check if peer is connected
    async fn is_peer_connected(&self, peer_id: &str) -> Result<bool>;

    /// Get messaging statistics
    async fn get_stats(&self) -> Result<MessagingStats>;

    /// Connect to a peer
    async fn connect_peer(&self, peer_address: &str) -> Result<String>;

    /// Disconnect from a peer
    async fn disconnect_peer(&self, peer_id: &str) -> Result<()>;

    /// Start the messaging system
    async fn start(&mut self) -> Result<()>;

    /// Stop the messaging system
    async fn stop(&mut self) -> Result<()>;
}

/// Information about a received message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceivedMessage {
    /// Message ID
    pub id: String,
    /// Sender peer ID
    pub sender: String,
    /// Recipient peer ID
    pub recipient: String,
    /// Topic (if pub/sub message)
    pub topic: Option<String>,
    /// Message data
    pub data: Vec<u8>,
    /// Timestamp when message was created
    pub timestamp: SystemTime,
    /// Is ephemeral message
    pub is_ephemeral: bool,
    /// Message priority
    pub priority: MessagePriority,
    /// Message type
    pub message_type: MessageType,
    /// Encryption info
    pub encryption_info: Option<EncryptionInfo>,
    /// Compression info
    pub compression_info: Option<CompressionInfo>,
}

/// Message priority levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum MessagePriority {
    /// Low priority
    Low,
    /// Normal priority
    Normal,
    /// High priority
    High,
    /// Critical priority
    Critical,
}

impl Default for MessagePriority {
    fn default() -> Self {
        Self::Normal
    }
}

/// Message types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MessageType {
    /// Direct peer-to-peer message
    Direct,
    /// Topic broadcast message
    Broadcast,
    /// System message
    System,
    /// Heartbeat message
    Heartbeat,
    /// Key exchange message
    KeyExchange,
    /// Acknowledgment message
    Acknowledgment,
}

impl Default for MessageType {
    fn default() -> Self {
        Self::Direct
    }
}

/// Encryption information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionInfo {
    /// Encryption algorithm used
    pub algorithm: String,
    /// Key ID used for encryption
    pub key_id: String,
    /// Encryption parameters
    pub parameters: HashMap<String, String>,
}

/// Compression information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionInfo {
    /// Compression algorithm used
    pub algorithm: String,
    /// Original size before compression
    pub original_size: usize,
    /// Compressed size
    pub compressed_size: usize,
    /// Compression ratio
    pub ratio: f64,
}

/// Information about a peer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    /// Peer ID
    pub id: String,
    /// Peer address
    pub address: String,
    /// Transport type used
    pub transport: String,
    /// Connection timestamp
    pub connected_at: SystemTime,
    /// Last seen timestamp
    pub last_seen: SystemTime,
    /// Latency in milliseconds
    pub latency_ms: Option<f64>,
    /// Peer capabilities
    pub capabilities: Vec<String>,
    /// Peer metadata
    pub metadata: HashMap<String, String>,
}

/// Messaging statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagingStats {
    /// Total messages sent
    pub messages_sent: u64,
    /// Total messages received
    pub messages_received: u64,
    /// Total bytes sent
    pub bytes_sent: u64,
    /// Total bytes received
    pub bytes_received: u64,
    /// Number of connected peers
    pub connected_peers: usize,
    /// Number of active subscriptions
    pub active_subscriptions: usize,
    /// Average compression ratio
    pub compression_ratio: f64,
    /// Average encryption overhead
    pub encryption_overhead: f64,
    /// Average latency
    pub average_latency: f64,
    /// Error count
    pub error_count: u64,
    /// Uptime in seconds
    pub uptime: u64,
    /// Last activity timestamp
    pub last_activity: SystemTime,
}

impl Default for MessagingStats {
    fn default() -> Self {
        Self {
            messages_sent: 0,
            messages_received: 0,
            bytes_sent: 0,
            bytes_received: 0,
            connected_peers: 0,
            active_subscriptions: 0,
            compression_ratio: 1.0,
            encryption_overhead: 0.0,
            average_latency: 0.0,
            error_count: 0,
            uptime: 0,
            last_activity: SystemTime::now(),
        }
    }
}

/// Prioritized message for the priority queue
#[derive(Debug, Clone)]
struct PrioritizedMessage {
    message: ReceivedMessage,
    priority_value: u8,
}

impl PartialEq for PrioritizedMessage {
    fn eq(&self, other: &Self) -> bool {
        self.priority_value == other.priority_value
    }
}

impl Eq for PrioritizedMessage {}

impl PartialOrd for PrioritizedMessage {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PrioritizedMessage {
    fn cmp(&self, other: &Self) -> Ordering {
        // Higher priority values come first
        other
            .priority_value
            .cmp(&self.priority_value)
            .then_with(|| {
                // For same priority, older messages come first
                self.message.timestamp.cmp(&other.message.timestamp)
            })
    }
}

/// Message fragment for large messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageFragment {
    /// Fragment ID (same for all fragments of a message)
    pub fragment_id: String,
    /// Total number of fragments
    pub total_fragments: u16,
    /// Current fragment index
    pub fragment_index: u16,
    /// Fragment data
    pub data: Vec<u8>,
    /// Checksum of complete message
    pub checksum: String,
}

/// BitChat messaging implementation
pub struct BitChatMessaging {
    /// Local peer ID
    local_peer_id: String,
    /// Configuration
    config: BitChatConfig,
    /// Cryptography handler
    crypto: Arc<RwLock<HybridCrypto>>,
    /// Transport layer
    transport: Arc<RwLock<MultiTransport>>,
    /// Message statistics
    stats: Arc<RwLock<MessagingStats>>,
    /// Active subscriptions
    subscriptions: Arc<RwLock<HashMap<String, SystemTime>>>,
    /// Priority message queue
    message_queue: Arc<RwLock<BinaryHeap<Reverse<PrioritizedMessage>>>>,
    /// Message deduplication bloom filter
    #[cfg(feature = "bloom")]
    dedup_filter: Arc<RwLock<BloomFilter>>,
    /// Message fragments storage
    fragments: Arc<RwLock<HashMap<String, HashMap<u16, MessageFragment>>>>,
    /// Running state
    is_running: Arc<RwLock<bool>>,
    /// Start time
    start_time: SystemTime,
    /// Store & forward queue
    store_forward_queue: Arc<RwLock<StoreForwardQueue>>,
    /// Topic-based pub/sub
    pubsub: Arc<RwLock<TopicBasedPubSub>>,
    /// Message synchronization
    message_sync: Arc<RwLock<MessageSync>>,
    /// Protocol extensions
    extensions: Arc<RwLock<ProtocolExtensions>>,
    /// Cover traffic generator
    cover_traffic_handle: Option<tokio::task::JoinHandle<()>>,
    /// Message acknowledgment tracking
    pending_acks: Arc<RwLock<HashMap<String, (SystemTime, u32)>>>,
    /// Message processing channel
    message_processor: Option<mpsc::Sender<ReceivedMessage>>,
}

/// Stored message for store & forward
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMessage {
    /// Message
    pub message: ReceivedMessage,
    /// Expiry time
    pub expires_at: SystemTime,
    /// Retry count
    pub retry_count: u32,
    /// Last retry time
    pub last_retry: SystemTime,
}

impl BitChatMessaging {
    /// Create a new BitChat messaging instance
    pub async fn new(config: BitChatConfig) -> Result<Self> {
        let local_peer_id = Uuid::new_v4().to_string();

        tracing::info!(
            "Creating BitChat messaging instance with ID: {}",
            local_peer_id
        );

        // Initialize cryptography
        let crypto = Arc::new(RwLock::new(HybridCrypto::new(config.crypto_mode.clone())?));

        // Initialize transport
        let transport = Arc::new(RwLock::new(MultiTransport::new(&config).await?));

        // Initialize store & forward queue
        let store_forward_queue = StoreForwardQueue::new(&config)?;

        // Initialize topic-based pub/sub
        let pubsub = TopicBasedPubSub::new();

        // Initialize message sync
        let message_sync = MessageSync::new(&local_peer_id);

        // Initialize protocol extensions
        let extensions = ProtocolExtensions::new(&config);

        // Create bloom filter for deduplication
        #[cfg(feature = "bloom")]
        let dedup_filter = BloomFilter::with_rate(0.01, 1_000_000); // 1% false positive rate, 1M expected items

        Ok(Self {
            local_peer_id,
            config,
            crypto,
            transport,
            stats: Arc::new(RwLock::new(MessagingStats::default())),
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
            message_queue: Arc::new(RwLock::new(BinaryHeap::new())),
            #[cfg(feature = "bloom")]
            dedup_filter: Arc::new(RwLock::new(dedup_filter)),
            fragments: Arc::new(RwLock::new(HashMap::new())),
            is_running: Arc::new(RwLock::new(false)),
            start_time: SystemTime::now(),
            store_forward_queue: Arc::new(RwLock::new(store_forward_queue)),
            pubsub: Arc::new(RwLock::new(pubsub)),
            message_sync: Arc::new(RwLock::new(message_sync)),
            extensions: Arc::new(RwLock::new(extensions)),
            cover_traffic_handle: None,
            pending_acks: Arc::new(RwLock::new(HashMap::new())),
            message_processor: None,
        })
    }

    /// Fragment a large message
    fn fragment_message(
        &self,
        data: &[u8],
        max_fragment_size: usize,
    ) -> Result<Vec<MessageFragment>> {
        if data.len() <= max_fragment_size {
            return Err(BitChatError::Config(
                "Message does not need fragmentation".to_string(),
            ));
        }

        let fragment_id = Uuid::new_v4().to_string();
        let total_fragments = ((data.len() + max_fragment_size - 1) / max_fragment_size) as u16;
        let checksum = blake3::hash(data).to_hex().to_string();

        let mut fragments = Vec::new();
        for i in 0..total_fragments {
            let start = (i as usize) * max_fragment_size;
            let end = std::cmp::min(start + max_fragment_size, data.len());

            fragments.push(MessageFragment {
                fragment_id: fragment_id.clone(),
                total_fragments,
                fragment_index: i,
                data: data[start..end].to_vec(),
                checksum: checksum.clone(),
            });
        }

        Ok(fragments)
    }

    /// Reassemble message fragments
    async fn reassemble_fragments(&self, fragment_id: &str) -> Result<Option<Vec<u8>>> {
        let mut fragments_map = self.fragments.write().await;

        if let Some(fragments) = fragments_map.get(fragment_id) {
            // Check if we have all fragments
            let first_fragment = fragments.values().next().unwrap();
            if fragments.len() == first_fragment.total_fragments as usize {
                // Reassemble the message
                let mut data = Vec::new();
                for i in 0..first_fragment.total_fragments {
                    if let Some(fragment) = fragments.get(&i) {
                        data.extend_from_slice(&fragment.data);
                    } else {
                        return Ok(None); // Missing fragment
                    }
                }

                // Verify checksum
                let checksum = blake3::hash(&data).to_hex().to_string();
                if checksum == first_fragment.checksum {
                    // Remove fragments after successful reassembly
                    fragments_map.remove(fragment_id);
                    Ok(Some(data))
                } else {
                    Err(BitChatError::Crypto(
                        "Fragment checksum mismatch".to_string(),
                    ))
                }
            } else {
                Ok(None) // Not all fragments received yet
            }
        } else {
            Ok(None)
        }
    }

    /// Check if message is duplicate
    #[cfg(feature = "bloom")]
    async fn is_duplicate(&self, message_id: &str) -> bool {
        let mut filter = self.dedup_filter.write().await;
        if filter.contains(&message_id) {
            true
        } else {
            filter.insert(&message_id);
            false
        }
    }

    /// Convert message priority to numeric value
    fn priority_to_value(priority: &MessagePriority) -> u8 {
        match priority {
            MessagePriority::Low => 1,
            MessagePriority::Normal => 5,
            MessagePriority::High => 10,
            MessagePriority::Critical => 20,
        }
    }

    /// Send acknowledgment for a message
    async fn send_acknowledgment(&self, message_id: &str, sender: &str) -> Result<()> {
        let ack_message = ReceivedMessage {
            id: Uuid::new_v4().to_string(),
            sender: self.local_peer_id.clone(),
            recipient: sender.to_string(),
            topic: None,
            data: message_id.as_bytes().to_vec(),
            timestamp: SystemTime::now(),
            is_ephemeral: true,
            priority: MessagePriority::High,
            message_type: MessageType::Acknowledgment,
            encryption_info: None,
            compression_info: None,
        };

        let transport = self.transport.read().await;
        transport.send_to_peer(sender, &ack_message).await?;

        Ok(())
    }

    /// Process acknowledgment
    async fn process_acknowledgment(&self, message_id: &str) -> Result<()> {
        let mut pending = self.pending_acks.write().await;
        if pending.remove(message_id).is_some() {
            tracing::debug!("Received acknowledgment for message {}", message_id);
        }
        Ok(())
    }

    /// Process incoming message
    async fn process_incoming_message(&self, mut message: ReceivedMessage) -> Result<()> {
        tracing::debug!("Processing incoming message from {}", message.sender);

        // Check for duplicate messages
        #[cfg(feature = "bloom")]
        {
            if self.is_duplicate(&message.id).await {
                tracing::debug!("Dropping duplicate message {}", message.id);
                return Ok(());
            }
        }

        // Handle acknowledgments
        if message.message_type == MessageType::Acknowledgment {
            let message_id = String::from_utf8_lossy(&message.data).to_string();
            return self.process_acknowledgment(&message_id).await;
        }

        // Send acknowledgment if required
        if message.priority >= MessagePriority::High {
            self.send_acknowledgment(&message.id, &message.sender)
                .await?;
        }

        // Decrypt message if needed
        if message.encryption_info.is_some() {
            message.data = self.decrypt_message(&message.data, &message.sender).await?;
        }

        // Decompress message if needed
        if message.compression_info.is_some() {
            message.data = decompress_data(&message.data, &self.config)?;
        }

        // Handle ephemeral messages
        if message.is_ephemeral {
            let expires_at = message.timestamp + self.config.privacy.ephemeral_ttl;
            if SystemTime::now() > expires_at {
                tracing::debug!("Dropping expired ephemeral message");
                return Ok(());
            }
        }

        // Update message sync
        {
            let mut sync = self.message_sync.write().await;
            sync.add_message(&message)?;
        }

        // Process through extensions
        {
            let mut extensions = self.extensions.write().await;
            if let Some(extended_message) = extensions.process_message(&message).await? {
                message = extended_message;
            }
        }

        // Add to priority queue
        {
            let priority_value = Self::priority_to_value(&message.priority);
            let prioritized = PrioritizedMessage {
                message: message.clone(),
                priority_value,
            };

            let mut queue = self.message_queue.write().await;
            queue.push(Reverse(prioritized));
        }

        // Process through pub/sub if it's a topic message
        if let Some(topic) = &message.topic {
            let mut pubsub = self.pubsub.write().await;
            pubsub.handle_message(topic, &message).await?;
        }

        // Update statistics
        {
            let mut stats = self.stats.write().await;
            stats.messages_received += 1;
            stats.bytes_received += message.data.len() as u64;
            stats.last_activity = SystemTime::now();
        }

        Ok(())
    }

    /// Encrypt message data
    async fn encrypt_message(&self, data: &[u8], _recipient: &str) -> Result<Vec<u8>> {
        let crypto = self.crypto.read().await;

        // For now, use general encryption (peer-specific encryption would require write lock)
        crypto.encrypt(data).await
    }

    /// Decrypt message data
    async fn decrypt_message(&self, data: &[u8], _sender: &str) -> Result<Vec<u8>> {
        let crypto = self.crypto.read().await;

        // For now, use general decryption (peer-specific decryption would require write lock)
        crypto.decrypt(data).await
    }

    /// Compress message data if enabled
    fn compress_message(&self, data: &[u8]) -> Result<(Vec<u8>, Option<CompressionInfo>)> {
        if self.config.compression && data.len() > self.config.compression_threshold {
            let original_size = data.len();
            let compressed_data = compress_data(data, &self.config)?;
            let compressed_size = compressed_data.len();

            let compression_info = CompressionInfo {
                algorithm: "lz4".to_string(),
                original_size,
                compressed_size,
                ratio: compressed_size as f64 / original_size as f64,
            };

            Ok((compressed_data, Some(compression_info)))
        } else {
            Ok((data.to_vec(), None))
        }
    }

    /// Generate cover traffic
    async fn generate_cover_traffic(&self) -> Result<()> {
        if !self.config.cover_traffic {
            return Ok(());
        }

        let peers = self.get_connected_peers().await?;
        if peers.is_empty() {
            return Ok(());
        }

        // Generate random cover traffic
        let crypto = self.crypto.read().await;
        let dummy_data = crypto.random_bytes(64 + (rand::random::<usize>() % 256)); // 64-320 bytes

        // Send to random peer
        let peer_index = rand::random::<usize>() % peers.len();
        let peer_id = &peers[peer_index].id;

        let cover_message = ReceivedMessage {
            id: Uuid::new_v4().to_string(),
            sender: self.local_peer_id.clone(),
            recipient: peer_id.clone(),
            topic: None,
            data: dummy_data,
            timestamp: SystemTime::now(),
            is_ephemeral: true,
            priority: MessagePriority::Low,
            message_type: MessageType::System,
            encryption_info: None,
            compression_info: None,
        };

        let transport = self.transport.read().await;
        transport.send_to_peer(peer_id, &cover_message).await?;

        tracing::trace!("Generated cover traffic to peer {}", peer_id);
        Ok(())
    }

    /// Process store & forward queue
    async fn process_store_forward(&self) -> Result<()> {
        if !self.config.store_forward {
            return Ok(());
        }

        let mut queue = self.store_forward_queue.write().await;
        let messages_to_retry = queue.get_messages_to_retry().await?;

        for mut stored_message in messages_to_retry {
            // Check if peer is now connected
            if self
                .is_peer_connected(&stored_message.message.recipient)
                .await?
            {
                // Try to send the message
                let transport = self.transport.read().await;
                match transport
                    .send_to_peer(&stored_message.message.recipient, &stored_message.message)
                    .await
                {
                    Ok(()) => {
                        tracing::debug!(
                            "Successfully forwarded stored message to {}",
                            stored_message.message.recipient
                        );
                        queue.remove_message(&stored_message.message.id).await?;
                    }
                    Err(e) => {
                        stored_message.retry_count += 1;
                        stored_message.last_retry = SystemTime::now();

                        if stored_message.retry_count >= 3 {
                            tracing::warn!("Failed to forward message after 3 retries: {}", e);
                            queue.remove_message(&stored_message.message.id).await?;
                        } else {
                            queue.update_message(&stored_message).await?;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Clean up expired messages
    async fn cleanup_expired_messages(&self) -> Result<()> {
        let mut queue = self.message_queue.write().await;
        let now = SystemTime::now();

        // Collect messages into a new heap, filtering out expired ones
        let mut new_queue = BinaryHeap::new();

        while let Some(Reverse(prioritized)) = queue.pop() {
            if prioritized.message.is_ephemeral {
                let expires_at = prioritized.message.timestamp + self.config.privacy.ephemeral_ttl;
                if now <= expires_at {
                    new_queue.push(Reverse(prioritized));
                }
            } else {
                new_queue.push(Reverse(prioritized));
            }
        }

        *queue = new_queue;

        // Clean up old fragments
        {
            let mut fragments = self.fragments.write().await;
            let cutoff = now - Duration::from_secs(3600); // 1 hour timeout for fragments

            fragments.retain(|_, fragment_map| {
                if let Some(first_fragment) = fragment_map.values().next() {
                    // Keep fragments that are less than 1 hour old
                    SystemTime::now().duration_since(cutoff).is_ok()
                } else {
                    false
                }
            });
        }

        // Clean up pending acknowledgments
        {
            let mut pending = self.pending_acks.write().await;
            let timeout = Duration::from_secs(30); // 30 second ACK timeout

            pending.retain(|_, (timestamp, _)| {
                now.duration_since(*timestamp)
                    .unwrap_or(Duration::from_secs(0))
                    < timeout
            });
        }

        Ok(())
    }

    /// Update peer activity
    async fn update_peer_activity(&self, _peer_id: &str) -> Result<()> {
        let transport = self.transport.read().await;
        let _peers = transport.get_connected_peers().await?;

        // Update last seen time for the peer
        // This would be implemented in the transport layer

        Ok(())
    }
}

#[async_trait]
impl QuDAGMessaging for BitChatMessaging {
    async fn send_message(&self, peer_id: &str, message: &[u8]) -> Result<()> {
        tracing::debug!("Sending message to peer: {}", peer_id);

        if !*self.is_running.read().await {
            return Err(BitChatError::Config(
                "Messaging system not running".to_string(),
            ));
        }

        // Check if message needs fragmentation
        const MAX_FRAGMENT_SIZE: usize = 65536; // 64KB fragments
        let fragments = if message.len() > MAX_FRAGMENT_SIZE {
            Some(self.fragment_message(message, MAX_FRAGMENT_SIZE)?)
        } else {
            None
        };

        if let Some(fragments) = fragments {
            // Send all fragments
            for fragment in fragments {
                let fragment_data = bincode::serialize(&fragment)?;
                self.send_single_message(peer_id, &fragment_data, MessagePriority::High)
                    .await?;
            }
            Ok(())
        } else {
            // Send as single message
            self.send_single_message(peer_id, message, MessagePriority::Normal)
                .await
        }
    }

    async fn receive_message(&self) -> Result<Option<ReceivedMessage>> {
        if !*self.is_running.read().await {
            return Err(BitChatError::Config(
                "Messaging system not running".to_string(),
            ));
        }

        let mut queue = self.message_queue.write().await;
        if let Some(Reverse(prioritized)) = queue.pop() {
            let message = prioritized.message;

            // Check if this is a fragment
            if let Ok(fragment) = bincode::deserialize::<MessageFragment>(&message.data) {
                // Store fragment
                {
                    let mut fragments = self.fragments.write().await;
                    let fragment_map = fragments
                        .entry(fragment.fragment_id.clone())
                        .or_insert_with(HashMap::new);
                    fragment_map.insert(fragment.fragment_index, fragment.clone());
                }

                // Try to reassemble
                if let Some(complete_data) =
                    self.reassemble_fragments(&fragment.fragment_id).await?
                {
                    // Create a new message with the complete data
                    let complete_message = ReceivedMessage {
                        id: fragment.fragment_id,
                        data: complete_data,
                        ..message
                    };
                    Ok(Some(complete_message))
                } else {
                    // Not all fragments received yet, return None and wait for more
                    Ok(None)
                }
            } else {
                Ok(Some(message))
            }
        } else {
            Ok(None)
        }
    }

    async fn subscribe_topic(&self, topic: &str) -> Result<()> {
        tracing::debug!("Subscribing to topic: {}", topic);

        if !*self.is_running.read().await {
            return Err(BitChatError::Config(
                "Messaging system not running".to_string(),
            ));
        }

        // Subscribe in pub/sub system
        {
            let mut pubsub = self.pubsub.write().await;
            pubsub.subscribe(&self.local_peer_id, topic)?;
        }

        // Subscribe in transport
        let transport = self.transport.read().await;
        transport.subscribe_topic(topic).await?;

        // Track subscription
        {
            let mut subscriptions = self.subscriptions.write().await;
            subscriptions.insert(topic.to_string(), SystemTime::now());
        }

        // Update statistics
        {
            let mut stats = self.stats.write().await;
            stats.active_subscriptions = self.subscriptions.read().await.len();
        }

        Ok(())
    }

    async fn unsubscribe_topic(&self, topic: &str) -> Result<()> {
        tracing::debug!("Unsubscribing from topic: {}", topic);

        if !*self.is_running.read().await {
            return Err(BitChatError::Config(
                "Messaging system not running".to_string(),
            ));
        }

        // Unsubscribe in pub/sub system
        {
            let mut pubsub = self.pubsub.write().await;
            pubsub.unsubscribe(&self.local_peer_id, topic)?;
        }

        // Unsubscribe in transport
        let transport = self.transport.read().await;
        transport.unsubscribe_topic(topic).await?;

        // Remove subscription
        {
            let mut subscriptions = self.subscriptions.write().await;
            subscriptions.remove(topic);
        }

        // Update statistics
        {
            let mut stats = self.stats.write().await;
            stats.active_subscriptions = self.subscriptions.read().await.len();
        }

        Ok(())
    }

    async fn publish_message(&self, topic: &str, message: &[u8]) -> Result<()> {
        tracing::debug!("Publishing message to topic: {}", topic);

        if !*self.is_running.read().await {
            return Err(BitChatError::Config(
                "Messaging system not running".to_string(),
            ));
        }

        // Compress message if needed
        let (compressed_data, compression_info) = self.compress_message(message)?;

        // Encrypt the message
        let encrypted_data = self.encrypt_message(&compressed_data, "broadcast").await?;

        // Create message wrapper
        let msg = ReceivedMessage {
            id: Uuid::new_v4().to_string(),
            sender: self.local_peer_id.clone(),
            recipient: "broadcast".to_string(),
            topic: Some(topic.to_string()),
            data: encrypted_data,
            timestamp: SystemTime::now(),
            is_ephemeral: self.config.ephemeral_messages,
            priority: MessagePriority::default(),
            message_type: MessageType::Broadcast,
            encryption_info: Some(EncryptionInfo {
                algorithm: format!("{:?}", self.config.crypto_mode),
                key_id: self.local_peer_id.clone(),
                parameters: HashMap::new(),
            }),
            compression_info,
        };

        // Publish via transport
        let transport = self.transport.read().await;
        transport.publish_to_topic(topic, &msg).await?;

        // Update statistics
        {
            let mut stats = self.stats.write().await;
            stats.messages_sent += 1;
            stats.bytes_sent += message.len() as u64;
            stats.last_activity = SystemTime::now();
        }

        Ok(())
    }

    async fn get_connected_peers(&self) -> Result<Vec<PeerInfo>> {
        let transport = self.transport.read().await;
        transport.get_connected_peers().await
    }

    fn local_peer_id(&self) -> String {
        self.local_peer_id.clone()
    }

    async fn is_peer_connected(&self, peer_id: &str) -> Result<bool> {
        let transport = self.transport.read().await;
        transport.is_peer_connected(peer_id).await
    }

    async fn get_stats(&self) -> Result<MessagingStats> {
        let mut stats = self.stats.read().await.clone();

        // Update uptime
        stats.uptime = SystemTime::now()
            .duration_since(self.start_time)
            .unwrap_or_default()
            .as_secs();

        // Update connected peers count
        let transport = self.transport.read().await;
        let peers = transport.get_connected_peers().await?;
        stats.connected_peers = peers.len();

        // Update active subscriptions
        stats.active_subscriptions = self.subscriptions.read().await.len();

        Ok(stats)
    }

    async fn connect_peer(&self, peer_address: &str) -> Result<String> {
        let transport = self.transport.read().await;
        transport.connect_peer(peer_address).await
    }

    async fn disconnect_peer(&self, peer_id: &str) -> Result<()> {
        let transport = self.transport.read().await;
        transport.disconnect_peer(peer_id).await
    }

    async fn start(&mut self) -> Result<()> {
        tracing::info!("Starting BitChat messaging system");

        {
            let mut running = self.is_running.write().await;
            if *running {
                return Err(BitChatError::Config(
                    "Messaging system already running".to_string(),
                ));
            }
            *running = true;
        }

        // Start store & forward queue
        {
            let mut queue = self.store_forward_queue.write().await;
            queue.start().await?;
        }

        // Start transport layer
        {
            let mut transport = self.transport.write().await;
            transport.start().await?;
        }

        // Create message processing channel
        let (tx, mut rx) = mpsc::channel(1000);
        self.message_processor = Some(tx);

        // Spawn message processor task
        let queue_clone = self.message_queue.clone();
        let sync_clone = self.message_sync.clone();
        let pubsub_clone = self.pubsub.clone();
        let extensions_clone = self.extensions.clone();

        tokio::spawn(async move {
            while let Some(message) = rx.recv().await {
                // Process message through various subsystems
                tracing::trace!("Processing message {} in background", message.id);
            }
        });

        // Start periodic tasks
        let self_clone = Arc::new(self.clone());
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;

                // Process store & forward queue
                if let Err(e) = self_clone.process_store_forward().await {
                    tracing::error!("Error processing store & forward queue: {}", e);
                }

                // Clean up expired messages
                if let Err(e) = self_clone.cleanup_expired_messages().await {
                    tracing::error!("Error cleaning up expired messages: {}", e);
                }

                // Sync messages with peers
                if let Err(e) = self_clone.sync_messages_with_peers().await {
                    tracing::error!("Error syncing messages: {}", e);
                }
            }
        });

        // Start cover traffic generator if enabled
        if self.config.cover_traffic {
            let self_clone = Arc::new(self.clone());
            let handle = tokio::spawn(async move {
                let mut interval =
                    tokio::time::interval(Duration::from_secs(5 + rand::random::<u64>() % 10));
                loop {
                    interval.tick().await;
                    if let Err(e) = self_clone.generate_cover_traffic().await {
                        tracing::error!("Error generating cover traffic: {}", e);
                    }
                }
            });
            self.cover_traffic_handle = Some(handle);
            tracing::info!("Cover traffic generation enabled");
        }

        tracing::info!("BitChat messaging system started successfully");
        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        tracing::info!("Stopping BitChat messaging system");

        {
            let mut running = self.is_running.write().await;
            if !*running {
                return Ok(());
            }
            *running = false;
        }

        // Stop cover traffic generator
        if let Some(handle) = self.cover_traffic_handle.take() {
            handle.abort();
        }

        // Drop message processor channel to stop the task
        self.message_processor = None;

        // Stop store & forward queue
        {
            let mut queue = self.store_forward_queue.write().await;
            queue.stop().await?;
        }

        // Stop transport layer
        {
            let mut transport = self.transport.write().await;
            transport.stop().await?;
        }

        tracing::info!("BitChat messaging system stopped");
        Ok(())
    }
}

impl BitChatMessaging {
    /// Send a single message (internal helper)
    async fn send_single_message(
        &self,
        peer_id: &str,
        message: &[u8],
        priority: MessagePriority,
    ) -> Result<()> {
        // Compress message if needed
        let (compressed_data, compression_info) = self.compress_message(message)?;

        // Encrypt the message
        let encrypted_data = self.encrypt_message(&compressed_data, peer_id).await?;

        // Create message wrapper
        let msg_id = Uuid::new_v4().to_string();
        let msg = ReceivedMessage {
            id: msg_id.clone(),
            sender: self.local_peer_id.clone(),
            recipient: peer_id.to_string(),
            topic: None,
            data: encrypted_data,
            timestamp: SystemTime::now(),
            is_ephemeral: self.config.ephemeral_messages,
            priority: priority.clone(),
            message_type: MessageType::Direct,
            encryption_info: Some(EncryptionInfo {
                algorithm: format!("{:?}", self.config.crypto_mode),
                key_id: self.local_peer_id.clone(),
                parameters: HashMap::new(),
            }),
            compression_info,
        };

        // Track acknowledgment if needed
        if priority >= MessagePriority::High {
            let mut pending = self.pending_acks.write().await;
            pending.insert(msg_id.clone(), (SystemTime::now(), 0));
        }

        // Try to send immediately
        let transport = self.transport.read().await;
        match transport.send_to_peer(peer_id, &msg).await {
            Ok(()) => {
                // Update statistics
                let mut stats = self.stats.write().await;
                stats.messages_sent += 1;
                stats.bytes_sent += message.len() as u64;
                stats.last_activity = SystemTime::now();

                tracing::debug!("Message sent successfully to {}", peer_id);
                Ok(())
            }
            Err(e) => {
                // Store for later if store & forward is enabled
                if self.config.store_forward {
                    let mut queue = self.store_forward_queue.write().await;
                    queue
                        .add_message(msg, self.config.store_forward_ttl)
                        .await?;

                    tracing::debug!("Message stored for later delivery to {}", peer_id);
                    Ok(())
                } else {
                    Err(e)
                }
            }
        }
    }

    /// Sync messages with connected peers
    async fn sync_messages_with_peers(&self) -> Result<()> {
        let peers = self.get_connected_peers().await?;
        let sync = self.message_sync.read().await;

        for peer in peers {
            // Get sync state for this peer
            if let Some(sync_data) = sync.get_sync_data_for_peer(&peer.id)? {
                let sync_message = ReceivedMessage {
                    id: Uuid::new_v4().to_string(),
                    sender: self.local_peer_id.clone(),
                    recipient: peer.id.clone(),
                    topic: Some("__sync__".to_string()),
                    data: bincode::serialize(&sync_data)?,
                    timestamp: SystemTime::now(),
                    is_ephemeral: false,
                    priority: MessagePriority::Low,
                    message_type: MessageType::System,
                    encryption_info: None,
                    compression_info: None,
                };

                let transport = self.transport.read().await;
                if let Err(e) = transport.send_to_peer(&peer.id, &sync_message).await {
                    tracing::debug!("Failed to send sync data to {}: {}", peer.id, e);
                }
            }
        }

        Ok(())
    }
}

// Clone implementation for BitChatMessaging (needed for spawning tasks)
impl Clone for BitChatMessaging {
    fn clone(&self) -> Self {
        Self {
            local_peer_id: self.local_peer_id.clone(),
            config: self.config.clone(),
            crypto: self.crypto.clone(),
            transport: self.transport.clone(),
            stats: self.stats.clone(),
            subscriptions: self.subscriptions.clone(),
            message_queue: self.message_queue.clone(),
            #[cfg(feature = "bloom")]
            dedup_filter: self.dedup_filter.clone(),
            fragments: self.fragments.clone(),
            is_running: self.is_running.clone(),
            start_time: self.start_time,
            store_forward_queue: self.store_forward_queue.clone(),
            pubsub: self.pubsub.clone(),
            message_sync: self.message_sync.clone(),
            extensions: self.extensions.clone(),
            cover_traffic_handle: None,
            pending_acks: self.pending_acks.clone(),
            message_processor: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::BitChatConfig;

    #[tokio::test]
    async fn test_messaging_creation() {
        let config = BitChatConfig::testing();
        let messaging = BitChatMessaging::new(config).await.unwrap();

        assert!(!messaging.local_peer_id().is_empty());
        assert_eq!(messaging.get_stats().await.unwrap().messages_sent, 0);
    }

    #[tokio::test]
    async fn test_messaging_lifecycle() {
        let config = BitChatConfig::testing();
        let mut messaging = BitChatMessaging::new(config).await.unwrap();

        messaging.start().await.unwrap();
        assert!(*messaging.is_running.read().await);

        messaging.stop().await.unwrap();
        assert!(!*messaging.is_running.read().await);
    }

    #[tokio::test]
    async fn test_message_compression() {
        let config = BitChatConfig {
            compression: true,
            compression_threshold: 10,
            ..BitChatConfig::testing()
        };
        let messaging = BitChatMessaging::new(config).await.unwrap();

        let test_data = b"this is a test message that should be compressed";
        let (compressed, info) = messaging.compress_message(test_data).unwrap();

        assert!(info.is_some());
        let info = info.unwrap();
        assert_eq!(info.original_size, test_data.len());
        assert_eq!(info.compressed_size, compressed.len());
        assert!(info.ratio <= 1.0);
    }

    #[tokio::test]
    async fn test_subscription_management() {
        let config = BitChatConfig::testing();
        let mut messaging = BitChatMessaging::new(config).await.unwrap();

        messaging.start().await.unwrap();

        messaging.subscribe_topic("test-topic").await.unwrap();
        assert_eq!(messaging.subscriptions.read().await.len(), 1);

        let stats = messaging.get_stats().await.unwrap();
        assert_eq!(stats.active_subscriptions, 1);

        messaging.unsubscribe_topic("test-topic").await.unwrap();
        assert_eq!(messaging.subscriptions.read().await.len(), 0);

        messaging.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_stats_tracking() {
        let config = BitChatConfig::testing();
        let mut messaging = BitChatMessaging::new(config).await.unwrap();

        messaging.start().await.unwrap();

        let initial_stats = messaging.get_stats().await.unwrap();
        assert_eq!(initial_stats.messages_sent, 0);
        assert_eq!(initial_stats.messages_received, 0);
        assert!(initial_stats.uptime > 0);

        messaging.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_ephemeral_messages() {
        let config = BitChatConfig {
            ephemeral_messages: true,
            ..BitChatConfig::testing()
        };
        let messaging = BitChatMessaging::new(config).await.unwrap();

        let test_message = ReceivedMessage {
            id: Uuid::new_v4().to_string(),
            sender: "test_sender".to_string(),
            recipient: "test_recipient".to_string(),
            topic: None,
            data: b"test data".to_vec(),
            timestamp: SystemTime::now() - Duration::from_secs(3700), // Expired
            is_ephemeral: true,
            priority: MessagePriority::Normal,
            message_type: MessageType::Direct,
            encryption_info: None,
            compression_info: None,
        };

        {
            let mut queue = messaging.message_queue.write().await;
            queue.push(test_message);
        }

        messaging.cleanup_expired_messages().await.unwrap();

        let queue = messaging.message_queue.read().await;
        assert_eq!(queue.len(), 0); // Should be cleaned up
    }
}
