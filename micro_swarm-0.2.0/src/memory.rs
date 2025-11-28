//! Memory management and resource pooling

use alloc::{vec::Vec, collections::BTreeMap};
use core::mem;

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

use crate::{Result, SwarmError, AgentId, RegionId, ResourceRequirements};

/// Memory pool configuration
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MemoryConfig {
    /// Total memory pool size in bytes
    pub total_size: u64,
    /// Size of each memory region
    pub region_size: u64,
    /// Maximum regions per agent
    pub max_regions_per_agent: usize,
    /// Enable memory compression simulation
    pub compression_enabled: bool,
    /// Memory eviction policy
    pub eviction_policy: EvictionPolicy,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            total_size: 28 * 1024 * 1024, // 28MB to match chip spec
            region_size: 64 * 1024,        // 64KB regions
            max_regions_per_agent: 16,
            compression_enabled: true,
            eviction_policy: EvictionPolicy::LRU,
        }
    }
}

/// Memory eviction policies
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum EvictionPolicy {
    /// Least Recently Used
    LRU,
    /// Least Frequently Used
    LFU,
    /// First In First Out
    FIFO,
    /// Time-based eviction
    TTL,
}

/// Memory region metadata
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct RegionMetadata {
    /// Region identifier
    pub id: RegionId,
    /// Owner agent
    pub owner: AgentId,
    /// Region size in bytes
    pub size: u64,
    /// Creation timestamp
    pub created_at: u64,
    /// Last access timestamp
    pub last_accessed: u64,
    /// Access count
    pub access_count: u64,
    /// Is region locked
    pub locked: bool,
    /// Is data compressed
    pub compressed: bool,
}

/// Memory region
#[derive(Debug, Clone)]
pub struct MemoryRegion {
    /// Region metadata
    pub metadata: RegionMetadata,
    /// Stored data
    pub data: Vec<u8>,
}

impl MemoryRegion {
    /// Create a new memory region
    fn new(owner: AgentId, size: u64) -> Self {
        static mut COUNTER: u64 = 0;
        let timestamp = unsafe {
            COUNTER += 1;
            COUNTER
        };
        
        Self {
            metadata: RegionMetadata {
                id: RegionId::new(),
                owner,
                size,
                created_at: timestamp,
                last_accessed: timestamp,
                access_count: 0,
                locked: false,
                compressed: false,
            },
            data: Vec::with_capacity(size as usize),
        }
    }
    
    /// Read data from region
    pub fn read(&mut self) -> Result<&[u8]> {
        if self.metadata.locked {
            return Err(SwarmError::memory("Region is locked"));
        }
        
        self.update_access();
        Ok(&self.data)
    }
    
    /// Write data to region
    pub fn write(&mut self, data: &[u8]) -> Result<()> {
        if self.metadata.locked {
            return Err(SwarmError::memory("Region is locked"));
        }
        
        if data.len() > self.metadata.size as usize {
            return Err(SwarmError::memory("Data exceeds region size"));
        }
        
        self.data.clear();
        self.data.extend_from_slice(data);
        self.update_access();
        
        Ok(())
    }
    
    /// Lock region for exclusive access
    pub fn lock(&mut self) -> Result<()> {
        if self.metadata.locked {
            return Err(SwarmError::memory("Region already locked"));
        }
        self.metadata.locked = true;
        Ok(())
    }
    
    /// Unlock region
    pub fn unlock(&mut self) -> Result<()> {
        self.metadata.locked = false;
        Ok(())
    }
    
    /// Update access statistics
    fn update_access(&mut self) {
        static mut COUNTER: u64 = 0;
        self.metadata.last_accessed = unsafe {
            COUNTER += 1;
            COUNTER
        };
        self.metadata.access_count += 1;
    }
}

/// Memory pool statistics
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MemoryStats {
    /// Total number of regions
    pub total_regions: usize,
    /// Allocated regions
    pub allocated_regions: usize,
    /// Free regions
    pub free_regions: usize,
    /// Total bytes allocated
    pub total_bytes_allocated: u64,
    /// Compression ratio (if enabled)
    pub compression_ratio: f32,
    /// Number of evictions performed
    pub evictions: u64,
    /// Cache hits
    pub cache_hits: u64,
    /// Cache misses
    pub cache_misses: u64,
    /// Memory utilization percentage
    pub utilization: f32,
}

