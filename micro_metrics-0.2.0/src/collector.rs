//! Real metrics collector for micro-neural networks with performance counters

use alloc::string::String;
use alloc::vec::Vec;
use alloc::collections::BTreeMap as HashMap;
use crate::timing::TimingInfo;

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

// Platform-specific timing function
#[cfg(not(target_arch = "wasm32"))]
use std::time::SystemTime;

#[cfg(target_arch = "wasm32")]
#[cfg(feature = "wasm")]
use web_sys::window;

/// Get current time in nanoseconds
pub fn now() -> u64 {
    #[cfg(not(target_arch = "wasm32"))]
    {
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos() as u64
    }
    #[cfg(all(target_arch = "wasm32", feature = "wasm"))]
    {
        window()
            .and_then(|w| w.performance())
            .map(|p| (p.now() * 1_000_000.0) as u64) // Convert ms to ns
            .unwrap_or(0)
    }
    #[cfg(all(target_arch = "wasm32", not(feature = "wasm")))]
    {
        0 // Fallback for no-std WASM
    }
}

/// Real-time metrics collector with performance counters
pub struct MetricsCollector {
    /// Active collection flag
    pub active: bool,
    /// Performance counters
    counters: HashMap<String, u64>,
    /// Memory usage tracking
    memory_tracker: MemoryTracker,
    /// System resource monitor
    #[cfg(feature = "system-metrics")]
    system_monitor: SystemMonitor,
    /// Agent tracking
    agent_trackers: HashMap<u32, AgentTracker>,
    /// Operation history
    operation_history: Vec<OperationRecord>,
    /// Start time for uptime calculation
    start_time: u64,
}

impl MetricsCollector {
    /// Create new metrics collector with real tracking
    pub fn new() -> Self {
        Self {
            active: true,
            counters: HashMap::default(),
            memory_tracker: MemoryTracker::new(),
            #[cfg(feature = "system-metrics")]
            system_monitor: SystemMonitor::new(),
            agent_trackers: HashMap::default(),
            operation_history: Vec::new(),
            start_time: now(),
        }
    }
    
    /// Increment a performance counter
    pub fn increment_counter(&mut self, name: &str) {
        if self.active {
            *self.counters.entry(name.to_string()).or_insert(0) += 1;
        }
    }
    
    /// Add value to a performance counter
    pub fn add_counter(&mut self, name: &str, value: u64) {
        if self.active {
            *self.counters.entry(name.to_string()).or_insert(0) += value;
        }
    }
    
    /// Record operation timing
    pub fn record_operation(&mut self, operation: &str, timing: TimingInfo) {
        if self.active {
            let record = OperationRecord {
                operation: operation.to_string(),
                duration_ns: timing.elapsed_ns,
                timestamp: now(),
            };
            self.operation_history.push(record);
            self.increment_counter(&format!("{}_operations", operation));
            self.add_counter(&format!("{}_total_time_ns", operation), timing.elapsed_ns);
        }
    }
    
    /// Track agent activity
    pub fn track_agent(&mut self, agent_id: u32, success: bool) {
        if self.active {
            let tracker = self.agent_trackers.entry(agent_id).or_insert_with(|| AgentTracker::new(agent_id));
            tracker.record_activity(success);
        }
    }
    
    /// Record memory allocation
    pub fn record_allocation(&mut self, size: usize) {
        if self.active {
            self.memory_tracker.record_allocation(size);
        }
    }
    
    /// Record memory deallocation
    pub fn record_deallocation(&mut self, size: usize) {
        if self.active {
            self.memory_tracker.record_deallocation(size);
        }
    }
    
    /// Collect comprehensive system metrics
    pub fn collect(&mut self) -> SystemMetrics {
        if !self.active {
            return SystemMetrics::default();
        }
        
        let current_time = now();
        let uptime_ns = current_time.saturating_sub(self.start_time);
        
        SystemMetrics {
            uptime_ns,
            total_operations: self.counters.values().sum(),
            memory_usage: self.memory_tracker.current_usage(),
            peak_memory_usage: self.memory_tracker.peak_usage(),
            total_allocations: self.memory_tracker.total_allocations(),
            total_deallocations: self.memory_tracker.total_deallocations(),
            counters: self.counters.clone(),
            operation_stats: self.calculate_operation_stats(),
            #[cfg(feature = "system-metrics")]
            system_stats: self.system_monitor.collect(),
            #[cfg(not(feature = "system-metrics"))]
            system_stats: SystemStats::default(),
            active_agents: self.agent_trackers.len() as u32,
        }
    }
    
    /// Get agent metrics
    pub fn get_agent_metrics(&self) -> Vec<AgentMetrics> {
        self.agent_trackers.values().map(|tracker| tracker.get_metrics()).collect()
    }
    
    /// Calculate operation statistics
    fn calculate_operation_stats(&self) -> HashMap<String, OperationStats> {
        let mut stats = HashMap::default();
        
        for record in &self.operation_history {
            let entry = stats.entry(record.operation.clone()).or_insert_with(OperationStats::new);
            entry.add_sample(record.duration_ns);
        }
        
        stats
    }
    
