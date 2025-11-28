//! Messaging performance benchmarks

use bitchat_qudag::{
    crypto::CryptoMode, transport::TransportType, BitChatConfig, BitChatMessaging, QuDAGMessaging,
};
use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use std::time::Duration;
use tokio::runtime::Runtime;

fn bench_messaging_creation(c: &mut Criterion) {
    let mut group = c.benchmark_group("messaging_creation");

    let rt = Runtime::new().unwrap();

    group.bench_function("bitchat_messaging_new", |b| {
        b.to_async(&rt).iter(|| async {
            let config = BitChatConfig::development();
            BitChatMessaging::new(config).await.unwrap()
        })
    });

    group.bench_function("bitchat_messaging_start_stop", |b| {
        b.to_async(&rt).iter(|| async {
            let config = BitChatConfig::development();
            let mut messaging = BitChatMessaging::new(config).await.unwrap();
            messaging.start().await.unwrap();
            messaging.stop().await.unwrap();
        })
    });

    group.finish();
}

fn bench_message_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("message_throughput");

    let rt = Runtime::new().unwrap();
    let message_sizes = vec![32, 256, 1024, 4096, 16384, 65536];

    for size in message_sizes {
        let message = vec![0u8; size];

        group.throughput(Throughput::Bytes(size as u64));

        group.bench_with_input(
            BenchmarkId::new("send_message", size),
            &message,
            |b, msg| {
                b.to_async(&rt).iter(|| async {
                    let config = BitChatConfig::development();
                    let mut messaging = BitChatMessaging::new(config).await.unwrap();
                    messaging.start().await.unwrap();

                    let peer_id = messaging.local_peer_id();
                    let result = messaging.send_message(&peer_id, msg).await;

                    messaging.stop().await.unwrap();
                    result.unwrap()
                })
            },
        );
    }

    group.finish();
}

fn bench_transport_performance(c: &mut Criterion) {
    let mut group = c.benchmark_group("transport_performance");

    let rt = Runtime::new().unwrap();
    let transports = vec![
        TransportType::WebSocket,
        TransportType::LocalNetwork,
        TransportType::InternetP2P,
    ];

    for transport in transports {
        group.bench_with_input(
            BenchmarkId::new("transport_startup", format!("{:?}", transport)),
            &transport,
            |b, t| {
                b.to_async(&rt).iter(|| async {
                    let config = BitChatConfig::custom(vec![t.clone()], CryptoMode::Traditional);
                    let mut messaging = BitChatMessaging::new(config).await.unwrap();
                    messaging.start().await.unwrap();
                    messaging.stop().await.unwrap();
                })
            },
        );
    }

    group.finish();
}

fn bench_crypto_mode_performance(c: &mut Criterion) {
    let mut group = c.benchmark_group("crypto_mode_performance");

    let rt = Runtime::new().unwrap();
    let modes = vec![
        CryptoMode::Traditional,
        CryptoMode::Hybrid,
        CryptoMode::QuantumResistant,
    ];

    let message = vec![0u8; 1024];

    for mode in modes {
        group.bench_with_input(
            BenchmarkId::new("encrypted_message", format!("{:?}", mode)),
            &mode,
            |b, m| {
                b.to_async(&rt).iter(|| async {
                    let config = BitChatConfig::builder()
                        .crypto_mode(m.clone())
                        .require_encryption(true)
                        .build();
                    let mut messaging = BitChatMessaging::new(config).await.unwrap();
                    messaging.start().await.unwrap();

                    let peer_id = messaging.local_peer_id();
                    let result = messaging.send_message(&peer_id, &message).await;

                    messaging.stop().await.unwrap();
                    result.unwrap()
                })
            },
        );
    }

    group.finish();
}

fn bench_topic_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("topic_operations");

    let rt = Runtime::new().unwrap();

    group.bench_function("topic_subscription", |b| {
        b.to_async(&rt).iter(|| async {
            let config = BitChatConfig::development();
            let mut messaging = BitChatMessaging::new(config).await.unwrap();
            messaging.start().await.unwrap();

            messaging.subscribe_topic("test-topic").await.unwrap();
            messaging.unsubscribe_topic("test-topic").await.unwrap();

            messaging.stop().await.unwrap();
        })
    });

    group.bench_function("topic_message_publish", |b| {
        b.to_async(&rt).iter(|| async {
            let config = BitChatConfig::development();
            let mut messaging = BitChatMessaging::new(config).await.unwrap();
            messaging.start().await.unwrap();

            let message = b"Topic message";
            messaging
                .publish_message("test-topic", message)
                .await
                .unwrap();

            messaging.stop().await.unwrap();
        })
    });

    group.finish();
}

