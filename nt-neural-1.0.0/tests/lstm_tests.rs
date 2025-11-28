//! Comprehensive integration tests for LSTM-Attention model

#[cfg(feature = "candle")]
mod lstm_integration_tests {
    use nt_neural::error::Result;
    use nt_neural::models::lstm_attention::{LSTMAttentionConfig, LSTMAttentionModel};
    use nt_neural::models::{ModelConfig, NeuralModel};
    use candle_core::{DType, Device, Tensor};

    /// Helper function to create test data
    fn create_test_data(
        batch_size: usize,
        seq_len: usize,
        features: usize,
    ) -> Result<Tensor> {
        let device = Device::Cpu;
        Ok(Tensor::randn(
            0.0_f32,
            1.0,
            (batch_size, seq_len, features),
            &device,
        )?)
    }

    #[test]
    fn test_lstm_cell_gates() {
        // Test that LSTM cell properly updates hidden and cell states
        use candle_nn::{VarBuilder, VarMap};
        use nt_neural::models::lstm_attention::LSTMCell;

        let device = Device::Cpu;
        let var_map = VarMap::new();
        let vb = VarBuilder::from_varmap(&var_map, DType::F32, &device);

        let cell = LSTMCell::new(10, 20, vb.pp("test")).unwrap();

        // Create inputs
        let input = Tensor::randn(0.0_f32, 1.0, (2, 10), &device).unwrap();
        let hidden = Tensor::zeros((2, 20), DType::F32, &device).unwrap();
        let cell_state = Tensor::zeros((2, 20), DType::F32, &device).unwrap();

        // Forward pass
        let (new_hidden, new_cell) = cell.forward(&input, &hidden, &cell_state).unwrap();

        // Check shapes
        assert_eq!(new_hidden.dims(), &[2, 20]);
        assert_eq!(new_cell.dims(), &[2, 20]);

        // Check that states have changed (not all zeros)
        let hidden_sum: f32 = new_hidden.sum_all().unwrap().to_scalar().unwrap();
        let cell_sum: f32 = new_cell.sum_all().unwrap().to_scalar().unwrap();
        assert!(hidden_sum.abs() > 1e-6);
        assert!(cell_sum.abs() > 1e-6);
    }

    #[test]
    fn test_stacked_lstm_layers() {
        // Test multi-layer LSTM stacking
        use candle_nn::{VarBuilder, VarMap};
        use nt_neural::models::lstm_attention::StackedLSTM;

        let device = Device::Cpu;
        let var_map = VarMap::new();
        let vb = VarBuilder::from_varmap(&var_map, DType::F32, &device);

        // 3-layer LSTM
        let lstm = StackedLSTM::new(10, 20, 3, false, vb.pp("test")).unwrap();

        let input = Tensor::randn(0.0_f32, 1.0, (2, 5, 10), &device).unwrap();
        let (output, hidden, cell) = lstm.forward(&input).unwrap();

        // Check output shape
        assert_eq!(output.dims(), &[2, 5, 20]);

        // Check we have 3 layers of states
        assert_eq!(hidden.len(), 3);
        assert_eq!(cell.len(), 3);

        // Check each layer's state shape
        for i in 0..3 {
            assert_eq!(hidden[i].dims(), &[2, 20]);
            assert_eq!(cell[i].dims(), &[2, 20]);
        }
    }

    #[test]
    fn test_bidirectional_lstm_output_size() {
        // Test that bidirectional LSTM doubles output size
        use candle_nn::{VarBuilder, VarMap};
        use nt_neural::models::lstm_attention::StackedLSTM;

        let device = Device::Cpu;
        let var_map = VarMap::new();
        let vb = VarBuilder::from_varmap(&var_map, DType::F32, &device);

        // Bidirectional LSTM
        let lstm = StackedLSTM::new(10, 20, 2, true, vb.pp("test")).unwrap();

        let input = Tensor::randn(0.0_f32, 1.0, (2, 5, 10), &device).unwrap();
        let (output, hidden, cell) = lstm.forward(&input).unwrap();

        // Output should be doubled (20 * 2 = 40)
        assert_eq!(output.dims(), &[2, 5, 40]);

        // Hidden and cell states should also be doubled
        assert_eq!(hidden[0].dims(), &[2, 40]);
        assert_eq!(cell[0].dims(), &[2, 40]);
    }

