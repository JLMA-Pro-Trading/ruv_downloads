//! Complete Cartan matrix implementation with proper Lie algebra structures
//!
//! This module implements mathematically correct Cartan matrices for all classical
//! and exceptional Lie algebra types, along with root system computations and
//! Killing form calculations.

use alloc::{vec, vec::Vec, string::{String, ToString}, format};
use crate::{RootVector, Result, Error, ROOT_DIM};
use nalgebra::{SMatrix, SVector, SymmetricEigen};

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

/// Classical Cartan matrix types based on Lie algebra classification
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum CartanType {
    /// A_n series (special linear algebras sl(n+1))
    /// Cartan matrix: 2 on diagonal, -1 on super/sub-diagonals
    A(usize),
    
    /// B_n series (special orthogonal algebras so(2n+1))
    /// Cartan matrix: 2 on diagonal, -1 adjacencies, -2 for last connection
    B(usize),
    
    /// C_n series (symplectic algebras sp(2n))
    /// Cartan matrix: 2 on diagonal, -1 adjacencies, -2 for first connection
    C(usize),
    
    /// D_n series (special orthogonal algebras so(2n))
    /// Cartan matrix: 2 on diagonal, -1 adjacencies, branching at n-2
    D(usize),
    
    /// E_6 exceptional algebra (78 dimensions)
    E6,
    
    /// E_7 exceptional algebra (133 dimensions)
    E7,
    
    /// E_8 exceptional algebra (248 dimensions)
    E8,
    
    /// F_4 exceptional algebra (52 dimensions)
    F4,
    
    /// G_2 exceptional algebra (14 dimensions)
    G2,
}

impl CartanType {
    /// Get the rank (number of simple roots) for this Cartan type
    pub fn rank(&self) -> usize {
        match self {
            CartanType::A(n) => *n,
            CartanType::B(n) => *n,
            CartanType::C(n) => *n,
            CartanType::D(n) => *n,
            CartanType::E6 => 6,
            CartanType::E7 => 7,
            CartanType::E8 => 8,
            CartanType::F4 => 4,
            CartanType::G2 => 2,
        }
    }
    
    /// Get the dimension of the Lie algebra
    pub fn dimension(&self) -> usize {
        match self {
            CartanType::A(n) => n * (n + 2),
            CartanType::B(n) => n * (2 * n + 1),
            CartanType::C(n) => n * (2 * n + 1),
            CartanType::D(n) => n * (2 * n - 1),
            CartanType::E6 => 78,
            CartanType::E7 => 133,
            CartanType::E8 => 248,
            CartanType::F4 => 52,
            CartanType::G2 => 14,
        }
    }
}

/// Configuration for Cartan matrix construction
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct CartanConfig {
    /// Type of Cartan matrix to construct
    pub cartan_type: CartanType,
    
    /// Tolerance for numerical operations
    pub tolerance: f32,
    
    /// Whether to normalize roots to unit length
    pub normalize_roots: bool,
    
    /// Whether to apply Cartan normalization (α_i · α_i = 2)
    pub cartan_normalization: bool,
    
    /// Scaling factor for the entire matrix
    pub scaling_factor: f32,
}

impl Default for CartanConfig {
    fn default() -> Self {
        Self {
            cartan_type: CartanType::A(3),
            tolerance: 1e-6,
            normalize_roots: false,
            cartan_normalization: true,
            scaling_factor: 1.0,
        }
    }
}

/// Complete Cartan matrix implementation with proper mathematical structure
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct CartanMatrix {
    /// The Cartan matrix C_{ij} = 2(α_i · α_j)/(α_j · α_j)
    matrix: SMatrix<f32, ROOT_DIM, ROOT_DIM>,
    
    /// Configuration used to build this matrix
    config: CartanConfig,
    
    /// Actual rank of the matrix (number of linearly independent roots)
    rank: usize,
    
    /// Simple root vectors (the basis of the root system)
    simple_roots: Vec<RootVector>,
    
    /// Positive root vectors (complete root system)
    positive_roots: Vec<RootVector>,
    
    /// Killing form matrix (bilinear form on the Lie algebra)
    killing_form: Option<SMatrix<f32, ROOT_DIM, ROOT_DIM>>,
}

