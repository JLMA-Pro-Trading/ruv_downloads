//! ReasoningBank - Trajectory Tracking and Learning
//!
//! Implements:
//! - Trajectory tracking for agent decisions
//! - Verdict judgment (predicted vs actual outcomes)
//! - Memory distillation and compression
//! - Feedback loops for continuous learning

pub mod trajectory;
pub mod verdict;
pub mod distillation;

pub use trajectory::{TrajectoryTracker, Trajectory, Observation, Action};
pub use verdict::{VerdictJudge, Verdict, VerdictResult};
pub use distillation::{MemoryDistiller, DistilledPattern};
