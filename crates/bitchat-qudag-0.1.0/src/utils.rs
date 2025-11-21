//! Utility functions for BitChat-QuDAG integration

use crate::config::BitChatConfig;
use crate::error::{BitChatError, Result};
use base64::{engine::general_purpose, Engine as _};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Compression utilities
pub mod compression {
    use super::*;

    /// Compress data using configured compression algorithm
    pub fn compress_data(data: &[u8], config: &BitChatConfig) -> Result<Vec<u8>> {
        if !config.compression {
            return Ok(data.to_vec());
        }

        #[cfg(feature = "compression")]
        {
            // Try LZ4 first
            if let Ok(compressed) = lz4::block::compress(data, None, true) {
                return Ok(compressed);
            }

            // Fall back to zstd
            match zstd::encode_all(data, 3) {
                Ok(compressed) => Ok(compressed),
                Err(e) => Err(BitChatError::Compression(format!(
                    "Compression failed: {}",
                    e
                ))),
            }
        }

        #[cfg(not(feature = "compression"))]
        {
            Ok(data.to_vec())
        }
    }

    /// Decompress data using configured compression algorithm
    pub fn decompress_data(data: &[u8], config: &BitChatConfig) -> Result<Vec<u8>> {
        if !config.compression {
            return Ok(data.to_vec());
        }

        #[cfg(feature = "compression")]
        {
            // Try LZ4 first
            if let Ok(decompressed) = lz4::block::decompress(data, None) {
                return Ok(decompressed);
            }

            // Fall back to zstd
            match zstd::decode_all(data) {
                Ok(decompressed) => Ok(decompressed),
                Err(e) => Err(BitChatError::Compression(format!(
                    "Decompression failed: {}",
                    e
                ))),
            }
        }

        #[cfg(not(feature = "compression"))]
        {
            Ok(data.to_vec())
        }
    }

    /// Calculate compression ratio
    pub fn compression_ratio(original_size: usize, compressed_size: usize) -> f64 {
        if original_size == 0 {
            return 1.0;
        }
        compressed_size as f64 / original_size as f64
    }

    /// Determine if data should be compressed
    pub fn should_compress(data: &[u8], config: &BitChatConfig) -> bool {
        config.compression && data.len() > config.compression_threshold
    }
}

/// Time utilities
pub mod time {
    use super::*;

    /// Get current Unix timestamp
    pub fn unix_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    /// Get current Unix timestamp in milliseconds
    pub fn unix_timestamp_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    /// Convert SystemTime to Unix timestamp
    pub fn system_time_to_unix(time: SystemTime) -> u64 {
        time.duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    /// Convert Unix timestamp to SystemTime
    pub fn unix_to_system_time(timestamp: u64) -> SystemTime {
        UNIX_EPOCH + Duration::from_secs(timestamp)
    }

    /// Check if time is expired
    pub fn is_expired(time: SystemTime, duration: Duration) -> bool {
        SystemTime::now() > time + duration
    }

    /// Get elapsed time since a point
    pub fn elapsed_since(time: SystemTime) -> Duration {
        SystemTime::now().duration_since(time).unwrap_or_default()
    }

    /// Format duration as human-readable string
    pub fn format_duration(duration: Duration) -> String {
        let secs = duration.as_secs();
        let mins = secs / 60;
        let hours = mins / 60;
        let days = hours / 24;

        if days > 0 {
            format!("{}d {}h {}m", days, hours % 24, mins % 60)
        } else if hours > 0 {
            format!("{}h {}m", hours, mins % 60)
        } else if mins > 0 {
            format!("{}m {}s", mins, secs % 60)
        } else {
            format!("{}s", secs)
        }
    }
}

/// Network utilities
pub mod network {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr, SocketAddr};

    /// Check if an IP address is local
    pub fn is_local_ip(ip: &IpAddr) -> bool {
        match ip {
            IpAddr::V4(ipv4) => ipv4.is_loopback() || ipv4.is_private() || ipv4.is_link_local(),
            IpAddr::V6(ipv6) => ipv6.is_loopback() || ipv6.is_multicast(),
        }
    }

    /// Parse socket address from string
    pub fn parse_socket_addr(addr: &str) -> Result<SocketAddr> {
        addr.parse()
            .map_err(|e| BitChatError::Network(format!("Invalid socket address '{}': {}", addr, e)))
    }

