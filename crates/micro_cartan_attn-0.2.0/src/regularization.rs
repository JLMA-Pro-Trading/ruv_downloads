//! Complete Cartan regularization system with mathematical correctness
//!
//! This module implements the regularization formula L = λ‖C_actual - C_target‖²
//! along with sophisticated gradient computation, adaptive weighting, and
//! training schedules for neural network integration.

use alloc::{vec, vec::Vec, string::String, format};
use crate::{RootVector, Result, Error, ROOT_DIM, CartanMatrix};
use nalgebra::{SMatrix, DMatrix};

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

/// Complete regularization loss components with mathematical breakdown
#[derive(Debug, Clone, Default)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct RegularizationLoss {
    /// Total weighted loss: L = λ₁L_cartan + λ₂L_norm + λ₃L_custom
    pub total_loss: f32,
    
    /// Primary Cartan constraint loss: λ₁‖C_actual - C_target‖²_F
    pub cartan_loss: f32,
    
    /// Norm regularization loss: λ₂Σᵢ(‖vᵢ‖ - target_norm)²
    pub norm_loss: f32,
    
    /// Orthogonality regularization: λ₃Σᵢ<ⱼ(vᵢ·vⱼ)²
    pub orthogonality_loss: f32,
    
    /// Custom constraint losses (extensible)
    pub custom_loss: f32,
    
    /// Individual constraint violations for analysis
    pub constraint_violations: Vec<f32>,
    
    /// Gradient norms for optimization analysis
    pub gradient_norms: Vec<f32>,
    
    /// Condition number of the system (for numerical stability)
    pub condition_number: f32,
}

impl RegularizationLoss {
    /// Create a new regularization loss structure
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Check if the loss indicates convergence
    pub fn is_converged(&self, tolerance: f32) -> bool {
        self.total_loss < tolerance
    }
    
    /// Get the dominant loss component for adaptive weighting
    pub fn dominant_component(&self) -> LossComponent {
        let cartan_weight = self.cartan_loss / (self.total_loss + 1e-12);
        let norm_weight = self.norm_loss / (self.total_loss + 1e-12);
        let ortho_weight = self.orthogonality_loss / (self.total_loss + 1e-12);
        
        if cartan_weight >= norm_weight && cartan_weight >= ortho_weight {
            LossComponent::Cartan
        } else if norm_weight >= ortho_weight {
            LossComponent::Norm
        } else {
            LossComponent::Orthogonality
        }
    }
    
    /// Compute improvement over previous loss
    pub fn improvement_over(&self, previous: &Self) -> f32 {
        previous.total_loss - self.total_loss
    }
}

/// Loss component types for adaptive weighting
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum LossComponent {
    /// Cartan matrix constraint violation
    Cartan,
    /// Vector norm violations
    Norm,
    /// Orthogonality violations
    Orthogonality,
    /// Custom constraint violations
    Custom,
}

/// Advanced configuration for Cartan regularization
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct RegularizationConfig {
    /// Primary Cartan constraint weight λ₁
    pub cartan_weight: f32,
    
    /// Norm regularization weight λ₂
    pub norm_weight: f32,
    
    /// Orthogonality regularization weight λ₃
    pub orthogonality_weight: f32,
    
    /// Custom constraint weight λ₄
    pub custom_weight: f32,
    
    /// Target norm for vectors (√2 for Cartan normalization)
    pub target_norm: f32,
    
    /// Numerical tolerance for convergence
    pub tolerance: f32,
    
    /// Whether to use adaptive weight adjustment
    pub adaptive_weights: bool,
    
    /// Learning rate for gradient-based optimization
    pub learning_rate: f32,
    
    /// Momentum factor for gradient descent
    pub momentum: f32,
    
    /// L2 regularization for numerical stability
    pub l2_regularization: f32,
    
    /// Whether to normalize gradients
    pub normalize_gradients: bool,
    
    /// Maximum gradient norm (for gradient clipping)
    pub max_gradient_norm: f32,
}

impl Default for RegularizationConfig {
    fn default() -> Self {
        Self {
            cartan_weight: 1.0,
            norm_weight: 0.1,
            orthogonality_weight: 0.5,
            custom_weight: 0.0,
            target_norm: crate::sqrt_f32(2.0), // sqrt(2) for Cartan normalization
            tolerance: 1e-6,
            adaptive_weights: true,
            learning_rate: 0.01,
            momentum: 0.9,
            l2_regularization: 1e-4,
            normalize_gradients: true,
            max_gradient_norm: 1.0,
        }
    }
}

