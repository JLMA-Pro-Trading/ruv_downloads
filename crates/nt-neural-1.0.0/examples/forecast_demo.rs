//! Neural forecasting demonstration example
//!
//! Shows how to use NHITS, LSTM-Attention, and Transformer models
//! for time series forecasting.

use nt_neural::{
    NHITSModel, NHITSConfig,
    LSTMAttentionModel, LSTMAttentionConfig,
    TransformerModel, TransformerConfig,
    ModelConfig, ModelType,
    initialize,
};
use candle_core::{Device, Tensor, DType};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    println!("🚀 Neural Forecasting Demo\n");

    // Initialize device (GPU if available)
    let device = initialize()?;
    println!("✅ Device: {:?}\n", device);

    // Demo configuration
    let input_size = 168; // 1 week of hourly data
    let horizon = 24;     // 24 hour forecast
    let batch_size = 2;

    // Create sample input data
    let input = Tensor::randn(
        0.0_f32,
        1.0,
        (batch_size, input_size),
        &device,
    )?;

    println!("📊 Input shape: {:?}\n", input.dims());

    // =========================================================================
    // NHITS Model Demo
    // =========================================================================
    println!("🧠 Testing NHITS Model...");

    let mut nhits_config = NHITSConfig::default();
    nhits_config.base.input_size = input_size;
    nhits_config.base.horizon = horizon;
    nhits_config.base.device = Some(device.clone());

    let nhits_model = NHITSModel::new(nhits_config)?;
    println!("  ✅ Created NHITS model");
    println!("  📊 Parameters: {}", nhits_model.num_parameters());

    let nhits_output = nhits_model.forward(&input)?;
    println!("  ✅ Forecast shape: {:?}", nhits_output.dims());

    // Quantile predictions
    let quantiles = nhits_model.predict_quantiles(&input)?;
    println!("  ✅ Generated {} quantile forecasts\n", quantiles.len());

    // =========================================================================
    // LSTM-Attention Model Demo
    // =========================================================================
    println!("🧠 Testing LSTM-Attention Model...");

    let mut lstm_config = LSTMAttentionConfig::default();
    lstm_config.base.input_size = input_size;
    lstm_config.base.horizon = horizon;
    lstm_config.base.device = Some(device.clone());
    lstm_config.base.num_features = 1;

    let lstm_model = LSTMAttentionModel::new(lstm_config)?;
    println!("  ✅ Created LSTM-Attention model");
    println!("  📊 Parameters: {}", lstm_model.num_parameters());

    // Reshape input for LSTM (batch, seq, features)
    let lstm_input = input.unsqueeze(2)?;
    let lstm_output = lstm_model.forward(&lstm_input)?;
    println!("  ✅ Forecast shape: {:?}\n", lstm_output.dims());

    // =========================================================================
    // Transformer Model Demo
    // =========================================================================
    println!("🧠 Testing Transformer Model...");

    let mut transformer_config = TransformerConfig::default();
    transformer_config.base.input_size = input_size;
    transformer_config.base.horizon = horizon;
    transformer_config.base.device = Some(device.clone());
    transformer_config.base.num_features = 1;

    let transformer_model = TransformerModel::new(transformer_config)?;
    println!("  ✅ Created Transformer model");
    println!("  📊 Parameters: {}", transformer_model.num_parameters());

    // Reshape input for Transformer
    let transformer_input = input.unsqueeze(2)?;
    let transformer_output = transformer_model.forward(&transformer_input)?;
    println!("  ✅ Forecast shape: {:?}\n", transformer_output.dims());

    // =========================================================================
    // Performance Comparison
    // =========================================================================
    println!("⚡ Performance Comparison");
    println!("  Model             | Parameters | Output Shape");
    println!("  ------------------|------------|-------------");
    println!("  NHITS             | {:>10} | {:?}", nhits_model.num_parameters(), nhits_output.dims());
    println!("  LSTM-Attention    | {:>10} | {:?}", lstm_model.num_parameters(), lstm_output.dims());
    println!("  Transformer       | {:>10} | {:?}", transformer_model.num_parameters(), transformer_output.dims());

    println!("\n✨ All models working correctly!");

    Ok(())
}
