//! Unit tests for memory pool management and allocation

use micro_swarm::*;
use alloc::{vec, string::String};

#[cfg(test)]
mod memory_pool_tests {
    use super::*;

    #[test]
    fn test_memory_pool_creation() {
        let pool = MemoryPool::new(1024, 16); // 1KB pool with 16-byte alignment
        
        assert_eq!(pool.total_size(), 1024);
        assert_eq!(pool.available_size(), 1024);
        assert_eq!(pool.used_size(), 0);
        assert_eq!(pool.alignment(), 16);
        assert!(pool.is_empty());
        assert!(!pool.is_full());
    }

    #[test]
    fn test_memory_pool_allocation() {
        let mut pool = MemoryPool::new(1024, 8);
        
        // Allocate some memory
        let alloc1 = pool.allocate(64);
        assert!(alloc1.is_ok());
        let handle1 = alloc1.unwrap();
        
        assert_eq!(pool.used_size(), 64);
        assert_eq!(pool.available_size(), 1024 - 64);
        assert!(!pool.is_empty());
        
        // Allocate more
        let alloc2 = pool.allocate(128);
        assert!(alloc2.is_ok());
        let handle2 = alloc2.unwrap();
        
        assert_eq!(pool.used_size(), 64 + 128);
        assert_ne!(handle1, handle2);
        
        // Try to allocate more than available
        let alloc3 = pool.allocate(2048);
        assert!(alloc3.is_err());
    }

    #[test]
    fn test_memory_pool_deallocation() {
        let mut pool = MemoryPool::new(1024, 8);
        
        let handle1 = pool.allocate(64).unwrap();
        let handle2 = pool.allocate(128).unwrap();
        
        assert_eq!(pool.used_size(), 192);
        
        // Deallocate first allocation
        let result = pool.deallocate(handle1);
        assert!(result.is_ok());
        assert_eq!(pool.used_size(), 128);
        
        // Deallocate second allocation
        let result = pool.deallocate(handle2);
        assert!(result.is_ok());
        assert_eq!(pool.used_size(), 0);
        assert!(pool.is_empty());
        
        // Try to deallocate invalid handle
        let result = pool.deallocate(MemoryHandle::from(999));
        assert!(result.is_err());
    }

    #[test]
    fn test_memory_pool_fragmentation() {
        let mut pool = MemoryPool::new(1024, 8);
        
        // Allocate several blocks
        let h1 = pool.allocate(100).unwrap();
        let h2 = pool.allocate(100).unwrap();
        let h3 = pool.allocate(100).unwrap();
        let h4 = pool.allocate(100).unwrap();
        
        assert_eq!(pool.used_size(), 400);
        
        // Deallocate middle blocks to create gaps
        pool.deallocate(h2).unwrap();
        pool.deallocate(h4).unwrap();
        
        assert_eq!(pool.used_size(), 200);
        
        // Check fragmentation
        let fragmentation = pool.fragmentation_ratio();
        assert!(fragmentation > 0.0);
        
        // Should be able to allocate in the gaps
        let h5 = pool.allocate(50);
        assert!(h5.is_ok());
        
        // But not a block larger than the largest gap
        let h6 = pool.allocate(150);
        assert!(h6.is_err());
    }

    #[test]
    fn test_memory_pool_defragmentation() {
        let mut pool = MemoryPool::new(1024, 8);
        
        // Create fragmented state
        let h1 = pool.allocate(100).unwrap();
        let h2 = pool.allocate(100).unwrap();
        let h3 = pool.allocate(100).unwrap();
        
        pool.deallocate(h2).unwrap(); // Create gap
        
        let frag_before = pool.fragmentation_ratio();
        
        // Defragment
        let result = pool.defragment();
        assert!(result.is_ok());
        
        let frag_after = pool.fragmentation_ratio();
        assert!(frag_after <= frag_before);
    }

    #[test]
    fn test_memory_pool_statistics() {
        let mut pool = MemoryPool::new(1024, 8);
        
        let stats = pool.statistics();
        assert_eq!(stats.total_allocations, 0);
        assert_eq!(stats.total_deallocations, 0);
        assert_eq!(stats.current_allocations, 0);
        assert_eq!(stats.peak_usage, 0);
        
        // Perform some allocations
        let h1 = pool.allocate(100).unwrap();
        let h2 = pool.allocate(200).unwrap();
        
        let stats = pool.statistics();
        assert_eq!(stats.total_allocations, 2);
        assert_eq!(stats.current_allocations, 2);
        assert_eq!(stats.peak_usage, 300);
        
        // Deallocate one
        pool.deallocate(h1).unwrap();
        
        let stats = pool.statistics();
        assert_eq!(stats.total_deallocations, 1);
        assert_eq!(stats.current_allocations, 1);
        assert_eq!(stats.peak_usage, 300); // Peak should remain
    }
}

