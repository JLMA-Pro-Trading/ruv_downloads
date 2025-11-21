//! HONEST Deep Validation - tests what ACTUALLY exists, not what we wish existed

use agentic_payments::crypto::*;
use agentic_payments::ap2::*;
use agentic_payments::error::{Error, CryptoError, ConsensusError};

#[test]
fn test_1_identity_generation_works() {
    let identity = AgentIdentity::generate().expect("Failed to generate identity");
    assert!(identity.did().starts_with("did:ap2:"));
    println!("✓ Identity generation works: {}", identity.did());
}

#[test]
fn test_2_signing_works() {
    let identity = AgentIdentity::generate().expect("Failed to generate identity");
    let message = b"critical test message";
    let signature = identity.sign(message).expect("Failed to sign");
    assert_eq!(signature.to_bytes().len(), 64);
    println!("✓ Signing works: {} byte signature", signature.to_bytes().len());
}

#[test]
fn test_3_verification_works() {
    let identity = AgentIdentity::generate().expect("Failed to generate identity");
    let message = b"verification test";
    let signature = identity.sign(message).expect("Failed to sign");
    let is_valid = identity.verify(message, &signature).expect("Failed to verify");
    assert!(is_valid, "Signature must verify");
    println!("✓ Verification works correctly");
}

#[test]
fn test_4_wrong_message_fails_verification() {
    let identity = AgentIdentity::generate().expect("Failed to generate identity");
    let message = b"original message";
    let signature = identity.sign(message).expect("Failed to sign");
    let wrong_msg = b"tampered message";
    let is_valid = identity.verify(wrong_msg, &signature).expect("Failed to verify");
    assert!(!is_valid, "Wrong message should NOT verify");
    println!("✓ Invalid signatures correctly rejected");
}

#[test]
fn test_5_keypair_conversion_works() {
    let identity = AgentIdentity::generate().expect("Failed to generate identity");
    let keypair = identity.to_keypair().expect("Failed to convert");
    let msg = b"keypair test";
    let sig = keypair.sign(msg).expect("Failed to sign with keypair");
    let valid = keypair.verify(msg, &sig).expect("Failed to verify with keypair");
    assert!(valid);
    println!("✓ KeyPair conversion works");
}

#[test]
fn test_6_batch_verification_works() {
    let batch = BatchVerification::new();
    let id1 = AgentIdentity::generate().expect("Failed to generate id1");
    let id2 = AgentIdentity::generate().expect("Failed to generate id2");

    let msg1 = b"first message";
    let msg2 = b"second message";

    let sig1 = id1.sign(msg1).expect("Failed to sign 1");
    let sig2 = id2.sign(msg2).expect("Failed to sign 2");

    batch.add(id1.verifying_key().clone(), msg1.to_vec(), sig1);
    batch.add(id2.verifying_key().clone(), msg2.to_vec(), sig2);

    let results = batch.verify_all().expect("Batch verify failed");
    assert_eq!(results.total, 2);
    assert_eq!(results.valid, 2);
    assert_eq!(results.invalid, 0);
    println!("✓ Batch verification works: {}/{} valid", results.valid, results.total);
}

#[test]
fn test_7_verifiable_credential_creation() {
    let issuer_id = AgentIdentity::generate().expect("Failed gen issuer");
    let subject = CredentialSubject::new(
        issuer_id.did().clone(),
        "test-subject-123".to_string()
    );

    // Use dummy private key (32 bytes)
    let dummy_key = [0u8; 32];
    let credential = VerifiableCredential::new(
        issuer_id.did(),
        subject,
        &dummy_key
    ).expect("Failed to create credential");

    assert!(credential.id.starts_with("urn:uuid:"));
    println!("✓ Verifiable Credential creation works: {}", credential.id);
}

#[test]
fn test_8_intent_mandate_creation() {
    let user = AgentIdentity::generate().expect("Failed gen user");
    let bot = AgentIdentity::generate().expect("Failed gen bot");

    let mandate = IntentMandate::new(
        user.did(),
        bot.did(),
        "Purchase groceries weekly".to_string()
    );

    assert_eq!(mandate.issuer, user.did());
    assert_eq!(mandate.subject_agent, bot.did());
    assert_eq!(mandate.status, MandateStatus::Active);
    println!("✓ IntentMandate creation works: {}", mandate.id);
}

#[test]
fn test_9_cart_mandate_creation() {
    let bot = AgentIdentity::generate().expect("Failed gen bot");

    let item1 = CartItem::new("item1".to_string(), "Bananas".to_string(), 2, 199);
    let item2 = CartItem::new("item2".to_string(), "Milk".to_string(), 1, 349);

    let cart = CartMandate::new(
        bot.did(),
        vec![item1, item2],
        548, // 1.99 + 3.49 in cents
        "USD".to_string()
    );

    assert_eq!(cart.items.len(), 2);
    assert_eq!(cart.total_amount, 548);
    println!("✓ CartMandate creation works: {} items, ${}.{:02}",
        cart.items.len(), cart.total_amount / 100, cart.total_amount % 100);
}

#[test]
fn test_10_error_conversions() {
    // Test error type conversions work
    let crypto_err = CryptoError::InvalidSignature {
        details: "test error".to_string()
    };
    let main_err: Error = crypto_err.into();
    assert!(matches!(main_err, Error::Crypto(_)));

    let consensus_err = ConsensusError::QuorumNotAchieved {
        available: 2,
        required: 3,
    };
    let main_err2: Error = consensus_err.into();
    assert!(matches!(main_err2, Error::Consensus(_)));
    println!("✓ Error conversions work correctly");
}

#[test]
fn test_11_did_parsing_works() {
    let identity = AgentIdentity::generate().expect("Failed to generate");
    let did = identity.did();
    let parsed = Did::parse(&did).expect("Failed to parse DID");
    assert_eq!(parsed.method(), "ap2");
    println!("✓ DID parsing works: method={}", parsed.method());
}

#[test]
fn test_12_did_document_creation() {
    let identity = AgentIdentity::generate().expect("Failed to generate");
    let doc = DidDocument::new(identity.did());
    assert_eq!(doc.id, identity.did());
    assert_eq!(doc.context, "https://www.w3.org/ns/did/v1");
    println!("✓ DID Document creation works");
}