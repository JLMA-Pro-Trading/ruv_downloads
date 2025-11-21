//! Comprehensive unit tests for micro_metrics

use micro_metrics::*;
use approx::assert_relative_eq;
use std::thread;
use std::time::Duration;

#[cfg(test)]
mod collector_tests {
    use super::*;

    #[test]
    fn test_metrics_collector_creation() {
        let collector = MetricsCollector::new();
        
        assert!(collector.active);
    }

    #[test]
    fn test_increment_counter() {
        let mut collector = MetricsCollector::new();
        
        collector.increment_counter("test_operations");
        collector.increment_counter("test_operations");
        collector.increment_counter("other_operations");
        
        assert_eq!(collector.get_counter("test_operations"), 2);
        assert_eq!(collector.get_counter("other_operations"), 1);
        assert_eq!(collector.get_counter("nonexistent"), 0);
    }

    #[test]
    fn test_add_counter() {
        let mut collector = MetricsCollector::new();
        
        collector.add_counter("bytes_processed", 1024);
        collector.add_counter("bytes_processed", 512);
        
        assert_eq!(collector.get_counter("bytes_processed"), 1536);
    }

    #[test]
    fn test_record_operation() {
        let mut collector = MetricsCollector::new();
        let timing = TimingInfo {
            label: "test_op".to_string(),
            elapsed_ns: 1_000_000, // 1ms
        };
        
        collector.record_operation("matrix_multiply", timing);
        
        assert_eq!(collector.get_counter("matrix_multiply_operations"), 1);
        assert_eq!(collector.get_counter("matrix_multiply_total_time_ns"), 1_000_000);
    }

    #[test]
    fn test_track_agent() {
        let mut collector = MetricsCollector::new();
        
        collector.track_agent(42, true);  // Success
        collector.track_agent(42, false); // Failure
        collector.track_agent(42, true);  // Success
        collector.track_agent(100, true); // Different agent
        
        let metrics = collector.collect();
        assert_eq!(metrics.active_agents, 2);
        
        let agent_metrics = collector.get_agent_metrics();
        let agent42_metrics = agent_metrics.iter().find(|m| m.id == 42).unwrap();
        
        assert_eq!(agent42_metrics.total_operations, 3);
        assert_eq!(agent42_metrics.successful_operations, 2);
        assert_eq!(agent42_metrics.failed_operations, 1);
        assert_relative_eq!(agent42_metrics.success_rate, 2.0/3.0, epsilon = 1e-6);
    }

    #[test]
    fn test_memory_tracking() {
        let mut collector = MetricsCollector::new();
        
        collector.record_allocation(1024);
        collector.record_allocation(512);
        collector.record_deallocation(256);
        
        let metrics = collector.collect();
        
        assert_eq!(metrics.memory_usage, 1280); // 1024 + 512 - 256
        assert_eq!(metrics.peak_memory_usage, 1536); // Peak was after second allocation
        assert_eq!(metrics.total_allocations, 2);
        assert_eq!(metrics.total_deallocations, 1);
    }

    #[test]
    fn test_collect_comprehensive_metrics() {
        let mut collector = MetricsCollector::new();
        
        // Add some activity
        collector.increment_counter("forwards");
        collector.increment_counter("backwards");
        collector.record_allocation(2048);
        collector.track_agent(1, true);
        
        let metrics = collector.collect();
        
        assert!(metrics.uptime_ns > 0);
        assert_eq!(metrics.total_operations, 2); // forwards + backwards
        assert_eq!(metrics.memory_usage, 2048);
        assert_eq!(metrics.active_agents, 1);
        assert!(!metrics.counters.is_empty());
    }

    #[test]
    fn test_reset() {
        let mut collector = MetricsCollector::new();
        
        collector.increment_counter("test");
        collector.record_allocation(1024);
        collector.track_agent(1, true);
        
        // Verify data exists
        let metrics_before = collector.collect();
        assert!(metrics_before.total_operations > 0);
        assert!(metrics_before.memory_usage > 0);
        assert!(metrics_before.active_agents > 0);
        
        // Reset and verify clean state
        collector.reset();
        let metrics_after = collector.collect();
        
        assert_eq!(metrics_after.total_operations, 0);
        assert_eq!(metrics_after.memory_usage, 0);
        assert_eq!(metrics_after.active_agents, 0);
        assert!(metrics_after.counters.is_empty());
    }

