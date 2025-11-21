// Direct test of ACP HMAC functionality without full compilation
use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

fn generate_signature(secret: &[u8], payload: &[u8]) -> Result<String, String> {
    let mut mac = HmacSha256::new_from_slice(secret)
        .map_err(|e| format!("HMAC initialization failed: {}", e))?;
    mac.update(payload);
    let result = mac.finalize();
    Ok(hex::encode(result.into_bytes()))
}

fn verify_signature(secret: &[u8], payload: &[u8], signature: &str) -> Result<bool, String> {
    let expected = generate_signature(secret, payload)?;
    Ok(constant_time_compare(&expected, signature))
}

fn constant_time_compare(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.bytes().zip(b.bytes())
        .fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0
}

fn main() {
    println!("🔐 Testing ACP HMAC Implementation\n");

    // Test 1: Signature Generation
    println!("Test 1: Signature Generation");
    let secret = b"test_secret_key_12345678901234567890";
    let payload = b"test_payload_data";
    match generate_signature(secret, payload) {
        Ok(sig) => {
            println!("  ✓ Generated signature: {} (length: {})", sig, sig.len());
            assert_eq!(sig.len(), 64, "SHA256 should produce 64 hex characters");
        }
        Err(e) => panic!("  ✗ Failed: {}", e),
    }

    // Test 2: Signature Verification (Valid)
    println!("\nTest 2: Signature Verification (Valid)");
    let secret = b"test_secret";
    let payload = b"test_payload";
    let sig = generate_signature(secret, payload).unwrap();
    match verify_signature(secret, payload, &sig) {
        Ok(true) => println!("  ✓ Valid signature verified successfully"),
        Ok(false) => panic!("  ✗ Valid signature rejected"),
        Err(e) => panic!("  ✗ Verification error: {}", e),
    }

    // Test 3: Signature Verification (Invalid)
    println!("\nTest 3: Signature Verification (Invalid)");
    let invalid_sig = "0000000000000000000000000000000000000000000000000000000000000000";
    match verify_signature(secret, payload, invalid_sig) {
        Ok(false) => println!("  ✓ Invalid signature rejected correctly"),
        Ok(true) => panic!("  ✗ Invalid signature accepted"),
        Err(e) => panic!("  ✗ Verification error: {}", e),
    }

    // Test 4: Wrong Payload Detection
    println!("\nTest 4: Wrong Payload Detection");
    let payload1 = b"original_payload";
    let payload2 = b"modified_payload";
    let sig = generate_signature(secret, payload1).unwrap();
    match verify_signature(secret, payload2, &sig) {
        Ok(false) => println!("  ✓ Modified payload detected correctly"),
        Ok(true) => panic!("  ✗ Modified payload not detected"),
        Err(e) => panic!("  ✗ Verification error: {}", e),
    }

    // Test 5: Constant-Time Comparison
    println!("\nTest 5: Constant-Time Comparison");
    let a = "abcdef1234567890";
    let b = "abcdef1234567890";
    assert!(constant_time_compare(a, b), "Equal strings should match");
    println!("  ✓ Equal strings match");

    let c = "abcdef1234567891";
    assert!(!constant_time_compare(a, c), "Different strings should not match");
    println!("  ✓ Different strings don't match");

    // Test 6: Deterministic Signatures
    println!("\nTest 6: Deterministic Signatures");
    let sig1 = generate_signature(secret, payload).unwrap();
    let sig2 = generate_signature(secret, payload).unwrap();
    assert_eq!(sig1, sig2, "Signatures should be deterministic");
    println!("  ✓ Signatures are deterministic");

    // Test 7: Large Payload
    println!("\nTest 7: Large Payload (10KB)");
    let large_payload = vec![0u8; 10_000];
    let sig = generate_signature(secret, &large_payload).unwrap();
    match verify_signature(secret, &large_payload, &sig) {
        Ok(true) => println!("  ✓ Large payload handled correctly"),
        _ => panic!("  ✗ Large payload verification failed"),
    }

    println!("\n✅ All HMAC tests passed!");
}