//! Local network transport implementation with mDNS discovery

use async_trait::async_trait;
use futures::StreamExt;
use local_ip_address::local_ip;
use mdns::{Record, RecordKind};
use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::net::{TcpListener, TcpStream, UdpSocket};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::{interval, timeout};
use uuid::Uuid;

use crate::config::BitChatConfig;
use crate::error::{BitChatError, Result};
use crate::messaging::{PeerInfo, ReceivedMessage};
use crate::transport::{Transport, TransportStats, TransportStatus, TransportType};

const BITCHAT_SERVICE_TYPE: &str = "_bitchat._tcp.local.";
const DISCOVERY_INTERVAL: Duration = Duration::from_secs(30);
const PEER_TIMEOUT: Duration = Duration::from_secs(300); // 5 minutes

/// Local network transport with mDNS discovery
pub struct LocalNetworkTransport {
    config: BitChatConfig,
    status: Arc<RwLock<TransportStatus>>,
    stats: Arc<RwLock<TransportStats>>,
    connected_peers: Arc<RwLock<HashMap<String, PeerInfo>>>,
    message_queue: Arc<Mutex<mpsc::UnboundedReceiver<ReceivedMessage>>>,
    message_sender: mpsc::UnboundedSender<ReceivedMessage>,
    local_peer_id: String,
    tcp_listener: Option<TcpListener>,
    udp_socket: Option<UdpSocket>,
    mdns_handle: Option<tokio::task::JoinHandle<()>>,
    discovery_handle: Option<tokio::task::JoinHandle<()>>,
    peer_connections: Arc<RwLock<HashMap<String, TcpStream>>>,
    local_address: SocketAddr,
    discovered_peers: Arc<RwLock<HashMap<String, DiscoveredPeer>>>,
}

#[derive(Debug, Clone)]
struct DiscoveredPeer {
    peer_id: String,
    address: SocketAddr,
    last_seen: SystemTime,
    service_info: ServiceInfo,
}

#[derive(Debug, Clone)]
struct ServiceInfo {
    version: String,
    capabilities: Vec<String>,
    public_key: Option<String>,
}

