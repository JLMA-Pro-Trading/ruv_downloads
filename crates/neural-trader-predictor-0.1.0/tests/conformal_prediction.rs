//! Comprehensive tests for conformal prediction functionality
//! Integration tests for the core conformal prediction system

use neural_trader_predictor::{
    ConformalPredictor, scores::AbsoluteScore,
};

#[test]
fn test_conformal_basic_workflow() {
    let mut predictor = ConformalPredictor::new(0.1, AbsoluteScore);

    let predictions = vec![100.0, 105.0, 98.0, 102.0, 101.0, 99.5];
    let actuals = vec![102.0, 104.0, 99.0, 101.0, 100.5, 100.0];

    predictor.calibrate(&predictions, &actuals);
    assert!(predictor.is_calibrated());

    let interval = predictor.predict(103.0);
    assert!(interval.lower < interval.upper);
    assert_eq!(interval.alpha, 0.1);
}

#[test]
fn test_conformal_interval_properties() {
    let mut predictor = ConformalPredictor::new(0.1, AbsoluteScore);

    let predictions = vec![100.0, 105.0, 98.0, 102.0];
    let actuals = vec![102.0, 104.0, 99.0, 101.0];

    predictor.calibrate(&predictions, &actuals);
    let interval = predictor.predict(100.0);

    // Verify interval contains its point prediction
    assert!(interval.contains(interval.point));

    // Verify width calculation
    assert!(interval.width() > 0.0);
}

#[test]
fn test_conformal_with_large_dataset() {
    let mut predictor = ConformalPredictor::new(0.1, AbsoluteScore);

    let mut predictions = Vec::new();
    let mut actuals = Vec::new();

    for i in 0..100 {
        predictions.push(100.0 + (i as f64) * 0.1);
        actuals.push(100.0 + (i as f64) * 0.1 + (i as f64 % 5.0 - 2.5) * 0.5);
    }

    predictor.calibrate(&predictions, &actuals);

    let intervals: Vec<_> = (0..20)
        .map(|i| predictor.predict(100.0 + i as f64))
        .collect();

    assert_eq!(intervals.len(), 20);
    for interval in intervals {
        assert!(interval.lower < interval.upper);
    }
}

#[test]
fn test_conformal_multiple_alphas() {
    let alphas = vec![0.01, 0.05, 0.1, 0.2];
    let predictions = vec![100.0, 105.0, 98.0, 102.0];
    let actuals = vec![102.0, 104.0, 99.0, 101.0];

    for alpha in alphas {
        let mut predictor = ConformalPredictor::new(alpha, AbsoluteScore);
        predictor.calibrate(&predictions, &actuals);
        let interval = predictor.predict(100.0);

        assert_eq!(interval.alpha, alpha);
        assert!(interval.lower < interval.upper);
    }
}

#[test]
fn test_conformal_coverage_properties() {
    let mut predictor = ConformalPredictor::new(0.1, AbsoluteScore);

    let predictions = vec![100.0, 105.0, 98.0, 102.0, 101.0];
    let actuals = vec![102.0, 104.0, 99.0, 101.0, 100.5];

    predictor.calibrate(&predictions, &actuals);
    let interval = predictor.predict(103.0);

    // Coverage should be 1 - alpha
    assert_eq!(interval.coverage(), 0.9);
}
