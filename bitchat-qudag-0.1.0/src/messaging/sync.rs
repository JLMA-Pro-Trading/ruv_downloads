//! Message synchronization with vector clocks and conflict resolution

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::RwLock;

use crate::error::{BitChatError, Result};
use crate::messaging::ReceivedMessage;

/// Vector clock for message ordering
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VectorClock {
    /// Clock values for each peer
    clocks: BTreeMap<String, u64>,
}

impl VectorClock {
    /// Create a new vector clock
    pub fn new() -> Self {
        Self {
            clocks: BTreeMap::new(),
        }
    }

    /// Increment clock for a peer
    pub fn increment(&mut self, peer_id: &str) {
        let counter = self.clocks.entry(peer_id.to_string()).or_insert(0);
        *counter += 1;
    }

    /// Update clock with another clock (merge)
    pub fn update(&mut self, other: &VectorClock) {
        for (peer_id, &other_time) in &other.clocks {
            let our_time = self.clocks.entry(peer_id.clone()).or_insert(0);
            *our_time = (*our_time).max(other_time);
        }
    }

    /// Compare two vector clocks
    pub fn compare(&self, other: &VectorClock) -> ClockOrdering {
        let mut self_greater = false;
        let mut other_greater = false;

        // Check all peers in both clocks
        let all_peers: std::collections::HashSet<_> =
            self.clocks.keys().chain(other.clocks.keys()).collect();

        for peer_id in all_peers {
            let self_time = self.clocks.get(peer_id).copied().unwrap_or(0);
            let other_time = other.clocks.get(peer_id).copied().unwrap_or(0);

            if self_time > other_time {
                self_greater = true;
            } else if other_time > self_time {
                other_greater = true;
            }
        }

        match (self_greater, other_greater) {
            (true, false) => ClockOrdering::After,
            (false, true) => ClockOrdering::Before,
            (false, false) => ClockOrdering::Equal,
            (true, true) => ClockOrdering::Concurrent,
        }
    }

    /// Get clock value for a peer
    pub fn get(&self, peer_id: &str) -> u64 {
        self.clocks.get(peer_id).copied().unwrap_or(0)
    }
}

/// Clock ordering relationship
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClockOrdering {
    /// This clock is before the other
    Before,
    /// This clock is after the other
    After,
    /// Clocks are equal
    Equal,
    /// Clocks are concurrent (no causal relationship)
    Concurrent,
}

/// Message with vector clock for ordering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncedMessage {
    /// The actual message
    pub message: ReceivedMessage,
    /// Vector clock at time of message
    pub vector_clock: VectorClock,
    /// Merkle tree hash of message
    pub merkle_hash: String,
}

/// Sync state for a peer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerSyncState {
    /// Peer ID
    pub peer_id: String,
    /// Last known vector clock
    pub vector_clock: VectorClock,
    /// Last sync timestamp
    pub last_sync: SystemTime,
    /// Messages pending sync
    pub pending_messages: Vec<String>, // Message IDs
}

/// Merkle tree node for efficient sync verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleNode {
    /// Hash of this node
    pub hash: String,
    /// Left child hash (if any)
    pub left: Option<String>,
    /// Right child hash (if any)
    pub right: Option<String>,
    /// Message ID (if leaf node)
    pub message_id: Option<String>,
}

/// Message synchronization system
pub struct MessageSync {
    /// Local peer ID
    local_peer_id: String,
    /// Local vector clock
    local_clock: Arc<RwLock<VectorClock>>,
    /// Message storage with vector clocks
    messages: Arc<RwLock<HashMap<String, SyncedMessage>>>,
    /// Peer sync states
    peer_states: Arc<RwLock<HashMap<String, PeerSyncState>>>,
    /// Merkle tree for sync verification
    merkle_tree: Arc<RwLock<HashMap<String, MerkleNode>>>,
    /// Conflict resolution strategy
    conflict_strategy: ConflictResolutionStrategy,
}

/// Conflict resolution strategies
#[derive(Debug, Clone, Copy)]
pub enum ConflictResolutionStrategy {
    /// Last writer wins (based on timestamp)
    LastWriterWins,
    /// Higher peer ID wins
    HigherIdWins,
    /// Custom resolution function
    Custom,
}