#[cfg(test)]
mod memory_handle_tests {
    use super::*;

    #[test]
    fn test_memory_handle_creation() {
        let handle1 = MemoryHandle::new();
        let handle2 = MemoryHandle::new();
        
        assert_ne!(handle1, handle2);
        assert!(handle1.id() != handle2.id());
    }

    #[test]
    fn test_memory_handle_from_u64() {
        let handle = MemoryHandle::from(42);
        assert_eq!(handle.id(), 42);
    }

    #[test]
    fn test_memory_handle_validity() {
        let handle = MemoryHandle::new();
        assert!(handle.is_valid());
        
        let invalid_handle = MemoryHandle::invalid();
        assert!(!invalid_handle.is_valid());
    }

    #[test]
    fn test_memory_handle_display() {
        let handle = MemoryHandle::from(123);
        let display_str = format!("{}", handle);
        assert_eq!(display_str, "mem-123");
    }
}

#[cfg(test)]
mod shared_memory_tests {
    use super::*;

    #[test]
    fn test_shared_memory_creation() {
        let shared_mem = SharedMemory::new(1024);
        
        assert_eq!(shared_mem.size(), 1024);
        assert_eq!(shared_mem.reader_count(), 0);
        assert!(!shared_mem.has_writer());
    }

    #[test]
    fn test_shared_memory_single_writer() {
        let mut shared_mem = SharedMemory::new(1024);
        
        // Acquire writer lock
        let writer = shared_mem.acquire_writer();
        assert!(writer.is_ok());
        assert!(shared_mem.has_writer());
        
        // Cannot acquire another writer
        let writer2 = shared_mem.acquire_writer();
        assert!(writer2.is_err());
        
        // Release writer
        drop(writer.unwrap());
        assert!(!shared_mem.has_writer());
        
        // Now can acquire writer again
        let writer3 = shared_mem.acquire_writer();
        assert!(writer3.is_ok());
    }

    #[test]
    fn test_shared_memory_multiple_readers() {
        let mut shared_mem = SharedMemory::new(1024);
        
        // Acquire multiple readers
        let reader1 = shared_mem.acquire_reader();
        assert!(reader1.is_ok());
        assert_eq!(shared_mem.reader_count(), 1);
        
        let reader2 = shared_mem.acquire_reader();
        assert!(reader2.is_ok());
        assert_eq!(shared_mem.reader_count(), 2);
        
        let reader3 = shared_mem.acquire_reader();
        assert!(reader3.is_ok());
        assert_eq!(shared_mem.reader_count(), 3);
        
        // Release readers
        drop(reader1.unwrap());
        assert_eq!(shared_mem.reader_count(), 2);
        
        drop(reader2.unwrap());
        drop(reader3.unwrap());
        assert_eq!(shared_mem.reader_count(), 0);
    }

    #[test]
    fn test_shared_memory_reader_writer_exclusion() {
        let mut shared_mem = SharedMemory::new(1024);
        
        // Acquire reader first
        let _reader = shared_mem.acquire_reader().unwrap();
        assert_eq!(shared_mem.reader_count(), 1);
        
        // Cannot acquire writer while readers exist
        let writer = shared_mem.acquire_writer();
        assert!(writer.is_err());
        
        // Release reader
        drop(_reader);
        assert_eq!(shared_mem.reader_count(), 0);
        
        // Now can acquire writer
        let writer = shared_mem.acquire_writer();
        assert!(writer.is_ok());
        
        // Cannot acquire reader while writer exists
        let reader = shared_mem.acquire_reader();
        assert!(reader.is_err());
    }

    #[test]
    fn test_shared_memory_data_access() {
        let mut shared_mem = SharedMemory::new(1024);
        let test_data = b"Hello, shared memory!";
        
        // Write data
        {
            let mut writer = shared_mem.acquire_writer().unwrap();
            let write_result = writer.write(0, test_data);
            assert!(write_result.is_ok());
        }
        
        // Read data
        {
            let reader = shared_mem.acquire_reader().unwrap();
            let mut read_buffer = vec![0u8; test_data.len()];
            let read_result = reader.read(0, &mut read_buffer);
            assert!(read_result.is_ok());
            assert_eq!(&read_buffer, test_data);
        }
    }

