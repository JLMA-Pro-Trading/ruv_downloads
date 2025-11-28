//! Unit tests for inter-agent communication channels

use micro_swarm::*;
use alloc::{vec, string::String};

#[cfg(test)]
mod message_tests {
    use super::*;

    #[test]
    fn test_message_creation() {
        let sender = AgentId::new();
        let recipient = AgentId::new();
        let payload = MessagePayload::Text("Hello, agent!".into());
        
        let message = Message::new(
            sender,
            recipient,
            MessageType::TaskAssignment,
            payload.clone()
        );
        
        assert_eq!(message.sender(), sender);
        assert_eq!(message.recipient(), recipient);
        assert_eq!(message.message_type(), MessageType::TaskAssignment);
        assert_eq!(message.payload(), &payload);
        assert!(message.timestamp() > 0);
    }

    #[test]
    fn test_message_broadcast() {
        let sender = AgentId::new();
        let payload = MessagePayload::Text("Broadcast message".into());
        
        let message = Message::broadcast(
            sender,
            MessageType::SystemShutdown,
            payload.clone()
        );
        
        assert_eq!(message.sender(), sender);
        assert!(message.is_broadcast());
        assert_eq!(message.message_type(), MessageType::SystemShutdown);
    }

    #[test]
    fn test_message_reply() {
        let original_sender = AgentId::new();
        let original_recipient = AgentId::new();
        let original_payload = MessagePayload::Text("Original message".into());
        
        let original = Message::new(
            original_sender,
            original_recipient,
            MessageType::TaskAssignment,
            original_payload
        );
        
        let reply_payload = MessagePayload::Text("Reply message".into());
        let reply = original.create_reply(MessageType::TaskResult, reply_payload.clone());
        
        assert_eq!(reply.sender(), original_recipient);
        assert_eq!(reply.recipient(), original_sender);
        assert_eq!(reply.message_type(), MessageType::TaskResult);
        assert_eq!(reply.payload(), &reply_payload);
        assert_eq!(reply.correlation_id(), Some(original.id()));
    }

    #[test]
    fn test_message_priority() {
        let sender = AgentId::new();
        let recipient = AgentId::new();
        let payload = MessagePayload::Text("Test".into());
        
        let high_priority = Message::new(
            sender,
            recipient,
            MessageType::SystemShutdown,
            payload.clone()
        );
        
        let low_priority = Message::new(
            sender,
            recipient,
            MessageType::Heartbeat,
            payload.clone()
        );
        
        assert!(high_priority.priority() > low_priority.priority());
    }

    #[test]
    fn test_message_serialization() {
        let sender = AgentId::new();
        let recipient = AgentId::new();
        let payload = MessagePayload::Binary(vec![1, 2, 3, 4, 5]);
        
        let message = Message::new(
            sender,
            recipient,
            MessageType::TaskAssignment,
            payload
        );
        
        let serialized = message.serialize();
        assert!(serialized.is_ok());
        
        let deserialized = Message::deserialize(&serialized.unwrap());
        assert!(deserialized.is_ok());
        
        let recovered = deserialized.unwrap();
        assert_eq!(recovered.sender(), message.sender());
        assert_eq!(recovered.recipient(), message.recipient());
        assert_eq!(recovered.message_type(), message.message_type());
    }
}

#[cfg(test)]
mod message_payload_tests {
    use super::*;

    #[test]
    fn test_message_payload_text() {
        let payload = MessagePayload::Text("Hello, World!".into());
        
        assert!(payload.is_text());
        assert!(!payload.is_binary());
        assert!(!payload.is_json());
        
        if let MessagePayload::Text(text) = payload {
            assert_eq!(text, "Hello, World!");
        } else {
            panic!("Expected Text payload");
        }
    }

    #[test]
    fn test_message_payload_binary() {
        let data = vec![0xDE, 0xAD, 0xBE, 0xEF];
        let payload = MessagePayload::Binary(data.clone());
        
        assert!(!payload.is_text());
        assert!(payload.is_binary());
        assert!(!payload.is_json());
        
        if let MessagePayload::Binary(binary) = payload {
            assert_eq!(binary, data);
        } else {
            panic!("Expected Binary payload");
        }
    }

