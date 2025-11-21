//! BRUTAL HONESTY TEST - Only tests what provably works, no wishful thinking

use agentic_payments::crypto::*;

#[test]
fn can_generate_identity() {
    AgentIdentity::generate().expect("generate failed");
}

#[test]
fn can_sign_message() {
    let id = AgentIdentity::generate().unwrap();
    id.sign(b"test").expect("sign failed");
}

#[test]
fn can_verify_signature() {
    let id = AgentIdentity::generate().unwrap();
    let msg = b"test";
    let sig = id.sign(msg).unwrap();
    let valid = id.verify(msg, &sig).unwrap();
    assert!(valid);
}

#[test]
fn rejects_invalid_signature() {
    let id = AgentIdentity::generate().unwrap();
    let sig = id.sign(b"original").unwrap();
    let valid = id.verify(b"tampered", &sig).unwrap();
    assert!(!valid);
}

#[test]
fn batch_verification_compiles() {
    let _ = BatchVerification::new();
}

#[test]
fn signature_manager_compiles() {
    let _ = SignatureManager::new();
}

#[test]
fn keypair_converts() {
    let id = AgentIdentity::generate().unwrap();
    id.to_keypair().expect("conversion failed");
}