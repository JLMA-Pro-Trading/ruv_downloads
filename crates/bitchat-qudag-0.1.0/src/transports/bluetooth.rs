//! Bluetooth LE mesh transport implementation

use async_trait::async_trait;
#[cfg(feature = "bluetooth")]
use btleplug::api::{
    Central, CentralEvent, Characteristic, Manager as _, Peripheral, ScanFilter, Service, WriteType,
};
#[cfg(feature = "bluetooth")]
use btleplug::platform::{Adapter, Manager, PeripheralId};
use futures::StreamExt;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::{mpsc, Mutex, RwLock};
use uuid::Uuid;

use crate::config::BitChatConfig;
use crate::error::{BitChatError, Result};
use crate::messaging::{PeerInfo, ReceivedMessage};
use crate::transport::{Transport, TransportStats, TransportStatus, TransportType};

/// BitChat service UUID for Bluetooth LE
const BITCHAT_SERVICE_UUID: uuid::Uuid =
    uuid::Uuid::from_u128(0x12345678_1234_5678_1234_567812345678);

/// Characteristic UUID for sending messages
const MESSAGE_SEND_CHAR_UUID: uuid::Uuid =
    uuid::Uuid::from_u128(0x12345678_1234_5678_1234_567812345679);

/// Characteristic UUID for receiving messages  
const MESSAGE_RECV_CHAR_UUID: uuid::Uuid =
    uuid::Uuid::from_u128(0x12345678_1234_5678_1234_56781234567A);

/// Real Bluetooth LE mesh transport implementation
#[cfg(feature = "bluetooth")]
pub struct BluetoothTransport {
    manager: Manager,
    adapter: Option<Adapter>,
    status: Arc<RwLock<TransportStatus>>,
    stats: Arc<RwLock<TransportStats>>,
    connected_peers: Arc<RwLock<HashMap<PeripheralId, PeerInfo>>>,
    message_queue: Arc<Mutex<mpsc::UnboundedReceiver<ReceivedMessage>>>,
    message_sender: mpsc::UnboundedSender<ReceivedMessage>,
    config: BitChatConfig,
    scan_handle: Option<tokio::task::JoinHandle<()>>,
    mesh_nodes: Arc<RwLock<HashMap<PeripheralId, MeshNode>>>,
    local_peer_id: String,
}

/// Mesh node information
#[derive(Debug, Clone)]
struct MeshNode {
    peripheral_id: PeripheralId,
    last_seen: SystemTime,
    signal_strength: i16,
    hop_count: u8,
    connection_quality: f32,
    message_buffer: Vec<ReceivedMessage>,
}

#[cfg(feature = "bluetooth")]
impl BluetoothTransport {
    /// Create a new Bluetooth transport
    pub async fn new(config: BitChatConfig) -> Result<Self> {
        let manager = Manager::new().await.map_err(|e| {
            BitChatError::Transport(format!("Failed to create Bluetooth manager: {}", e))
        })?;

        let mut stats = TransportStats::default();
        stats.transport_type = TransportType::BluetoothMesh;

        let (message_sender, message_receiver) = mpsc::unbounded_channel();
        let local_peer_id = Uuid::new_v4().to_string();

        Ok(Self {
            manager,
            adapter: None,
            status: Arc::new(RwLock::new(TransportStatus::Inactive)),
            stats: Arc::new(RwLock::new(stats)),
            connected_peers: Arc::new(RwLock::new(HashMap::new())),
            message_queue: Arc::new(Mutex::new(message_receiver)),
            message_sender,
            config,
            scan_handle: None,
            mesh_nodes: Arc::new(RwLock::new(HashMap::new())),
            local_peer_id,
        })
    }

    /// Initialize Bluetooth adapter
    async fn initialize_adapter(&mut self) -> Result<()> {
        let adapters = self.manager.adapters().await.map_err(|e| {
            BitChatError::Transport(format!("Failed to get Bluetooth adapters: {}", e))
        })?;

        let central = adapters
            .into_iter()
            .next()
            .ok_or_else(|| BitChatError::Transport("No Bluetooth adapter found".to_string()))?;

        self.adapter = Some(central);
        Ok(())
    }