impl MessageSync {
    /// Create a new message sync system
    pub fn new(local_peer_id: &str) -> Self {
        Self {
            local_peer_id: local_peer_id.to_string(),
            local_clock: Arc::new(RwLock::new(VectorClock::new())),
            messages: Arc::new(RwLock::new(HashMap::new())),
            peer_states: Arc::new(RwLock::new(HashMap::new())),
            merkle_tree: Arc::new(RwLock::new(HashMap::new())),
            conflict_strategy: ConflictResolutionStrategy::LastWriterWins,
        }
    }

    /// Add a message to the sync system
    pub fn add_message(&mut self, message: &ReceivedMessage) -> Result<()> {
        let mut local_clock = futures::executor::block_on(self.local_clock.write());

        // Increment our clock
        local_clock.increment(&self.local_peer_id);

        // Create synced message
        let synced_message = SyncedMessage {
            message: message.clone(),
            vector_clock: local_clock.clone(),
            merkle_hash: self.calculate_message_hash(message),
        };

        // Store message
        let mut messages = futures::executor::block_on(self.messages.write());
        messages.insert(message.id.clone(), synced_message);

        // Update merkle tree
        self.update_merkle_tree(&message.id)?;

        Ok(())
    }

    /// Get sync data for a specific peer
    pub fn get_sync_data_for_peer(&self, peer_id: &str) -> Result<Option<SyncData>> {
        let peer_states = futures::executor::block_on(self.peer_states.read());
        let local_clock = futures::executor::block_on(self.local_clock.read());
        let messages = futures::executor::block_on(self.messages.read());

        // Get peer's last known state
        let peer_state = peer_states.get(peer_id);
        let peer_clock = peer_state.map(|s| &s.vector_clock);

        // Find messages that the peer might not have
        let mut missing_messages = Vec::new();

        for (msg_id, synced_msg) in messages.iter() {
            if let Some(peer_clock) = peer_clock {
                // Check if peer has seen this message
                match synced_msg.vector_clock.compare(peer_clock) {
                    ClockOrdering::After | ClockOrdering::Concurrent => {
                        missing_messages.push(synced_msg.clone());
                    }
                    _ => {}
                }
            } else {
                // Peer has no known state, send everything
                missing_messages.push(synced_msg.clone());
            }
        }

        if missing_messages.is_empty() {
            return Ok(None);
        }

        // Build merkle proof for efficient verification
        let merkle_root = self.get_merkle_root()?;

        Ok(Some(SyncData {
            peer_id: self.local_peer_id.clone(),
            vector_clock: local_clock.clone(),
            messages: missing_messages,
            merkle_root,
            timestamp: SystemTime::now(),
        }))
    }

    /// Process sync data from a peer
    pub async fn process_sync_data(&mut self, sync_data: SyncData) -> Result<Vec<String>> {
        let mut new_message_ids = Vec::new();
        let mut conflicts = Vec::new();

        // Update peer state
        {
            let mut peer_states = self.peer_states.write().await;
            let peer_state = peer_states
                .entry(sync_data.peer_id.clone())
                .or_insert_with(|| PeerSyncState {
                    peer_id: sync_data.peer_id.clone(),
                    vector_clock: VectorClock::new(),
                    last_sync: SystemTime::now(),
                    pending_messages: Vec::new(),
                });
            peer_state.vector_clock = sync_data.vector_clock.clone();
            peer_state.last_sync = sync_data.timestamp;
        }

        // Process each message
        for synced_msg in sync_data.messages {
            let msg_id = synced_msg.message.id.clone();

            // Check if we already have this message
            let mut messages = self.messages.write().await;
            if let Some(existing) = messages.get(&msg_id) {
                // Detect conflict
                match existing.vector_clock.compare(&synced_msg.vector_clock) {
                    ClockOrdering::Concurrent => {
                        // Concurrent modification - conflict!
                        conflicts.push((existing.clone(), synced_msg.clone()));
                    }
                    ClockOrdering::Before => {
                        // Their message is newer, update
                        messages.insert(msg_id.clone(), synced_msg);
                        new_message_ids.push(msg_id.clone());
                    }
                    _ => {
                        // Our message is newer or equal, keep it
                    }
                }
            } else {
                // New message
                messages.insert(msg_id.clone(), synced_msg);
                new_message_ids.push(msg_id.clone());
            }
        }

        // Resolve conflicts
        for (our_msg, their_msg) in conflicts {
            let winner = self.resolve_conflict(&our_msg, &their_msg).await?;
            let mut messages = self.messages.write().await;
            messages.insert(winner.message.id.clone(), winner);
        }

        // Update our vector clock
        {
            let mut local_clock = self.local_clock.write().await;
            local_clock.update(&sync_data.vector_clock);
        }

        // Update merkle tree
        for msg_id in &new_message_ids {
            self.update_merkle_tree(msg_id)?;
        }

        Ok(new_message_ids)
    }

