//! Real metrics export functionality with comprehensive JSON serialization

use alloc::string::String;
use alloc::vec::Vec;
use alloc::collections::BTreeMap as HashMap;
use crate::{SystemMetrics, AgentMetrics};
use crate::timing::{TimingHistogram, OperationStatistics, PerformanceProfiler};

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

/// JSON exporter for metrics with real serialization
pub struct JsonExporter {
    /// Pretty print flag
    pub pretty: bool,
    /// Include detailed histograms
    pub include_histograms: bool,
    /// Include raw timing data
    pub include_raw_data: bool,
}

impl JsonExporter {
    /// Create new JSON exporter
    pub fn new() -> Self {
        Self { 
            pretty: false,
            include_histograms: true,
            include_raw_data: false,
        }
    }
    
    /// Create exporter with pretty printing
    pub fn pretty() -> Self {
        Self {
            pretty: true,
            include_histograms: true,
            include_raw_data: false,
        }
    }
    
    /// Enable or disable histogram inclusion
    pub fn with_histograms(mut self, include: bool) -> Self {
        self.include_histograms = include;
        self
    }
    
    /// Enable or disable raw data inclusion
    pub fn with_raw_data(mut self, include: bool) -> Self {
        self.include_raw_data = include;
        self
    }
    
    /// Export metrics report to JSON string
    pub fn export(&self, report: &MetricsReport) -> crate::Result<String> {
        let export_data = ExportData {
            timestamp: crate::collector::now(),
            system_metrics: report.system.clone(),
            agent_metrics: report.agents.clone(),
            profiler_stats: report.profiler_stats.clone(),
            histogram_data: if self.include_histograms {
                report.histogram_data.clone()
            } else {
                HashMap::default()
            },
            metadata: ExportMetadata {
                version: "1.0.0".to_string(),
                export_type: "metrics_report".to_string(),
                include_histograms: self.include_histograms,
                include_raw_data: self.include_raw_data,
            },
        };
        
        if self.pretty {
            serde_json::to_string_pretty(&export_data)
                .map_err(|_| "Failed to serialize metrics to pretty JSON")
        } else {
            serde_json::to_string(&export_data)
                .map_err(|_| "Failed to serialize metrics to JSON")
        }
    }
    
    /// Export system metrics only
    pub fn export_system_only(&self, system: &SystemMetrics) -> crate::Result<String> {
        let export_data = SystemExportData {
            timestamp: crate::collector::now(),
            system_metrics: system.clone(),
            metadata: ExportMetadata {
                version: "1.0.0".to_string(),
                export_type: "system_metrics".to_string(),
                include_histograms: false,
                include_raw_data: false,
            },
        };
        
        if self.pretty {
            serde_json::to_string_pretty(&export_data)
                .map_err(|_| "Failed to serialize system metrics to pretty JSON")
        } else {
            serde_json::to_string(&export_data)
                .map_err(|_| "Failed to serialize system metrics to JSON")
        }
    }
    
    /// Export agent metrics only
    pub fn export_agents_only(&self, agents: &[AgentMetrics]) -> crate::Result<String> {
        let export_data = AgentExportData {
            timestamp: crate::collector::now(),
            agent_metrics: agents.to_vec(),
            metadata: ExportMetadata {
                version: "1.0.0".to_string(),
                export_type: "agent_metrics".to_string(),
                include_histograms: false,
                include_raw_data: false,
            },
        };
        
        if self.pretty {
            serde_json::to_string_pretty(&export_data)
                .map_err(|_| "Failed to serialize agent metrics to pretty JSON")
        } else {
            serde_json::to_string(&export_data)
                .map_err(|_| "Failed to serialize agent metrics to JSON")
        }
    }
    
    /// Export performance statistics only
    pub fn export_performance_stats(&self, stats: &[OperationStatistics]) -> crate::Result<String> {
        let export_data = PerformanceExportData {
            timestamp: crate::collector::now(),
            performance_stats: stats.to_vec(),
            metadata: ExportMetadata {
                version: "1.0.0".to_string(),
                export_type: "performance_stats".to_string(),
                include_histograms: false,
                include_raw_data: false,
            },
        };
        
        if self.pretty {
            serde_json::to_string_pretty(&export_data)
                .map_err(|_| "Failed to serialize performance stats to pretty JSON")
        } else {
            serde_json::to_string(&export_data)
                .map_err(|_| "Failed to serialize performance stats to JSON")
        }
    }
}

/// Complete metrics report with real data
#[derive(Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MetricsReport {
    /// System metrics
    pub system: SystemMetrics,
    /// Agent metrics collection
    pub agents: Vec<AgentMetrics>,
    /// Performance profiler statistics
    pub profiler_stats: Vec<OperationStatistics>,
    /// Histogram data for visualization
    pub histogram_data: HashMap<String, HistogramData>,
    /// Report generation timestamp
    pub timestamp: u64,
    /// Report metadata
    pub metadata: ReportMetadata,
}

