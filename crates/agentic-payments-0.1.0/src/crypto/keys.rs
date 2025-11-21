//! Key management with secure storage and zeroization

use crate::crypto::{generate_keypair, AgentIdentity};
use crate::error::{CryptoError, Error, Result};
use ed25519_dalek::{SigningKey, VerifyingKey, PUBLIC_KEY_LENGTH, SECRET_KEY_LENGTH};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;
use uuid::Uuid;
use zeroize::{Zeroize, ZeroizeOnDrop};
use base64::{Engine as _, engine::general_purpose::STANDARD};

/// A keypair with automatic zeroization
#[derive(Clone)]
pub struct KeyPair {
    signing_key: SigningKey,
    verifying_key: VerifyingKey,
}

impl KeyPair {
    /// Generate a new keypair
    pub fn generate() -> Result<Self> {
        let (signing_key, verifying_key) = generate_keypair()?;
        Ok(Self {
            signing_key,
            verifying_key,
        })
    }

    /// Create a keypair from raw bytes
    pub fn from_bytes(signing_key_bytes: &[u8]) -> Result<Self> {
        if signing_key_bytes.len() != SECRET_KEY_LENGTH {
            return Err(Error::Crypto(CryptoError::InvalidPrivateKey {
                details: format!(
                    "Invalid key length: expected {}, got {}",
                    SECRET_KEY_LENGTH,
                    signing_key_bytes.len()
                ),
            }));
        }

        let signing_key = SigningKey::from_bytes(
            signing_key_bytes.try_into().map_err(|_| {
                Error::Crypto(CryptoError::InvalidPrivateKey {
                    details: "Invalid key bytes".to_string(),
                })
            })?
        );
        let verifying_key = signing_key.verifying_key();

        Ok(Self {
            signing_key,
            verifying_key,
        })
    }

    /// Get a reference to the signing key
    pub fn signing_key(&self) -> &SigningKey {
        &self.signing_key
    }

    /// Get a reference to the verifying key
    pub fn verifying_key(&self) -> &VerifyingKey {
        &self.verifying_key
    }

    /// Export the signing key as bytes (use with caution!)
    pub fn to_bytes(&self) -> [u8; SECRET_KEY_LENGTH] {
        self.signing_key.to_bytes()
    }

    /// Export the verifying key as bytes
    pub fn verifying_key_bytes(&self) -> [u8; PUBLIC_KEY_LENGTH] {
        self.verifying_key.to_bytes()
    }

    /// Create an AgentIdentity from this keypair
    pub fn to_identity(self) -> Result<AgentIdentity> {
        AgentIdentity::from_signing_key(self.signing_key.clone())
    }
}

impl Drop for KeyPair {
    fn drop(&mut self) {
        // SigningKey already implements Zeroize internally
    }
}

impl std::fmt::Debug for KeyPair {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("KeyPair")
            .field("verifying_key", &hex::encode(self.verifying_key.to_bytes()))
            .finish_non_exhaustive()
    }
}

/// Stored key with metadata
#[derive(Clone, Serialize, Deserialize)]
pub struct StoredKey {
    /// Unique key identifier
    pub id: Uuid,
    /// Key alias/name
    pub alias: String,
    /// Encrypted or encoded signing key
    #[serde(with = "base64_serde")]
    pub signing_key: Vec<u8>,
    /// Public key bytes
    #[serde(with = "base64_array_serde")]
    pub verifying_key: [u8; PUBLIC_KEY_LENGTH],
    /// Creation timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Last used timestamp
    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
    /// Metadata tags
    pub tags: HashMap<String, String>,
}

impl StoredKey {
    /// Create a new stored key from a keypair
    pub fn new(alias: String, keypair: &KeyPair) -> Self {
        Self {
            id: Uuid::new_v4(),
            alias,
            signing_key: keypair.to_bytes().to_vec(),
            verifying_key: keypair.verifying_key_bytes(),
            created_at: chrono::Utc::now(),
            last_used: None,
            tags: HashMap::new(),
        }
    }

    /// Restore a keypair from this stored key
    pub fn to_keypair(&self) -> Result<KeyPair> {
        KeyPair::from_bytes(&self.signing_key)
    }

    /// Add a metadata tag
    pub fn add_tag(&mut self, key: String, value: String) {
        self.tags.insert(key, value);
    }

    /// Update last used timestamp
    pub fn mark_used(&mut self) {
        self.last_used = Some(chrono::Utc::now());
    }
}

impl Zeroize for StoredKey {
    fn zeroize(&mut self) {
        self.signing_key.zeroize();
    }
}

impl Drop for StoredKey {
    fn drop(&mut self) {
        self.zeroize();
    }
}