fn bench_concurrent_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("concurrent_operations");

    let rt = Runtime::new().unwrap();
    let concurrent_counts = vec![1, 2, 4, 8, 16];

    for count in concurrent_counts {
        group.bench_with_input(
            BenchmarkId::new("concurrent_sends", count),
            &count,
            |b, &cnt| {
                b.to_async(&rt).iter(|| async move {
                    let config = BitChatConfig::development();
                    let mut messaging = BitChatMessaging::new(config).await.unwrap();
                    messaging.start().await.unwrap();

                    let peer_id = messaging.local_peer_id();
                    let message = b"Concurrent message";

                    let handles = (0..cnt).map(|_| {
                        let peer_id = peer_id.clone();
                        let messaging = &messaging;
                        async move { messaging.send_message(&peer_id, message).await.unwrap() }
                    });

                    futures::future::join_all(handles).await;

                    messaging.stop().await.unwrap();
                })
            },
        );
    }

    group.finish();
}

fn bench_stats_collection(c: &mut Criterion) {
    let mut group = c.benchmark_group("stats_collection");

    let rt = Runtime::new().unwrap();

    group.bench_function("get_messaging_stats", |b| {
        b.to_async(&rt).iter(|| async {
            let config = BitChatConfig::development();
            let mut messaging = BitChatMessaging::new(config).await.unwrap();
            messaging.start().await.unwrap();

            let _stats = messaging.get_stats().await.unwrap();

            messaging.stop().await.unwrap();
        })
    });

    group.bench_function("get_connected_peers", |b| {
        b.to_async(&rt).iter(|| async {
            let config = BitChatConfig::development();
            let mut messaging = BitChatMessaging::new(config).await.unwrap();
            messaging.start().await.unwrap();

            let _peers = messaging.get_connected_peers().await.unwrap();

            messaging.stop().await.unwrap();
        })
    });

    group.finish();
}

fn bench_message_queue_performance(c: &mut Criterion) {
    let mut group = c.benchmark_group("message_queue_performance");

    let rt = Runtime::new().unwrap();
    let queue_sizes = vec![100, 1000, 10000];

    for size in queue_sizes {
        group.bench_with_input(
            BenchmarkId::new("queue_fill", size),
            &size,
            |b, &queue_size| {
                b.to_async(&rt).iter(|| async move {
                    let config = BitChatConfig::builder()
                        .message_queue_size(queue_size)
                        .build();
                    let mut messaging = BitChatMessaging::new(config).await.unwrap();
                    messaging.start().await.unwrap();

                    let peer_id = messaging.local_peer_id();
                    let message = b"Queue message";

                    // Fill queue with messages
                    for _ in 0..queue_size.min(100) {
                        let _ = messaging.send_message(&peer_id, message).await;
                    }

                    messaging.stop().await.unwrap();
                })
            },
        );
    }

    group.finish();
}

fn bench_compression_performance(c: &mut Criterion) {
    let mut group = c.benchmark_group("compression_performance");

    let rt = Runtime::new().unwrap();
    let message_sizes = vec![1024, 4096, 16384, 65536];

    for size in message_sizes {
        // Create compressible message
        let message = format!("This is a test message that should compress well. ")
            .repeat(size / 50)
            .into_bytes();

        group.throughput(Throughput::Bytes(message.len() as u64));

        group.bench_with_input(
            BenchmarkId::new("compressed_message", size),
            &message,
            |b, msg| {
                b.to_async(&rt).iter(|| async {
                    let config = BitChatConfig::builder()
                        .enable_compression(true)
                        .compression_level(6)
                        .build();
                    let mut messaging = BitChatMessaging::new(config).await.unwrap();
                    messaging.start().await.unwrap();

                    let peer_id = messaging.local_peer_id();
                    let result = messaging.send_message(&peer_id, msg).await;

                    messaging.stop().await.unwrap();
                    result.unwrap()
                })
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_messaging_creation,
    bench_message_throughput,
    bench_transport_performance,
    bench_crypto_mode_performance,
    bench_topic_operations,
    bench_concurrent_operations,
    bench_stats_collection,
    bench_message_queue_performance,
    bench_compression_performance
);

criterion_main!(benches);