    /// Resolve a conflict between two messages
    async fn resolve_conflict(
        &self,
        our_msg: &SyncedMessage,
        their_msg: &SyncedMessage,
    ) -> Result<SyncedMessage> {
        match self.conflict_strategy {
            ConflictResolutionStrategy::LastWriterWins => {
                // Compare timestamps
                if our_msg.message.timestamp >= their_msg.message.timestamp {
                    Ok(our_msg.clone())
                } else {
                    Ok(their_msg.clone())
                }
            }
            ConflictResolutionStrategy::HigherIdWins => {
                // Compare sender IDs
                if our_msg.message.sender >= their_msg.message.sender {
                    Ok(our_msg.clone())
                } else {
                    Ok(their_msg.clone())
                }
            }
            ConflictResolutionStrategy::Custom => {
                // In a real implementation, this would call a custom resolution function
                // For now, default to last writer wins
                if our_msg.message.timestamp >= their_msg.message.timestamp {
                    Ok(our_msg.clone())
                } else {
                    Ok(their_msg.clone())
                }
            }
        }
    }

    /// Calculate hash of a message for merkle tree
    fn calculate_message_hash(&self, message: &ReceivedMessage) -> String {
        let data = format!("{:?}", message);
        blake3::hash(data.as_bytes()).to_hex().to_string()
    }

    /// Update merkle tree with a new message
    fn update_merkle_tree(&self, message_id: &str) -> Result<()> {
        // In a real implementation, this would maintain a proper merkle tree
        // For now, we just store the hash
        let messages = futures::executor::block_on(self.messages.read());
        if let Some(synced_msg) = messages.get(message_id) {
            let node = MerkleNode {
                hash: synced_msg.merkle_hash.clone(),
                left: None,
                right: None,
                message_id: Some(message_id.to_string()),
            };

            let mut tree = futures::executor::block_on(self.merkle_tree.write());
            tree.insert(message_id.to_string(), node);
        }

        Ok(())
    }

    /// Get merkle root hash
    fn get_merkle_root(&self) -> Result<String> {
        let tree = futures::executor::block_on(self.merkle_tree.read());

        if tree.is_empty() {
            return Ok(String::new());
        }

        // Simple implementation: hash all message hashes together
        let mut all_hashes: Vec<String> = tree.values().map(|node| node.hash.clone()).collect();
        all_hashes.sort();

        let combined = all_hashes.join("");
        Ok(blake3::hash(combined.as_bytes()).to_hex().to_string())
    }

    /// Perform partial sync with specific message ranges
    pub async fn partial_sync(
        &self,
        peer_id: &str,
        from_clock: &VectorClock,
        to_clock: &VectorClock,
    ) -> Result<Vec<SyncedMessage>> {
        let messages = self.messages.read().await;
        let mut result = Vec::new();

        for synced_msg in messages.values() {
            let clock_ordering_from = synced_msg.vector_clock.compare(from_clock);
            let clock_ordering_to = synced_msg.vector_clock.compare(to_clock);

            // Include messages that are after 'from' and before or concurrent with 'to'
            match (clock_ordering_from, clock_ordering_to) {
                (ClockOrdering::After, ClockOrdering::Before)
                | (ClockOrdering::After, ClockOrdering::Equal)
                | (ClockOrdering::After, ClockOrdering::Concurrent) => {
                    result.push(synced_msg.clone());
                }
                _ => {}
            }
        }

        Ok(result)
    }

    /// Get sync statistics
    pub async fn get_sync_stats(&self) -> SyncStats {
        let messages = self.messages.read().await;
        let peer_states = self.peer_states.read().await;
        let local_clock = self.local_clock.read().await;

        let mut max_clock_value = 0;
        for &value in local_clock.clocks.values() {
            max_clock_value = max_clock_value.max(value);
        }

        SyncStats {
            total_messages: messages.len(),
            synced_peers: peer_states.len(),
            vector_clock_size: local_clock.clocks.len(),
            max_clock_value,
            conflicts_resolved: 0, // Would be tracked in real implementation
        }
    }
}