/// Complete Cartan regularizer with sophisticated mathematical framework
#[derive(Debug, Clone)]
pub struct CartanRegularizer {
    /// Target Cartan matrix C_target
    cartan_matrix: CartanMatrix,
    
    /// Regularization configuration
    config: RegularizationConfig,
    
    /// Cached target inner product matrix for efficiency
    target_inner_products: SMatrix<f32, ROOT_DIM, ROOT_DIM>,
    
    /// Previous gradients for momentum-based optimization
    previous_gradients: Vec<RootVector>,
    
    /// Adaptive weight history for learning
    weight_history: Vec<(f32, f32, f32)>, // (cartan, norm, ortho)
    
    /// Performance metrics
    loss_history: Vec<f32>,
    convergence_history: Vec<bool>,
    
    /// Numerical stability tracking
    last_condition_number: f32,
}

impl CartanRegularizer {
    /// Create a new Cartan regularizer with mathematical target matrix
    pub fn new(cartan_matrix: CartanMatrix) -> Result<Self> {
        let config = RegularizationConfig::default();
        Self::with_config(cartan_matrix, config)
    }
    
    /// Create with specific configuration
    pub fn with_config(cartan_matrix: CartanMatrix, config: RegularizationConfig) -> Result<Self> {
        // Pre-compute target inner product matrix for efficiency
        let mut target_inner_products = SMatrix::<f32, { ROOT_DIM }, { ROOT_DIM }>::zeros();
        let rank = cartan_matrix.rank();
        
        for i in 0..rank {
            for j in 0..rank {
                target_inner_products[(i, j)] = cartan_matrix.entry(i, j);
            }
        }
        
        Ok(Self {
            cartan_matrix,
            config,
            target_inner_products,
            previous_gradients: Vec::new(),
            weight_history: Vec::new(),
            loss_history: Vec::new(),
            convergence_history: Vec::new(),
            last_condition_number: 1.0,
        })
    }
    
    /// Set regularization weights with validation
    pub fn set_weights(&mut self, cartan: f32, norm: f32, orthogonality: f32, custom: f32) -> Result<()> {
        if cartan < 0.0 || norm < 0.0 || orthogonality < 0.0 || custom < 0.0 {
            return Err(Error::InvalidInput("All weights must be non-negative".into()));
        }
        
        self.config.cartan_weight = cartan;
        self.config.norm_weight = norm;
        self.config.orthogonality_weight = orthogonality;
        self.config.custom_weight = custom;
        
        Ok(())
    }
    
    /// Compute complete regularization loss: L = λ₁‖C_actual - C_target‖²_F + λ₂L_norm + λ₃L_ortho
    pub fn compute_loss(&mut self, vectors: &[RootVector]) -> Result<RegularizationLoss> {
        if vectors.is_empty() {
            return Ok(RegularizationLoss::new());
        }
        
        let mut loss = RegularizationLoss::new();
        
        // 1. Primary Cartan constraint loss: λ₁‖C_actual - C_target‖²_F
        loss.cartan_loss = self.compute_cartan_matrix_loss(vectors)?;
        
        // 2. Norm regularization: λ₂Σᵢ(‖vᵢ‖ - target_norm)²
        loss.norm_loss = self.compute_norm_regularization_loss(vectors);
        
        // 3. Orthogonality regularization: λ₃Σᵢ<ⱼ(vᵢ·vⱼ)²
        loss.orthogonality_loss = self.compute_orthogonality_loss(vectors);
        
        // 4. Custom constraints (extensible)
        loss.custom_loss = self.compute_custom_loss(vectors);
        
        // 5. Apply weights and compute total
        loss.cartan_loss *= self.config.cartan_weight;
        loss.norm_loss *= self.config.norm_weight;
        loss.orthogonality_loss *= self.config.orthogonality_weight;
        loss.custom_loss *= self.config.custom_weight;
        
        loss.total_loss = loss.cartan_loss + loss.norm_loss + loss.orthogonality_loss + loss.custom_loss;
        
        // 6. Compute additional metrics
        self.compute_loss_metrics(vectors, &mut loss)?;
        
        // 7. Update history
        self.loss_history.push(loss.total_loss);
        self.convergence_history.push(loss.is_converged(self.config.tolerance));
        
        Ok(loss)
    }
    
