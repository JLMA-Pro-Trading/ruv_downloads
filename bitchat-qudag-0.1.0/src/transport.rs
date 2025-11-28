//! Multi-transport layer for BitChat-QuDAG integration

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::{mpsc, Mutex, RwLock};
use uuid::Uuid;

use crate::config::BitChatConfig;
use crate::error::{BitChatError, Result};
use crate::messaging::{PeerInfo, ReceivedMessage};

/// Transport types supported by BitChat
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum TransportType {
    /// Internet-based P2P (integration with QuDAG's existing P2P layer)
    InternetP2P,
    /// Bluetooth Low Energy mesh networking
    BluetoothMesh,
    /// Local network discovery and communication
    LocalNetwork,
    /// WebSocket transport for WASM environments
    WebSocket,
    /// Relay/bridge between different transports
    Relay,
}

/// Transport status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TransportStatus {
    /// Transport is inactive
    Inactive,
    /// Transport is starting up
    Starting,
    /// Transport is active and ready
    Active,
    /// Transport is stopping
    Stopping,
    /// Transport has failed
    Failed(String),
}

/// Transport statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransportStats {
    /// Transport type
    pub transport_type: TransportType,
    /// Current status
    pub status: TransportStatus,
    /// Number of connected peers
    pub connected_peers: usize,
    /// Total messages sent
    pub messages_sent: u64,
    /// Total messages received
    pub messages_received: u64,
    /// Total bytes sent
    pub bytes_sent: u64,
    /// Total bytes received
    pub bytes_received: u64,
    /// Connection attempts
    pub connection_attempts: u64,
    /// Successful connections
    pub successful_connections: u64,
    /// Failed connections
    pub failed_connections: u64,
    /// Average latency in milliseconds
    pub average_latency: f64,
    /// Last activity timestamp
    pub last_activity: SystemTime,
}

impl Default for TransportStats {
    fn default() -> Self {
        Self {
            transport_type: TransportType::InternetP2P,
            status: TransportStatus::Inactive,
            connected_peers: 0,
            messages_sent: 0,
            messages_received: 0,
            bytes_sent: 0,
            bytes_received: 0,
            connection_attempts: 0,
            successful_connections: 0,
            failed_connections: 0,
            average_latency: 0.0,
            last_activity: SystemTime::now(),
        }
    }
}

/// Transport trait for different communication methods
#[async_trait]
pub trait Transport: Send + Sync {
    /// Start the transport
    async fn start(&mut self) -> Result<()>;

    /// Stop the transport
    async fn stop(&mut self) -> Result<()>;

    /// Send message to specific peer
    async fn send_to_peer(&self, peer_id: &str, message: &ReceivedMessage) -> Result<()>;

    /// Receive next message
    async fn receive_message(&self) -> Result<Option<ReceivedMessage>>;

    /// Subscribe to topic
    async fn subscribe_topic(&self, topic: &str) -> Result<()>;

    /// Unsubscribe from topic
    async fn unsubscribe_topic(&self, topic: &str) -> Result<()>;

    /// Publish to topic
    async fn publish_to_topic(&self, topic: &str, message: &ReceivedMessage) -> Result<()>;

    /// Get connected peers
    async fn get_connected_peers(&self) -> Result<Vec<PeerInfo>>;

    /// Check if peer is connected
    async fn is_peer_connected(&self, peer_id: &str) -> Result<bool>;

    /// Get transport type
    fn transport_type(&self) -> TransportType;

    /// Get transport status
    async fn status(&self) -> TransportStatus;

    /// Get transport statistics
    async fn stats(&self) -> TransportStats;

    /// Connect to a specific peer
    async fn connect_peer(&self, peer_address: &str) -> Result<String>;

    /// Disconnect from a peer
    async fn disconnect_peer(&self, peer_id: &str) -> Result<()>;

    /// Get local transport address
    async fn local_address(&self) -> Result<String>;
}

