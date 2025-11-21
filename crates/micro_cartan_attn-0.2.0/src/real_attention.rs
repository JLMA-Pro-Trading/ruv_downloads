//! Real scaled dot-product attention implementation

use alloc::{vec, vec::Vec};
use crate::{RootVector, Result, Error, ROOT_DIM};
use libm::{expf, sqrtf, roundf};

/// Scaled dot-product attention mechanism
/// 
/// This implements the core attention mechanism: Attention(Q,K,V) = softmax(QK^T/√d_k)V
pub struct ScaledDotProductAttention {
    /// Temperature scaling factor (typically 1/√d_k)
    pub temperature: f32,
}

impl ScaledDotProductAttention {
    /// Create new scaled dot-product attention
    pub fn new() -> Self {
        Self {
            temperature: 1.0 / sqrtf(ROOT_DIM as f32),
        }
    }
    
    /// Create with custom temperature
    pub fn with_temperature(temperature: f32) -> Self {
        Self { temperature }
    }
    
    /// Apply attention to a sequence of vectors
    pub fn forward(&self, 
                   queries: &[RootVector], 
                   keys: &[RootVector], 
                   values: &[RootVector]) -> Result<Vec<RootVector>> {
        let seq_len = queries.len();
        if seq_len == 0 || keys.len() != seq_len || values.len() != seq_len {
            return Err(Error::InvalidInput("Empty input or mismatched sequence lengths".into()));
        }
        
        // Compute attention scores: Q * K^T
        let mut attention_scores = vec![vec![0.0f32; seq_len]; seq_len];
        
        for i in 0..seq_len {
            for j in 0..seq_len {
                let mut dot_product = 0.0f32;
                for k in 0..ROOT_DIM {
                    dot_product += queries[i][k] * keys[j][k];
                }
                attention_scores[i][j] = dot_product * self.temperature;
            }
        }
        
        // Apply softmax to get attention weights
        for i in 0..seq_len {
            // Find max for numerical stability
            let mut max_score = attention_scores[i][0];
            for j in 1..seq_len {
                if attention_scores[i][j] > max_score {
                    max_score = attention_scores[i][j];
                }
            }
            
            // Compute exp and sum
            let mut sum = 0.0f32;
            for j in 0..seq_len {
                attention_scores[i][j] = expf(attention_scores[i][j] - max_score);
                sum += attention_scores[i][j];
            }
            
            // Normalize
            if sum > 1e-8 {
                for j in 0..seq_len {
                    attention_scores[i][j] /= sum;
                }
            }
        }
        
        // Apply attention to values
        let mut output = Vec::with_capacity(seq_len);
        for i in 0..seq_len {
            let mut attended_value = RootVector::zero();
            
            for j in 0..seq_len {
                let weight = attention_scores[i][j];
                for k in 0..ROOT_DIM {
                    attended_value[k] += weight * values[j][k];
                }
            }
            
            output.push(attended_value);
        }
        
        Ok(output)
    }
    
    /// Get attention weights for visualization
    pub fn get_attention_weights(&self,
                                queries: &[RootVector], 
                                keys: &[RootVector]) -> Result<Vec<Vec<f32>>> {
        let seq_len = queries.len();
        if seq_len == 0 || keys.len() != seq_len {
            return Err(Error::InvalidInput("Empty input or mismatched sequence lengths".into()));
        }
        
        let mut attention_scores = vec![vec![0.0f32; seq_len]; seq_len];
        
        for i in 0..seq_len {
            for j in 0..seq_len {
                let mut dot_product = 0.0f32;
                for k in 0..ROOT_DIM {
                    dot_product += queries[i][k] * keys[j][k];
                }
                attention_scores[i][j] = dot_product * self.temperature;
            }
        }
        
        // Apply softmax
        for i in 0..seq_len {
            let mut max_score = attention_scores[i][0];
            for j in 1..seq_len {
                if attention_scores[i][j] > max_score {
                    max_score = attention_scores[i][j];
                }
            }
            
            let mut sum = 0.0f32;
            for j in 0..seq_len {
                attention_scores[i][j] = expf(attention_scores[i][j] - max_score);
                sum += attention_scores[i][j];
            }
            
            if sum > 1e-8 {
                for j in 0..seq_len {
                    attention_scores[i][j] /= sum;
                }
            }
        }
        
        Ok(attention_scores)
    }
}