    #[test]
    fn test_counter_names() {
        let mut collector = MetricsCollector::new();
        
        collector.increment_counter("alpha");
        collector.increment_counter("beta");
        collector.increment_counter("gamma");
        
        let names = collector.get_counter_names();
        assert_eq!(names.len(), 3);
        assert!(names.contains(&"alpha".to_string()));
        assert!(names.contains(&"beta".to_string()));
        assert!(names.contains(&"gamma".to_string()));
    }

    #[test]
    fn test_inactive_collector() {
        let mut collector = MetricsCollector::new();
        collector.active = false;
        
        collector.increment_counter("should_not_count");
        collector.record_allocation(1024);
        collector.track_agent(1, true);
        
        let metrics = collector.collect();
        
        // Should return default/empty metrics when inactive
        assert_eq!(metrics.total_operations, 0);
        assert_eq!(metrics.memory_usage, 0);
        assert_eq!(metrics.active_agents, 0);
    }
}

#[cfg(test)]
mod timing_tests {
    use super::*;

    #[test]
    fn test_timer_creation() {
        let timer = Timer::start("test_operation".to_string());
        
        assert_eq!(timer.label(), "test_operation");
        assert!(timer.elapsed_ns() >= 0);
    }

    #[test]
    fn test_timer_elapsed_time() {
        let timer = Timer::start("test".to_string());
        
        // Sleep briefly to ensure elapsed time
        thread::sleep(Duration::from_millis(1));
        
        let elapsed_ns = timer.elapsed_ns();
        let elapsed_us = timer.elapsed_us();
        let elapsed_ms = timer.elapsed_ms();
        let elapsed_s = timer.elapsed_s();
        
        assert!(elapsed_ns > 0);
        assert!(elapsed_us > 0.0);
        assert!(elapsed_ms > 0.0);
        assert!(elapsed_s > 0.0);
        
        // Check conversions are reasonable
        assert_relative_eq!(elapsed_us, elapsed_ns as f64 / 1_000.0, epsilon = 1.0);
        assert_relative_eq!(elapsed_ms, elapsed_ns as f64 / 1_000_000.0, epsilon = 1.0);
        assert_relative_eq!(elapsed_s, elapsed_ns as f64 / 1_000_000_000.0, epsilon = 0.001);
    }

    #[test]
    fn test_timer_stop() {
        let timer = Timer::start("test_stop".to_string());
        thread::sleep(Duration::from_millis(1));
        
        let timing_info = timer.stop();
        
        assert_eq!(timing_info.label, "test_stop");
        assert!(timing_info.elapsed_ns > 0);
        assert!(timing_info.elapsed_us() > 0.0);
        assert!(timing_info.elapsed_ms() > 0.0);
        assert!(timing_info.elapsed_s() > 0.0);
    }

    #[test]
    fn test_timing_histogram() {
        let mut histogram = TimingHistogram::new();
        
        // Add some samples
        histogram.record(1_000_000);   // 1ms
        histogram.record(2_000_000);   // 2ms
        histogram.record(3_000_000);   // 3ms
        histogram.record(10_000_000);  // 10ms
        histogram.record(100_000_000); // 100ms
        
        assert_eq!(histogram.count(), 5);
        assert_relative_eq!(histogram.mean(), 23_200_000.0, epsilon = 1000.0); // Average
        
        let p50 = histogram.p50();
        let p95 = histogram.p95();
        let p99 = histogram.p99();
        
        assert!(p50 > 0);
        assert!(p95 >= p50);
        assert!(p99 >= p95);
    }

    #[test]
    fn test_timing_histogram_custom_buckets() {
        let buckets = vec![1000, 10_000, 100_000, 1_000_000];
        let mut histogram = TimingHistogram::with_buckets(buckets);
        
        histogram.record(500);    // Below first bucket
        histogram.record(5_000);  // Between first and second
        histogram.record(50_000); // Between second and third
        
        assert_eq!(histogram.count(), 3);
        assert!(histogram.mean() > 0.0);
    }

