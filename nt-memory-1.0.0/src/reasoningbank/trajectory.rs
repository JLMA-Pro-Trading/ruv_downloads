//! Trajectory tracking for agent decision paths

use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Agent observation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Observation {
    /// Observation ID
    pub id: String,

    /// Timestamp
    pub timestamp: chrono::DateTime<chrono::Utc>,

    /// Observation data (JSON)
    pub data: serde_json::Value,

    /// Embedding vector
    pub embedding: Option<Vec<f32>>,
}

/// Agent action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    /// Action ID
    pub id: String,

    /// Timestamp
    pub timestamp: chrono::DateTime<chrono::Utc>,

    /// Action type
    pub action_type: String,

    /// Action parameters
    pub parameters: serde_json::Value,

    /// Predicted outcome
    pub predicted_outcome: Option<f64>,
}

/// Complete agent trajectory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trajectory {
    /// Trajectory ID
    pub id: String,

    /// Agent ID
    pub agent_id: String,

    /// Start timestamp
    pub start_time: chrono::DateTime<chrono::Utc>,

    /// End timestamp
    pub end_time: Option<chrono::DateTime<chrono::Utc>>,

    /// Observations
    pub observations: Vec<Observation>,

    /// Actions taken
    pub actions: Vec<Action>,

    /// Actual outcomes
    pub outcomes: Vec<f64>,

    /// Metadata
    pub metadata: serde_json::Value,
}

impl Trajectory {
    /// Create new trajectory
    pub fn new(agent_id: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            agent_id,
            start_time: chrono::Utc::now(),
            end_time: None,
            observations: Vec::new(),
            actions: Vec::new(),
            outcomes: Vec::new(),
            metadata: serde_json::json!({}),
        }
    }

    /// Add observation
    pub fn add_observation(&mut self, data: serde_json::Value, embedding: Option<Vec<f32>>) {
        self.observations.push(Observation {
            id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now(),
            data,
            embedding,
        });
    }

    /// Add action
    pub fn add_action(
        &mut self,
        action_type: String,
        parameters: serde_json::Value,
        predicted_outcome: Option<f64>,
    ) {
        self.actions.push(Action {
            id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now(),
            action_type,
            parameters,
            predicted_outcome,
        });
    }

    /// Add outcome
    pub fn add_outcome(&mut self, outcome: f64) {
        self.outcomes.push(outcome);
    }

    /// Complete trajectory
    pub fn complete(&mut self) {
        self.end_time = Some(chrono::Utc::now());
    }

    /// Check if trajectory is complete
    pub fn is_complete(&self) -> bool {
        self.end_time.is_some()
    }

    /// Calculate trajectory score
    pub fn score(&self) -> Option<f64> {
        if self.outcomes.is_empty() {
            return None;
        }

        let sum: f64 = self.outcomes.iter().sum();
        Some(sum / self.outcomes.len() as f64)
    }
}

/// Trajectory tracker
pub struct TrajectoryTracker {
    /// Active trajectories
    active: Arc<RwLock<std::collections::HashMap<String, Trajectory>>>,

    /// Completed trajectories
    completed: Arc<RwLock<Vec<Trajectory>>>,
}

impl TrajectoryTracker {
    /// Create new trajectory tracker
    pub fn new() -> Self {
        Self {
            active: Arc::new(RwLock::new(std::collections::HashMap::new())),
            completed: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Start new trajectory
    pub async fn start(&self, agent_id: String) -> String {
        let trajectory = Trajectory::new(agent_id);
        let id = trajectory.id.clone();

        let mut active = self.active.write().await;
        active.insert(id.clone(), trajectory);

        id
    }

    /// Track trajectory
    pub async fn track(&self, trajectory: Trajectory) -> anyhow::Result<()> {
        let mut active = self.active.write().await;
        active.insert(trajectory.id.clone(), trajectory);
        Ok(())
    }

    /// Get active trajectory
    pub async fn get_active(&self, id: &str) -> Option<Trajectory> {
        let active = self.active.read().await;
        active.get(id).cloned()
    }

    /// Complete trajectory
    pub async fn complete(&self, id: &str) -> anyhow::Result<()> {
        let mut active = self.active.write().await;

        if let Some(mut trajectory) = active.remove(id) {
            trajectory.complete();

            let mut completed = self.completed.write().await;
            completed.push(trajectory);
        }

        Ok(())
    }

    /// Get completed trajectories
    pub async fn get_completed(&self, agent_id: Option<&str>) -> Vec<Trajectory> {
        let completed = self.completed.read().await;

        if let Some(agent_id) = agent_id {
            completed
                .iter()
                .filter(|t| t.agent_id == agent_id)
                .cloned()
                .collect()
        } else {
            completed.clone()
        }
    }

    /// Count trajectories
    pub fn count(&self) -> usize {
        // Blocking read for stats
        let active = self.active.blocking_read();
        let completed = self.completed.blocking_read();
        active.len() + completed.len()
    }

    /// Get successful trajectories (score > 0.5)
    pub async fn get_successful(&self) -> Vec<Trajectory> {
        let completed = self.completed.read().await;

        completed
            .iter()
            .filter(|t| t.score().map(|s| s > 0.5).unwrap_or(false))
            .cloned()
            .collect()
    }
}

impl Default for TrajectoryTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_trajectory_creation() {
        let mut trajectory = Trajectory::new("agent_1".to_string());

        trajectory.add_observation(serde_json::json!({"price": 100.0}), None);
        trajectory.add_action(
            "buy".to_string(),
            serde_json::json!({"quantity": 10}),
            Some(110.0),
        );
        trajectory.add_outcome(105.0);

        assert_eq!(trajectory.observations.len(), 1);
        assert_eq!(trajectory.actions.len(), 1);
        assert_eq!(trajectory.outcomes.len(), 1);
    }

    #[tokio::test]
    async fn test_trajectory_tracker() {
        let tracker = TrajectoryTracker::new();

        // Start trajectory
        let id = tracker.start("agent_1".to_string()).await;

        // Get active
        let trajectory = tracker.get_active(&id).await;
        assert!(trajectory.is_some());

        // Complete
        tracker.complete(&id).await.unwrap();

        // Should be in completed
        let completed = tracker.get_completed(Some("agent_1")).await;
        assert_eq!(completed.len(), 1);
    }

    #[test]
    fn test_trajectory_score() {
        let mut trajectory = Trajectory::new("agent_1".to_string());

        trajectory.add_outcome(0.8);
        trajectory.add_outcome(0.6);
        trajectory.add_outcome(0.7);

        let score = trajectory.score().unwrap();
        assert!((score - 0.7).abs() < 0.01);
    }
}
