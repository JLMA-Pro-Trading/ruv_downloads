# micro_metrics - Performance Monitoring Framework

[![Crates.io](https://img.shields.io/crates/v/micro_metrics.svg)](https://crates.io/crates/micro_metrics)
[![Documentation](https://docs.rs/micro_metrics/badge.svg)](https://docs.rs/micro_metrics)
[![License](https://img.shields.io/badge/license-Apache%202.0%20OR%20MIT-blue.svg)](LICENSE)

**Basic performance monitoring and metrics collection framework**

This crate provides a foundation for collecting and exporting performance metrics from the Semantic Cartan Matrix system. It offers basic timing, data collection, and JSON export capabilities.

## ✅ Implemented Features

- **MetricsCollector**: Basic metrics collection with timing support
- **Timer**: Cross-platform timing functionality
- **JsonExporter**: Export metrics to JSON format for dashboards
- **DashboardData**: Basic data structures for visualization
- **HeatmapData**: Data format for attention/correlation heatmaps

## ❌ Not Yet Implemented

- **Real-time Streaming**: No WebSocket or live updates
- **Prometheus Integration**: No Prometheus export functionality
- **Advanced Analytics**: No drift detection or regression analysis
- **System Metrics**: No CPU/memory monitoring integration
- **Dashboard Server**: No actual web dashboard implementation

## 📦 Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
micro_metrics = { path = "../micro_metrics" }
```

## 🏗️ Core Components

### MetricsCollector

Basic metrics collection and aggregation:

```rust
use micro_metrics::{MetricsCollector, SystemMetrics, AgentMetrics};

// Create collector (basic implementation)
let collector = MetricsCollector::new();

// Record basic metrics (implementation varies)
// Note: Actual API may differ from this example
```

### Timer

Cross-platform timing functionality:

```rust
use micro_metrics::{Timer, TimingInfo};

// Create and use timer
let timer = Timer::new();
let timing_info = timer.measure(|| {
    // Code to time
    expensive_operation();
});

println!("Operation took: {:?}", timing_info.duration);
```

### JSON Export

Export metrics in JSON format:

```rust
use micro_metrics::{JsonExporter, MetricsReport};

let exporter = JsonExporter::new();

// Export basic metrics to JSON
let json_report = exporter.export_metrics(&collector)?;
println!("Metrics JSON: {}", json_report);
```

### Dashboard Data

Basic data structures for visualization:

```rust
use micro_metrics::{DashboardData, HeatmapData};

// Create dashboard-compatible data
let dashboard_data = DashboardData {
    timestamp: std::time::SystemTime::now(),
    metrics: collector.get_current_metrics(),
    // ... other basic fields
};

// Create heatmap data for attention visualization
let heatmap = HeatmapData {
    width: 32,
    height: 32,
    data: attention_matrix.flatten(),
    // ... other visualization data
};
```

## 📊 Current Implementation Status

### What Works
- Basic metrics collection structures
- Simple timing functionality
- JSON serialization of basic data
- Integration with micro_core types
- no_std compatibility (limited features)

### What's Limited
- No complex aggregations or analytics
- No real-time data streaming
- No advanced visualizations
- No system resource monitoring
- No performance regression detection

## 🔧 Configuration

### Feature Flags

```toml
[features]
default = ["std"]
std = ["serde/std", "serde_json/std"]
system-metrics = []          # System monitoring (not implemented)
prometheus = []              # Prometheus export (not implemented)
dashboard = []               # Web dashboard (not implemented)
```

### Basic Usage

```rust
use micro_metrics::{MetricsCollector, Timer};

// Initialize collector
let mut collector = MetricsCollector::new();

// Time operations
let timer = Timer::start("operation_name".to_string());
perform_neural_network_inference();
let duration = timer.stop();

// Store timing result
collector.record_timing(duration);

// Export for analysis
let json_metrics = collector.export_json()?;
```

## 📈 Planned Architecture

The following describes intended functionality, not current implementation:

### Advanced Metrics Collection
```rust
// PLANNED API (not fully implemented)
use micro_metrics::{
    PerformanceMetrics, DriftTracker, RegressionDetector
};

let mut metrics = PerformanceMetrics::new();
metrics.record_latency("inference", 1.2);
metrics.record_throughput("tokens_per_second", 15420.0);

let drift_tracker = DriftTracker::new();
let regression_detector = RegressionDetector::new();
```

### Real-time Dashboard
```rust
// PLANNED API (not implemented)
use micro_metrics::{DashboardServer, MetricsStreamer};

let dashboard = DashboardServer::new("0.0.0.0:8080");
dashboard.start().await?;

let streamer = MetricsStreamer::new();
streamer.stream_to_dashboard(&metrics).await?;
```

### Prometheus Integration
```rust
// PLANNED API (not implemented)
use micro_metrics::PrometheusExporter;

let exporter = PrometheusExporter::new();
exporter.register_counter("inferences_total");
exporter.export_to_gateway("http://prometheus:9091").await?;
```

## 🧪 Testing

```bash
# Run basic tests
cargo test

# Test JSON export functionality
cargo test --features std

# Test system metrics (when implemented)
cargo test --features system-metrics
```

## ⚠️ Current Limitations

1. **Basic Implementation**: Most functionality is minimal
2. **No Real-time Features**: No streaming or live updates
3. **Limited Analytics**: No advanced statistical analysis
4. **No Dashboard**: No actual web interface
5. **Platform Support**: Limited cross-platform monitoring
6. **Performance**: Not optimized for high-frequency metrics

## 📋 Implementation Roadmap

### Phase 1: Core Functionality
- [ ] Complete basic metrics collection
- [ ] Add comprehensive timing support
- [ ] Implement proper JSON export
- [ ] Add basic statistical aggregations

### Phase 2: Advanced Features
- [ ] Real-time metrics streaming
- [ ] Prometheus export integration
- [ ] System resource monitoring
- [ ] Performance regression detection

### Phase 3: Dashboard & Visualization
- [ ] Web-based dashboard implementation
- [ ] Real-time chart updates
- [ ] Attention matrix heatmaps
- [ ] Historical data analysis

## 📚 Examples

Current examples would demonstrate:

- Basic timing and metrics collection
- JSON export for external analysis
- Integration with neural network operations

Planned examples:

- Real-time dashboard setup
- Prometheus monitoring integration
- Advanced performance analysis

## 🤝 Contributing

Priority areas for contribution:

1. **Core Implementation**: Complete basic metrics functionality
2. **Real-time Features**: Add streaming and live updates
3. **Dashboard**: Implement web-based monitoring interface
4. **Testing**: Add comprehensive test coverage
5. **Performance**: Optimize for high-frequency data collection

## 📄 License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](../LICENSE-APACHE))
- MIT License ([LICENSE-MIT](../LICENSE-MIT))

at your option.

## 🔗 Related Crates

- [`micro_core`](../micro_core): Core types being monitored
- [`micro_cartan_attn`](../micro_cartan_attn): Attention mechanisms with metrics
- [`micro_routing`](../micro_routing): Routing performance monitoring
- [`micro_swarm`](../micro_swarm): High-level orchestration metrics

---

**Part of the rUv-FANN Semantic Cartan Matrix system** - Basic metrics collection for neural network monitoring.