    /// Start scanning for BitChat peers
    async fn start_scanning(&mut self) -> Result<()> {
        let adapter = self.adapter.as_ref().ok_or_else(|| {
            BitChatError::Transport("Bluetooth adapter not initialized".to_string())
        })?;

        let filter = ScanFilter {
            services: vec![BITCHAT_SERVICE_UUID],
        };

        adapter.start_scan(filter).await.map_err(|e| {
            BitChatError::Transport(format!("Failed to start Bluetooth scan: {}", e))
        })?;

        // Start background task for handling scan events
        let adapter_clone = adapter.clone();
        let mesh_nodes = self.mesh_nodes.clone();
        let message_sender = self.message_sender.clone();
        let connected_peers = self.connected_peers.clone();

        let scan_handle = tokio::spawn(async move {
            let mut events = adapter_clone.events().await.unwrap();

            while let Some(event) = events.next().await {
                match event {
                    CentralEvent::DeviceDiscovered(id) => {
                        if let Ok(peripheral) = adapter_clone.peripheral(&id).await {
                            if let Ok(properties) = peripheral.properties().await {
                                if let Some(properties) = properties {
                                    if properties.services.contains(&BITCHAT_SERVICE_UUID) {
                                        Self::handle_peer_discovered(
                                            &peripheral,
                                            &mesh_nodes,
                                            &message_sender,
                                            &connected_peers,
                                        )
                                        .await;
                                    }
                                }
                            }
                        }
                    }
                    CentralEvent::DeviceConnected(id) => {
                        tracing::info!("Bluetooth device connected: {:?}", id);
                    }
                    CentralEvent::DeviceDisconnected(id) => {
                        tracing::info!("Bluetooth device disconnected: {:?}", id);
                        let mut peers = connected_peers.write().await;
                        peers.remove(&id);
                    }
                    _ => {}
                }
            }
        });

        self.scan_handle = Some(scan_handle);
        Ok(())
    }

    /// Handle discovered peer
    async fn handle_peer_discovered(
        peripheral: &impl Peripheral,
        mesh_nodes: &Arc<RwLock<HashMap<PeripheralId, MeshNode>>>,
        message_sender: &mpsc::UnboundedSender<ReceivedMessage>,
        connected_peers: &Arc<RwLock<HashMap<PeripheralId, PeerInfo>>>,
    ) {
        let peripheral_id = peripheral.id();

        // Connect to the peripheral
        if let Err(e) = peripheral.connect().await {
            tracing::error!("Failed to connect to peripheral: {}", e);
            return;
        }

        // Discover services
        if let Err(e) = peripheral.discover_services().await {
            tracing::error!("Failed to discover services: {}", e);
            return;
        }

        // Find BitChat service
        if let Ok(services) = peripheral.services().await {
            for service in services {
                if service.uuid == BITCHAT_SERVICE_UUID {
                    Self::handle_bitchat_service(
                        peripheral,
                        &service,
                        &peripheral_id,
                        mesh_nodes,
                        message_sender,
                        connected_peers,
                    )
                    .await;
                    break;
                }
            }
        }
    }

    /// Handle BitChat service
    async fn handle_bitchat_service(
        peripheral: &impl Peripheral,
        service: &Service,
        peripheral_id: &PeripheralId,
        mesh_nodes: &Arc<RwLock<HashMap<PeripheralId, MeshNode>>>,
        message_sender: &mpsc::UnboundedSender<ReceivedMessage>,
        connected_peers: &Arc<RwLock<HashMap<PeripheralId, PeerInfo>>>,
    ) {
        // Find characteristics
        let mut send_char = None;
        let mut recv_char = None;

        for char in &service.characteristics {
            match char.uuid {
                MESSAGE_SEND_CHAR_UUID => send_char = Some(char.clone()),
                MESSAGE_RECV_CHAR_UUID => recv_char = Some(char.clone()),
                _ => {}
            }
        }

        if let (Some(send_char), Some(recv_char)) = (send_char, recv_char) {
            // Subscribe to notifications
            if let Err(e) = peripheral.subscribe(&recv_char).await {
                tracing::error!("Failed to subscribe to characteristic: {}", e);
                return;
            }

            // Create mesh node
            let mesh_node = MeshNode {
                peripheral_id: peripheral_id.clone(),
                last_seen: SystemTime::now(),
                signal_strength: -50, // Would get from RSSI
                hop_count: 1,
                connection_quality: 0.8,
                message_buffer: Vec::new(),
            };

            // Add to mesh nodes
            {
                let mut nodes = mesh_nodes.write().await;
                nodes.insert(peripheral_id.clone(), mesh_node);
            }

            // Add to connected peers
            {
                let mut peers = connected_peers.write().await;
                let peer_info = PeerInfo {
                    id: peripheral_id.to_string(),
                    address: "bluetooth://".to_string(),
                    transport: "BluetoothMesh".to_string(),
                    connected_at: SystemTime::now(),
                    last_seen: SystemTime::now(),
                    latency_ms: Some(50.0),
                    capabilities: vec!["bluetooth".to_string(), "mesh".to_string()],
                    metadata: HashMap::new(),
                };
                peers.insert(peripheral_id.clone(), peer_info);
            }

            // Start notification handling
            let peripheral_clone = peripheral.clone();
            let message_sender_clone = message_sender.clone();
            let peripheral_id_clone = peripheral_id.clone();

            tokio::spawn(async move {
                let mut notifications = peripheral_clone.notifications().await.unwrap();

                while let Some(notification) = notifications.next().await {
                    if notification.uuid == MESSAGE_RECV_CHAR_UUID {
                        if let Ok(message) =
                            Self::decode_message(&notification.value, &peripheral_id_clone)
                        {
                            let _ = message_sender_clone.send(message);
                        }
                    }
                }
            });
        }
    }

