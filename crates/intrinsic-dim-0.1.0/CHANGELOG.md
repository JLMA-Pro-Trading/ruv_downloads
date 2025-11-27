# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-11-27

### Added
- Initial release with novel Fourier feature emergence discovery
- Multiple estimation methods: PCA, MLE, TwoNN, and FourierEmergence
- Automatic sparsity detection (70% emergence threshold)
- Fast estimation with subsampling for large datasets
- Comprehensive benchmarks and examples
- Documentation of the 100→30 feature emergence phenomenon

### Novel Discovery
- First documentation of automatic 70% sparsity emergence in Random Fourier Features
- Ridge regression (L2) creating sparsity through RFF mechanism
- Quantitative pattern: 100 random features → 30 effective features
- Frequency-based self-organization of features

### Features
- `Estimator` API for simple dimensionality estimation
- `FourierEstimator` for exploring emergence behavior
- Utility functions for synthetic data generation
- Confidence interval calculation
- Support for parallel processing with optional rayon

### Performance
- 2ms for 1K × 100D data
- 45ms for 10K × 784D data
- 380ms for 100K × 1024D data

### Examples
- `basic_usage`: Simple getting started guide
- `image_compression`: Real-world image data analysis
- `fourier_features`: Deep dive into emergence
- `verify_emergence`: Reproducible verification of discovery

[0.1.0]: https://github.com/ruvnet/intrinsic-dim/releases/tag/v0.1.0