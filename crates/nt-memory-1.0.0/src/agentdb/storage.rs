//! Persistent storage backend for vectors and metadata

use serde::Serialize;
use std::path::Path;

/// Storage backend trait
#[async_trait::async_trait]
pub trait StorageBackend: Send + Sync {
    /// Store key-value pair
    async fn put(&self, key: &[u8], value: &[u8]) -> anyhow::Result<()>;

    /// Get value by key
    async fn get(&self, key: &[u8]) -> anyhow::Result<Option<Vec<u8>>>;

    /// Delete key
    async fn delete(&self, key: &[u8]) -> anyhow::Result<()>;

    /// List all keys with prefix
    async fn list_prefix(&self, prefix: &[u8]) -> anyhow::Result<Vec<Vec<u8>>>;

    /// Batch operations
    async fn batch_put(&self, items: Vec<(Vec<u8>, Vec<u8>)>) -> anyhow::Result<()>;
}

/// Sled-based persistent store
pub struct PersistentStore {
    db: sled::Db,
}

impl PersistentStore {
    /// Open or create database
    pub fn new<P: AsRef<Path>>(path: P) -> anyhow::Result<Self> {
        let db = sled::open(path)?;
        Ok(Self { db })
    }

    /// Create in-memory database (for testing)
    pub fn memory() -> anyhow::Result<Self> {
        let db = sled::Config::new().temporary(true).open()?;
        Ok(Self { db })
    }

    /// Flush to disk
    pub async fn flush(&self) -> anyhow::Result<()> {
        self.db.flush_async().await?;
        Ok(())
    }

    /// Database size on disk
    pub fn size_on_disk(&self) -> anyhow::Result<u64> {
        Ok(self.db.size_on_disk()?)
    }

    /// Number of entries
    pub fn len(&self) -> usize {
        self.db.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[async_trait::async_trait]
impl StorageBackend for PersistentStore {
    async fn put(&self, key: &[u8], value: &[u8]) -> anyhow::Result<()> {
        self.db.insert(key, value)?;
        Ok(())
    }

    async fn get(&self, key: &[u8]) -> anyhow::Result<Option<Vec<u8>>> {
        Ok(self.db.get(key)?.map(|v| v.to_vec()))
    }

    async fn delete(&self, key: &[u8]) -> anyhow::Result<()> {
        self.db.remove(key)?;
        Ok(())
    }

    async fn list_prefix(&self, prefix: &[u8]) -> anyhow::Result<Vec<Vec<u8>>> {
        let keys: Vec<Vec<u8>> = self
            .db
            .scan_prefix(prefix)
            .keys()
            .filter_map(|k| k.ok().map(|k| k.to_vec()))
            .collect();

        Ok(keys)
    }

    async fn batch_put(&self, items: Vec<(Vec<u8>, Vec<u8>)>) -> anyhow::Result<()> {
        let mut batch = sled::Batch::default();

        for (key, value) in items {
            batch.insert(key, value);
        }

        self.db.apply_batch(batch)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_persistent_store_operations() {
        let store = PersistentStore::memory().unwrap();

        // Put
        store.put(b"key1", b"value1").await.unwrap();
        assert_eq!(store.len(), 1);

        // Get
        let value = store.get(b"key1").await.unwrap();
        assert_eq!(value, Some(b"value1".to_vec()));

        // Delete
        store.delete(b"key1").await.unwrap();
        assert_eq!(store.len(), 0);
    }

    #[tokio::test]
    async fn test_batch_operations() {
        let store = PersistentStore::memory().unwrap();

        let items = vec![
            (b"key1".to_vec(), b"value1".to_vec()),
            (b"key2".to_vec(), b"value2".to_vec()),
            (b"key3".to_vec(), b"value3".to_vec()),
        ];

        store.batch_put(items).await.unwrap();
        assert_eq!(store.len(), 3);
    }

    #[tokio::test]
    async fn test_prefix_scan() {
        let store = PersistentStore::memory().unwrap();

        store.put(b"prefix:key1", b"value1").await.unwrap();
        store.put(b"prefix:key2", b"value2").await.unwrap();
        store.put(b"other:key3", b"value3").await.unwrap();

        let keys = store.list_prefix(b"prefix:").await.unwrap();
        assert_eq!(keys.len(), 2);
    }
}
