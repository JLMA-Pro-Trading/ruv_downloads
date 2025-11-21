//! Protocol detection and routing layer for AP2 and ACP
//!
//! This module provides automatic protocol detection to distinguish between:
//! - **AP2** (Agent Payments Protocol): DID-based authentication with Verifiable Credentials
//! - **ACP** (Agentic Commerce Protocol): Stripe-compatible checkout sessions and payment tokens
//!
//! # Detection Strategy
//!
//! The router uses a combination of HTTP headers and request body patterns:
//!
//! ## ACP Detection
//! - Content-Type: `application/json`
//! - Body contains: `checkout_session` or `shared_payment_token`
//!
//! ## AP2 Detection
//! - Authorization header starts with: `DID`
//! - Body contains: `did:` prefix or `VerifiableCredential` field
//!
//! # Example
//!
//! ```rust
//! use agentic_payments::acp::router::{ProtocolRouter, ProtocolType};
//! use std::collections::HashMap;
//!
//! let mut router = ProtocolRouter::new();
//! let mut headers = HashMap::new();
//! headers.insert("content-type".to_string(), "application/json".to_string());
//!
//! let acp_body = br#"{"checkout_session":{"id":"cs_test_123"}}"#;
//! let protocol = router.detect_protocol(&headers, acp_body);
//! assert_eq!(protocol, ProtocolType::ACP);
//!
//! let metrics = router.get_metrics();
//! assert_eq!(metrics.acp_count(), 1);
//! ```

use std::collections::HashMap;

/// Protocol type detected from incoming request
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProtocolType {
    /// Agent Payments Protocol (DID-based)
    AP2,
    /// Agentic Commerce Protocol (Stripe-compatible)
    ACP,
    /// Unknown or ambiguous protocol
    Unknown,
}

/// Protocol router that detects and routes requests between AP2 and ACP
///
/// This is the core routing layer that maintains zero breaking changes to AP2
/// while enabling ACP functionality. It tracks metrics for monitoring and
/// debugging protocol detection.
pub struct ProtocolRouter {
    metrics: RouterMetrics,
}

/// Metrics tracking for protocol routing
#[derive(Debug, Default, Clone)]
struct RouterMetrics {
    ap2_requests: u64,
    acp_requests: u64,
    unknown_requests: u64,
}

impl ProtocolRouter {
    /// Create a new protocol router with empty metrics
    pub fn new() -> Self {
        Self {
            metrics: RouterMetrics::default(),
        }
    }

    /// Detect protocol type from HTTP headers and request body
    ///
    /// # Detection Algorithm
    ///
    /// 1. **ACP Detection** (highest priority):
    ///    - Checks for JSON content type
    ///    - Scans body for `checkout_session` or `shared_payment_token`
    ///
    /// 2. **AP2 Detection** (fallback):
    ///    - Checks for `DID` prefix in Authorization header
    ///    - Scans body for `did:` prefix or `VerifiableCredential`
    ///
    /// 3. **Unknown** (default):
    ///    - No recognizable patterns found
    ///
    /// # Arguments
    ///
    /// * `headers` - HTTP headers as key-value pairs (case-sensitive keys)
    /// * `body` - Raw request body bytes
    ///
    /// # Returns
    ///
    /// The detected `ProtocolType` and updates internal metrics
    pub fn detect_protocol(&mut self, headers: &HashMap<String, String>, body: &[u8]) -> ProtocolType {
        // ACP detection: Check for Stripe-compatible patterns
        if self.is_acp_request(headers, body) {
            self.metrics.acp_requests += 1;
            return ProtocolType::ACP;
        }

        // AP2 detection: Check for DID/VC patterns
        if self.is_ap2_request(headers, body) {
            self.metrics.ap2_requests += 1;
            return ProtocolType::AP2;
        }

        self.metrics.unknown_requests += 1;
        ProtocolType::Unknown
    }

