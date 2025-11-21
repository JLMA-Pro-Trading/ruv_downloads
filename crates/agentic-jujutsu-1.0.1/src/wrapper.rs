//! Main wrapper for Jujutsu operations

use crate::{
    config::JJConfig,
    error::{JJError, Result},
    operations::{JJOperation, JJOperationLog, OperationType},
    types::{JJBranch, JJCommit, JJConflict, JJDiff, JJResult},
};
use chrono::Utc;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use wasm_bindgen::prelude::*;

/// Validate command arguments to prevent command injection
fn validate_command_args(args: &[&str]) -> Result<()> {
    for arg in args {
        // Block shell metacharacters that could enable command injection
        if arg.contains(&['$', '`', '&', '|', ';', '\n', '>', '<'][..]) {
            return Err(JJError::InvalidConfig(format!(
                "Invalid character in argument: {}. Shell metacharacters are not allowed.",
                arg
            )));
        }
        // Block null bytes
        if arg.contains('\0') {
            return Err(JJError::InvalidConfig(
                "Null bytes are not allowed in arguments".to_string(),
            ));
        }
    }
    Ok(())
}

// Import the appropriate execute_jj_command based on target architecture
#[cfg(not(target_arch = "wasm32"))]
use crate::native::execute_jj_command;

#[cfg(target_arch = "wasm32")]
use crate::wasm::execute_jj_command;

