//! Store & Forward Queue implementation for reliable message delivery

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;

#[cfg(feature = "rocksdb")]
use rocksdb::{Options, DB};

use crate::config::BitChatConfig;
use crate::error::{BitChatError, Result};
use crate::messaging::{ReceivedMessage, StoredMessage};

/// Stored message metadata for indexing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageMetadata {
    /// Message ID
    pub id: String,
    /// Recipient peer ID
    pub recipient: String,
    /// Message priority for ordering
    pub priority: u8,
    /// Timestamp when message was stored
    pub stored_at: SystemTime,
    /// Expiry time
    pub expires_at: SystemTime,
    /// Retry count
    pub retry_count: u32,
    /// Last retry attempt
    pub last_retry: SystemTime,
    /// Message size in bytes
    pub size: usize,
}

/// Store & Forward Queue implementation
pub struct StoreForwardQueue {
    /// Configuration
    config: BitChatConfig,
    /// Database handle (if persistent storage is enabled)
    #[cfg(feature = "rocksdb")]
    db: Option<Arc<DB>>,
    /// In-memory message store (fallback or when DB is disabled)
    memory_store: Arc<RwLock<HashMap<String, StoredMessage>>>,
    /// Message metadata index
    metadata_index: Arc<RwLock<HashMap<String, MessageMetadata>>>,
    /// Queue size limit in bytes
    max_queue_size: usize,
    /// Current queue size in bytes
    current_size: Arc<RwLock<usize>>,
    /// Running state
    is_running: Arc<RwLock<bool>>,
}

impl StoreForwardQueue {
    /// Create a new Store & Forward queue
    pub fn new(config: &BitChatConfig) -> Result<Self> {
        let max_queue_size = 100 * 1024 * 1024; // 100 MB default limit

        #[cfg(feature = "rocksdb")]
        let db = if config.store_forward {
            // Initialize RocksDB for persistent storage
            let mut db_path = PathBuf::from(".bitchat");
            db_path.push("store_forward");
            std::fs::create_dir_all(&db_path)?;

            let mut opts = Options::default();
            opts.create_if_missing(true);
            opts.set_compression_type(rocksdb::DBCompressionType::Zstd);

            match DB::open(&opts, db_path) {
                Ok(db) => {
                    tracing::info!("Initialized persistent store & forward queue");
                    Some(Arc::new(db))
                }
                Err(e) => {
                    tracing::warn!("Failed to initialize RocksDB, using memory store: {}", e);
                    None
                }
            }
        } else {
            None
        };

        Ok(Self {
            config: config.clone(),
            #[cfg(feature = "rocksdb")]
            db,
            memory_store: Arc::new(RwLock::new(HashMap::new())),
            metadata_index: Arc::new(RwLock::new(HashMap::new())),
            max_queue_size,
            current_size: Arc::new(RwLock::new(0)),
            is_running: Arc::new(RwLock::new(false)),
        })
    }

