//! Operation log types for agentic-jujutsu
//!
//! This module provides types for tracking and querying jujutsu operations.
//! Operations represent actions taken in the repository and can be queried
//! for analysis and learning.
//!
//! # Examples
//!
//! ```rust
//! use agentic_jujutsu::operations::{JJOperation, JJOperationLog, OperationType};
//! use chrono::Utc;
//!
//! // Create an operation
//! let op = JJOperation::builder()
//!     .operation_type(OperationType::Commit)
//!     .command("jj commit -m 'Initial commit'".to_string())
//!     .user("alice".to_string())
//!     .build();
//!
//! // Build an operation log
//! let mut log = JJOperationLog::new(1000);
//! log.add_operation(op);
//! ```

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

use crate::error::{JJError, Result};

/// Type of jujutsu operation
///
/// Represents the various operations that can be performed in a jujutsu repository.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[wasm_bindgen]
pub enum OperationType {
    /// Create a new commit
    Commit,
    /// Snapshot operation (automatic)
    Snapshot,
    /// Describe/amend commit message
    Describe,
    /// New commit creation
    New,
    /// Edit commit
    Edit,
    /// Abandon a commit
    Abandon,
    /// Rebase commits
    Rebase,
    /// Squash commits
    Squash,
    /// Resolve conflicts
    Resolve,
    /// Branch operation
    Branch,
    /// Delete a branch
    BranchDelete,
    /// Bookmark operation
    Bookmark,
    /// Create a tag
    Tag,
    /// Checkout a commit
    Checkout,
    /// Restore files
    Restore,
    /// Split a commit
    Split,
    /// Duplicate a commit
    Duplicate,
    /// Undo last operation
    Undo,
    /// Fetch from remote
    Fetch,
    /// Git fetch
    GitFetch,
    /// Push to remote
    Push,
    /// Git push
    GitPush,
    /// Clone repository
    Clone,
    /// Initialize repository
    Init,
    /// Git import
    GitImport,
    /// Git export
    GitExport,
    /// Move changes
    Move,
    /// Diffedit
    Diffedit,
    /// Merge branches
    Merge,
    /// Unknown operation type
    Unknown,
}

impl OperationType {
    /// Convert to string representation
    #[inline]
    pub fn as_string(&self) -> String {
        match self {
            OperationType::Commit => "Commit".to_string(),
            OperationType::Snapshot => "Snapshot".to_string(),
            OperationType::Describe => "Describe".to_string(),
            OperationType::New => "New".to_string(),
            OperationType::Edit => "Edit".to_string(),
            OperationType::Abandon => "Abandon".to_string(),
            OperationType::Rebase => "Rebase".to_string(),
            OperationType::Squash => "Squash".to_string(),
            OperationType::Resolve => "Resolve".to_string(),
            OperationType::Branch => "Branch".to_string(),
            OperationType::BranchDelete => "BranchDelete".to_string(),
            OperationType::Bookmark => "Bookmark".to_string(),
            OperationType::Tag => "Tag".to_string(),
            OperationType::Checkout => "Checkout".to_string(),
            OperationType::Restore => "Restore".to_string(),
            OperationType::Split => "Split".to_string(),
            OperationType::Duplicate => "Duplicate".to_string(),
            OperationType::Undo => "Undo".to_string(),
            OperationType::Fetch => "Fetch".to_string(),
            OperationType::GitFetch => "GitFetch".to_string(),
            OperationType::Push => "Push".to_string(),
            OperationType::GitPush => "GitPush".to_string(),
            OperationType::Clone => "Clone".to_string(),
            OperationType::Init => "Init".to_string(),
            OperationType::GitImport => "GitImport".to_string(),
            OperationType::GitExport => "GitExport".to_string(),
            OperationType::Move => "Move".to_string(),
            OperationType::Diffedit => "Diffedit".to_string(),
            OperationType::Merge => "Merge".to_string(),
            OperationType::Unknown => "Unknown".to_string(),
        }
    }

    /// Check if operation modifies history
    #[inline]
    pub fn modifies_history(&self) -> bool {
        matches!(
            self,
            OperationType::Commit
                | OperationType::Describe
                | OperationType::Edit
                | OperationType::Abandon
                | OperationType::Rebase
                | OperationType::Squash
                | OperationType::Split
                | OperationType::Move
                | OperationType::Merge
        )
    }