/// Main wrapper for Jujutsu operations
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
#[derive(Clone)]
pub struct JJWrapper {
    config: JJConfig,
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(skip))]
    operation_log: Arc<Mutex<JJOperationLog>>,
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl JJWrapper {
    /// Create a new JJWrapper with default configuration
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(constructor))]
    pub fn new() -> JJWrapper {
        Self::with_config(JJConfig::default()).unwrap_or_else(|_| {
            // Fallback to a basic wrapper if default config fails
            JJWrapper {
                config: JJConfig::default(),
                operation_log: Arc::new(Mutex::new(JJOperationLog::new(1000))),
            }
        })
    }

    /// Create a new JJWrapper with custom configuration
    pub fn with_config(config: JJConfig) -> Result<JJWrapper> {
        let operation_log = Arc::new(Mutex::new(JJOperationLog::new(config.max_log_entries)));

        Ok(JJWrapper {
            config,
            operation_log,
        })
    }

    /// Get the current configuration
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(js_name = getConfig))]
    pub fn get_config(&self) -> JJConfig {
        self.config.clone()
    }

    /// Get operation log statistics as JSON string
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(js_name = getStats))]
    pub fn get_stats(&self) -> String {
        let log = self.operation_log.lock().unwrap();
        serde_json::json!({
            "total_operations": log.count(),
            "avg_duration_ms": log.avg_duration_ms(),
            "success_rate": log.success_rate(),
        })
        .to_string()
    }

    /// Execute a jj command and return the result
    pub async fn execute(&self, args: &[&str]) -> Result<JJResult> {
        // Validate arguments for security
        validate_command_args(args)?;

        let start = Instant::now();
        let command = format!("jj {}", args.join(" "));

        #[cfg(not(target_arch = "wasm32"))]
        let result = {
            let timeout = std::time::Duration::from_millis(self.config.timeout_ms);
            match execute_jj_command(&self.config.jj_path(), args, timeout).await {
                Ok(output) => {
                    JJResult::new(output, String::new(), 0, start.elapsed().as_millis() as u64)
                }
                Err(e) => {
                    return Err(JJError::CommandFailed(e.to_string()));
                }
            }
        };

        #[cfg(target_arch = "wasm32")]
        let result = {
            let timeout = std::time::Duration::from_millis(self.config.timeout_ms);
            match execute_jj_command(&self.config.jj_path(), args, timeout).await {
                Ok(output) => {
                    JJResult::new(output, String::new(), 0, start.elapsed().as_millis() as u64)
                }
                Err(e) => {
                    return Err(JJError::CommandFailed(e.to_string()));
                }
            }
        };

        // Log the operation
        let hostname = std::env::var("HOSTNAME").unwrap_or_else(|_| "unknown".to_string());
        let username = std::env::var("USER").unwrap_or_else(|_| "unknown".to_string());

        let mut operation = JJOperation::new(
            format!("{}@{}", Utc::now().timestamp(), hostname),
            command.clone(),
            username,
            hostname,
        );

        operation.operation_type = Self::detect_operation_type(args);
        operation.success = result.success();
        operation.duration_ms = result.execution_time_ms;

        self.operation_log.lock().unwrap().add_operation(operation);

        Ok(result)
    }

    /// Detect operation type from command arguments
    fn detect_operation_type(args: &[&str]) -> OperationType {
        if args.is_empty() {
            return OperationType::Unknown;
        }

        match args[0] {
            "describe" => OperationType::Describe,
            "new" => OperationType::New,
            "edit" => OperationType::Edit,
            "abandon" => OperationType::Abandon,
            "rebase" => OperationType::Rebase,
            "squash" => OperationType::Squash,
            "resolve" => OperationType::Resolve,
            "branch" => OperationType::Branch,
            "bookmark" => OperationType::Bookmark,
            "git" if args.len() > 1 && args[1] == "fetch" => OperationType::GitFetch,
            "git" if args.len() > 1 && args[1] == "push" => OperationType::GitPush,
            "undo" => OperationType::Undo,
            "restore" => OperationType::Restore,
            _ => OperationType::Unknown,
        }
    }

    /// Get operations from the operation log
    pub fn get_operations(&self, limit: usize) -> Result<Vec<JJOperation>> {
        Ok(self.operation_log.lock().unwrap().get_recent(limit))
    }

    /// Get user-initiated operations (exclude snapshots)
    pub fn get_user_operations(&self, limit: usize) -> Result<Vec<JJOperation>> {
        Ok(self
            .operation_log
            .lock()
            .unwrap()
            .get_user_operations(limit))
    }

    /// Get conflicts in the current commit or specified commit
    pub async fn get_conflicts(&self, commit: Option<&str>) -> Result<Vec<JJConflict>> {
        let args = if let Some(c) = commit {
            vec!["resolve", "--list", "-r", c]
        } else {
            vec!["resolve", "--list"]
        };

        let result = self.execute(&args).await?;
        Self::parse_conflicts(&result.stdout)
    }

    /// Parse conflict list output
    fn parse_conflicts(output: &str) -> Result<Vec<JJConflict>> {
        let mut conflicts = Vec::new();

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with("No conflicts") {
                continue;
            }

            // Parse format: "path/to/file    2-sided conflict"
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let path = parts[0].to_string();
                let conflict_info = parts[1..].join(" ");

                let num_conflicts = conflict_info
                    .split('-')
                    .next()
                    .and_then(|s| s.trim().parse::<usize>().ok())
                    .unwrap_or(1);

                let mut conflict = JJConflict::new(path, num_conflicts, "content".to_string());

                // Extract number of sides
                if conflict_info.contains("sided") {
                    for _ in 0..num_conflicts {
                        conflict.add_side(format!("side-{}", conflicts.len()));
                    }
                }

                conflicts.push(conflict);
            }
        }

        Ok(conflicts)
    }

    /// Describe the current commit with a message
    pub async fn describe(&self, message: &str) -> Result<JJOperation> {
        let args = vec!["describe", "-m", message];
        let result = self.execute(&args).await?;

        if !result.success() {
            return Err(JJError::CommandFailed(result.stderr));
        }

        // Return the most recent operation
        self.get_operations(1)?
            .into_iter()
            .next()
            .ok_or_else(|| JJError::OperationNotFound("describe".to_string()))
    }

    /// Get repository status
    pub async fn status(&self) -> Result<JJResult> {
        self.execute(&["status"]).await
    }


    /// Get diff between two commits
    pub async fn diff(&self, from: &str, to: &str) -> Result<JJDiff> {
        let args = vec!["diff", "--from", from, "--to", to];
        let result = self.execute(&args).await?;

        Self::parse_diff(&result.stdout)
    }

    /// Parse diff output
    fn parse_diff(output: &str) -> Result<JJDiff> {
        let mut diff = JJDiff::new();
        diff.content = output.to_string();

        for line in output.lines() {
            if line.starts_with("+++") {
                // Added file
                if let Some(path) = line.strip_prefix("+++ ") {
                    let path = path.trim_start_matches("b/");
                    if path != "/dev/null" {
                        diff.added.push(path.to_string());
                    }
                }
            } else if line.starts_with("---") {
                // Deleted file
                if let Some(path) = line.strip_prefix("--- ") {
                    let path = path.trim_start_matches("a/");
                    if path != "/dev/null" {
                        diff.deleted.push(path.to_string());
                    }
                }
            } else if line.starts_with("+") && !line.starts_with("+++") {
                diff.additions += 1;
            } else if line.starts_with("-") && !line.starts_with("---") {
                diff.deletions += 1;
            }
        }

        Ok(diff)
    }

    /// Create a new commit (renamed from 'new' to avoid confusion with constructor)
    pub async fn new_commit(&self, message: Option<&str>) -> Result<JJResult> {
        let mut args = vec!["new"];
        if let Some(msg) = message {
            args.extend(&["-m", msg]);
        }
        self.execute(&args).await
    }

    /// Edit a commit
    pub async fn edit(&self, revision: &str) -> Result<JJResult> {
        self.execute(&["edit", revision]).await
    }

    /// Abandon a commit
    pub async fn abandon(&self, revision: &str) -> Result<JJResult> {
        self.execute(&["abandon", revision]).await
    }

    /// Squash commits
    pub async fn squash(&self, from: Option<&str>, to: Option<&str>) -> Result<JJResult> {
        let mut args = vec!["squash"];
        if let Some(f) = from {
            args.extend(&["-r", f]);
        }
        if let Some(t) = to {
            args.extend(&["--into", t]);
        }
        self.execute(&args).await
    }

    /// Rebase commits
    pub async fn rebase(&self, source: &str, destination: &str) -> Result<JJResult> {
        self.execute(&["rebase", "-s", source, "-d", destination])
            .await
    }

    /// Resolve conflicts
    pub async fn resolve(&self, path: Option<&str>) -> Result<JJResult> {
        let mut args = vec!["resolve"];
        if let Some(p) = path {
            args.push(p);
        }
        self.execute(&args).await
    }

    /// Create a branch
    pub async fn branch_create(&self, name: &str, revision: Option<&str>) -> Result<JJResult> {
        let mut args = vec!["branch", "create", name];
        if let Some(rev) = revision {
            args.extend(&["-r", rev]);
        }
        self.execute(&args).await
    }

    /// Delete a branch
    pub async fn branch_delete(&self, name: &str) -> Result<JJResult> {
        self.execute(&["branch", "delete", name]).await
    }

    /// List branches
    pub async fn branch_list(&self) -> Result<Vec<JJBranch>> {
        let result = self.execute(&["branch", "list"]).await?;
        Self::parse_branches(&result.stdout)
    }

    /// Parse branch list output
    fn parse_branches(output: &str) -> Result<Vec<JJBranch>> {
        let mut branches = Vec::new();

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Parse format: "branch-name: commit-id"
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() >= 2 {
                let name = parts[0].trim().to_string();
                let target = parts[1]
                    .trim()
                    .split_whitespace()
                    .next()
                    .unwrap_or("")
                    .to_string();

                let is_remote = name.contains('/');
                let mut branch = JJBranch::new(name.clone(), target, is_remote);

                if is_remote {
                    if let Some((remote, _)) = name.split_once('/') {
                        branch.set_remote(remote.to_string());
                    }
                }

                branches.push(branch);
            }
        }

        Ok(branches)
    }

    /// Undo the last operation
    pub async fn undo(&self) -> Result<JJResult> {
        self.execute(&["undo"]).await
    }

    /// Restore files
    pub async fn restore(&self, paths: &[&str]) -> Result<JJResult> {
        let mut args = vec!["restore"];
        args.extend(paths);
        self.execute(&args).await
    }

    /// Show commit log
    pub async fn log(&self, limit: Option<usize>) -> Result<Vec<JJCommit>> {
        let mut args = vec!["log"];
        let limit_str;
        if let Some(l) = limit {
            limit_str = l.to_string();
            args.extend(&["--limit", &limit_str]);
        }
        let result = self.execute(&args).await?;
        Self::parse_log(&result.stdout)
    }

    /// Parse log output
    fn parse_log(output: &str) -> Result<Vec<JJCommit>> {
        let mut commits = Vec::new();

        // Simple parser - in production, use `jj log --template` with JSON output
        for block in output.split("\n\n") {
            let lines: Vec<&str> = block.lines().collect();
            if lines.is_empty() {
                continue;
            }

            let mut commit = JJCommit::new(
                "unknown".to_string(),
                "unknown".to_string(),
                String::new(),
                "unknown".to_string(),
                "unknown@example.com".to_string(),
            );

            for line in lines {
                if let Some(id) = line.strip_prefix("Commit ID: ") {
                    commit.id = id.trim().to_string();
                } else if let Some(change) = line.strip_prefix("Change ID: ") {
                    commit.change_id = change.trim().to_string();
                } else if let Some(author) = line.strip_prefix("Author: ") {
                    let parts: Vec<&str> = author.split('<').collect();
                    if parts.len() == 2 {
                        commit.author = parts[0].trim().to_string();
                        commit.author_email = parts[1].trim_end_matches('>').trim().to_string();
                    }
                }
            }

            commits.push(commit);
        }

        Ok(commits)
    }

    /// Clear operation log
    pub fn clear_log(&self) {
        self.operation_log.lock().unwrap().clear();
    }
}

