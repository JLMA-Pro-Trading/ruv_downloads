//! Stub implementations when candle feature is not enabled
//!
//! These stubs provide the basic API surface without actual functionality,
//! allowing the crate to compile and be used in scenarios where neural
//! network functionality is not required.

#![cfg(not(feature = "candle"))]

use crate::error::{NeuralError, Result};

/// Stub Device type when candle is not available
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Device;

impl Device {
    pub fn cpu() -> Self {
        Self
    }

    pub fn is_cpu(&self) -> bool {
        true
    }

    pub fn is_cuda(&self) -> bool {
        false
    }

    pub fn is_metal(&self) -> bool {
        false
    }
}

/// Stub Tensor type when candle is not available
#[derive(Debug, Clone)]
pub struct Tensor;

impl Tensor {
    pub fn zeros(_shape: &[usize], _device: &Device) -> Result<Self> {
        Err(NeuralError::not_implemented(
            "Tensor operations require the 'candle' feature to be enabled"
        ))
    }

    pub fn ones(_shape: &[usize], _device: &Device) -> Result<Self> {
        Err(NeuralError::not_implemented(
            "Tensor operations require the 'candle' feature to be enabled"
        ))
    }

    pub fn shape(&self) -> &[usize] {
        &[]
    }

    pub fn device(&self) -> &Device {
        &Device
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stub_device() {
        let device = Device::cpu();
        assert!(device.is_cpu());
        assert!(!device.is_cuda());
        assert!(!device.is_metal());
    }

    #[test]
    fn test_stub_tensor_errors() {
        let device = Device::cpu();
        let result = Tensor::zeros(&[1, 2, 3], &device);
        assert!(result.is_err());

        if let Err(NeuralError::NotImplemented(msg)) = result {
            assert!(msg.contains("candle"));
        } else {
            panic!("Expected NotImplemented error");
        }
    }
}
