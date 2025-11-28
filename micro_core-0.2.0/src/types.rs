//! Core types for the Semantic Cartan Matrix implementation

use core::ops::{Index, IndexMut};
use core::fmt;
use alloc::vec::Vec;

#[cfg(feature = "simd")]
use wide::{f32x4, f32x8};

#[cfg(all(feature = "simd-wasm", target_arch = "wasm32"))]
use core::arch::wasm32::*;

/// A 32-dimensional root vector with SIMD alignment
/// 
/// This is the fundamental type representing vectors in the root space.
/// Aligned to 16 bytes for SIMD operations.
#[repr(align(16))]
#[derive(Clone, Copy)]
pub struct RootVector {
    /// The vector components
    pub data: [f32; 32],
}

impl RootVector {
    /// Create a new zero vector
    pub const fn zero() -> Self {
        Self { data: [0.0; 32] }
    }

    /// Create a new vector from an array
    pub const fn from_array(data: [f32; 32]) -> Self {
        Self { data }
    }

    /// Dot product with another vector
    pub fn dot(&self, other: &Self) -> f32 {
        #[cfg(feature = "simd")]
        {
            // SIMD implementation for faster computation
            self.dot_simd(other)
        }
        #[cfg(not(feature = "simd"))]
        {
            self.data.iter()
                .zip(other.data.iter())
                .map(|(a, b)| a * b)
                .sum()
        }
    }

    /// SIMD-accelerated dot product using wide crate
    #[cfg(all(feature = "simd", not(all(feature = "simd-wasm", target_arch = "wasm32"))))]
    fn dot_simd(&self, other: &Self) -> f32 {
        let mut sum = f32x8::ZERO;
        
        // Process 8 elements at a time
        let chunks = self.data.chunks_exact(8);
        let other_chunks = other.data.chunks_exact(8);
        
        for (a_chunk, b_chunk) in chunks.zip(other_chunks) {
            let a_vec = f32x8::from([a_chunk[0], a_chunk[1], a_chunk[2], a_chunk[3],
                                    a_chunk[4], a_chunk[5], a_chunk[6], a_chunk[7]]);
            let b_vec = f32x8::from([b_chunk[0], b_chunk[1], b_chunk[2], b_chunk[3],
                                    b_chunk[4], b_chunk[5], b_chunk[6], b_chunk[7]]);
            sum += a_vec * b_vec;
        }
        
        // Sum the vector elements
        let result = sum.to_array();
        let mut total = result[0] + result[1] + result[2] + result[3] +
                       result[4] + result[5] + result[6] + result[7];
        
        // Handle remainder (32 % 8 = 0, so no remainder for our 32-element vectors)
        // But keeping this for robustness
        let remainder = self.data.chunks_exact(8).remainder();
        let other_remainder = other.data.chunks_exact(8).remainder();
        for (a, b) in remainder.iter().zip(other_remainder.iter()) {
            total += a * b;
        }
        
        total
    }
    
    /// WASM SIMD-accelerated dot product
    #[cfg(all(feature = "simd-wasm", target_arch = "wasm32"))]
    fn dot_wasm_simd(&self, other: &Self) -> f32 {
        let mut sum = f32x4_splat(0.0);
        
        // Process 4 elements at a time
        for i in (0..32).step_by(4) {
            let a_vec = v128_load(self.data[i..].as_ptr() as *const v128);
            let b_vec = v128_load(other.data[i..].as_ptr() as *const v128);
            sum = f32x4_add(sum, f32x4_mul(a_vec, b_vec));
        }
        
        // Sum the vector elements
        f32x4_extract_lane::<0>(sum) + f32x4_extract_lane::<1>(sum) +
        f32x4_extract_lane::<2>(sum) + f32x4_extract_lane::<3>(sum)
    }

    /// Normalize the vector to unit length
    pub fn normalize(&mut self) {
        let mag = self.magnitude();
        if mag > 0.0 {
            for i in 0..32 {
                self.data[i] /= mag;
            }
        }
    }

    /// Get the magnitude (length) of the vector
    pub fn magnitude(&self) -> f32 {
        libm::sqrtf(self.dot(self))
    }

    /// Scale the vector by a scalar
    pub fn scale(&mut self, scalar: f32) {
        #[cfg(all(feature = "simd-wasm", target_arch = "wasm32"))]
        {
            self.scale_wasm_simd(scalar);
        }
        #[cfg(all(feature = "simd", not(all(feature = "simd-wasm", target_arch = "wasm32"))))]
        {
            self.scale_simd(scalar);
        }
        #[cfg(not(feature = "simd"))]
        {
            for i in 0..32 {
                self.data[i] *= scalar;
            }
        }
    }
    
