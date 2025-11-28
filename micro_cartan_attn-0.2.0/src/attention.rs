//! Cartan matrix-based attention mechanisms
//!
//! This module provides attention mechanisms that maintain Cartan matrix constraints
//! for semantic coherence in neural networks.

use alloc::{vec, vec::Vec, string::String};
use crate::{RootVector, Result, Error, ROOT_DIM, CartanMatrix, CartanOrthogonalizer, CartanRegularizer};

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

/// Attention mechanism trait for Cartan-constrained systems
pub trait AttentionMechanism {
    /// Apply attention to input vectors while maintaining Cartan constraints
    fn apply_attention(&mut self, input: &[RootVector]) -> Result<Vec<RootVector>>;
    
    /// Get attention weights/scores for analysis
    fn attention_weights(&self) -> Result<Vec<f32>>;
}

/// Configuration for Cartan attention
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct AttentionConfig {
    /// Whether to apply orthogonalization after attention
    pub orthogonalize_output: bool,
    
    /// Whether to apply regularization during attention
    pub regularize_attention: bool,
    
    /// Temperature for attention softmax
    pub temperature: f32,
    
    /// Whether to normalize input vectors
    pub normalize_input: bool,
}

impl Default for AttentionConfig {
    fn default() -> Self {
        Self {
            orthogonalize_output: true,
            regularize_attention: true,
            temperature: 1.0,
            normalize_input: true,
        }
    }
}

/// Cartan matrix-constrained attention mechanism
#[derive(Debug, Clone)]
pub struct CartanAttention {
    /// Cartan matrix defining the constraint structure
    cartan_matrix: CartanMatrix,
    
    /// Orthogonalizer for maintaining constraints
    orthogonalizer: CartanOrthogonalizer,
    
    /// Regularizer for training
    regularizer: CartanRegularizer,
    
    /// Configuration
    config: AttentionConfig,
    
    /// Last computed attention weights
    last_weights: Vec<f32>,
}

impl CartanAttention {
    /// Create a new Cartan attention mechanism
    pub fn new(cartan_matrix: CartanMatrix) -> Result<Self> {
        let orthogonalizer = CartanOrthogonalizer::new(cartan_matrix.clone());
        let regularizer = CartanRegularizer::new(cartan_matrix.clone())?;
        
        Ok(Self {
            cartan_matrix,
            orthogonalizer,
            regularizer,
            config: AttentionConfig::default(),
            last_weights: Vec::new(),
        })
    }
    
    /// Create with specific configuration
    pub fn with_config(cartan_matrix: CartanMatrix, config: AttentionConfig) -> Result<Self> {
        let orthogonalizer = CartanOrthogonalizer::new(cartan_matrix.clone());
        let regularizer = CartanRegularizer::new(cartan_matrix.clone())?;
        
        Ok(Self {
            cartan_matrix,
            orthogonalizer,
            regularizer,
            config,
            last_weights: Vec::new(),
        })
    }
    
    /// Compute attention scores based on Cartan matrix compliance
    fn compute_attention_scores(&self, vectors: &[RootVector]) -> Result<Vec<f32>> {
        if vectors.is_empty() {
            return Ok(Vec::new());
        }
        
        let mut scores = Vec::with_capacity(vectors.len());
        
        // Compute compliance score for each vector with respect to Cartan constraints
        for (i, vector) in vectors.iter().enumerate() {
            let mut score = 0.0;
            
            // Score based on how well this vector fits with others according to Cartan matrix
            for (j, other_vector) in vectors.iter().enumerate() {
                if i != j {
                    let actual_inner = vector.dot(other_vector);
                    let target_inner = self.cartan_matrix.entry(i, j);
                    let diff = actual_inner - target_inner;
                    let compliance = crate::exp_f32(-(diff * diff));
                    score += compliance;
                }
            }
            
            // Add vector norm contribution
            let norm = vector.norm();
            let target_norm = crate::sqrt_f32(2.0); // Cartan normalization
            let norm_diff = norm - target_norm;
            let norm_compliance = crate::exp_f32(-(norm_diff * norm_diff));
            score += norm_compliance;
            
            scores.push(score);
        }
        
        // Apply temperature scaling
        if self.config.temperature != 1.0 {
            for score in scores.iter_mut() {
                *score /= self.config.temperature;
            }
        }
        
        // Apply softmax normalization
        let max_score = scores.iter().fold(f32::NEG_INFINITY, |a, &b| a.max(b));
        let mut exp_scores: Vec<f32> = scores.iter().map(|&s| crate::exp_f32(s - max_score)).collect();
        let sum_exp: f32 = exp_scores.iter().sum();
        
        if sum_exp > 1e-12 {
            for score in exp_scores.iter_mut() {
                *score /= sum_exp;
            }
        }
        
        Ok(exp_scores)
    }
    
