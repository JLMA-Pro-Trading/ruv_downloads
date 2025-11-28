//! L2 Vector Database - AgentDB Integration
//!
//! Performance targets:
//! - Vector search: <1ms (p95)
//! - HNSW index: 150x faster than linear scan
//! - Batch insert: <10ms for 1000 vectors

pub mod vector_store;
pub mod embeddings;
pub mod storage;

pub use vector_store::{VectorStore, SearchResult};
pub use embeddings::{EmbeddingProvider, Embedding};
pub use storage::{StorageBackend, PersistentStore};