    #[test]
    fn test_timing_histogram_reset() {
        let mut histogram = TimingHistogram::new();
        
        histogram.record(1_000_000);
        histogram.record(2_000_000);
        
        assert_eq!(histogram.count(), 2);
        assert!(histogram.mean() > 0.0);
        
        histogram.reset();
        
        assert_eq!(histogram.count(), 0);
        assert_eq!(histogram.mean(), 0.0);
    }

    #[test]
    fn test_timing_report() {
        let mut report = TimingReport::new();
        
        let timing1 = TimingInfo { label: "op1".to_string(), elapsed_ns: 1_000_000 };
        let timing2 = TimingInfo { label: "op2".to_string(), elapsed_ns: 2_000_000 };
        let timing3 = TimingInfo { label: "op3".to_string(), elapsed_ns: 500_000 };
        
        report.add_measurement(timing1);
        report.add_measurement(timing2);
        report.add_measurement(timing3);
        
        assert_eq!(report.measurements.len(), 3);
        assert_eq!(report.total_ns, 3_500_000);
        assert_relative_eq!(report.total_ms(), 3.5, epsilon = 0.001);
        assert_relative_eq!(report.average_ms(), 3.5 / 3.0, epsilon = 0.001);
        
        let slowest = report.slowest().unwrap();
        assert_eq!(slowest.label, "op2");
        assert_eq!(slowest.elapsed_ns, 2_000_000);
        
        let fastest = report.fastest().unwrap();
        assert_eq!(fastest.label, "op3");
        assert_eq!(fastest.elapsed_ns, 500_000);
    }

    #[test]
    fn test_performance_profiler() {
        let mut profiler = PerformanceProfiler::new();
        
        // Record some measurements
        profiler.record("matrix_multiply", 1_000_000);
        profiler.record("matrix_multiply", 1_500_000);
        profiler.record("matrix_multiply", 2_000_000);
        profiler.record("vector_add", 100_000);
        profiler.record("vector_add", 200_000);
        
        let operations = profiler.get_operations();
        assert_eq!(operations.len(), 2);
        assert!(operations.contains(&"matrix_multiply".to_string()));
        assert!(operations.contains(&"vector_add".to_string()));
        
        let mm_histogram = profiler.get_histogram("matrix_multiply").unwrap();
        assert_eq!(mm_histogram.count(), 3);
        
        let mm_avg = profiler.get_moving_average("matrix_multiply").unwrap();
        assert_relative_eq!(mm_avg, 1_500_000.0, epsilon = 1000.0);
        
        let mm_avg_ms = profiler.get_moving_average_ms("matrix_multiply").unwrap();
        assert_relative_eq!(mm_avg_ms, 1.5, epsilon = 0.001);
        
        let stats = profiler.get_stats("matrix_multiply").unwrap();
        assert_eq!(stats.operation, "matrix_multiply");
        assert_eq!(stats.total_samples, 3);
        assert!(stats.mean_ns > 0.0);
        assert!(stats.p50_ns > 0);
    }

    #[test]
    fn test_profiler_timer_integration() {
        let mut profiler = PerformanceProfiler::new();
        
        let timer = Timer::start("test_operation".to_string());
        thread::sleep(Duration::from_millis(1));
        profiler.record_timer(timer);
        
        let stats = profiler.get_stats("test_operation").unwrap();
        assert_eq!(stats.total_samples, 1);
        assert!(stats.mean_ns > 0.0);
    }

    #[test]
    fn test_profiler_reset() {
        let mut profiler = PerformanceProfiler::new();
        
        profiler.record("test_op", 1_000_000);
        assert_eq!(profiler.get_operations().len(), 1);
        
        profiler.reset();
        assert_eq!(profiler.get_operations().len(), 0);
    }

    #[test]
    fn test_profiler_reset_operation() {
        let mut profiler = PerformanceProfiler::new();
        
        profiler.record("op1", 1_000_000);
        profiler.record("op2", 2_000_000);
        
        assert_eq!(profiler.get_operations().len(), 2);
        
        profiler.reset_operation("op1");
        
        // op1 should still exist but with no samples
        let histogram = profiler.get_histogram("op1").unwrap();
        assert_eq!(histogram.count(), 0);
        
        // op2 should still have data
        let histogram2 = profiler.get_histogram("op2").unwrap();
        assert_eq!(histogram2.count(), 1);
    }

