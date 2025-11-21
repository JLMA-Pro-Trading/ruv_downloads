//! Verdict judgment - Compare predicted vs actual outcomes

use super::trajectory::Trajectory;
use serde::{Serialize, Deserialize};

/// Verdict result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Verdict {
    /// Prediction was correct within tolerance
    Correct { error: f64 },

    /// Prediction was incorrect
    Incorrect { error: f64 },

    /// Prediction was significantly wrong
    VeryWrong { error: f64 },

    /// Insufficient data
    Insufficient,
}

/// Verdict judgment result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerdictResult {
    /// Trajectory ID
    pub trajectory_id: String,

    /// Verdict
    pub verdict: Verdict,

    /// Accuracy score (0.0 - 1.0)
    pub accuracy: f64,

    /// Confidence in judgment
    pub confidence: f64,

    /// Feedback for learning
    pub feedback: String,
}

/// Verdict judge
pub struct VerdictJudge {
    /// Tolerance for "correct" predictions
    correct_tolerance: f64,

    /// Threshold for "very wrong"
    very_wrong_threshold: f64,
}

impl VerdictJudge {
    /// Create new verdict judge
    pub fn new() -> Self {
        Self {
            correct_tolerance: 0.05,      // 5% error
            very_wrong_threshold: 0.25,   // 25% error
        }
    }

    /// Configure tolerances
    pub fn with_tolerances(correct_tolerance: f64, very_wrong_threshold: f64) -> Self {
        Self {
            correct_tolerance,
            very_wrong_threshold,
        }
    }

    /// Judge trajectory
    pub fn judge(&self, trajectory: &Trajectory) -> VerdictResult {
        // Extract predictions and outcomes
        let predictions: Vec<f64> = trajectory
            .actions
            .iter()
            .filter_map(|a| a.predicted_outcome)
            .collect();

        let outcomes = &trajectory.outcomes;

        if predictions.is_empty() || outcomes.is_empty() {
            return VerdictResult {
                trajectory_id: trajectory.id.clone(),
                verdict: Verdict::Insufficient,
                accuracy: 0.0,
                confidence: 0.0,
                feedback: "Insufficient data for judgment".to_string(),
            };
        }

        // Calculate average error
        let mut total_error = 0.0;
        let mut count = 0;

        for (pred, actual) in predictions.iter().zip(outcomes.iter()) {
            let error = (pred - actual).abs() / actual.abs().max(1e-10);
            total_error += error;
            count += 1;
        }

        let avg_error = total_error / count as f64;

        // Determine verdict
        let verdict = if avg_error <= self.correct_tolerance {
            Verdict::Correct { error: avg_error }
        } else if avg_error >= self.very_wrong_threshold {
            Verdict::VeryWrong { error: avg_error }
        } else {
            Verdict::Incorrect { error: avg_error }
        };

        // Calculate accuracy score
        let accuracy = 1.0 - avg_error.min(1.0);

        // Calculate confidence based on sample size
        let confidence = (count as f64 / 10.0).min(1.0);

        // Generate feedback
        let feedback = match &verdict {
            Verdict::Correct { error } => {
                format!("Excellent prediction! Error: {:.2}%", error * 100.0)
            }
            Verdict::Incorrect { error } => {
                format!("Prediction needs improvement. Error: {:.2}%", error * 100.0)
            }
            Verdict::VeryWrong { error } => {
                format!(
                    "Significant prediction error. Consider retraining. Error: {:.2}%",
                    error * 100.0
                )
            }
            Verdict::Insufficient => "Need more data".to_string(),
        };

        VerdictResult {
            trajectory_id: trajectory.id.clone(),
            verdict,
            accuracy,
            confidence,
            feedback,
        }
    }

    /// Batch judge multiple trajectories
    pub fn judge_batch(&self, trajectories: &[Trajectory]) -> Vec<VerdictResult> {
        trajectories.iter().map(|t| self.judge(t)).collect()
    }

    /// Calculate overall accuracy from results
    pub fn calculate_overall_accuracy(&self, results: &[VerdictResult]) -> f64 {
        if results.is_empty() {
            return 0.0;
        }

        let total_accuracy: f64 = results.iter().map(|r| r.accuracy).sum();
        total_accuracy / results.len() as f64
    }
}

impl Default for VerdictJudge {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verdict_judge_correct() {
        let judge = VerdictJudge::new();

        let mut trajectory = Trajectory::new("agent_1".to_string());
        trajectory.add_action(
            "buy".to_string(),
            serde_json::json!({}),
            Some(100.0),
        );
        trajectory.add_outcome(102.0); // 2% error

        let result = judge.judge(&trajectory);

        match result.verdict {
            Verdict::Correct { .. } => (),
            _ => panic!("Expected Correct verdict"),
        }

        assert!(result.accuracy > 0.95);
    }

    #[test]
    fn test_verdict_judge_very_wrong() {
        let judge = VerdictJudge::new();

        let mut trajectory = Trajectory::new("agent_1".to_string());
        trajectory.add_action(
            "buy".to_string(),
            serde_json::json!({}),
            Some(100.0),
        );
        trajectory.add_outcome(150.0); // 50% error

        let result = judge.judge(&trajectory);

        match result.verdict {
            Verdict::VeryWrong { .. } => (),
            _ => panic!("Expected VeryWrong verdict"),
        }

        assert!(result.accuracy < 0.8);
    }

    #[test]
    fn test_batch_judgment() {
        let judge = VerdictJudge::new();

        let mut t1 = Trajectory::new("agent_1".to_string());
        t1.add_action("buy".to_string(), serde_json::json!({}), Some(100.0));
        t1.add_outcome(102.0);

        let mut t2 = Trajectory::new("agent_2".to_string());
        t2.add_action("sell".to_string(), serde_json::json!({}), Some(90.0));
        t2.add_outcome(88.0);

        let results = judge.judge_batch(&[t1, t2]);
        assert_eq!(results.len(), 2);

        let overall = judge.calculate_overall_accuracy(&results);
        assert!(overall > 0.9);
    }
}