/// Rank-1 attention for efficient routing
/// 
/// This constrains the attention matrix to be rank-1: A = uv^T
/// where u and v are learned vectors. More efficient for routing tasks.
pub struct RankOneAttention {
    /// Query projection vector
    pub query_vector: RootVector,
    /// Key projection vector  
    pub key_vector: RootVector,
    /// Temperature scaling
    pub temperature: f32,
}

impl RankOneAttention {
    /// Create new rank-1 attention with random initialization
    pub fn new() -> Self {
        let mut query_vector = RootVector::zero();
        let mut key_vector = RootVector::zero();
        
        // Simple random initialization (replace with proper random when available)
        for i in 0..ROOT_DIM {
            query_vector[i] = ((i * 17 + 42) % 100) as f32 / 1000.0 - 0.05; // Poor man's random
            key_vector[i] = ((i * 23 + 17) % 100) as f32 / 1000.0 - 0.05;
        }
        
        Self {
            query_vector,
            key_vector,
            temperature: 1.0 / sqrtf(ROOT_DIM as f32),
        }
    }
    
    /// Forward pass for rank-1 attention
    pub fn forward(&self, 
                   queries: &[RootVector],
                   keys: &[RootVector], 
                   values: &[RootVector]) -> Result<Vec<RootVector>> {
        let seq_len = queries.len();
        if seq_len == 0 || keys.len() != seq_len || values.len() != seq_len {
            return Err(Error::InvalidInput("Empty input or mismatched sequence lengths".into()));
        }
        
        // Compute query projections: queries . query_vector
        let mut query_scores = vec![0.0f32; seq_len];
        for i in 0..seq_len {
            for k in 0..ROOT_DIM {
                query_scores[i] += queries[i][k] * self.query_vector[k];
            }
            query_scores[i] *= self.temperature;
        }
        
        // Compute key projections: keys . key_vector
        let mut key_scores = vec![0.0f32; seq_len];
        for i in 0..seq_len {
            for k in 0..ROOT_DIM {
                key_scores[i] += keys[i][k] * self.key_vector[k];
            }
            key_scores[i] *= self.temperature;
        }
        
        // Apply softmax to query scores
        let query_max = query_scores.iter().fold(f32::NEG_INFINITY, |a, &b| if a > b { a } else { b });
        let mut query_sum = 0.0f32;
        for score in &mut query_scores {
            *score = expf(*score - query_max);
            query_sum += *score;
        }
        if query_sum > 1e-8 {
            for score in &mut query_scores {
                *score /= query_sum;
            }
        }
        
        // For rank-1 attention, we use the query weights to combine values
        // This is a simplification - full rank-1 would be more complex
        let mut global_attended = RootVector::zero();
        for i in 0..seq_len {
            let weight = query_scores[i];
            for k in 0..ROOT_DIM {
                global_attended[k] += weight * values[i][k];
            }
        }
        
        // Broadcast to all positions (routing behavior)
        Ok(vec![global_attended; seq_len])
    }
}

/// Multi-head attention with mixed rank-1 and full-rank heads
pub struct MultiHeadAttention {
    /// Full-rank attention heads
    pub full_heads: Vec<ScaledDotProductAttention>,
    /// Rank-1 attention heads  
    pub rank1_heads: Vec<RankOneAttention>,
    /// Number of heads
    pub num_heads: usize,
}