    #[test]
    fn test_encoder_decoder_architecture() {
        // Test full encoder-decoder with attention
        let mut config = LSTMAttentionConfig::default();
        config.base.input_size = 20;
        config.base.horizon = 10;
        config.base.num_features = 1;
        config.base.hidden_size = 32;
        config.num_encoder_layers = 2;
        config.num_decoder_layers = 2;

        let model = LSTMAttentionModel::new(config).unwrap();

        let input = create_test_data(4, 20, 1).unwrap();
        let output = model.forward(&input).unwrap();

        // Check output shape (batch, horizon, features)
        assert_eq!(output.dims(), &[4, 10, 1]);
    }

    #[test]
    fn test_teacher_forcing_training() {
        // Test teacher forcing during training
        let mut config = LSTMAttentionConfig::default();
        config.base.input_size = 10;
        config.base.horizon = 5;
        config.base.num_features = 2;
        config.base.hidden_size = 16;
        config.teacher_forcing_ratio = 0.8; // 80% teacher forcing

        let model = LSTMAttentionModel::new(config).unwrap();

        let input = create_test_data(2, 10, 2).unwrap();
        let target = create_test_data(2, 5, 2).unwrap();

        // Forward with teacher forcing
        let output = model.forward_with_target(&input, Some(&target)).unwrap();

        assert_eq!(output.dims(), &[2, 5, 2]);
    }

    #[test]
    fn test_autoregressive_inference() {
        // Test autoregressive generation without teacher forcing
        let mut config = LSTMAttentionConfig::default();
        config.base.input_size = 15;
        config.base.horizon = 8;
        config.base.num_features = 1;
        config.base.hidden_size = 24;
        config.teacher_forcing_ratio = 0.0; // No teacher forcing

        let model = LSTMAttentionModel::new(config).unwrap();

        let input = create_test_data(3, 15, 1).unwrap();

        // Pure autoregressive (no target)
        let output = model.forward(&input).unwrap();

        assert_eq!(output.dims(), &[3, 8, 1]);
    }

    #[test]
    fn test_different_batch_sizes() {
        // Test model with different batch sizes
        let mut config = LSTMAttentionConfig::default();
        config.base.input_size = 12;
        config.base.horizon = 6;
        config.base.num_features = 1;
        config.base.hidden_size = 16;

        let model = LSTMAttentionModel::new(config).unwrap();

        for batch_size in [1, 4, 8, 16] {
            let input = create_test_data(batch_size, 12, 1).unwrap();
            let output = model.forward(&input).unwrap();
            assert_eq!(output.dims(), &[batch_size, 6, 1]);
        }
    }

    #[test]
    fn test_multivariate_time_series() {
        // Test with multiple features
        let mut config = LSTMAttentionConfig::default();
        config.base.input_size = 20;
        config.base.horizon = 10;
        config.base.num_features = 5; // 5 features
        config.base.hidden_size = 32;

        let model = LSTMAttentionModel::new(config).unwrap();

        let input = create_test_data(2, 20, 5).unwrap();
        let output = model.forward(&input).unwrap();

        assert_eq!(output.dims(), &[2, 10, 5]);
    }

    #[test]
    fn test_attention_heads() {
        // Test different numbers of attention heads
        for num_heads in [1, 2, 4, 8] {
            let mut config = LSTMAttentionConfig::default();
            config.base.input_size = 16;
            config.base.horizon = 8;
            config.base.num_features = 1;
            config.base.hidden_size = 32; // Must be divisible by num_heads
            config.num_attention_heads = num_heads;

            let model = LSTMAttentionModel::new(config);
            assert!(model.is_ok(), "Failed with {} attention heads", num_heads);

            let input = create_test_data(2, 16, 1).unwrap();
            let output = model.unwrap().forward(&input).unwrap();
            assert_eq!(output.dims(), &[2, 8, 1]);
        }
    }

