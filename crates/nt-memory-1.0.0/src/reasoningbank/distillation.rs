//! Memory distillation - Compress and extract patterns from trajectories

use super::trajectory::Trajectory;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

/// Distilled pattern from multiple trajectories
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistilledPattern {
    /// Pattern ID
    pub id: String,

    /// Pattern type
    pub pattern_type: String,

    /// Centroid embedding
    pub centroid: Vec<f32>,

    /// Supporting trajectories
    pub trajectory_ids: Vec<String>,

    /// Pattern strength (0.0 - 1.0)
    pub strength: f64,

    /// Metadata
    pub metadata: serde_json::Value,
}

/// Memory distiller
pub struct MemoryDistiller {
    /// Enable compression
    enable_compression: bool,

    /// Minimum trajectories for pattern
    min_trajectories: usize,

    /// Similarity threshold for clustering
    similarity_threshold: f64,
}

impl MemoryDistiller {
    /// Create new distiller
    pub fn new(enable_compression: bool) -> Self {
        Self {
            enable_compression,
            min_trajectories: 3,
            similarity_threshold: 0.8,
        }
    }

    /// Configure distillation parameters
    pub fn with_params(
        enable_compression: bool,
        min_trajectories: usize,
        similarity_threshold: f64,
    ) -> Self {
        Self {
            enable_compression,
            min_trajectories,
            similarity_threshold,
        }
    }

    /// Distill patterns from trajectories
    pub async fn distill(&self, trajectories: &[Trajectory]) -> Vec<DistilledPattern> {
        // Group trajectories by agent
        let mut by_agent: HashMap<String, Vec<&Trajectory>> = HashMap::new();

        for trajectory in trajectories {
            by_agent
                .entry(trajectory.agent_id.clone())
                .or_insert_with(Vec::new)
                .push(trajectory);
        }

        let mut patterns = Vec::new();

        // Distill patterns per agent
        for (agent_id, agent_trajectories) in by_agent {
            if agent_trajectories.len() < self.min_trajectories {
                continue;
            }

            // Extract embeddings from observations
            let embeddings: Vec<Vec<f32>> = agent_trajectories
                .iter()
                .flat_map(|t| &t.observations)
                .filter_map(|obs| obs.embedding.clone())
                .collect();

            if embeddings.is_empty() {
                continue;
            }

            // Calculate centroid
            let centroid = self.calculate_centroid(&embeddings);

            // Calculate pattern strength (based on clustering tightness)
            let strength = self.calculate_pattern_strength(&embeddings, &centroid);

            // Create pattern
            let pattern = DistilledPattern {
                id: uuid::Uuid::new_v4().to_string(),
                pattern_type: "agent_behavior".to_string(),
                centroid,
                trajectory_ids: agent_trajectories.iter().map(|t| t.id.clone()).collect(),
                strength,
                metadata: serde_json::json!({
                    "agent_id": agent_id,
                    "trajectory_count": agent_trajectories.len(),
                }),
            };

            patterns.push(pattern);
        }

        // Compress if enabled
        if self.enable_compression {
            self.compress_patterns(&mut patterns);
        }

        patterns
    }

    /// Calculate centroid of embeddings
    fn calculate_centroid(&self, embeddings: &[Vec<f32>]) -> Vec<f32> {
        if embeddings.is_empty() {
            return Vec::new();
        }

        let dimension = embeddings[0].len();
        let count = embeddings.len() as f32;

        let mut centroid = vec![0.0; dimension];

        for embedding in embeddings {
            for (i, &value) in embedding.iter().enumerate() {
                centroid[i] += value / count;
            }
        }

        // Normalize
        let magnitude: f32 = centroid.iter().map(|x| x * x).sum::<f32>().sqrt();
        if magnitude > 0.0 {
            centroid.iter_mut().for_each(|x| *x /= magnitude);
        }

        centroid
    }

    /// Calculate pattern strength based on clustering tightness
    fn calculate_pattern_strength(&self, embeddings: &[Vec<f32>], centroid: &[f32]) -> f64 {
        if embeddings.is_empty() || centroid.is_empty() {
            return 0.0;
        }

        // Calculate average cosine similarity to centroid
        let mut total_similarity = 0.0;

        for embedding in embeddings {
            let similarity = cosine_similarity(embedding, centroid);
            total_similarity += similarity;
        }

        let avg_similarity = total_similarity / embeddings.len() as f64;

        // Normalize to 0-1 range (cosine similarity is -1 to 1)
        (avg_similarity + 1.0) / 2.0
    }