/// Memory manager for the swarm
pub struct MemoryManager {
    /// Configuration
    config: MemoryConfig,
    /// Memory regions
    regions: BTreeMap<RegionId, MemoryRegion>,
    /// Agent allocations
    agent_allocations: BTreeMap<AgentId, Vec<RegionId>>,
    /// Free region IDs
    free_regions: Vec<RegionId>,
    /// Statistics
    stats: MemoryStats,
}

impl MemoryManager {
    /// Create a new memory manager
    pub fn new(config: MemoryConfig) -> Self {
        let total_regions = (config.total_size / config.region_size) as usize;
        
        Self {
            config,
            regions: BTreeMap::new(),
            agent_allocations: BTreeMap::new(),
            free_regions: Vec::with_capacity(total_regions),
            stats: MemoryStats {
                total_regions,
                allocated_regions: 0,
                free_regions: total_regions,
                total_bytes_allocated: 0,
                compression_ratio: 1.0,
                evictions: 0,
                cache_hits: 0,
                cache_misses: 0,
                utilization: 0.0,
            },
        }
    }
    
    /// Initialize the memory pool
    pub fn initialize(&mut self) -> Result<()> {
        // Pre-allocate region IDs for the free list
        for _ in 0..self.stats.total_regions {
            self.free_regions.push(RegionId::new());
        }
        Ok(())
    }
    
    /// Allocate a memory region for an agent
    pub fn allocate(&mut self, agent_id: AgentId, size: u64) -> Result<RegionId> {
        // Check size constraint
        if size > self.config.region_size {
            return Err(SwarmError::memory("Requested size exceeds region size"));
        }
        
        // Check agent allocation limit
        if let Some(agent_regions) = self.agent_allocations.get(&agent_id) {
            if agent_regions.len() >= self.config.max_regions_per_agent {
                return Err(SwarmError::memory("Agent allocation limit reached"));
            }
        }
        
        // Get a free region ID
        let region_id = self.free_regions.pop()
            .ok_or_else(|| SwarmError::memory("No free regions available"))?;
        
        // Create the region
        let region = MemoryRegion::new(agent_id, self.config.region_size);
        let actual_region_id = region.metadata.id;
        
        // Add to regions map
        self.regions.insert(actual_region_id, region);
        
        // Update agent allocations
        self.agent_allocations
            .entry(agent_id)
            .or_insert_with(Vec::new)
            .push(actual_region_id);
        
        // Update statistics
        self.stats.allocated_regions += 1;
        self.stats.free_regions -= 1;
        self.stats.total_bytes_allocated += size;
        self.update_utilization();
        
        Ok(actual_region_id)
    }
    
    /// Deallocate a memory region
    pub fn deallocate(&mut self, region_id: RegionId) -> Result<()> {
        // Remove from regions map
        let region = self.regions.remove(&region_id)
            .ok_or_else(|| SwarmError::memory("Region not found"))?;
        
        // Remove from agent allocations
        if let Some(agent_regions) = self.agent_allocations.get_mut(&region.metadata.owner) {
            agent_regions.retain(|&id| id != region_id);
            if agent_regions.is_empty() {
                self.agent_allocations.remove(&region.metadata.owner);
            }
        }
        
        // Return to free list (reuse the ID)
        self.free_regions.push(region_id);
        
        // Update statistics
        self.stats.allocated_regions -= 1;
        self.stats.free_regions += 1;
        self.stats.total_bytes_allocated -= region.data.len() as u64;
        self.update_utilization();
        
        Ok(())
    }
    
    /// Read data from a region
    pub fn read(&mut self, region_id: RegionId) -> Result<Vec<u8>> {
        let region = self.regions.get_mut(&region_id)
            .ok_or_else(|| SwarmError::memory("Region not found"))?;
        
        let data = region.read()?;
        self.stats.cache_hits += 1;
        Ok(data.to_vec())
    }
    
    /// Write data to a region
    pub fn write(&mut self, region_id: RegionId, data: &[u8]) -> Result<()> {
        let region = self.regions.get_mut(&region_id)
            .ok_or_else(|| SwarmError::memory("Region not found"))?;
        
        region.write(data)?;
        Ok(())
    }
    