    /// Check if operation interacts with remotes
    #[inline]
    pub fn is_remote_operation(&self) -> bool {
        matches!(
            self,
            OperationType::Fetch
                | OperationType::GitFetch
                | OperationType::Push
                | OperationType::GitPush
                | OperationType::Clone
                | OperationType::GitImport
                | OperationType::GitExport
        )
    }

    /// Check if operation is automatic (not user-initiated)
    #[inline]
    pub fn is_automatic(&self) -> bool {
        matches!(self, OperationType::Snapshot)
    }
}

impl OperationType {
    /// Parse from string
    pub fn from_string(s: &str) -> OperationType {
        match s.to_lowercase().as_str() {
            "commit" => OperationType::Commit,
            "snapshot" => OperationType::Snapshot,
            "describe" => OperationType::Describe,
            "new" => OperationType::New,
            "edit" => OperationType::Edit,
            "abandon" => OperationType::Abandon,
            "rebase" => OperationType::Rebase,
            "squash" => OperationType::Squash,
            "resolve" => OperationType::Resolve,
            "branch" => OperationType::Branch,
            "branch-delete" => OperationType::BranchDelete,
            "bookmark" => OperationType::Bookmark,
            "tag" => OperationType::Tag,
            "checkout" => OperationType::Checkout,
            "restore" => OperationType::Restore,
            "split" => OperationType::Split,
            "duplicate" => OperationType::Duplicate,
            "undo" => OperationType::Undo,
            "fetch" => OperationType::Fetch,
            "git-fetch" => OperationType::GitFetch,
            "push" => OperationType::Push,
            "git-push" => OperationType::GitPush,
            "clone" => OperationType::Clone,
            "init" => OperationType::Init,
            "git-import" => OperationType::GitImport,
            "git-export" => OperationType::GitExport,
            "move" => OperationType::Move,
            "diffedit" => OperationType::Diffedit,
            "merge" => OperationType::Merge,
            _ => OperationType::Unknown,
        }
    }
}

/// Single jujutsu operation
///
/// Represents a single operation in the jujutsu operation log with metadata.
///
/// # Examples
///
/// ```rust
/// use agentic_jujutsu::operations::{JJOperation, OperationType};
///
/// let op = JJOperation::builder()
///     .operation_type(OperationType::Commit)
///     .command("jj commit".to_string())
///     .user("alice".to_string())
///     .build();
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct JJOperation {
    /// Unique operation ID (generated by wrapper)
    #[wasm_bindgen(skip)]
    pub id: String,

    /// Operation ID from jj (e.g., "abc123@example.com")
    #[wasm_bindgen(skip)]
    pub operation_id: String,

    /// Operation type
    #[wasm_bindgen(skip)]
    pub operation_type: OperationType,

    /// Command that created this operation
    #[wasm_bindgen(skip)]
    pub command: String,

    /// User who performed the operation
    #[wasm_bindgen(skip)]
    pub user: String,

    /// Hostname where operation was performed
    #[wasm_bindgen(skip)]
    pub hostname: String,

    /// Operation timestamp
    #[wasm_bindgen(skip)]
    pub timestamp: DateTime<Utc>,

    /// Tags associated with this operation
    #[wasm_bindgen(skip)]
    pub tags: Vec<String>,

    /// Additional metadata
    #[wasm_bindgen(skip)]
    pub metadata: HashMap<String, String>,

    /// Parent operation ID
    #[wasm_bindgen(skip)]
    pub parent_id: Option<String>,

    /// Duration in milliseconds
    pub duration_ms: u64,

    /// Whether this operation was successful
    pub success: bool,

    /// Error message (if failed)
    #[wasm_bindgen(skip)]
    pub error: Option<String>,
}