    /// Get local IP address
    pub fn get_local_ip() -> Result<IpAddr> {
        // For now, return localhost
        // In a real implementation, this would detect the actual local IP
        Ok(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)))
    }

    /// Check if port is available
    pub fn is_port_available(port: u16) -> bool {
        use std::net::TcpListener;
        TcpListener::bind(("127.0.0.1", port)).is_ok()
    }

    /// Find available port in range
    pub fn find_available_port(start: u16, end: u16) -> Option<u16> {
        for port in start..=end {
            if is_port_available(port) {
                return Some(port);
            }
        }
        None
    }
}

/// Encoding utilities
pub mod encoding {
    use super::*;

    /// Encode bytes to base64
    pub fn base64_encode(data: &[u8]) -> String {
        general_purpose::STANDARD.encode(data)
    }

    /// Decode base64 to bytes
    pub fn base64_decode(data: &str) -> Result<Vec<u8>> {
        general_purpose::STANDARD
            .decode(data)
            .map_err(|e| BitChatError::Generic(format!("Base64 decode error: {}", e)))
    }

    /// Encode bytes to hex
    pub fn hex_encode(data: &[u8]) -> String {
        hex::encode(data)
    }

    /// Decode hex to bytes
    pub fn hex_decode(data: &str) -> Result<Vec<u8>> {
        hex::decode(data).map_err(|e| BitChatError::Generic(format!("Hex decode error: {}", e)))
    }
}

/// Random utilities
pub mod random {
    use super::*;
    use rand::{Rng, RngCore};

    /// Generate random bytes
    pub fn random_bytes(len: usize) -> Vec<u8> {
        let mut bytes = vec![0u8; len];
        rand::thread_rng().fill_bytes(&mut bytes);
        bytes
    }

    /// Generate random string
    pub fn random_string(len: usize) -> String {
        use rand::distributions::Alphanumeric;
        rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(len)
            .map(char::from)
            .collect()
    }

    /// Generate random UUID
    pub fn random_uuid() -> String {
        uuid::Uuid::new_v4().to_string()
    }

    /// Generate random number in range
    pub fn random_range(min: u64, max: u64) -> u64 {
        rand::thread_rng().gen_range(min..=max)
    }

    /// Generate random boolean
    pub fn random_bool() -> bool {
        rand::thread_rng().gen_bool(0.5)
    }

    /// Generate random delay for timing obfuscation
    pub fn random_delay(base: Duration, variance: Duration) -> Duration {
        let variance_ms = variance.as_millis() as u64;
        let random_ms = random_range(0, variance_ms * 2);
        let delay_ms = base.as_millis() as u64 + random_ms - variance_ms;
        Duration::from_millis(delay_ms)
    }
}

/// Memory utilities
pub mod memory {
    use super::*;

    /// Zero out memory securely
    pub fn secure_zero(data: &mut [u8]) {
        // Use volatile writes to prevent compiler optimization
        for byte in data.iter_mut() {
            unsafe {
                std::ptr::write_volatile(byte, 0);
            }
        }
    }

    /// Get memory usage statistics
    pub fn memory_usage() -> MemoryUsage {
        MemoryUsage {
            heap_used: 0,  // Would implement actual memory tracking
            heap_total: 0, // Would implement actual memory tracking
            heap_limit: 0, // Would implement actual memory tracking
            stack_used: 0, // Would implement actual memory tracking
        }
    }

    /// Memory usage statistics
    #[derive(Debug, Clone)]
    pub struct MemoryUsage {
        pub heap_used: usize,
        pub heap_total: usize,
        pub heap_limit: usize,
        pub stack_used: usize,
    }
}

/// Validation utilities
pub mod validation {
    use super::*;

    /// Validate peer ID format
    pub fn validate_peer_id(peer_id: &str) -> Result<()> {
        if peer_id.is_empty() {
            return Err(BitChatError::InvalidMessage(
                "Peer ID cannot be empty".to_string(),
            ));
        }

        if peer_id.len() > 64 {
            return Err(BitChatError::InvalidMessage("Peer ID too long".to_string()));
        }

        // Check for valid characters (alphanumeric + dashes)
        if !peer_id.chars().all(|c| c.is_alphanumeric() || c == '-') {
            return Err(BitChatError::InvalidMessage(
                "Invalid peer ID format".to_string(),
            ));
        }

        Ok(())
    }