    /// Copy data between regions
    pub fn copy(&mut self, src_id: RegionId, dst_id: RegionId) -> Result<()> {
        // Read from source (need to clone to avoid borrow checker issues)
        let data = {
            let src_region = self.regions.get_mut(&src_id)
                .ok_or_else(|| SwarmError::memory("Source region not found"))?;
            src_region.read()?.to_vec()
        };
        
        // Write to destination
        let dst_region = self.regions.get_mut(&dst_id)
            .ok_or_else(|| SwarmError::memory("Destination region not found"))?;
        dst_region.write(&data)?;
        
        Ok(())
    }
    
    /// Transfer ownership of a region to another agent
    pub fn transfer(&mut self, region_id: RegionId, new_owner: AgentId) -> Result<()> {
        let region = self.regions.get_mut(&region_id)
            .ok_or_else(|| SwarmError::memory("Region not found"))?;
        
        let old_owner = region.metadata.owner;
        region.metadata.owner = new_owner;
        
        // Update agent allocations
        if let Some(old_regions) = self.agent_allocations.get_mut(&old_owner) {
            old_regions.retain(|&id| id != region_id);
            if old_regions.is_empty() {
                self.agent_allocations.remove(&old_owner);
            }
        }
        
        self.agent_allocations
            .entry(new_owner)
            .or_insert_with(Vec::new)
            .push(region_id);
        
        Ok(())
    }
    
    /// Lock a region for exclusive access
    pub fn lock_region(&mut self, region_id: RegionId) -> Result<()> {
        let region = self.regions.get_mut(&region_id)
            .ok_or_else(|| SwarmError::memory("Region not found"))?;
        region.lock()
    }
    
    /// Unlock a region
    pub fn unlock_region(&mut self, region_id: RegionId) -> Result<()> {
        let region = self.regions.get_mut(&region_id)
            .ok_or_else(|| SwarmError::memory("Region not found"))?;
        region.unlock()
    }
    
    /// Get memory statistics
    pub fn stats(&self) -> &MemoryStats {
        &self.stats
    }
    
    /// Get memory utilization percentage
    pub fn utilization(&self) -> f32 {
        self.stats.utilization
    }
    
    /// Perform garbage collection based on eviction policy
    pub fn garbage_collect(&mut self) -> Result<u64> {
        let mut evicted = 0;
        
        match self.config.eviction_policy {
            EvictionPolicy::LRU => {
                evicted += self.evict_lru()?;
            }
            EvictionPolicy::LFU => {
                evicted += self.evict_lfu()?;
            }
            EvictionPolicy::FIFO => {
                evicted += self.evict_fifo()?;
            }
            EvictionPolicy::TTL => {
                evicted += self.evict_ttl()?;
            }
        }
        
        self.stats.evictions += evicted;
        Ok(evicted)
    }
    
    /// Reset the memory manager
    pub fn reset(&mut self) {
        self.regions.clear();
        self.agent_allocations.clear();
        self.free_regions.clear();
        
        // Reinitialize free regions
        for _ in 0..self.stats.total_regions {
            self.free_regions.push(RegionId::new());
        }
        
        self.stats.allocated_regions = 0;
        self.stats.free_regions = self.stats.total_regions;
        self.stats.total_bytes_allocated = 0;
        self.stats.evictions = 0;
        self.stats.cache_hits = 0;
        self.stats.cache_misses = 0;
        self.update_utilization();
    }
    
    /// Update memory utilization statistics
    fn update_utilization(&mut self) {
        if self.stats.total_regions > 0 {
            self.stats.utilization = 
                (self.stats.allocated_regions as f32) / (self.stats.total_regions as f32);
        } else {
            self.stats.utilization = 0.0;
        }
    }
    
    /// Evict least recently used regions
    fn evict_lru(&mut self) -> Result<u64> {
        // Find oldest accessed regions
        let mut candidates: Vec<_> = self.regions.iter()
            .map(|(id, region)| (*id, region.metadata.last_accessed))
            .collect();
        
        candidates.sort_by_key(|(_, last_accessed)| *last_accessed);
        
        let to_evict = candidates.len() / 10; // Evict 10% of regions
        let mut evicted = 0;
        
        for (region_id, _) in candidates.into_iter().take(to_evict) {
            if !self.regions.get(&region_id).unwrap().metadata.locked {
                self.deallocate(region_id)?;
                evicted += 1;
            }
        }
        
        Ok(evicted)
    }
    