#[wasm_bindgen]
impl JJOperation {
    /// Create a new operation
    #[wasm_bindgen(constructor)]
    pub fn new(operation_id: String, command: String, user: String, hostname: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            operation_id,
            operation_type: OperationType::Unknown,
            command,
            user,
            hostname,
            timestamp: Utc::now(),
            tags: Vec::new(),
            metadata: HashMap::new(),
            parent_id: None,
            duration_ms: 0,
            success: true,
            error: None,
        }
    }

    /// Get ID (for WASM)
    #[wasm_bindgen(getter)]
    pub fn id(&self) -> String {
        self.id.clone()
    }

    /// Get operation ID (for WASM)
    #[wasm_bindgen(getter)]
    pub fn operation_id(&self) -> String {
        self.operation_id.clone()
    }

    /// Get command (for WASM)
    #[wasm_bindgen(getter)]
    pub fn command(&self) -> String {
        self.command.clone()
    }

    /// Get user (for WASM)
    #[wasm_bindgen(getter)]
    pub fn user(&self) -> String {
        self.user.clone()
    }

    /// Get hostname (for WASM)
    #[wasm_bindgen(getter)]
    pub fn hostname(&self) -> String {
        self.hostname.clone()
    }

    /// Get parent ID (for WASM)
    #[wasm_bindgen(getter)]
    pub fn parent_id(&self) -> Option<String> {
        self.parent_id.clone()
    }

    /// Get error (for WASM)
    #[wasm_bindgen(getter)]
    pub fn error(&self) -> Option<String> {
        self.error.clone()
    }

    /// Get operation type as string (for WASM)
    #[wasm_bindgen(getter)]
    pub fn operation_type_str(&self) -> String {
        self.operation_type.as_string()
    }

    /// Set operation type from string
    pub fn set_operation_type(&mut self, type_str: String) {
        self.operation_type = OperationType::from_string(&type_str);
    }

    /// Get timestamp as ISO 8601 string (for WASM)
    pub fn timestamp_iso(&self) -> String {
        self.timestamp.to_rfc3339()
    }

    /// Short operation ID (first 12 characters)
    #[inline]
    pub fn short_id(&self) -> String {
        self.operation_id.chars().take(12).collect()
    }

    /// Check if operation is a snapshot
    #[inline]
    pub fn is_snapshot(&self) -> bool {
        self.operation_type == OperationType::Snapshot
    }

    /// Check if operation is user-initiated (not automatic snapshot)
    #[inline]
    pub fn is_user_initiated(&self) -> bool {
        !self.is_snapshot()
    }

    /// Check if operation modifies history (for WASM)
    #[inline]
    pub fn modifies_history(&self) -> bool {
        self.operation_type.modifies_history()
    }

    /// Check if operation is remote (for WASM)
    #[inline]
    pub fn is_remote_operation(&self) -> bool {
        self.operation_type.is_remote_operation()
    }

    /// Get tags as JSON string (for WASM)
    #[wasm_bindgen(getter)]
    pub fn tags_json(&self) -> String {
        serde_json::to_string(&self.tags).unwrap_or_else(|_| "[]".to_string())
    }

    /// Get metadata as JSON string (for WASM)
    #[wasm_bindgen(getter)]
    pub fn metadata_json(&self) -> String {
        serde_json::to_string(&self.metadata).unwrap_or_else(|_| "{}".to_string())
    }
}

impl JJOperation {
    /// Create a builder for constructing operations
    pub fn builder() -> JJOperationBuilder {
        JJOperationBuilder::default()
    }

    /// Add a tag to this operation
    pub fn add_tag(&mut self, tag: String) {
        if !self.tags.contains(&tag) {
            self.tags.push(tag);
        }
    }

    /// Get all tags
    pub fn tags(&self) -> &[String] {
        &self.tags
    }

    /// Get a metadata value
    pub fn get_metadata(&self, key: &str) -> Option<&String> {
        self.metadata.get(key)
    }

    /// Set a metadata value
    pub fn set_metadata(&mut self, key: String, value: String) {
        self.metadata.insert(key, value);
    }

    /// Set operation type
    pub fn with_type(mut self, op_type: OperationType) -> Self {
        self.operation_type = op_type;
        self
    }

    /// Set success status
    pub fn with_success(mut self, success: bool) -> Self {
        self.success = success;
        self
    }

    /// Set duration
    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = duration_ms;
        self
    }
}

/// Builder for JJOperation
pub struct JJOperationBuilder {
    operation_id: Option<String>,
    operation_type: Option<OperationType>,
    command: Option<String>,
    user: Option<String>,
    hostname: Option<String>,
    tags: Vec<String>,
    metadata: HashMap<String, String>,
    parent_id: Option<String>,
    duration_ms: u64,
    success: bool,
    error: Option<String>,
}

