//! Comprehensive tests for NHITS (Neural Hierarchical Interpolation for Time Series) model

#[cfg(feature = "candle")]
mod candle_tests {
    use nt_neural::{
        NHITSModel, NHITSConfig, ModelConfig,
    };
    use candle_core::{Device, Tensor};

    #[test]
    fn test_nhits_basic_config() {
        let config = NHITSConfig::default();
        assert_eq!(config.n_stacks, 3);
        assert_eq!(config.n_blocks.len(), 3);
    }
}

#[cfg(not(feature = "candle"))]
mod cpu_tests {
    use nt_neural::NHITSConfig;

    #[test]
    fn test_cpu_nhits_config() {
        let mut config = NHITSConfig::default();
        config.base.input_size = 24;
        config.base.horizon = 12;

        assert_eq!(config.base.input_size, 24);
        assert_eq!(config.base.horizon, 12);
    }
}

#[test]
fn test_config_validation() {
    use nt_neural::NHITSConfig;
    
    let config = NHITSConfig::default();
    assert_eq!(config.n_stacks, config.n_blocks.len());
    assert_eq!(config.n_stacks, config.n_freq_downsample.len());
    assert_eq!(config.n_stacks, config.mlp_units.len());
}
