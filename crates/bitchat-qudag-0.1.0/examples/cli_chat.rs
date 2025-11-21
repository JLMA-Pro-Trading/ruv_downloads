//! CLI Chat Application using BitChat-QuDAG
//!
//! This example demonstrates how to create a simple command-line chat application
//! using the BitChat-QuDAG library.
//!
//! Usage:
//!   cargo run --example cli_chat
//!
//! Commands:
//!   /connect <peer_id>    - Connect to a peer
//!   /disconnect <peer_id> - Disconnect from a peer
//!   /peers                - List connected peers
//!   /subscribe <topic>    - Subscribe to a topic
//!   /unsubscribe <topic>  - Unsubscribe from a topic
//!   /publish <topic> <msg> - Publish message to topic
//!   /stats                - Show messaging statistics
//!   /help                 - Show this help
//!   /quit                 - Exit the chat

use bitchat_qudag::{
    crypto::CryptoMode, transport::TransportType, BitChatConfig, BitChatMessaging, QuDAGMessaging,
};
use std::io::{self, Write};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::mpsc;
use tokio::time::{timeout, Duration};

#[derive(Debug)]
enum Command {
    Connect(String),
    Disconnect(String),
    Peers,
    Subscribe(String),
    Unsubscribe(String),
    Publish(String, String),
    Stats,
    Help,
    Quit,
    Message(String),
}

impl Command {
    fn parse(input: &str) -> Self {
        let trimmed = input.trim();

        if trimmed.starts_with('/') {
            let parts: Vec<&str> = trimmed[1..].split_whitespace().collect();
            match parts.get(0) {
                Some(&"connect") => {
                    if let Some(peer_id) = parts.get(1) {
                        Command::Connect(peer_id.to_string())
                    } else {
                        Command::Help
                    }
                }
                Some(&"disconnect") => {
                    if let Some(peer_id) = parts.get(1) {
                        Command::Disconnect(peer_id.to_string())
                    } else {
                        Command::Help
                    }
                }
                Some(&"peers") => Command::Peers,
                Some(&"subscribe") => {
                    if let Some(topic) = parts.get(1) {
                        Command::Subscribe(topic.to_string())
                    } else {
                        Command::Help
                    }
                }
                Some(&"unsubscribe") => {
                    if let Some(topic) = parts.get(1) {
                        Command::Unsubscribe(topic.to_string())
                    } else {
                        Command::Help
                    }
                }
                Some(&"publish") => {
                    if let (Some(topic), Some(message)) = (parts.get(1), parts.get(2)) {
                        let msg = parts[2..].join(" ");
                        Command::Publish(topic.to_string(), msg)
                    } else {
                        Command::Help
                    }
                }
                Some(&"stats") => Command::Stats,
                Some(&"help") => Command::Help,
                Some(&"quit") => Command::Quit,
                _ => Command::Help,
            }
        } else {
            Command::Message(trimmed.to_string())
        }
    }
}

struct ChatApp {
    messaging: BitChatMessaging,
    current_peer: Option<String>,
    subscribed_topics: Vec<String>,
}

impl ChatApp {
    async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let config = BitChatConfig::builder()
            .enabled(true)
            .auto_start(true)
            .enable_metrics(true)
            .verbose_logging(true)
            .crypto_mode(CryptoMode::Hybrid)
            .enable_compression(true)
            .enable_store_forward(true)
            .build();

        let messaging = BitChatMessaging::new(config).await?;