    #[test]
    fn test_gradient_flow() {
        // Test that model produces different outputs with different inputs
        let mut config = LSTMAttentionConfig::default();
        config.base.input_size = 10;
        config.base.horizon = 5;
        config.base.num_features = 1;
        config.base.hidden_size = 16;

        let model = LSTMAttentionModel::new(config).unwrap();

        let input1 = create_test_data(2, 10, 1).unwrap();
        let input2 = create_test_data(2, 10, 1).unwrap();

        let output1 = model.forward(&input1).unwrap();
        let output2 = model.forward(&input2).unwrap();

        // Outputs should be different for different inputs
        let diff = (output1 - output2).unwrap();
        let diff_sum: f32 = diff.abs().unwrap().sum_all().unwrap().to_scalar().unwrap();
        assert!(diff_sum > 1e-3, "Outputs are too similar");
    }

    #[test]
    fn test_parameter_count() {
        // Test parameter count calculation
        let config = LSTMAttentionConfig {
            base: ModelConfig {
                input_size: 24,
                horizon: 12,
                hidden_size: 64,
                num_features: 1,
                dropout: 0.1,
                device: None,
            },
            num_encoder_layers: 2,
            num_decoder_layers: 2,
            num_attention_heads: 8,
            bidirectional: true,
            teacher_forcing_ratio: 0.5,
            layer_norm: true,
            grad_clip: Some(1.0),
        };

        let model = LSTMAttentionModel::new(config).unwrap();
        let params = model.num_parameters();

        // Should have substantial number of parameters
        assert!(params > 100_000, "Parameter count seems too low: {}", params);
        assert!(params < 10_000_000, "Parameter count seems too high: {}", params);

        println!("Model parameters: {}", params);
    }

    #[test]
    fn test_unidirectional_encoder() {
        // Test with unidirectional encoder
        let mut config = LSTMAttentionConfig::default();
        config.base.input_size = 15;
        config.base.horizon = 7;
        config.base.num_features = 1;
        config.base.hidden_size = 24;
        config.bidirectional = false; // Unidirectional

        let model = LSTMAttentionModel::new(config).unwrap();

        let input = create_test_data(2, 15, 1).unwrap();
        let output = model.forward(&input).unwrap();

        assert_eq!(output.dims(), &[2, 7, 1]);
    }

    #[test]
    fn test_deep_networks() {
        // Test with more layers
        let mut config = LSTMAttentionConfig::default();
        config.base.input_size = 20;
        config.base.horizon = 10;
        config.base.num_features = 1;
        config.base.hidden_size = 32;
        config.num_encoder_layers = 4; // Deep encoder
        config.num_decoder_layers = 4; // Deep decoder

        let model = LSTMAttentionModel::new(config).unwrap();

        let input = create_test_data(2, 20, 1).unwrap();
        let output = model.forward(&input).unwrap();

        assert_eq!(output.dims(), &[2, 10, 1]);
    }

    #[test]
    fn test_long_sequence() {
        // Test with longer sequences
        let mut config = LSTMAttentionConfig::default();
        config.base.input_size = 100; // Long input
        config.base.horizon = 50; // Long forecast
        config.base.num_features = 1;
        config.base.hidden_size = 32;

        let model = LSTMAttentionModel::new(config).unwrap();

        let input = create_test_data(2, 100, 1).unwrap();
        let output = model.forward(&input).unwrap();

        assert_eq!(output.dims(), &[2, 50, 1]);
    }

