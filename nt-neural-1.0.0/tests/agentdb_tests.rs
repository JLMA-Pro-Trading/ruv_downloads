//! Integration tests for AgentDB model storage

#[cfg(feature = "candle")]
mod candle_tests {
    use nt_neural::{
        models::{nhits::{NHITSModel, NHITSConfig}, ModelConfig, ModelType},
        ModelVersion, TrainingMetrics,
    };
    use candle_core::{Device, DType};
    use candle_nn::VarMap;
    use tempfile::TempDir;
    use std::path::PathBuf;

    fn create_test_config() -> NHITSConfig {
        NHITSConfig {
            base: ModelConfig {
                input_size: 24,
                horizon: 12,
                hidden_size: 64,
                num_features: 1,
                dropout: 0.1,
                device: None,
            },
            n_stacks: 2,
            n_blocks: vec![1, 1],
            n_freq_downsample: vec![2, 1],
            mlp_units: vec![vec![64, 64], vec![64, 64]],
            ..Default::default()
        }
    }

    #[test]
    fn test_model_version_creation() {
        let config = create_test_config();
        let config_json = serde_json::to_value(&config).unwrap();

        let version = ModelVersion::new(ModelType::NHITS, config_json);

        assert!(!version.model_id.is_empty());
        assert_eq!(version.model_type, ModelType::NHITS);
        assert_eq!(version.version, "1.0.0");
        assert!(version.metrics.is_none());
    }