impl MultiHeadAttention {
    /// Create multi-head attention with specified number of heads
    /// 
    /// Args:
    /// - num_heads: Total number of attention heads
    /// - rank1_fraction: Fraction of heads that should be rank-1 (0.0 to 1.0)
    pub fn new(num_heads: usize, rank1_fraction: f32) -> Self {
        let num_rank1 = (roundf(num_heads as f32 * rank1_fraction) as usize).min(num_heads);
        let num_full = num_heads - num_rank1;
        
        let mut full_heads = Vec::with_capacity(num_full);
        let mut rank1_heads = Vec::with_capacity(num_rank1);
        
        // Create full-rank heads
        for _ in 0..num_full {
            full_heads.push(ScaledDotProductAttention::new());
        }
        
        // Create rank-1 heads
        for _ in 0..num_rank1 {
            rank1_heads.push(RankOneAttention::new());
        }
        
        Self {
            full_heads,
            rank1_heads,
            num_heads,
        }
    }
    
    /// Forward pass through all heads
    pub fn forward(&self, vectors: &[RootVector]) -> Result<Vec<RootVector>> {
        if vectors.is_empty() {
            return Ok(Vec::new());
        }
        
        let seq_len = vectors.len();
        let mut all_outputs = Vec::new();
        
        // Process full-rank heads
        for head in &self.full_heads {
            let output = head.forward(vectors, vectors, vectors)?;
            all_outputs.push(output);
        }
        
        // Process rank-1 heads
        for head in &self.rank1_heads {
            let output = head.forward(vectors, vectors, vectors)?;
            all_outputs.push(output);
        }
        
        // Combine outputs by averaging
        let mut combined = vec![RootVector::zero(); seq_len];
        for seq_idx in 0..seq_len {
            for head_outputs in &all_outputs {
                for dim in 0..ROOT_DIM {
                    combined[seq_idx][dim] += head_outputs[seq_idx][dim];
                }
            }
            
            // Average across heads
            let scale = 1.0 / self.num_heads as f32;
            for dim in 0..ROOT_DIM {
                combined[seq_idx][dim] *= scale;
            }
        }
        
        Ok(combined)
    }
    
    /// Get number of rank-1 heads
    pub fn num_rank1_heads(&self) -> usize {
        self.rank1_heads.len()
    }
    
    /// Get number of full-rank heads
    pub fn num_full_heads(&self) -> usize {
        self.full_heads.len()
    }
}

impl Default for ScaledDotProductAttention {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for RankOneAttention {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_scaled_dot_product_attention() {
        let attention = ScaledDotProductAttention::new();
        
        // Create test vectors
        let mut vectors = Vec::new();
        for i in 0..3 {
            let mut v = RootVector::zero();
            v[i] = 1.0;
            vectors.push(v);
        }
        
        let result = attention.forward(&vectors, &vectors, &vectors).unwrap();
        assert_eq!(result.len(), 3);
    }
    
    #[test]
    fn test_rank_one_attention() {
        let attention = RankOneAttention::new();
        
        let mut vectors = Vec::new();
        for i in 0..3 {
            let mut v = RootVector::zero();
            v[i] = 1.0;
            vectors.push(v);
        }
        
        let result = attention.forward(&vectors, &vectors, &vectors).unwrap();
        assert_eq!(result.len(), 3);
        
        // For rank-1 attention, all outputs should be the same (routing behavior)
        for i in 1..result.len() {
            assert_eq!(result[0].data.as_slice(), result[i].data.as_slice());
        }
    }
    
    #[test]
    fn test_multi_head_attention() {
        let attention = MultiHeadAttention::new(8, 0.25); // 25% rank-1 heads
        
        let mut vectors = Vec::new();
        for i in 0..4 {
            let mut v = RootVector::zero();
            v[i] = 1.0;
            vectors.push(v);
        }
        
        let result = attention.forward(&vectors).unwrap();
        assert_eq!(result.len(), 4);
        assert_eq!(attention.num_rank1_heads(), 2);  // 25% of 8 = 2
        assert_eq!(attention.num_full_heads(), 6);   // 75% of 8 = 6
    }
}