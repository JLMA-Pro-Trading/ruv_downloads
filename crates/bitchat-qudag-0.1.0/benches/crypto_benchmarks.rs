//! Cryptographic operation benchmarks

use bitchat_qudag::crypto::{CryptoMode, HybridCrypto, KeyPair, SessionKey};
use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use std::time::Duration;

fn bench_key_generation(c: &mut Criterion) {
    let mut group = c.benchmark_group("key_generation");

    group.bench_function("keypair_generation", |b| b.iter(|| KeyPair::generate()));

    group.bench_function("session_key_generation", |b| {
        b.iter(|| SessionKey::generate())
    });

    group.finish();
}

fn bench_crypto_modes(c: &mut Criterion) {
    let mut group = c.benchmark_group("crypto_modes");

    let modes = vec![
        CryptoMode::Traditional,
        CryptoMode::Hybrid,
        CryptoMode::QuantumResistant,
    ];

    for mode in modes {
        group.bench_with_input(
            BenchmarkId::new("crypto_creation", format!("{:?}", mode)),
            &mode,
            |b, mode| b.iter(|| HybridCrypto::new(mode.clone())),
        );
    }

    group.finish();
}

fn bench_encryption_decryption(c: &mut Criterion) {
    let mut group = c.benchmark_group("encryption_decryption");

    let message_sizes = vec![32, 256, 1024, 4096, 16384, 65536];
    let crypto = HybridCrypto::new(CryptoMode::Traditional);
    let key_pair1 = KeyPair::generate();
    let key_pair2 = KeyPair::generate();

    for size in message_sizes {
        let message = vec![0u8; size];

        group.throughput(Throughput::Bytes(size as u64));

        group.bench_with_input(BenchmarkId::new("encrypt", size), &message, |b, msg| {
            b.iter(|| {
                crypto
                    .encrypt_message(msg, &key_pair1, &key_pair2.exchange_public_bytes())
                    .unwrap()
            })
        });

        // Pre-encrypt for decryption benchmark
        let encrypted = crypto
            .encrypt_message(&message, &key_pair1, &key_pair2.exchange_public_bytes())
            .unwrap();

        group.bench_with_input(BenchmarkId::new("decrypt", size), &encrypted, |b, enc| {
            b.iter(|| {
                crypto
                    .decrypt_message(enc, &key_pair2, &key_pair1.exchange_public_bytes())
                    .unwrap()
            })
        });
    }

    group.finish();
}

fn bench_signing_verification(c: &mut Criterion) {
    let mut group = c.benchmark_group("signing_verification");

    let message_sizes = vec![32, 256, 1024, 4096, 16384];
    let crypto = HybridCrypto::new(CryptoMode::Traditional);
    let key_pair = KeyPair::generate();

    for size in message_sizes {
        let message = vec![0u8; size];

        group.throughput(Throughput::Bytes(size as u64));

        group.bench_with_input(BenchmarkId::new("sign", size), &message, |b, msg| {
            b.iter(|| crypto.sign_message(msg, &key_pair).unwrap())
        });

        let signature = crypto.sign_message(&message, &key_pair).unwrap();

        group.bench_with_input(
            BenchmarkId::new("verify", size),
            &(message, signature),
            |b, (msg, sig)| {
                b.iter(|| {
                    crypto
                        .verify_message(msg, sig, &key_pair.verifying_key_bytes())
                        .unwrap()
                })
            },
        );
    }

    group.finish();
}

fn bench_hashing(c: &mut Criterion) {
    let mut group = c.benchmark_group("hashing");

    let message_sizes = vec![32, 256, 1024, 4096, 16384, 65536, 262144];
    let crypto = HybridCrypto::new(CryptoMode::Traditional);

    for size in message_sizes {
        let message = vec![0u8; size];

        group.throughput(Throughput::Bytes(size as u64));

        group.bench_with_input(BenchmarkId::new("blake3_hash", size), &message, |b, msg| {
            b.iter(|| crypto.hash_data(msg))
        });
    }

    group.finish();
}

fn bench_key_derivation(c: &mut Criterion) {
    let mut group = c.benchmark_group("key_derivation");

    let crypto = HybridCrypto::new(CryptoMode::Hybrid);
    let key_pair1 = KeyPair::generate();
    let key_pair2 = KeyPair::generate();

    group.bench_function("shared_secret_derivation", |b| {
        b.iter(|| {
            crypto
                .derive_shared_secret(&key_pair1, &key_pair2.exchange_public_bytes())
                .unwrap()
        })
    });

    let passwords = vec![
        "password",
        "super_secure_password_123",
        "very_long_password_with_lots_of_characters_for_testing",
    ];
    let salt = b"test_salt_value";

    for password in passwords {
        group.bench_with_input(
            BenchmarkId::new("pbkdf2_key_derivation", password.len()),
            &password,
            |b, pwd| b.iter(|| crypto.generate_key_from_password(pwd, salt).unwrap()),
        );
    }

    group.finish();
}

fn bench_crypto_modes_comparison(c: &mut Criterion) {
    let mut group = c.benchmark_group("crypto_modes_comparison");

    let modes = vec![
        CryptoMode::Traditional,
        CryptoMode::Hybrid,
        CryptoMode::QuantumResistant,
    ];

    let message = vec![0u8; 1024];

    for mode in modes {
        let crypto = HybridCrypto::new(mode.clone());
        let key_pair1 = KeyPair::generate();
        let key_pair2 = KeyPair::generate();

        group.bench_with_input(
            BenchmarkId::new("full_encrypt_decrypt", format!("{:?}", mode)),
            &mode,
            |b, _| {
                b.iter(|| {
                    let encrypted = crypto
                        .encrypt_message(&message, &key_pair1, &key_pair2.exchange_public_bytes())
                        .unwrap();

                    crypto
                        .decrypt_message(&encrypted, &key_pair2, &key_pair1.exchange_public_bytes())
                        .unwrap()
                })
            },
        );

        group.bench_with_input(
            BenchmarkId::new("full_sign_verify", format!("{:?}", mode)),
            &mode,
            |b, _| {
                b.iter(|| {
                    let signature = crypto.sign_message(&message, &key_pair1).unwrap();
                    crypto
                        .verify_message(&message, &signature, &key_pair1.verifying_key_bytes())
                        .unwrap()
                })
            },
        );
    }

    group.finish();
}

fn bench_session_key_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("session_key_operations");

    group.bench_function("session_key_generation", |b| {
        b.iter(|| SessionKey::generate())
    });

    group.bench_function("session_key_expiration_check", |b| {
        let session_key = SessionKey::generate();
        b.iter(|| session_key.is_expired())
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_key_generation,
    bench_crypto_modes,
    bench_encryption_decryption,
    bench_signing_verification,
    bench_hashing,
    bench_key_derivation,
    bench_crypto_modes_comparison,
    bench_session_key_operations
);

criterion_main!(benches);
