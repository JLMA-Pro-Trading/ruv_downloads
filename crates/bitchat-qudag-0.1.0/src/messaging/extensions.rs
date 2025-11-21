//! Protocol extensions for enhanced messaging features

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::config::BitChatConfig;
use crate::error::{BitChatError, Result};
use crate::messaging::{MessagePriority, MessageType, ReceivedMessage};

/// Message reaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageReaction {
    /// Reaction ID
    pub id: String,
    /// Message ID being reacted to
    pub message_id: String,
    /// User who reacted
    pub user_id: String,
    /// Reaction type (emoji or custom)
    pub reaction_type: String,
    /// Timestamp
    pub timestamp: SystemTime,
}

/// Thread message for conversation threading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadMessage {
    /// Thread ID
    pub thread_id: String,
    /// Parent message ID (start of thread)
    pub parent_message_id: String,
    /// Message in thread
    pub message: ReceivedMessage,
    /// Thread depth
    pub depth: u32,
}

/// Typing indicator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypingIndicator {
    /// User who is typing
    pub user_id: String,
    /// Conversation/channel where typing
    pub conversation_id: String,
    /// When typing started
    pub started_at: SystemTime,
}

/// Read receipt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadReceipt {
    /// User who read the message
    pub user_id: String,
    /// Message IDs that were read
    pub message_ids: Vec<String>,
    /// When messages were read
    pub read_at: SystemTime,
}

/// File transfer metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTransferMetadata {
    /// File ID
    pub file_id: String,
    /// Original filename
    pub filename: String,
    /// File size in bytes
    pub size: u64,
    /// MIME type
    pub mime_type: String,
    /// SHA-256 hash
    pub hash: String,
    /// Thumbnail data (for images/videos)
    pub thumbnail: Option<Vec<u8>>,
    /// Transfer chunks
    pub chunks: Vec<FileChunk>,
}

/// File chunk for transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChunk {
    /// Chunk index
    pub index: u32,
    /// Total chunks
    pub total: u32,
    /// Chunk data
    pub data: Vec<u8>,
    /// Chunk hash
    pub hash: String,
}

/// Voice message metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceMessageMetadata {
    /// Duration in seconds
    pub duration: f32,
    /// Audio codec
    pub codec: String,
    /// Sample rate
    pub sample_rate: u32,
    /// Waveform data for visualization
    pub waveform: Vec<f32>,
    /// Transcription (if available)
    pub transcription: Option<String>,
}

/// Extension message types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExtensionMessageType {
    /// Reaction to a message
    Reaction(MessageReaction),
    /// Thread reply
    ThreadReply(ThreadMessage),
    /// Typing indicator
    Typing(TypingIndicator),
    /// Read receipt
    ReadReceipt(ReadReceipt),
    /// File transfer
    FileTransfer(FileTransferMetadata),
    /// Voice message
    VoiceMessage(VoiceMessageMetadata),
    /// Custom extension
    Custom(String, Vec<u8>),
}

/// Protocol extensions handler
pub struct ProtocolExtensions {
    /// Configuration
    config: BitChatConfig,
    /// Message reactions storage
    reactions: Arc<RwLock<HashMap<String, Vec<MessageReaction>>>>,
    /// Thread storage
    threads: Arc<RwLock<HashMap<String, Vec<ThreadMessage>>>>,
    /// Active typing indicators
    typing_indicators: Arc<RwLock<HashMap<String, TypingIndicator>>>,
    /// Read receipts
    read_receipts: Arc<RwLock<HashMap<String, Vec<ReadReceipt>>>>,
    /// Active file transfers
    file_transfers: Arc<RwLock<HashMap<String, FileTransferState>>>,
    /// Voice message cache
    voice_messages: Arc<RwLock<HashMap<String, VoiceMessageMetadata>>>,
}

/// File transfer state
#[derive(Debug, Clone)]
struct FileTransferState {
    /// Metadata
    metadata: FileTransferMetadata,
    /// Received chunks
    received_chunks: HashMap<u32, FileChunk>,
    /// Start time
    started_at: SystemTime,
    /// Completed
    completed: bool,
}

