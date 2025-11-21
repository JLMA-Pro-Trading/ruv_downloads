//! Namespace management for multi-agent systems
//!
//! Format: swarm/[agent-id]/[key]

use std::collections::HashSet;

/// Namespace manager
pub struct Namespace;

impl Namespace {
    /// Parse namespace
    pub fn parse(key: &str) -> Result<(String, String, String), String> {
        let parts: Vec<&str> = key.split('/').collect();

        if parts.len() != 3 {
            return Err(format!("Invalid namespace format: {}", key));
        }

        if parts[0] != "swarm" {
            return Err(format!("Namespace must start with 'swarm': {}", key));
        }

        Ok((
            parts[0].to_string(), // "swarm"
            parts[1].to_string(), // agent_id
            parts[2].to_string(), // key
        ))
    }

    /// Build namespace key
    pub fn build(agent_id: &str, key: &str) -> String {
        format!("swarm/{}/{}", agent_id, key)
    }

    /// Validate namespace
    pub fn validate(key: &str) -> bool {
        Self::parse(key).is_ok()
    }

    /// Extract agent ID from namespace
    pub fn extract_agent_id(key: &str) -> Option<String> {
        Self::parse(key).ok().map(|(_, agent_id, _)| agent_id)
    }

    /// Extract key from namespace
    pub fn extract_key(key: &str) -> Option<String> {
        Self::parse(key).ok().map(|(_, _, key)| key)
    }

    /// Check if key belongs to agent
    pub fn belongs_to_agent(key: &str, agent_id: &str) -> bool {
        Self::extract_agent_id(key)
            .map(|id| id == agent_id)
            .unwrap_or(false)
    }

    /// Get all unique agent IDs from keys
    pub fn get_agent_ids(keys: &[String]) -> HashSet<String> {
        keys.iter()
            .filter_map(|k| Self::extract_agent_id(k))
            .collect()
    }

    /// Filter keys by agent
    pub fn filter_by_agent(keys: &[String], agent_id: &str) -> Vec<String> {
        keys.iter()
            .filter(|k| Self::belongs_to_agent(k, agent_id))
            .cloned()
            .collect()
    }

    /// Get namespace prefix for agent
    pub fn agent_prefix(agent_id: &str) -> String {
        format!("swarm/{}/", agent_id)
    }

    /// Check if key matches prefix
    pub fn has_prefix(key: &str, prefix: &str) -> bool {
        key.starts_with(prefix)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid() {
        let key = "swarm/agent_1/position";
        let (ns, agent_id, k) = Namespace::parse(key).unwrap();

        assert_eq!(ns, "swarm");
        assert_eq!(agent_id, "agent_1");
        assert_eq!(k, "position");
    }

    #[test]
    fn test_parse_invalid() {
        assert!(Namespace::parse("invalid/format").is_err());
        assert!(Namespace::parse("wrong/agent/key").is_err());
        assert!(Namespace::parse("swarm/only_two").is_err());
    }

    #[test]
    fn test_build() {
        let key = Namespace::build("agent_1", "position");
        assert_eq!(key, "swarm/agent_1/position");
    }

    #[test]
    fn test_validate() {
        assert!(Namespace::validate("swarm/agent_1/key"));
        assert!(!Namespace::validate("invalid/format"));
    }

    #[test]
    fn test_extract_agent_id() {
        let agent_id = Namespace::extract_agent_id("swarm/agent_1/key");
        assert_eq!(agent_id, Some("agent_1".to_string()));

        let invalid = Namespace::extract_agent_id("invalid");
        assert_eq!(invalid, None);
    }

    #[test]
    fn test_extract_key() {
        let key = Namespace::extract_key("swarm/agent_1/position");
        assert_eq!(key, Some("position".to_string()));
    }

    #[test]
    fn test_belongs_to_agent() {
        assert!(Namespace::belongs_to_agent("swarm/agent_1/key", "agent_1"));
        assert!(!Namespace::belongs_to_agent("swarm/agent_2/key", "agent_1"));
    }

    #[test]
    fn test_get_agent_ids() {
        let keys = vec![
            "swarm/agent_1/key1".to_string(),
            "swarm/agent_2/key2".to_string(),
            "swarm/agent_1/key3".to_string(),
        ];

        let agent_ids = Namespace::get_agent_ids(&keys);
        assert_eq!(agent_ids.len(), 2);
        assert!(agent_ids.contains("agent_1"));
        assert!(agent_ids.contains("agent_2"));
    }

    #[test]
    fn test_filter_by_agent() {
        let keys = vec![
            "swarm/agent_1/key1".to_string(),
            "swarm/agent_2/key2".to_string(),
            "swarm/agent_1/key3".to_string(),
        ];

        let filtered = Namespace::filter_by_agent(&keys, "agent_1");
        assert_eq!(filtered.len(), 2);
    }

    #[test]
    fn test_agent_prefix() {
        let prefix = Namespace::agent_prefix("agent_1");
        assert_eq!(prefix, "swarm/agent_1/");
    }

    #[test]
    fn test_has_prefix() {
        let key = "swarm/agent_1/position";
        let prefix = Namespace::agent_prefix("agent_1");

        assert!(Namespace::has_prefix(key, &prefix));
        assert!(!Namespace::has_prefix(key, "swarm/agent_2/"));
    }
}