    /// SIMD-accelerated scaling
    #[cfg(all(feature = "simd", not(all(feature = "simd-wasm", target_arch = "wasm32"))))]
    fn scale_simd(&mut self, scalar: f32) {
        let scalar_vec = f32x8::splat(scalar);
        
        for chunk in self.data.chunks_exact_mut(8) {
            let vec = f32x8::from([chunk[0], chunk[1], chunk[2], chunk[3],
                                  chunk[4], chunk[5], chunk[6], chunk[7]]);
            let result = vec * scalar_vec;
            let result_array = result.to_array();
            chunk.copy_from_slice(&result_array);
        }
    }
    
    /// WASM SIMD-accelerated scaling
    #[cfg(all(feature = "simd-wasm", target_arch = "wasm32"))]
    fn scale_wasm_simd(&mut self, scalar: f32) {
        let scalar_vec = f32x4_splat(scalar);
        
        for i in (0..32).step_by(4) {
            let vec = v128_load(self.data[i..].as_ptr() as *const v128);
            let result = f32x4_mul(vec, scalar_vec);
            v128_store(self.data[i..].as_mut_ptr() as *mut v128, result);
        }
    }

    /// Get a slice view of the data
    pub fn as_slice(&self) -> &[f32] {
        &self.data[..]
    }

    /// Get a mutable slice view of the data
    pub fn as_mut_slice(&mut self) -> &mut [f32] {
        &mut self.data[..]
    }

    /// Create zero vector (alias for compatibility)
    pub fn zeros() -> Self {
        Self::zero()
    }
    
    /// Add two vectors element-wise with SIMD acceleration
    pub fn add(&self, other: &Self) -> Self {
        let mut result = *self;
        result.add_assign(other);
        result
    }
    
    /// Add another vector to this vector in-place with SIMD acceleration
    pub fn add_assign(&mut self, other: &Self) {
        #[cfg(all(feature = "simd-wasm", target_arch = "wasm32"))]
        {
            self.add_assign_wasm_simd(other);
        }
        #[cfg(all(feature = "simd", not(all(feature = "simd-wasm", target_arch = "wasm32"))))]
        {
            self.add_assign_simd(other);
        }
        #[cfg(not(feature = "simd"))]
        {
            for i in 0..32 {
                self.data[i] += other.data[i];
            }
        }
    }
    
    /// SIMD vector addition
    #[cfg(all(feature = "simd", not(all(feature = "simd-wasm", target_arch = "wasm32"))))]
    fn add_assign_simd(&mut self, other: &Self) {
        for i in (0..32).step_by(8) {
            let a_vec = f32x8::from([self.data[i], self.data[i+1], self.data[i+2], self.data[i+3],
                                    self.data[i+4], self.data[i+5], self.data[i+6], self.data[i+7]]);
            let b_vec = f32x8::from([other.data[i], other.data[i+1], other.data[i+2], other.data[i+3],
                                    other.data[i+4], other.data[i+5], other.data[i+6], other.data[i+7]]);
            let result = a_vec + b_vec;
            let result_array = result.to_array();
            self.data[i..i+8].copy_from_slice(&result_array);
        }
    }
    
    /// WASM SIMD vector addition
    #[cfg(all(feature = "simd-wasm", target_arch = "wasm32"))]
    fn add_assign_wasm_simd(&mut self, other: &Self) {
        for i in (0..32).step_by(4) {
            let a_vec = v128_load(self.data[i..].as_ptr() as *const v128);
            let b_vec = v128_load(other.data[i..].as_ptr() as *const v128);
            let result = f32x4_add(a_vec, b_vec);
            v128_store(self.data[i..].as_mut_ptr() as *mut v128, result);
        }
    }
}

impl Default for RootVector {
    fn default() -> Self {
        Self::zero()
    }
}

impl Index<usize> for RootVector {
    type Output = f32;

    fn index(&self, index: usize) -> &Self::Output {
        &self.data[index]
    }
}

impl IndexMut<usize> for RootVector {
    fn index_mut(&mut self, index: usize) -> &mut Self::Output {
        &mut self.data[index]
    }
}

impl fmt::Debug for RootVector {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "RootVector[")?;
        for (i, val) in self.data.iter().enumerate() {
            if i > 0 { write!(f, ", ")?; }
            write!(f, "{:.3}", val)?;
        }
        write!(f, "]")
    }
}