impl ProtocolExtensions {
    /// Create new protocol extensions handler
    pub fn new(config: &BitChatConfig) -> Self {
        Self {
            config: config.clone(),
            reactions: Arc::new(RwLock::new(HashMap::new())),
            threads: Arc::new(RwLock::new(HashMap::new())),
            typing_indicators: Arc::new(RwLock::new(HashMap::new())),
            read_receipts: Arc::new(RwLock::new(HashMap::new())),
            file_transfers: Arc::new(RwLock::new(HashMap::new())),
            voice_messages: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Process an incoming message for extensions
    pub async fn process_message(
        &mut self,
        message: &ReceivedMessage,
    ) -> Result<Option<ReceivedMessage>> {
        // Try to parse as extension message
        if let Ok(ext_type) = bincode::deserialize::<ExtensionMessageType>(&message.data) {
            match ext_type {
                ExtensionMessageType::Reaction(reaction) => {
                    self.handle_reaction(reaction).await?;
                }
                ExtensionMessageType::ThreadReply(thread_msg) => {
                    self.handle_thread_message(thread_msg).await?;
                }
                ExtensionMessageType::Typing(indicator) => {
                    self.handle_typing_indicator(indicator).await?;
                }
                ExtensionMessageType::ReadReceipt(receipt) => {
                    self.handle_read_receipt(receipt).await?;
                }
                ExtensionMessageType::FileTransfer(metadata) => {
                    self.handle_file_transfer(metadata).await?;
                }
                ExtensionMessageType::VoiceMessage(voice_meta) => {
                    self.handle_voice_message(&message.id, voice_meta).await?;
                }
                ExtensionMessageType::Custom(name, data) => {
                    tracing::debug!("Received custom extension: {}", name);
                }
            }

            // Extension messages are typically not returned to the application
            Ok(None)
        } else {
            // Regular message, pass through
            Ok(Some(message.clone()))
        }
    }

    /// Send a reaction to a message
    pub async fn send_reaction(
        &self,
        message_id: &str,
        user_id: &str,
        reaction_type: &str,
    ) -> Result<ExtensionMessageType> {
        let reaction = MessageReaction {
            id: Uuid::new_v4().to_string(),
            message_id: message_id.to_string(),
            user_id: user_id.to_string(),
            reaction_type: reaction_type.to_string(),
            timestamp: SystemTime::now(),
        };

        // Store locally
        let mut reactions = self.reactions.write().await;
        reactions
            .entry(message_id.to_string())
            .or_insert_with(Vec::new)
            .push(reaction.clone());

        Ok(ExtensionMessageType::Reaction(reaction))
    }

    /// Send a thread reply
    pub async fn send_thread_reply(
        &self,
        parent_message_id: &str,
        thread_id: &str,
        message: ReceivedMessage,
    ) -> Result<ExtensionMessageType> {
        // Find thread depth
        let threads = self.threads.read().await;
        let depth = if let Some(thread_messages) = threads.get(thread_id) {
            thread_messages.iter().map(|t| t.depth).max().unwrap_or(0) + 1
        } else {
            1
        };
        drop(threads);

        let thread_msg = ThreadMessage {
            thread_id: thread_id.to_string(),
            parent_message_id: parent_message_id.to_string(),
            message,
            depth,
        };

        // Store locally
        let mut threads = self.threads.write().await;
        threads
            .entry(thread_id.to_string())
            .or_insert_with(Vec::new)
            .push(thread_msg.clone());

        Ok(ExtensionMessageType::ThreadReply(thread_msg))
    }

    /// Send typing indicator
    pub async fn send_typing_indicator(
        &self,
        user_id: &str,
        conversation_id: &str,
    ) -> Result<ExtensionMessageType> {
        let indicator = TypingIndicator {
            user_id: user_id.to_string(),
            conversation_id: conversation_id.to_string(),
            started_at: SystemTime::now(),
        };

        Ok(ExtensionMessageType::Typing(indicator))
    }

    /// Send read receipt
    pub async fn send_read_receipt(
        &self,
        user_id: &str,
        message_ids: Vec<String>,
    ) -> Result<ExtensionMessageType> {
        let receipt = ReadReceipt {
            user_id: user_id.to_string(),
            message_ids,
            read_at: SystemTime::now(),
        };

        Ok(ExtensionMessageType::ReadReceipt(receipt))
    }

    /// Initiate file transfer
    pub async fn initiate_file_transfer(
        &self,
        filename: &str,
        data: &[u8],
        mime_type: &str,
    ) -> Result<Vec<ExtensionMessageType>> {
        let file_id = Uuid::new_v4().to_string();
        let chunk_size = 65536; // 64KB chunks
        let total_chunks = ((data.len() + chunk_size - 1) / chunk_size) as u32;

        // Create chunks
        let mut chunks = Vec::new();
        for i in 0..total_chunks {
            let start = (i as usize) * chunk_size;
            let end = std::cmp::min(start + chunk_size, data.len());
            let chunk_data = data[start..end].to_vec();

            chunks.push(FileChunk {
                index: i,
                total: total_chunks,
                data: chunk_data.clone(),
                hash: blake3::hash(&chunk_data).to_hex().to_string(),
            });
        }

        // Create metadata
        let metadata = FileTransferMetadata {
            file_id,
            filename: filename.to_string(),
            size: data.len() as u64,
            mime_type: mime_type.to_string(),
            hash: blake3::hash(data).to_hex().to_string(),
            thumbnail: self.generate_thumbnail(data, mime_type).await?,
            chunks: chunks.clone(),
        };

        // Create extension messages
        let mut messages = vec![ExtensionMessageType::FileTransfer(metadata)];

        // Add chunk messages (in real implementation, these would be sent separately)
        for chunk in chunks {
            messages.push(ExtensionMessageType::Custom(
                format!("file_chunk_{}", chunk.index),
                bincode::serialize(&chunk)?,
            ));
        }

        Ok(messages)
    }

    /// Create voice message
    pub async fn create_voice_message(
        &self,
        audio_data: &[u8],
        duration: f32,
        codec: &str,
        sample_rate: u32,
    ) -> Result<ExtensionMessageType> {
        // Generate waveform
        let waveform = self.generate_waveform(audio_data, sample_rate)?;

        // Attempt transcription (would use actual speech-to-text in real implementation)
        let transcription = None; // Would be Some(text) with real STT

        let voice_meta = VoiceMessageMetadata {
            duration,
            codec: codec.to_string(),
            sample_rate,
            waveform,
            transcription,
        };

        Ok(ExtensionMessageType::VoiceMessage(voice_meta))
    }

    /// Handle incoming reaction
    async fn handle_reaction(&mut self, reaction: MessageReaction) -> Result<()> {
        let mut reactions = self.reactions.write().await;
        reactions
            .entry(reaction.message_id.clone())
            .or_insert_with(Vec::new)
            .push(reaction);
        Ok(())
    }

    /// Handle incoming thread message
    async fn handle_thread_message(&mut self, thread_msg: ThreadMessage) -> Result<()> {
        let mut threads = self.threads.write().await;
        threads
            .entry(thread_msg.thread_id.clone())
            .or_insert_with(Vec::new)
            .push(thread_msg);
        Ok(())
    }

    /// Handle typing indicator
    async fn handle_typing_indicator(&mut self, indicator: TypingIndicator) -> Result<()> {
        let mut indicators = self.typing_indicators.write().await;
        indicators.insert(
            format!("{}:{}", indicator.user_id, indicator.conversation_id),
            indicator,
        );

        // Clean up old indicators
        let cutoff = SystemTime::now() - Duration::from_secs(10);
        indicators.retain(|_, ind| ind.started_at > cutoff);

        Ok(())
    }

    /// Handle read receipt
    async fn handle_read_receipt(&mut self, receipt: ReadReceipt) -> Result<()> {
        let mut receipts = self.read_receipts.write().await;
        for msg_id in &receipt.message_ids {
            receipts
                .entry(msg_id.clone())
                .or_insert_with(Vec::new)
                .push(receipt.clone());
        }
        Ok(())
    }

    /// Handle file transfer
    async fn handle_file_transfer(&mut self, metadata: FileTransferMetadata) -> Result<()> {
        let state = FileTransferState {
            metadata: metadata.clone(),
            received_chunks: HashMap::new(),
            started_at: SystemTime::now(),
            completed: false,
        };

        let mut transfers = self.file_transfers.write().await;
        transfers.insert(metadata.file_id, state);
        Ok(())
    }

    /// Handle voice message
    async fn handle_voice_message(
        &mut self,
        message_id: &str,
        voice_meta: VoiceMessageMetadata,
    ) -> Result<()> {
        let mut voice_messages = self.voice_messages.write().await;
        voice_messages.insert(message_id.to_string(), voice_meta);
        Ok(())
    }

    /// Generate thumbnail for images/videos
    async fn generate_thumbnail(&self, _data: &[u8], mime_type: &str) -> Result<Option<Vec<u8>>> {
        if mime_type.starts_with("image/") || mime_type.starts_with("video/") {
            // In real implementation, would generate actual thumbnail
            Ok(Some(vec![0; 100])) // Placeholder
        } else {
            Ok(None)
        }
    }

    /// Generate waveform from audio data
    fn generate_waveform(&self, audio_data: &[u8], sample_rate: u32) -> Result<Vec<f32>> {
        // Simple waveform generation (real implementation would analyze audio)
        let samples_per_point = (sample_rate / 100) as usize; // 100 points per second
        let num_points = audio_data.len() / samples_per_point;

        let mut waveform = Vec::with_capacity(num_points);
        for i in 0..num_points {
            let start = i * samples_per_point;
            let end = std::cmp::min(start + samples_per_point, audio_data.len());

            // Calculate RMS of chunk
            let sum: f32 = audio_data[start..end]
                .iter()
                .map(|&b| (b as f32 - 128.0) / 128.0)
                .map(|s| s * s)
                .sum();

            let rms = (sum / samples_per_point as f32).sqrt();
            waveform.push(rms);
        }

        Ok(waveform)
    }

    /// Get reactions for a message
    pub async fn get_reactions(&self, message_id: &str) -> Vec<MessageReaction> {
        let reactions = self.reactions.read().await;
        reactions.get(message_id).cloned().unwrap_or_default()
    }

    /// Get thread messages
    pub async fn get_thread(&self, thread_id: &str) -> Vec<ThreadMessage> {
        let threads = self.threads.read().await;
        threads.get(thread_id).cloned().unwrap_or_default()
    }

    /// Get active typing indicators for a conversation
    pub async fn get_typing_indicators(&self, conversation_id: &str) -> Vec<TypingIndicator> {
        let indicators = self.typing_indicators.read().await;
        let cutoff = SystemTime::now() - Duration::from_secs(10);

        indicators
            .values()
            .filter(|ind| ind.conversation_id == conversation_id && ind.started_at > cutoff)
            .cloned()
            .collect()
    }

    /// Get read receipts for a message
    pub async fn get_read_receipts(&self, message_id: &str) -> Vec<ReadReceipt> {
        let receipts = self.read_receipts.read().await;
        receipts.get(message_id).cloned().unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::BitChatConfig;

    #[tokio::test]
    async fn test_reactions() {
        let config = BitChatConfig::testing();
        let mut extensions = ProtocolExtensions::new(&config);

        // Send reaction
        let ext_msg = extensions
            .send_reaction("msg123", "user1", "👍")
            .await
            .unwrap();

        if let ExtensionMessageType::Reaction(reaction) = ext_msg {
            assert_eq!(reaction.message_id, "msg123");
            assert_eq!(reaction.user_id, "user1");
            assert_eq!(reaction.reaction_type, "👍");
        } else {
            panic!("Expected reaction message");
        }

        // Get reactions
        let reactions = extensions.get_reactions("msg123").await;
        assert_eq!(reactions.len(), 1);
    }

    #[tokio::test]
    async fn test_threading() {
        let config = BitChatConfig::testing();
        let mut extensions = ProtocolExtensions::new(&config);

        // Create thread message
        let message = ReceivedMessage {
            id: "reply1".to_string(),
            sender: "user2".to_string(),
            recipient: "channel".to_string(),
            topic: Some("general".to_string()),
            data: b"This is a reply".to_vec(),
            timestamp: SystemTime::now(),
            is_ephemeral: false,
            priority: MessagePriority::Normal,
            message_type: MessageType::Direct,
            encryption_info: None,
            compression_info: None,
        };

        let ext_msg = extensions
            .send_thread_reply("parent123", "thread123", message)
            .await
            .unwrap();

        if let ExtensionMessageType::ThreadReply(thread_msg) = ext_msg {
            assert_eq!(thread_msg.parent_message_id, "parent123");
            assert_eq!(thread_msg.thread_id, "thread123");
            assert_eq!(thread_msg.depth, 1);
        } else {
            panic!("Expected thread message");
        }

        // Get thread
        let thread = extensions.get_thread("thread123").await;
        assert_eq!(thread.len(), 1);
    }

    #[tokio::test]
    async fn test_file_transfer() {
        let config = BitChatConfig::testing();
        let extensions = ProtocolExtensions::new(&config);

        // Initiate file transfer
        let file_data = b"This is a test file with some content that will be chunked";
        let messages = extensions
            .initiate_file_transfer("test.txt", file_data, "text/plain")
            .await
            .unwrap();

        // Should have metadata message plus chunk messages
        assert!(messages.len() > 1);

        if let ExtensionMessageType::FileTransfer(metadata) = &messages[0] {
            assert_eq!(metadata.filename, "test.txt");
            assert_eq!(metadata.size, file_data.len() as u64);
            assert_eq!(metadata.mime_type, "text/plain");
            assert!(!metadata.chunks.is_empty());
        } else {
            panic!("Expected file transfer metadata");
        }
    }

    #[tokio::test]
    async fn test_voice_message() {
        let config = BitChatConfig::testing();
        let extensions = ProtocolExtensions::new(&config);

        // Create voice message
        let audio_data = vec![128; 44100]; // 1 second of silence at 44.1kHz
        let ext_msg = extensions
            .create_voice_message(&audio_data, 1.0, "opus", 44100)
            .await
            .unwrap();

        if let ExtensionMessageType::VoiceMessage(voice_meta) = ext_msg {
            assert_eq!(voice_meta.duration, 1.0);
            assert_eq!(voice_meta.codec, "opus");
            assert_eq!(voice_meta.sample_rate, 44100);
            assert!(!voice_meta.waveform.is_empty());
        } else {
            panic!("Expected voice message");
        }
    }
}
