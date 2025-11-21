//! Quorum Management
//!
//! Implements Byzantine Fault Tolerant quorum calculations with
//! weighted voting and dynamic threshold management.

use super::{Authority, AuthorityId};
use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Quorum configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuorumConfig {
    /// Minimum quorum threshold (e.g., 0.67 for 2/3)
    pub threshold: f64,
    /// Minimum number of authorities required
    pub min_authorities: usize,
    /// Maximum Byzantine faults tolerated (f in 3f+1)
    pub max_faults: usize,
    /// Use weighted voting
    pub use_weights: bool,
}

impl Default for QuorumConfig {
    fn default() -> Self {
        QuorumConfig {
            threshold: 0.67, // 2/3 threshold
            min_authorities: 4, // Minimum 3f+1 = 4 for f=1
            max_faults: 1,
            use_weights: true,
        }
    }
}

impl QuorumConfig {
    /// Create config for Byzantine fault tolerance
    /// Requires 3f+1 authorities to tolerate f faults
    pub fn byzantine(max_faults: usize) -> Self {
        QuorumConfig {
            threshold: 0.67,
            min_authorities: 3 * max_faults + 1,
            max_faults,
            use_weights: true,
        }
    }

    /// Validate configuration
    pub fn validate(&self) -> Result<()> {
        if self.threshold <= 0.5 || self.threshold > 1.0 {
            return Err(Error::InvalidState {
                message: format!("Invalid threshold: {}", self.threshold),
            });
        }

        if self.min_authorities < 3 * self.max_faults + 1 {
            return Err(Error::InvalidState {
                message: format!(
                    "Insufficient authorities for {} faults: need {}, got {}",
                    self.max_faults,
                    3 * self.max_faults + 1,
                    self.min_authorities
                ),
            });
        }

        Ok(())
    }
}

/// Quorum manager
pub struct Quorum {
    config: QuorumConfig,
    authorities: HashMap<AuthorityId, Authority>,
    total_weight: u64,
}

impl Quorum {
    pub fn new(config: QuorumConfig, authorities: Vec<Authority>) -> Result<Self> {
        config.validate()?;

        if authorities.len() < config.min_authorities {
            return Err(Error::InvalidState {
                message: format!(
                    "Insufficient authorities: need {}, got {}",
                    config.min_authorities,
                    authorities.len()
                ),
            });
        }

        let total_weight: u64 = if config.use_weights {
            authorities.iter().map(|a| a.weight).sum()
        } else {
            authorities.len() as u64
        };

        let authorities: HashMap<_, _> = authorities
            .into_iter()
            .map(|a| (a.id.clone(), a))
            .collect();

        Ok(Quorum {
            config,
            authorities,
            total_weight,
        })
    }

    /// Calculate required quorum weight
    pub fn required_weight(&self) -> u64 {
        (self.total_weight as f64 * self.config.threshold).ceil() as u64
    }

    /// Check if vote weight meets quorum
    pub fn has_quorum(&self, weight: u64) -> bool {
        weight >= self.required_weight()
    }

    /// Get authority weight
    pub fn get_weight(&self, authority: &AuthorityId) -> Result<u64> {
        self.authorities
            .get(authority)
            .map(|a| {
                if self.config.use_weights {
                    a.weight
                } else {
                    1
                }
            })
            .ok_or_else(|| Error::AuthorityNotFound {
                authority: authority.0.clone(),
            })
    }

    /// Get authority
    pub fn get_authority(&self, authority: &AuthorityId) -> Result<&Authority> {
        self.authorities
            .get(authority)
            .ok_or_else(|| Error::AuthorityNotFound {
                authority: authority.0.clone(),
            })
    }