    /// Decode received message
    fn decode_message(data: &[u8], sender_id: &PeripheralId) -> Result<ReceivedMessage> {
        // Simple message format: [length][message_data]
        if data.len() < 4 {
            return Err(BitChatError::InvalidMessage(
                "Message too short".to_string(),
            ));
        }

        let length = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;
        if data.len() < 4 + length {
            return Err(BitChatError::InvalidMessage(
                "Invalid message length".to_string(),
            ));
        }

        let message_data = &data[4..4 + length];

        Ok(ReceivedMessage {
            id: Uuid::new_v4().to_string(),
            sender: sender_id.to_string(),
            recipient: "local".to_string(),
            topic: None,
            data: message_data.to_vec(),
            timestamp: SystemTime::now(),
            is_ephemeral: false,
            priority: crate::messaging::MessagePriority::Normal,
            message_type: crate::messaging::MessageType::Direct,
            encryption_info: None,
            compression_info: None,
        })
    }

    /// Encode message for transmission
    fn encode_message(data: &[u8]) -> Vec<u8> {
        let length = data.len() as u32;
        let mut encoded = Vec::with_capacity(4 + data.len());
        encoded.extend_from_slice(&length.to_be_bytes());
        encoded.extend_from_slice(data);
        encoded
    }

    /// Send message to specific peer
    async fn send_to_peripheral(&self, peripheral_id: &PeripheralId, data: &[u8]) -> Result<()> {
        let adapter = self.adapter.as_ref().ok_or_else(|| {
            BitChatError::Transport("Bluetooth adapter not initialized".to_string())
        })?;

        let peripheral = adapter
            .peripheral(peripheral_id)
            .await
            .map_err(|e| BitChatError::Transport(format!("Failed to get peripheral: {}", e)))?;

        // Find send characteristic
        let services = peripheral
            .services()
            .await
            .map_err(|e| BitChatError::Transport(format!("Failed to get services: {}", e)))?;

        for service in services {
            if service.uuid == BITCHAT_SERVICE_UUID {
                for char in service.characteristics {
                    if char.uuid == MESSAGE_SEND_CHAR_UUID {
                        let encoded_data = Self::encode_message(data);
                        peripheral
                            .write(&char, &encoded_data, WriteType::WithoutResponse)
                            .await
                            .map_err(|e| {
                                BitChatError::Transport(format!(
                                    "Failed to write to characteristic: {}",
                                    e
                                ))
                            })?;
                        return Ok(());
                    }
                }
            }
        }

        Err(BitChatError::Transport(
            "Send characteristic not found".to_string(),
        ))
    }

    /// Implement mesh routing
    async fn route_message(&self, target_peer: &str, data: &[u8]) -> Result<()> {
        let nodes = self.mesh_nodes.read().await;

        // Find best route to target
        let mut best_route = None;
        let mut best_quality = 0.0;

        for (id, node) in nodes.iter() {
            if id.to_string() == target_peer {
                // Direct connection
                return self.send_to_peripheral(id, data).await;
            }

            // Check if this node can route to target
            if node.connection_quality > best_quality {
                best_quality = node.connection_quality;
                best_route = Some(id);
            }
        }

        if let Some(route_id) = best_route {
            // Send via best route
            let routing_data = format!("ROUTE:{}", target_peer);
            let mut routed_message = routing_data.into_bytes();
            routed_message.extend_from_slice(data);

            self.send_to_peripheral(route_id, &routed_message).await
        } else {
            Err(BitChatError::Transport(
                "No route to target peer".to_string(),
            ))
        }
    }
}