    /// Start the queue
    pub async fn start(&mut self) -> Result<()> {
        let mut running = self.is_running.write().await;
        if *running {
            return Ok(());
        }
        *running = true;

        // Load existing messages from persistent storage
        #[cfg(feature = "rocksdb")]
        if let Some(db) = &self.db {
            self.load_from_disk(db).await?;
        }

        // Start expiry cleanup task
        let metadata_clone = self.metadata_index.clone();
        let memory_clone = self.memory_store.clone();
        #[cfg(feature = "rocksdb")]
        let db_clone = self.db.clone();
        let current_size_clone = self.current_size.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;

                // Clean up expired messages
                let now = SystemTime::now();
                let mut metadata = metadata_clone.write().await;
                let mut memory = memory_clone.write().await;
                let mut expired = Vec::new();

                for (id, meta) in metadata.iter() {
                    if now > meta.expires_at {
                        expired.push(id.clone());
                    }
                }

                let mut total_freed = 0;
                for id in expired {
                    if let Some(meta) = metadata.remove(&id) {
                        total_freed += meta.size;
                        memory.remove(&id);

                        #[cfg(feature = "rocksdb")]
                        if let Some(db) = &db_clone {
                            let _ = db.delete(id.as_bytes());
                        }
                    }
                }

                if total_freed > 0 {
                    let mut size = current_size_clone.write().await;
                    *size = size.saturating_sub(total_freed);
                    tracing::debug!("Cleaned up {} bytes of expired messages", total_freed);
                }
            }
        });

        tracing::info!("Store & forward queue started");
        Ok(())
    }

    /// Stop the queue
    pub async fn stop(&mut self) -> Result<()> {
        let mut running = self.is_running.write().await;
        if !*running {
            return Ok(());
        }
        *running = false;

        // Flush any pending writes
        #[cfg(feature = "rocksdb")]
        if let Some(db) = &self.db {
            db.flush()?;
        }

        tracing::info!("Store & forward queue stopped");
        Ok(())
    }

    /// Add a message to the queue
    pub async fn add_message(&mut self, message: ReceivedMessage, ttl: Duration) -> Result<()> {
        let message_size = bincode::serialized_size(&message)? as usize;

        // Check queue size limit
        {
            let mut current_size = self.current_size.write().await;
            if *current_size + message_size > self.max_queue_size {
                // Try to make room by removing oldest messages
                self.evict_oldest_messages(message_size).await?;

                // Re-check after eviction
                if *current_size + message_size > self.max_queue_size {
                    return Err(BitChatError::Storage(
                        "Store & forward queue is full".to_string(),
                    ));
                }
            }
            *current_size += message_size;
        }

        let stored = StoredMessage {
            message: message.clone(),
            expires_at: SystemTime::now() + ttl,
            retry_count: 0,
            last_retry: SystemTime::now(),
        };

        let metadata = MessageMetadata {
            id: message.id.clone(),
            recipient: message.recipient.clone(),
            priority: match message.priority {
                crate::messaging::MessagePriority::Low => 1,
                crate::messaging::MessagePriority::Normal => 5,
                crate::messaging::MessagePriority::High => 10,
                crate::messaging::MessagePriority::Critical => 20,
            },
            stored_at: SystemTime::now(),
            expires_at: stored.expires_at,
            retry_count: 0,
            last_retry: stored.last_retry,
            size: message_size,
        };

        // Store in memory
        {
            let mut memory = self.memory_store.write().await;
            memory.insert(message.id.clone(), stored.clone());
        }

        // Store metadata
        {
            let mut index = self.metadata_index.write().await;
            index.insert(message.id.clone(), metadata);
        }

        // Persist to disk if available
        #[cfg(feature = "rocksdb")]
        if let Some(db) = &self.db {
            let data = bincode::serialize(&stored)?;
            db.put(message.id.as_bytes(), &data)?;
        }

        tracing::debug!(
            "Added message {} to store & forward queue (size: {} bytes)",
            message.id,
            message_size
        );
        Ok(())
    }

    /// Get messages ready for retry
    pub async fn get_messages_to_retry(&self) -> Result<Vec<StoredMessage>> {
        let now = SystemTime::now();
        let mut messages = Vec::new();

        let metadata = self.metadata_index.read().await;
        let memory = self.memory_store.read().await;

        for (id, meta) in metadata.iter() {
            // Skip expired messages
            if now > meta.expires_at {
                continue;
            }

            // Check if it's time to retry (exponential backoff)
            let backoff_seconds = 2u64.pow(meta.retry_count.min(6)); // Max 64 second backoff
            let next_retry = meta.last_retry + Duration::from_secs(backoff_seconds);

            if now >= next_retry {
                if let Some(stored) = memory.get(id) {
                    messages.push(stored.clone());
                }
            }
        }

        // Sort by priority (highest first) and then by age (oldest first)
        messages.sort_by(|a, b| {
            let a_priority = match a.message.priority {
                crate::messaging::MessagePriority::Low => 1,
                crate::messaging::MessagePriority::Normal => 5,
                crate::messaging::MessagePriority::High => 10,
                crate::messaging::MessagePriority::Critical => 20,
            };
            let b_priority = match b.message.priority {
                crate::messaging::MessagePriority::Low => 1,
                crate::messaging::MessagePriority::Normal => 5,
                crate::messaging::MessagePriority::High => 10,
                crate::messaging::MessagePriority::Critical => 20,
            };

            b_priority
                .cmp(&a_priority)
                .then_with(|| a.message.timestamp.cmp(&b.message.timestamp))
        });

        Ok(messages)
    }

    /// Update message retry status
    pub async fn update_message(&self, message: &StoredMessage) -> Result<()> {
        let mut metadata = self.metadata_index.write().await;
        if let Some(meta) = metadata.get_mut(&message.message.id) {
            meta.retry_count = message.retry_count;
            meta.last_retry = message.last_retry;
        }

        let mut memory = self.memory_store.write().await;
        memory.insert(message.message.id.clone(), message.clone());

        #[cfg(feature = "rocksdb")]
        if let Some(db) = &self.db {
            let data = bincode::serialize(message)?;
            db.put(message.message.id.as_bytes(), &data)?;
        }

        Ok(())
    }

    /// Remove a message from the queue
    pub async fn remove_message(&mut self, message_id: &str) -> Result<()> {
        let mut freed_size = 0;

        // Remove from metadata
        {
            let mut metadata = self.metadata_index.write().await;
            if let Some(meta) = metadata.remove(message_id) {
                freed_size = meta.size;
            }
        }

        // Remove from memory
        {
            let mut memory = self.memory_store.write().await;
            memory.remove(message_id);
        }

        // Remove from disk
        #[cfg(feature = "rocksdb")]
        if let Some(db) = &self.db {
            db.delete(message_id.as_bytes())?;
        }

        // Update queue size
        if freed_size > 0 {
            let mut size = self.current_size.write().await;
            *size = size.saturating_sub(freed_size);
        }

        tracing::debug!("Removed message {} from store & forward queue", message_id);
        Ok(())
    }

    /// Get queue statistics
    pub async fn get_stats(&self) -> QueueStats {
        let metadata = self.metadata_index.read().await;
        let current_size = *self.current_size.read().await;

        let mut by_priority = HashMap::new();
        let mut oldest_message = None;
        let mut total_retry_count = 0;

        for meta in metadata.values() {
            *by_priority.entry(meta.priority).or_insert(0) += 1;
            total_retry_count += meta.retry_count;

            if oldest_message.is_none() || meta.stored_at < oldest_message.unwrap() {
                oldest_message = Some(meta.stored_at);
            }
        }

        QueueStats {
            total_messages: metadata.len(),
            total_size_bytes: current_size,
            messages_by_priority: by_priority,
            oldest_message_age: oldest_message
                .and_then(|t| SystemTime::now().duration_since(t).ok()),
            average_retry_count: if metadata.is_empty() {
                0.0
            } else {
                total_retry_count as f64 / metadata.len() as f64
            },
        }
    }

    /// Evict oldest messages to make room
    async fn evict_oldest_messages(&self, required_space: usize) -> Result<()> {
        let mut metadata = self.metadata_index.write().await;
        let mut memory = self.memory_store.write().await;

        // Sort messages by priority (lowest first) and age (oldest first)
        let mut messages: Vec<_> = metadata
            .iter()
            .map(|(id, meta)| (id.clone(), meta.priority, meta.stored_at, meta.size))
            .collect();

        messages.sort_by(|a, b| {
            a.1.cmp(&b.1) // Sort by priority first
                .then_with(|| a.2.cmp(&b.2)) // Then by age
        });

        let mut freed_space = 0;
        let mut to_remove = Vec::new();

        for (id, _, _, size) in messages {
            if freed_space >= required_space {
                break;
            }

            to_remove.push(id);
            freed_space += size;
        }

        // Remove the messages
        for id in to_remove {
            metadata.remove(&id);
            memory.remove(&id);

            #[cfg(feature = "rocksdb")]
            if let Some(db) = &self.db {
                let _ = db.delete(id.as_bytes());
            }
        }

        if freed_space > 0 {
            let mut size = self.current_size.write().await;
            *size = size.saturating_sub(freed_space);
            tracing::info!("Evicted {} bytes from store & forward queue", freed_space);
        }

        Ok(())
    }

    /// Load messages from persistent storage
    #[cfg(feature = "rocksdb")]
    async fn load_from_disk(&self, db: &Arc<DB>) -> Result<()> {
        let mut memory = self.memory_store.write().await;
        let mut metadata = self.metadata_index.write().await;
        let mut total_size = 0;
        let now = SystemTime::now();

        let iter = db.iterator(rocksdb::IteratorMode::Start);
        for item in iter {
            if let Ok((key, value)) = item {
                if let Ok(stored) = bincode::deserialize::<StoredMessage>(&value) {
                    // Skip expired messages
                    if now > stored.expires_at {
                        let _ = db.delete(&key);
                        continue;
                    }

                    let message_size = value.len();
                    total_size += message_size;

                    let meta = MessageMetadata {
                        id: stored.message.id.clone(),
                        recipient: stored.message.recipient.clone(),
                        priority: match stored.message.priority {
                            crate::messaging::MessagePriority::Low => 1,
                            crate::messaging::MessagePriority::Normal => 5,
                            crate::messaging::MessagePriority::High => 10,
                            crate::messaging::MessagePriority::Critical => 20,
                        },
                        stored_at: stored.message.timestamp,
                        expires_at: stored.expires_at,
                        retry_count: stored.retry_count,
                        last_retry: stored.last_retry,
                        size: message_size,
                    };

                    metadata.insert(stored.message.id.clone(), meta);
                    memory.insert(stored.message.id.clone(), stored);
                }
            }
        }

        *self.current_size.write().await = total_size;
        tracing::info!(
            "Loaded {} messages ({} bytes) from persistent storage",
            memory.len(),
            total_size
        );

        Ok(())
    }
}