    /// Reset all metrics
    pub fn reset(&mut self) {
        self.counters.clear();
        self.memory_tracker.reset();
        self.agent_trackers.clear();
        self.operation_history.clear();
        self.start_time = now();
    }
    
    /// Get performance counter value
    pub fn get_counter(&self, name: &str) -> u64 {
        self.counters.get(name).copied().unwrap_or(0)
    }
    
    /// Get all counter names
    pub fn get_counter_names(&self) -> Vec<String> {
        self.counters.keys().cloned().collect()
    }
}

/// Comprehensive system-wide performance metrics
#[derive(Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct SystemMetrics {
    /// System uptime in nanoseconds
    pub uptime_ns: u64,
    /// Total operations performed
    pub total_operations: u64,
    /// Current memory usage in bytes
    pub memory_usage: u64,
    /// Peak memory usage in bytes
    pub peak_memory_usage: u64,
    /// Total memory allocations
    pub total_allocations: u64,
    /// Total memory deallocations
    pub total_deallocations: u64,
    /// Performance counters by name
    pub counters: HashMap<String, u64>,
    /// Operation statistics
    pub operation_stats: HashMap<String, OperationStats>,
    /// System resource statistics
    pub system_stats: SystemStats,
    /// Number of active agents
    pub active_agents: u32,
}

/// Operation performance statistics
#[derive(Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct OperationStats {
    /// Number of samples
    pub count: u64,
    /// Total duration in nanoseconds
    pub total_ns: u64,
    /// Minimum duration in nanoseconds
    pub min_ns: u64,
    /// Maximum duration in nanoseconds
    pub max_ns: u64,
    /// Average duration in nanoseconds
    pub avg_ns: u64,
    /// Standard deviation in nanoseconds
    pub std_dev_ns: f64,
    /// Samples for percentile calculations
    samples: Vec<u64>,
}

/// System resource statistics
#[derive(Clone, Default)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct SystemStats {
    /// CPU usage percentage (0.0-100.0)
    pub cpu_usage: f32,
    /// Available memory in bytes
    pub available_memory: u64,
    /// Total memory in bytes
    pub total_memory: u64,
    /// Memory usage percentage (0.0-100.0)
    pub memory_usage_percent: f32,
    /// Number of CPU cores
    pub cpu_cores: u32,
    /// System load average (1-minute)
    pub load_average: f32,
}

/// Comprehensive agent performance metrics
#[derive(Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct AgentMetrics {
    /// Agent identifier
    pub id: u32,
    /// Success rate (0.0-1.0)
    pub success_rate: f32,
    /// Total operations performed
    pub total_operations: u64,
    /// Successful operations
    pub successful_operations: u64,
    /// Failed operations
    pub failed_operations: u64,
    /// Average operation duration in nanoseconds
    pub avg_duration_ns: u64,
    /// Last activity timestamp
    pub last_activity: u64,
    /// Agent uptime in nanoseconds
    pub uptime_ns: u64,
    /// Resource usage statistics
    pub resource_usage: ResourceUsage,
}

/// Resource usage tracking
#[derive(Clone, Default)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct ResourceUsage {
    /// CPU time used in nanoseconds
    pub cpu_time_ns: u64,
    /// Memory allocated in bytes
    pub memory_allocated: u64,
    /// Network bytes sent
    pub network_bytes_sent: u64,
    /// Network bytes received
    pub network_bytes_received: u64,
    /// Disk bytes read
    pub disk_bytes_read: u64,
    /// Disk bytes written
    pub disk_bytes_written: u64,
}

/// Memory tracking utility
struct MemoryTracker {
    current_usage: u64,
    peak_usage: u64,
    total_allocations: u64,
    total_deallocations: u64,
}

impl MemoryTracker {
    fn new() -> Self {
        Self {
            current_usage: 0,
            peak_usage: 0,
            total_allocations: 0,
            total_deallocations: 0,
        }
    }
    
    fn record_allocation(&mut self, size: usize) {
        self.current_usage += size as u64;
        self.total_allocations += 1;
        if self.current_usage > self.peak_usage {
            self.peak_usage = self.current_usage;
        }
    }
    
    fn record_deallocation(&mut self, size: usize) {
        self.current_usage = self.current_usage.saturating_sub(size as u64);
        self.total_deallocations += 1;
    }
    
    fn current_usage(&self) -> u64 { self.current_usage }
    fn peak_usage(&self) -> u64 { self.peak_usage }
    fn total_allocations(&self) -> u64 { self.total_allocations }
    fn total_deallocations(&self) -> u64 { self.total_deallocations }
    
    fn reset(&mut self) {
        self.current_usage = 0;
        self.peak_usage = 0;
        self.total_allocations = 0;
        self.total_deallocations = 0;
    }
}

/// System resource monitor
#[cfg(feature = "system-metrics")]
struct SystemMonitor {
    #[cfg(feature = "std")]
    system: sysinfo::System,
}

#[cfg(feature = "system-metrics")]
impl SystemMonitor {
    fn new() -> Self {
        #[cfg(feature = "std")]
        {
            let mut system = sysinfo::System::new();
            system.refresh_all();
            Self { system }
        }
        #[cfg(not(feature = "std"))]
        {
            Self {}
        }
    }
    