    #[test]
    fn test_message_payload_json() {
        let json = r#"{"key": "value", "number": 42}"#;
        let payload = MessagePayload::Json(json.into());
        
        assert!(!payload.is_text());
        assert!(!payload.is_binary());
        assert!(payload.is_json());
        
        if let MessagePayload::Json(json_str) = payload {
            assert_eq!(json_str, json);
        } else {
            panic!("Expected Json payload");
        }
    }

    #[test]
    fn test_message_payload_size() {
        let text_payload = MessagePayload::Text("Hello".into());
        assert_eq!(text_payload.size(), 5);
        
        let binary_payload = MessagePayload::Binary(vec![1, 2, 3, 4]);
        assert_eq!(binary_payload.size(), 4);
        
        let json_payload = MessagePayload::Json(r#"{"test": true}"#.into());
        assert_eq!(json_payload.size(), 14);
    }

    #[test]
    fn test_message_payload_clone() {
        let original = MessagePayload::Text("Original".into());
        let cloned = original.clone();
        
        assert_eq!(original, cloned);
        
        if let (MessagePayload::Text(orig), MessagePayload::Text(clone)) = (&original, &cloned) {
            assert_eq!(orig, clone);
        } else {
            panic!("Clone failed");
        }
    }
}

#[cfg(test)]
mod channel_tests {
    use super::*;

    #[test]
    fn test_channel_creation() {
        let agent1 = AgentId::new();
        let agent2 = AgentId::new();
        
        let channel = Channel::new(agent1, agent2, 100);
        
        assert_eq!(channel.agent1(), agent1);
        assert_eq!(channel.agent2(), agent2);
        assert_eq!(channel.capacity(), 100);
        assert_eq!(channel.message_count(), 0);
        assert!(channel.is_empty());
        assert!(!channel.is_full());
    }

    #[test]
    fn test_channel_send_receive() {
        let agent1 = AgentId::new();
        let agent2 = AgentId::new();
        let mut channel = Channel::new(agent1, agent2, 10);
        
        let message = Message::new(
            agent1,
            agent2,
            MessageType::TaskAssignment,
            MessagePayload::Text("Test message".into())
        );
        
        // Send message
        let result = channel.send(message.clone());
        assert!(result.is_ok());
        assert_eq!(channel.message_count(), 1);
        assert!(!channel.is_empty());
        
        // Receive message
        let received = channel.receive();
        assert!(received.is_some());
        let received_msg = received.unwrap();
        assert_eq!(received_msg.sender(), message.sender());
        assert_eq!(received_msg.recipient(), message.recipient());
        assert_eq!(channel.message_count(), 0);
        assert!(channel.is_empty());
    }

    #[test]
    fn test_channel_capacity_limit() {
        let agent1 = AgentId::new();
        let agent2 = AgentId::new();
        let mut channel = Channel::new(agent1, agent2, 2);
        
        let message1 = Message::new(
            agent1,
            agent2,
            MessageType::TaskAssignment,
            MessagePayload::Text("Message 1".into())
        );
        
        let message2 = Message::new(
            agent1,
            agent2,
            MessageType::TaskAssignment,
            MessagePayload::Text("Message 2".into())
        );
        
        let message3 = Message::new(
            agent1,
            agent2,
            MessageType::TaskAssignment,
            MessagePayload::Text("Message 3".into())
        );
        
        // Fill to capacity
        assert!(channel.send(message1).is_ok());
        assert!(channel.send(message2).is_ok());
        assert!(channel.is_full());
        
        // Should fail when full
        assert!(channel.send(message3).is_err());
    }

    #[test]
    fn test_channel_message_ordering() {
        let agent1 = AgentId::new();
        let agent2 = AgentId::new();
        let mut channel = Channel::new(agent1, agent2, 10);
        
        let messages = vec![
            Message::new(agent1, agent2, MessageType::TaskAssignment, 
                        MessagePayload::Text("First".into())),
            Message::new(agent1, agent2, MessageType::TaskAssignment, 
                        MessagePayload::Text("Second".into())),
            Message::new(agent1, agent2, MessageType::TaskAssignment, 
                        MessagePayload::Text("Third".into())),
        ];
        
        // Send all messages
        for msg in &messages {
            channel.send(msg.clone()).unwrap();
        }
        
        // Receive in order
        for (i, expected_msg) in messages.iter().enumerate() {
            let received = channel.receive().unwrap();
            if let MessagePayload::Text(expected_text) = expected_msg.payload() {
                if let MessagePayload::Text(received_text) = received.payload() {
                    assert_eq!(expected_text, received_text);
                } else {
                    panic!("Expected text payload");
                }
            }
        }
    }