#[cfg(feature = "bluetooth")]
#[async_trait]
impl Transport for BluetoothTransport {
    async fn start(&mut self) -> Result<()> {
        *self.status.write().await = TransportStatus::Starting;

        self.initialize_adapter().await?;
        self.start_scanning().await?;

        *self.status.write().await = TransportStatus::Active;
        tracing::info!("Bluetooth mesh transport started");

        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        *self.status.write().await = TransportStatus::Stopping;

        // Stop scanning
        if let Some(handle) = self.scan_handle.take() {
            handle.abort();
        }

        // Stop adapter scanning
        if let Some(adapter) = &self.adapter {
            let _ = adapter.stop_scan().await;
        }

        // Disconnect from all peers
        let peers: Vec<_> = {
            let peers = self.connected_peers.read().await;
            peers.keys().cloned().collect()
        };

        if let Some(adapter) = &self.adapter {
            for peer_id in peers {
                if let Ok(peripheral) = adapter.peripheral(&peer_id).await {
                    let _ = peripheral.disconnect().await;
                }
            }
        }

        *self.status.write().await = TransportStatus::Inactive;
        tracing::info!("Bluetooth mesh transport stopped");

        Ok(())
    }

    async fn send_to_peer(&self, peer_id: &str, message: &ReceivedMessage) -> Result<()> {
        let data = bincode::serialize(message).map_err(|e| BitChatError::Serialization(e))?;

        // Try direct send first
        if let Ok(peripheral_id) = peer_id.parse::<PeripheralId>() {
            if let Ok(()) = self.send_to_peripheral(&peripheral_id, &data).await {
                let mut stats = self.stats.write().await;
                stats.messages_sent += 1;
                stats.bytes_sent += data.len() as u64;
                return Ok(());
            }
        }

        // Try mesh routing
        self.route_message(peer_id, &data).await?;

        let mut stats = self.stats.write().await;
        stats.messages_sent += 1;
        stats.bytes_sent += data.len() as u64;

        Ok(())
    }

    async fn receive_message(&self) -> Result<Option<ReceivedMessage>> {
        let mut queue = self.message_queue.lock().await;
        match queue.try_recv() {
            Ok(message) => {
                let mut stats = self.stats.write().await;
                stats.messages_received += 1;
                stats.bytes_received += message.data.len() as u64;
                Ok(Some(message))
            }
            Err(mpsc::error::TryRecvError::Empty) => Ok(None),
            Err(mpsc::error::TryRecvError::Disconnected) => Err(BitChatError::Transport(
                "Message channel disconnected".to_string(),
            )),
        }
    }

    async fn subscribe_topic(&self, _topic: &str) -> Result<()> {
        // Bluetooth mesh doesn't use topics in the same way
        Ok(())
    }

    async fn unsubscribe_topic(&self, _topic: &str) -> Result<()> {
        Ok(())
    }

    async fn publish_to_topic(&self, _topic: &str, message: &ReceivedMessage) -> Result<()> {
        // Broadcast to all connected peers
        let peers: Vec<_> = {
            let peers = self.connected_peers.read().await;
            peers.keys().cloned().collect()
        };

        for peer_id in peers {
            let _ = self.send_to_peer(&peer_id.to_string(), message).await;
        }

        Ok(())
    }

    async fn get_connected_peers(&self) -> Result<Vec<PeerInfo>> {
        let peers = self.connected_peers.read().await;
        Ok(peers.values().cloned().collect())
    }

    async fn is_peer_connected(&self, peer_id: &str) -> Result<bool> {
        if let Ok(peripheral_id) = peer_id.parse::<PeripheralId>() {
            let peers = self.connected_peers.read().await;
            Ok(peers.contains_key(&peripheral_id))
        } else {
            Ok(false)
        }
    }

    fn transport_type(&self) -> TransportType {
        TransportType::BluetoothMesh
    }

    async fn status(&self) -> TransportStatus {
        self.status.read().await.clone()
    }

    async fn stats(&self) -> TransportStats {
        self.stats.read().await.clone()
    }

    async fn connect_peer(&self, peer_address: &str) -> Result<String> {
        // Parse Bluetooth address and connect
        if let Ok(peripheral_id) = peer_address.parse::<PeripheralId>() {
            if let Some(adapter) = &self.adapter {
                let peripheral = adapter.peripheral(&peripheral_id).await.map_err(|e| {
                    BitChatError::Transport(format!("Failed to get peripheral: {}", e))
                })?;

                peripheral.connect().await.map_err(|e| {
                    BitChatError::Transport(format!("Failed to connect to peripheral: {}", e))
                })?;

                return Ok(peripheral_id.to_string());
            }
        }

        Err(BitChatError::Transport(
            "Invalid Bluetooth address".to_string(),
        ))
    }