    #[test]
    fn test_model_version_serialization() {
        let config = create_test_config();
        let config_json = serde_json::to_value(&config).unwrap();
        let version = ModelVersion::new(ModelType::NHITS, config_json);

        let json = serde_json::to_string(&version).unwrap();
        assert!(json.contains("model_id"));
        assert!(json.contains("NHITS"));

        let deserialized: ModelVersion = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.model_id, version.model_id);
        assert_eq!(deserialized.model_type, version.model_type);
    }

    #[test]
    fn test_model_version_save_load() {
        let temp_dir = TempDir::new().unwrap();
        let version_path = temp_dir.path().join("model_version.json");

        let config = create_test_config();
        let config_json = serde_json::to_value(&config).unwrap();
        let version = ModelVersion::new(ModelType::NHITS, config_json);

        // Save
        version.save(&version_path).unwrap();
        assert!(version_path.exists());

        // Load
        let loaded = ModelVersion::load(&version_path).unwrap();
        assert_eq!(loaded.model_id, version.model_id);
        assert_eq!(loaded.model_type, version.model_type);
        assert_eq!(loaded.version, version.version);
    }

    #[test]
    fn test_model_version_with_metrics() {
        let config = create_test_config();
        let config_json = serde_json::to_value(&config).unwrap();
        let mut version = ModelVersion::new(ModelType::NHITS, config_json);

        let metrics = TrainingMetrics {
            epoch: 10,
            train_loss: 0.123,
            val_loss: Some(0.145),
            learning_rate: 0.001,
            epoch_time_seconds: 1.5,
        };

        version.metrics = Some(metrics.clone());

        let json = serde_json::to_string(&version).unwrap();
        let deserialized: ModelVersion = serde_json::from_str(&json).unwrap();

        assert!(deserialized.metrics.is_some());
        let loaded_metrics = deserialized.metrics.unwrap();
        assert_eq!(loaded_metrics.epoch, 10);
        assert!((loaded_metrics.train_loss - 0.123).abs() < 1e-6);
    }

    #[test]
    fn test_model_checkpoint_metadata() {
        let temp_dir = TempDir::new().unwrap();
        let checkpoint_path = temp_dir.path().join("checkpoint");
        std::fs::create_dir_all(&checkpoint_path).unwrap();

        let config = create_test_config();
        let varmap = VarMap::new();
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);
        let model = NHITSModel::new(config, vb).unwrap();

        // Save model weights (safetensors format)
        let weights_path = checkpoint_path.join("model.safetensors");
        model.save_weights(weights_path.to_str().unwrap()).unwrap();

        assert!(weights_path.exists(), "Model weights should be saved");
    }

    #[test]
    fn test_model_versioning() {
        let config = create_test_config();
        let config_json = serde_json::to_value(&config).unwrap();

        let v1 = ModelVersion::new(ModelType::NHITS, config_json.clone());
        let v2 = ModelVersion::new(ModelType::NHITS, config_json.clone());

        // Each version should have unique ID
        assert_ne!(v1.model_id, v2.model_id);

        // But same configuration
        assert_eq!(
            v1.config.get("base").unwrap().get("input_size"),
            v2.config.get("base").unwrap().get("input_size")
        );
    }

    #[test]
    fn test_multiple_model_versions() {
        let temp_dir = TempDir::new().unwrap();

        let model_types = vec![
            ModelType::NHITS,
            ModelType::LSTMAttention,
            ModelType::Transformer,
        ];

        for (i, model_type) in model_types.iter().enumerate() {
            let config_json = serde_json::json!({
                "input_size": 24,
                "horizon": 12,
            });

            let version = ModelVersion::new(*model_type, config_json);
            let path = temp_dir.path().join(format!("model_{}.json", i));

            version.save(&path).unwrap();
            assert!(path.exists());

            let loaded = ModelVersion::load(&path).unwrap();
            assert_eq!(loaded.model_type, *model_type);
        }
    }

    #[test]
    fn test_model_config_validation() {
        let config = create_test_config();
        let config_json = serde_json::to_value(&config).unwrap();
        let version = ModelVersion::new(ModelType::NHITS, config_json);

        // Verify config contains expected fields
        assert!(version.config.get("base").is_some());
        assert!(version.config.get("n_stacks").is_some());
        assert!(version.config.get("n_blocks").is_some());
    }

    #[test]
    fn test_model_load_invalid_path() {
        let result = ModelVersion::load("nonexistent_file.json");
        assert!(result.is_err(), "Loading from invalid path should fail");
    }

    #[test]
    fn test_model_save_invalid_path() {
        let config = create_test_config();
        let config_json = serde_json::to_value(&config).unwrap();
        let version = ModelVersion::new(ModelType::NHITS, config_json);

        // Try to save to invalid path
        let result = version.save("/invalid/path/model.json");
        assert!(result.is_err(), "Saving to invalid path should fail");
    }

    #[test]
    fn test_timestamp_ordering() {
        use std::thread;
        use std::time::Duration;

        let config = create_test_config();
        let config_json = serde_json::to_value(&config).unwrap();

        let v1 = ModelVersion::new(ModelType::NHITS, config_json.clone());
        thread::sleep(Duration::from_millis(10));
        let v2 = ModelVersion::new(ModelType::NHITS, config_json.clone());

        assert!(v2.created_at > v1.created_at, "Later version should have later timestamp");
    }

    #[test]
    fn test_model_metadata_roundtrip() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("model_metadata.json");

        let config = create_test_config();
        let config_json = serde_json::to_value(&config).unwrap();
        let mut version = ModelVersion::new(ModelType::NHITS, config_json);

        version.metrics = Some(TrainingMetrics {
            epoch: 50,
            train_loss: 0.05,
            val_loss: Some(0.06),
            learning_rate: 0.0001,
            epoch_time_seconds: 2.0,
        });

        version.save(&path).unwrap();
        let loaded = ModelVersion::load(&path).unwrap();

        assert_eq!(loaded.model_id, version.model_id);
        assert_eq!(loaded.model_type, version.model_type);
        assert_eq!(loaded.version, version.version);

        let loaded_metrics = loaded.metrics.unwrap();
        assert_eq!(loaded_metrics.epoch, 50);
    }
}

#[cfg(not(feature = "candle"))]
mod stub_tests {
    #[test]
    fn test_without_candle() {
        println!("AgentDB integration tests require candle feature");
    }
}