impl Default for JJOperationBuilder {
    fn default() -> Self {
        Self {
            operation_id: None,
            operation_type: None,
            command: None,
            user: None,
            hostname: None,
            tags: Vec::new(),
            metadata: HashMap::new(),
            parent_id: None,
            duration_ms: 0,
            success: true, // Default to successful operations
            error: None,
        }
    }
}

impl JJOperationBuilder {
    /// Set operation ID
    pub fn operation_id(mut self, id: String) -> Self {
        self.operation_id = Some(id);
        self
    }

    /// Set operation type
    pub fn operation_type(mut self, op_type: OperationType) -> Self {
        self.operation_type = Some(op_type);
        self
    }

    /// Set command
    pub fn command(mut self, command: String) -> Self {
        self.command = Some(command);
        self
    }

    /// Set user
    pub fn user(mut self, user: String) -> Self {
        self.user = Some(user);
        self
    }

    /// Set hostname
    pub fn hostname(mut self, hostname: String) -> Self {
        self.hostname = Some(hostname);
        self
    }

    /// Add a tag
    pub fn tag(mut self, tag: String) -> Self {
        self.tags.push(tag);
        self
    }

    /// Add metadata entry
    pub fn add_metadata(mut self, key: &str, value: &str) -> Self {
        self.metadata.insert(key.to_string(), value.to_string());
        self
    }

    /// Set metadata
    pub fn metadata(mut self, metadata: HashMap<String, String>) -> Self {
        self.metadata = metadata;
        self
    }

    /// Set parent operation ID
    pub fn parent_id(mut self, parent_id: String) -> Self {
        self.parent_id = Some(parent_id);
        self
    }

    /// Set duration
    pub fn duration_ms(mut self, duration_ms: u64) -> Self {
        self.duration_ms = duration_ms;
        self
    }

    /// Mark as failed
    pub fn failed(mut self, error: String) -> Self {
        self.success = false;
        self.error = Some(error);
        self
    }

    /// Build the operation
    pub fn build(self) -> JJOperation {
        JJOperation {
            id: Uuid::new_v4().to_string(),
            operation_id: self
                .operation_id
                .unwrap_or_else(|| Uuid::new_v4().to_string()),
            operation_type: self.operation_type.unwrap_or(OperationType::Unknown),
            command: self.command.unwrap_or_default(),
            user: self.user.unwrap_or_default(),
            hostname: self.hostname.unwrap_or_default(),
            timestamp: Utc::now(),
            tags: self.tags,
            metadata: self.metadata,
            parent_id: self.parent_id,
            duration_ms: self.duration_ms,
            success: self.success,
            error: self.error,
        }
    }
}

/// Collection of operations with query capabilities
///
/// Provides methods for storing, querying, and analyzing jujutsu operations.
///
/// # Examples
///
/// ```rust
/// use agentic_jujutsu::operations::{JJOperationLog, JJOperation, OperationType};
///
/// let log = JJOperationLog::new(1000);
/// let op = JJOperation::builder()
///     .operation_type(OperationType::Commit)
///     .command("jj commit".to_string())
///     .user("alice".to_string())
///     .build();
/// log.add_operation(op);
///
/// // Query operations
/// let commits = log.get_by_type(OperationType::Commit);
/// assert_eq!(commits.len(), 1);
/// ```
#[derive(Debug, Clone)]
pub struct JJOperationLog {
    /// Operations stored in memory
    operations: Arc<Mutex<Vec<JJOperation>>>,

    /// Maximum number of operations to keep
    max_entries: usize,
}

impl JJOperationLog {
    /// Create a new operation log
    pub fn new(max_entries: usize) -> Self {
        Self {
            operations: Arc::new(Mutex::new(Vec::with_capacity(max_entries))),
            max_entries,
        }
    }

    /// Add an operation to the log
    pub fn add_operation(&self, operation: JJOperation) {
        let mut ops = self.operations.lock().unwrap();
        ops.push(operation);

        // Trim to max_entries if exceeded
        if ops.len() > self.max_entries {
            let excess = ops.len() - self.max_entries;
            ops.drain(0..excess);
        }
    }