/// Key manager for secure key storage and retrieval
pub struct KeyManager {
    /// In-memory key store
    keys: Arc<RwLock<HashMap<Uuid, StoredKey>>>,
    /// Key alias to ID mapping
    aliases: Arc<RwLock<HashMap<String, Uuid>>>,
    /// Optional persistent storage path
    storage_path: Option<PathBuf>,
}

impl KeyManager {
    /// Create a new in-memory key manager
    pub fn new() -> Self {
        Self {
            keys: Arc::new(RwLock::new(HashMap::new())),
            aliases: Arc::new(RwLock::new(HashMap::new())),
            storage_path: None,
        }
    }

    /// Create a key manager with persistent storage
    pub fn with_storage<P: AsRef<Path>>(path: P) -> Self {
        Self {
            keys: Arc::new(RwLock::new(HashMap::new())),
            aliases: Arc::new(RwLock::new(HashMap::new())),
            storage_path: Some(path.as_ref().to_path_buf()),
        }
    }

    /// Store a new keypair with an alias
    pub async fn store(&self, alias: String, keypair: KeyPair) -> Result<Uuid> {
        let stored_key = StoredKey::new(alias.clone(), &keypair);
        let id = stored_key.id;

        {
            let mut keys = self.keys.write().await;
            let mut aliases = self.aliases.write().await;

            keys.insert(id, stored_key.clone());
            aliases.insert(alias, id);
        }

        // Persist if storage is configured
        if let Some(ref path) = self.storage_path {
            self.persist_key(path, &stored_key).await?;
        }

        Ok(id)
    }

    /// Retrieve a keypair by ID
    pub async fn get(&self, id: &Uuid) -> Result<KeyPair> {
        let keys = self.keys.read().await;
        let stored_key = keys.get(id)
            .ok_or_else(|| Error::KeyNotFound(id.to_string()))?;

        stored_key.to_keypair()
    }

    /// Retrieve a keypair by alias
    pub async fn get_by_alias(&self, alias: &str) -> Result<KeyPair> {
        let aliases = self.aliases.read().await;
        let id = aliases.get(alias)
            .ok_or_else(|| Error::KeyNotFound(format!("alias: {}", alias)))?
            .clone();

        drop(aliases);
        self.get(&id).await
    }

    /// List all stored key IDs
    pub async fn list(&self) -> Vec<Uuid> {
        let keys = self.keys.read().await;
        keys.keys().copied().collect()
    }

    /// List all key aliases
    pub async fn list_aliases(&self) -> Vec<String> {
        let aliases = self.aliases.read().await;
        aliases.keys().cloned().collect()
    }

    /// Remove a key by ID
    pub async fn remove(&self, id: &Uuid) -> Result<()> {
        let mut keys = self.keys.write().await;
        let mut aliases = self.aliases.write().await;

        if let Some(stored_key) = keys.remove(id) {
            aliases.remove(&stored_key.alias);

            // Remove from persistent storage if configured
            if let Some(ref path) = self.storage_path {
                self.remove_persisted_key(path, id).await?;
            }
        }

        Ok(())
    }

    /// Check if a key exists
    pub async fn exists(&self, id: &Uuid) -> bool {
        let keys = self.keys.read().await;
        keys.contains_key(id)
    }

    /// Check if an alias exists
    pub async fn alias_exists(&self, alias: &str) -> bool {
        let aliases = self.aliases.read().await;
        aliases.contains_key(alias)
    }

    /// Load all keys from persistent storage
    pub async fn load_from_storage(&self) -> Result<usize> {
        let path = self.storage_path.as_ref()
            .ok_or_else(|| Error::Configuration("No storage path configured".to_string()))?;

        if !path.exists() {
            fs::create_dir_all(path).await?;
            return Ok(0);
        }

        let mut entries = fs::read_dir(path).await?;
        let mut count = 0;

        while let Some(entry) = entries.next_entry().await? {
            if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
                let content = fs::read_to_string(entry.path()).await?;
                let stored_key: StoredKey = serde_json::from_str(&content)
                    .map_err(|e| Error::Serialization(e.into()))?;

                let mut keys = self.keys.write().await;
                let mut aliases = self.aliases.write().await;

                keys.insert(stored_key.id, stored_key.clone());
                aliases.insert(stored_key.alias.clone(), stored_key.id);

                count += 1;
            }
        }

        Ok(count)
    }

    /// Persist a key to storage
    async fn persist_key(&self, base_path: &Path, key: &StoredKey) -> Result<()> {
        if !base_path.exists() {
            fs::create_dir_all(base_path).await?;
        }

        let file_path = base_path.join(format!("{}.json", key.id));
        let content = serde_json::to_string_pretty(key)
            .map_err(|e| Error::Serialization(e.into()))?;
        fs::write(file_path, content).await?;

        Ok(())
    }

    /// Remove a persisted key
    async fn remove_persisted_key(&self, base_path: &Path, id: &Uuid) -> Result<()> {
        let file_path = base_path.join(format!("{}.json", id));
        if file_path.exists() {
            fs::remove_file(file_path).await?;
        }
        Ok(())
    }
}