    /// Check if request matches ACP protocol patterns
    fn is_acp_request(&self, headers: &HashMap<String, String>, body: &[u8]) -> bool {
        // Must have JSON content type
        let has_json_content = headers
            .get("content-type")
            .map(|ct| ct.contains("application/json"))
            .unwrap_or(false);

        if !has_json_content {
            return false;
        }

        // Check for ACP-specific body patterns
        self.contains_pattern(body, b"checkout_session")
            || self.contains_pattern(body, b"shared_payment_token")
    }

    /// Check if request matches AP2 protocol patterns
    fn is_ap2_request(&self, headers: &HashMap<String, String>, body: &[u8]) -> bool {
        // Check for DID authorization header
        let has_did_auth = headers
            .get("authorization")
            .map(|auth| auth.starts_with("DID "))
            .unwrap_or(false);

        if has_did_auth {
            return true;
        }

        // Check for DID/VC patterns in body
        self.contains_pattern(body, b"did:")
            || self.contains_pattern(body, b"VerifiableCredential")
    }

    /// Helper to check if body contains a byte pattern
    fn contains_pattern(&self, body: &[u8], pattern: &[u8]) -> bool {
        body.windows(pattern.len())
            .any(|window| window == pattern)
    }

    /// Get immutable reference to routing metrics
    pub fn get_metrics(&self) -> &RouterMetrics {
        &self.metrics
    }

    /// Reset all metrics counters to zero
    pub fn reset_metrics(&mut self) {
        self.metrics = RouterMetrics::default();
    }
}

impl Default for ProtocolRouter {
    fn default() -> Self {
        Self::new()
    }
}

impl RouterMetrics {
    /// Number of AP2 protocol requests detected
    pub fn ap2_count(&self) -> u64 {
        self.ap2_requests
    }

    /// Number of ACP protocol requests detected
    pub fn acp_count(&self) -> u64 {
        self.acp_requests
    }

    /// Number of unknown protocol requests
    pub fn unknown_count(&self) -> u64 {
        self.unknown_requests
    }

    /// Total number of requests processed
    pub fn total_count(&self) -> u64 {
        self.ap2_requests + self.acp_requests + self.unknown_requests
    }

    /// Percentage of AP2 requests (0.0 to 1.0)
    pub fn ap2_ratio(&self) -> f64 {
        let total = self.total_count();
        if total == 0 {
            0.0
        } else {
            self.ap2_requests as f64 / total as f64
        }
    }