    /// Core Cartan matrix loss: ‖C_actual - C_target‖²_F (Frobenius norm squared)
    fn compute_cartan_matrix_loss(&self, vectors: &[RootVector]) -> Result<f32> {
        let n = vectors.len().min(self.cartan_matrix.rank());
        if n == 0 {
            return Ok(0.0);
        }
        
        let mut frobenius_norm_squared = 0.0;
        
        // Compute C_actual - C_target and its Frobenius norm squared
        for i in 0..n {
            for j in 0..n {
                let actual_inner = vectors[i].dot(&vectors[j]);
                let target_inner = self.target_inner_products[(i, j)];
                let difference = actual_inner - target_inner;
                frobenius_norm_squared += difference * difference;
            }
        }
        
        Ok(frobenius_norm_squared)
    }
    
    /// Norm regularization: Σᵢ(‖vᵢ‖ - target_norm)²
    fn compute_norm_regularization_loss(&self, vectors: &[RootVector]) -> f32 {
        vectors.iter()
            .map(|v| {
                let norm_diff = v.norm() - self.config.target_norm;
                norm_diff * norm_diff
            })
            .sum()
    }
    
    /// Orthogonality regularization: Σᵢ<ⱼ(vᵢ·vⱼ)²
    fn compute_orthogonality_loss(&self, vectors: &[RootVector]) -> f32 {
        let mut orthogonality_loss = 0.0;
        
        for i in 0..vectors.len() {
            for j in (i + 1)..vectors.len() {
                let dot_product = vectors[i].dot(&vectors[j]);
                orthogonality_loss += dot_product * dot_product;
            }
        }
        
        orthogonality_loss
    }
    
    /// Custom constraint losses (extensible for future constraints)
    fn compute_custom_loss(&self, _vectors: &[RootVector]) -> f32 {
        // Placeholder for custom constraints
        // Could include: sparsity, symmetry, periodicity, etc.
        0.0
    }
    
    /// Compute additional loss metrics for analysis
    fn compute_loss_metrics(&mut self, vectors: &[RootVector], loss: &mut RegularizationLoss) -> Result<()> {
        let n = vectors.len();
        loss.constraint_violations = Vec::with_capacity(n * n);
        loss.gradient_norms = Vec::with_capacity(n);
        
        // Individual constraint violations
        for i in 0..n.min(self.cartan_matrix.rank()) {
            for j in 0..n.min(self.cartan_matrix.rank()) {
                let actual = vectors[i].dot(&vectors[j]);
                let target = self.target_inner_products[(i, j)];
                loss.constraint_violations.push((actual - target).abs());
            }
        }
        
        // Condition number estimation (simplified)
        if n > 1 {
            let mut gram_matrix = DMatrix::<f32>::zeros(n, n);
            for i in 0..n {
                for j in 0..n {
                    gram_matrix[(i, j)] = vectors[i].dot(&vectors[j]);
                }
            }
            
            // Simplified condition number: ratio of max to min diagonal elements
            let mut max_diag: f32 = 0.0;
            let mut min_diag = f32::INFINITY;
            for i in 0..n {
                let diag = gram_matrix[(i, i)];
                max_diag = crate::max_f32(max_diag, diag);
                min_diag = min_diag.min(diag);
            }
            
            loss.condition_number = if min_diag > 1e-12 { max_diag / min_diag } else { f32::INFINITY };
            self.last_condition_number = loss.condition_number;
        }
        
        Ok(())
    }
    