/// Multi-transport manager that can use multiple transport types
pub struct MultiTransport {
    /// Available transports
    transports: Vec<Box<dyn Transport>>,
    /// Transport selection strategy
    strategy: TransportStrategy,
    /// Configuration
    config: BitChatConfig,
    /// Message routing table
    routing_table: Arc<RwLock<HashMap<String, TransportType>>>,
    /// Message queue for incoming messages
    message_queue: Arc<Mutex<mpsc::UnboundedReceiver<ReceivedMessage>>>,
    /// Message sender
    message_sender: mpsc::UnboundedSender<ReceivedMessage>,
    /// Peer registry
    peer_registry: Arc<RwLock<HashMap<String, PeerInfo>>>,
    /// Transport statistics
    transport_stats: Arc<RwLock<HashMap<TransportType, TransportStats>>>,
}

/// Transport selection strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransportStrategy {
    /// Use first available transport
    FirstAvailable,
    /// Use fastest transport based on latency
    Fastest,
    /// Use most reliable transport
    MostReliable,
    /// Load balance across all transports
    LoadBalance,
    /// Use transport with best connection to specific peer
    BestForPeer,
}

impl Default for TransportStrategy {
    fn default() -> Self {
        Self::FirstAvailable
    }
}

impl MultiTransport {
    /// Create a new multi-transport instance
    pub async fn new(config: &BitChatConfig) -> Result<Self> {
        let mut transports: Vec<Box<dyn Transport>> = Vec::new();

        // Add transports based on configuration
        for transport_type in &config.transports {
            match transport_type {
                TransportType::InternetP2P => {
                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        transports.push(Box::new(InternetP2PTransport::new(config).await?));
                    }
                }
                TransportType::BluetoothMesh => {
                    #[cfg(all(feature = "bluetooth", not(target_arch = "wasm32")))]
                    {
                        transports.push(Box::new(
                            crate::transports::BluetoothTransport::new(config.clone()).await?,
                        ));
                    }
                }
                TransportType::LocalNetwork => {
                    #[cfg(all(not(target_arch = "wasm32"), feature = "networking"))]
                    {
                        transports.push(Box::new(
                            crate::transports::LocalNetworkTransport::new(config.clone()).await?,
                        ));
                    }
                }
                TransportType::WebSocket => {
                    transports.push(Box::new(WebSocketTransport::new(config).await?));
                }
                TransportType::Relay => {
                    #[cfg(all(not(target_arch = "wasm32"), feature = "networking"))]
                    {
                        transports.push(Box::new(
                            crate::transports::RelayTransport::new(config.clone()).await?,
                        ));
                    }
                }
            }
        }

        if transports.is_empty() {
            return Err(BitChatError::Config("No transports configured".to_string()));
        }

        let (message_sender, message_receiver) = mpsc::unbounded_channel();

