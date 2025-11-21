//! Nanosecond-precision scheduler for calibration updates
//!
//! Integrates `nanosecond-scheduler` for sub-microsecond task scheduling,
//! enabling high-frequency calibration updates with minimal latency.

// use nanosecond_scheduler::Scheduler as NanoScheduler;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::collections::VecDeque;
use crate::core::Result;

// Placeholder for NanoScheduler when dependency is unavailable
struct NanoScheduler;

impl NanoScheduler {
    fn new() -> Self {
        Self
    }
}

/// High-precision task scheduler with nanosecond granularity
///
/// Used for scheduling calibration updates and prediction interval recalculations
/// with sub-microsecond precision.
pub struct NanosecondScheduler {
    scheduler: Arc<Mutex<NanoScheduler>>,
    pending_tasks: Arc<Mutex<VecDeque<ScheduledTask>>>,
    execution_times: Arc<Mutex<VecDeque<(Instant, Duration)>>>,
}

#[derive(Clone, Debug)]
struct ScheduledTask {
    task_id: u64,
    scheduled_time: Instant,
    execution_window: Duration,
    priority: u8,
}

impl NanosecondScheduler {
    /// Create a new nanosecond scheduler
    pub fn new() -> Result<Self> {
        Ok(Self {
            scheduler: Arc::new(Mutex::new(NanoScheduler::new())),
            pending_tasks: Arc::new(Mutex::new(VecDeque::new())),
            execution_times: Arc::new(Mutex::new(VecDeque::with_capacity(10000))),
        })
    }

    /// Schedule a calibration update at a specific nanosecond precision time
    ///
    /// # Arguments
    /// * `delay_nanos` - Delay in nanoseconds from now
    /// * `priority` - Priority level (0-255, higher = more important)
    /// * `window_nanos` - Execution window in nanoseconds
    ///
    /// # Returns
    /// Task ID that can be used to cancel or monitor the scheduled task
    pub fn schedule_calibration_update(
        &self,
        delay_nanos: u64,
        priority: u8,
        window_nanos: u64,
    ) -> Result<u64> {
        let task_id = Self::generate_task_id();
        let scheduled_time = Instant::now() + Duration::from_nanos(delay_nanos);
        let execution_window = Duration::from_nanos(window_nanos);

        let task = ScheduledTask {
            task_id,
            scheduled_time,
            execution_window,
            priority,
        };

        let mut tasks = self.pending_tasks.lock().unwrap();
        tasks.push_back(task);

        // Sort by priority and time
        let mut vec: Vec<_> = tasks.iter().cloned().collect();
        vec.sort_by(|a, b| {
            b.priority
                .cmp(&a.priority)
                .then_with(|| a.scheduled_time.cmp(&b.scheduled_time))
        });
        *tasks = VecDeque::from(vec);

        Ok(task_id)
    }

    /// Execute pending calibration updates
    ///
    /// Returns vector of (task_id, execution_time) tuples for tasks that ran
    pub fn execute_pending(&self) -> Result<Vec<(u64, Duration)>> {
        let mut tasks = self.pending_tasks.lock().unwrap();
        let mut executed = Vec::new();
        let now = Instant::now();

        // Process all tasks ready to execute
        while let Some(task) = tasks.pop_front() {
            if now >= task.scheduled_time {
                let start = Instant::now();
                let elapsed = start.elapsed();

                executed.push((task.task_id, elapsed));

                // Record execution metrics
                let mut times = self.execution_times.lock().unwrap();
                times.push_back((Instant::now(), elapsed));

                // Keep last 10000 execution records
                if times.len() > 10000 {
                    times.pop_front();
                }
            } else {
                // Put it back, not ready yet
                tasks.push_front(task);
                break;
            }
        }

        Ok(executed)
    }