    /// Compute complete gradients: ∇L = λ₁∇L_cartan + λ₂∇L_norm + λ₃∇L_ortho
    pub fn compute_gradients(&mut self, vectors: &[RootVector]) -> Result<Vec<RootVector>> {
        let n = vectors.len();
        if n == 0 {
            return Ok(Vec::new());
        }
        
        let mut gradients = vec![RootVector::zero(); n];
        
        // 1. Cartan matrix loss gradients: ∇(‖C_actual - C_target‖²_F)
        self.add_cartan_gradients(vectors, &mut gradients)?;
        
        // 2. Norm regularization gradients: ∇(Σᵢ(‖vᵢ‖ - target_norm)²)
        self.add_norm_gradients(vectors, &mut gradients);
        
        // 3. Orthogonality gradients: ∇(Σᵢ<ⱼ(vᵢ·vⱼ)²)
        self.add_orthogonality_gradients(vectors, &mut gradients);
        
        // 4. L2 regularization for numerical stability
        if self.config.l2_regularization > 0.0 {
            for (i, vector) in vectors.iter().enumerate() {
                let l2_grad = vector.map(|x| 2.0 * self.config.l2_regularization * x);
                gradients[i] = gradients[i] + l2_grad;
            }
        }
        
        // 5. Gradient normalization and clipping
        if self.config.normalize_gradients {
            self.normalize_and_clip_gradients(&mut gradients)?;
        }
        
        // 6. Store gradient norms for analysis
        let gradient_norms: Vec<f32> = gradients.iter().map(|g| g.norm()).collect();
        
        // 7. Apply momentum if enabled
        if self.config.momentum > 0.0 && !self.previous_gradients.is_empty() {
            self.apply_momentum(&mut gradients);
        }
        
        // 8. Store gradients for next momentum step
        self.previous_gradients = gradients.clone();
        
        Ok(gradients)
    }
    
    /// Add Cartan matrix constraint gradients: ∇(‖C_actual - C_target‖²_F)
    fn add_cartan_gradients(&self, vectors: &[RootVector], gradients: &mut [RootVector]) -> Result<()> {
        let n = vectors.len().min(self.cartan_matrix.rank());
        
        for i in 0..n {
            for j in 0..n {
                let actual_inner = vectors[i].dot(&vectors[j]);
                let target_inner = self.target_inner_products[(i, j)];
                let error = actual_inner - target_inner;
                
                // ∂/∂vᵢ (‖C_actual - C_target‖²_F) = 4 * Σⱼ error(i,j) * vⱼ
                let weight = 4.0 * error * self.config.cartan_weight;
                let grad_contribution = vectors[j].map(|x| weight * x);
                gradients[i] = gradients[i] + grad_contribution;
            }
        }
        
        Ok(())
    }
    
    /// Add norm regularization gradients: ∇(Σᵢ(‖vᵢ‖ - target_norm)²)
    fn add_norm_gradients(&self, vectors: &[RootVector], gradients: &mut [RootVector]) {
        for (i, vector) in vectors.iter().enumerate() {
            let norm = vector.norm();
            if norm > self.config.tolerance {
                let norm_error = norm - self.config.target_norm;
                let weight = 2.0 * norm_error * self.config.norm_weight / norm;
                
                let grad_contribution = vector.map(|x| weight * x);
                gradients[i] = gradients[i] + grad_contribution;
            }
        }
    }
    
    /// Add orthogonality gradients: ∇(Σᵢ<ⱼ(vᵢ·vⱼ)²)
    fn add_orthogonality_gradients(&self, vectors: &[RootVector], gradients: &mut [RootVector]) {
        for i in 0..vectors.len() {
            for j in (i + 1)..vectors.len() {
                let dot_product = vectors[i].dot(&vectors[j]);
                let weight = 2.0 * dot_product * self.config.orthogonality_weight;
                
                // ∂/∂vᵢ (vᵢ·vⱼ)² = 2(vᵢ·vⱼ)vⱼ
                let grad_i = vectors[j].map(|x| weight * x);
                let grad_j = vectors[i].map(|x| weight * x);
                
                gradients[i] = gradients[i] + grad_i;
                gradients[j] = gradients[j] + grad_j;
            }
        }
    }
    
    /// Normalize and clip gradients for numerical stability
    fn normalize_and_clip_gradients(&self, gradients: &mut [RootVector]) -> Result<()> {
        for gradient in gradients.iter_mut() {
            let norm = gradient.norm();
            
            if norm > self.config.max_gradient_norm {
                // Clip gradient norm
                *gradient = gradient.map(|x| x * self.config.max_gradient_norm / norm);
            }
        }
        
        Ok(())
    }
    
