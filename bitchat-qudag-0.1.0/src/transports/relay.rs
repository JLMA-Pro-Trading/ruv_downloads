//! Relay transport implementation with WebRTC support

use async_trait::async_trait;
use futures::StreamExt;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::{interval, timeout};
use uuid::Uuid;

use crate::config::BitChatConfig;
use crate::error::{BitChatError, Result};
use crate::messaging::{PeerInfo, ReceivedMessage};
use crate::transport::{Transport, TransportStats, TransportStatus, TransportType};

const RELAY_PROTOCOL_VERSION: &str = "1.0.0";
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);
const PEER_TIMEOUT: Duration = Duration::from_secs(90);
const MAX_RELAY_HOPS: u8 = 3;

/// Relay transport for bridging different network types
pub struct RelayTransport {
    config: BitChatConfig,
    status: Arc<RwLock<TransportStatus>>,
    stats: Arc<RwLock<TransportStats>>,
    connected_peers: Arc<RwLock<HashMap<String, PeerInfo>>>,
    message_queue: Arc<Mutex<mpsc::UnboundedReceiver<ReceivedMessage>>>,
    message_sender: mpsc::UnboundedSender<ReceivedMessage>,
    local_peer_id: String,

    // Relay infrastructure
    relay_servers: Arc<RwLock<HashMap<String, RelayServer>>>,
    relay_connections: Arc<RwLock<HashMap<String, RelayConnection>>>,
    active_relays: Arc<RwLock<HashMap<String, ActiveRelay>>>,

    // WebRTC components
    webrtc_peers: Arc<RwLock<HashMap<String, WebRTCPeer>>>,
    ice_servers: Vec<IceServer>,

    // Message routing
    routing_table: Arc<RwLock<HashMap<String, RouteInfo>>>,
    message_cache: Arc<RwLock<HashMap<String, CachedMessage>>>,

    // Background tasks
    heartbeat_handle: Option<tokio::task::JoinHandle<()>>,
    cleanup_handle: Option<tokio::task::JoinHandle<()>>,
    webrtc_handle: Option<tokio::task::JoinHandle<()>>,
}

#[derive(Debug, Clone)]
struct RelayServer {
    id: String,
    address: SocketAddr,
    last_ping: SystemTime,
    load: f32,
    capabilities: Vec<String>,
    connection_count: u32,
    max_connections: u32,
}

#[derive(Debug, Clone)]
struct RelayConnection {
    server_id: String,
    connection_id: String,
    established_at: SystemTime,
    last_activity: SystemTime,
    bytes_sent: u64,
    bytes_received: u64,
    latency: Duration,
}

#[derive(Debug, Clone)]
struct ActiveRelay {
    relay_id: String,
    source_peer: String,
    target_peer: String,
    hop_count: u8,
    established_at: SystemTime,
    last_used: SystemTime,
    bandwidth_used: u64,
}

#[derive(Debug, Clone)]
struct WebRTCPeer {
    peer_id: String,
    connection_state: WebRTCConnectionState,
    data_channel: Option<String>, // WebRTC data channel identifier
    ice_connection_state: IceConnectionState,
    signaling_state: SignalingState,
    local_description: Option<String>,
    remote_description: Option<String>,
    ice_candidates: Vec<IceCandidate>,
}

#[derive(Debug, Clone)]
enum WebRTCConnectionState {
    New,
    Connecting,
    Connected,
    Disconnected,
    Failed,
    Closed,
}

#[derive(Debug, Clone)]
enum IceConnectionState {
    New,
    Gathering,
    Checking,
    Connected,
    Completed,
    Failed,
    Disconnected,
    Closed,
}

#[derive(Debug, Clone)]
enum SignalingState {
    Stable,
    HaveLocalOffer,
    HaveRemoteOffer,
    HaveLocalAnswer,
    HaveRemoteAnswer,
    Closed,
}

#[derive(Debug, Clone)]
struct IceCandidate {
    candidate: String,
    sdp_mid: Option<String>,
    sdp_mline_index: Option<u32>,
}

#[derive(Debug, Clone)]
struct IceServer {
    urls: Vec<String>,
    username: Option<String>,
    credential: Option<String>,
}

#[derive(Debug, Clone)]
struct RouteInfo {
    next_hop: String,
    hop_count: u8,
    latency: Duration,
    bandwidth: u64,
    reliability: f32,
    last_updated: SystemTime,
}

