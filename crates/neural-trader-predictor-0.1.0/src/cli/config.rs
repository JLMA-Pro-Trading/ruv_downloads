//! Configuration file parsing for CLI
//!
//! Supports YAML and JSON configuration files for:
//! - Predictor settings (alpha, calibration size, etc.)
//! - Input/output formats
//! - Processing options (threads, batch size, etc.)

use crate::core::{types::{PredictorConfig, AdaptiveConfig}, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;

/// CLI application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Predictor configuration
    #[serde(default)]
    pub predictor: PredictorConfig,

    /// Adaptive inference configuration
    #[serde(default)]
    pub adaptive: AdaptiveConfig,

    /// Processing options
    #[serde(default)]
    pub processing: ProcessingConfig,

    /// Output options
    #[serde(default)]
    pub output: OutputConfig,
}

/// Processing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingConfig {
    /// Number of threads to use (0 = auto)
    #[serde(default = "default_threads")]
    pub threads: usize,

    /// Batch size for processing
    #[serde(default = "default_batch_size")]
    pub batch_size: usize,

    /// Show progress bar
    #[serde(default = "default_show_progress")]
    pub show_progress: bool,

    /// Verbose output
    #[serde(default)]
    pub verbose: bool,
}

/// Output configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputConfig {
    /// Output format: "json" or "csv"
    #[serde(default = "default_format")]
    pub format: String,

    /// Include timestamps in output
    #[serde(default = "default_include_timestamps")]
    pub include_timestamps: bool,

    /// Number of decimal places for floats
    #[serde(default = "default_decimal_places")]
    pub decimal_places: usize,

    /// Use colored output
    #[serde(default = "default_colored")]
    pub colored: bool,
}

fn default_threads() -> usize {
    // Default to 4 threads; override with RAYON_NUM_THREADS env var
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
}

fn default_batch_size() -> usize {
    1000
}

fn default_show_progress() -> bool {
    true
}

fn default_format() -> String {
    "json".to_string()
}

fn default_include_timestamps() -> bool {
    true
}

fn default_decimal_places() -> usize {
    6
}

fn default_colored() -> bool {
    true
}

impl Default for Config {
    fn default() -> Self {
        Self {
            predictor: PredictorConfig::default(),
            adaptive: AdaptiveConfig::default(),
            processing: ProcessingConfig::default(),
            output: OutputConfig::default(),
        }
    }
}

impl Default for ProcessingConfig {
    fn default() -> Self {
        Self {
            threads: default_threads(),
            batch_size: default_batch_size(),
            show_progress: default_show_progress(),
            verbose: false,
        }
    }
}

impl Default for OutputConfig {
    fn default() -> Self {
        Self {
            format: default_format(),
            include_timestamps: default_include_timestamps(),
            decimal_places: default_decimal_places(),
            colored: default_colored(),
        }
    }
}

impl Config {
    /// Load configuration from file
    ///
    /// Automatically detects format based on file extension:
    /// - .yaml, .yml -> YAML
    /// - .json -> JSON
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        let content = fs::read_to_string(path)
            .map_err(|e| crate::core::Error::IoError(e))?;

        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("json")
            .to_lowercase();

        match extension.as_str() {
            "yaml" | "yml" => {
                #[cfg(feature = "cli")]
                {
                    serde_yaml::from_str(&content)
                        .map_err(|e| crate::core::Error::serialization(e.to_string()))
                }
                #[cfg(not(feature = "cli"))]
                {
                    Err(crate::core::Error::other(
                        "YAML support requires 'cli' feature",
                    ))
                }
            }
            "json" => {
                serde_json::from_str(&content)
                    .map_err(|e| crate::core::Error::serialization(e.to_string()))
            }
            _ => Err(crate::core::Error::other(
                "Unsupported config format. Use .yaml or .json",
            )),
        }
    }

    /// Save configuration to file
    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let path = path.as_ref();
        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("json")
            .to_lowercase();

        let content = match extension.as_str() {
            "yaml" | "yml" => {
                #[cfg(feature = "cli")]
                {
                    serde_yaml::to_string(self)
                        .map_err(|e| crate::core::Error::serialization(e.to_string()))?
                }
                #[cfg(not(feature = "cli"))]
                {
                    return Err(crate::core::Error::other(
                        "YAML support requires 'cli' feature",
                    ));
                }
            }
            "json" => {
                serde_json::to_string_pretty(self)
                    .map_err(|e| crate::core::Error::serialization(e.to_string()))?
            }
            _ => {
                return Err(crate::core::Error::other(
                    "Unsupported config format. Use .yaml or .json",
                ))
            }
        };

        fs::write(path, content).map_err(|e| crate::core::Error::IoError(e))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert_eq!(config.predictor.alpha, 0.1);
        assert_eq!(config.output.format, "json");
        assert_eq!(config.processing.batch_size, 1000);
    }

    #[test]
    fn test_config_serialization() {
        let config = Config::default();
        let json = serde_json::to_string(&config).unwrap();
        let parsed: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.predictor.alpha, config.predictor.alpha);
    }
}