    /// Validate topic name
    pub fn validate_topic(topic: &str) -> Result<()> {
        if topic.is_empty() {
            return Err(BitChatError::InvalidMessage(
                "Topic cannot be empty".to_string(),
            ));
        }

        if topic.len() > 256 {
            return Err(BitChatError::InvalidMessage(
                "Topic name too long".to_string(),
            ));
        }

        // Check for valid characters
        if !topic
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '/')
        {
            return Err(BitChatError::InvalidMessage(
                "Invalid topic format".to_string(),
            ));
        }

        Ok(())
    }

    /// Validate message size
    pub fn validate_message_size(data: &[u8], max_size: usize) -> Result<()> {
        if data.len() > max_size {
            return Err(BitChatError::InvalidMessage(format!(
                "Message size {} exceeds maximum {}",
                data.len(),
                max_size
            )));
        }
        Ok(())
    }

    /// Validate network address
    pub fn validate_network_address(address: &str) -> Result<()> {
        if address.is_empty() {
            return Err(BitChatError::Network("Address cannot be empty".to_string()));
        }

        // Try to parse as socket address
        if let Err(e) = address.parse::<std::net::SocketAddr>() {
            return Err(BitChatError::Network(format!(
                "Invalid network address: {}",
                e
            )));
        }

        Ok(())
    }
}

/// Rate limiting utilities
pub mod rate_limit {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    /// Simple rate limiter
    pub struct RateLimiter {
        limits: Arc<RwLock<HashMap<String, RateLimit>>>,
        max_requests: u32,
        window_duration: Duration,
    }

    #[derive(Debug, Clone)]
    struct RateLimit {
        count: u32,
        window_start: SystemTime,
    }

    impl RateLimiter {
        /// Create new rate limiter
        pub fn new(max_requests: u32, window_duration: Duration) -> Self {
            Self {
                limits: Arc::new(RwLock::new(HashMap::new())),
                max_requests,
                window_duration,
            }
        }

        /// Check if request is allowed
        pub async fn is_allowed(&self, key: &str) -> bool {
            let mut limits = self.limits.write().await;
            let now = SystemTime::now();

            match limits.get_mut(key) {
                Some(limit) => {
                    // Check if window has expired
                    if now.duration_since(limit.window_start).unwrap_or_default()
                        > self.window_duration
                    {
                        limit.count = 1;
                        limit.window_start = now;
                        true
                    } else if limit.count < self.max_requests {
                        limit.count += 1;
                        true
                    } else {
                        false
                    }
                }
                None => {
                    limits.insert(
                        key.to_string(),
                        RateLimit {
                            count: 1,
                            window_start: now,
                        },
                    );
                    true
                }
            }
        }

        /// Clean up expired entries
        pub async fn cleanup(&self) {
            let mut limits = self.limits.write().await;
            let now = SystemTime::now();

            limits.retain(|_, limit| {
                now.duration_since(limit.window_start).unwrap_or_default() <= self.window_duration
            });
        }
    }
}

/// Performance monitoring utilities
pub mod performance {
    use super::*;

    /// Performance metrics
    #[derive(Debug, Clone)]
    pub struct PerformanceMetrics {
        pub cpu_usage: f64,
        pub memory_usage: usize,
        pub network_latency: f64,
        pub throughput: f64,
        pub error_rate: f64,
    }

    /// Performance monitor
    pub struct PerformanceMonitor {
        start_time: SystemTime,
        operations: u64,
        errors: u64,
        total_latency: Duration,
    }

    impl PerformanceMonitor {
        /// Create new performance monitor
        pub fn new() -> Self {
            Self {
                start_time: SystemTime::now(),
                operations: 0,
                errors: 0,
                total_latency: Duration::default(),
            }
        }

        /// Record operation
        pub fn record_operation(&mut self, latency: Duration) {
            self.operations += 1;
            self.total_latency += latency;
        }

        /// Record error
        pub fn record_error(&mut self) {
            self.errors += 1;
        }