/// Queue statistics
#[derive(Debug, Clone)]
pub struct QueueStats {
    /// Total number of messages in queue
    pub total_messages: usize,
    /// Total size in bytes
    pub total_size_bytes: usize,
    /// Messages grouped by priority
    pub messages_by_priority: HashMap<u8, usize>,
    /// Age of oldest message
    pub oldest_message_age: Option<Duration>,
    /// Average retry count
    pub average_retry_count: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::BitChatConfig;
    use crate::messaging::{MessagePriority, MessageType, ReceivedMessage};
    use uuid::Uuid;

    #[tokio::test]
    async fn test_store_forward_queue() {
        let config = BitChatConfig::testing();
        let mut queue = StoreForwardQueue::new(&config).unwrap();
        queue.start().await.unwrap();

        // Create a test message
        let message = ReceivedMessage {
            id: Uuid::new_v4().to_string(),
            sender: "sender".to_string(),
            recipient: "recipient".to_string(),
            topic: None,
            data: vec![1, 2, 3, 4],
            timestamp: SystemTime::now(),
            is_ephemeral: false,
            priority: MessagePriority::Normal,
            message_type: MessageType::Direct,
            encryption_info: None,
            compression_info: None,
        };

        // Add message
        queue
            .add_message(message.clone(), Duration::from_secs(3600))
            .await
            .unwrap();

        // Check stats
        let stats = queue.get_stats().await;
        assert_eq!(stats.total_messages, 1);
        assert!(stats.total_size_bytes > 0);

        // Get messages to retry
        let messages = queue.get_messages_to_retry().await.unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].message.id, message.id);

        // Remove message
        queue.remove_message(&message.id).await.unwrap();

        // Check stats again
        let stats = queue.get_stats().await;
        assert_eq!(stats.total_messages, 0);
        assert_eq!(stats.total_size_bytes, 0);

        queue.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_priority_ordering() {
        let config = BitChatConfig::testing();
        let mut queue = StoreForwardQueue::new(&config).unwrap();
        queue.start().await.unwrap();

        // Add messages with different priorities
        let priorities = vec![
            MessagePriority::Low,
            MessagePriority::Critical,
            MessagePriority::Normal,
            MessagePriority::High,
        ];

        for (i, priority) in priorities.iter().enumerate() {
            let message = ReceivedMessage {
                id: format!("msg_{}", i),
                sender: "sender".to_string(),
                recipient: "recipient".to_string(),
                topic: None,
                data: vec![i as u8],
                timestamp: SystemTime::now(),
                is_ephemeral: false,
                priority: priority.clone(),
                message_type: MessageType::Direct,
                encryption_info: None,
                compression_info: None,
            };

            queue
                .add_message(message, Duration::from_secs(3600))
                .await
                .unwrap();
        }

        // Get messages - should be ordered by priority
        let messages = queue.get_messages_to_retry().await.unwrap();
        assert_eq!(messages.len(), 4);
        assert_eq!(messages[0].message.priority, MessagePriority::Critical);
        assert_eq!(messages[1].message.priority, MessagePriority::High);
        assert_eq!(messages[2].message.priority, MessagePriority::Normal);
        assert_eq!(messages[3].message.priority, MessagePriority::Low);

        queue.stop().await.unwrap();
    }
}