    #[test]
    fn test_channel_peek() {
        let agent1 = AgentId::new();
        let agent2 = AgentId::new();
        let mut channel = Channel::new(agent1, agent2, 10);
        
        assert!(channel.peek().is_none());
        
        let message = Message::new(
            agent1,
            agent2,
            MessageType::TaskAssignment,
            MessagePayload::Text("Peek test".into())
        );
        
        channel.send(message.clone()).unwrap();
        
        // Peek should show message without removing it
        let peeked = channel.peek();
        assert!(peeked.is_some());
        assert_eq!(channel.message_count(), 1);
        
        // Should be able to receive the same message
        let received = channel.receive();
        assert!(received.is_some());
        assert_eq!(channel.message_count(), 0);
    }

    #[test]
    fn test_channel_clear() {
        let agent1 = AgentId::new();
        let agent2 = AgentId::new();
        let mut channel = Channel::new(agent1, agent2, 10);
        
        // Add some messages
        for i in 0..5 {
            let message = Message::new(
                agent1,
                agent2,
                MessageType::TaskAssignment,
                MessagePayload::Text(format!("Message {}", i))
            );
            channel.send(message).unwrap();
        }
        
        assert_eq!(channel.message_count(), 5);
        
        // Clear channel
        channel.clear();
        assert_eq!(channel.message_count(), 0);
        assert!(channel.is_empty());
    }

    #[test]
    fn test_channel_statistics() {
        let agent1 = AgentId::new();
        let agent2 = AgentId::new();
        let mut channel = Channel::new(agent1, agent2, 10);
        
        let stats = channel.statistics();
        assert_eq!(stats.messages_sent, 0);
        assert_eq!(stats.messages_received, 0);
        assert_eq!(stats.bytes_sent, 0);
        assert_eq!(stats.bytes_received, 0);
        
        let message = Message::new(
            agent1,
            agent2,
            MessageType::TaskAssignment,
            MessagePayload::Text("Statistics test".into())
        );
        
        let message_size = message.payload().size();
        
        // Send and receive
        channel.send(message).unwrap();
        let stats = channel.statistics();
        assert_eq!(stats.messages_sent, 1);
        assert_eq!(stats.bytes_sent, message_size);
        
        channel.receive().unwrap();
        let stats = channel.statistics();
        assert_eq!(stats.messages_received, 1);
        assert_eq!(stats.bytes_received, message_size);
    }
}

#[cfg(test)]
mod channel_manager_tests {
    use super::*;

    #[test]
    fn test_channel_manager_creation() {
        let manager = ChannelManager::new();
        assert_eq!(manager.channel_count(), 0);
    }

    #[test]
    fn test_channel_manager_create_channel() {
        let mut manager = ChannelManager::new();
        let agent1 = AgentId::new();
        let agent2 = AgentId::new();
        
        let channel_id = manager.create_channel(agent1, agent2, 100);
        assert!(channel_id.is_ok());
        assert_eq!(manager.channel_count(), 1);
        
        let channel_id = channel_id.unwrap();
        
        // Should be able to get the channel
        let channel = manager.get_channel(channel_id);
        assert!(channel.is_some());
        
        // Cannot create duplicate channel
        let duplicate = manager.create_channel(agent1, agent2, 100);
        assert!(duplicate.is_err());
    }

    #[test]
    fn test_channel_manager_send_receive() {
        let mut manager = ChannelManager::new();
        let agent1 = AgentId::new();
        let agent2 = AgentId::new();
        
        let channel_id = manager.create_channel(agent1, agent2, 100).unwrap();
        
        let message = Message::new(
            agent1,
            agent2,
            MessageType::TaskAssignment,
            MessagePayload::Text("Manager test".into())
        );
        
        // Send through manager
        let result = manager.send_message(channel_id, message.clone());
        assert!(result.is_ok());
        
        // Receive through manager
        let received = manager.receive_message(channel_id);
        assert!(received.is_some());
        
        let received_msg = received.unwrap();
        assert_eq!(received_msg.sender(), message.sender());
        assert_eq!(received_msg.recipient(), message.recipient());
    }