    #[test]
    fn test_time_block_macro() {
        let (result, timing) = time_block!("test_block", {
            thread::sleep(Duration::from_millis(1));
            42
        });
        
        assert_eq!(result, 42);
        assert_eq!(timing.label, "test_block");
        assert!(timing.elapsed_ns > 0);
    }
}

#[cfg(test)]
mod system_metrics_tests {
    use super::*;

    #[test]
    fn test_system_metrics_default() {
        let metrics = SystemMetrics::default();
        
        assert_eq!(metrics.uptime_ns, 0);
        assert_eq!(metrics.total_operations, 0);
        assert_eq!(metrics.memory_usage, 0);
        assert_eq!(metrics.active_agents, 0);
        assert!(metrics.counters.is_empty());
    }

    #[test]
    fn test_agent_metrics() {
        let metrics = AgentMetrics {
            id: 42,
            success_rate: 0.85,
            total_operations: 100,
            successful_operations: 85,
            failed_operations: 15,
            avg_duration_ns: 1_500_000,
            last_activity: 123456789,
            uptime_ns: 3600_000_000_000, // 1 hour
            resource_usage: ResourceUsage::default(),
        };
        
        assert_eq!(metrics.id, 42);
        assert_relative_eq!(metrics.success_rate, 0.85, epsilon = 1e-6);
        assert_eq!(metrics.total_operations, 100);
        assert_eq!(metrics.successful_operations, 85);
        assert_eq!(metrics.failed_operations, 15);
    }

    #[test]
    fn test_resource_usage() {
        let mut usage = ResourceUsage::default();
        
        usage.cpu_time_ns = 1_000_000_000; // 1 second
        usage.memory_allocated = 1024 * 1024; // 1 MB
        usage.network_bytes_sent = 2048;
        usage.network_bytes_received = 4096;
        
        assert_eq!(usage.cpu_time_ns, 1_000_000_000);
        assert_eq!(usage.memory_allocated, 1024 * 1024);
        assert_eq!(usage.network_bytes_sent, 2048);
        assert_eq!(usage.network_bytes_received, 4096);
    }

    #[test]
    fn test_operation_statistics() {
        let stats = OperationStatistics {
            operation: "test_op".to_string(),
            total_samples: 1000,
            mean_ns: 1_500_000.0,
            std_dev_ns: 200_000.0,
            moving_avg_ns: 1_400_000.0,
            p50_ns: 1_450_000,
            p95_ns: 1_900_000,
            p99_ns: 2_100_000,
        };
        
        assert_eq!(stats.operation, "test_op");
        assert_eq!(stats.total_samples, 1000);
        assert_relative_eq!(stats.mean_ms(), 1.5, epsilon = 0.001);
        assert_relative_eq!(stats.std_dev_ms(), 0.2, epsilon = 0.001);
        assert_relative_eq!(stats.moving_avg_ms(), 1.4, epsilon = 0.001);
        assert_relative_eq!(stats.p50_ms(), 1.45, epsilon = 0.001);
        assert_relative_eq!(stats.p95_ms(), 1.9, epsilon = 0.001);
        assert_relative_eq!(stats.p99_ms(), 2.1, epsilon = 0.001);
    }
}

