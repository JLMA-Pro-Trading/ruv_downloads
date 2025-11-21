//! Pub/sub messaging system for agent coordination

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

/// Message payload
pub type Message = Vec<u8>;

/// Subscription handle
pub struct Subscription {
    /// Receiver channel
    pub receiver: mpsc::Receiver<Message>,
}

/// Pub/sub broker
pub struct PubSubBroker {
    /// Topic subscribers
    subscribers: Arc<RwLock<HashMap<String, Vec<mpsc::Sender<Message>>>>>,

    /// Channel buffer size
    buffer_size: usize,
}

impl PubSubBroker {
    /// Create new pub/sub broker
    pub fn new() -> Self {
        Self {
            subscribers: Arc::new(RwLock::new(HashMap::new())),
            buffer_size: 1000,
        }
    }

    /// Configure buffer size
    pub fn with_buffer_size(mut self, size: usize) -> Self {
        self.buffer_size = size;
        self
    }

    /// Subscribe to topic
    pub async fn subscribe(&self, topic: &str) -> anyhow::Result<mpsc::Receiver<Message>> {
        let (tx, rx) = mpsc::channel(self.buffer_size);

        let mut subscribers = self.subscribers.write().await;
        subscribers
            .entry(topic.to_string())
            .or_insert_with(Vec::new)
            .push(tx);

        tracing::debug!("Subscribed to topic: {}", topic);

        Ok(rx)
    }

    /// Publish message to topic
    pub async fn publish(&self, topic: &str, message: Message) -> anyhow::Result<()> {
        let subscribers = self.subscribers.read().await;

        if let Some(subs) = subscribers.get(topic) {
            let mut sent = 0;
            let mut failed = 0;

            for sender in subs {
                match sender.try_send(message.clone()) {
                    Ok(()) => sent += 1,
                    Err(e) => {
                        tracing::warn!("Failed to send message: {:?}", e);
                        failed += 1;
                    }
                }
            }

            tracing::debug!(
                "Published to {}: {} sent, {} failed",
                topic,
                sent,
                failed
            );
        } else {
            tracing::debug!("No subscribers for topic: {}", topic);
        }

        Ok(())
    }

    /// Unsubscribe all from topic
    pub async fn unsubscribe_all(&self, topic: &str) {
        let mut subscribers = self.subscribers.write().await;
        subscribers.remove(topic);

        tracing::debug!("Unsubscribed all from topic: {}", topic);
    }

    /// Get topic subscriber count
    pub async fn subscriber_count(&self, topic: &str) -> usize {
        let subscribers = self.subscribers.read().await;
        subscribers.get(topic).map(|s| s.len()).unwrap_or(0)
    }

    /// List all topics
    pub async fn list_topics(&self) -> Vec<String> {
        let subscribers = self.subscribers.read().await;
        subscribers.keys().cloned().collect()
    }

    /// Clear all subscriptions
    pub async fn clear(&self) {
        let mut subscribers = self.subscribers.write().await;
        subscribers.clear();

        tracing::debug!("Cleared all subscriptions");
    }
}

impl Default for PubSubBroker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_pubsub_basic() {
        let broker = PubSubBroker::new();

        // Subscribe
        let mut rx = broker.subscribe("test_topic").await.unwrap();

        // Publish
        let message = b"test message".to_vec();
        broker.publish("test_topic", message.clone()).await.unwrap();

        // Receive
        let received = rx.recv().await.unwrap();
        assert_eq!(received, message);
    }

    #[tokio::test]
    async fn test_multiple_subscribers() {
        let broker = PubSubBroker::new();

        // Multiple subscribers
        let mut rx1 = broker.subscribe("topic").await.unwrap();
        let mut rx2 = broker.subscribe("topic").await.unwrap();
        let mut rx3 = broker.subscribe("topic").await.unwrap();

        assert_eq!(broker.subscriber_count("topic").await, 3);

        // Publish
        let message = b"broadcast".to_vec();
        broker.publish("topic", message.clone()).await.unwrap();

        // All should receive
        assert_eq!(rx1.recv().await.unwrap(), message);
        assert_eq!(rx2.recv().await.unwrap(), message);
        assert_eq!(rx3.recv().await.unwrap(), message);
    }

    #[tokio::test]
    async fn test_topic_isolation() {
        let broker = PubSubBroker::new();

        let mut rx1 = broker.subscribe("topic1").await.unwrap();
        let mut rx2 = broker.subscribe("topic2").await.unwrap();

        // Publish to topic1
        broker.publish("topic1", b"message1".to_vec()).await.unwrap();

        // Only rx1 should receive
        assert_eq!(rx1.recv().await.unwrap(), b"message1");

        // rx2 should timeout
        tokio::select! {
            _ = rx2.recv() => panic!("Should not receive"),
            _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => (),
        }
    }

    #[tokio::test]
    async fn test_unsubscribe() {
        let broker = PubSubBroker::new();

        let _rx = broker.subscribe("topic").await.unwrap();
        assert_eq!(broker.subscriber_count("topic").await, 1);

        broker.unsubscribe_all("topic").await;
        assert_eq!(broker.subscriber_count("topic").await, 0);
    }
}
