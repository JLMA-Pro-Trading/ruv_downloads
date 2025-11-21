//! Micro Cartan Attention - Mathematical Cartan matrix system
//! 
//! This crate provides complete Cartan matrix-based attention mechanisms
//! with proper Lie algebra structures, root systems, and mathematical constraints.
//!
//! # Mathematical Background
//!
//! Cartan matrices encode the geometric structure of Lie algebras through
//! their root systems. This implementation supports:
//!
//! - Classical Cartan matrix types: A_n, B_n, C_n, D_n
//! - Exceptional types: E_6, E_7, E_8, F_4, G_2 (partial)
//! - Killing form calculations
//! - Root system computations
//! - Orthogonalization with Cartan constraints
//! - Regularization: L = λ‖C_actual - C_target‖²

#![no_std]
#![forbid(unsafe_code)]
#![warn(missing_docs)]

extern crate alloc;
use alloc::{vec::Vec, string::String};
use nalgebra::{SMatrix, SVector};

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// 32-dimensional root space constant
pub const ROOT_DIM: usize = 32;

// Math utilities for no_std
#[inline]
pub fn sqrt_f32(x: f32) -> f32 {
    #[cfg(feature = "std")]
    {
        x.sqrt()
    }
    #[cfg(not(feature = "std"))]
    {
        libm::sqrtf(x)
    }
}

#[inline]
pub fn powf_f32(x: f32, y: f32) -> f32 {
    #[cfg(feature = "std")]
    {
        x.powf(y)
    }
    #[cfg(not(feature = "std"))]
    {
        libm::powf(x, y)
    }
}

#[inline]
pub fn exp_f32(x: f32) -> f32 {
    #[cfg(feature = "std")]
    {
        x.exp()
    }
    #[cfg(not(feature = "std"))]
    {
        libm::expf(x)
    }
}

#[inline]
pub fn max_f32(a: f32, b: f32) -> f32 {
    #[cfg(feature = "std")]
    {
        a.max(b)
    }
    #[cfg(not(feature = "std"))]
    {
        if a > b { a } else { b }
    }
}

/// Simple 32D vector type for root vectors
#[derive(Clone, Copy, Debug, Default, PartialEq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct RootVector {
    /// Vector data
    pub data: [f32; ROOT_DIM],
}

impl RootVector {
    /// Create zero vector
    pub fn zero() -> Self {
        Self { data: [0.0; ROOT_DIM] }
    }
    
    /// Create vector from array
    pub fn from_array(data: [f32; ROOT_DIM]) -> Self {
        Self { data }
    }
    
    /// Compute dot product with another vector
    pub fn dot(&self, other: &Self) -> f32 {
        self.data.iter().zip(other.data.iter()).map(|(a, b)| a * b).sum()
    }
    
    /// Compute L2 norm
    pub fn norm(&self) -> f32 {
        sqrt_f32(self.dot(self))
    }
    
    /// Normalize vector in place
    pub fn normalize(&mut self) {
        let norm = self.norm();
        if norm > 1e-10 {
            for x in &mut self.data {
                *x /= norm;
            }
        }
    }
    
    /// Apply function to each element
    pub fn map<F>(&self, f: F) -> Self
    where
        F: Fn(f32) -> f32,
    {
        let mut result = *self;
        for x in &mut result.data {
            *x = f(*x);
        }
        result
    }
}

// Index operators for RootVector
impl core::ops::Index<usize> for RootVector {
    type Output = f32;
    
    fn index(&self, index: usize) -> &Self::Output {
        &self.data[index]
    }
}

impl core::ops::IndexMut<usize> for RootVector {
    fn index_mut(&mut self, index: usize) -> &mut Self::Output {
        &mut self.data[index]
    }
}

// Arithmetic operations for RootVector
impl core::ops::Add for RootVector {
    type Output = Self;
    
    fn add(self, other: Self) -> Self {
        let mut result = self;
        for (a, b) in result.data.iter_mut().zip(other.data.iter()) {
            *a += b;
        }
        result
    }
}

impl core::ops::AddAssign for RootVector {
    fn add_assign(&mut self, other: Self) {
        for (a, b) in self.data.iter_mut().zip(other.data.iter()) {
            *a += b;
        }
    }
}

impl core::ops::Sub for RootVector {
    type Output = Self;
    
    fn sub(self, other: Self) -> Self {
        let mut result = self;
        for (a, b) in result.data.iter_mut().zip(other.data.iter()) {
            *a -= b;
        }
        result
    }
}

impl core::ops::Mul<f32> for RootVector {
    type Output = Self;
    
    fn mul(self, scalar: f32) -> Self {
        self.map(|x| x * scalar)
    }
}

/// Error types for the Cartan system
#[derive(Debug, Clone, PartialEq)]
pub enum Error {
    /// Invalid input parameters
    InvalidInput(String),
    /// Dimension mismatch in matrix operations
    DimensionMismatch { expected: usize, actual: usize },
    /// Invalid dimension for operation
    InvalidDimension { dim: usize },
    /// Invalid configuration
    InvalidConfiguration(String),
    /// Mathematical constraint violation
    ConstraintViolation(String),
    /// Numerical instability detected
    NumericalInstability,
}

/// Result type for Cartan operations
pub type Result<T> = core::result::Result<T, Error>;

// Re-export main components
pub use cartan::*;
pub use orthogonalization::*;
pub use regularization::*;
pub use attention::*;
pub use real_attention::*;

// Module declarations
pub mod cartan;
pub mod orthogonalization;
pub mod regularization;
pub mod attention;
pub mod real_attention;