    /// Compress patterns using LZ4
    fn compress_patterns(&self, patterns: &mut [DistilledPattern]) {
        use lz4::EncoderBuilder;
        use std::io::Write;

        for pattern in patterns.iter_mut() {
            // Serialize embedding
            let bytes = bincode::serialize(&pattern.centroid).unwrap();

            // Compress
            let mut encoder = EncoderBuilder::new()
                .level(4)
                .build(Vec::new())
                .unwrap();

            encoder.write_all(&bytes).unwrap();
            let (compressed, _) = encoder.finish();

            // Store compression ratio in metadata
            let ratio = compressed.len() as f64 / bytes.len() as f64;

            if let Some(obj) = pattern.metadata.as_object_mut() {
                obj.insert("compression_ratio".to_string(), serde_json::json!(ratio));
                obj.insert("original_size".to_string(), serde_json::json!(bytes.len()));
                obj.insert("compressed_size".to_string(), serde_json::json!(compressed.len()));
            }
        }
    }

    /// Merge similar patterns
    pub fn merge_similar(&self, patterns: &[DistilledPattern]) -> Vec<DistilledPattern> {
        let mut merged = Vec::new();
        let mut used = vec![false; patterns.len()];

        for i in 0..patterns.len() {
            if used[i] {
                continue;
            }

            let mut cluster = vec![i];

            // Find similar patterns
            for j in (i + 1)..patterns.len() {
                if used[j] {
                    continue;
                }

                let similarity = cosine_similarity(&patterns[i].centroid, &patterns[j].centroid);

                if similarity >= self.similarity_threshold {
                    cluster.push(j);
                    used[j] = true;
                }
            }

            // Merge cluster into single pattern
            let cluster_patterns: Vec<&DistilledPattern> =
                cluster.iter().map(|&idx| &patterns[idx]).collect();

            let merged_pattern = self.merge_cluster(&cluster_patterns);
            merged.push(merged_pattern);

            used[i] = true;
        }

        merged
    }

    /// Merge cluster of patterns
    fn merge_cluster(&self, patterns: &[&DistilledPattern]) -> DistilledPattern {
        // Collect all embeddings
        let embeddings: Vec<Vec<f32>> = patterns.iter().map(|p| p.centroid.clone()).collect();

        // Calculate new centroid
        let centroid = self.calculate_centroid(&embeddings);

        // Collect all trajectory IDs
        let trajectory_ids: Vec<String> = patterns
            .iter()
            .flat_map(|p| p.trajectory_ids.clone())
            .collect();

        // Calculate merged strength
        let strength = patterns.iter().map(|p| p.strength).sum::<f64>() / patterns.len() as f64;

        DistilledPattern {
            id: uuid::Uuid::new_v4().to_string(),
            pattern_type: patterns[0].pattern_type.clone(),
            centroid,
            trajectory_ids,
            strength,
            metadata: serde_json::json!({
                "merged_from": patterns.len(),
                "pattern_ids": patterns.iter().map(|p| p.id.clone()).collect::<Vec<_>>(),
            }),
        }
    }
}

/// Helper: Cosine similarity
fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if mag_a > 0.0 && mag_b > 0.0 {
        (dot / (mag_a * mag_b)) as f64
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_distillation() {
        let distiller = MemoryDistiller::new(false);

        // Create trajectories with embeddings
        let mut trajectories = Vec::new();

        for i in 0..5 {
            let mut trajectory = Trajectory::new("agent_1".to_string());

            let embedding = vec![0.5 + i as f32 * 0.01; 128];
            trajectory.add_observation(serde_json::json!({"i": i}), Some(embedding));

            trajectories.push(trajectory);
        }

        let patterns = distiller.distill(&trajectories).await;

        assert!(!patterns.is_empty());
        assert_eq!(patterns[0].trajectory_ids.len(), 5);
    }

    #[test]
    fn test_centroid_calculation() {
        let distiller = MemoryDistiller::new(false);

        let embeddings = vec![
            vec![1.0, 0.0],
            vec![0.0, 1.0],
            vec![1.0, 1.0],
        ];

        let centroid = distiller.calculate_centroid(&embeddings);

        // Should be normalized average
        assert!(centroid.len() == 2);
        assert!(centroid[0] > 0.0 && centroid[1] > 0.0);
    }

    #[test]
    fn test_pattern_merging() {
        let distiller = MemoryDistiller::new(false);

        let pattern1 = DistilledPattern {
            id: "p1".to_string(),
            pattern_type: "test".to_string(),
            centroid: vec![1.0, 0.0],
            trajectory_ids: vec!["t1".to_string()],
            strength: 0.9,
            metadata: serde_json::json!({}),
        };

        let pattern2 = DistilledPattern {
            id: "p2".to_string(),
            pattern_type: "test".to_string(),
            centroid: vec![0.9, 0.1], // Very similar
            trajectory_ids: vec!["t2".to_string()],
            strength: 0.85,
            metadata: serde_json::json!({}),
        };

        let merged = distiller.merge_similar(&[pattern1, pattern2]);

        // Should merge into single pattern
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].trajectory_ids.len(), 2);
    }
}