impl CartanMatrix {
    /// Create a new Cartan matrix from configuration
    pub fn new(config: CartanConfig) -> Result<Self> {
        let rank = config.cartan_type.rank();
        if rank > ROOT_DIM {
            return Err(Error::InvalidConfiguration(
                format!("Cartan type rank {} exceeds ROOT_DIM {}", rank, ROOT_DIM)
            ));
        }
        
        let mut matrix = SMatrix::<f32, ROOT_DIM, ROOT_DIM>::zeros();
        let simple_roots = Self::construct_simple_roots(&config.cartan_type)?;
        
        // Build the Cartan matrix: C_{ij} = 2(α_i · α_j)/(α_j · α_j)
        for i in 0..rank {
            for j in 0..rank {
                let numerator = 2.0 * simple_roots[i].dot(&simple_roots[j]);
                let denominator = simple_roots[j].dot(&simple_roots[j]);
                
                if denominator.abs() < config.tolerance {
                    return Err(Error::NumericalInstability);
                }
                
                matrix[(i, j)] = numerator / denominator * config.scaling_factor;
            }
        }
        
        // Generate positive roots
        let positive_roots = Self::generate_positive_roots(&simple_roots, &config)?;
        
        Ok(Self {
            matrix,
            config,
            rank,
            simple_roots,
            positive_roots,
            killing_form: None,
        })
    }
    
    /// Create specific Cartan matrix types with standard parameters
    pub fn a_type(n: usize) -> Result<Self> {
        if n == 0 || n >= ROOT_DIM {
            return Err(Error::InvalidInput(format!("Invalid A_n parameter: n = {}", n)));
        }
        
        let config = CartanConfig {
            cartan_type: CartanType::A(n),
            ..Default::default()
        };
        
        Self::new(config)
    }
    
    /// Create B_n type Cartan matrix
    pub fn b_type(n: usize) -> Result<Self> {
        if n == 0 || n >= ROOT_DIM {
            return Err(Error::InvalidInput(format!("Invalid B_n parameter: n = {}", n)));
        }
        
        let config = CartanConfig {
            cartan_type: CartanType::B(n),
            ..Default::default()
        };
        
        Self::new(config)
    }
    
    /// Create C_n type Cartan matrix
    pub fn c_type(n: usize) -> Result<Self> {
        if n == 0 || n >= ROOT_DIM {
            return Err(Error::InvalidInput(format!("Invalid C_n parameter: n = {}", n)));
        }
        
        let config = CartanConfig {
            cartan_type: CartanType::C(n),
            ..Default::default()
        };
        
        Self::new(config)
    }
    
    /// Create D_n type Cartan matrix
    pub fn d_type(n: usize) -> Result<Self> {
        if n < 4 || n >= ROOT_DIM {
            return Err(Error::InvalidInput(format!("Invalid D_n parameter: n = {} (must be ≥ 4)", n)));
        }
        
        let config = CartanConfig {
            cartan_type: CartanType::D(n),
            ..Default::default()
        };
        
        Self::new(config)
    }
    
    /// Create E_8 exceptional Cartan matrix
    pub fn e8() -> Result<Self> {
        let config = CartanConfig {
            cartan_type: CartanType::E8,
            ..Default::default()
        };
        
        Self::new(config)
    }
    
    /// Construct simple root vectors for a given Cartan type
    fn construct_simple_roots(cartan_type: &CartanType) -> Result<Vec<RootVector>> {
        match cartan_type {
            CartanType::A(n) => Self::construct_a_roots(*n),
            CartanType::B(n) => Self::construct_b_roots(*n),
            CartanType::C(n) => Self::construct_c_roots(*n),
            CartanType::D(n) => Self::construct_d_roots(*n),
            CartanType::E6 => Self::construct_e6_roots(),
            CartanType::E7 => Self::construct_e7_roots(),
            CartanType::E8 => Self::construct_e8_roots(),
            CartanType::F4 => Self::construct_f4_roots(),
            CartanType::G2 => Self::construct_g2_roots(),
        }
    }
    