    #[test]
    fn test_shared_memory_bounds_checking() {
        let mut shared_mem = SharedMemory::new(100);
        
        {
            let mut writer = shared_mem.acquire_writer().unwrap();
            
            // Valid write
            let result = writer.write(0, b"test");
            assert!(result.is_ok());
            
            // Out of bounds write
            let result = writer.write(98, b"toolong");
            assert!(result.is_err());
        }
        
        {
            let reader = shared_mem.acquire_reader().unwrap();
            let mut buffer = vec![0u8; 10];
            
            // Valid read
            let result = reader.read(0, &mut buffer[..4]);
            assert!(result.is_ok());
            
            // Out of bounds read
            let result = reader.read(95, &mut buffer);
            assert!(result.is_err());
        }
    }
}

#[cfg(test)]
mod memory_manager_tests {
    use super::*;

    #[test]
    fn test_memory_manager_creation() {
        let manager = MemoryManager::new();
        
        assert_eq!(manager.pool_count(), 0);
        assert_eq!(manager.total_memory(), 0);
        assert_eq!(manager.used_memory(), 0);
    }

    #[test]
    fn test_memory_manager_create_pool() {
        let mut manager = MemoryManager::new();
        
        let pool_id = manager.create_pool(1024, 8);
        assert!(pool_id.is_ok());
        
        assert_eq!(manager.pool_count(), 1);
        assert_eq!(manager.total_memory(), 1024);
        assert_eq!(manager.used_memory(), 0);
    }

    #[test]
    fn test_memory_manager_allocate_deallocate() {
        let mut manager = MemoryManager::new();
        let pool_id = manager.create_pool(1024, 8).unwrap();
        
        // Allocate from pool
        let handle = manager.allocate(pool_id, 128);
        assert!(handle.is_ok());
        assert_eq!(manager.used_memory(), 128);
        
        let handle = handle.unwrap();
        
        // Deallocate
        let result = manager.deallocate(handle);
        assert!(result.is_ok());
        assert_eq!(manager.used_memory(), 0);
    }

    #[test]
    fn test_memory_manager_multiple_pools() {
        let mut manager = MemoryManager::new();
        
        let pool1 = manager.create_pool(1024, 8).unwrap();
        let pool2 = manager.create_pool(2048, 16).unwrap();
        
        assert_eq!(manager.pool_count(), 2);
        assert_eq!(manager.total_memory(), 3072);
        
        // Allocate from different pools
        let h1 = manager.allocate(pool1, 100).unwrap();
        let h2 = manager.allocate(pool2, 200).unwrap();
        
        assert_eq!(manager.used_memory(), 300);
        
        // Get pool statistics
        let stats1 = manager.pool_statistics(pool1);
        assert!(stats1.is_ok());
        
        let stats2 = manager.pool_statistics(pool2);
        assert!(stats2.is_ok());
    }

    #[test]
    fn test_memory_manager_auto_pool_selection() {
        let mut manager = MemoryManager::new();
        
        // Create pools of different sizes
        manager.create_pool(512, 8).unwrap();
        manager.create_pool(1024, 8).unwrap();
        manager.create_pool(2048, 8).unwrap();
        
        // Allocate - should automatically select appropriate pool
        let handle = manager.allocate_auto(256);
        assert!(handle.is_ok());
        
        let handle = manager.allocate_auto(800);
        assert!(handle.is_ok());
        
        let handle = manager.allocate_auto(1500);
        assert!(handle.is_ok());
        
        // Too large for any pool
        let handle = manager.allocate_auto(3000);
        assert!(handle.is_err());
    }

    #[test]
    fn test_memory_manager_cleanup() {
        let mut manager = MemoryManager::new();
        let pool_id = manager.create_pool(1024, 8).unwrap();
        
        // Allocate some memory
        let h1 = manager.allocate(pool_id, 100).unwrap();
        let h2 = manager.allocate(pool_id, 200).unwrap();
        
        assert_eq!(manager.used_memory(), 300);
        
        // Cleanup should deallocate all memory
        manager.cleanup();
        assert_eq!(manager.used_memory(), 0);
    }
}