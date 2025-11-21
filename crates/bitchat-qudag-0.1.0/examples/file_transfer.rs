//! File Transfer Example using BitChat-QuDAG
//!
//! This example demonstrates how to transfer files between peers using the
//! BitChat-QuDAG library with chunked transfer and progress tracking.
//!
//! Usage:
//!   cargo run --example file_transfer -- send <file_path> <peer_id>
//!   cargo run --example file_transfer -- receive <output_dir>
//!   cargo run --example file_transfer -- server

use bitchat_qudag::{
    crypto::CryptoMode, transport::TransportType, BitChatConfig, BitChatMessaging, QuDAGMessaging,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tokio::time::{timeout, Duration};
use uuid::Uuid;

const CHUNK_SIZE: usize = 64 * 1024; // 64KB chunks
const TRANSFER_TIMEOUT: Duration = Duration::from_secs(300); // 5 minutes

#[derive(Debug, Clone, Serialize, Deserialize)]
enum FileTransferMessage {
    TransferRequest {
        file_id: String,
        filename: String,
        file_size: u64,
        chunk_count: u32,
        checksum: String,
    },
    TransferResponse {
        file_id: String,
        accepted: bool,
        reason: Option<String>,
    },
    ChunkData {
        file_id: String,
        chunk_index: u32,
        data: Vec<u8>,
        checksum: String,
    },
    ChunkAck {
        file_id: String,
        chunk_index: u32,
        success: bool,
    },
    TransferComplete {
        file_id: String,
        success: bool,
        message: String,
    },
    TransferCancel {
        file_id: String,
        reason: String,
    },
}

struct FileTransferSender {
    messaging: BitChatMessaging,
    active_transfers: HashMap<String, TransferState>,
}

struct FileTransferReceiver {
    messaging: BitChatMessaging,
    output_dir: PathBuf,
    active_transfers: HashMap<String, ReceiveState>,
}

#[derive(Debug)]
struct TransferState {
    file_path: PathBuf,
    file_size: u64,
    chunk_count: u32,
    chunks_sent: u32,
    chunks_acked: u32,
    peer_id: String,
    start_time: std::time::Instant,
}

#[derive(Debug)]
struct ReceiveState {
    filename: String,
    file_size: u64,
    chunk_count: u32,
    chunks_received: HashMap<u32, Vec<u8>>,
    sender_id: String,
    start_time: std::time::Instant,
}

impl FileTransferSender {
    async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let config = BitChatConfig::builder()
            .enabled(true)
            .auto_start(true)
            .max_message_size(CHUNK_SIZE + 1024) // Extra space for metadata
            .enable_compression(true)
            .crypto_mode(CryptoMode::Hybrid)
            .build();

        let messaging = BitChatMessaging::new(config).await?;

        Ok(Self {
            messaging,
            active_transfers: HashMap::new(),
        })
    }

    async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.messaging.start().await?;
        println!("📡 File Transfer Sender started");
        println!("🆔 Peer ID: {}", self.messaging.local_peer_id());
        Ok(())
    }

    async fn send_file(
        &mut self,
        file_path: &Path,
        peer_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let file_id = Uuid::new_v4().to_string();
        let filename = file_path
            .file_name()
            .ok_or("Invalid file path")?
            .to_string_lossy()
            .to_string();

        let mut file = File::open(file_path)?;
        let file_size = file.metadata()?.len();
        let chunk_count = ((file_size + CHUNK_SIZE as u64 - 1) / CHUNK_SIZE as u64) as u32;

        // Calculate file checksum
        let mut hasher = blake3::Hasher::new();
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;
        hasher.update(&buffer);
        let checksum = hasher.finalize().to_hex().to_string();

        println!(
            "📤 Sending file: {} ({} bytes, {} chunks)",
            filename, file_size, chunk_count
        );

        // Send transfer request
        let request = FileTransferMessage::TransferRequest {
            file_id: file_id.clone(),
            filename: filename.clone(),
            file_size,
            chunk_count,
            checksum,
        };

        let request_data = serde_json::to_vec(&request)?;
        self.messaging.send_message(peer_id, &request_data).await?;

        // Store transfer state
        let transfer_state = TransferState {
            file_path: file_path.to_path_buf(),
            file_size,
            chunk_count,
            chunks_sent: 0,
            chunks_acked: 0,
            peer_id: peer_id.to_string(),
            start_time: std::time::Instant::now(),
        };

        self.active_transfers
            .insert(file_id.clone(), transfer_state);

        println!("⏳ Waiting for transfer response...");

        // Wait for response and handle transfer
        self.handle_transfer_response(&file_id, &buffer).await?;

        Ok(())
    }

    async fn handle_transfer_response(
        &mut self,
        file_id: &str,
        file_data: &[u8],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let timeout_duration = TRANSFER_TIMEOUT;
        let start_time = std::time::Instant::now();

        while start_time.elapsed() < timeout_duration {
            if let Ok(Some(message)) =
                timeout(Duration::from_secs(1), self.messaging.receive_message()).await
            {
                if let Ok(transfer_msg) =
                    serde_json::from_slice::<FileTransferMessage>(&message.data)
                {
                    match transfer_msg {
                        FileTransferMessage::TransferResponse {
                            file_id: resp_id,
                            accepted,
                            reason,
                        } => {
                            if resp_id == file_id {
                                if accepted {
                                    println!("✅ Transfer accepted, starting file transfer...");
                                    self.send_file_chunks(file_id, file_data).await?;
                                } else {
                                    println!(
                                        "❌ Transfer rejected: {}",
                                        reason.unwrap_or("Unknown reason".to_string())
                                    );
                                    self.active_transfers.remove(file_id);
                                }
                                return Ok(());
                            }
                        }
                        FileTransferMessage::ChunkAck {
                            file_id: ack_id,
                            chunk_index,
                            success,
                        } => {
                            if ack_id == file_id && success {
                                if let Some(state) = self.active_transfers.get_mut(file_id) {
                                    state.chunks_acked += 1;

                                    let progress = (state.chunks_acked as f64
                                        / state.chunk_count as f64)
                                        * 100.0;
                                    println!(
                                        "📊 Progress: {:.1}% ({}/{})",
                                        progress, state.chunks_acked, state.chunk_count
                                    );

                                    if state.chunks_acked == state.chunk_count {
                                        let elapsed = state.start_time.elapsed();
                                        let throughput =
                                            state.file_size as f64 / elapsed.as_secs_f64();
                                        println!("✅ Transfer complete! Elapsed: {:?}, Throughput: {:.2} KB/s", 
                                            elapsed, throughput / 1024.0);

                                        // Send completion message
                                        let complete_msg = FileTransferMessage::TransferComplete {
                                            file_id: file_id.to_string(),
                                            success: true,
                                            message: "Transfer completed successfully".to_string(),
                                        };

                                        let complete_data = serde_json::to_vec(&complete_msg)?;
                                        self.messaging
                                            .send_message(&state.peer_id, &complete_data)
                                            .await?;

                                        self.active_transfers.remove(file_id);
                                        return Ok(());
                                    }
                                }
                            }
                        }
                        FileTransferMessage::TransferCancel {
                            file_id: cancel_id,
                            reason,
                        } => {
                            if cancel_id == file_id {
                                println!("❌ Transfer cancelled: {}", reason);
                                self.active_transfers.remove(file_id);
                                return Ok(());
                            }
                        }
                        _ => {}
                    }
                }
            }
        }

        println!("⏰ Transfer timed out");
        self.active_transfers.remove(file_id);
        Ok(())
    }

    async fn send_file_chunks(
        &mut self,
        file_id: &str,
        file_data: &[u8],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let state = self
            .active_transfers
            .get_mut(file_id)
            .ok_or("Transfer not found")?;

        for chunk_index in 0..state.chunk_count {
            let start = (chunk_index as usize) * CHUNK_SIZE;
            let end = std::cmp::min(start + CHUNK_SIZE, file_data.len());
            let chunk_data = &file_data[start..end];

            // Calculate chunk checksum
            let mut hasher = blake3::Hasher::new();
            hasher.update(chunk_data);
            let checksum = hasher.finalize().to_hex().to_string();

            let chunk_msg = FileTransferMessage::ChunkData {
                file_id: file_id.to_string(),
                chunk_index,
                data: chunk_data.to_vec(),
                checksum,
            };

            let chunk_data_bytes = serde_json::to_vec(&chunk_msg)?;
            self.messaging
                .send_message(&state.peer_id, &chunk_data_bytes)
                .await?;

            state.chunks_sent += 1;

            // Add small delay to prevent overwhelming the receiver
            tokio::time::sleep(Duration::from_millis(10)).await;
        }

        Ok(())
    }

    async fn stop(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.messaging.stop().await?;
        Ok(())
    }
}