/// Histogram data for JSON export
#[derive(Clone, Debug)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct HistogramData {
    /// Operation name
    pub operation: String,
    /// Bucket boundaries in nanoseconds
    pub buckets: Vec<u64>,
    /// Count in each bucket
    pub counts: Vec<u64>,
    /// Total samples
    pub total_samples: u64,
    /// Statistical summary
    pub stats: HistogramStats,
}

/// Statistical summary for histogram
#[derive(Clone, Debug)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct HistogramStats {
    /// Mean in nanoseconds
    pub mean_ns: f64,
    /// Standard deviation in nanoseconds
    pub std_dev_ns: f64,
    /// 50th percentile in nanoseconds
    pub p50_ns: u64,
    /// 95th percentile in nanoseconds
    pub p95_ns: u64,
    /// 99th percentile in nanoseconds
    pub p99_ns: u64,
    /// Mean in milliseconds
    pub mean_ms: f64,
    /// p50 in milliseconds
    pub p50_ms: f64,
    /// p95 in milliseconds
    pub p95_ms: f64,
    /// p99 in milliseconds
    pub p99_ms: f64,
}

/// Report metadata
#[derive(Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct ReportMetadata {
    /// Report version
    pub version: String,
    /// Generation timestamp
    pub generated_at: u64,
    /// Duration of data collection in nanoseconds
    pub collection_duration_ns: u64,
    /// Number of operations tracked
    pub operations_tracked: u32,
    /// Export configuration
    pub export_config: ExportConfig,
}

/// Export configuration metadata
#[derive(Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct ExportConfig {
    /// Include histogram data
    pub include_histograms: bool,
    /// Include raw timing data
    pub include_raw_data: bool,
    /// Pretty print JSON
    pub pretty_print: bool,
}

/// Full export data structure
#[derive(Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
struct ExportData {
    timestamp: u64,
    system_metrics: SystemMetrics,
    agent_metrics: Vec<AgentMetrics>,
    profiler_stats: Vec<OperationStatistics>,
    histogram_data: HashMap<String, HistogramData>,
    metadata: ExportMetadata,
}

/// System-only export data
#[derive(Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
struct SystemExportData {
    timestamp: u64,
    system_metrics: SystemMetrics,
    metadata: ExportMetadata,
}

/// Agent-only export data
#[derive(Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
struct AgentExportData {
    timestamp: u64,
    agent_metrics: Vec<AgentMetrics>,
    metadata: ExportMetadata,
}

/// Performance-only export data
#[derive(Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
struct PerformanceExportData {
    timestamp: u64,
    performance_stats: Vec<OperationStatistics>,
    metadata: ExportMetadata,
}

/// Export metadata
#[derive(Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
struct ExportMetadata {
    version: String,
    export_type: String,
    include_histograms: bool,
    include_raw_data: bool,
}

impl MetricsReport {
    /// Create empty report
    pub fn new() -> Self {
        let timestamp = crate::collector::now();
        Self {
            system: SystemMetrics::default(),
            agents: Vec::new(),
            profiler_stats: Vec::new(),
            histogram_data: HashMap::default(),
            timestamp,
            metadata: ReportMetadata {
                version: "1.0.0".to_string(),
                generated_at: timestamp,
                collection_duration_ns: 0,
                operations_tracked: 0,
                export_config: ExportConfig {
                    include_histograms: true,
                    include_raw_data: false,
                    pretty_print: false,
                },
            },
        }
    }
    
    /// Create report from collector data
    pub fn from_collector(
        system: SystemMetrics,
        agents: Vec<AgentMetrics>,
        profiler: &PerformanceProfiler,
    ) -> Self {
        let timestamp = crate::collector::now();
        let profiler_stats = profiler.get_all_stats();
        
        // Convert histograms to export format
        let mut histogram_data = HashMap::default();
        for stat in &profiler_stats {
            if let Some(histogram) = profiler.get_histogram(&stat.operation) {
                let hist_data = HistogramData {
                    operation: stat.operation.clone(),
                    buckets: histogram.buckets().to_vec(),
                    counts: histogram.counts().to_vec(),
                    total_samples: histogram.count(),
                    stats: HistogramStats {
                        mean_ns: histogram.mean(),
                        std_dev_ns: histogram.std_dev(),
                        p50_ns: histogram.p50(),
                        p95_ns: histogram.p95(),
                        p99_ns: histogram.p99(),
                        mean_ms: histogram.mean() / 1_000_000.0,
                        p50_ms: histogram.p50() as f64 / 1_000_000.0,
                        p95_ms: histogram.p95() as f64 / 1_000_000.0,
                        p99_ms: histogram.p99() as f64 / 1_000_000.0,
                    },
                };
                histogram_data.insert(stat.operation.clone(), hist_data);
            }
        }
        
        Self {
            system: system.clone(),
            agents,
            profiler_stats,
            histogram_data,
            timestamp,
            metadata: ReportMetadata {
                version: "1.0.0".to_string(),
                generated_at: timestamp,
                collection_duration_ns: system.uptime_ns,
                operations_tracked: system.operation_stats.len() as u32,
                export_config: ExportConfig {
                    include_histograms: true,
                    include_raw_data: false,
                    pretty_print: false,
                },
            },
        }
    }
    