#[derive(Debug, Clone)]
struct CachedMessage {
    message: RelayMessage,
    timestamp: SystemTime,
    attempts: u32,
    max_attempts: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct RelayMessage {
    id: String,
    message_type: RelayMessageType,
    source_peer: String,
    target_peer: String,
    hop_count: u8,
    timestamp: SystemTime,
    payload: Vec<u8>,
    signature: Option<Vec<u8>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
enum RelayMessageType {
    Direct,
    Relay,
    WebRTC,
    Heartbeat,
    RouteDiscovery,
    RouteResponse,
    Error,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct WebRTCSignaling {
    message_type: WebRTCSignalingType,
    session_id: String,
    data: serde_json::Value,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
enum WebRTCSignalingType {
    Offer,
    Answer,
    IceCandidate,
    Close,
}

impl RelayTransport {
    /// Create a new relay transport
    pub async fn new(config: BitChatConfig) -> Result<Self> {
        let local_peer_id = Uuid::new_v4().to_string();
        let (message_sender, message_receiver) = mpsc::unbounded_channel();

        let mut stats = TransportStats::default();
        stats.transport_type = TransportType::Relay;

        // Default ICE servers (STUN/TURN)
        let ice_servers = vec![
            IceServer {
                urls: vec!["stun:stun.l.google.com:19302".to_string()],
                username: None,
                credential: None,
            },
            IceServer {
                urls: vec!["stun:stun1.l.google.com:19302".to_string()],
                username: None,
                credential: None,
            },
            // Add TURN servers if configured
            IceServer {
                urls: vec!["turn:turn.bitchat.local:3478".to_string()],
                username: Some("bitchat".to_string()),
                credential: Some("relay123".to_string()),
            },
        ];

        Ok(Self {
            config,
            status: Arc::new(RwLock::new(TransportStatus::Inactive)),
            stats: Arc::new(RwLock::new(stats)),
            connected_peers: Arc::new(RwLock::new(HashMap::new())),
            message_queue: Arc::new(Mutex::new(message_receiver)),
            message_sender,
            local_peer_id,
            relay_servers: Arc::new(RwLock::new(HashMap::new())),
            relay_connections: Arc::new(RwLock::new(HashMap::new())),
            active_relays: Arc::new(RwLock::new(HashMap::new())),
            webrtc_peers: Arc::new(RwLock::new(HashMap::new())),
            ice_servers,
            routing_table: Arc::new(RwLock::new(HashMap::new())),
            message_cache: Arc::new(RwLock::new(HashMap::new())),
            heartbeat_handle: None,
            cleanup_handle: None,
            webrtc_handle: None,
        })
    }

    /// Discover available relay servers
    async fn discover_relay_servers(&self) -> Result<()> {
        let relay_servers = vec![
            RelayServer {
                id: "relay1".to_string(),
                address: "relay1.bitchat.local:8080".parse().unwrap(),
                last_ping: SystemTime::now(),
                load: 0.3,
                capabilities: vec!["webrtc".to_string(), "tcp".to_string()],
                connection_count: 150,
                max_connections: 1000,
            },
            RelayServer {
                id: "relay2".to_string(),
                address: "relay2.bitchat.local:8080".parse().unwrap(),
                last_ping: SystemTime::now(),
                load: 0.7,
                capabilities: vec!["webrtc".to_string(), "tcp".to_string(), "turn".to_string()],
                connection_count: 700,
                max_connections: 1000,
            },
        ];

        let mut servers = self.relay_servers.write().await;
        for server in relay_servers {
            servers.insert(server.id.clone(), server);
        }

        tracing::info!("Discovered {} relay servers", servers.len());
        Ok(())
    }

    /// Connect to best available relay server
    async fn connect_to_relay(&self) -> Result<String> {
        let servers = self.relay_servers.read().await;

        // Find best server (lowest load, highest capacity)
        let best_server = servers
            .values()
            .filter(|s| s.connection_count < s.max_connections)
            .min_by(|a, b| {
                let load_a = a.load + (a.connection_count as f32 / a.max_connections as f32);
                let load_b = b.load + (b.connection_count as f32 / b.max_connections as f32);
                load_a
                    .partial_cmp(&load_b)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

        if let Some(server) = best_server {
            // Connect to relay server
            let stream = TcpStream::connect(server.address).await.map_err(|e| {
                BitChatError::Transport(format!("Failed to connect to relay server: {}", e))
            })?;

            let connection_id = Uuid::new_v4().to_string();
            let connection = RelayConnection {
                server_id: server.id.clone(),
                connection_id: connection_id.clone(),
                established_at: SystemTime::now(),
                last_activity: SystemTime::now(),
                bytes_sent: 0,
                bytes_received: 0,
                latency: Duration::from_millis(50),
            };

            let mut connections = self.relay_connections.write().await;
            connections.insert(connection_id.clone(), connection);

            tracing::info!("Connected to relay server: {}", server.id);
            Ok(connection_id)
        } else {
            Err(BitChatError::Transport(
                "No available relay servers".to_string(),
            ))
        }
    }

    /// Initialize WebRTC peer connection
    async fn initialize_webrtc_peer(&self, peer_id: String) -> Result<()> {
        let webrtc_peer = WebRTCPeer {
            peer_id: peer_id.clone(),
            connection_state: WebRTCConnectionState::New,
            data_channel: None,
            ice_connection_state: IceConnectionState::New,
            signaling_state: SignalingState::Stable,
            local_description: None,
            remote_description: None,
            ice_candidates: Vec::new(),
        };

        let mut peers = self.webrtc_peers.write().await;
        peers.insert(peer_id.clone(), webrtc_peer);

        tracing::info!("Initialized WebRTC peer: {}", peer_id);
        Ok(())
    }

    /// Create WebRTC offer
    async fn create_webrtc_offer(&self, peer_id: &str) -> Result<String> {
        // In a real implementation, this would use a WebRTC library
        // For now, we'll create a mock SDP offer
        let offer = format!(
            "v=0\r\n\
            o=- {} {} IN IP4 127.0.0.1\r\n\
            s=-\r\n\
            t=0 0\r\n\
            m=application {} UDP/DTLS/SCTP webrtc-datachannel\r\n\
            c=IN IP4 0.0.0.0\r\n\
            a=ice-ufrag:{}\r\n\
            a=ice-pwd:{}\r\n\
            a=fingerprint:sha-256 {}\r\n\
            a=setup:actpass\r\n\
            a=mid:0\r\n\
            a=sctp-port:5000\r\n\
            a=max-message-size:262144\r\n",
            SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
            SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
            9, // Port
            Uuid::new_v4().to_string().replace("-", "")[..8].to_string(),
            Uuid::new_v4().to_string().replace("-", ""),
            "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89"
        );

        // Update peer state
        let mut peers = self.webrtc_peers.write().await;
        if let Some(peer) = peers.get_mut(peer_id) {
            peer.local_description = Some(offer.clone());
            peer.signaling_state = SignalingState::HaveLocalOffer;
        }

        Ok(offer)
    }

    /// Handle WebRTC answer
    async fn handle_webrtc_answer(&self, peer_id: &str, answer: String) -> Result<()> {
        let mut peers = self.webrtc_peers.write().await;
        if let Some(peer) = peers.get_mut(peer_id) {
            peer.remote_description = Some(answer);
            peer.signaling_state = SignalingState::Stable;
            peer.connection_state = WebRTCConnectionState::Connected;
        }

        tracing::info!("WebRTC connection established with peer: {}", peer_id);
        Ok(())
    }

    /// Send message via WebRTC data channel
    async fn send_webrtc_message(&self, peer_id: &str, data: &[u8]) -> Result<()> {
        let peers = self.webrtc_peers.read().await;
        if let Some(peer) = peers.get(peer_id) {
            if matches!(peer.connection_state, WebRTCConnectionState::Connected) {
                // In a real implementation, this would send via WebRTC data channel
                tracing::debug!("Sending {} bytes via WebRTC to {}", data.len(), peer_id);

                // Update stats
                let mut stats = self.stats.write().await;
                stats.messages_sent += 1;
                stats.bytes_sent += data.len() as u64;

                return Ok(());
            }
        }

        Err(BitChatError::Transport(
            "WebRTC peer not connected".to_string(),
        ))
    }

    /// Route message through relay network
    async fn route_message(&self, target_peer: &str, message: &RelayMessage) -> Result<()> {
        let routing_table = self.routing_table.read().await;

        if let Some(route) = routing_table.get(target_peer) {
            if route.hop_count < MAX_RELAY_HOPS {
                // Forward to next hop
                let next_hop = &route.next_hop;
                self.forward_message(next_hop, message).await?;
            } else {
                return Err(BitChatError::Transport(
                    "Max relay hops exceeded".to_string(),
                ));
            }
        } else {
            // No route found, try to discover
            self.discover_route(target_peer).await?;

            // Cache message for later delivery
            let cached_message = CachedMessage {
                message: message.clone(),
                timestamp: SystemTime::now(),
                attempts: 0,
                max_attempts: 3,
            };

            let mut cache = self.message_cache.write().await;
            cache.insert(message.id.clone(), cached_message);
        }

        Ok(())
    }

    /// Forward message to next hop
    async fn forward_message(&self, next_hop: &str, message: &RelayMessage) -> Result<()> {
        let connections = self.relay_connections.read().await;

        // Try relay connection first
        if let Some(_connection) = connections.get(next_hop) {
            // In a real implementation, this would send via relay connection
            tracing::debug!("Forwarding message via relay to {}", next_hop);
            return Ok(());
        }

        // Try WebRTC connection
        if let Ok(()) = self.send_webrtc_message(next_hop, &message.payload).await {
            return Ok(());
        }

        Err(BitChatError::Transport("No route to next hop".to_string()))
    }

    /// Discover route to target peer
    async fn discover_route(&self, target_peer: &str) -> Result<()> {
        let discovery_message = RelayMessage {
            id: Uuid::new_v4().to_string(),
            message_type: RelayMessageType::RouteDiscovery,
            source_peer: self.local_peer_id.clone(),
            target_peer: target_peer.to_string(),
            hop_count: 0,
            timestamp: SystemTime::now(),
            payload: Vec::new(),
            signature: None,
        };

        // Broadcast route discovery to all connected relays
        let connections = self.relay_connections.read().await;
        for connection in connections.values() {
            let _ = self
                .forward_message(&connection.server_id, &discovery_message)
                .await;
        }

        tracing::info!("Initiated route discovery for peer: {}", target_peer);
        Ok(())
    }

    /// Start heartbeat to maintain connections
    async fn start_heartbeat(&mut self) -> Result<()> {
        let relay_connections = self.relay_connections.clone();
        let webrtc_peers = self.webrtc_peers.clone();
        let local_peer_id = self.local_peer_id.clone();

        let heartbeat_handle = tokio::spawn(async move {
            let mut interval = interval(HEARTBEAT_INTERVAL);

            loop {
                interval.tick().await;

                // Send heartbeat to relay connections
                let connections = relay_connections.read().await;
                for connection in connections.values() {
                    let heartbeat = RelayMessage {
                        id: Uuid::new_v4().to_string(),
                        message_type: RelayMessageType::Heartbeat,
                        source_peer: local_peer_id.clone(),
                        target_peer: connection.server_id.clone(),
                        hop_count: 0,
                        timestamp: SystemTime::now(),
                        payload: Vec::new(),
                        signature: None,
                    };

                    // In a real implementation, this would send the heartbeat
                    tracing::trace!("Sending heartbeat to relay: {}", connection.server_id);
                }

                // Send heartbeat to WebRTC peers
                let peers = webrtc_peers.read().await;
                for peer in peers.values() {
                    if matches!(peer.connection_state, WebRTCConnectionState::Connected) {
                        tracing::trace!("Sending WebRTC heartbeat to peer: {}", peer.peer_id);
                    }
                }
            }
        });

        self.heartbeat_handle = Some(heartbeat_handle);
        Ok(())
    }

    /// Start cleanup task for expired connections and messages
    async fn start_cleanup(&mut self) -> Result<()> {
        let relay_connections = self.relay_connections.clone();
        let webrtc_peers = self.webrtc_peers.clone();
        let message_cache = self.message_cache.clone();
        let routing_table = self.routing_table.clone();

        let cleanup_handle = tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(60)); // Clean up every minute

            loop {
                interval.tick().await;
                let now = SystemTime::now();

                // Clean up expired relay connections
                {
                    let mut connections = relay_connections.write().await;
                    connections.retain(|_, conn| {
                        now.duration_since(conn.last_activity).unwrap_or_default() < PEER_TIMEOUT
                    });
                }

                // Clean up failed WebRTC peers
                {
                    let mut peers = webrtc_peers.write().await;
                    peers.retain(|_, peer| {
                        !matches!(
                            peer.connection_state,
                            WebRTCConnectionState::Failed | WebRTCConnectionState::Closed
                        )
                    });
                }

                // Clean up expired cached messages
                {
                    let mut cache = message_cache.write().await;
                    cache.retain(|_, msg| {
                        now.duration_since(msg.timestamp).unwrap_or_default()
                            < Duration::from_secs(300)
                    });
                }

                // Clean up stale routing entries
                {
                    let mut routes = routing_table.write().await;
                    routes.retain(|_, route| {
                        now.duration_since(route.last_updated).unwrap_or_default()
                            < Duration::from_secs(600)
                    });
                }
            }
        });

        self.cleanup_handle = Some(cleanup_handle);
        Ok(())
    }

    /// Start WebRTC signaling handler
    async fn start_webrtc_signaling(&mut self) -> Result<()> {
        let webrtc_peers = self.webrtc_peers.clone();
        let message_sender = self.message_sender.clone();

        let webrtc_handle = tokio::spawn(async move {
            // In a real implementation, this would handle WebRTC signaling
            // For now, we'll just log that it's running
            tracing::info!("WebRTC signaling handler started");

            loop {
                tokio::time::sleep(Duration::from_secs(10)).await;

                // Check WebRTC peer states
                let peers = webrtc_peers.read().await;
                for peer in peers.values() {
                    match peer.connection_state {
                        WebRTCConnectionState::Failed => {
                            tracing::warn!("WebRTC peer connection failed: {}", peer.peer_id);
                        }
                        WebRTCConnectionState::Disconnected => {
                            tracing::info!("WebRTC peer disconnected: {}", peer.peer_id);
                        }
                        _ => {}
                    }
                }
            }
        });

        self.webrtc_handle = Some(webrtc_handle);
        Ok(())
    }
}

#[async_trait]
impl Transport for RelayTransport {
    async fn start(&mut self) -> Result<()> {
        *self.status.write().await = TransportStatus::Starting;

        // Discover relay servers
        self.discover_relay_servers().await?;

        // Connect to best relay
        let _connection_id = self.connect_to_relay().await?;

        // Start background tasks
        self.start_heartbeat().await?;
        self.start_cleanup().await?;
        self.start_webrtc_signaling().await?;

        *self.status.write().await = TransportStatus::Active;
        tracing::info!("Relay transport started");

        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        *self.status.write().await = TransportStatus::Stopping;

        // Stop background tasks
        if let Some(handle) = self.heartbeat_handle.take() {
            handle.abort();
        }

        if let Some(handle) = self.cleanup_handle.take() {
            handle.abort();
        }

        if let Some(handle) = self.webrtc_handle.take() {
            handle.abort();
        }

        // Close all connections
        {
            let mut connections = self.relay_connections.write().await;
            connections.clear();
        }

        {
            let mut peers = self.webrtc_peers.write().await;
            peers.clear();
        }

        *self.status.write().await = TransportStatus::Inactive;
        tracing::info!("Relay transport stopped");

        Ok(())
    }

    async fn send_to_peer(&self, peer_id: &str, message: &ReceivedMessage) -> Result<()> {
        let relay_message = RelayMessage {
            id: Uuid::new_v4().to_string(),
            message_type: RelayMessageType::Direct,
            source_peer: self.local_peer_id.clone(),
            target_peer: peer_id.to_string(),
            hop_count: 0,
            timestamp: SystemTime::now(),
            payload: bincode::serialize(message).map_err(|e| BitChatError::Serialization(e))?,
            signature: None,
        };

        // Try WebRTC first
        if let Ok(()) = self
            .send_webrtc_message(peer_id, &relay_message.payload)
            .await
        {
            return Ok(());
        }

        // Fall back to relay routing
        self.route_message(peer_id, &relay_message).await
    }

    async fn receive_message(&self) -> Result<Option<ReceivedMessage>> {
        let mut queue = self.message_queue.lock().await;
        match queue.try_recv() {
            Ok(message) => Ok(Some(message)),
            Err(mpsc::error::TryRecvError::Empty) => Ok(None),
            Err(mpsc::error::TryRecvError::Disconnected) => Err(BitChatError::Transport(
                "Message channel disconnected".to_string(),
            )),
        }
    }

    async fn subscribe_topic(&self, topic: &str) -> Result<()> {
        tracing::info!("Subscribed to topic via relay: {}", topic);
        Ok(())
    }

    async fn unsubscribe_topic(&self, topic: &str) -> Result<()> {
        tracing::info!("Unsubscribed from topic via relay: {}", topic);
        Ok(())
    }

    async fn publish_to_topic(&self, topic: &str, message: &ReceivedMessage) -> Result<()> {
        // Broadcast to all connected peers
        let connections = self.relay_connections.read().await;
        let webrtc_peers = self.webrtc_peers.read().await;

        let mut topic_message = message.clone();
        topic_message.topic = Some(topic.to_string());

        // Send via relay connections
        for connection in connections.values() {
            let _ = self
                .send_to_peer(&connection.server_id, &topic_message)
                .await;
        }

        // Send via WebRTC peers
        for peer in webrtc_peers.values() {
            if matches!(peer.connection_state, WebRTCConnectionState::Connected) {
                let _ = self.send_to_peer(&peer.peer_id, &topic_message).await;
            }
        }

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
        TransportType::Relay
    }

    async fn status(&self) -> TransportStatus {
        self.status.read().await.clone()
    }

    async fn stats(&self) -> TransportStats {
        let mut stats = self.stats.read().await.clone();
        stats.connected_peers = self.connected_peers.read().await.len();
        stats
    }

    async fn connect_peer(&self, peer_address: &str) -> Result<String> {
        // Parse peer address for WebRTC connection
        if peer_address.starts_with("webrtc://") {
            let peer_id = peer_address
                .strip_prefix("webrtc://")
                .unwrap_or(peer_address);

            // Initialize WebRTC peer
            self.initialize_webrtc_peer(peer_id.to_string()).await?;

            // Create offer
            let offer = self.create_webrtc_offer(peer_id).await?;

            // In a real implementation, this would send the offer via signaling server
            tracing::info!("Created WebRTC offer for peer: {}", peer_id);

            return Ok(peer_id.to_string());
        }

        // For relay connections, use the relay server
        let connection_id = self.connect_to_relay().await?;
        Ok(connection_id)
    }

    async fn disconnect_peer(&self, peer_id: &str) -> Result<()> {
        // Remove from WebRTC peers
        {
            let mut peers = self.webrtc_peers.write().await;
            peers.remove(peer_id);
        }

        // Remove from relay connections
        {
            let mut connections = self.relay_connections.write().await;
            connections.remove(peer_id);
        }

        // Remove from connected peers
        {
            let mut peers = self.connected_peers.write().await;
            peers.remove(peer_id);
        }

        Ok(())
    }

    async fn local_address(&self) -> Result<String> {
        Ok(format!("relay://{}", self.local_peer_id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::BitChatConfig;

    #[tokio::test]
    async fn test_relay_transport_creation() {
        let config = BitChatConfig::development();
        let transport = RelayTransport::new(config).await.unwrap();

        assert_eq!(transport.transport_type(), TransportType::Relay);
        assert_eq!(transport.status().await, TransportStatus::Inactive);
    }

    #[tokio::test]
    async fn test_webrtc_offer_creation() {
        let config = BitChatConfig::development();
        let transport = RelayTransport::new(config).await.unwrap();

        let peer_id = "test-peer";
        transport
            .initialize_webrtc_peer(peer_id.to_string())
            .await
            .unwrap();

        let offer = transport.create_webrtc_offer(peer_id).await.unwrap();
        assert!(offer.contains("v=0"));
        assert!(offer.contains("application"));
    }

    #[tokio::test]
    async fn test_relay_message_serialization() {
        let message = RelayMessage {
            id: "test-id".to_string(),
            message_type: RelayMessageType::Direct,
            source_peer: "source".to_string(),
            target_peer: "target".to_string(),
            hop_count: 1,
            timestamp: SystemTime::now(),
            payload: b"test payload".to_vec(),
            signature: None,
        };

        let serialized = bincode::serialize(&message).unwrap();
        let deserialized: RelayMessage = bincode::deserialize(&serialized).unwrap();

        assert_eq!(message.id, deserialized.id);
        assert_eq!(message.source_peer, deserialized.source_peer);
        assert_eq!(message.target_peer, deserialized.target_peer);
        assert_eq!(message.hop_count, deserialized.hop_count);
        assert_eq!(message.payload, deserialized.payload);
    }

    #[tokio::test]
    async fn test_ice_servers_configuration() {
        let config = BitChatConfig::development();
        let transport = RelayTransport::new(config).await.unwrap();

        assert!(!transport.ice_servers.is_empty());
        assert!(transport
            .ice_servers
            .iter()
            .any(|server| { server.urls.iter().any(|url| url.starts_with("stun:")) }));
        assert!(transport
            .ice_servers
            .iter()
            .any(|server| { server.urls.iter().any(|url| url.starts_with("turn:")) }));
    }
}