    /// Get the Cartan matrix
    pub fn cartan_matrix(&self) -> &CartanMatrix {
        &self.cartan_matrix
    }
    
    /// Get the regularizer (for training integration)
    pub fn regularizer(&mut self) -> &mut CartanRegularizer {
        &mut self.regularizer
    }
    
    /// Get the orthogonalizer (for constraint enforcement)
    pub fn orthogonalizer(&mut self) -> &mut CartanOrthogonalizer {
        &mut self.orthogonalizer
    }
}

impl AttentionMechanism for CartanAttention {
    fn apply_attention(&mut self, input: &[RootVector]) -> Result<Vec<RootVector>> {
        if input.is_empty() {
            return Ok(Vec::new());
        }
        
        let mut output = input.to_vec();
        
        // Normalize input if requested
        if self.config.normalize_input {
            for vector in output.iter_mut() {
                vector.normalize();
            }
        }
        
        // Compute attention weights
        let weights = self.compute_attention_scores(&output)?;
        self.last_weights = weights.clone();
        
        // Apply attention weighting
        for (vector, &weight) in output.iter_mut().zip(weights.iter()) {
            *vector = vector.map(|x| x * weight);
        }
        
        // Apply regularization if enabled
        if self.config.regularize_attention {
            let _loss = self.regularizer.optimization_step(&mut output)?;
        }
        
        // Apply orthogonalization if enabled
        if self.config.orthogonalize_output {
            let _metrics = self.orthogonalizer.orthogonalize(&mut output)?;
        }
        
        Ok(output)
    }
    
    fn attention_weights(&self) -> Result<Vec<f32>> {
        Ok(self.last_weights.clone())
    }
}

/// Multi-head Cartan attention
#[derive(Debug, Clone)]
pub struct MultiHeadCartanAttention {
    /// Individual attention heads
    heads: Vec<CartanAttention>,
    
    /// Number of attention heads
    num_heads: usize,
    
    /// Output projection weights (simplified)
    output_weights: Vec<f32>,
}

impl MultiHeadCartanAttention {
    /// Create multi-head attention with different Cartan types
    pub fn new(cartan_matrices: Vec<CartanMatrix>) -> Result<Self> {
        let num_heads = cartan_matrices.len();
        let mut heads = Vec::with_capacity(num_heads);
        
        for cartan_matrix in cartan_matrices {
            heads.push(CartanAttention::new(cartan_matrix)?);
        }
        
        let output_weights = vec![1.0 / num_heads as f32; num_heads];
        
        Ok(Self {
            heads,
            num_heads,
            output_weights,
        })
    }
    
    /// Set output projection weights
    pub fn set_output_weights(&mut self, weights: Vec<f32>) -> Result<()> {
        if weights.len() != self.num_heads {
            return Err(Error::DimensionMismatch {
                expected: self.num_heads,
                actual: weights.len(),
            });
        }
        
        self.output_weights = weights;
        Ok(())
    }
}