/// The 32-dimensional root space containing orthonormal basis vectors
pub struct RootSpace {
    /// The orthonormal basis vectors (rows of matrix H)
    pub basis: Vec<RootVector>,
    /// The Cartan matrix representation
    pub cartan: CartanMatrix,
}

impl RootSpace {
    /// Create a new root space with default initialization
    pub fn new() -> Self {
        let mut basis = Vec::with_capacity(32);
        
        // Initialize with identity-like basis
        for i in 0..32 {
            let mut vec = RootVector::zero();
            vec.data[i] = libm::sqrtf(2.0); // Cartan convention: ⟨αᵢ, αᵢ⟩ = 2
            basis.push(vec);
        }

        let cartan = CartanMatrix::default();
        
        Self { basis, cartan }
    }

    /// Initialize from a pre-computed basis
    pub fn from_basis(basis: Vec<RootVector>) -> Result<Self, &'static str> {
        if basis.len() != 32 {
            return Err("Root space must have exactly 32 basis vectors");
        }

        // Verify orthonormality with Cartan scaling
        for i in 0..32 {
            let self_dot = basis[i].dot(&basis[i]);
            if libm::fabsf(self_dot - 2.0) > 0.01 {
                return Err("Basis vectors must have Cartan norm sqrt(2)");
            }
            
            for j in (i+1)..32 {
                let cross_dot = basis[i].dot(&basis[j]);
                if libm::fabsf(cross_dot) > 0.01 {
                    return Err("Basis vectors must be orthogonal");
                }
            }
        }

        let cartan = CartanMatrix::from_basis(&basis);
        Ok(Self { basis, cartan })
    }

    /// Project a high-dimensional vector to root space with SIMD acceleration
    pub fn project(&self, input: &[f32]) -> RootVector {
        #[cfg(feature = "simd")]
        {
            self.project_simd(input)
        }
        #[cfg(not(feature = "simd"))]
        {
            let mut result = RootVector::zero();
            
            for i in 0..32 {
                let basis_vec = &self.basis[i];
                
                // Create input vector for dot product
                let mut input_vec = RootVector::zero();
                let copy_len = input.len().min(32);
                input_vec.data[..copy_len].copy_from_slice(&input[..copy_len]);
                
                // Use the dot product method
                result.data[i] = basis_vec.dot(&input_vec);
            }
            
            result
        }
    }
    
    /// SIMD-accelerated matrix-vector multiplication for projections
    #[cfg(feature = "simd")]
    pub fn project_simd(&self, input: &[f32]) -> RootVector {
        let mut result = RootVector::zero();
        let input_len = input.len().min(32);
        
        // Prepare input vector with proper alignment
        let mut aligned_input = [0.0f32; 32];
        aligned_input[..input_len].copy_from_slice(&input[..input_len]);
        
        for i in 0..32 {
            let basis_row = &self.basis[i].data;
            
            #[cfg(all(feature = "simd", not(all(feature = "simd-wasm", target_arch = "wasm32"))))]
            {
                let mut sum = f32x8::ZERO;
                for j in (0..32).step_by(8) {
                    let a_vec = f32x8::from([aligned_input[j], aligned_input[j+1], aligned_input[j+2], aligned_input[j+3],
                                            aligned_input[j+4], aligned_input[j+5], aligned_input[j+6], aligned_input[j+7]]);
                    let b_vec = f32x8::from([basis_row[j], basis_row[j+1], basis_row[j+2], basis_row[j+3],
                                            basis_row[j+4], basis_row[j+5], basis_row[j+6], basis_row[j+7]]);
                    sum += a_vec * b_vec;
                }
                let sum_array = sum.to_array();
                result.data[i] = sum_array.iter().sum();
            }
            
            #[cfg(all(feature = "simd-wasm", target_arch = "wasm32"))]
            {
                let mut sum = f32x4_splat(0.0);
                for j in (0..32).step_by(4) {
                    let a_vec = v128_load(aligned_input[j..].as_ptr() as *const v128);
                    let b_vec = v128_load(basis_row[j..].as_ptr() as *const v128);
                    sum = f32x4_add(sum, f32x4_mul(a_vec, b_vec));
                }
                result.data[i] = f32x4_extract_lane::<0>(sum) + f32x4_extract_lane::<1>(sum) +
                                 f32x4_extract_lane::<2>(sum) + f32x4_extract_lane::<3>(sum);
            }
        }
        
        result
    }
}