impl LocalNetworkTransport {
    /// Create a new local network transport
    pub async fn new(config: BitChatConfig) -> Result<Self> {
        let local_ip = local_ip()
            .map_err(|e| BitChatError::Transport(format!("Failed to get local IP: {}", e)))?;

        let local_address = SocketAddr::new(local_ip, config.listen_port);
        let local_peer_id = Uuid::new_v4().to_string();

        let mut stats = TransportStats::default();
        stats.transport_type = TransportType::LocalNetwork;

        let (message_sender, message_receiver) = mpsc::unbounded_channel();

        Ok(Self {
            config,
            status: Arc::new(RwLock::new(TransportStatus::Inactive)),
            stats: Arc::new(RwLock::new(stats)),
            connected_peers: Arc::new(RwLock::new(HashMap::new())),
            message_queue: Arc::new(Mutex::new(message_receiver)),
            message_sender,
            local_peer_id,
            tcp_listener: None,
            udp_socket: None,
            mdns_handle: None,
            discovery_handle: None,
            peer_connections: Arc::new(RwLock::new(HashMap::new())),
            local_address,
            discovered_peers: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Start TCP listener for incoming connections
    async fn start_tcp_listener(&mut self) -> Result<()> {
        let listener = TcpListener::bind(self.local_address)
            .await
            .map_err(|e| BitChatError::Transport(format!("Failed to bind TCP listener: {}", e)))?;

        tracing::info!(
            "Local network transport listening on: {}",
            self.local_address
        );

        let message_sender = self.message_sender.clone();
        let connected_peers = self.connected_peers.clone();
        let stats = self.stats.clone();
        let local_peer_id = self.local_peer_id.clone();

        let accept_handle = tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, addr)) => {
                        tracing::info!("Accepted connection from: {}", addr);

                        let message_sender = message_sender.clone();
                        let connected_peers = connected_peers.clone();
                        let stats = stats.clone();
                        let local_peer_id = local_peer_id.clone();

                        tokio::spawn(async move {
                            if let Err(e) = Self::handle_tcp_connection(
                                stream,
                                addr,
                                message_sender,
                                connected_peers,
                                stats,
                                local_peer_id,
                            )
                            .await
                            {
                                tracing::error!("TCP connection error: {}", e);
                            }
                        });
                    }
                    Err(e) => {
                        tracing::error!("TCP accept error: {}", e);
                    }
                }
            }
        });

        self.tcp_listener = Some(listener);
        Ok(())
    }

    /// Handle incoming TCP connection
    async fn handle_tcp_connection(
        mut stream: TcpStream,
        addr: SocketAddr,
        message_sender: mpsc::UnboundedSender<ReceivedMessage>,
        connected_peers: Arc<RwLock<HashMap<String, PeerInfo>>>,
        stats: Arc<RwLock<TransportStats>>,
        local_peer_id: String,
    ) -> Result<()> {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        // Read peer handshake
        let mut handshake_buffer = [0u8; 1024];
        let handshake_size = stream
            .read(&mut handshake_buffer)
            .await
            .map_err(|e| BitChatError::Transport(format!("Failed to read handshake: {}", e)))?;

        let handshake_data = &handshake_buffer[..handshake_size];
        let handshake: HandshakeMessage =
            bincode::deserialize(handshake_data).map_err(|e| BitChatError::Serialization(e))?;

        tracing::info!("Received handshake from peer: {}", handshake.peer_id);

        // Send response
        let response = HandshakeResponse {
            peer_id: local_peer_id.clone(),
            version: "1.0.0".to_string(),
            capabilities: vec!["messaging".to_string(), "file_transfer".to_string()],
            accepted: true,
        };

        let response_data =
            bincode::serialize(&response).map_err(|e| BitChatError::Serialization(e))?;

        stream.write_all(&response_data).await.map_err(|e| {
            BitChatError::Transport(format!("Failed to send handshake response: {}", e))
        })?;

        // Add to connected peers
        {
            let mut peers = connected_peers.write().await;
            let peer_info = PeerInfo {
                id: handshake.peer_id.clone(),
                address: addr.to_string(),
                transport: "LocalNetwork".to_string(),
                connected_at: SystemTime::now(),
                last_seen: SystemTime::now(),
                latency_ms: Some(1.0), // Local network latency
                capabilities: handshake.capabilities.clone(),
                metadata: HashMap::new(),
            };
            peers.insert(handshake.peer_id.clone(), peer_info);
        }

        // Update stats
        {
            let mut stats = stats.write().await;
            stats.successful_connections += 1;
            stats.connected_peers += 1;
        }

        // Handle messages
        let mut buffer = [0u8; 65536]; // 64KB buffer
        loop {
            match stream.read(&mut buffer).await {
                Ok(0) => {
                    // Connection closed
                    tracing::info!("Connection closed by peer: {}", handshake.peer_id);
                    break;
                }
                Ok(size) => {
                    let message_data = &buffer[..size];
                    match bincode::deserialize::<ReceivedMessage>(message_data) {
                        Ok(message) => {
                            let _ = message_sender.send(message);

                            let mut stats = stats.write().await;
                            stats.messages_received += 1;
                            stats.bytes_received += size as u64;
                        }
                        Err(e) => {
                            tracing::error!("Failed to deserialize message: {}", e);
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("TCP read error: {}", e);
                    break;
                }
            }
        }

        // Remove from connected peers
        {
            let mut peers = connected_peers.write().await;
            peers.remove(&handshake.peer_id);
        }

        Ok(())
    }

    /// Start mDNS service discovery
    async fn start_mdns_discovery(&mut self) -> Result<()> {
        let discovered_peers = self.discovered_peers.clone();
        let local_peer_id = self.local_peer_id.clone();
        let local_address = self.local_address;

        let mdns_handle = tokio::spawn(async move {
            let mdns = mdns::discover::all(BITCHAT_SERVICE_TYPE)
                .map_err(|e| {
                    tracing::error!("Failed to start mDNS discovery: {}", e);
                    e
                })
                .unwrap();

            mdns.for_each(|response| {
                for record in response.records() {
                    match record.kind {
                        RecordKind::A(ip) => {
                            if let Some(name) = record.name.strip_suffix(".local.") {
                                if name != local_peer_id {
                                    let peer_id = name.to_string();
                                    let address = SocketAddr::new(IpAddr::V4(ip), 8080); // Default port

                                    let discovered_peer = DiscoveredPeer {
                                        peer_id: peer_id.clone(),
                                        address,
                                        last_seen: SystemTime::now(),
                                        service_info: ServiceInfo {
                                            version: "1.0.0".to_string(),
                                            capabilities: vec!["messaging".to_string()],
                                            public_key: None,
                                        },
                                    };

                                    let mut peers = discovered_peers.blocking_write();
                                    peers.insert(peer_id, discovered_peer);

                                    tracing::info!(
                                        "Discovered peer via mDNS: {} at {}",
                                        name,
                                        address
                                    );
                                }
                            }
                        }
                        RecordKind::SRV { port, target } => {
                            tracing::debug!("SRV record: {} -> {}:{}", record.name, target, port);
                        }
                        RecordKind::TXT(data) => {
                            tracing::debug!("TXT record: {} -> {:?}", record.name, data);
                        }
                        _ => {}
                    }
                }
                futures::future::ready(())
            })
            .await;
        });

        self.mdns_handle = Some(mdns_handle);
        Ok(())
    }

    /// Start periodic peer discovery
    async fn start_peer_discovery(&mut self) -> Result<()> {
        let discovered_peers = self.discovered_peers.clone();
        let connected_peers = self.connected_peers.clone();
        let peer_connections = self.peer_connections.clone();
        let local_peer_id = self.local_peer_id.clone();

        let discovery_handle = tokio::spawn(async move {
            let mut discovery_interval = interval(DISCOVERY_INTERVAL);

            loop {
                discovery_interval.tick().await;

                // Clean up expired peers
                {
                    let mut peers = discovered_peers.write().await;
                    let now = SystemTime::now();
                    peers.retain(|_, peer| {
                        now.duration_since(peer.last_seen).unwrap_or_default() < PEER_TIMEOUT
                    });
                }

                // Try to connect to discovered peers
                let peers_to_connect: Vec<_> = {
                    let discovered = discovered_peers.read().await;
                    let connected = connected_peers.read().await;

                    discovered
                        .values()
                        .filter(|peer| !connected.contains_key(&peer.peer_id))
                        .cloned()
                        .collect()
                };

                for peer in peers_to_connect {
                    if let Ok(stream) = TcpStream::connect(peer.address).await {
                        tracing::info!("Connected to discovered peer: {}", peer.peer_id);

                        // Send handshake
                        let handshake = HandshakeMessage {
                            peer_id: local_peer_id.clone(),
                            version: "1.0.0".to_string(),
                            capabilities: vec![
                                "messaging".to_string(),
                                "file_transfer".to_string(),
                            ],
                        };

                        if let Ok(handshake_data) = bincode::serialize(&handshake) {
                            if let Ok(()) = Self::send_handshake(&stream, &handshake_data).await {
                                let mut connections = peer_connections.write().await;
                                connections.insert(peer.peer_id.clone(), stream);
                            }
                        }
                    }
                }
            }
        });

        self.discovery_handle = Some(discovery_handle);
        Ok(())
    }

    /// Send handshake to peer
    async fn send_handshake(stream: &TcpStream, handshake_data: &[u8]) -> Result<()> {
        use tokio::io::AsyncWriteExt;

        let mut stream = stream;
        stream
            .write_all(handshake_data)
            .await
            .map_err(|e| BitChatError::Transport(format!("Failed to send handshake: {}", e)))?;

        Ok(())
    }

    /// Publish mDNS service
    async fn publish_mdns_service(&self) -> Result<()> {
        // In a real implementation, this would publish the service using mDNS
        // For now, we'll just log that we're publishing
        tracing::info!(
            "Publishing mDNS service: {} on {}",
            BITCHAT_SERVICE_TYPE,
            self.local_address
        );
        Ok(())
    }

    /// Setup UPnP port mapping
    async fn setup_upnp(&mut self) -> Result<()> {
        // In a real implementation, this would set up UPnP port mapping
        // For now, we'll just log the attempt
        tracing::info!(
            "Setting up UPnP port mapping for port {}",
            self.config.listen_port
        );
        Ok(())
    }

    /// Get network interfaces
    async fn get_network_interfaces(&self) -> Result<Vec<NetworkInterface>> {
        let mut interfaces = Vec::new();

        // Get local IP addresses
        if let Ok(local_ip) = local_ip() {
            interfaces.push(NetworkInterface {
                name: "local".to_string(),
                ip: local_ip,
                is_up: true,
                is_loopback: local_ip.is_loopback(),
            });
        }

        Ok(interfaces)
    }
}

#[derive(Debug, Clone)]
struct NetworkInterface {
    name: String,
    ip: IpAddr,
    is_up: bool,
    is_loopback: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct HandshakeMessage {
    peer_id: String,
    version: String,
    capabilities: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct HandshakeResponse {
    peer_id: String,
    version: String,
    capabilities: Vec<String>,
    accepted: bool,
}

#[async_trait]
impl Transport for LocalNetworkTransport {
    async fn start(&mut self) -> Result<()> {
        *self.status.write().await = TransportStatus::Starting;

        // Start TCP listener
        self.start_tcp_listener().await?;

        // Setup UPnP port mapping
        self.setup_upnp().await?;

        // Publish mDNS service
        self.publish_mdns_service().await?;

        // Start mDNS discovery
        self.start_mdns_discovery().await?;

        // Start peer discovery
        self.start_peer_discovery().await?;

        *self.status.write().await = TransportStatus::Active;
        tracing::info!("Local network transport started on {}", self.local_address);

        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        *self.status.write().await = TransportStatus::Stopping;

        // Stop discovery
        if let Some(handle) = self.discovery_handle.take() {
            handle.abort();
        }

        // Stop mDNS
        if let Some(handle) = self.mdns_handle.take() {
            handle.abort();
        }

        // Close all connections
        {
            let mut connections = self.peer_connections.write().await;
            connections.clear();
        }

        {
            let mut peers = self.connected_peers.write().await;
            peers.clear();
        }

        *self.status.write().await = TransportStatus::Inactive;
        tracing::info!("Local network transport stopped");

        Ok(())
    }

    async fn send_to_peer(&self, peer_id: &str, message: &ReceivedMessage) -> Result<()> {
        let connections = self.peer_connections.read().await;

        if let Some(stream) = connections.get(peer_id) {
            let message_data =
                bincode::serialize(message).map_err(|e| BitChatError::Serialization(e))?;

            use tokio::io::AsyncWriteExt;
            let mut stream = stream;
            stream
                .write_all(&message_data)
                .await
                .map_err(|e| BitChatError::Transport(format!("Failed to send message: {}", e)))?;

            let mut stats = self.stats.write().await;
            stats.messages_sent += 1;
            stats.bytes_sent += message_data.len() as u64;

            Ok(())
        } else {
            Err(BitChatError::Transport(format!(
                "Peer {} not connected",
                peer_id
            )))
        }
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
        // Local network transport handles topics through message routing
        tracing::info!("Subscribed to topic: {}", topic);
        Ok(())
    }

    async fn unsubscribe_topic(&self, topic: &str) -> Result<()> {
        tracing::info!("Unsubscribed from topic: {}", topic);
        Ok(())
    }

    async fn publish_to_topic(&self, topic: &str, message: &ReceivedMessage) -> Result<()> {
        // Broadcast to all connected peers
        let connections = self.peer_connections.read().await;
        let mut sent_count = 0;

        for (peer_id, stream) in connections.iter() {
            let mut topic_message = message.clone();
            topic_message.topic = Some(topic.to_string());

            if let Ok(message_data) = bincode::serialize(&topic_message) {
                use tokio::io::AsyncWriteExt;
                let mut stream = stream;
                if stream.write_all(&message_data).await.is_ok() {
                    sent_count += 1;
                }
            }
        }

        if sent_count > 0 {
            let mut stats = self.stats.write().await;
            stats.messages_sent += sent_count;
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
        TransportType::LocalNetwork
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
        let addr: SocketAddr = peer_address
            .parse()
            .map_err(|e| BitChatError::Transport(format!("Invalid address format: {}", e)))?;

        let stream = TcpStream::connect(addr)
            .await
            .map_err(|e| BitChatError::Transport(format!("Failed to connect to peer: {}", e)))?;

        // Send handshake
        let handshake = HandshakeMessage {
            peer_id: self.local_peer_id.clone(),
            version: "1.0.0".to_string(),
            capabilities: vec!["messaging".to_string(), "file_transfer".to_string()],
        };

        let handshake_data =
            bincode::serialize(&handshake).map_err(|e| BitChatError::Serialization(e))?;

        Self::send_handshake(&stream, &handshake_data).await?;

        let peer_id = Uuid::new_v4().to_string();

        // Store connection
        {
            let mut connections = self.peer_connections.write().await;
            connections.insert(peer_id.clone(), stream);
        }

        Ok(peer_id)
    }

    async fn disconnect_peer(&self, peer_id: &str) -> Result<()> {
        let mut connections = self.peer_connections.write().await;
        connections.remove(peer_id);

        let mut peers = self.connected_peers.write().await;
        peers.remove(peer_id);

        Ok(())
    }

    async fn local_address(&self) -> Result<String> {
        Ok(self.local_address.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::BitChatConfig;

    #[tokio::test]
    async fn test_local_network_transport_creation() {
        let config = BitChatConfig::development();
        let transport = LocalNetworkTransport::new(config).await.unwrap();

        assert_eq!(transport.transport_type(), TransportType::LocalNetwork);
        assert_eq!(transport.status().await, TransportStatus::Inactive);
    }

    #[tokio::test]
    async fn test_handshake_serialization() {
        let handshake = HandshakeMessage {
            peer_id: "test-peer".to_string(),
            version: "1.0.0".to_string(),
            capabilities: vec!["messaging".to_string()],
        };

        let serialized = bincode::serialize(&handshake).unwrap();
        let deserialized: HandshakeMessage = bincode::deserialize(&serialized).unwrap();

        assert_eq!(handshake.peer_id, deserialized.peer_id);
        assert_eq!(handshake.version, deserialized.version);
        assert_eq!(handshake.capabilities, deserialized.capabilities);
    }

    #[tokio::test]
    async fn test_network_interface_detection() {
        let config = BitChatConfig::development();
        let transport = LocalNetworkTransport::new(config).await.unwrap();

        let interfaces = transport.get_network_interfaces().await.unwrap();
        assert!(!interfaces.is_empty());
    }
}