    fn collect(&mut self) -> SystemStats {
        #[cfg(feature = "std")]
        {
            self.system.refresh_cpu();
            self.system.refresh_memory();
            
            let cpu_usage = self.system.global_cpu_info().cpu_usage();
            let total_memory = self.system.total_memory();
            let available_memory = self.system.available_memory();
            let used_memory = total_memory - available_memory;
            let memory_usage_percent = if total_memory > 0 {
                (used_memory as f32 / total_memory as f32) * 100.0
            } else {
                0.0
            };
            
            SystemStats {
                cpu_usage,
                available_memory,
                total_memory,
                memory_usage_percent,
                cpu_cores: self.system.cpus().len() as u32,
                load_average: sysinfo::System::load_average().one as f32,
            }
        }
        #[cfg(not(feature = "std"))]
        {
            SystemStats::default()
        }
    }
}

/// Agent activity tracker
#[derive(Clone)]
struct AgentTracker {
    id: u32,
    total_operations: u64,
    successful_operations: u64,
    failed_operations: u64,
    total_duration_ns: u64,
    start_time: u64,
    last_activity: u64,
    resource_usage: ResourceUsage,
}

impl AgentTracker {
    fn new(id: u32) -> Self {
        let now_time = now();
        Self {
            id,
            total_operations: 0,
            successful_operations: 0,
            failed_operations: 0,
            total_duration_ns: 0,
            start_time: now_time,
            last_activity: now_time,
            resource_usage: ResourceUsage::default(),
        }
    }
    
    fn record_activity(&mut self, success: bool) {
        self.total_operations += 1;
        if success {
            self.successful_operations += 1;
        } else {
            self.failed_operations += 1;
        }
        self.last_activity = now();
    }
    
    fn get_metrics(&self) -> AgentMetrics {
        let success_rate = if self.total_operations > 0 {
            self.successful_operations as f32 / self.total_operations as f32
        } else {
            0.0
        };
        
        let avg_duration_ns = if self.total_operations > 0 {
            self.total_duration_ns / self.total_operations
        } else {
            0
        };
        
        let uptime_ns = now().saturating_sub(self.start_time);
        
        AgentMetrics {
            id: self.id,
            success_rate,
            total_operations: self.total_operations,
            successful_operations: self.successful_operations,
            failed_operations: self.failed_operations,
            avg_duration_ns,
            last_activity: self.last_activity,
            uptime_ns,
            resource_usage: self.resource_usage.clone(),
        }
    }
}

/// Operation record for timing analysis
#[derive(Clone)]
struct OperationRecord {
    operation: String,
    duration_ns: u64,
    timestamp: u64,
}

impl OperationStats {
    fn new() -> Self {
        Self {
            count: 0,
            total_ns: 0,
            min_ns: u64::MAX,
            max_ns: 0,
            avg_ns: 0,
            std_dev_ns: 0.0,
            samples: Vec::new(),
        }
    }
    
    fn add_sample(&mut self, duration_ns: u64) {
        self.count += 1;
        self.total_ns += duration_ns;
        self.min_ns = self.min_ns.min(duration_ns);
        self.max_ns = self.max_ns.max(duration_ns);
        self.avg_ns = self.total_ns / self.count;
        
        // Keep samples for percentile calculations (limit to 1000 samples)
        if self.samples.len() < 1000 {
            self.samples.push(duration_ns);
        } else {
            // Replace random sample to maintain distribution
            let idx = (duration_ns % 1000) as usize;
            self.samples[idx] = duration_ns;
        }
        
        // Calculate standard deviation
        if self.count > 1 {
            let variance: f64 = self.samples.iter()
                .map(|&x| {
                    let diff = x as f64 - self.avg_ns as f64;
                    diff * diff
                })
                .sum::<f64>() / self.samples.len() as f64;
            self.std_dev_ns = variance.sqrt();
        }
    }
    
    /// Calculate percentile (0.0-1.0)
    pub fn percentile(&self, p: f64) -> u64 {
        if self.samples.is_empty() {
            return 0;
        }
        
        let mut sorted = self.samples.clone();
        sorted.sort_unstable();
        
        let index = (p * (sorted.len() - 1) as f64).round() as usize;
        sorted[index.min(sorted.len() - 1)]
    }
    
    /// Get p50 (median)
    pub fn p50(&self) -> u64 { self.percentile(0.5) }
    
    /// Get p95
    pub fn p95(&self) -> u64 { self.percentile(0.95) }
    
    /// Get p99
    pub fn p99(&self) -> u64 { self.percentile(0.99) }
}

impl Default for SystemMetrics {
    fn default() -> Self {
        Self {
            uptime_ns: 0,
            total_operations: 0,
            memory_usage: 0,
            peak_memory_usage: 0,
            total_allocations: 0,
            total_deallocations: 0,
            counters: HashMap::default(),
            operation_stats: HashMap::default(),
            system_stats: SystemStats::default(),
            active_agents: 0,
        }
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}