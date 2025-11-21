//! # CUDA-WASM
//! 
//! High-performance CUDA to WebAssembly/WebGPU transpiler that enables GPU-accelerated 
//! computing in web browsers and Node.js environments.
//! 
//! ## Features
//! 
//! - **CUDA to WebAssembly transpilation** - Convert CUDA kernels to run anywhere
//! - **WebGPU acceleration** - Native browser GPU support with near-native performance
//! - **Memory safety** - Rust's ownership model prevents GPU memory errors
//! - **Cross-platform** - Works in browsers, Node.js, Deno, and native environments
//! 
//! ## Quick Start
//! 
//! ### Using the CLI (Recommended)
//! 
//! ```bash
//! # Install globally
//! npm install -g cuda-wasm
//! 
//! # Or use directly with npx
//! npx cuda-wasm transpile kernel.cu -o kernel.wasm
//! ```
//! 
//! ### Using as a Rust Library
//! 
//! ```toml
//! [dependencies]
//! cuda-wasm = "0.1"
//! ```
//! 
//! ```rust
//! use cuda_wasm::{transpiler::CudaTranspiler, runtime::WebGPURuntime};
//! 
//! // Transpile CUDA to WebAssembly
//! let transpiler = CudaTranspiler::new();
//! let wasm_code = transpiler.transpile(cuda_source)?;
//! 
//! // Execute on WebGPU
//! let runtime = WebGPURuntime::new().await?;
//! let kernel = runtime.create_kernel(wasm_code)?;
//! kernel.launch(grid, block, args).await?;
//! ```

#![cfg_attr(docsrs, feature(doc_cfg))]
#![warn(missing_docs)]
#![doc = include_str!("../README.md")]

// Re-export everything from cuda-rust-wasm
pub use cuda_rust_wasm::*;

/// The version of the cuda-wasm crate
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Convenience prelude module
pub mod prelude {
    pub use crate::{
        error::{CudaRustError, Result},
        transpiler::{CudaTranspiler, TranspilerOptions},
        runtime::{WebGPURuntime, WasmRuntime},
        kernel::{KernelLaunch, Grid, Block},
        memory::{DeviceBuffer, HostBuffer},
    };
    
    #[cfg(feature = "native-gpu")]
    pub use crate::backend::native_gpu::NativeGPUBackend;
}