// Property-based tests
#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn prop_counter_increment_monotonic(increments in prop::collection::vec(1u64..=100, 0..100)) {
            let mut collector = MetricsCollector::new();
            let mut expected = 0u64;
            
            for increment in increments {
                collector.add_counter("test", increment);
                expected += increment;
                prop_assert_eq!(collector.get_counter("test"), expected);
            }
        }

        #[test]
        fn prop_memory_tracking_consistency(
            allocations in prop::collection::vec(1usize..=1024, 0..50),
            deallocations in prop::collection::vec(1usize..=1024, 0..25)
        ) {
            let mut collector = MetricsCollector::new();
            
            let total_allocated: usize = allocations.iter().sum();
            let total_deallocated: usize = deallocations.iter().sum();
            
            for alloc in allocations {
                collector.record_allocation(alloc);
            }
            
            for dealloc in deallocations {
                collector.record_deallocation(dealloc);
            }
            
            let metrics = collector.collect();
            
            prop_assert_eq!(metrics.total_allocations, allocations.len() as u64);
            prop_assert_eq!(metrics.total_deallocations, deallocations.len() as u64);
            
            let expected_current = (total_allocated as u64).saturating_sub(total_deallocated as u64);
            prop_assert_eq!(metrics.memory_usage, expected_current);
        }

        #[test]
        fn prop_histogram_percentiles_ordered(samples in prop::collection::vec(1u64..=1_000_000_000, 1..100)) {
            let mut histogram = TimingHistogram::new();
            
            for sample in samples {
                histogram.record(sample);
            }
            
            let p50 = histogram.p50();
            let p95 = histogram.p95();
            let p99 = histogram.p99();
            
            prop_assert!(p50 <= p95);
            prop_assert!(p95 <= p99);
        }

        #[test]
        fn prop_timing_conversions_consistent(elapsed_ns in 1u64..=1_000_000_000_000) {
            let timing = TimingInfo {
                label: "test".to_string(),
                elapsed_ns,
            };
            
            let us = timing.elapsed_us();
            let ms = timing.elapsed_ms();
            let s = timing.elapsed_s();
            
            prop_assert!((us * 1_000.0 - elapsed_ns as f64).abs() < 1.0);
            prop_assert!((ms * 1_000_000.0 - elapsed_ns as f64).abs() < 1000.0);
            prop_assert!((s * 1_000_000_000.0 - elapsed_ns as f64).abs() < 1_000_000.0);
        }
    }
}

// Performance benchmarks
#[cfg(test)]
mod performance_tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn bench_counter_operations() {
        let mut collector = MetricsCollector::new();
        
        let start = Instant::now();
        for i in 0..10000 {
            collector.increment_counter(&format!("counter_{}", i % 100));
        }
        let duration = start.elapsed();
        
        println!("10000 counter increments took: {:?}", duration);
        assert!(duration.as_millis() < 100);
    }

    #[test]
    fn bench_memory_tracking() {
        let mut collector = MetricsCollector::new();
        
        let start = Instant::now();
        for i in 0..10000 {
            if i % 2 == 0 {
                collector.record_allocation(1024 + i);
            } else {
                collector.record_deallocation(512 + i / 2);
            }
        }
        let duration = start.elapsed();
        
        println!("10000 memory operations took: {:?}", duration);
        assert!(duration.as_millis() < 50);
    }

    #[test]
    fn bench_timer_creation() {
        let start = Instant::now();
        for i in 0..1000 {
            let _timer = Timer::start(format!("timer_{}", i));
        }
        let duration = start.elapsed();
        
        println!("1000 timer creations took: {:?}", duration);
        assert!(duration.as_millis() < 50);
    }

    #[test]
    fn bench_histogram_recording() {
        let mut histogram = TimingHistogram::new();
        
        let start = Instant::now();
        for i in 0..10000 {
            histogram.record(i * 1000);
        }
        let duration = start.elapsed();
        
        println!("10000 histogram recordings took: {:?}", duration);
        assert!(duration.as_millis() < 100);
    }

    #[test]
    fn bench_profiler_recording() {
        let mut profiler = PerformanceProfiler::new();
        
        let start = Instant::now();
        for i in 0..1000 {
            profiler.record(&format!("operation_{}", i % 10), i * 1_000_000);
        }
        let duration = start.elapsed();
        
        println!("1000 profiler recordings took: {:?}", duration);
        assert!(duration.as_millis() < 100);
    }

    #[test]
    fn bench_metrics_collection() {
        let mut collector = MetricsCollector::new();
        
        // Add some data
        for i in 0..100 {
            collector.increment_counter(&format!("op_{}", i % 10));
            collector.record_allocation(1024 + i);
            collector.track_agent(i as u32, i % 3 == 0);
        }
        
        let start = Instant::now();
        for _ in 0..100 {
            let _metrics = collector.collect();
        }
        let duration = start.elapsed();
        
        println!("100 metrics collections took: {:?}", duration);
        assert!(duration.as_millis() < 100);
    }
}