    /// Evict least frequently used regions
    fn evict_lfu(&mut self) -> Result<u64> {
        // Find least frequently accessed regions
        let mut candidates: Vec<_> = self.regions.iter()
            .map(|(id, region)| (*id, region.metadata.access_count))
            .collect();
        
        candidates.sort_by_key(|(_, access_count)| *access_count);
        
        let to_evict = candidates.len() / 10; // Evict 10% of regions
        let mut evicted = 0;
        
        for (region_id, _) in candidates.into_iter().take(to_evict) {
            if !self.regions.get(&region_id).unwrap().metadata.locked {
                self.deallocate(region_id)?;
                evicted += 1;
            }
        }
        
        Ok(evicted)
    }
    
    /// Evict first-in-first-out regions
    fn evict_fifo(&mut self) -> Result<u64> {
        // Find oldest created regions
        let mut candidates: Vec<_> = self.regions.iter()
            .map(|(id, region)| (*id, region.metadata.created_at))
            .collect();
        
        candidates.sort_by_key(|(_, created_at)| *created_at);
        
        let to_evict = candidates.len() / 10; // Evict 10% of regions
        let mut evicted = 0;
        
        for (region_id, _) in candidates.into_iter().take(to_evict) {
            if !self.regions.get(&region_id).unwrap().metadata.locked {
                self.deallocate(region_id)?;
                evicted += 1;
            }
        }
        
        Ok(evicted)
    }
    
    /// Evict regions based on time-to-live
    fn evict_ttl(&mut self) -> Result<u64> {
        static mut CURRENT_TIME: u64 = 0;
        let current_time = unsafe {
            CURRENT_TIME += 1;
            CURRENT_TIME
        };
        
        let ttl_threshold = 1000; // Arbitrary TTL for simulation
        let mut evicted = 0;
        
        let expired_regions: Vec<_> = self.regions.iter()
            .filter(|(_, region)| {
                current_time - region.metadata.created_at > ttl_threshold &&
                !region.metadata.locked
            })
            .map(|(id, _)| *id)
            .collect();
        
        for region_id in expired_regions {
            self.deallocate(region_id)?;
            evicted += 1;
        }
        
        Ok(evicted)
    }
}

/// Vector pool for efficient vector operations
pub struct VectorPool {
    /// Pool of reusable vectors
    pool: Vec<Vec<u8>>,
    /// Pool configuration
    config: VectorPoolConfig,
}

/// Vector pool configuration
#[derive(Debug, Clone)]
pub struct VectorPoolConfig {
    /// Maximum vectors in pool
    pub max_vectors: usize,
    /// Default vector capacity
    pub default_capacity: usize,
}

impl Default for VectorPoolConfig {
    fn default() -> Self {
        Self {
            max_vectors: 1000,
            default_capacity: 1024,
        }
    }
}

impl VectorPool {
    /// Create a new vector pool
    pub fn new(config: VectorPoolConfig) -> Self {
        Self {
            pool: Vec::with_capacity(config.max_vectors),
            config,
        }
    }
    
    /// Get a vector from the pool
    pub fn get(&mut self) -> Vec<u8> {
        self.pool.pop().unwrap_or_else(|| {
            Vec::with_capacity(self.config.default_capacity)
        })
    }
    
    /// Return a vector to the pool
    pub fn put(&mut self, mut vec: Vec<u8>) {
        if self.pool.len() < self.config.max_vectors {
            vec.clear();
            self.pool.push(vec);
        }
    }
    
    /// Get pool statistics
    pub fn stats(&self) -> VectorPoolStats {
        VectorPoolStats {
            available_vectors: self.pool.len(),
            total_capacity: self.pool.capacity(),
        }
    }
}

/// Vector pool statistics
#[derive(Debug, Clone)]
pub struct VectorPoolStats {
    /// Number of available vectors
    pub available_vectors: usize,
    /// Total pool capacity
    pub total_capacity: usize,
}