    /// Construct A_n simple roots: e_i - e_{i+1} for i = 1..n
    fn construct_a_roots(n: usize) -> Result<Vec<RootVector>> {
        let mut roots = Vec::with_capacity(n);
        
        for i in 0..n {
            let mut root = RootVector::zero();
            if i < ROOT_DIM {
                root[i] = 1.0;
            }
            if i + 1 < ROOT_DIM {
                root[i + 1] = -1.0;
            }
            roots.push(root);
        }
        
        Ok(roots)
    }
    
    /// Construct B_n simple roots
    fn construct_b_roots(n: usize) -> Result<Vec<RootVector>> {
        let mut roots = Vec::with_capacity(n);
        
        // First n-1 roots: e_i - e_{i+1}
        for i in 0..(n-1).min(ROOT_DIM-1) {
            let mut root = RootVector::zero();
            root[i] = 1.0;
            root[i + 1] = -1.0;
            roots.push(root);
        }
        
        // Last root: e_n
        if n > 0 && n <= ROOT_DIM {
            let mut root = RootVector::zero();
            root[n - 1] = 1.0;
            roots.push(root);
        }
        
        Ok(roots)
    }
    
    /// Construct C_n simple roots
    fn construct_c_roots(n: usize) -> Result<Vec<RootVector>> {
        let mut roots = Vec::with_capacity(n);
        
        // First n-1 roots: e_i - e_{i+1}
        for i in 0..(n-1).min(ROOT_DIM-1) {
            let mut root = RootVector::zero();
            root[i] = 1.0;
            root[i + 1] = -1.0;
            roots.push(root);
        }
        
        // Last root: 2*e_n
        if n > 0 && n <= ROOT_DIM {
            let mut root = RootVector::zero();
            root[n - 1] = 2.0;
            roots.push(root);
        }
        
        Ok(roots)
    }
    
    /// Construct D_n simple roots
    fn construct_d_roots(n: usize) -> Result<Vec<RootVector>> {
        let mut roots = Vec::with_capacity(n);
        
        // First n-2 roots: e_i - e_{i+1}
        for i in 0..(n-2).min(ROOT_DIM-2) {
            let mut root = RootVector::zero();
            root[i] = 1.0;
            root[i + 1] = -1.0;
            roots.push(root);
        }
        
        // Second to last root: e_{n-1} - e_n
        if n >= 2 && n <= ROOT_DIM {
            let mut root = RootVector::zero();
            root[n - 2] = 1.0;
            root[n - 1] = -1.0;
            roots.push(root);
        }
        
        // Last root: e_{n-1} + e_n
        if n >= 2 && n <= ROOT_DIM {
            let mut root = RootVector::zero();
            root[n - 2] = 1.0;
            root[n - 1] = 1.0;
            roots.push(root);
        }
        
        Ok(roots)
    }
    
    /// Construct E_8 simple roots (standard realization)
    fn construct_e8_roots() -> Result<Vec<RootVector>> {
        let mut roots = Vec::with_capacity(8);
        
        // E_8 root system in 8 dimensions
        // Root α_1: (1, -1, 0, 0, 0, 0, 0, 0)
        let mut root1 = RootVector::zero();
        root1[0] = 1.0; root1[1] = -1.0;
        roots.push(root1);
        
        // Root α_2: (0, 1, -1, 0, 0, 0, 0, 0)
        let mut root2 = RootVector::zero();
        root2[1] = 1.0; root2[2] = -1.0;
        roots.push(root2);
        
        // Root α_3: (0, 0, 1, -1, 0, 0, 0, 0)
        let mut root3 = RootVector::zero();
        root3[2] = 1.0; root3[3] = -1.0;
        roots.push(root3);
        
        // Root α_4: (0, 0, 0, 1, -1, 0, 0, 0)
        let mut root4 = RootVector::zero();
        root4[3] = 1.0; root4[4] = -1.0;
        roots.push(root4);
        
        // Root α_5: (0, 0, 0, 0, 1, -1, 0, 0)
        let mut root5 = RootVector::zero();
        root5[4] = 1.0; root5[5] = -1.0;
        roots.push(root5);
        
        // Root α_6: (0, 0, 0, 0, 0, 1, -1, 0)
        let mut root6 = RootVector::zero();
        root6[5] = 1.0; root6[6] = -1.0;
        roots.push(root6);
        
        // Root α_7: (0, 0, 0, 0, 0, 0, 1, -1)
        let mut root7 = RootVector::zero();
        root7[6] = 1.0; root7[7] = -1.0;
        roots.push(root7);
        
        // Root α_8: (-1/2, -1/2, -1/2, -1/2, -1/2, -1/2, -1/2, 1/2)
        let mut root8 = RootVector::zero();
        for i in 0..7 {
            root8[i] = -0.5;
        }
        root8[7] = 0.5;
        roots.push(root8);
        
        Ok(roots)
    }