    /// Get recent operations (most recent first)
    pub fn get_recent(&self, limit: usize) -> Vec<JJOperation> {
        let ops = self.operations.lock().unwrap();
        ops.iter().rev().take(limit).cloned().collect()
    }

    /// Get all operations
    pub fn get_all(&self) -> Vec<JJOperation> {
        self.operations.lock().unwrap().clone()
    }

    /// Find operation by ID
    pub fn find_by_id(&self, id: &str) -> Option<JJOperation> {
        let ops = self.operations.lock().unwrap();
        ops.iter()
            .find(|op| op.id == id || op.operation_id == id)
            .cloned()
    }

    /// Get operation by ID as Result
    pub fn get_operation(&self, id: &str) -> Result<JJOperation> {
        self.find_by_id(id)
            .ok_or_else(|| JJError::OperationNotFound(id.to_string()))
    }

    /// Filter operations by type
    pub fn filter_by_type(&self, op_type: OperationType) -> Vec<JJOperation> {
        self.get_by_type(op_type)
    }

    /// Get operations by type
    pub fn get_by_type(&self, op_type: OperationType) -> Vec<JJOperation> {
        let ops = self.operations.lock().unwrap();
        ops.iter()
            .filter(|op| op.operation_type == op_type)
            .cloned()
            .collect()
    }

    /// Filter operations by date range
    pub fn filter_by_date_range(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Vec<JJOperation> {
        let ops = self.operations.lock().unwrap();
        ops.iter()
            .filter(|op| op.timestamp >= start && op.timestamp <= end)
            .cloned()
            .collect()
    }

    /// Filter operations by user
    pub fn filter_by_user(&self, user: &str) -> Vec<JJOperation> {
        let ops = self.operations.lock().unwrap();
        ops.iter().filter(|op| op.user == user).cloned().collect()
    }

    /// Get operations in the last N hours
    pub fn recent_operations(&self, hours: i64) -> Vec<JJOperation> {
        let cutoff = Utc::now() - Duration::hours(hours);
        let ops = self.operations.lock().unwrap();
        ops.iter()
            .filter(|op| op.timestamp >= cutoff)
            .cloned()
            .collect()
    }

    /// Search operations by command or description
    pub fn search(&self, query: &str) -> Vec<JJOperation> {
        let query_lower = query.to_lowercase();
        let ops = self.operations.lock().unwrap();
        ops.iter()
            .filter(|op| op.command.to_lowercase().contains(&query_lower))
            .cloned()
            .collect()
    }

    /// Get failed operations
    pub fn failed_operations(&self) -> Vec<JJOperation> {
        let ops = self.operations.lock().unwrap();
        ops.iter().filter(|op| !op.success).cloned().collect()
    }

    /// Get operations that modified history
    pub fn history_modifying_operations(&self) -> Vec<JJOperation> {
        let ops = self.operations.lock().unwrap();
        ops.iter()
            .filter(|op| op.operation_type.modifies_history())
            .cloned()
            .collect()
    }

    /// Get remote operations
    pub fn remote_operations(&self) -> Vec<JJOperation> {
        let ops = self.operations.lock().unwrap();
        ops.iter()
            .filter(|op| op.operation_type.is_remote_operation())
            .cloned()
            .collect()
    }

    /// Get user-initiated operations (exclude snapshots)
    pub fn get_user_operations(&self, limit: usize) -> Vec<JJOperation> {
        let ops = self.operations.lock().unwrap();
        ops.iter()
            .rev()
            .filter(|op| op.is_user_initiated())
            .take(limit)
            .cloned()
            .collect()
    }

    /// Get total operation count
    #[inline]
    pub fn count(&self) -> usize {
        self.operations.lock().unwrap().len()
    }

    /// Check if log is empty
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.operations.lock().unwrap().is_empty()
    }

    /// Get length
    #[inline]
    pub fn len(&self) -> usize {
        self.count()
    }

    /// Clear all operations
    pub fn clear(&self) {
        self.operations.lock().unwrap().clear();
    }