    /// Percentage of ACP requests (0.0 to 1.0)
    pub fn acp_ratio(&self) -> f64 {
        let total = self.total_count();
        if total == 0 {
            0.0
        } else {
            self.acp_requests as f64 / total as f64
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_headers(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    // === ACP Detection Tests ===

    #[test]
    fn test_detect_acp_checkout_session() {
        let mut router = ProtocolRouter::new();
        let headers = make_headers(&[("content-type", "application/json")]);
        let body = br#"{"checkout_session":{"id":"cs_test_123","amount":1000}}"#;

        assert_eq!(router.detect_protocol(&headers, body), ProtocolType::ACP);
        assert_eq!(router.get_metrics().acp_count(), 1);
        assert_eq!(router.get_metrics().total_count(), 1);
    }

    #[test]
    fn test_detect_acp_shared_payment_token() {
        let mut router = ProtocolRouter::new();
        let headers = make_headers(&[("content-type", "application/json")]);
        let body = br#"{"shared_payment_token":"spt_abc123xyz"}"#;

        assert_eq!(router.detect_protocol(&headers, body), ProtocolType::ACP);
        assert_eq!(router.get_metrics().acp_count(), 1);
    }

    #[test]
    fn test_detect_acp_requires_json_content_type() {
        let mut router = ProtocolRouter::new();
        let headers = make_headers(&[("content-type", "text/plain")]);
        let body = br#"{"checkout_session":{"id":"cs_test"}}"#;

        // Should not detect as ACP without JSON content type
        assert_ne!(router.detect_protocol(&headers, body), ProtocolType::ACP);
    }

    #[test]
    fn test_detect_acp_with_application_json_charset() {
        let mut router = ProtocolRouter::new();
        let headers = make_headers(&[("content-type", "application/json; charset=utf-8")]);
        let body = br#"{"checkout_session":{}}"#;

        assert_eq!(router.detect_protocol(&headers, body), ProtocolType::ACP);
    }

    // === AP2 Detection Tests ===

    #[test]
    fn test_detect_ap2_did_authorization() {
        let mut router = ProtocolRouter::new();
        let headers = make_headers(&[("authorization", "DID did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK")]);
        let body = b"{}";

        assert_eq!(router.detect_protocol(&headers, body), ProtocolType::AP2);
        assert_eq!(router.get_metrics().ap2_count(), 1);
    }

    #[test]
    fn test_detect_ap2_did_in_body() {
        let mut router = ProtocolRouter::new();
        let headers = HashMap::new();
        let body = br#"{"issuer":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"}"#;

        assert_eq!(router.detect_protocol(&headers, body), ProtocolType::AP2);
        assert_eq!(router.get_metrics().ap2_count(), 1);
    }

    #[test]
    fn test_detect_ap2_verifiable_credential() {
        let mut router = ProtocolRouter::new();
        let headers = HashMap::new();
        let body = br#"{"@context":["https://www.w3.org/2018/credentials/v1"],"type":["VerifiableCredential"]}"#;

        assert_eq!(router.detect_protocol(&headers, body), ProtocolType::AP2);
        assert_eq!(router.get_metrics().ap2_count(), 1);
    }

    #[test]
    fn test_detect_ap2_authorization_must_start_with_did() {
        let mut router = ProtocolRouter::new();
        let headers = make_headers(&[("authorization", "Bearer did:key:z6Mk...")]);
        let body = b"{}";

        // Should not detect as AP2 if authorization doesn't start with "DID "
        assert_ne!(router.detect_protocol(&headers, body), ProtocolType::AP2);
    }

    // === Unknown Protocol Tests ===

    #[test]
    fn test_detect_unknown_empty_request() {
        let mut router = ProtocolRouter::new();
        let headers = HashMap::new();
        let body = b"";

        assert_eq!(router.detect_protocol(&headers, body), ProtocolType::Unknown);
        assert_eq!(router.get_metrics().unknown_count(), 1);
    }

    #[test]
    fn test_detect_unknown_no_patterns() {
        let mut router = ProtocolRouter::new();
        let headers = make_headers(&[("content-type", "application/json")]);
        let body = br#"{"user":"alice","action":"login"}"#;

        assert_eq!(router.detect_protocol(&headers, body), ProtocolType::Unknown);
        assert_eq!(router.get_metrics().unknown_count(), 1);
    }

    // === Metrics Tests ===

    #[test]
    fn test_metrics_counting() {
        let mut router = ProtocolRouter::new();
        let json_headers = make_headers(&[("content-type", "application/json")]);
        let did_headers = make_headers(&[("authorization", "DID did:key:z6Mk...")]);

        // Process various requests
        router.detect_protocol(&json_headers, br#"{"checkout_session":{}}"#);
        router.detect_protocol(&json_headers, br#"{"checkout_session":{}}"#);
        router.detect_protocol(&did_headers, b"{}");
        router.detect_protocol(&HashMap::new(), b"unknown");

        let metrics = router.get_metrics();
        assert_eq!(metrics.acp_count(), 2);
        assert_eq!(metrics.ap2_count(), 1);
        assert_eq!(metrics.unknown_count(), 1);
        assert_eq!(metrics.total_count(), 4);
    }

    #[test]
    fn test_metrics_ratios() {
        let mut router = ProtocolRouter::new();
        let json_headers = make_headers(&[("content-type", "application/json")]);
        let did_headers = make_headers(&[("authorization", "DID did:key:z6Mk...")]);

        // 3 ACP, 1 AP2 = 75% ACP, 25% AP2
        router.detect_protocol(&json_headers, br#"{"checkout_session":{}}"#);
        router.detect_protocol(&json_headers, br#"{"shared_payment_token":"spt_123"}"#);
        router.detect_protocol(&json_headers, br#"{"checkout_session":{}}"#);
        router.detect_protocol(&did_headers, b"{}");

        let metrics = router.get_metrics();
        assert_eq!(metrics.acp_ratio(), 0.75);
        assert_eq!(metrics.ap2_ratio(), 0.25);
    }

    #[test]
    fn test_metrics_ratios_empty() {
        let router = ProtocolRouter::new();
        let metrics = router.get_metrics();

        assert_eq!(metrics.acp_ratio(), 0.0);
        assert_eq!(metrics.ap2_ratio(), 0.0);
    }

    #[test]
    fn test_reset_metrics() {
        let mut router = ProtocolRouter::new();
        let headers = make_headers(&[("content-type", "application/json")]);

        router.detect_protocol(&headers, br#"{"checkout_session":{}}"#);
        assert_eq!(router.get_metrics().total_count(), 1);

        router.reset_metrics();
        assert_eq!(router.get_metrics().total_count(), 0);
        assert_eq!(router.get_metrics().acp_count(), 0);
    }

    // === Edge Cases ===

    #[test]
    fn test_case_sensitive_headers() {
        let mut router = ProtocolRouter::new();

        // Lowercase header key
        let headers_lower = make_headers(&[("content-type", "application/json")]);
        let body = br#"{"checkout_session":{}}"#;
        assert_eq!(router.detect_protocol(&headers_lower, body), ProtocolType::ACP);

        // Uppercase header key (won't match)
        router.reset_metrics();
        let headers_upper = make_headers(&[("Content-Type", "application/json")]);
        assert_ne!(router.detect_protocol(&headers_upper, body), ProtocolType::ACP);
    }

    #[test]
    fn test_partial_pattern_no_match() {
        let mut router = ProtocolRouter::new();
        let headers = make_headers(&[("content-type", "application/json")]);

        // "checkout" without "_session" should not match
        let body = br#"{"checkout":{}}"#;
        assert_eq!(router.detect_protocol(&headers, body), ProtocolType::Unknown);
    }

    #[test]
    fn test_multiple_patterns_acp_takes_priority() {
        let mut router = ProtocolRouter::new();
        let headers = make_headers(&[
            ("content-type", "application/json"),
            ("authorization", "DID did:key:z6Mk...")
        ]);

        // Body has both ACP and AP2 patterns - ACP should win
        let body = br#"{"checkout_session":{},"issuer":"did:key:z6Mk..."}"#;
        assert_eq!(router.detect_protocol(&headers, body), ProtocolType::ACP);
    }

    #[test]
    fn test_binary_body_no_patterns() {
        let mut router = ProtocolRouter::new();
        let headers = HashMap::new();
        let body = &[0x00, 0xFF, 0xAB, 0xCD];

        assert_eq!(router.detect_protocol(&headers, body), ProtocolType::Unknown);
    }

    #[test]
    fn test_very_large_body() {
        let mut router = ProtocolRouter::new();
        let headers = make_headers(&[("content-type", "application/json")]);

        // Pattern at the end of large body
        let mut body = vec![b' '; 10_000];
        body.extend_from_slice(br#"{"checkout_session":{}}"#);

        assert_eq!(router.detect_protocol(&headers, &body), ProtocolType::ACP);
    }

    #[test]
    fn test_default_constructor() {
        let router = ProtocolRouter::default();
        assert_eq!(router.get_metrics().total_count(), 0);
    }
}