impl Default for KeyManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Serialization helper for base64 encoding
mod base64_serde {
    use super::STANDARD;
    use base64::Engine as _;
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S, T>(data: T, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
        T: AsRef<[u8]>,
    {
        let encoded = STANDARD.encode(data.as_ref());
        serializer.serialize_str(&encoded)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> std::result::Result<Vec<u8>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s: String = Deserialize::deserialize(deserializer)?;
        STANDARD.decode(&s).map_err(serde::de::Error::custom)
    }
}

/// Serialization helper for base64 encoding of fixed-size arrays
mod base64_array_serde {
    use super::{STANDARD, PUBLIC_KEY_LENGTH};
    use base64::Engine as _;
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(data: &[u8; PUBLIC_KEY_LENGTH], serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let encoded = STANDARD.encode(data);
        serializer.serialize_str(&encoded)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> std::result::Result<[u8; PUBLIC_KEY_LENGTH], D::Error>
    where
        D: Deserializer<'de>,
    {
        let s: String = Deserialize::deserialize(deserializer)?;
        let vec = STANDARD.decode(&s).map_err(serde::de::Error::custom)?;

        if vec.len() != PUBLIC_KEY_LENGTH {
            return Err(serde::de::Error::custom(format!(
                "Expected {} bytes, got {}",
                PUBLIC_KEY_LENGTH,
                vec.len()
            )));
        }

        let mut array = [0u8; PUBLIC_KEY_LENGTH];
        array.copy_from_slice(&vec);
        Ok(array)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keypair_generate() {
        let keypair = KeyPair::generate().unwrap();
        assert_eq!(keypair.verifying_key_bytes().len(), PUBLIC_KEY_LENGTH);
    }

    #[test]
    fn test_keypair_from_bytes() {
        let keypair1 = KeyPair::generate().unwrap();
        let bytes = keypair1.to_bytes();

        let keypair2 = KeyPair::from_bytes(&bytes).unwrap();
        assert_eq!(
            keypair1.verifying_key_bytes(),
            keypair2.verifying_key_bytes()
        );
    }

    #[test]
    fn test_stored_key() {
        let keypair = KeyPair::generate().unwrap();
        let stored = StoredKey::new("test_key".to_string(), &keypair);

        assert_eq!(stored.alias, "test_key");
        assert!(!stored.id.is_nil());

        let restored = stored.to_keypair().unwrap();
        assert_eq!(
            keypair.verifying_key_bytes(),
            restored.verifying_key_bytes()
        );
    }

    #[tokio::test]
    async fn test_key_manager_store_and_get() {
        let manager = KeyManager::new();
        let keypair = KeyPair::generate().unwrap();
        let alias = "test_key".to_string();

        let id = manager.store(alias.clone(), keypair.clone()).await.unwrap();
        let retrieved = manager.get(&id).await.unwrap();

        assert_eq!(
            keypair.verifying_key_bytes(),
            retrieved.verifying_key_bytes()
        );
    }

    #[tokio::test]
    async fn test_key_manager_get_by_alias() {
        let manager = KeyManager::new();
        let keypair = KeyPair::generate().unwrap();
        let alias = "test_key".to_string();

        manager.store(alias.clone(), keypair.clone()).await.unwrap();
        let retrieved = manager.get_by_alias(&alias).await.unwrap();

        assert_eq!(
            keypair.verifying_key_bytes(),
            retrieved.verifying_key_bytes()
        );
    }

    #[tokio::test]
    async fn test_key_manager_list() {
        let manager = KeyManager::new();

        let kp1 = KeyPair::generate().unwrap();
        let kp2 = KeyPair::generate().unwrap();

        manager.store("key1".to_string(), kp1).await.unwrap();
        manager.store("key2".to_string(), kp2).await.unwrap();

        let ids = manager.list().await;
        assert_eq!(ids.len(), 2);

        let aliases = manager.list_aliases().await;
        assert_eq!(aliases.len(), 2);
    }

    #[tokio::test]
    async fn test_key_manager_remove() {
        let manager = KeyManager::new();
        let keypair = KeyPair::generate().unwrap();
        let alias = "test_key".to_string();

        let id = manager.store(alias.clone(), keypair).await.unwrap();
        assert!(manager.exists(&id).await);

        manager.remove(&id).await.unwrap();
        assert!(!manager.exists(&id).await);
        assert!(!manager.alias_exists(&alias).await);
    }
}