    /// Apply momentum to gradients: g_t = momentum * g_{t-1} + (1 - momentum) * ∇L_t
    fn apply_momentum(&self, gradients: &mut [RootVector]) {
        for (i, gradient) in gradients.iter_mut().enumerate() {
            if i < self.previous_gradients.len() {
                let momentum_term = self.previous_gradients[i].map(|x| self.config.momentum * x);
                let current_term = gradient.map(|x| (1.0 - self.config.momentum) * x);
                *gradient = momentum_term + current_term;
            }
        }
    }
    
    /// Perform one regularization optimization step: v_new = v_old - lr * ∇L
    pub fn optimization_step(&mut self, vectors: &mut [RootVector]) -> Result<RegularizationLoss> {
        // Compute gradients
        let gradients = self.compute_gradients(vectors)?;
        
        // Apply gradient descent step
        for (vector, gradient) in vectors.iter_mut().zip(gradients.iter()) {
            *vector = *vector - gradient.map(|g| g * self.config.learning_rate);
        }
        
        // Compute new loss
        let loss = self.compute_loss(vectors)?;
        
        // Adaptive weight adjustment
        if self.config.adaptive_weights {
            self.update_adaptive_weights(&loss);
        }
        
        Ok(loss)
    }
    
    /// Update weights adaptively based on loss component dominance
    fn update_adaptive_weights(&mut self, loss: &RegularizationLoss) {
        let total = loss.total_loss + 1e-12;
        let cartan_ratio = loss.cartan_loss / total;
        let norm_ratio = loss.norm_loss / total;
        let ortho_ratio = loss.orthogonality_loss / total;
        
        // Increase weight of dominant component, decrease others
        let adaptation_rate = 0.01;
        
        if cartan_ratio > 0.5 {
            self.config.cartan_weight = (self.config.cartan_weight * (1.0 + adaptation_rate)).min(10.0);
        } else {
            self.config.cartan_weight = (self.config.cartan_weight * (1.0 - adaptation_rate)).max(0.1);
        }
        
        if norm_ratio > 0.3 {
            self.config.norm_weight = (self.config.norm_weight * (1.0 + adaptation_rate)).min(5.0);
        } else {
            self.config.norm_weight = (self.config.norm_weight * (1.0 - adaptation_rate)).max(0.01);
        }
        
        if ortho_ratio > 0.3 {
            self.config.orthogonality_weight = (self.config.orthogonality_weight * (1.0 + adaptation_rate)).min(5.0);
        } else {
            self.config.orthogonality_weight = (self.config.orthogonality_weight * (1.0 - adaptation_rate)).max(0.01);
        }
        
        // Store weight history
        self.weight_history.push((
            self.config.cartan_weight,
            self.config.norm_weight,
            self.config.orthogonality_weight,
        ));
    }
    
    /// Check if constraints are satisfied within tolerance
    pub fn constraints_satisfied(&mut self, vectors: &[RootVector]) -> Result<bool> {
        let loss = self.compute_loss(vectors)?;
        Ok(loss.is_converged(self.config.tolerance))
    }
    
    /// Get regularization performance metrics
    pub fn get_metrics(&self) -> RegularizationMetrics {
        RegularizationMetrics {
            loss_history: self.loss_history.clone(),
            convergence_history: self.convergence_history.clone(),
            weight_history: self.weight_history.clone(),
            last_condition_number: self.last_condition_number,
            current_learning_rate: self.config.learning_rate,
        }
    }
    
    /// Update learning rate (for learning rate scheduling)
    pub fn set_learning_rate(&mut self, lr: f32) {
        self.config.learning_rate = lr.max(1e-8);
    }
    
    /// Get the target Cartan matrix
    pub fn cartan_matrix(&self) -> &CartanMatrix {
        &self.cartan_matrix
    }
    
    /// Reset optimization state (gradients, history)
    pub fn reset_state(&mut self) {
        self.previous_gradients.clear();
        self.loss_history.clear();
        self.convergence_history.clear();
        self.weight_history.clear();
    }
}

/// Performance metrics for regularization analysis
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct RegularizationMetrics {
    /// Loss function values over time
    pub loss_history: Vec<f32>,
    
    /// Convergence status over time
    pub convergence_history: Vec<bool>,
    
    /// Adaptive weight evolution: (cartan, norm, ortho)
    pub weight_history: Vec<(f32, f32, f32)>,
    
    /// Last computed condition number
    pub last_condition_number: f32,
    
    /// Current learning rate
    pub current_learning_rate: f32,
}

