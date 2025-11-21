//! Decentralized Identifier (DID) Management and Resolution

use super::{Ap2Error, Result};
use crate::ap2::credentials::VerificationMethod;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// DID Document as per W3C DID specification
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DidDocument {
    #[serde(rename = "@context")]
    pub context: Vec<String>,
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub controller: Option<Vec<String>>,
    pub verification_method: Vec<VerificationMethod>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authentication: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assertion_method: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_agreement: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capability_invocation: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capability_delegation: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service: Option<Vec<ServiceEndpoint>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated: Option<DateTime<Utc>>,
}

/// Service Endpoint for DID Document
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceEndpoint {
    pub id: String,
    #[serde(rename = "type")]
    pub service_type: String,
    pub service_endpoint: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl DidDocument {
    /// Create a new DID Document
    pub fn new(id: String, verification_method: VerificationMethod) -> Self {
        let verification_method_id = verification_method.id.clone();

        Self {
            context: vec![
                "https://www.w3.org/ns/did/v1".to_string(),
                "https://w3id.org/security/suites/ed25519-2020/v1".to_string(),
            ],
            id,
            controller: None,
            verification_method: vec![verification_method],
            authentication: Some(vec![verification_method_id.clone()]),
            assertion_method: Some(vec![verification_method_id.clone()]),
            key_agreement: None,
            capability_invocation: Some(vec![verification_method_id.clone()]),
            capability_delegation: None,
            service: None,
            created: Some(Utc::now()),
            updated: None,
        }
    }

    /// Add a service endpoint
    pub fn add_service(&mut self, service: ServiceEndpoint) {
        if let Some(ref mut services) = self.service {
            services.push(service);
        } else {
            self.service = Some(vec![service]);
        }
        self.updated = Some(Utc::now());
    }

    /// Add a verification method
    pub fn add_verification_method(&mut self, method: VerificationMethod) {
        self.verification_method.push(method);
        self.updated = Some(Utc::now());
    }

    /// Get verification method by ID
    pub fn get_verification_method(&self, id: &str) -> Option<&VerificationMethod> {
        self.verification_method.iter().find(|m| m.id == id)
    }

    /// Get service endpoint by type
    pub fn get_service_by_type(&self, service_type: &str) -> Option<&ServiceEndpoint> {
        self.service
            .as_ref()?
            .iter()
            .find(|s| s.service_type == service_type)
    }
}

/// DID Resolver - Resolves DIDs to DID Documents
#[derive(Debug, Clone)]
pub struct DidResolver {
    cache: HashMap<String, DidDocument>,
}

impl DidResolver {
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    /// Resolve a DID to its document
    pub fn resolve(&self, did: &str) -> Result<DidDocument> {
        // Check cache first
        if let Some(doc) = self.cache.get(did) {
            return Ok(doc.clone());
        }

        // In production, this would query actual DID registries
        // For now, return error for unregistered DIDs
        Err(Ap2Error::DidResolutionFailed(format!(
            "DID not found: {}",
            did
        )))
    }

    /// Register a DID document (for testing/local use)
    pub fn register(&mut self, did_doc: DidDocument) {
        self.cache.insert(did_doc.id.clone(), did_doc);
    }

    /// Check if DID exists
    pub fn exists(&self, did: &str) -> bool {
        self.cache.contains_key(did)
    }

    /// Remove a DID from cache
    pub fn deregister(&mut self, did: &str) -> bool {
        self.cache.remove(did).is_some()
    }

    /// Clear all cached DIDs
    pub fn clear_cache(&mut self) {
        self.cache.clear();
    }
}

impl Default for DidResolver {
    fn default() -> Self {
        Self::new()
    }
}

/// DID Manager - Creates and manages DIDs
#[derive(Debug)]
pub struct DidManager {
    resolver: DidResolver,
    method: String,
}

impl DidManager {
    pub fn new() -> Self {
        Self {
            resolver: DidResolver::new(),
            method: "ap2".to_string(),
        }
    }

    pub fn with_method(mut self, method: String) -> Self {
        self.method = method;
        self
    }

    /// Create a new DID with Ed25519 key
    pub fn create_did(&mut self, identifier: &str, public_key: Vec<u8>) -> Result<String> {
        let did = format!("did:{}:{}", self.method, identifier);

        let verification_method = VerificationMethod {
            id: format!("{}#key-1", did),
            method_type: "Ed25519VerificationKey2020".to_string(),
            controller: did.clone(),
            public_key_multibase: base64_url::encode(&public_key),
        };

        let did_doc = DidDocument::new(did.clone(), verification_method);
        self.resolver.register(did_doc);

        Ok(did)
    }

    /// Create DID with custom verification method
    pub fn create_did_with_method(
        &mut self,
        identifier: &str,
        verification_method: VerificationMethod,
    ) -> Result<String> {
        let did = format!("did:{}:{}", self.method, identifier);
        let did_doc = DidDocument::new(did.clone(), verification_method);
        self.resolver.register(did_doc);

        Ok(did)
    }

    /// Update DID document
    pub fn update_did(&mut self, did: &str, mut did_doc: DidDocument) -> Result<()> {
        if !self.resolver.exists(did) {
            return Err(Ap2Error::DidResolutionFailed(format!(
                "DID not found: {}",
                did
            )));
        }

        did_doc.updated = Some(Utc::now());
        self.resolver.register(did_doc);
        Ok(())
    }

    /// Get DID document
    pub fn get_did_document(&self, did: &str) -> Result<DidDocument> {
        self.resolver.resolve(did)
    }

    /// Add service endpoint to DID
    pub fn add_service_to_did(&mut self, did: &str, service: ServiceEndpoint) -> Result<()> {
        let mut did_doc = self.resolver.resolve(did)?;
        did_doc.add_service(service);
        self.resolver.register(did_doc);
        Ok(())
    }

    /// Deactivate a DID
    pub fn deactivate_did(&mut self, did: &str) -> Result<()> {
        if !self.resolver.deregister(did) {
            return Err(Ap2Error::DidResolutionFailed(format!(
                "DID not found: {}",
                did
            )));
        }
        Ok(())
    }

    /// Get resolver reference
    pub fn resolver(&self) -> &DidResolver {
        &self.resolver
    }

    /// Get mutable resolver reference
    pub fn resolver_mut(&mut self) -> &mut DidResolver {
        &mut self.resolver
    }
}

impl Default for DidManager {
    fn default() -> Self {
        Self::new()
    }
}

/// DID URL Parser
pub struct DidUrlParser;

impl DidUrlParser {
    /// Parse a DID URL into components
    pub fn parse(did_url: &str) -> Result<DidUrlComponents> {
        let parts: Vec<&str> = did_url.split(':').collect();

        if parts.len() < 3 || parts[0] != "did" {
            return Err(Ap2Error::InvalidCredential(format!(
                "Invalid DID format: {}",
                did_url
            )));
        }

        let method = parts[1].to_string();
        let method_specific_id = parts[2..].join(":");

        // Check for fragment
        let (identifier, fragment) = if let Some(pos) = method_specific_id.find('#') {
            (
                method_specific_id[..pos].to_string(),
                Some(method_specific_id[pos + 1..].to_string()),
            )
        } else {
            (method_specific_id, None)
        };

        Ok(DidUrlComponents {
            did: format!("did:{}:{}", method, identifier),
            method,
            method_specific_id: identifier,
            fragment,
            query: None,
        })
    }
}

/// Components of a parsed DID URL
#[derive(Debug, Clone)]
pub struct DidUrlComponents {
    pub did: String,
    pub method: String,
    pub method_specific_id: String,
    pub fragment: Option<String>,
    pub query: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_did_creation() {
        let mut manager = DidManager::new();
        let public_key = vec![1, 2, 3, 4];

        let did = manager.create_did("test-agent", public_key);
        assert!(did.is_ok());

        let did_str = did.unwrap();
        assert!(did_str.starts_with("did:ap2:"));
    }

    #[test]
    fn test_did_resolution() {
        let mut manager = DidManager::new();
        let public_key = vec![1, 2, 3, 4];
        let did = manager.create_did("test-agent", public_key).unwrap();

        let did_doc = manager.get_did_document(&did);
        assert!(did_doc.is_ok());

        let doc = did_doc.unwrap();
        assert_eq!(doc.id, did);
        assert!(!doc.verification_method.is_empty());
    }

    #[test]
    fn test_service_endpoint_addition() {
        let mut manager = DidManager::new();
        let public_key = vec![1, 2, 3, 4];
        let did = manager.create_did("test-agent", public_key).unwrap();

        let service = ServiceEndpoint {
            id: format!("{}#payment-service", did),
            service_type: "PaymentService".to_string(),
            service_endpoint: "https://payment.example.com".to_string(),
            description: Some("Agent payment endpoint".to_string()),
        };

        let result = manager.add_service_to_did(&did, service);
        assert!(result.is_ok());

        let did_doc = manager.get_did_document(&did).unwrap();
        assert!(did_doc.service.is_some());
    }

    #[test]
    fn test_did_url_parsing() {
        let did_url = "did:ap2:agent123#key-1";
        let components = DidUrlParser::parse(did_url).unwrap();

        assert_eq!(components.method, "ap2");
        assert_eq!(components.method_specific_id, "agent123");
        assert_eq!(components.fragment, Some("key-1".to_string()));
    }
}