    #[test]
    fn test_consistency() {
        // Test that model produces consistent output for same input
        let mut config = LSTMAttentionConfig::default();
        config.base.input_size = 10;
        config.base.horizon = 5;
        config.base.num_features = 1;
        config.base.hidden_size = 16;
        config.teacher_forcing_ratio = 0.0; // Deterministic

        let model = LSTMAttentionModel::new(config).unwrap();

        let input = Tensor::ones((2, 10, 1), DType::F32, &Device::Cpu).unwrap();

        // Run twice with same input
        let output1 = model.forward(&input).unwrap();
        let output2 = model.forward(&input).unwrap();

        // Outputs should be identical
        let diff = (output1 - output2).unwrap();
        let diff_sum: f32 = diff.abs().unwrap().sum_all().unwrap().to_scalar().unwrap();
        assert!(diff_sum < 1e-6, "Outputs are not consistent");
    }

    #[test]
    fn test_model_type() {
        use nt_neural::models::ModelType;

        let config = LSTMAttentionConfig::default();
        let model = LSTMAttentionModel::new(config).unwrap();

        assert_eq!(model.model_type(), ModelType::LSTMAttention);
    }

    #[test]
    fn test_config_defaults() {
        let config = LSTMAttentionConfig::default();

        assert_eq!(config.num_encoder_layers, 2);
        assert_eq!(config.num_decoder_layers, 2);
        assert_eq!(config.num_attention_heads, 8);
        assert!(config.bidirectional);
        assert_eq!(config.teacher_forcing_ratio, 0.5);
        assert!(config.layer_norm);
        assert_eq!(config.grad_clip, Some(1.0));
    }

    #[test]
    #[should_panic(expected = "must be divisible")]
    fn test_invalid_attention_heads() {
        // Test that invalid attention head configuration fails
        let mut config = LSTMAttentionConfig::default();
        config.base.hidden_size = 33; // Not divisible by 8
        config.num_attention_heads = 8;

        // This should panic because 33 is not divisible by 8
        let _model = LSTMAttentionModel::new(config).unwrap();
    }

    #[test]
    fn test_edge_cases() {
        // Test with minimal configuration
        let mut config = LSTMAttentionConfig::default();
        config.base.input_size = 2;
        config.base.horizon = 1;
        config.base.num_features = 1;
        config.base.hidden_size = 8;
        config.num_encoder_layers = 1;
        config.num_decoder_layers = 1;
        config.num_attention_heads = 1;

        let model = LSTMAttentionModel::new(config).unwrap();

        let input = create_test_data(1, 2, 1).unwrap();
        let output = model.forward(&input).unwrap();

        assert_eq!(output.dims(), &[1, 1, 1]);
    }
}

// Tests that work without candle feature
#[test]
fn test_config_serialization() {
    use nt_neural::models::lstm_attention::LSTMAttentionConfig;

    let config = LSTMAttentionConfig::default();

    // Test serialization
    let json = serde_json::to_string(&config).unwrap();
    let deserialized: LSTMAttentionConfig = serde_json::from_str(&json).unwrap();

    assert_eq!(config.num_encoder_layers, deserialized.num_encoder_layers);
    assert_eq!(config.num_decoder_layers, deserialized.num_decoder_layers);
    assert_eq!(config.num_attention_heads, deserialized.num_attention_heads);
    assert_eq!(config.bidirectional, deserialized.bidirectional);
}

#[test]
fn test_config_customization() {
    use nt_neural::models::lstm_attention::LSTMAttentionConfig;
    use nt_neural::models::ModelConfig;

    let config = LSTMAttentionConfig {
        base: ModelConfig {
            input_size: 50,
            horizon: 25,
            hidden_size: 128,
            num_features: 3,
            dropout: 0.2,
            #[cfg(feature = "candle")]
            device: None,
        },
        num_encoder_layers: 3,
        num_decoder_layers: 3,
        num_attention_heads: 16,
        bidirectional: false,
        teacher_forcing_ratio: 0.7,
        layer_norm: false,
        grad_clip: Some(5.0),
    };

    assert_eq!(config.base.input_size, 50);
    assert_eq!(config.base.horizon, 25);
    assert_eq!(config.num_encoder_layers, 3);
    assert!(!config.bidirectional);
}