// Non-WASM impl block for Rust-only methods
impl JJWrapper {
    /// Create wrapper with config (Rust-only)
    pub fn with_config_checked(config: JJConfig) -> Result<JJWrapper> {
        Self::with_config(config)
    }
}

impl Default for JJWrapper {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wrapper_creation() {
        let wrapper = JJWrapper::new();
        assert!(wrapper.is_ok());

        let config = JJConfig::default().with_verbose(true);
        let wrapper = JJWrapper::with_config(config);
        assert!(wrapper.is_ok());
    }

    #[test]
    fn test_detect_operation_type() {
        assert_eq!(
            JJWrapper::detect_operation_type(&["describe", "-m", "test"]),
            OperationType::Describe
        );
        assert_eq!(
            JJWrapper::detect_operation_type(&["new"]),
            OperationType::New
        );
        assert_eq!(
            JJWrapper::detect_operation_type(&["git", "fetch"]),
            OperationType::GitFetch
        );
    }

    #[test]
    fn test_parse_conflicts() {
        let output = "file1.txt    2-sided conflict\nfile2.rs    3-sided conflict";
        let conflicts = JJWrapper::parse_conflicts(output).unwrap();

        assert_eq!(conflicts.len(), 2);
        assert_eq!(conflicts[0].path, "file1.txt");
        assert_eq!(conflicts[0].num_conflicts, 2);
        assert_eq!(conflicts[1].path, "file2.rs");
        assert_eq!(conflicts[1].num_conflicts, 3);
    }

    #[test]
    fn test_parse_diff() {
        let output = r#"
+++ b/new.txt
--- a/deleted.txt
+Added line
-Removed line
        "#;

        let diff = JJWrapper::parse_diff(output).unwrap();
        assert_eq!(diff.additions, 1);
        assert_eq!(diff.deletions, 1);
    }

    #[test]
    fn test_parse_branches() {
        let output = "main: abc123\norigin/main: def456";
        let branches = JJWrapper::parse_branches(output).unwrap();

        assert_eq!(branches.len(), 2);
        assert_eq!(branches[0].name, "main");
        assert!(!branches[0].is_remote);
        assert_eq!(branches[1].name, "origin/main");
        assert!(branches[1].is_remote);
    }
}