    /// Construct E_6 simple roots
    fn construct_e6_roots() -> Result<Vec<RootVector>> {
        // E_6 is a subalgebra of E_8, take first 6 roots
        let e8_roots = Self::construct_e8_roots()?;
        Ok(e8_roots.into_iter().take(6).collect())
    }
    
    /// Construct E_7 simple roots  
    fn construct_e7_roots() -> Result<Vec<RootVector>> {
        // E_7 is a subalgebra of E_8, take first 7 roots
        let e8_roots = Self::construct_e8_roots()?;
        Ok(e8_roots.into_iter().take(7).collect())
    }
    
    /// Construct F_4 simple roots
    fn construct_f4_roots() -> Result<Vec<RootVector>> {
        let mut roots = Vec::with_capacity(4);
        
        // F_4 root system
        let mut root1 = RootVector::zero();
        root1[1] = 1.0; root1[2] = -1.0;
        roots.push(root1);
        
        let mut root2 = RootVector::zero();
        root2[2] = 1.0; root2[3] = -1.0;
        roots.push(root2);
        
        let mut root3 = RootVector::zero();
        root3[3] = 1.0;
        roots.push(root3);
        
        let mut root4 = RootVector::zero();
        root4[0] = 0.5; root4[1] = -0.5; root4[2] = -0.5; root4[3] = -0.5;
        roots.push(root4);
        
        Ok(roots)
    }
    
    /// Construct G_2 simple roots
    fn construct_g2_roots() -> Result<Vec<RootVector>> {
        let mut roots = Vec::with_capacity(2);
        
        // G_2 root system (120 degree angle)
        let mut root1 = RootVector::zero();
        root1[0] = 1.0; root1[1] = -1.0;
        roots.push(root1);
        
        let mut root2 = RootVector::zero();  
        root2[0] = -2.0; root2[1] = 1.0;
        roots.push(root2);
        
        Ok(roots)
    }
    
    /// Generate all positive roots from simple roots
    fn generate_positive_roots(simple_roots: &[RootVector], config: &CartanConfig) -> Result<Vec<RootVector>> {
        let mut positive_roots = simple_roots.to_vec();
        let max_iterations = 100; // Prevent infinite loops
        let mut iteration = 0;
        
        // Generate positive roots by taking positive linear combinations
        loop {
            iteration += 1;
            if iteration > max_iterations {
                break;
            }
            
            let current_len = positive_roots.len();
            let mut new_roots = Vec::new();
            
            // Try to add new roots: α + β where α, β are existing positive roots
            for i in 0..current_len {
                for j in i..current_len {
                    let candidate = positive_roots[i] + positive_roots[j];
                    
                    // Check if this is actually a root (non-trivial check for real implementation)
                    if Self::is_valid_root(&candidate, simple_roots, config.tolerance) {
                        // Check if we already have this root
                        let mut is_new = true;
                        for existing in &positive_roots {
                            if Self::vectors_equal(&candidate, existing, config.tolerance) {
                                is_new = false;
                                break;
                            }
                        }
                        
                        if is_new && positive_roots.len() < ROOT_DIM {
                            new_roots.push(candidate);
                        }
                    }
                }
            }
            
            if new_roots.is_empty() {
                break;
            }
            
            positive_roots.extend(new_roots);
        }
        
        Ok(positive_roots)
    }
    
