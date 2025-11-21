//! Trust chain validation workflow with parallel certificate validation

use crate::error::{Error, Result};
use crate::workflows::{WorkflowContext, WorkflowResult};
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::Instant;
use tracing::{debug, info};

/// Certificate in a trust chain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Certificate {
    /// Certificate ID
    pub id: String,
    /// Issuer ID
    pub issuer: String,
    /// Subject ID  
    pub subject: String,
    /// Public key bytes
    pub public_key: Vec<u8>,
    /// Signature bytes
    pub signature: Vec<u8>,
    /// Is this a root certificate
    pub is_root: bool,
}

/// Trust chain validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustChainResult {
    /// Whether chain is valid
    pub valid: bool,
    /// Chain length
    pub chain_length: usize,
    /// Root certificate ID
    pub root_id: Option<String>,
    /// Validation errors
    pub errors: Vec<String>,
}

/// Autonomous trust chain validation workflow
pub struct AutonomousTrustChainWorkflow {
    trusted_roots: HashSet<String>,
    max_chain_length: usize,
}

impl AutonomousTrustChainWorkflow {
    /// Create a new trust chain validation workflow
    pub fn new(trusted_roots: HashSet<String>, max_chain_length: usize) -> Self {
        Self {
            trusted_roots,
            max_chain_length,
        }
    }

    /// Execute autonomous trust chain validation
    pub async fn execute(
        &self,
        certificates: Vec<Certificate>,
        context: WorkflowContext,
    ) -> Result<WorkflowResult<TrustChainResult>> {
        let start = Instant::now();

        info!("Starting trust chain validation workflow {}", context.id);

        // Build certificate map
        let cert_map: HashMap<String, Certificate> = certificates
            .iter()
            .map(|cert| (cert.id.clone(), cert.clone()))
            .collect();

        // Find leaf certificate (one that isn't an issuer)
        let issuers: HashSet<String> = certificates.iter().map(|c| c.issuer.clone()).collect();
        let leaf = certificates
            .iter()
            .find(|cert| !issuers.contains(&cert.id))
            .ok_or_else(|| Error::TrustChainFailed("No leaf certificate found".to_string()))?;

        // Validate chain using DFS
        let result = self.validate_chain(leaf, &cert_map).await?;

        let execution_time_ms = start.elapsed().as_millis() as u64;

        info!(
            "Trust chain validation workflow {} completed: {}",
            context.id,
            if result.valid { "VALID" } else { "INVALID" }
        );

        Ok(WorkflowResult::success(context, result, execution_time_ms))
    }

    /// Validate certificate chain using depth-first search
    async fn validate_chain(
        &self,
        leaf: &Certificate,
        cert_map: &HashMap<String, Certificate>,
    ) -> Result<TrustChainResult> {
        let mut chain = Vec::new();
        let mut errors = Vec::new();
        let mut current = leaf.clone();
        let mut visited = HashSet::new();

        loop {
            // Check for cycles
            if visited.contains(&current.id) {
                errors.push(format!("Cycle detected at certificate {}", current.id));
                return Ok(TrustChainResult {
                    valid: false,
                    chain_length: chain.len(),
                    root_id: None,
                    errors,
                });
            }

            visited.insert(current.id.clone());
            chain.push(current.clone());

            // Check chain length
            if chain.len() > self.max_chain_length {
                errors.push(format!("Chain too long: {} > {}", chain.len(), self.max_chain_length));
                return Ok(TrustChainResult {
                    valid: false,
                    chain_length: chain.len(),
                    root_id: None,
                    errors,
                });
            }

            // Check if we reached a root
            if current.is_root {
                if self.trusted_roots.contains(&current.id) {
                    debug!("Reached trusted root: {}", current.id);
                    return Ok(TrustChainResult {
                        valid: true,
                        chain_length: chain.len(),
                        root_id: Some(current.id.clone()),
                        errors: Vec::new(),
                    });
                } else {
                    errors.push(format!("Root {} is not trusted", current.id));
                    return Ok(TrustChainResult {
                        valid: false,
                        chain_length: chain.len(),
                        root_id: Some(current.id.clone()),
                        errors,
                    });
                }
            }

            // Move to issuer
            match cert_map.get(&current.issuer) {
                Some(issuer) => current = issuer.clone(),
                None => {
                    errors.push(format!("Issuer {} not found", current.issuer));
                    return Ok(TrustChainResult {
                        valid: false,
                        chain_length: chain.len(),
                        root_id: None,
                        errors,
                    });
                }
            }
        }
    }

    /// Validate multiple chains in parallel
    pub async fn validate_multiple(
        &self,
        certificate_chains: Vec<Vec<Certificate>>,
        context: WorkflowContext,
    ) -> Result<Vec<WorkflowResult<TrustChainResult>>> {
        info!("Validating {} certificate chains in parallel", certificate_chains.len());

        let futures = certificate_chains.into_iter().map(|certs| {
            let ctx = context.clone();
            async move { self.execute(certs, ctx).await }
        });

        let results = join_all(futures).await;
        
        Ok(results.into_iter().filter_map(Result::ok).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_cert(id: &str, issuer: &str, is_root: bool) -> Certificate {
        Certificate {
            id: id.to_string(),
            issuer: issuer.to_string(),
            subject: id.to_string(),
            public_key: vec![1, 2, 3],
            signature: vec![4, 5, 6],
            is_root,
        }
    }

    #[tokio::test]
    async fn test_valid_chain() {
        let mut roots = HashSet::new();
        roots.insert("root".to_string());

        let workflow = AutonomousTrustChainWorkflow::new(roots, 10);

        let certs = vec![
            create_cert("leaf", "intermediate", false),
            create_cert("intermediate", "root", false),
            create_cert("root", "root", true),
        ];

        let result = workflow
            .execute(certs, WorkflowContext::default())
            .await
            .unwrap();

        assert!(result.success);
        assert!(result.data.valid);
        assert_eq!(result.data.chain_length, 3);
    }

    #[tokio::test]
    async fn test_untrusted_root() {
        let roots = HashSet::new(); // No trusted roots

        let workflow = AutonomousTrustChainWorkflow::new(roots, 10);

        let certs = vec![
            create_cert("leaf", "root", false),
            create_cert("root", "root", true),
        ];

        let result = workflow
            .execute(certs, WorkflowContext::default())
            .await
            .unwrap();

        assert!(!result.data.valid);
    }
}