    /// Calculate weight for a set of authorities
    pub fn calculate_weight<'a>(
        &self,
        authorities: impl Iterator<Item = &'a AuthorityId>,
    ) -> u64 {
        authorities
            .filter_map(|id| self.get_weight(id).ok())
            .sum()
    }

    /// Get total weight
    pub fn total_weight(&self) -> u64 {
        self.total_weight
    }

    /// Get all authorities
    pub fn authorities(&self) -> Vec<&Authority> {
        self.authorities.values().collect()
    }

    /// Get number of authorities
    pub fn authority_count(&self) -> usize {
        self.authorities.len()
    }

    /// Calculate maximum tolerated Byzantine faults
    pub fn max_byzantine_faults(&self) -> usize {
        (self.authorities.len() - 1) / 3
    }

    /// Check if quorum can still be reached given known Byzantine nodes
    pub fn can_reach_quorum(&self, byzantine_count: usize) -> bool {
        byzantine_count <= self.max_byzantine_faults()
    }

    /// Update authority weight
    pub fn update_weight(&mut self, authority: &AuthorityId, new_weight: u64) -> Result<()> {
        let auth = self.authorities.get_mut(authority).ok_or_else(|| {
            Error::AuthorityNotFound {
                authority: authority.0.clone(),
            }
        })?;

        if self.config.use_weights {
            self.total_weight = self.total_weight - auth.weight + new_weight;
            auth.weight = new_weight;
        }

        Ok(())
    }

    /// Mark authority as Byzantine
    pub fn mark_byzantine(&mut self, authority: &AuthorityId) -> Result<()> {
        let auth = self.authorities.get_mut(authority).ok_or_else(|| {
            Error::AuthorityNotFound {
                authority: authority.0.clone(),
            }
        })?;

        auth.is_byzantine = true;
        Ok(())
    }

    /// Get Byzantine authority count
    pub fn byzantine_count(&self) -> usize {
        self.authorities
            .values()
            .filter(|a| a.is_byzantine)
            .count()
    }

    /// Check if system is still Byzantine fault tolerant
    pub fn is_fault_tolerant(&self) -> bool {
        self.can_reach_quorum(self.byzantine_count())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_authorities(count: usize, weight: u64) -> Vec<Authority> {
        (0..count)
            .map(|i| Authority::new(AuthorityId::from(format!("auth-{}", i)), weight))
            .collect()
    }

    #[test]
    fn test_quorum_config_validation() {
        let config = QuorumConfig::default();
        assert!(config.validate().is_ok());

        let invalid_config = QuorumConfig {
            threshold: 0.4,
            ..Default::default()
        };
        assert!(invalid_config.validate().is_err());
    }

    #[test]
    fn test_byzantine_config() {
        let config = QuorumConfig::byzantine(1);
        assert_eq!(config.min_authorities, 4); // 3*1 + 1
        assert_eq!(config.max_faults, 1);

        let config = QuorumConfig::byzantine(2);
        assert_eq!(config.min_authorities, 7); // 3*2 + 1
    }

    #[test]
    fn test_quorum_creation() {
        let authorities = create_test_authorities(4, 100);
        let config = QuorumConfig::default();
        let quorum = Quorum::new(config, authorities).unwrap();

        assert_eq!(quorum.total_weight(), 400);
        assert_eq!(quorum.authority_count(), 4);
    }

    #[test]
    fn test_insufficient_authorities() {
        let authorities = create_test_authorities(2, 100);
        let config = QuorumConfig::byzantine(1); // Needs 4
        let result = Quorum::new(config, authorities);

        assert!(result.is_err());
    }

    #[test]
    fn test_required_weight() {
        let authorities = create_test_authorities(4, 100);
        let config = QuorumConfig {
            threshold: 0.67,
            ..Default::default()
        };
        let quorum = Quorum::new(config, authorities).unwrap();

        // 400 * 0.67 = 268, ceiling = 268
        assert_eq!(quorum.required_weight(), 268);
    }

    #[test]
    fn test_has_quorum() {
        let authorities = create_test_authorities(4, 100);
        let quorum = Quorum::new(QuorumConfig::default(), authorities).unwrap();

        assert!(!quorum.has_quorum(250));
        assert!(quorum.has_quorum(268));
        assert!(quorum.has_quorum(300));
    }

    #[test]
    fn test_calculate_weight() {
        let authorities = create_test_authorities(4, 100);
        let quorum = Quorum::new(QuorumConfig::default(), authorities).unwrap();

        let ids: Vec<_> = (0..3)
            .map(|i| AuthorityId::from(format!("auth-{}", i)))
            .collect();
        let weight = quorum.calculate_weight(ids.iter());

        assert_eq!(weight, 300);
    }

    #[test]
    fn test_max_byzantine_faults() {
        let authorities = create_test_authorities(4, 100);
        let quorum = Quorum::new(QuorumConfig::default(), authorities).unwrap();

        assert_eq!(quorum.max_byzantine_faults(), 1); // (4-1)/3 = 1

        let authorities = create_test_authorities(7, 100);
        let quorum = Quorum::new(QuorumConfig::default(), authorities).unwrap();

        assert_eq!(quorum.max_byzantine_faults(), 2); // (7-1)/3 = 2
    }

    #[test]
    fn test_mark_byzantine() {
        let authorities = create_test_authorities(4, 100);
        let mut quorum = Quorum::new(QuorumConfig::default(), authorities).unwrap();

        let auth_id = AuthorityId::from("auth-0");
        quorum.mark_byzantine(&auth_id).unwrap();

        assert_eq!(quorum.byzantine_count(), 1);
        assert!(quorum.is_fault_tolerant());

        quorum.mark_byzantine(&AuthorityId::from("auth-1")).unwrap();
        assert_eq!(quorum.byzantine_count(), 2);
        assert!(!quorum.is_fault_tolerant()); // 2 faults with 4 nodes
    }

    #[test]
    fn test_update_weight() {
        let authorities = create_test_authorities(4, 100);
        let mut quorum = Quorum::new(QuorumConfig::default(), authorities).unwrap();

        let auth_id = AuthorityId::from("auth-0");
        quorum.update_weight(&auth_id, 200).unwrap();

        assert_eq!(quorum.total_weight(), 500); // 200 + 100 + 100 + 100
        assert_eq!(quorum.get_weight(&auth_id).unwrap(), 200);
    }

    #[test]
    fn test_unweighted_voting() {
        let authorities = create_test_authorities(4, 100);
        let config = QuorumConfig {
            use_weights: false,
            ..Default::default()
        };
        let quorum = Quorum::new(config, authorities).unwrap();

        assert_eq!(quorum.total_weight(), 4); // Count, not sum of weights
        assert_eq!(quorum.get_weight(&AuthorityId::from("auth-0")).unwrap(), 1);
    }
}