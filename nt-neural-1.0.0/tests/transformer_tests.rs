//! Unit tests for Transformer model

#[cfg(feature = "candle")]
mod candle_tests {
    use nt_neural::{
        models::{
            transformer::{TransformerModel, TransformerConfig},
            ModelConfig, ModelType,
        },
        Result,
    };
    use candle_core::{Device, DType, Tensor};
    use candle_nn::VarMap;

    fn create_test_config() -> TransformerConfig {
        TransformerConfig {
            base: ModelConfig {
                input_size: 24,
                horizon: 12,
                hidden_size: 64,
                num_features: 1,
                dropout: 0.1,
                device: None,
            },
            num_heads: 4,
            num_encoder_layers: 2,
            num_decoder_layers: 2,
            dim_feedforward: 256,
            use_positional_encoding: true,
        }
    }

    #[test]
    fn test_transformer_creation() {
        let config = create_test_config();
        let varmap = VarMap::new();
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);

        let model = TransformerModel::new(config.clone(), vb);
        assert!(model.is_ok(), "Transformer model creation should succeed");

        let model = model.unwrap();
        assert_eq!(model.model_type(), ModelType::Transformer);
    }

    #[test]
    fn test_transformer_forward() {
        let config = create_test_config();
        let varmap = VarMap::new();
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);
        let model = TransformerModel::new(config, vb).unwrap();

        let device = Device::Cpu;
        let input = Tensor::randn(0.0f32, 1.0, (4, 24, 1), &device).unwrap();

        let output = model.forward(&input);
        assert!(output.is_ok(), "Forward pass should succeed");

        let output = output.unwrap();
        let dims = output.dims();
        assert_eq!(dims.len(), 2, "Output should be 2D");
        assert_eq!(dims[0], 4, "Batch size should match");
        assert_eq!(dims[1], 12, "Horizon should match");
    }

    #[test]
    fn test_transformer_different_layers() {
        let device = Device::Cpu;

        for (enc_layers, dec_layers) in [(1, 1), (2, 2), (3, 3), (4, 2)] {
            let mut config = create_test_config();
            config.num_encoder_layers = enc_layers;
            config.num_decoder_layers = dec_layers;

            let varmap = VarMap::new();
            let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
            let model = TransformerModel::new(config, vb);

            assert!(model.is_ok(),
                "Encoder={}, Decoder={} should work", enc_layers, dec_layers);

            let model = model.unwrap();
            let input = Tensor::randn(0.0f32, 1.0, (2, 24, 1), &device).unwrap();
            let output = model.forward(&input);

            assert!(output.is_ok(),
                "Enc={}, Dec={} forward pass should succeed", enc_layers, dec_layers);
        }
    }

    #[test]
    fn test_transformer_attention_heads() {
        let device = Device::Cpu;

        for num_heads in [1, 2, 4, 8] {
            let mut config = create_test_config();
            config.num_heads = num_heads;
            config.base.hidden_size = 64; // Divisible by all test head counts

            let varmap = VarMap::new();
            let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
            let model = TransformerModel::new(config, vb);

            assert!(model.is_ok(), "{} attention heads should work", num_heads);

            if model.is_ok() {
                let model = model.unwrap();
                let input = Tensor::randn(0.0f32, 1.0, (2, 24, 1), &device).unwrap();
                let output = model.forward(&input);
                assert!(output.is_ok(), "{} heads forward should succeed", num_heads);
            }
        }
    }

    #[test]
    fn test_transformer_feedforward_dim() {
        let device = Device::Cpu;

        for dim_ff in [128, 256, 512, 1024] {
            let mut config = create_test_config();
            config.dim_feedforward = dim_ff;

            let varmap = VarMap::new();
            let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
            let model = TransformerModel::new(config, vb);

            assert!(model.is_ok(), "Feedforward dim={} should work", dim_ff);
        }
    }

    #[test]
    fn test_transformer_positional_encoding() {
        let device = Device::Cpu;

        for use_pe in [false, true] {
            let mut config = create_test_config();
            config.use_positional_encoding = use_pe;

            let varmap = VarMap::new();
            let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
            let model = TransformerModel::new(config, vb);

            assert!(model.is_ok(), "Positional encoding={} should work", use_pe);

            let model = model.unwrap();
            let input = Tensor::randn(0.0f32, 1.0, (4, 24, 1), &device).unwrap();
            let output = model.forward(&input);

            assert!(output.is_ok(), "PE={} forward should succeed", use_pe);
        }
    }

    #[test]
    fn test_transformer_different_batch_sizes() {
        let config = create_test_config();
        let varmap = VarMap::new();
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);
        let model = TransformerModel::new(config, vb).unwrap();
        let device = Device::Cpu;

        for batch_size in [1, 4, 8, 16, 32] {
            let input = Tensor::randn(0.0f32, 1.0, (batch_size, 24, 1), &device).unwrap();
            let output = model.forward(&input).unwrap();

            assert_eq!(output.dims()[0], batch_size,
                "Output batch size should match input for batch_size={}", batch_size);
        }
    }

    #[test]
    fn test_transformer_sequence_lengths() {
        let device = Device::Cpu;
        let varmap = VarMap::new();

        for seq_len in [12, 24, 48, 96, 168] {
            let mut config = create_test_config();
            config.base.input_size = seq_len;

            let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
            let model = TransformerModel::new(config, vb);

            assert!(model.is_ok(), "Sequence length {} should work", seq_len);

            let model = model.unwrap();
            let input = Tensor::randn(0.0f32, 1.0, (2, seq_len, 1), &device).unwrap();
            let output = model.forward(&input);

            assert!(output.is_ok(), "Forward with seq_len={} should succeed", seq_len);
        }
    }

    #[test]
    fn test_transformer_multivariate() {
        let device = Device::Cpu;

        for num_features in [1, 3, 5, 10] {
            let mut config = create_test_config();
            config.base.num_features = num_features;

            let varmap = VarMap::new();
            let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
            let model = TransformerModel::new(config, vb);

            assert!(model.is_ok(), "{} features should work", num_features);

            let model = model.unwrap();
            let input = Tensor::randn(0.0f32, 1.0, (4, 24, num_features), &device).unwrap();
            let output = model.forward(&input);

            assert!(output.is_ok(), "{} features forward should succeed", num_features);
        }
    }

    #[test]
    fn test_transformer_output_stability() {
        let config = create_test_config();
        let varmap = VarMap::new();
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);
        let model = TransformerModel::new(config, vb).unwrap();

        let device = Device::Cpu;
        let input = Tensor::randn(0.0f32, 1.0, (8, 24, 1), &device).unwrap();
        let output = model.forward(&input).unwrap();

        let output_vec: Vec<f32> = output.flatten_all().unwrap().to_vec1().unwrap();

        for val in output_vec.iter() {
            assert!(val.is_finite(), "Output should be finite, got {}", val);
            assert!(val.abs() < 1e6, "Output should be reasonable, got {}", val);
        }
    }

    #[test]
    fn test_transformer_num_parameters() {
        let config = create_test_config();
        let varmap = VarMap::new();
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);
        let model = TransformerModel::new(config, vb).unwrap();

        let num_params = model.num_parameters();
        assert!(num_params > 0, "Model should have parameters");
        println!("Transformer model has {} parameters", num_params);
    }

    #[test]
    fn test_transformer_deterministic() {
        let config = create_test_config();
        let varmap = VarMap::new();
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);
        let model = TransformerModel::new(config, vb).unwrap();

        let device = Device::Cpu;
        let input = Tensor::ones((4, 24, 1), DType::F32, &device).unwrap();

        let output1 = model.forward(&input).unwrap();
        let output2 = model.forward(&input).unwrap();

        let out1_vec: Vec<f32> = output1.flatten_all().unwrap().to_vec1().unwrap();
        let out2_vec: Vec<f32> = output2.flatten_all().unwrap().to_vec1().unwrap();

        for (v1, v2) in out1_vec.iter().zip(out2_vec.iter()) {
            assert!((v1 - v2).abs() < 1e-5,
                "Model should be deterministic: {} vs {}", v1, v2);
        }
    }

    #[test]
    fn test_transformer_long_sequences() {
        let device = Device::Cpu;
        let mut config = create_test_config();
        config.base.input_size = 336; // 2 weeks of hourly data
        config.base.horizon = 168;    // 1 week forecast

        let varmap = VarMap::new();
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
        let model = TransformerModel::new(config, vb);

        assert!(model.is_ok(), "Long sequences should work");

        let model = model.unwrap();
        let input = Tensor::randn(0.0f32, 1.0, (2, 336, 1), &device).unwrap();
        let output = model.forward(&input);

        assert!(output.is_ok(), "Long sequence forward should succeed");

        let output = output.unwrap();
        assert_eq!(output.dims()[1], 168, "Long horizon output should match");
    }

    #[test]
    #[cfg(any(feature = "cuda", feature = "metal"))]
    fn test_transformer_gpu_inference() {
        #[cfg(feature = "cuda")]
        let device = match Device::new_cuda(0) {
            Ok(d) => d,
            Err(_) => {
                println!("CUDA not available, skipping GPU test");
                return;
            }
        };

        #[cfg(all(feature = "metal", not(feature = "cuda")))]
        let device = match Device::new_metal(0) {
            Ok(d) => d,
            Err(_) => {
                println!("Metal not available, skipping GPU test");
                return;
            }
        };

        let config = create_test_config();
        let varmap = VarMap::new();
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &device);
        let model = TransformerModel::new(config, vb);

        assert!(model.is_ok(), "GPU model creation should succeed");

        let model = model.unwrap();
        let input = Tensor::randn(0.0f32, 1.0, (4, 24, 1), &device).unwrap();
        let output = model.forward(&input);

        assert!(output.is_ok(), "GPU forward pass should succeed");
    }
}

#[cfg(not(feature = "candle"))]
mod stub_tests {
    #[test]
    fn test_without_candle() {
        println!("Transformer tests require candle feature");
    }
}