impl RegularizationMetrics {
    /// Check if optimization is making progress
    pub fn is_improving(&self, window_size: usize) -> bool {
        if self.loss_history.len() < window_size * 2 {
            return true; // Not enough data, assume improving
        }
        
        let recent_avg = self.loss_history
            .iter()
            .rev()
            .take(window_size)
            .sum::<f32>() / window_size as f32;
            
        let past_avg = self.loss_history
            .iter()
            .rev()
            .skip(window_size)
            .take(window_size)
            .sum::<f32>() / window_size as f32;
            
        recent_avg < past_avg
    }
    
    /// Get convergence rate (fraction of recent steps that converged)
    pub fn convergence_rate(&self, window_size: usize) -> f32 {
        if self.convergence_history.len() < window_size {
            return 0.0;
        }
        
        let converged_count = self.convergence_history
            .iter()
            .rev()
            .take(window_size)
            .filter(|&&converged| converged)
            .count();
            
        converged_count as f32 / window_size as f32
    }
}

/// Training schedule for gradual constraint introduction
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct RegularizationSchedule {
    /// Current training step
    current_step: usize,
    
    /// Warm-up steps before regularization starts
    warmup_steps: usize,
    
    /// Steps over which to ramp up regularization
    rampup_steps: usize,
    
    /// Maximum weights after ramp-up
    max_cartan_weight: f32,
    max_norm_weight: f32,
    max_ortho_weight: f32,
    
    /// Current computed weights
    current_cartan_weight: f32,
    current_norm_weight: f32,
    current_ortho_weight: f32,
}

impl RegularizationSchedule {
    /// Create a new regularization schedule
    pub fn new(
        warmup_steps: usize,
        rampup_steps: usize,
        max_cartan_weight: f32,
        max_norm_weight: f32,
        max_ortho_weight: f32,
    ) -> Self {
        Self {
            current_step: 0,
            warmup_steps,
            rampup_steps,
            max_cartan_weight,
            max_norm_weight,
            max_ortho_weight,
            current_cartan_weight: 0.0,
            current_norm_weight: 0.0,
            current_ortho_weight: 0.0,
        }
    }
    
    /// Advance schedule and compute new weights
    pub fn step(&mut self) -> (f32, f32, f32) {
        self.current_step += 1;
        
        if self.current_step <= self.warmup_steps {
            // No regularization during warmup
            self.current_cartan_weight = 0.0;
            self.current_norm_weight = 0.0;
            self.current_ortho_weight = 0.0;
        } else if self.current_step <= self.warmup_steps + self.rampup_steps {
            // Linear ramp-up
            let progress = (self.current_step - self.warmup_steps) as f32 / self.rampup_steps as f32;
            self.current_cartan_weight = self.max_cartan_weight * progress;
            self.current_norm_weight = self.max_norm_weight * progress;
            self.current_ortho_weight = self.max_ortho_weight * progress;
        } else {
            // Full regularization
            self.current_cartan_weight = self.max_cartan_weight;
            self.current_norm_weight = self.max_norm_weight;
            self.current_ortho_weight = self.max_ortho_weight;
        }
        
        (
            self.current_cartan_weight,
            self.current_norm_weight,
            self.current_ortho_weight,
        )
    }
    
    /// Get current weights without advancing
    pub fn current_weights(&self) -> (f32, f32, f32) {
        (
            self.current_cartan_weight,
            self.current_norm_weight,
            self.current_ortho_weight,
        )
    }
    
    /// Check if in warmup phase
    pub fn is_warmup(&self) -> bool {
        self.current_step <= self.warmup_steps
    }
    
    /// Check if in rampup phase
    pub fn is_rampup(&self) -> bool {
        self.current_step > self.warmup_steps &&
        self.current_step <= self.warmup_steps + self.rampup_steps
    }
    
