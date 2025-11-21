//! WASM bindings for BitChat-QuDAG integration

use js_sys::{Array, Object, Promise, Uint8Array};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;
use web_sys::{console, BinaryType, CloseEvent, ErrorEvent, MessageEvent, WebSocket};

use crate::{
    crypto::CryptoMode,
    error::{BitChatError, Result},
    transport::TransportType,
    BitChatConfig, BitChatMessaging, MessagingStats, PeerInfo, QuDAGMessaging, ReceivedMessage,
};

/// WASM-compatible BitChat messaging interface
#[wasm_bindgen]
pub struct BitChatWasm {
    inner: Arc<Mutex<Option<BitChatMessaging>>>,
    config: BitChatConfig,
    websockets: Arc<Mutex<HashMap<String, WebSocket>>>,
    message_handlers: Arc<Mutex<HashMap<String, js_sys::Function>>>,
}

/// WASM-compatible message structure
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmMessage {
    id: String,
    sender: String,
    recipient: String,
    topic: Option<String>,
    data: Vec<u8>,
    timestamp: u64,
    is_ephemeral: bool,
}

/// WASM-compatible peer info structure
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmPeerInfo {
    id: String,
    address: String,
    transport: String,
    connected_at: u64,
    last_seen: u64,
    latency_ms: Option<f64>,
}

/// WASM-compatible statistics structure
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmStats {
    messages_sent: u64,
    messages_received: u64,
    bytes_sent: u64,
    bytes_received: u64,
    connected_peers: u32,
    active_subscriptions: u32,
    compression_ratio: f64,
    average_latency: f64,
    error_count: u64,
    uptime: u64,
}

/// WASM-compatible configuration structure
#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmConfig {
    enabled: bool,
    crypto_mode: String,
    compression: bool,
    ephemeral_messages: bool,
    max_message_size: u32,
    max_peers: u32,
    bind_address: String,
    listen_port: u16,
}