    #[test]
    fn test_channel_manager_broadcast() {
        let mut manager = ChannelManager::new();
        let sender = AgentId::new();
        let recipient1 = AgentId::new();
        let recipient2 = AgentId::new();
        let recipient3 = AgentId::new();
        
        // Create channels to multiple recipients
        let ch1 = manager.create_channel(sender, recipient1, 10).unwrap();
        let ch2 = manager.create_channel(sender, recipient2, 10).unwrap();
        let ch3 = manager.create_channel(sender, recipient3, 10).unwrap();
        
        let message = Message::broadcast(
            sender,
            MessageType::SystemShutdown,
            MessagePayload::Text("Shutdown now".into())
        );
        
        // Broadcast to all channels
        let recipients = vec![recipient1, recipient2, recipient3];
        let result = manager.broadcast_message(sender, recipients, message);
        assert!(result.is_ok());
        
        // All channels should have received the message
        assert!(manager.receive_message(ch1).is_some());
        assert!(manager.receive_message(ch2).is_some());
        assert!(manager.receive_message(ch3).is_some());
    }

    #[test]
    fn test_channel_manager_remove_channel() {
        let mut manager = ChannelManager::new();
        let agent1 = AgentId::new();
        let agent2 = AgentId::new();
        
        let channel_id = manager.create_channel(agent1, agent2, 100).unwrap();
        assert_eq!(manager.channel_count(), 1);
        
        let removed = manager.remove_channel(channel_id);
        assert!(removed.is_ok());
        assert_eq!(manager.channel_count(), 0);
        
        // Should no longer be able to get the channel
        let channel = manager.get_channel(channel_id);
        assert!(channel.is_none());
    }

    #[test]
    fn test_channel_manager_find_channels() {
        let mut manager = ChannelManager::new();
        let agent1 = AgentId::new();
        let agent2 = AgentId::new(); 
        let agent3 = AgentId::new();
        
        let ch1 = manager.create_channel(agent1, agent2, 10).unwrap();
        let ch2 = manager.create_channel(agent1, agent3, 10).unwrap();
        let ch3 = manager.create_channel(agent2, agent3, 10).unwrap();
        
        // Find channels involving agent1
        let agent1_channels = manager.find_channels_for_agent(agent1);
        assert_eq!(agent1_channels.len(), 2);
        assert!(agent1_channels.contains(&ch1));
        assert!(agent1_channels.contains(&ch2));
        
        // Find channels involving agent2
        let agent2_channels = manager.find_channels_for_agent(agent2);
        assert_eq!(agent2_channels.len(), 2);
        assert!(agent2_channels.contains(&ch1));
        assert!(agent2_channels.contains(&ch3));
        
        // Find channels involving agent3 
        let agent3_channels = manager.find_channels_for_agent(agent3);
        assert_eq!(agent3_channels.len(), 2);
        assert!(agent3_channels.contains(&ch2));
        assert!(agent3_channels.contains(&ch3));
    }

    #[test]
    fn test_channel_manager_statistics() {
        let mut manager = ChannelManager::new();
        let agent1 = AgentId::new();
        let agent2 = AgentId::new();
        
        let channel_id = manager.create_channel(agent1, agent2, 100).unwrap();
        
        let message = Message::new(
            agent1,
            agent2,
            MessageType::TaskAssignment,
            MessagePayload::Text("Stats test".into())
        );
        
        manager.send_message(channel_id, message).unwrap();
        manager.receive_message(channel_id).unwrap();
        
        let stats = manager.total_statistics();
        assert_eq!(stats.total_channels, 1);
        assert_eq!(stats.total_messages_sent, 1);
        assert_eq!(stats.total_messages_received, 1);
        assert!(stats.total_bytes_sent > 0);
        assert!(stats.total_bytes_received > 0);
    }
}