//! Group Chat Example using BitChat-QuDAG
//!
//! This example demonstrates creating a group chat application with
//! topic-based messaging, user management, and moderation features.
//!
//! Usage:
//!   cargo run --example group_chat

use bitchat_qudag::{crypto::CryptoMode, BitChatConfig, BitChatMessaging, QuDAGMessaging};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::io::{self, Write};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::time::{timeout, Duration};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
enum GroupMessage {
    Join {
        group_id: String,
        user_id: String,
        username: String,
    },
    Leave {
        group_id: String,
        user_id: String,
    },
    Message {
        group_id: String,
        user_id: String,
        username: String,
        content: String,
        timestamp: u64,
    },
    UserList {
        group_id: String,
        users: Vec<GroupUser>,
    },
    Moderation {
        group_id: String,
        action: ModerationAction,
        moderator: String,
        target: String,
        reason: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
enum ModerationAction {
    Kick,
    Ban,
    Unban,
    Mute,
    Unmute,
    Promote,
    Demote,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GroupUser {
    user_id: String,
    username: String,
    role: UserRole,
    joined_at: u64,
    is_muted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
enum UserRole {
    Member,
    Moderator,
    Admin,
    Owner,
}

struct GroupChat {
    messaging: BitChatMessaging,
    user_id: String,
    username: String,
    joined_groups: HashMap<String, GroupInfo>,
    user_role: UserRole,
}

#[derive(Debug, Clone)]
struct GroupInfo {
    name: String,
    topic: String,
    users: HashMap<String, GroupUser>,
    is_active: bool,
}

impl GroupChat {
    async fn new(username: String) -> Result<Self, Box<dyn std::error::Error>> {
        let config = BitChatConfig::builder()
            .enabled(true)
            .auto_start(true)
            .enable_metrics(true)
            .crypto_mode(CryptoMode::Hybrid)
            .enable_compression(true)
            .build();

        let messaging = BitChatMessaging::new(config).await?;
        let user_id = Uuid::new_v4().to_string();

        Ok(Self {
            messaging,
            user_id,
            username,
            joined_groups: HashMap::new(),
            user_role: UserRole::Member,
        })
    }

    async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.messaging.start().await?;

        println!("🎉 Welcome to BitChat-QuDAG Group Chat!");
        println!("👤 Username: {}", self.username);
        println!("🆔 User ID: {}", self.user_id);
        println!("📡 Peer ID: {}", self.messaging.local_peer_id());
        println!("💡 Type /help for commands");
        println!("---");

        Ok(())
    }

    async fn join_group(&mut self, group_name: String) -> Result<(), Box<dyn std::error::Error>> {
        let group_id = format!("group_{}", group_name.to_lowercase().replace(' ', "_"));
        let topic = format!("group:{}", group_id);

        println!("🚪 Joining group: {}", group_name);

        // Subscribe to group topic
        self.messaging.subscribe_topic(&topic).await?;

        // Send join message
        let join_msg = GroupMessage::Join {
            group_id: group_id.clone(),
            user_id: self.user_id.clone(),
            username: self.username.clone(),
        };

        let join_data = serde_json::to_vec(&join_msg)?;
        self.messaging.publish_message(&topic, &join_data).await?;

        // Create group info
        let group_info = GroupInfo {
            name: group_name.clone(),
            topic,
            users: HashMap::new(),
            is_active: true,
        };

        self.joined_groups.insert(group_id.clone(), group_info);

        println!("✅ Joined group: {}", group_name);
        Ok(())
    }

    async fn leave_group(&mut self, group_name: String) -> Result<(), Box<dyn std::error::Error>> {
        let group_id = format!("group_{}", group_name.to_lowercase().replace(' ', "_"));

        if let Some(group_info) = self.joined_groups.get(&group_id) {
            println!("🚪 Leaving group: {}", group_name);

            // Send leave message
            let leave_msg = GroupMessage::Leave {
                group_id: group_id.clone(),
                user_id: self.user_id.clone(),
            };

            let leave_data = serde_json::to_vec(&leave_msg)?;
            self.messaging
                .publish_message(&group_info.topic, &leave_data)
                .await?;

            // Unsubscribe from group topic
            self.messaging.unsubscribe_topic(&group_info.topic).await?;

            self.joined_groups.remove(&group_id);

            println!("✅ Left group: {}", group_name);
        } else {
            println!("❌ You are not in group: {}", group_name);
        }

        Ok(())
    }

    async fn send_message(
        &mut self,
        group_name: String,
        content: String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let group_id = format!("group_{}", group_name.to_lowercase().replace(' ', "_"));

        if let Some(group_info) = self.joined_groups.get(&group_id) {
            let message = GroupMessage::Message {
                group_id: group_id.clone(),
                user_id: self.user_id.clone(),
                username: self.username.clone(),
                content,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            };

            let message_data = serde_json::to_vec(&message)?;
            self.messaging
                .publish_message(&group_info.topic, &message_data)
                .await?;

            println!("📤 Message sent to {}", group_name);
        } else {
            println!("❌ You are not in group: {}", group_name);
        }

        Ok(())
    }

    async fn list_groups(&self) {
        println!("📋 Joined Groups:");
        if self.joined_groups.is_empty() {
            println!("  (No groups joined)");
        } else {
            for (group_id, group_info) in &self.joined_groups {
                let user_count = group_info.users.len();
                let status = if group_info.is_active { "🟢" } else { "🔴" };
                println!("  {} {} - {} users", status, group_info.name, user_count);
            }
        }
    }

    async fn list_users(&self, group_name: String) {
        let group_id = format!("group_{}", group_name.to_lowercase().replace(' ', "_"));

        if let Some(group_info) = self.joined_groups.get(&group_id) {
            println!("👥 Users in {}:", group_name);
            if group_info.users.is_empty() {
                println!("  (No users visible)");
            } else {
                for user in group_info.users.values() {
                    let role_icon = match user.role {
                        UserRole::Owner => "👑",
                        UserRole::Admin => "🛡️",
                        UserRole::Moderator => "🔧",
                        UserRole::Member => "👤",
                    };
                    let status = if user.is_muted { "🔇" } else { "🔊" };
                    println!(
                        "  {} {} {} - {:?}",
                        role_icon, status, user.username, user.role
                    );
                }
            }
        } else {
            println!("❌ You are not in group: {}", group_name);
        }
    }

    async fn kick_user(
        &mut self,
        group_name: String,
        target_username: String,
        reason: Option<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let group_id = format!("group_{}", group_name.to_lowercase().replace(' ', "_"));

        if let Some(group_info) = self.joined_groups.get(&group_id) {
            // Check if user has permission to kick
            if !matches!(
                self.user_role,
                UserRole::Moderator | UserRole::Admin | UserRole::Owner
            ) {
                println!("❌ You don't have permission to kick users");
                return Ok(());
            }

            // Find target user
            let target_user = group_info
                .users
                .values()
                .find(|u| u.username == target_username)
                .cloned();

            if let Some(target) = target_user {
                let moderation_msg = GroupMessage::Moderation {
                    group_id: group_id.clone(),
                    action: ModerationAction::Kick,
                    moderator: self.username.clone(),
                    target: target.user_id,
                    reason,
                };

                let moderation_data = serde_json::to_vec(&moderation_msg)?;
                self.messaging
                    .publish_message(&group_info.topic, &moderation_data)
                    .await?;

                println!("🦶 Kicked user: {}", target_username);
            } else {
                println!("❌ User not found: {}", target_username);
            }
        } else {
            println!("❌ You are not in group: {}", group_name);
        }

        Ok(())
    }

    async fn handle_message(
        &mut self,
        message: bitchat_qudag::messaging::ReceivedMessage,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(topic) = &message.topic {
            if topic.starts_with("group:") {
                if let Ok(group_msg) = serde_json::from_slice::<GroupMessage>(&message.data) {
                    match group_msg {
                        GroupMessage::Join {
                            group_id,
                            user_id,
                            username,
                        } => {
                            if let Some(group_info) = self.joined_groups.get_mut(&group_id) {
                                let user = GroupUser {
                                    user_id: user_id.clone(),
                                    username: username.clone(),
                                    role: UserRole::Member,
                                    joined_at: std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap()
                                        .as_secs(),
                                    is_muted: false,
                                };

                                group_info.users.insert(user_id.clone(), user);

                                if user_id != self.user_id {
                                    println!("\n🚪 {} joined {}", username, group_info.name);
                                }
                            }
                        }

                        GroupMessage::Leave { group_id, user_id } => {
                            if let Some(group_info) = self.joined_groups.get_mut(&group_id) {
                                if let Some(user) = group_info.users.remove(&user_id) {
                                    if user_id != self.user_id {
                                        println!("\n🚪 {} left {}", user.username, group_info.name);
                                    }
                                }
                            }
                        }

                        GroupMessage::Message {
                            group_id,
                            user_id,
                            username,
                            content,
                            timestamp,
                        } => {
                            if let Some(group_info) = self.joined_groups.get(&group_id) {
                                if user_id != self.user_id {
                                    let time = std::time::UNIX_EPOCH
                                        + std::time::Duration::from_secs(timestamp);
                                    let datetime = chrono::DateTime::<chrono::Utc>::from(time);
                                    let time_str = datetime.format("%H:%M:%S").to_string();

                                    println!("\n[{}] {}: {}", time_str, username, content);
                                }
                            }
                        }

                        GroupMessage::Moderation {
                            group_id,
                            action,
                            moderator,
                            target,
                            reason,
                        } => {
                            if let Some(group_info) = self.joined_groups.get_mut(&group_id) {
                                match action {
                                    ModerationAction::Kick => {
                                        if let Some(user) = group_info.users.remove(&target) {
                                            let reason_str = reason
                                                .map(|r| format!(" ({})", r))
                                                .unwrap_or_default();
                                            println!(
                                                "\n🦶 {} was kicked by {}{}",
                                                user.username, moderator, reason_str
                                            );
                                        }
                                    }
                                    ModerationAction::Mute => {
                                        if let Some(user) = group_info.users.get_mut(&target) {
                                            user.is_muted = true;
                                            println!(
                                                "\n🔇 {} was muted by {}",
                                                user.username, moderator
                                            );
                                        }
                                    }
                                    ModerationAction::Unmute => {
                                        if let Some(user) = group_info.users.get_mut(&target) {
                                            user.is_muted = false;
                                            println!(
                                                "\n🔊 {} was unmuted by {}",
                                                user.username, moderator
                                            );
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }

                        _ => {}
                    }
                }
            }
        }

        Ok(())
    }

    async fn show_help(&self) {
        println!("📖 Group Chat Commands:");
        println!("  /join <group_name>         - Join a group");
        println!("  /leave <group_name>        - Leave a group");
        println!("  /msg <group_name> <text>   - Send message to group");
        println!("  /groups                    - List joined groups");
        println!("  /users <group_name>        - List users in group");
        println!("  /kick <group_name> <user>  - Kick user from group (moderator+)");
        println!("  /mute <group_name> <user>  - Mute user in group (moderator+)");
        println!("  /unmute <group_name> <user>- Unmute user in group (moderator+)");
        println!("  /stats                     - Show messaging statistics");
        println!("  /help                      - Show this help");
        println!("  /quit                      - Exit group chat");
    }

    async fn show_stats(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("📊 Group Chat Statistics:");
        let stats = self.messaging.get_stats().await?;
        println!("  📤 Messages sent: {}", stats.total_messages_sent);
        println!("  📥 Messages received: {}", stats.total_messages_received);
        println!("  🔗 Active connections: {}", stats.active_connections);
        println!("  📋 Subscribed topics: {}", stats.topics_subscribed);
        println!("  👥 Joined groups: {}", self.joined_groups.len());
        Ok(())
    }

    async fn run(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.start().await?;

        let stdin = tokio::io::stdin();
        let mut reader = BufReader::new(stdin);
        let mut line = String::new();

        loop {
            print!("> ");
            io::stdout().flush().unwrap();

            tokio::select! {
                result = reader.read_line(&mut line) => {
                    match result {
                        Ok(0) => break, // EOF
                        Ok(_) => {
                            let input = line.trim();

                            if input.starts_with('/') {
                                let parts: Vec<&str> = input[1..].split_whitespace().collect();
                                match parts.get(0) {
                                    Some(&"join") => {
                                        if let Some(group_name) = parts.get(1) {
                                            self.join_group(group_name.to_string()).await?;
                                        } else {
                                            println!("Usage: /join <group_name>");
                                        }
                                    }
                                    Some(&"leave") => {
                                        if let Some(group_name) = parts.get(1) {
                                            self.leave_group(group_name.to_string()).await?;
                                        } else {
                                            println!("Usage: /leave <group_name>");
                                        }
                                    }
                                    Some(&"msg") => {
                                        if let (Some(group_name), Some(_)) = (parts.get(1), parts.get(2)) {
                                            let message = parts[2..].join(" ");
                                            self.send_message(group_name.to_string(), message).await?;
                                        } else {
                                            println!("Usage: /msg <group_name> <message>");
                                        }
                                    }
                                    Some(&"groups") => {
                                        self.list_groups().await;
                                    }
                                    Some(&"users") => {
                                        if let Some(group_name) = parts.get(1) {
                                            self.list_users(group_name.to_string()).await;
                                        } else {
                                            println!("Usage: /users <group_name>");
                                        }
                                    }
                                    Some(&"kick") => {
                                        if let (Some(group_name), Some(username)) = (parts.get(1), parts.get(2)) {
                                            let reason = if parts.len() > 3 {
                                                Some(parts[3..].join(" "))
                                            } else {
                                                None
                                            };
                                            self.kick_user(group_name.to_string(), username.to_string(), reason).await?;
                                        } else {
                                            println!("Usage: /kick <group_name> <username> [reason]");
                                        }
                                    }
                                    Some(&"stats") => {
                                        self.show_stats().await?;
                                    }
                                    Some(&"help") => {
                                        self.show_help().await;
                                    }
                                    Some(&"quit") => {
                                        println!("👋 Goodbye!");
                                        break;
                                    }
                                    _ => {
                                        println!("❌ Unknown command. Type /help for available commands.");
                                    }
                                }
                            } else {
                                println!("💡 Use /msg <group_name> <message> to send messages to a group");
                            }

                            line.clear();
                        }
                        Err(e) => {
                            println!("❌ Error reading input: {}", e);
                            break;
                        }
                    }
                }
                message = self.messaging.receive_message() => {
                    if let Ok(Some(msg)) = message {
                        self.handle_message(msg).await?;
                    }
                }
            }
        }

        // Leave all groups before shutting down
        let groups_to_leave: Vec<String> = self.joined_groups.keys().cloned().collect();
        for group_id in groups_to_leave {
            if let Some(group_info) = self.joined_groups.get(&group_id) {
                let group_name = group_info.name.clone();
                self.leave_group(group_name).await?;
            }
        }

        self.messaging.stop().await?;
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    bitchat_qudag::init_logging();

    print!("👤 Enter your username: ");
    io::stdout().flush().unwrap();

    let mut username = String::new();
    io::stdin().read_line(&mut username)?;
    let username = username.trim().to_string();

    if username.is_empty() {
        eprintln!("❌ Username cannot be empty");
        return Ok(());
    }

    let mut group_chat = GroupChat::new(username).await?;
    group_chat.run().await?;

    Ok(())
}