#[wasm_bindgen]
impl BitChatWasm {
    /// Create a new BitChat WASM instance
    #[wasm_bindgen(constructor)]
    pub fn new(config_json: &str) -> Result<BitChatWasm, JsValue> {
        console_error_panic_hook::set_once();

        console::log_1(&"Initializing BitChat WASM".into());

        let config: BitChatConfig = serde_json::from_str(config_json)
            .map_err(|e| JsValue::from_str(&format!("Config parse error: {}", e)))?;

        // Validate WASM-specific configuration
        let wasm_config = Self::validate_wasm_config(&config)?;

        Ok(BitChatWasm {
            inner: Arc::new(Mutex::new(None)),
            config: wasm_config,
            websockets: Arc::new(Mutex::new(HashMap::new())),
            message_handlers: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Initialize the messaging system
    #[wasm_bindgen]
    pub fn init(&mut self) -> Promise {
        let inner = self.inner.clone();
        let config = self.config.clone();

        wasm_bindgen_futures::future_to_promise(async move {
            match BitChatMessaging::new(config).await {
                Ok(mut messaging) => match messaging.start().await {
                    Ok(()) => {
                        *inner.lock().unwrap() = Some(messaging);
                        Ok(JsValue::UNDEFINED)
                    }
                    Err(e) => Err(JsValue::from_str(&format!("Start error: {}", e))),
                },
                Err(e) => Err(JsValue::from_str(&format!("Init error: {}", e))),
            }
        })
    }

    /// Send a message to a peer
    #[wasm_bindgen]
    pub fn send_message(&self, peer_id: &str, message: &[u8]) -> Promise {
        let inner = self.inner.clone();
        let peer_id = peer_id.to_string();
        let message = message.to_vec();

        wasm_bindgen_futures::future_to_promise(async move {
            match inner.lock().unwrap().as_ref() {
                Some(messaging) => match messaging.send_message(&peer_id, &message).await {
                    Ok(()) => Ok(JsValue::UNDEFINED),
                    Err(e) => Err(JsValue::from_str(&format!("Send error: {}", e))),
                },
                None => Err(JsValue::from_str("BitChat not initialized")),
            }
        })
    }

    /// Receive a message
    #[wasm_bindgen]
    pub fn receive_message(&self) -> Promise {
        let inner = self.inner.clone();

        wasm_bindgen_futures::future_to_promise(async move {
            match inner.lock().unwrap().as_ref() {
                Some(messaging) => match messaging.receive_message().await {
                    Ok(Some(message)) => {
                        let wasm_message = Self::convert_message_to_wasm(&message)?;
                        let js_message = JsValue::from_serde(&wasm_message).map_err(|e| {
                            JsValue::from_str(&format!("Serialization error: {}", e))
                        })?;
                        Ok(js_message)
                    }
                    Ok(None) => Ok(JsValue::NULL),
                    Err(e) => Err(JsValue::from_str(&format!("Receive error: {}", e))),
                },
                None => Err(JsValue::from_str("BitChat not initialized")),
            }
        })
    }

    /// Subscribe to a topic
    #[wasm_bindgen]
    pub fn subscribe_topic(&self, topic: &str) -> Promise {
        let inner = self.inner.clone();
        let topic = topic.to_string();

        wasm_bindgen_futures::future_to_promise(async move {
            match inner.lock().unwrap().as_ref() {
                Some(messaging) => match messaging.subscribe_topic(&topic).await {
                    Ok(()) => Ok(JsValue::UNDEFINED),
                    Err(e) => Err(JsValue::from_str(&format!("Subscribe error: {}", e))),
                },
                None => Err(JsValue::from_str("BitChat not initialized")),
            }
        })
    }

    /// Unsubscribe from a topic
    #[wasm_bindgen]
    pub fn unsubscribe_topic(&self, topic: &str) -> Promise {
        let inner = self.inner.clone();
        let topic = topic.to_string();

        wasm_bindgen_futures::future_to_promise(async move {
            match inner.lock().unwrap().as_ref() {
                Some(messaging) => match messaging.unsubscribe_topic(&topic).await {
                    Ok(()) => Ok(JsValue::UNDEFINED),
                    Err(e) => Err(JsValue::from_str(&format!("Unsubscribe error: {}", e))),
                },
                None => Err(JsValue::from_str("BitChat not initialized")),
            }
        })
    }

    /// Publish a message to a topic
    #[wasm_bindgen]
    pub fn publish_message(&self, topic: &str, message: &[u8]) -> Promise {
        let inner = self.inner.clone();
        let topic = topic.to_string();
        let message = message.to_vec();

        wasm_bindgen_futures::future_to_promise(async move {
            match inner.lock().unwrap().as_ref() {
                Some(messaging) => match messaging.publish_message(&topic, &message).await {
                    Ok(()) => Ok(JsValue::UNDEFINED),
                    Err(e) => Err(JsValue::from_str(&format!("Publish error: {}", e))),
                },
                None => Err(JsValue::from_str("BitChat not initialized")),
            }
        })
    }

    /// Get connected peers
    #[wasm_bindgen]
    pub fn get_connected_peers(&self) -> Promise {
        let inner = self.inner.clone();

        wasm_bindgen_futures::future_to_promise(async move {
            match inner.lock().unwrap().as_ref() {
                Some(messaging) => match messaging.get_connected_peers().await {
                    Ok(peers) => {
                        let wasm_peers: Vec<WasmPeerInfo> = peers
                            .into_iter()
                            .map(|p| Self::convert_peer_to_wasm(&p))
                            .collect();

                        let js_peers = JsValue::from_serde(&wasm_peers).map_err(|e| {
                            JsValue::from_str(&format!("Serialization error: {}", e))
                        })?;
                        Ok(js_peers)
                    }
                    Err(e) => Err(JsValue::from_str(&format!("Get peers error: {}", e))),
                },
                None => Err(JsValue::from_str("BitChat not initialized")),
            }
        })
    }

    /// Get local peer ID
    #[wasm_bindgen]
    pub fn get_local_peer_id(&self) -> Result<String, JsValue> {
        match self.inner.lock().unwrap().as_ref() {
            Some(messaging) => Ok(messaging.local_peer_id()),
            None => Err(JsValue::from_str("BitChat not initialized")),
        }
    }

    /// Check if peer is connected
    #[wasm_bindgen]
    pub fn is_peer_connected(&self, peer_id: &str) -> Promise {
        let inner = self.inner.clone();
        let peer_id = peer_id.to_string();

        wasm_bindgen_futures::future_to_promise(async move {
            match inner.lock().unwrap().as_ref() {
                Some(messaging) => match messaging.is_peer_connected(&peer_id).await {
                    Ok(connected) => Ok(JsValue::from_bool(connected)),
                    Err(e) => Err(JsValue::from_str(&format!("Check peer error: {}", e))),
                },
                None => Err(JsValue::from_str("BitChat not initialized")),
            }
        })
    }

    /// Get messaging statistics
    #[wasm_bindgen]
    pub fn get_stats(&self) -> Promise {
        let inner = self.inner.clone();

        wasm_bindgen_futures::future_to_promise(async move {
            match inner.lock().unwrap().as_ref() {
                Some(messaging) => match messaging.get_stats().await {
                    Ok(stats) => {
                        let wasm_stats = Self::convert_stats_to_wasm(&stats);
                        let js_stats = JsValue::from_serde(&wasm_stats).map_err(|e| {
                            JsValue::from_str(&format!("Serialization error: {}", e))
                        })?;
                        Ok(js_stats)
                    }
                    Err(e) => Err(JsValue::from_str(&format!("Get stats error: {}", e))),
                },
                None => Err(JsValue::from_str("BitChat not initialized")),
            }
        })
    }

    /// Connect to a peer
    #[wasm_bindgen]
    pub fn connect_peer(&self, peer_address: &str) -> Promise {
        let inner = self.inner.clone();
        let peer_address = peer_address.to_string();

        wasm_bindgen_futures::future_to_promise(async move {
            match inner.lock().unwrap().as_ref() {
                Some(messaging) => match messaging.connect_peer(&peer_address).await {
                    Ok(peer_id) => Ok(JsValue::from_str(&peer_id)),
                    Err(e) => Err(JsValue::from_str(&format!("Connect error: {}", e))),
                },
                None => Err(JsValue::from_str("BitChat not initialized")),
            }
        })
    }

    /// Disconnect from a peer
    #[wasm_bindgen]
    pub fn disconnect_peer(&self, peer_id: &str) -> Promise {
        let inner = self.inner.clone();
        let peer_id = peer_id.to_string();

        wasm_bindgen_futures::future_to_promise(async move {
            match inner.lock().unwrap().as_ref() {
                Some(messaging) => match messaging.disconnect_peer(&peer_id).await {
                    Ok(()) => Ok(JsValue::UNDEFINED),
                    Err(e) => Err(JsValue::from_str(&format!("Disconnect error: {}", e))),
                },
                None => Err(JsValue::from_str("BitChat not initialized")),
            }
        })
    }

    /// Stop the messaging system
    #[wasm_bindgen]
    pub fn stop(&self) -> Promise {
        let inner = self.inner.clone();

        wasm_bindgen_futures::future_to_promise(async move {
            match inner.lock().unwrap().as_mut() {
                Some(messaging) => match messaging.stop().await {
                    Ok(()) => {
                        *inner.lock().unwrap() = None;
                        Ok(JsValue::UNDEFINED)
                    }
                    Err(e) => Err(JsValue::from_str(&format!("Stop error: {}", e))),
                },
                None => Ok(JsValue::UNDEFINED),
            }
        })
    }

    /// Set message handler for incoming messages
    #[wasm_bindgen]
    pub fn set_message_handler(&self, handler: &js_sys::Function) -> Result<(), JsValue> {
        let mut handlers = self.message_handlers.lock().unwrap();
        handlers.insert("message".to_string(), handler.clone());
        Ok(())
    }

    /// Set connection handler for peer connections
    #[wasm_bindgen]
    pub fn set_connection_handler(&self, handler: &js_sys::Function) -> Result<(), JsValue> {
        let mut handlers = self.message_handlers.lock().unwrap();
        handlers.insert("connection".to_string(), handler.clone());
        Ok(())
    }

    /// Set error handler for errors
    #[wasm_bindgen]
    pub fn set_error_handler(&self, handler: &js_sys::Function) -> Result<(), JsValue> {
        let mut handlers = self.message_handlers.lock().unwrap();
        handlers.insert("error".to_string(), handler.clone());
        Ok(())
    }

    /// Connect WebSocket for direct peer communication
    #[wasm_bindgen]
    pub fn connect_websocket(&self, peer_id: &str, url: &str) -> Promise {
        let websockets = self.websockets.clone();
        let peer_id = peer_id.to_string();
        let url = url.to_string();

        wasm_bindgen_futures::future_to_promise(async move {
            match Self::create_websocket(&peer_id, &url).await {
                Ok(ws) => {
                    websockets.lock().unwrap().insert(peer_id, ws);
                    Ok(JsValue::UNDEFINED)
                }
                Err(e) => Err(e),
            }
        })
    }

    /// Disconnect WebSocket
    #[wasm_bindgen]
    pub fn disconnect_websocket(&self, peer_id: &str) -> Result<(), JsValue> {
        let mut websockets = self.websockets.lock().unwrap();
        if let Some(ws) = websockets.remove(peer_id) {
            ws.close()
                .map_err(|e| JsValue::from_str(&format!("Close error: {:?}", e)))?;
        }
        Ok(())
    }

    /// Get library information
    #[wasm_bindgen]
    pub fn get_library_info(&self) -> Result<JsValue, JsValue> {
        let info = crate::info();
        JsValue::from_serde(&info)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    // Helper methods
    fn validate_wasm_config(config: &BitChatConfig) -> Result<BitChatConfig, JsValue> {
        let mut wasm_config = config.clone();

        // Ensure WebSocket transport is enabled for WASM
        if !wasm_config.transports.contains(&TransportType::WebSocket) {
            wasm_config.transports.push(TransportType::WebSocket);
        }

        // Disable features not supported in WASM
        wasm_config.store_forward = false;
        wasm_config.cover_traffic = false;
        wasm_config.emergency_wipe = false;

        // Validate configuration
        wasm_config
            .validate()
            .map_err(|e| JsValue::from_str(&format!("Config validation error: {}", e)))?;

        Ok(wasm_config)
    }

    fn convert_message_to_wasm(message: &ReceivedMessage) -> Result<WasmMessage, JsValue> {
        let timestamp = message
            .timestamp
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Ok(WasmMessage {
            id: message.id.clone(),
            sender: message.sender.clone(),
            recipient: message.recipient.clone(),
            topic: message.topic.clone(),
            data: message.data.clone(),
            timestamp,
            is_ephemeral: message.is_ephemeral,
        })
    }

    fn convert_peer_to_wasm(peer: &PeerInfo) -> WasmPeerInfo {
        let connected_at = peer
            .connected_at
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let last_seen = peer
            .last_seen
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        WasmPeerInfo {
            id: peer.id.clone(),
            address: peer.address.clone(),
            transport: peer.transport.clone(),
            connected_at,
            last_seen,
            latency_ms: peer.latency_ms,
        }
    }

    fn convert_stats_to_wasm(stats: &MessagingStats) -> WasmStats {
        WasmStats {
            messages_sent: stats.messages_sent,
            messages_received: stats.messages_received,
            bytes_sent: stats.bytes_sent,
            bytes_received: stats.bytes_received,
            connected_peers: stats.connected_peers as u32,
            active_subscriptions: stats.active_subscriptions as u32,
            compression_ratio: stats.compression_ratio,
            average_latency: stats.average_latency,
            error_count: stats.error_count,
            uptime: stats.uptime,
        }
    }

    async fn create_websocket(peer_id: &str, url: &str) -> Result<WebSocket, JsValue> {
        let ws = WebSocket::new(url)?;
        ws.set_binary_type(BinaryType::Arraybuffer);

        // Set up event handlers
        let onopen_callback = Closure::wrap(Box::new(move |_event: web_sys::Event| {
            console::log_1(&format!("WebSocket connected to {}", peer_id).into());
        }) as Box<dyn FnMut(_)>);

        let onmessage_callback = Closure::wrap(Box::new(move |event: MessageEvent| {
            if let Ok(abuf) = event.data().dyn_into::<js_sys::ArrayBuffer>() {
                let array = Uint8Array::new(&abuf);
                let data = array.to_vec();
                console::log_1(&format!("Received {} bytes from {}", data.len(), peer_id).into());
                // Handle message data
            }
        }) as Box<dyn FnMut(MessageEvent)>);

        let onerror_callback = Closure::wrap(Box::new(move |event: ErrorEvent| {
            console::error_1(&format!("WebSocket error: {:?}", event).into());
        }) as Box<dyn FnMut(ErrorEvent)>);

        let onclose_callback = Closure::wrap(Box::new(move |event: CloseEvent| {
            console::log_1(
                &format!("WebSocket closed: {} {}", event.code(), event.reason()).into(),
            );
        }) as Box<dyn FnMut(CloseEvent)>);

        ws.set_onopen(Some(onopen_callback.as_ref().unchecked_ref()));
        ws.set_onmessage(Some(onmessage_callback.as_ref().unchecked_ref()));
        ws.set_onerror(Some(onerror_callback.as_ref().unchecked_ref()));
        ws.set_onclose(Some(onclose_callback.as_ref().unchecked_ref()));

        // Keep closures alive
        onopen_callback.forget();
        onmessage_callback.forget();
        onerror_callback.forget();
        onclose_callback.forget();

        Ok(ws)
    }
}

// WASM-specific utility functions
#[wasm_bindgen]
pub fn init_logging() {
    console_error_panic_hook::set_once();
    tracing_wasm::set_as_global_default();
}

#[wasm_bindgen]
pub fn get_version() -> String {
    crate::VERSION.to_string()
}

#[wasm_bindgen]
pub fn is_wasm_supported() -> bool {
    true
}

#[wasm_bindgen]
pub fn create_default_config() -> Result<JsValue, JsValue> {
    let config = BitChatConfig::wasm();
    JsValue::from_serde(&config)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn validate_config(config_json: &str) -> Result<bool, JsValue> {
    let config: BitChatConfig = serde_json::from_str(config_json)
        .map_err(|e| JsValue::from_str(&format!("Config parse error: {}", e)))?;

    config
        .validate()
        .map_err(|e| JsValue::from_str(&format!("Config validation error: {}", e)))?;

    Ok(true)
}

// Type definitions for TypeScript
#[wasm_bindgen(typescript_custom_section)]
const TYPESCRIPT_INTERFACE: &'static str = r#"
export interface WasmMessage {
    id: string;
    sender: string;
    recipient: string;
    topic?: string;
    data: Uint8Array;
    timestamp: number;
    is_ephemeral: boolean;
}

export interface WasmPeerInfo {
    id: string;
    address: string;
    transport: string;
    connected_at: number;
    last_seen: number;
    latency_ms?: number;
}

export interface WasmStats {
    messages_sent: number;
    messages_received: number;
    bytes_sent: number;
    bytes_received: number;
    connected_peers: number;
    active_subscriptions: number;
    compression_ratio: number;
    average_latency: number;
    error_count: number;
    uptime: number;
}

export interface WasmConfig {
    enabled: boolean;
    crypto_mode: string;
    compression: boolean;
    ephemeral_messages: boolean;
    max_message_size: number;
    max_peers: number;
    bind_address: string;
    listen_port: number;
}

export interface BitChatWasm {
    new(config_json: string): BitChatWasm;
    init(): Promise<void>;
    send_message(peer_id: string, message: Uint8Array): Promise<void>;
    receive_message(): Promise<WasmMessage | null>;
    subscribe_topic(topic: string): Promise<void>;
    unsubscribe_topic(topic: string): Promise<void>;
    publish_message(topic: string, message: Uint8Array): Promise<void>;
    get_connected_peers(): Promise<WasmPeerInfo[]>;
    get_local_peer_id(): string;
    is_peer_connected(peer_id: string): Promise<boolean>;
    get_stats(): Promise<WasmStats>;
    connect_peer(peer_address: string): Promise<string>;
    disconnect_peer(peer_id: string): Promise<void>;
    stop(): Promise<void>;
    set_message_handler(handler: (message: WasmMessage) => void): void;
    set_connection_handler(handler: (peer: WasmPeerInfo) => void): void;
    set_error_handler(handler: (error: string) => void): void;
    connect_websocket(peer_id: string, url: string): Promise<void>;
    disconnect_websocket(peer_id: string): void;
    get_library_info(): any;
}
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_wasm_config_creation() {
        let config = r#"{"enabled": true, "crypto_mode": "Traditional", "compression": true}"#;
        let bitchat = BitChatWasm::new(config);
        assert!(bitchat.is_ok());
    }

    #[wasm_bindgen_test]
    fn test_version() {
        let version = get_version();
        assert!(!version.is_empty());
    }

    #[wasm_bindgen_test]
    fn test_wasm_support() {
        assert!(is_wasm_supported());
    }

    #[wasm_bindgen_test]
    fn test_default_config() {
        let config = create_default_config();
        assert!(config.is_ok());
    }

    #[wasm_bindgen_test]
    fn test_config_validation() {
        let config = r#"{"enabled": true, "crypto_mode": "Traditional", "compression": true}"#;
        let result = validate_config(config);
        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[wasm_bindgen_test]
    async fn test_basic_lifecycle() {
        let config = r#"{"enabled": true, "crypto_mode": "Traditional", "compression": true}"#;
        let mut bitchat = BitChatWasm::new(config).unwrap();

        // Test initialization
        let init_result = wasm_bindgen_futures::JsFuture::from(bitchat.init()).await;
        assert!(init_result.is_ok());

        // Test getting peer ID
        let peer_id = bitchat.get_local_peer_id();
        assert!(peer_id.is_ok());
        assert!(!peer_id.unwrap().is_empty());

        // Test stopping
        let stop_result = wasm_bindgen_futures::JsFuture::from(bitchat.stop()).await;
        assert!(stop_result.is_ok());
    }
}