/// The Cartan matrix representation
/// 
/// A 32x32 matrix with 2's on the diagonal and specific off-diagonal
/// values encoding the angle relationships between root vectors.
pub struct CartanMatrix {
    /// The matrix data in row-major order
    pub data: [[f32; 32]; 32],
}

impl CartanMatrix {
    /// Create a default Cartan matrix (diagonal)
    pub fn default() -> Self {
        let mut data = [[0.0; 32]; 32];
        
        // Initialize diagonal elements to 2
        for i in 0..32 {
            data[i][i] = 2.0;
        }
        
        Self { data }
    }

    /// Create from a basis of root vectors
    pub fn from_basis(basis: &[RootVector]) -> Self {
        let mut data = [[0.0; 32]; 32];
        
        // Compute Cartan matrix entries: C_ij = 2⟨αᵢ, αⱼ⟩/⟨αⱼ, αⱼ⟩
        // Pre-compute diagonal elements for efficiency
        let mut diagonal_norms = [0.0f32; 32];
        for j in 0..32 {
            diagonal_norms[j] = basis[j].dot(&basis[j]);
        }
        
        for i in 0..32 {
            for j in 0..32 {
                let dot_ij = basis[i].dot(&basis[j]);
                data[i][j] = 2.0 * dot_ij / diagonal_norms[j];
            }
        }
        
        Self { data }
    }

    /// Compute the Frobenius norm difference from a target matrix with SIMD acceleration
    pub fn frobenius_distance(&self, target: &Self) -> f32 {
        #[cfg(all(feature = "simd", not(all(feature = "simd-wasm", target_arch = "wasm32"))))]
        {
            let mut sum = f32x8::ZERO;
            
            for i in 0..32 {
                for j in (0..32).step_by(8) {
                    let self_vec = f32x8::from([self.data[i][j], self.data[i][j+1], self.data[i][j+2], self.data[i][j+3],
                                               self.data[i][j+4], self.data[i][j+5], self.data[i][j+6], self.data[i][j+7]]);
                    let target_vec = f32x8::from([target.data[i][j], target.data[i][j+1], target.data[i][j+2], target.data[i][j+3],
                                                  target.data[i][j+4], target.data[i][j+5], target.data[i][j+6], target.data[i][j+7]]);
                    let diff = self_vec - target_vec;
                    sum += diff * diff;
                }
            }
            
            let sum_array = sum.to_array();
            let total_sum: f32 = sum_array.iter().sum();
            return libm::sqrtf(total_sum);
        }
        
        #[cfg(all(feature = "simd-wasm", target_arch = "wasm32"))]
        {
            let mut sum = f32x4_splat(0.0);
            
            for i in 0..32 {
                for j in (0..32).step_by(4) {
                    let self_vec = v128_load(&self.data[i][j] as *const f32 as *const v128);
                    let target_vec = v128_load(&target.data[i][j] as *const f32 as *const v128);
                    let diff = f32x4_sub(self_vec, target_vec);
                    sum = f32x4_add(sum, f32x4_mul(diff, diff));
                }
            }
            
            let total_sum = f32x4_extract_lane::<0>(sum) + f32x4_extract_lane::<1>(sum) +
                           f32x4_extract_lane::<2>(sum) + f32x4_extract_lane::<3>(sum);
            return libm::sqrtf(total_sum);
        }
        
        #[cfg(not(feature = "simd"))]
        {
            let mut sum = 0.0f32;
            
            for i in 0..32 {
                for j in 0..32 {
                    let diff = self.data[i][j] - target.data[i][j];
                    sum += diff * diff;
                }
            }
            
            libm::sqrtf(sum)
        }
    }
}

impl Default for RootSpace {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_root_vector_creation() {
        let vec = RootVector::zero();
        assert_eq!(vec.data[0], 0.0);
        assert_eq!(vec.data[31], 0.0);
    }

    #[test]
    fn test_root_vector_dot_product() {
        let mut v1 = RootVector::zero();
        let mut v2 = RootVector::zero();
        
        v1.data[0] = 1.0;
        v2.data[0] = 2.0;
        
        assert_eq!(v1.dot(&v2), 2.0);
    }

    #[test]
    fn test_root_space_initialization() {
        let space = RootSpace::new();
        assert_eq!(space.basis.len(), 32);
        
        // Check Cartan normalization
        for vec in &space.basis {
            let norm_squared = vec.dot(vec);
            assert!((norm_squared - 2.0).abs() < 0.001);
        }
    }
}