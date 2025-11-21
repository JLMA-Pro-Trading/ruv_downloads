//! Performance optimizations
//!
//! High-performance optimization modules for neural trading predictors.
//! Includes nanosecond-precision scheduling, sublinear score updates,
//! temporal lead solving, and self-tuning hyperparameter optimization.

pub mod scheduler;
pub mod sublinear;
pub mod temporal;
pub mod loops;

pub use scheduler::NanosecondScheduler;
pub use sublinear::SublinearUpdater;
pub use temporal::TemporalLeadSolver;
pub use loops::StrangeLoopOptimizer;
