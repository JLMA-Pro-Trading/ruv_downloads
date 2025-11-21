//! Absolute minimal smoke test - tests core Ed25519 functionality

use agentic_payments::crypto::AgentIdentity;

#[test]
fn test_generate() {
    AgentIdentity::generate().unwrap();
}

#[test]
fn test_sign() {
    let id = AgentIdentity::generate().unwrap();
    id.sign(b"test").unwrap();
}

#[test]
fn test_verify_valid() {
    let id = AgentIdentity::generate().unwrap();
    let msg = b"test message";
    let sig = id.sign(msg).unwrap();
    assert!(id.verify(msg, &sig).unwrap());
}

#[test]
fn test_verify_invalid() {
    let id = AgentIdentity::generate().unwrap();
    let sig = id.sign(b"original").unwrap();
    assert!(!id.verify(b"tampered", &sig).unwrap());
}

#[test]
fn test_did_generation() {
    let id = AgentIdentity::generate().unwrap();
    let did = id.did();
    assert!(did.starts_with("did:key:z"), "DID should start with did:key:z, got: {}", did);
    assert!(did.len() > 20);
}