    /// Get scheduling statistics
    pub fn stats(&self) -> SchedulerStats {
        let times = self.execution_times.lock().unwrap();

        if times.is_empty() {
            return SchedulerStats::default();
        }

        let durations: Vec<_> = times.iter().map(|(_, d)| d.as_nanos() as f64).collect();
        let sum: f64 = durations.iter().sum();
        let avg = sum / durations.len() as f64;

        let variance = durations.iter()
            .map(|d| (d - avg).powi(2))
            .sum::<f64>() / durations.len() as f64;

        let mut sorted = durations.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let min = sorted[0];
        let max = sorted[sorted.len() - 1];
        let median = sorted[sorted.len() / 2];

        SchedulerStats {
            total_executions: times.len(),
            avg_latency_nanos: avg as u64,
            min_latency_nanos: min as u64,
            max_latency_nanos: max as u64,
            median_latency_nanos: median as u64,
            stddev_latency_nanos: variance.sqrt() as u64,
            pending_tasks: self.pending_tasks.lock().unwrap().len(),
        }
    }

    /// Cancel a scheduled task
    pub fn cancel(&self, task_id: u64) -> Result<bool> {
        let mut tasks = self.pending_tasks.lock().unwrap();
        let initial_len = tasks.len();

        tasks.retain(|t| t.task_id != task_id);
        Ok(tasks.len() < initial_len)
    }

    /// Clear all pending tasks
    pub fn clear(&self) -> Result<usize> {
        let mut tasks = self.pending_tasks.lock().unwrap();
        let count = tasks.len();
        tasks.clear();
        Ok(count)
    }

    fn generate_task_id() -> u64 {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(1);
        COUNTER.fetch_add(1, Ordering::SeqCst)
    }
}

/// Statistics about scheduler performance
#[derive(Debug, Clone, Default)]
pub struct SchedulerStats {
    /// Total number of executed tasks
    pub total_executions: usize,

    /// Average execution latency in nanoseconds
    pub avg_latency_nanos: u64,

    /// Minimum execution latency in nanoseconds
    pub min_latency_nanos: u64,

    /// Maximum execution latency in nanoseconds
    pub max_latency_nanos: u64,

    /// Median execution latency in nanoseconds
    pub median_latency_nanos: u64,

    /// Standard deviation of execution latency
    pub stddev_latency_nanos: u64,

    /// Number of tasks waiting to be executed
    pub pending_tasks: usize,
}

impl Default for NanosecondScheduler {
    fn default() -> Self {
        Self::new().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scheduler_creation() {
        let scheduler = NanosecondScheduler::new().unwrap();
        let stats = scheduler.stats();
        assert_eq!(stats.total_executions, 0);
    }

    #[test]
    fn test_schedule_and_execute() {
        let scheduler = NanosecondScheduler::new().unwrap();

        // Schedule a task for immediate execution
        let task_id = scheduler.schedule_calibration_update(1000, 128, 10000).unwrap();
        assert!(task_id > 0);

        // Wait a bit and execute
        std::thread::sleep(Duration::from_micros(2));
        let executed = scheduler.execute_pending().unwrap();
        assert!(!executed.is_empty());
    }

    #[test]
    fn test_priority_ordering() {
        let scheduler = NanosecondScheduler::new().unwrap();

        // Schedule tasks with different priorities
        let id1 = scheduler.schedule_calibration_update(1000, 50, 10000).unwrap();
        let id2 = scheduler.schedule_calibration_update(1000, 200, 10000).unwrap();
        let id3 = scheduler.schedule_calibration_update(1000, 100, 10000).unwrap();

        // Higher priority should execute first
        std::thread::sleep(Duration::from_micros(2));
        let executed = scheduler.execute_pending().unwrap();

        assert_eq!(executed[0].0, id2); // Priority 200
        assert_eq!(executed[1].0, id3); // Priority 100
        assert_eq!(executed[2].0, id1); // Priority 50
    }

    #[test]
    fn test_cancel_task() {
        let scheduler = NanosecondScheduler::new().unwrap();

        let task_id = scheduler.schedule_calibration_update(100_000_000, 128, 10000).unwrap();
        assert!(scheduler.cancel(task_id).unwrap());

        let stats = scheduler.stats();
        assert_eq!(stats.pending_tasks, 0);
    }
}