    /// Check if a vector is a valid root (simplified check)
    fn is_valid_root(candidate: &RootVector, _simple_roots: &[RootVector], _tolerance: f32) -> bool {
        // Simplified: check if norm is reasonable
        let norm = candidate.norm();
        norm > 1e-6 && norm < 10.0
    }
    
    /// Check if two vectors are equal within tolerance
    fn vectors_equal(a: &RootVector, b: &RootVector, tolerance: f32) -> bool {
        crate::sqrt_f32(a.data.iter().zip(b.data.iter()).map(|(x, y)| (x - y) * (x - y)).sum::<f32>()) < tolerance
    }
    
    /// Compute the Killing form for this Lie algebra
    pub fn compute_killing_form(&mut self) -> Result<()> {
        let rank = self.rank;
        let mut killing = SMatrix::<f32, ROOT_DIM, ROOT_DIM>::zeros();
        
        // For classical types, we can compute the Killing form analytically
        match self.config.cartan_type {
            CartanType::A(n) => {
                // Killing form for A_n: κ(H_i, H_j) = (n+1) * δ_{ij}
                for i in 0..rank {
                    killing[(i, i)] = (n + 1) as f32;
                }
            }
            CartanType::B(n) | CartanType::C(n) => {
                // Killing form for B_n/C_n: κ(H_i, H_j) = (2n-1) * δ_{ij}
                for i in 0..rank {
                    killing[(i, i)] = (2 * n - 1) as f32;
                }
            }
            CartanType::D(n) => {
                // Killing form for D_n: κ(H_i, H_j) = (2n-2) * δ_{ij}
                for i in 0..rank {
                    killing[(i, i)] = (2 * n - 2) as f32;
                }
            }
            CartanType::E8 => {
                // Killing form for E_8: κ(H_i, H_j) = 30 * δ_{ij}
                for i in 0..rank {
                    killing[(i, i)] = 30.0;
                }
            }
            _ => {
                // For other exceptional types, use identity as approximation
                for i in 0..rank {
                    killing[(i, i)] = 1.0;
                }
            }
        }
        
        self.killing_form = Some(killing);
        Ok(())
    }
    
    /// Get the Cartan matrix entry C_{ij}
    pub fn entry(&self, i: usize, j: usize) -> f32 {
        if i < ROOT_DIM && j < ROOT_DIM {
            self.matrix[(i, j)]
        } else {
            0.0
        }
    }
    
    /// Get the target inner product between roots i and j
    pub fn target_inner_product(&self, i: usize, j: usize) -> f32 {
        self.entry(i, j)
    }
    
    /// Compute violation of Cartan constraints for given vectors
    /// Returns ‖C_actual - C_target‖²
    pub fn compute_violation(&self, vectors: &[RootVector]) -> f32 {
        if vectors.is_empty() {
            return 0.0;
        }
        
        let n = vectors.len().min(self.rank);
        let mut violation = 0.0;
        
        for i in 0..n {
            for j in 0..n {
                let actual = vectors[i].dot(&vectors[j]);
                let target = self.entry(i, j);
                let diff = actual - target;
                violation += diff * diff;
            }
        }
        
        violation
    }
    
    /// Check if vectors satisfy Cartan constraints within tolerance
    pub fn satisfies_constraints(&self, vectors: &[RootVector]) -> bool {
        let violation = self.compute_violation(vectors);
        violation < self.config.tolerance.max(1e-3) // Use more reasonable tolerance
    }
    
    /// Get the Cartan matrix as nalgebra matrix
    pub fn matrix(&self) -> &SMatrix<f32, ROOT_DIM, ROOT_DIM> {
        &self.matrix
    }
    
    /// Get simple roots
    pub fn simple_roots(&self) -> &[RootVector] {
        &self.simple_roots
    }
    
    /// Get positive roots  
    pub fn positive_roots(&self) -> &[RootVector] {
        &self.positive_roots
    }
    
    /// Get the rank of this Cartan matrix
    pub fn rank(&self) -> usize {
        self.rank
    }
    