        /// Get metrics
        pub fn metrics(&self) -> PerformanceMetrics {
            let uptime = SystemTime::now()
                .duration_since(self.start_time)
                .unwrap_or_default();
            let ops_per_sec = if uptime.as_secs() > 0 {
                self.operations as f64 / uptime.as_secs() as f64
            } else {
                0.0
            };

            let avg_latency = if self.operations > 0 {
                self.total_latency.as_secs_f64() / self.operations as f64
            } else {
                0.0
            };

            let error_rate = if self.operations > 0 {
                self.errors as f64 / self.operations as f64
            } else {
                0.0
            };

            PerformanceMetrics {
                cpu_usage: 0.0,                        // Would implement actual CPU monitoring
                memory_usage: 0,                       // Would implement actual memory monitoring
                network_latency: avg_latency * 1000.0, // Convert to milliseconds
                throughput: ops_per_sec,
                error_rate,
            }
        }
    }

    impl Default for PerformanceMonitor {
        fn default() -> Self {
            Self::new()
        }
    }
}

#[cfg(test)]
mod tests {

    #[test]
    fn test_time_utilities() {
        let now = time::unix_timestamp();
        assert!(now > 0);

        let now_ms = time::unix_timestamp_ms();
        assert!(now_ms > now * 1000);

        let system_time = time::unix_to_system_time(now);
        let converted_back = time::system_time_to_unix(system_time);
        assert_eq!(now, converted_back);
    }

    #[test]
    fn test_encoding() {
        let data = b"hello world";
        let encoded = encoding::base64_encode(data);
        let decoded = encoding::base64_decode(&encoded).unwrap();
        assert_eq!(data.to_vec(), decoded);

        let hex_encoded = encoding::hex_encode(data);
        let hex_decoded = encoding::hex_decode(&hex_encoded).unwrap();
        assert_eq!(data.to_vec(), hex_decoded);
    }

    #[test]
    fn test_validation() {
        // Test peer ID validation
        assert!(validation::validate_peer_id("valid-peer-123").is_ok());
        assert!(validation::validate_peer_id("").is_err());
        assert!(validation::validate_peer_id(&"x".repeat(65)).is_err());

        // Test topic validation
        assert!(validation::validate_topic("valid/topic.name").is_ok());
        assert!(validation::validate_topic("").is_err());
        assert!(validation::validate_topic(&"x".repeat(257)).is_err());

        // Test message size validation
        assert!(validation::validate_message_size(b"hello", 10).is_ok());
        assert!(validation::validate_message_size(b"hello world", 5).is_err());
    }

    #[test]
    fn test_random_utilities() {
        let bytes = random::random_bytes(32);
        assert_eq!(bytes.len(), 32);

        let string = random::random_string(10);
        assert_eq!(string.len(), 10);

        let uuid = random::random_uuid();
        assert!(uuid.len() > 0);

        let range = random::random_range(1, 10);
        assert!(range >= 1 && range <= 10);
    }

    #[test]
    fn test_compression() {
        let config = BitChatConfig {
            compression: true,
            compression_threshold: 10,
            ..BitChatConfig::testing()
        };

        let data = b"this is a test message that should be compressed";
        assert!(compression::should_compress(data, &config));

        let short_data = b"short";
        assert!(!compression::should_compress(short_data, &config));

        let ratio = compression::compression_ratio(100, 80);
        assert_eq!(ratio, 0.8);
    }

    #[tokio::test]
    async fn test_rate_limiter() {
        let limiter = rate_limit::RateLimiter::new(3, Duration::from_secs(1));

        // Should allow first 3 requests
        assert!(limiter.is_allowed("test-key").await);
        assert!(limiter.is_allowed("test-key").await);
        assert!(limiter.is_allowed("test-key").await);

        // Should reject 4th request
        assert!(!limiter.is_allowed("test-key").await);

        // Different key should be allowed
        assert!(limiter.is_allowed("other-key").await);
    }

    #[test]
    fn test_performance_monitor() {
        let mut monitor = performance::PerformanceMonitor::new();

        monitor.record_operation(Duration::from_millis(100));
        monitor.record_operation(Duration::from_millis(200));
        monitor.record_error();

        let metrics = monitor.metrics();
        assert!(metrics.throughput > 0.0);
        assert!(metrics.network_latency > 0.0);
        assert!(metrics.error_rate > 0.0);
    }
}