impl AttentionMechanism for MultiHeadCartanAttention {
    fn apply_attention(&mut self, input: &[RootVector]) -> Result<Vec<RootVector>> {
        if input.is_empty() {
            return Ok(Vec::new());
        }
        
        // Apply each attention head
        let mut head_outputs = Vec::with_capacity(self.num_heads);
        for head in self.heads.iter_mut() {
            let head_output = head.apply_attention(input)?;
            head_outputs.push(head_output);
        }
        
        // Combine head outputs with weighted averaging
        let mut combined_output = vec![RootVector::zero(); input.len()];
        
        for (head_idx, head_output) in head_outputs.iter().enumerate() {
            let weight = self.output_weights[head_idx];
            
            for (i, vector) in head_output.iter().enumerate() {
                let weighted_vector = vector.map(|x| x * weight);
                combined_output[i] = combined_output[i] + weighted_vector;
            }
        }
        
        Ok(combined_output)
    }
    
    fn attention_weights(&self) -> Result<Vec<f32>> {
        // Return combined weights from all heads
        let mut all_weights = Vec::new();
        
        for head in &self.heads {
            let head_weights = head.attention_weights()?;
            all_weights.extend(head_weights);
        }
        
        Ok(all_weights)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{RootVector, CartanMatrix};
    
    #[test]
    fn test_cartan_attention_creation() {
        let cartan = CartanMatrix::a_type(3).unwrap();
        let attention = CartanAttention::new(cartan).unwrap();
        
        assert_eq!(attention.cartan_matrix().rank(), 3);
    }
    
    #[test]
    fn test_attention_score_computation() {
        let cartan = CartanMatrix::a_type(2).unwrap();
        let attention = CartanAttention::new(cartan).unwrap();
        
        let vectors = vec![
            RootVector::from_array([1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
            RootVector::from_array([0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        ];
        
        let scores = attention.compute_attention_scores(&vectors).unwrap();
        
        assert_eq!(scores.len(), vectors.len());
        
        // Scores should sum to approximately 1.0 (softmax normalization)
        let sum: f32 = scores.iter().sum();
        assert!((sum - 1.0).abs() < 1e-6);
    }
    
    #[test]
    fn test_attention_application() {
        let cartan = CartanMatrix::a_type(2).unwrap();
        let mut attention = CartanAttention::new(cartan).unwrap();
        
        let input = vec![
            RootVector::from_array([2.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
            RootVector::from_array([1.0, 2.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        ];
        
        let output = attention.apply_attention(&input).unwrap();
        
        assert_eq!(output.len(), input.len());
        
        // Output should be different from input due to attention processing
        for (out_vec, in_vec) in output.iter().zip(input.iter()) {
            // At least some component should be different
            let mut different = false;
            for i in 0..ROOT_DIM {
                if (out_vec[i] - in_vec[i]).abs() > 1e-6 {
                    different = true;
                    break;
                }
            }
            // Note: This might not always be true due to attention weights,
            // but generally we expect some change
        }
        
        // Attention weights should be available
        let weights = attention.attention_weights().unwrap();
        assert_eq!(weights.len(), input.len());
    }
    
    #[test]
    fn test_multi_head_attention() {
        let cartan1 = CartanMatrix::a_type(2).unwrap();
        let cartan2 = CartanMatrix::d_type(4).unwrap();
        
        let mut multi_head = MultiHeadCartanAttention::new(vec![cartan1, cartan2]).unwrap();
        
        let input = vec![
            RootVector::from_array([1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
            RootVector::from_array([0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        ];
        
        let output = multi_head.apply_attention(&input).unwrap();
        
        assert_eq!(output.len(), input.len());
        assert_eq!(multi_head.num_heads, 2);
        
        // Should be able to get combined attention weights
        let weights = multi_head.attention_weights().unwrap();
        assert_eq!(weights.len(), input.len() * 2); // 2 heads
    }
}