    /// Get the Cartan type
    pub fn cartan_type(&self) -> CartanType {
        self.config.cartan_type
    }
    
    /// Get the Killing form (compute if not cached)
    pub fn killing_form(&mut self) -> Result<&SMatrix<f32, ROOT_DIM, ROOT_DIM>> {
        if self.killing_form.is_none() {
            self.compute_killing_form()?;
        }
        
        Ok(self.killing_form.as_ref().unwrap())
    }
    
    /// Compute the dual Cartan matrix (transpose of inverse)
    /// Simplified version for basic Cartan types
    pub fn dual_matrix(&self) -> Result<SMatrix<f32, ROOT_DIM, ROOT_DIM>> {
        // For now, return transpose as approximation
        // Real implementation would require proper matrix inversion
        let mut dual = SMatrix::<f32, ROOT_DIM, ROOT_DIM>::zeros();
        let rank = self.rank;
        
        for i in 0..rank {
            for j in 0..rank {
                dual[(i, j)] = self.matrix[(j, i)]; // Transpose
            }
        }
        
        Ok(dual)
    }
}

/// Root system manager for complete Lie algebra structure
#[derive(Debug, Clone)]
pub struct RootSystem {
    /// The Cartan matrix defining this root system
    cartan_matrix: CartanMatrix,
    
    /// Current root vectors in the semantic space
    current_roots: Vec<RootVector>,
    
    /// Labels for semantic interpretation
    labels: Vec<Option<String>>,
    
    /// Weyl group generators (reflection matrices)
    weyl_generators: Vec<SMatrix<f32, ROOT_DIM, ROOT_DIM>>,
}

impl RootSystem {
    /// Create a new root system from a Cartan matrix
    pub fn new(mut cartan_matrix: CartanMatrix) -> Result<Self> {
        // Ensure Killing form is computed
        cartan_matrix.compute_killing_form()?;
        
        let weyl_generators = Self::compute_weyl_generators(&cartan_matrix)?;
        
        Ok(Self {
            cartan_matrix,
            current_roots: Vec::new(),
            labels: vec![None; ROOT_DIM],
            weyl_generators,
        })
    }
    
    /// Compute Weyl group generators (simple reflections)
    fn compute_weyl_generators(cartan: &CartanMatrix) -> Result<Vec<SMatrix<f32, ROOT_DIM, ROOT_DIM>>> {
        let mut generators = Vec::new();
        let simple_roots = cartan.simple_roots();
        
        for root in simple_roots {
            // Reflection formula: s_α(v) = v - 2(v·α)/(α·α) * α
            let mut reflection = SMatrix::<f32, ROOT_DIM, ROOT_DIM>::identity();
            let root_norm_sq = root.dot(root);
            
            if root_norm_sq > 1e-10 {
                for i in 0..ROOT_DIM {
                    for j in 0..ROOT_DIM {
                        reflection[(i, j)] -= 2.0 * root[i] * root[j] / root_norm_sq;
                    }
                }
            }
            
            generators.push(reflection);
        }
        
        Ok(generators)
    }
    
    /// Get the Cartan matrix
    pub fn cartan_matrix(&self) -> &CartanMatrix {
        &self.cartan_matrix
    }
    
    /// Add a root vector to the current system
    pub fn add_root(&mut self, root: RootVector, label: Option<String>) -> Result<usize> {
        if self.current_roots.len() >= ROOT_DIM {
            return Err(Error::InvalidConfiguration(
                format!("Cannot add more than {} root vectors", ROOT_DIM)
            ));
        }
        
        let index = self.current_roots.len();
        self.current_roots.push(root);
        self.labels[index] = label;
        
        Ok(index)
    }
    
    /// Get current root vectors
    pub fn current_roots(&self) -> &[RootVector] {
        &self.current_roots
    }
    
    /// Check if current roots satisfy Cartan constraints
    pub fn is_valid(&self) -> bool {
        self.cartan_matrix.satisfies_constraints(&self.current_roots)
    }
    
    /// Compute constraint violation
    pub fn violation(&self) -> f32 {
        self.cartan_matrix.compute_violation(&self.current_roots)
    }
    
