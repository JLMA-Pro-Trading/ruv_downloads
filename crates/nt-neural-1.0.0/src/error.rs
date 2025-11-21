//! Error types for the neural module

use thiserror::Error;

#[derive(Error, Debug)]
pub enum NeuralError {
    #[cfg(feature = "candle")]
    #[error("Candle error: {0}")]
    Candle(#[from] candle_core::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Model error: {0}")]
    Model(String),

    #[error("Training error: {0}")]
    Training(String),

    #[error("Inference error: {0}")]
    Inference(String),

    #[error("Data error: {0}")]
    Data(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Device error: {0}")]
    Device(String),

    #[error("Checkpoint error: {0}")]
    Checkpoint(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Feature not available: {0}")]
    NotImplemented(String),
}

pub type Result<T> = std::result::Result<T, NeuralError>;

impl NeuralError {
    pub fn model(msg: impl Into<String>) -> Self {
        Self::Model(msg.into())
    }

    pub fn training(msg: impl Into<String>) -> Self {
        Self::Training(msg.into())
    }

    pub fn inference(msg: impl Into<String>) -> Self {
        Self::Inference(msg.into())
    }

    pub fn data(msg: impl Into<String>) -> Self {
        Self::Data(msg.into())
    }

    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }

    pub fn device(msg: impl Into<String>) -> Self {
        Self::Device(msg.into())
    }

    pub fn not_implemented(msg: impl Into<String>) -> Self {
        Self::NotImplemented(msg.into())
    }

    pub fn io(msg: impl Into<String>) -> Self {
        Self::Io(std::io::Error::other(msg.into()))
    }

    pub fn storage(msg: impl Into<String>) -> Self {
        Self::Storage(msg.into())
    }
}