        Ok(Self {
            messaging,
            current_peer: None,
            subscribed_topics: Vec::new(),
        })
    }

    async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.messaging.start().await?;

        println!("🚀 BitChat-QuDAG CLI Chat Started!");
        println!("📡 Your Peer ID: {}", self.messaging.local_peer_id());
        println!("💡 Type /help for commands");
        println!("---");

        Ok(())
    }

    async fn handle_command(
        &mut self,
        command: Command,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        match command {
            Command::Connect(peer_id) => {
                println!("🔗 Connecting to peer: {}", peer_id);
                match self.messaging.connect_peer(&peer_id).await {
                    Ok(connected_id) => {
                        self.current_peer = Some(connected_id.clone());
                        println!("✅ Connected to peer: {}", connected_id);
                    }
                    Err(e) => println!("❌ Failed to connect: {}", e),
                }
            }

            Command::Disconnect(peer_id) => {
                println!("🔌 Disconnecting from peer: {}", peer_id);
                match self.messaging.disconnect_peer(&peer_id).await {
                    Ok(_) => {
                        if Some(&peer_id) == self.current_peer.as_ref() {
                            self.current_peer = None;
                        }
                        println!("✅ Disconnected from peer: {}", peer_id);
                    }
                    Err(e) => println!("❌ Failed to disconnect: {}", e),
                }
            }

            Command::Peers => {
                println!("👥 Connected Peers:");
                match self.messaging.get_connected_peers().await {
                    Ok(peers) => {
                        if peers.is_empty() {
                            println!("  (No connected peers)");
                        } else {
                            for peer in peers {
                                println!(
                                    "  📍 {} [{}] - {} msgs sent, {} msgs received",
                                    peer.id,
                                    peer.transport_type,
                                    peer.messages_sent,
                                    peer.messages_received
                                );
                            }
                        }
                    }
                    Err(e) => println!("❌ Failed to get peers: {}", e),
                }
            }

            Command::Subscribe(topic) => {
                println!("📢 Subscribing to topic: {}", topic);
                match self.messaging.subscribe_topic(&topic).await {
                    Ok(_) => {
                        self.subscribed_topics.push(topic.clone());
                        println!("✅ Subscribed to topic: {}", topic);
                    }
                    Err(e) => println!("❌ Failed to subscribe: {}", e),
                }
            }

            Command::Unsubscribe(topic) => {
                println!("🔕 Unsubscribing from topic: {}", topic);
                match self.messaging.unsubscribe_topic(&topic).await {
                    Ok(_) => {
                        self.subscribed_topics.retain(|t| t != &topic);
                        println!("✅ Unsubscribed from topic: {}", topic);
                    }
                    Err(e) => println!("❌ Failed to unsubscribe: {}", e),
                }
            }

            Command::Publish(topic, message) => {
                println!("📡 Publishing to topic '{}': {}", topic, message);
                match self
                    .messaging
                    .publish_message(&topic, message.as_bytes())
                    .await
                {
                    Ok(_) => println!("✅ Message published to topic: {}", topic),
                    Err(e) => println!("❌ Failed to publish: {}", e),
                }
            }

            Command::Stats => {
                println!("📊 Messaging Statistics:");
                match self.messaging.get_stats().await {
                    Ok(stats) => {
                        println!("  📤 Messages sent: {}", stats.total_messages_sent);
                        println!("  📥 Messages received: {}", stats.total_messages_received);
                        println!("  🔗 Active connections: {}", stats.active_connections);
                        println!("  ⏱️  Uptime: {} seconds", stats.uptime_seconds);
                        println!("  📋 Subscribed topics: {}", stats.topics_subscribed);
                        println!("  ⚡ Average latency: {:.2} ms", stats.average_latency_ms);
                    }
                    Err(e) => println!("❌ Failed to get stats: {}", e),
                }
            }

            Command::Help => {
                println!("📖 Available Commands:");
                println!("  /connect <peer_id>     - Connect to a peer");
                println!("  /disconnect <peer_id>  - Disconnect from a peer");
                println!("  /peers                 - List connected peers");
                println!("  /subscribe <topic>     - Subscribe to a topic");
                println!("  /unsubscribe <topic>   - Unsubscribe from a topic");
                println!("  /publish <topic> <msg> - Publish message to topic");
                println!("  /stats                 - Show messaging statistics");
                println!("  /help                  - Show this help");
                println!("  /quit                  - Exit the chat");
                println!("  Any other text will be sent as a direct message to the current peer");
            }

            Command::Message(message) => {
                if let Some(peer_id) = &self.current_peer {
                    println!("💬 Sending to {}: {}", peer_id, message);
                    match self
                        .messaging
                        .send_message(peer_id, message.as_bytes())
                        .await
                    {
                        Ok(_) => println!("✅ Message sent"),
                        Err(e) => println!("❌ Failed to send message: {}", e),
                    }
                } else {
                    println!("⚠️  No peer selected. Use /connect <peer_id> first or /publish <topic> <message>");
                }
            }

            Command::Quit => {
                println!("👋 Goodbye!");
                return Ok(true);
            }
        }

        Ok(false)
    }

    async fn message_listener(&mut self) {
        loop {
            match timeout(Duration::from_millis(100), self.messaging.receive_message()).await {
                Ok(Ok(Some(message))) => {
                    if let Some(topic) = &message.topic {
                        println!(
                            "\n📢 Topic '{}' from {}: {}",
                            topic,
                            message.sender,
                            String::from_utf8_lossy(&message.data)
                        );
                    } else {
                        println!(
                            "\n💬 Direct message from {}: {}",
                            message.sender,
                            String::from_utf8_lossy(&message.data)
                        );
                    }
                    print!("> ");
                    io::stdout().flush().unwrap();
                }
                Ok(Ok(None)) => {
                    // No message available
                }
                Ok(Err(e)) => {
                    println!("\n❌ Error receiving message: {}", e);
                }
                Err(_) => {
                    // Timeout, continue
                }
            }
        }
    }

    async fn run(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.start().await?;

        let stdin = tokio::io::stdin();
        let mut reader = BufReader::new(stdin);
        let mut line = String::new();

        // Start message listener
        let (tx, mut rx) = mpsc::channel(1);

        tokio::spawn(async move {
            // This would be the message listener in a real implementation
            // For now, we'll just simulate it
            loop {
                tokio::time::sleep(Duration::from_secs(1)).await;
                if tx.send(()).await.is_err() {
                    break;
                }
            }
        });

        loop {
            print!("> ");
            io::stdout().flush().unwrap();

            tokio::select! {
                result = reader.read_line(&mut line) => {
                    match result {
                        Ok(0) => break, // EOF
                        Ok(_) => {
                            let command = Command::parse(&line);
                            let should_quit = self.handle_command(command).await?;
                            if should_quit {
                                break;
                            }
                            line.clear();
                        }
                        Err(e) => {
                            println!("❌ Error reading input: {}", e);
                            break;
                        }
                    }
                }
                _ = rx.recv() => {
                    // Handle incoming messages
                    self.message_listener().await;
                }
            }
        }

        self.messaging.stop().await?;
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    bitchat_qudag::init_logging();

    let mut app = ChatApp::new().await?;
    app.run().await?;

    Ok(())
}