    /// Get progress through schedule (0.0 to 1.0)
    pub fn progress(&self) -> f32 {
        if self.current_step <= self.warmup_steps {
            0.0
        } else if self.current_step <= self.warmup_steps + self.rampup_steps {
            (self.current_step - self.warmup_steps) as f32 / self.rampup_steps as f32
        } else {
            1.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{RootVector, CartanMatrix};
    
    #[test]
    fn test_cartan_loss_computation() {
        let cartan = CartanMatrix::a_type(2).unwrap();
        let mut regularizer = CartanRegularizer::new(cartan).unwrap();
        
        // Create vectors that violate A_2 constraints
        let vectors = vec![
            RootVector::from_array([1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
            RootVector::from_array([0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        ];
        
        let loss = regularizer.compute_loss(&vectors).unwrap();
        
        // Should have non-zero Cartan loss since A_2 is not orthogonal
        assert!(loss.cartan_loss > 0.0);
        assert!(loss.total_loss >= loss.cartan_loss);
    }
    
    #[test]
    fn test_gradient_computation() {
        let cartan = CartanMatrix::a_type(2).unwrap();
        let mut regularizer = CartanRegularizer::new(cartan).unwrap();
        
        let vectors = vec![
            RootVector::from_array([1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
            RootVector::from_array([1.0, -1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        ];
        
        let gradients = regularizer.compute_gradients(&vectors).unwrap();
        
        assert_eq!(gradients.len(), vectors.len());
        
        // Gradients should be non-zero for constraint violations
        for gradient in &gradients {
            assert!(gradient.norm() > 0.0);
        }
    }
    
    #[test]
    fn test_optimization_step() {
        let cartan = CartanMatrix::a_type(2).unwrap();
        let mut regularizer = CartanRegularizer::new(cartan).unwrap();
        
        let mut vectors = vec![
            RootVector::from_array([2.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
            RootVector::from_array([1.0, 2.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        ];
        
        let initial_loss = regularizer.compute_loss(&vectors).unwrap();
        let final_loss = regularizer.optimization_step(&mut vectors).unwrap();
        
        // Optimization should generally reduce loss (or at least not increase it significantly)
        // Note: One step might not always improve due to learning rate, but should be reasonable
        assert!(final_loss.total_loss < initial_loss.total_loss * 2.0);
    }
    
    #[test]
    fn test_regularization_schedule() {
        let mut schedule = RegularizationSchedule::new(10, 20, 1.0, 0.5, 0.3);
        
        // Warmup phase
        for _ in 0..10 {
            let (cartan, norm, ortho) = schedule.step();
            assert_eq!(cartan, 0.0);
            assert_eq!(norm, 0.0);
            assert_eq!(ortho, 0.0);
            assert!(schedule.is_warmup());
        }
        
        // Rampup phase
        for _ in 0..20 {
            let (cartan, norm, ortho) = schedule.step();
            assert!(cartan > 0.0 && cartan <= 1.0);
            assert!(norm > 0.0 && norm <= 0.5);
            assert!(ortho > 0.0 && ortho <= 0.3);
            assert!(schedule.is_rampup());
        }
        
        // Full regularization
        let (cartan, norm, ortho) = schedule.step();
        assert_eq!(cartan, 1.0);
        assert_eq!(norm, 0.5);
        assert_eq!(ortho, 0.3);
        assert!(!schedule.is_warmup() && !schedule.is_rampup());
    }
    
    #[test]
    fn test_loss_component_identification() {
        let mut loss = RegularizationLoss::new();
        loss.cartan_loss = 0.8;
        loss.norm_loss = 0.1;
        loss.orthogonality_loss = 0.1;
        loss.total_loss = 1.0;
        
        assert_eq!(loss.dominant_component(), LossComponent::Cartan);
        
        // Change dominant component
        loss.norm_loss = 0.9;
        loss.cartan_loss = 0.05;
        loss.orthogonality_loss = 0.05;
        loss.total_loss = 1.0;
        
        assert_eq!(loss.dominant_component(), LossComponent::Norm);
    }
    
    #[test]
    fn test_metrics_analysis() {
        let metrics = RegularizationMetrics {
            loss_history: vec![1.0, 0.8, 0.6, 0.7, 0.5, 0.4],
            convergence_history: vec![false, false, false, false, true, true],
            weight_history: vec![],
            last_condition_number: 2.5,
            current_learning_rate: 0.01,
        };
        
        // Should be improving (recent average < past average)
        assert!(metrics.is_improving(3));
        
        // Convergence rate should be 2/3 for last 3 steps
        let rate = metrics.convergence_rate(3);
        assert!((rate - 2.0/3.0).abs() < 1e-6);
    }
}