        Ok(Self {
            transports,
            strategy: TransportStrategy::default(),
            config: config.clone(),
            routing_table: Arc::new(RwLock::new(HashMap::new())),
            message_queue: Arc::new(Mutex::new(message_receiver)),
            message_sender,
            peer_registry: Arc::new(RwLock::new(HashMap::new())),
            transport_stats: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Start all transports
    pub async fn start(&mut self) -> Result<()> {
        for transport in &mut self.transports {
            transport.start().await?;
        }
        Ok(())
    }

    /// Stop all transports
    pub async fn stop(&mut self) -> Result<()> {
        for transport in &mut self.transports {
            transport.stop().await?;
        }
        Ok(())
    }

    /// Send message to peer using best available transport
    pub async fn send_to_peer(&self, peer_id: &str, message: &ReceivedMessage) -> Result<()> {
        let transport = self.select_transport_for_peer(peer_id).await?;
        transport.send_to_peer(peer_id, message).await
    }

    /// Receive message from any transport
    pub async fn receive_message(&self) -> Result<Option<ReceivedMessage>> {
        let mut queue = self.message_queue.lock().await;
        Ok(queue.recv().await)
    }

    /// Subscribe to topic on all transports
    pub async fn subscribe_topic(&self, topic: &str) -> Result<()> {
        for transport in &self.transports {
            transport.subscribe_topic(topic).await?;
        }
        Ok(())
    }

    /// Unsubscribe from topic on all transports
    pub async fn unsubscribe_topic(&self, topic: &str) -> Result<()> {
        for transport in &self.transports {
            transport.unsubscribe_topic(topic).await?;
        }
        Ok(())
    }

    /// Publish to topic on all transports
    pub async fn publish_to_topic(&self, topic: &str, message: &ReceivedMessage) -> Result<()> {
        for transport in &self.transports {
            transport.publish_to_topic(topic, message).await?;
        }
        Ok(())
    }

    /// Get connected peers from all transports
    pub async fn get_connected_peers(&self) -> Result<Vec<PeerInfo>> {
        let mut all_peers = Vec::new();

        for transport in &self.transports {
            let peers = transport.get_connected_peers().await?;
            all_peers.extend(peers);
        }

        // Remove duplicates
        all_peers.sort_by(|a, b| a.id.cmp(&b.id));
        all_peers.dedup_by(|a, b| a.id == b.id);

        Ok(all_peers)
    }

    /// Check if peer is connected on any transport
    pub async fn is_peer_connected(&self, peer_id: &str) -> Result<bool> {
        for transport in &self.transports {
            if transport.is_peer_connected(peer_id).await? {
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// Get transport statistics
    pub async fn get_stats(&self) -> HashMap<TransportType, TransportStats> {
        let mut stats = HashMap::new();

        for transport in &self.transports {
            let transport_stats = transport.stats().await;
            stats.insert(transport.transport_type(), transport_stats);
        }

        stats
    }

    /// Select best transport for a peer
    async fn select_transport_for_peer(&self, peer_id: &str) -> Result<&Box<dyn Transport>> {
        // Check routing table first
        {
            let routing_table = self.routing_table.read().await;
            if let Some(transport_type) = routing_table.get(peer_id) {
                for transport in &self.transports {
                    if transport.transport_type() == *transport_type {
                        return Ok(transport);
                    }
                }
            }
        }

        // Use strategy to select transport
        match self.strategy {
            TransportStrategy::FirstAvailable => {
                for transport in &self.transports {
                    if transport.status().await == TransportStatus::Active {
                        return Ok(transport);
                    }
                }
                Err(BitChatError::Transport(
                    "No active transport available".to_string(),
                ))
            }
            TransportStrategy::Fastest => {
                let mut best_transport = None;
                let mut best_latency = f64::MAX;

                for transport in &self.transports {
                    if transport.status().await == TransportStatus::Active {
                        let stats = transport.stats().await;
                        if stats.average_latency < best_latency {
                            best_latency = stats.average_latency;
                            best_transport = Some(transport);
                        }
                    }
                }

                best_transport.ok_or_else(|| {
                    BitChatError::Transport("No active transport available".to_string())
                })
            }
            TransportStrategy::MostReliable => {
                let mut best_transport = None;
                let mut best_reliability = 0.0;

                for transport in &self.transports {
                    if transport.status().await == TransportStatus::Active {
                        let stats = transport.stats().await;
                        let reliability = if stats.connection_attempts > 0 {
                            stats.successful_connections as f64 / stats.connection_attempts as f64
                        } else {
                            0.0
                        };

                        if reliability > best_reliability {
                            best_reliability = reliability;
                            best_transport = Some(transport);
                        }
                    }
                }

                best_transport.ok_or_else(|| {
                    BitChatError::Transport("No active transport available".to_string())
                })
            }
            TransportStrategy::LoadBalance => {
                // Simple round-robin for now
                let active_transports: Vec<_> = self
                    .transports
                    .iter()
                    .filter(|t| futures::executor::block_on(t.status()) == TransportStatus::Active)
                    .collect();

                if active_transports.is_empty() {
                    return Err(BitChatError::Transport(
                        "No active transport available".to_string(),
                    ));
                }

                let index =
                    peer_id.chars().map(|c| c as usize).sum::<usize>() % active_transports.len();
                Ok(active_transports[index])
            }
            TransportStrategy::BestForPeer => {
                // Check if peer is connected on any transport
                for transport in &self.transports {
                    if transport.is_peer_connected(peer_id).await? {
                        return Ok(transport);
                    }
                }

                // Fall back to first available
                for transport in &self.transports {
                    if transport.status().await == TransportStatus::Active {
                        return Ok(transport);
                    }
                }

                Err(BitChatError::Transport(
                    "No active transport available".to_string(),
                ))
            }
        }
    }

    /// Update routing table for a peer
    pub async fn update_routing(&self, peer_id: &str, transport_type: TransportType) {
        let mut routing_table = self.routing_table.write().await;
        routing_table.insert(peer_id.to_string(), transport_type);
    }

    /// Connect to a peer using best available transport
    pub async fn connect_peer(&self, peer_address: &str) -> Result<String> {
        let transport = self.select_transport_for_peer("unknown").await?;
        transport.connect_peer(peer_address).await
    }

    /// Disconnect from a peer
    pub async fn disconnect_peer(&self, peer_id: &str) -> Result<()> {
        for transport in &self.transports {
            if transport.is_peer_connected(peer_id).await? {
                transport.disconnect_peer(peer_id).await?;
            }
        }
        Ok(())
    }

    /// Get local addresses for all transports
    pub async fn local_addresses(&self) -> Vec<(TransportType, String)> {
        let mut addresses = Vec::new();

        for transport in &self.transports {
            if let Ok(address) = transport.local_address().await {
                addresses.push((transport.transport_type(), address));
            }
        }

        addresses
    }

    /// Set transport selection strategy
    pub fn set_strategy(&mut self, strategy: TransportStrategy) {
        self.strategy = strategy;
    }
}

/// Internet P2P transport (integration with QuDAG's existing P2P layer)
pub struct InternetP2PTransport {
    config: BitChatConfig,
    status: Arc<RwLock<TransportStatus>>,
    stats: Arc<RwLock<TransportStats>>,
    connected_peers: Arc<RwLock<HashMap<String, PeerInfo>>>,
}

impl InternetP2PTransport {
    pub async fn new(config: &BitChatConfig) -> Result<Self> {
        let mut stats = TransportStats::default();
        stats.transport_type = TransportType::InternetP2P;

        Ok(Self {
            config: config.clone(),
            status: Arc::new(RwLock::new(TransportStatus::Inactive)),
            stats: Arc::new(RwLock::new(stats)),
            connected_peers: Arc::new(RwLock::new(HashMap::new())),
        })
    }
}

#[async_trait]
impl Transport for InternetP2PTransport {
    async fn start(&mut self) -> Result<()> {
        let mut status = self.status.write().await;
        *status = TransportStatus::Starting;

        // Integration with QuDAG's P2P layer would happen here
        tracing::info!("Starting Internet P2P transport");

        *status = TransportStatus::Active;
        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        let mut status = self.status.write().await;
        *status = TransportStatus::Stopping;

        tracing::info!("Stopping Internet P2P transport");

        *status = TransportStatus::Inactive;
        Ok(())
    }

    async fn send_to_peer(&self, peer_id: &str, message: &ReceivedMessage) -> Result<()> {
        tracing::debug!("Sending message to peer {} via Internet P2P", peer_id);

        let mut stats = self.stats.write().await;
        stats.messages_sent += 1;
        stats.bytes_sent += message.data.len() as u64;
        stats.last_activity = SystemTime::now();

        // Would send via QuDAG's P2P layer here
        Ok(())
    }

    async fn receive_message(&self) -> Result<Option<ReceivedMessage>> {
        // Would receive from QuDAG's P2P layer here
        Ok(None)
    }

    async fn subscribe_topic(&self, topic: &str) -> Result<()> {
        tracing::debug!("Subscribing to topic {} via Internet P2P", topic);
        Ok(())
    }

    async fn unsubscribe_topic(&self, topic: &str) -> Result<()> {
        tracing::debug!("Unsubscribing from topic {} via Internet P2P", topic);
        Ok(())
    }

    async fn publish_to_topic(&self, topic: &str, _message: &ReceivedMessage) -> Result<()> {
        tracing::debug!("Publishing to topic {} via Internet P2P", topic);
        Ok(())
    }

    async fn get_connected_peers(&self) -> Result<Vec<PeerInfo>> {
        let peers = self.connected_peers.read().await;
        Ok(peers.values().cloned().collect())
    }

    async fn is_peer_connected(&self, peer_id: &str) -> Result<bool> {
        let peers = self.connected_peers.read().await;
        Ok(peers.contains_key(peer_id))
    }

    fn transport_type(&self) -> TransportType {
        TransportType::InternetP2P
    }

    async fn status(&self) -> TransportStatus {
        self.status.read().await.clone()
    }

    async fn stats(&self) -> TransportStats {
        self.stats.read().await.clone()
    }

    async fn connect_peer(&self, peer_address: &str) -> Result<String> {
        let peer_id = Uuid::new_v4().to_string();

        let peer_info = PeerInfo {
            id: peer_id.clone(),
            address: peer_address.to_string(),
            transport: "InternetP2P".to_string(),
            connected_at: SystemTime::now(),
            last_seen: SystemTime::now(),
            latency_ms: Some(50.0),
            capabilities: Vec::new(),
            metadata: HashMap::new(),
        };

        let mut peers = self.connected_peers.write().await;
        peers.insert(peer_id.clone(), peer_info);

        let mut stats = self.stats.write().await;
        stats.connection_attempts += 1;
        stats.successful_connections += 1;
        stats.connected_peers = peers.len();

        Ok(peer_id)
    }

    async fn disconnect_peer(&self, peer_id: &str) -> Result<()> {
        let mut peers = self.connected_peers.write().await;
        peers.remove(peer_id);

        let mut stats = self.stats.write().await;
        stats.connected_peers = peers.len();

        Ok(())
    }

    async fn local_address(&self) -> Result<String> {
        Ok(format!(
            "{}:{}",
            self.config.bind_address, self.config.listen_port
        ))
    }
}

/// WebSocket transport for WASM environments
pub struct WebSocketTransport {
    config: BitChatConfig,
    status: Arc<RwLock<TransportStatus>>,
    stats: Arc<RwLock<TransportStats>>,
    connected_peers: Arc<RwLock<HashMap<String, PeerInfo>>>,
}

impl WebSocketTransport {
    pub async fn new(config: &BitChatConfig) -> Result<Self> {
        let mut stats = TransportStats::default();
        stats.transport_type = TransportType::WebSocket;

        Ok(Self {
            config: config.clone(),
            status: Arc::new(RwLock::new(TransportStatus::Inactive)),
            stats: Arc::new(RwLock::new(stats)),
            connected_peers: Arc::new(RwLock::new(HashMap::new())),
        })
    }
}

#[async_trait]
impl Transport for WebSocketTransport {
    async fn start(&mut self) -> Result<()> {
        let mut status = self.status.write().await;
        *status = TransportStatus::Starting;

        tracing::info!("Starting WebSocket transport");

        *status = TransportStatus::Active;
        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        let mut status = self.status.write().await;
        *status = TransportStatus::Stopping;

        tracing::info!("Stopping WebSocket transport");

        *status = TransportStatus::Inactive;
        Ok(())
    }

    async fn send_to_peer(&self, peer_id: &str, message: &ReceivedMessage) -> Result<()> {
        tracing::debug!("Sending message to peer {} via WebSocket", peer_id);

        let mut stats = self.stats.write().await;
        stats.messages_sent += 1;
        stats.bytes_sent += message.data.len() as u64;
        stats.last_activity = SystemTime::now();

        Ok(())
    }

    async fn receive_message(&self) -> Result<Option<ReceivedMessage>> {
        Ok(None)
    }

    async fn subscribe_topic(&self, topic: &str) -> Result<()> {
        tracing::debug!("Subscribing to topic {} via WebSocket", topic);
        Ok(())
    }

    async fn unsubscribe_topic(&self, topic: &str) -> Result<()> {
        tracing::debug!("Unsubscribing from topic {} via WebSocket", topic);
        Ok(())
    }

    async fn publish_to_topic(&self, topic: &str, _message: &ReceivedMessage) -> Result<()> {
        tracing::debug!("Publishing to topic {} via WebSocket", topic);
        Ok(())
    }

    async fn get_connected_peers(&self) -> Result<Vec<PeerInfo>> {
        let peers = self.connected_peers.read().await;
        Ok(peers.values().cloned().collect())
    }

    async fn is_peer_connected(&self, peer_id: &str) -> Result<bool> {
        let peers = self.connected_peers.read().await;
        Ok(peers.contains_key(peer_id))
    }

    fn transport_type(&self) -> TransportType {
        TransportType::WebSocket
    }

    async fn status(&self) -> TransportStatus {
        self.status.read().await.clone()
    }

    async fn stats(&self) -> TransportStats {
        self.stats.read().await.clone()
    }

    async fn connect_peer(&self, peer_address: &str) -> Result<String> {
        let peer_id = Uuid::new_v4().to_string();

        let peer_info = PeerInfo {
            id: peer_id.clone(),
            address: peer_address.to_string(),
            transport: "WebSocket".to_string(),
            connected_at: SystemTime::now(),
            last_seen: SystemTime::now(),
            latency_ms: Some(25.0),
            capabilities: Vec::new(),
            metadata: HashMap::new(),
        };

        let mut peers = self.connected_peers.write().await;
        peers.insert(peer_id.clone(), peer_info);

        let mut stats = self.stats.write().await;
        stats.connection_attempts += 1;
        stats.successful_connections += 1;
        stats.connected_peers = peers.len();

        Ok(peer_id)
    }

    async fn disconnect_peer(&self, peer_id: &str) -> Result<()> {
        let mut peers = self.connected_peers.write().await;
        peers.remove(peer_id);

        let mut stats = self.stats.write().await;
        stats.connected_peers = peers.len();

        Ok(())
    }

    async fn local_address(&self) -> Result<String> {
        Ok(format!(
            "ws://{}:{}",
            self.config.bind_address, self.config.listen_port
        ))
    }
}

// Real transport implementations are in the transports module
// These are only used as fallbacks when the real implementations are not available

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::BitChatConfig;

    #[tokio::test]
    async fn test_transport_creation() {
        let config = BitChatConfig::default();
        let transport = MultiTransport::new(&config).await.unwrap();

        assert!(!transport.transports.is_empty());
    }

    #[tokio::test]
    async fn test_transport_lifecycle() {
        let config = BitChatConfig::default();
        let mut transport = MultiTransport::new(&config).await.unwrap();

        transport.start().await.unwrap();
        transport.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_internet_p2p_transport() {
        let config = BitChatConfig::default();
        let mut transport = InternetP2PTransport::new(&config).await.unwrap();

        transport.start().await.unwrap();
        assert_eq!(transport.status().await, TransportStatus::Active);

        transport.stop().await.unwrap();
        assert_eq!(transport.status().await, TransportStatus::Inactive);
    }

    #[tokio::test]
    async fn test_websocket_transport() {
        let config = BitChatConfig::wasm();
        let mut transport = WebSocketTransport::new(&config).await.unwrap();

        transport.start().await.unwrap();
        assert_eq!(transport.status().await, TransportStatus::Active);

        let local_addr = transport.local_address().await.unwrap();
        assert!(local_addr.starts_with("ws://"));

        transport.stop().await.unwrap();
        assert_eq!(transport.status().await, TransportStatus::Inactive);
    }

    #[tokio::test]
    async fn test_peer_connection() {
        let config = BitChatConfig::default();
        let mut transport = InternetP2PTransport::new(&config).await.unwrap();

        transport.start().await.unwrap();

        let peer_id = transport.connect_peer("127.0.0.1:8080").await.unwrap();
        assert!(transport.is_peer_connected(&peer_id).await.unwrap());

        let peers = transport.get_connected_peers().await.unwrap();
        assert_eq!(peers.len(), 1);
        assert_eq!(peers[0].id, peer_id);

        transport.disconnect_peer(&peer_id).await.unwrap();
        assert!(!transport.is_peer_connected(&peer_id).await.unwrap());
    }

    #[tokio::test]
    async fn test_transport_stats() {
        let config = BitChatConfig::default();
        let mut transport = InternetP2PTransport::new(&config).await.unwrap();

        transport.start().await.unwrap();

        let stats = transport.stats().await;
        assert_eq!(stats.transport_type, TransportType::InternetP2P);
        assert_eq!(stats.status, TransportStatus::Active);
        assert_eq!(stats.messages_sent, 0);
        assert_eq!(stats.messages_received, 0);
    }
}