    /// Add agent metrics
    pub fn add_agent(&mut self, agent: AgentMetrics) {
        self.agents.push(agent);
    }
    
    /// Update system metrics
    pub fn update_system(&mut self, system: SystemMetrics) {
        self.metadata.collection_duration_ns = system.uptime_ns;
        self.metadata.operations_tracked = system.operation_stats.len() as u32;
        self.system = system;
    }
    
    /// Add profiler statistics
    pub fn add_profiler_stats(&mut self, stats: Vec<OperationStatistics>) {
        self.profiler_stats = stats;
    }
    
    /// Get summary statistics
    pub fn get_summary(&self) -> ReportSummary {
        ReportSummary {
            total_operations: self.system.total_operations,
            active_agents: self.system.active_agents,
            uptime_ms: self.system.uptime_ns as f64 / 1_000_000.0,
            memory_usage_mb: self.system.memory_usage as f64 / (1024.0 * 1024.0),
            peak_memory_mb: self.system.peak_memory_usage as f64 / (1024.0 * 1024.0),
            operations_tracked: self.metadata.operations_tracked,
            avg_cpu_usage: self.system.system_stats.cpu_usage,
        }
    }
}

/// Report summary for quick overview
#[derive(Clone, Debug)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct ReportSummary {
    /// Total operations performed
    pub total_operations: u64,
    /// Number of active agents
    pub active_agents: u32,
    /// System uptime in milliseconds
    pub uptime_ms: f64,
    /// Current memory usage in MB
    pub memory_usage_mb: f64,
    /// Peak memory usage in MB
    pub peak_memory_mb: f64,
    /// Number of operation types tracked
    pub operations_tracked: u32,
    /// Average CPU usage percentage
    pub avg_cpu_usage: f32,
}

impl Default for JsonExporter {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for MetricsReport {
    fn default() -> Self {
        Self::new()
    }
}

/// CSV exporter for metrics data
pub struct CsvExporter {
    /// Include headers
    pub include_headers: bool,
    /// Field separator
    pub separator: char,
}

impl CsvExporter {
    /// Create new CSV exporter
    pub fn new() -> Self {
        Self {
            include_headers: true,
            separator: ',',
        }
    }
    
    /// Export system metrics to CSV
    pub fn export_system_metrics(&self, metrics: &SystemMetrics) -> String {
        let mut csv = String::new();
        
        if self.include_headers {
            csv.push_str("timestamp,uptime_ns,total_operations,memory_usage,peak_memory_usage,total_allocations,total_deallocations,active_agents,cpu_usage,memory_usage_percent\n");
        }
        
        csv.push_str(&format!(
            "{}{sep}{}{sep}{}{sep}{}{sep}{}{sep}{}{sep}{}{sep}{}{sep}{:.2}{sep}{:.2}\n",
            crate::collector::now(),
            metrics.uptime_ns,
            metrics.total_operations,
            metrics.memory_usage,
            metrics.peak_memory_usage,
            metrics.total_allocations,
            metrics.total_deallocations,
            metrics.active_agents,
            metrics.system_stats.cpu_usage,
            metrics.system_stats.memory_usage_percent,
            sep = self.separator
        ));
        
        csv
    }
    
    /// Export agent metrics to CSV
    pub fn export_agent_metrics(&self, agents: &[AgentMetrics]) -> String {
        let mut csv = String::new();
        
        if self.include_headers {
            csv.push_str("agent_id,success_rate,total_operations,successful_operations,failed_operations,avg_duration_ns,uptime_ns\n");
        }
        
        for agent in agents {
            csv.push_str(&format!(
                "{}{sep}{:.4}{sep}{}{sep}{}{sep}{}{sep}{}{sep}{}\n",
                agent.id,
                agent.success_rate,
                agent.total_operations,
                agent.successful_operations,
                agent.failed_operations,
                agent.avg_duration_ns,
                agent.uptime_ns,
                sep = self.separator
            ));
        }
        
        csv
    }
}

impl Default for CsvExporter {
    fn default() -> Self {
        Self::new()
    }
}