    /// Get statistics about operations
    pub fn statistics(&self) -> OperationStatistics {
        let ops = self.operations.lock().unwrap();
        let mut stats = OperationStatistics::default();

        for op in ops.iter() {
            *stats.by_type.entry(op.operation_type).or_insert(0) += 1;

            if op.success {
                stats.successful += 1;
            } else {
                stats.failed += 1;
            }

            if op.duration_ms > 0 {
                stats.total_duration_ms += op.duration_ms;
                if op.duration_ms > stats.max_duration_ms {
                    stats.max_duration_ms = op.duration_ms;
                }
            }
        }

        stats.total = ops.len();
        if stats.total > 0 && stats.total_duration_ms > 0 {
            stats.avg_duration_ms = stats.total_duration_ms / stats.total as u64;
        }

        stats
    }

    /// Get average operation duration
    pub fn avg_duration_ms(&self) -> f64 {
        let ops = self.operations.lock().unwrap();
        if ops.is_empty() {
            return 0.0;
        }

        let total: u64 = ops.iter().map(|op| op.duration_ms).sum();
        total as f64 / ops.len() as f64
    }

    /// Get success rate
    pub fn success_rate(&self) -> f64 {
        let ops = self.operations.lock().unwrap();
        if ops.is_empty() {
            return 0.0;
        }

        let successful = ops.iter().filter(|op| op.success).count();
        successful as f64 / ops.len() as f64
    }

    /// Get an iterator over operations
    pub fn iter(&self) -> Vec<JJOperation> {
        self.get_all()
    }
}

impl Default for JJOperationLog {
    fn default() -> Self {
        Self::new(1000)
    }
}

/// Statistics about operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationStatistics {
    /// Total number of operations
    pub total: usize,

    /// Number of successful operations
    pub successful: usize,

    /// Number of failed operations
    pub failed: usize,

    /// Operations by type
    pub by_type: HashMap<OperationType, usize>,

    /// Total duration in milliseconds
    pub total_duration_ms: u64,

    /// Average duration in milliseconds
    pub avg_duration_ms: u64,

    /// Maximum duration in milliseconds
    pub max_duration_ms: u64,
}

impl Default for OperationStatistics {
    fn default() -> Self {
        Self {
            total: 0,
            successful: 0,
            failed: 0,
            by_type: HashMap::new(),
            total_duration_ms: 0,
            avg_duration_ms: 0,
            max_duration_ms: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_operation_type_conversion() {
        assert_eq!(
            OperationType::from_string("describe"),
            OperationType::Describe
        );
        assert_eq!(
            OperationType::from_string("SNAPSHOT"),
            OperationType::Snapshot
        );
        assert_eq!(
            OperationType::from_string("unknown_op"),
            OperationType::Unknown
        );
    }

    #[test]
    fn test_operation_type_checks() {
        assert!(OperationType::Commit.modifies_history());
        assert!(!OperationType::Fetch.modifies_history());
        assert!(OperationType::Push.is_remote_operation());
        assert!(!OperationType::Commit.is_remote_operation());
        assert!(OperationType::Snapshot.is_automatic());
        assert!(!OperationType::Commit.is_automatic());
    }

    #[test]
    fn test_operation_creation() {
        let mut op = JJOperation::new(
            "abc123@example.com".into(),
            "jj describe".into(),
            "alice".into(),
            "localhost".into(),
        );

        op.set_operation_type("describe".into());
        assert_eq!(op.operation_type, OperationType::Describe);
        assert!(op.is_user_initiated());
    }

    #[test]
    fn test_operation_builder() {
        let op = JJOperation::builder()
            .operation_type(OperationType::Rebase)
            .command("jj rebase".to_string())
            .user("alice".to_string())
            .hostname("localhost".to_string())
            .add_metadata("commits", "5")
            .duration_ms(1500)
            .build();

        assert_eq!(op.operation_type, OperationType::Rebase);
        assert_eq!(op.user, "alice");
        assert_eq!(op.get_metadata("commits"), Some(&"5".to_string()));
        assert_eq!(op.duration_ms, 1500);
    }

    #[test]
    fn test_operation_log() {
        let log = JJOperationLog::new(10);

        let op1 = JJOperation::new(
            "op1".into(),
            "jj new".into(),
            "alice".into(),
            "localhost".into(),
        )
        .with_type(OperationType::New)
        .with_duration(100);

        let op2 = JJOperation::new(
            "op2".into(),
            "jj describe".into(),
            "bob".into(),
            "localhost".into(),
        )
        .with_type(OperationType::Describe)
        .with_duration(200);

        log.add_operation(op1);
        log.add_operation(op2);

        assert_eq!(log.count(), 2);

        let recent = log.get_recent(1);
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].operation_id, "op2");

        let new_ops = log.get_by_type(OperationType::New);
        assert_eq!(new_ops.len(), 1);
        assert_eq!(new_ops[0].operation_id, "op1");
    }