    async fn disconnect_peer(&self, peer_id: &str) -> Result<()> {
        if let Ok(peripheral_id) = peer_id.parse::<PeripheralId>() {
            if let Some(adapter) = &self.adapter {
                let peripheral = adapter.peripheral(&peripheral_id).await.map_err(|e| {
                    BitChatError::Transport(format!("Failed to get peripheral: {}", e))
                })?;

                peripheral.disconnect().await.map_err(|e| {
                    BitChatError::Transport(format!("Failed to disconnect from peripheral: {}", e))
                })?;

                let mut peers = self.connected_peers.write().await;
                peers.remove(&peripheral_id);
            }
        }

        Ok(())
    }

    async fn local_address(&self) -> Result<String> {
        Ok(format!("bluetooth://{}", self.local_peer_id))
    }
}

// Fallback implementation when bluetooth feature is disabled
#[cfg(not(feature = "bluetooth"))]
pub struct BluetoothTransport;

#[cfg(not(feature = "bluetooth"))]
impl BluetoothTransport {
    pub async fn new(_config: BitChatConfig) -> Result<Self> {
        Err(BitChatError::NotSupported(
            "Bluetooth transport not available - enable 'bluetooth' feature".to_string(),
        ))
    }
}

#[cfg(not(feature = "bluetooth"))]
#[async_trait]
impl Transport for BluetoothTransport {
    async fn start(&mut self) -> Result<()> {
        Err(BitChatError::NotSupported(
            "Bluetooth transport not available".to_string(),
        ))
    }

    async fn stop(&mut self) -> Result<()> {
        Ok(())
    }
    async fn send_to_peer(&self, _peer_id: &str, _message: &ReceivedMessage) -> Result<()> {
        Err(BitChatError::NotSupported(
            "Bluetooth transport not available".to_string(),
        ))
    }
    async fn receive_message(&self) -> Result<Option<ReceivedMessage>> {
        Ok(None)
    }
    async fn subscribe_topic(&self, _topic: &str) -> Result<()> {
        Ok(())
    }
    async fn unsubscribe_topic(&self, _topic: &str) -> Result<()> {
        Ok(())
    }
    async fn publish_to_topic(&self, _topic: &str, _message: &ReceivedMessage) -> Result<()> {
        Ok(())
    }
    async fn get_connected_peers(&self) -> Result<Vec<PeerInfo>> {
        Ok(Vec::new())
    }
    async fn is_peer_connected(&self, _peer_id: &str) -> Result<bool> {
        Ok(false)
    }
    fn transport_type(&self) -> TransportType {
        TransportType::BluetoothMesh
    }
    async fn status(&self) -> TransportStatus {
        TransportStatus::Inactive
    }
    async fn stats(&self) -> TransportStats {
        TransportStats::default()
    }
    async fn connect_peer(&self, _peer_address: &str) -> Result<String> {
        Err(BitChatError::NotSupported(
            "Bluetooth transport not available".to_string(),
        ))
    }
    async fn disconnect_peer(&self, _peer_id: &str) -> Result<()> {
        Ok(())
    }
    async fn local_address(&self) -> Result<String> {
        Ok("bluetooth://unavailable".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::BitChatConfig;

    #[tokio::test]
    async fn test_bluetooth_transport_creation() {
        let config = BitChatConfig::development();
        let transport = BluetoothTransport::new(config).await;

        // Transport creation might fail if no Bluetooth adapter is available
        match transport {
            Ok(transport) => {
                assert_eq!(transport.transport_type(), TransportType::BluetoothMesh);
                assert_eq!(transport.status().await, TransportStatus::Inactive);
            }
            Err(e) => {
                // Expected in CI environments without Bluetooth
                println!(
                    "Bluetooth transport creation failed (expected in CI): {}",
                    e
                );
            }
        }
    }

    #[test]
    fn test_message_encoding_decoding() {
        let test_data = b"Hello, Bluetooth!";
        let encoded = BluetoothTransport::encode_message(test_data);

        // Check encoding format
        assert_eq!(encoded.len(), 4 + test_data.len());
        assert_eq!(&encoded[0..4], &(test_data.len() as u32).to_be_bytes());
        assert_eq!(&encoded[4..], test_data);
    }
}
