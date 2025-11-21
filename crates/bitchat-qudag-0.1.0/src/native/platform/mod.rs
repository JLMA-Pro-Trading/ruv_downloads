//! Platform-specific implementations for BitChat-QuDAG

use crate::error::BitChatError;
use std::sync::Arc;
use tokio::sync::RwLock;

#[cfg(target_os = "ios")]
pub mod ios;

#[cfg(target_os = "android")]
pub mod android;

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "linux")]
pub mod linux;

#[cfg(target_os = "macos")]
pub mod macos;

// Re-export the current platform module
#[cfg(target_os = "ios")]
pub use ios::*;

#[cfg(target_os = "android")]
pub use android::*;

#[cfg(target_os = "windows")]
pub use windows::*;

#[cfg(target_os = "linux")]
pub use linux::*;

#[cfg(target_os = "macos")]
pub use macos::*;

/// Platform-specific capabilities
#[derive(Debug, Clone)]
pub struct PlatformCapabilities {
    pub bluetooth_available: bool,
    pub ble_available: bool,
    pub background_mode_available: bool,
    pub push_notifications_available: bool,
    pub hardware_crypto_available: bool,
    pub keychain_available: bool,
    pub secure_enclave_available: bool,
    pub nfc_available: bool,
    pub simd_available: bool,
    pub gpu_compute_available: bool,
}

/// System information
#[derive(Debug, Clone)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub arch: String,
    pub cpu_count: usize,
    pub memory_mb: usize,
    pub hostname: String,
    pub device_model: Option<String>,
    pub device_id: String,
}

/// Platform-specific network configuration
#[derive(Debug, Clone)]
pub struct PlatformNetworkConfig {
    pub prefer_wifi: bool,
    pub allow_cellular: bool,
    pub low_data_mode: bool,
    pub background_fetch_enabled: bool,
    pub multipath_tcp_enabled: bool,
}

/// Common platform interface
pub trait PlatformIntegration: Send + Sync {
    /// Initialize platform-specific features
    fn initialize(&mut self) -> Result<(), BitChatError>;
    
    /// Get platform capabilities
    fn get_capabilities(&self) -> PlatformCapabilities;
    
    /// Get system information
    fn get_system_info(&self) -> SystemInfo;
    
    /// Configure network settings
    fn configure_network(&mut self, config: PlatformNetworkConfig) -> Result<(), BitChatError>;
    
    /// Request platform permissions
    fn request_permissions(&self) -> Result<(), BitChatError>;
    
    /// Setup background mode
    fn setup_background_mode(&mut self) -> Result<(), BitChatError>;
    
    /// Handle low memory warning
    fn handle_low_memory(&mut self) -> Result<(), BitChatError>;
    
    /// Get battery level (0.0 - 1.0)
    fn get_battery_level(&self) -> Result<f32, BitChatError>;
    
    /// Check if device is charging
    fn is_charging(&self) -> Result<bool, BitChatError>;
}

/// Default implementation for unsupported platforms
#[cfg(not(any(target_os = "ios", target_os = "android", target_os = "windows", target_os = "linux", target_os = "macos")))]
pub struct DefaultPlatform;

#[cfg(not(any(target_os = "ios", target_os = "android", target_os = "windows", target_os = "linux", target_os = "macos")))]
impl PlatformIntegration for DefaultPlatform {
    fn initialize(&mut self) -> Result<(), BitChatError> {
        Ok(())
    }
    
    fn get_capabilities(&self) -> PlatformCapabilities {
        PlatformCapabilities {
            bluetooth_available: false,
            ble_available: false,
            background_mode_available: false,
            push_notifications_available: false,
            hardware_crypto_available: false,
            keychain_available: false,
            secure_enclave_available: false,
            nfc_available: false,
            simd_available: cfg!(target_feature = "simd"),
            gpu_compute_available: false,
        }
    }
    
    fn get_system_info(&self) -> SystemInfo {
        SystemInfo {
            os: std::env::consts::OS.to_string(),
            os_version: "unknown".to_string(),
            arch: std::env::consts::ARCH.to_string(),
            cpu_count: num_cpus::get(),
            memory_mb: 8192, // Default 8GB
            hostname: hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_else(|_| "unknown".to_string()),
            device_model: None,
            device_id: uuid::Uuid::new_v4().to_string(),
        }
    }
    
    fn configure_network(&mut self, _config: PlatformNetworkConfig) -> Result<(), BitChatError> {
        Ok(())
    }
    
    fn request_permissions(&self) -> Result<(), BitChatError> {
        Ok(())
    }
    
    fn setup_background_mode(&mut self) -> Result<(), BitChatError> {
        Err(BitChatError::Platform("Background mode not supported on this platform".to_string()))
    }
    
    fn handle_low_memory(&mut self) -> Result<(), BitChatError> {
        Ok(())
    }
    
    fn get_battery_level(&self) -> Result<f32, BitChatError> {
        Ok(1.0) // Assume plugged in for desktop
    }
    
    fn is_charging(&self) -> Result<bool, BitChatError> {
        Ok(true) // Assume always charging for desktop
    }
}

/// Get the current platform implementation
pub fn get_platform() -> Box<dyn PlatformIntegration> {
    #[cfg(target_os = "ios")]
    return Box::new(ios::IosPlatform::new());
    
    #[cfg(target_os = "android")]
    return Box::new(android::AndroidPlatform::new());
    
    #[cfg(target_os = "windows")]
    return Box::new(windows::WindowsPlatform::new());
    
    #[cfg(target_os = "linux")]
    return Box::new(linux::LinuxPlatform::new());
    
    #[cfg(target_os = "macos")]
    return Box::new(macos::MacOsPlatform::new());
    
    #[cfg(not(any(target_os = "ios", target_os = "android", target_os = "windows", target_os = "linux", target_os = "macos")))]
    return Box::new(DefaultPlatform);
}