impl FileTransferReceiver {
    async fn new(output_dir: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let config = BitChatConfig::builder()
            .enabled(true)
            .auto_start(true)
            .max_message_size(CHUNK_SIZE + 1024)
            .enable_compression(true)
            .crypto_mode(CryptoMode::Hybrid)
            .build();

        let messaging = BitChatMessaging::new(config).await?;

        // Create output directory if it doesn't exist
        std::fs::create_dir_all(&output_dir)?;

        Ok(Self {
            messaging,
            output_dir,
            active_transfers: HashMap::new(),
        })
    }

    async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.messaging.start().await?;
        println!("📡 File Transfer Receiver started");
        println!("🆔 Peer ID: {}", self.messaging.local_peer_id());
        println!("📁 Output directory: {}", self.output_dir.display());
        Ok(())
    }

    async fn listen(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("👂 Listening for file transfers...");

        loop {
            if let Ok(Some(message)) = self.messaging.receive_message().await {
                if let Ok(transfer_msg) =
                    serde_json::from_slice::<FileTransferMessage>(&message.data)
                {
                    match transfer_msg {
                        FileTransferMessage::TransferRequest {
                            file_id,
                            filename,
                            file_size,
                            chunk_count,
                            checksum,
                        } => {
                            println!(
                                "📥 Transfer request received: {} ({} bytes)",
                                filename, file_size
                            );

                            // Auto-accept transfers (in real app, might want user confirmation)
                            let response = FileTransferMessage::TransferResponse {
                                file_id: file_id.clone(),
                                accepted: true,
                                reason: None,
                            };

                            let response_data = serde_json::to_vec(&response)?;
                            self.messaging
                                .send_message(&message.sender, &response_data)
                                .await?;

                            // Create receive state
                            let receive_state = ReceiveState {
                                filename,
                                file_size,
                                chunk_count,
                                chunks_received: HashMap::new(),
                                sender_id: message.sender,
                                start_time: std::time::Instant::now(),
                            };

                            self.active_transfers.insert(file_id, receive_state);
                            println!("✅ Transfer accepted, waiting for chunks...");
                        }

                        FileTransferMessage::ChunkData {
                            file_id,
                            chunk_index,
                            data,
                            checksum,
                        } => {
                            if let Some(state) = self.active_transfers.get_mut(&file_id) {
                                // Verify chunk checksum
                                let mut hasher = blake3::Hasher::new();
                                hasher.update(&data);
                                let calculated_checksum = hasher.finalize().to_hex().to_string();

                                let success = calculated_checksum == checksum;

                                if success {
                                    state.chunks_received.insert(chunk_index, data);

                                    let progress = (state.chunks_received.len() as f64
                                        / state.chunk_count as f64)
                                        * 100.0;
                                    println!(
                                        "📊 Progress: {:.1}% ({}/{})",
                                        progress,
                                        state.chunks_received.len(),
                                        state.chunk_count
                                    );

                                    // Check if all chunks received
                                    if state.chunks_received.len() == state.chunk_count as usize {
                                        self.complete_transfer(&file_id).await?;
                                    }
                                }

                                // Send acknowledgment
                                let ack = FileTransferMessage::ChunkAck {
                                    file_id: file_id.clone(),
                                    chunk_index,
                                    success,
                                };

                                let ack_data = serde_json::to_vec(&ack)?;
                                self.messaging
                                    .send_message(&state.sender_id, &ack_data)
                                    .await?;
                            }
                        }

                        FileTransferMessage::TransferComplete {
                            file_id,
                            success,
                            message,
                        } => {
                            if success {
                                println!("✅ Transfer completed: {}", message);
                            } else {
                                println!("❌ Transfer failed: {}", message);
                            }
                            self.active_transfers.remove(&file_id);
                        }

                        _ => {}
                    }
                }
            }
        }
    }

    async fn complete_transfer(&mut self, file_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(state) = self.active_transfers.remove(file_id) {
            let output_path = self.output_dir.join(&state.filename);
            let mut output_file = File::create(&output_path)?;

            // Write chunks in order
            for chunk_index in 0..state.chunk_count {
                if let Some(chunk_data) = state.chunks_received.get(&chunk_index) {
                    output_file.write_all(chunk_data)?;
                } else {
                    return Err(format!("Missing chunk {}", chunk_index).into());
                }
            }

            output_file.flush()?;

            let elapsed = state.start_time.elapsed();
            let throughput = state.file_size as f64 / elapsed.as_secs_f64();

            println!("💾 File saved: {}", output_path.display());
            println!(
                "⏱️  Elapsed: {:?}, Throughput: {:.2} KB/s",
                elapsed,
                throughput / 1024.0
            );
        }

        Ok(())
    }

    async fn stop(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.messaging.stop().await?;
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    bitchat_qudag::init_logging();

    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage:");
        eprintln!("  {} send <file_path> <peer_id>", args[0]);
        eprintln!("  {} receive <output_dir>", args[0]);
        return Ok(());
    }

    match args[1].as_str() {
        "send" => {
            if args.len() != 4 {
                eprintln!("Usage: {} send <file_path> <peer_id>", args[0]);
                return Ok(());
            }

            let file_path = Path::new(&args[2]);
            let peer_id = &args[3];

            if !file_path.exists() {
                eprintln!("❌ File not found: {}", file_path.display());
                return Ok(());
            }

            let mut sender = FileTransferSender::new().await?;
            sender.start().await?;
            sender.send_file(file_path, peer_id).await?;
            sender.stop().await?;
        }

        "receive" => {
            if args.len() != 3 {
                eprintln!("Usage: {} receive <output_dir>", args[0]);
                return Ok(());
            }

            let output_dir = PathBuf::from(&args[2]);

            let mut receiver = FileTransferReceiver::new(output_dir).await?;
            receiver.start().await?;
            receiver.listen().await?;
            receiver.stop().await?;
        }

        _ => {
            eprintln!("❌ Unknown command: {}", args[1]);
            eprintln!("Available commands: send, receive");
        }
    }

    Ok(())
}