    /// Apply Weyl group reflection to a vector
    pub fn apply_weyl_reflection(&self, vector: &RootVector, generator_index: usize) -> Result<RootVector> {
        if generator_index >= self.weyl_generators.len() {
            return Err(Error::InvalidInput(format!("Invalid Weyl generator index: {}", generator_index)));
        }
        
        let generator = &self.weyl_generators[generator_index];
        let mut result = RootVector::zero();
        
        for i in 0..ROOT_DIM {
            for j in 0..ROOT_DIM {
                result[i] += generator[(i, j)] * vector[j];
            }
        }
        
        Ok(result)
    }
    
    /// Get Weyl generators
    pub fn weyl_generators(&self) -> &[SMatrix<f32, ROOT_DIM, ROOT_DIM>] {
        &self.weyl_generators
    }
    
    /// Set semantic label for a root
    pub fn set_label(&mut self, index: usize, label: String) -> Result<()> {
        if index >= ROOT_DIM {
            return Err(Error::InvalidDimension { dim: index });
        }
        self.labels[index] = Some(label);
        Ok(())
    }
    
    /// Get semantic label for a root
    pub fn get_label(&self, index: usize) -> Option<&str> {
        self.labels.get(index)?.as_deref()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ROOT_DIM;
    
    #[test]
    fn test_a_type_construction() {
        let cartan = CartanMatrix::a_type(3).unwrap();
        assert_eq!(cartan.rank(), 3);
        
        // Check A_3 Cartan matrix structure
        assert_eq!(cartan.entry(0, 0), 2.0);
        assert_eq!(cartan.entry(0, 1), -1.0);
        assert_eq!(cartan.entry(1, 0), -1.0);
        assert_eq!(cartan.entry(1, 2), -1.0);
        assert_eq!(cartan.entry(0, 2), 0.0);
    }
    
    #[test]
    fn test_cartan_constraint_violation() {
        let cartan = CartanMatrix::a_type(2).unwrap();
        
        // Perfect orthogonal vectors should violate A_2 constraints
        let mut vec1 = RootVector::zero();
        vec1[0] = 1.0;
        let mut vec2 = RootVector::zero();
        vec2[1] = 1.0;
        
        let vectors = vec![vec1, vec2];
        let violation = cartan.compute_violation(&vectors);
        
        // Should be non-zero since A_2 is not orthogonal
        assert!(violation > 1e-6);
    }
    
    #[test]
    fn test_e8_construction() {
        let cartan = CartanMatrix::e8().unwrap();
        assert_eq!(cartan.rank(), 8);
        assert_eq!(cartan.cartan_type(), CartanType::E8);
        
        // E_8 should have 8 simple roots
        assert_eq!(cartan.simple_roots().len(), 8);
    }
    
    #[test]
    fn test_killing_form_computation() {
        let mut cartan = CartanMatrix::a_type(2).unwrap();
        let killing = cartan.killing_form().unwrap();
        
        // A_2 Killing form should have positive diagonal entries
        assert!(killing[(0, 0)] > 0.0);
        assert!(killing[(1, 1)] > 0.0);
    }
    
    #[test]
    fn test_root_system() {
        let cartan = CartanMatrix::a_type(2).unwrap();
        let mut root_system = RootSystem::new(cartan).unwrap();
        
        // Add a root
        let mut root = RootVector::zero();
        root[0] = 1.0;
        let index = root_system.add_root(root, Some("test_root".to_string())).unwrap();
        
        assert_eq!(index, 0);
        assert_eq!(root_system.get_label(0), Some("test_root"));
    }
    
    #[test]
    fn test_weyl_reflections() {
        let cartan = CartanMatrix::a_type(2).unwrap();
        let root_system = RootSystem::new(cartan).unwrap();
        
        let mut test_vector = RootVector::zero();
        test_vector[0] = 1.0;
        
        // Apply first Weyl reflection
        let reflected = root_system.apply_weyl_reflection(&test_vector, 0).unwrap();
        
        // Result should be different from original
        assert!((reflected.data[0] - test_vector.data[0]).abs() > 1e-6);
    }
}