    #[test]
    fn test_operation_log_limit() {
        let log = JJOperationLog::new(5);

        for i in 0..10 {
            let op = JJOperation::new(
                format!("op{}", i),
                "jj new".into(),
                "alice".into(),
                "localhost".into(),
            );
            log.add_operation(op);
        }

        // Should only keep last 5
        assert_eq!(log.count(), 5);

        let all = log.get_all();
        assert_eq!(all[0].operation_id, "op5");
        assert_eq!(all[4].operation_id, "op9");
    }

    #[test]
    fn test_filter_by_type() {
        let log = JJOperationLog::new(100);
        log.add_operation(
            JJOperation::builder()
                .operation_id("op1".to_string())
                .operation_type(OperationType::Commit)
                .command("jj commit".to_string())
                .build(),
        );
        log.add_operation(
            JJOperation::builder()
                .operation_id("op2".to_string())
                .operation_type(OperationType::Rebase)
                .command("jj rebase".to_string())
                .build(),
        );
        log.add_operation(
            JJOperation::builder()
                .operation_id("op3".to_string())
                .operation_type(OperationType::Commit)
                .command("jj commit".to_string())
                .build(),
        );

        let commits = log.filter_by_type(OperationType::Commit);
        assert_eq!(commits.len(), 2);
    }

    #[test]
    fn test_filter_by_user() {
        let log = JJOperationLog::new(100);
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Commit)
                .user("alice".to_string())
                .build(),
        );
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Commit)
                .user("bob".to_string())
                .build(),
        );

        let alice_ops = log.filter_by_user("alice");
        assert_eq!(alice_ops.len(), 1);
    }

    #[test]
    fn test_search() {
        let log = JJOperationLog::new(100);
        log.add_operation(
            JJOperation::builder()
                .command("jj commit -m 'Add feature X'".to_string())
                .build(),
        );
        log.add_operation(
            JJOperation::builder()
                .command("jj rebase".to_string())
                .build(),
        );
        log.add_operation(
            JJOperation::builder()
                .command("jj commit -m 'Add feature Z'".to_string())
                .build(),
        );

        let results = log.search("feature");
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_failed_operations() {
        let log = JJOperationLog::new(100);
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Commit)
                .build(),
        );
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Push)
                .failed("Network error".to_string())
                .build(),
        );

        let failed = log.failed_operations();
        assert_eq!(failed.len(), 1);
    }

    #[test]
    fn test_statistics() {
        let log = JJOperationLog::new(100);
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Commit)
                .duration_ms(100)
                .build(),
        );
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Commit)
                .duration_ms(200)
                .build(),
        );
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Rebase)
                .duration_ms(300)
                .build(),
        );

        let stats = log.statistics();
        assert_eq!(stats.total, 3);
        assert_eq!(stats.successful, 3);
        assert_eq!(stats.by_type.get(&OperationType::Commit), Some(&2));
        assert_eq!(stats.max_duration_ms, 300);
    }

    #[test]
    fn test_history_modifying_operations() {
        let log = JJOperationLog::new(100);
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Commit)
                .build(),
        );
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Fetch)
                .build(),
        );
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Rebase)
                .build(),
        );

        let modifying = log.history_modifying_operations();
        assert_eq!(modifying.len(), 2);
    }

    #[test]
    fn test_remote_operations() {
        let log = JJOperationLog::new(100);
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Commit)
                .build(),
        );
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Push)
                .build(),
        );
        log.add_operation(
            JJOperation::builder()
                .operation_type(OperationType::Fetch)
                .build(),
        );

        let remote = log.remote_operations();
        assert_eq!(remote.len(), 2);
    }
}