/// Sync data to exchange between peers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncData {
    /// Sender peer ID
    pub peer_id: String,
    /// Sender's vector clock
    pub vector_clock: VectorClock,
    /// Messages to sync
    pub messages: Vec<SyncedMessage>,
    /// Merkle root for verification
    pub merkle_root: String,
    /// Timestamp of sync data
    pub timestamp: SystemTime,
}

/// Sync statistics
#[derive(Debug, Clone)]
pub struct SyncStats {
    /// Total messages in sync system
    pub total_messages: usize,
    /// Number of synced peers
    pub synced_peers: usize,
    /// Size of vector clock
    pub vector_clock_size: usize,
    /// Maximum clock value
    pub max_clock_value: u64,
    /// Number of conflicts resolved
    pub conflicts_resolved: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::messaging::{MessagePriority, MessageType};
    use uuid::Uuid;

    #[test]
    fn test_vector_clock_ordering() {
        let mut clock1 = VectorClock::new();
        let mut clock2 = VectorClock::new();

        // Test equality
        assert_eq!(clock1.compare(&clock2), ClockOrdering::Equal);

        // Test after
        clock1.increment("peer1");
        assert_eq!(clock1.compare(&clock2), ClockOrdering::After);
        assert_eq!(clock2.compare(&clock1), ClockOrdering::Before);

        // Test concurrent
        clock2.increment("peer2");
        assert_eq!(clock1.compare(&clock2), ClockOrdering::Concurrent);

        // Test update
        clock2.update(&clock1);
        assert_eq!(clock2.compare(&clock1), ClockOrdering::After);
    }

    #[test]
    fn test_message_sync() {
        let mut sync = MessageSync::new("local_peer");

        // Add a message
        let message = ReceivedMessage {
            id: Uuid::new_v4().to_string(),
            sender: "local_peer".to_string(),
            recipient: "remote_peer".to_string(),
            topic: None,
            data: b"test data".to_vec(),
            timestamp: SystemTime::now(),
            is_ephemeral: false,
            priority: MessagePriority::Normal,
            message_type: MessageType::Direct,
            encryption_info: None,
            compression_info: None,
        };

        sync.add_message(&message).unwrap();

        // Get sync data
        let sync_data = sync.get_sync_data_for_peer("remote_peer").unwrap();
        assert!(sync_data.is_some());

        let data = sync_data.unwrap();
        assert_eq!(data.messages.len(), 1);
        assert_eq!(data.messages[0].message.id, message.id);
    }

    #[tokio::test]
    async fn test_conflict_resolution() {
        let mut sync = MessageSync::new("peer1");

        // Create two concurrent messages with same ID
        let message1 = ReceivedMessage {
            id: "conflict_msg".to_string(),
            sender: "peer1".to_string(),
            recipient: "broadcast".to_string(),
            topic: None,
            data: b"version 1".to_vec(),
            timestamp: SystemTime::now(),
            is_ephemeral: false,
            priority: MessagePriority::Normal,
            message_type: MessageType::Direct,
            encryption_info: None,
            compression_info: None,
        };

        let message2 = ReceivedMessage {
            id: "conflict_msg".to_string(),
            sender: "peer2".to_string(),
            recipient: "broadcast".to_string(),
            topic: None,
            data: b"version 2".to_vec(),
            timestamp: SystemTime::now() + std::time::Duration::from_secs(1),
            is_ephemeral: false,
            priority: MessagePriority::Normal,
            message_type: MessageType::Direct,
            encryption_info: None,
            compression_info: None,
        };

        // Add first message
        sync.add_message(&message1).unwrap();

        // Create sync data with conflicting message
        let sync_data = SyncData {
            peer_id: "peer2".to_string(),
            vector_clock: {
                let mut clock = VectorClock::new();
                clock.increment("peer2");
                clock
            },
            messages: vec![SyncedMessage {
                message: message2,
                vector_clock: {
                    let mut clock = VectorClock::new();
                    clock.increment("peer2");
                    clock
                },
                merkle_hash: "hash2".to_string(),
            }],
            merkle_root: "root".to_string(),
            timestamp: SystemTime::now(),
        };

        // Process sync data - should resolve conflict
        let new_messages = sync.process_sync_data(sync_data).await.unwrap();

        // With LastWriterWins strategy, message2 should win (newer timestamp)
        let messages = sync.messages.read().await;
        let resolved = messages.get("conflict_msg").unwrap();
        assert_eq!(resolved.message.data, b"version 2");
    }
}
