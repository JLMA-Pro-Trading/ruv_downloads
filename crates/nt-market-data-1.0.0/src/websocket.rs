// WebSocket client with automatic reconnection and backpressure handling
//
// Performance target: <100μs per message processing

use crate::errors::{MarketDataError, Result};
use futures::{SinkExt, StreamExt};
use std::time::Duration;
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{error, info, warn};

pub struct WebSocketClient {
    url: String,
    reconnect_delay: Duration,
    max_reconnect_attempts: usize,
}

impl WebSocketClient {
    pub fn new(url: String) -> Self {
        Self {
            url,
            reconnect_delay: Duration::from_secs(5),
            max_reconnect_attempts: 10,
        }
    }

    pub fn with_reconnect_delay(mut self, delay: Duration) -> Self {
        self.reconnect_delay = delay;
        self
    }

    pub fn with_max_attempts(mut self, attempts: usize) -> Self {
        self.max_reconnect_attempts = attempts;
        self
    }

    /// Connect to WebSocket with exponential backoff retry
    pub async fn connect_with_retry(&self) -> Result<WebSocketStream> {
        let mut attempts = 0;
        let mut delay = self.reconnect_delay;

        loop {
            match connect_async(&self.url).await {
                Ok((ws_stream, _)) => {
                    info!("WebSocket connected to {}", self.url);
                    return Ok(WebSocketStream {
                        inner: ws_stream,
                        url: self.url.clone(),
                    });
                }
                Err(e) if attempts < self.max_reconnect_attempts => {
                    attempts += 1;
                    warn!(
                        "WebSocket connection failed (attempt {}/{}): {}",
                        attempts, self.max_reconnect_attempts, e
                    );

                    sleep(delay).await;
                    delay *= 2; // Exponential backoff
                }
                Err(e) => {
                    error!("WebSocket connection failed after {} attempts", attempts);
                    return Err(MarketDataError::WebSocket(e.to_string()));
                }
            }
        }
    }

    /// Run WebSocket with automatic reconnection
    pub async fn run_with_reconnect<F, Fut>(&self, mut handler: F) -> Result<()>
    where
        F: FnMut(Message) -> Fut + Send,
        Fut: std::future::Future<Output = Result<()>> + Send,
    {
        loop {
            let mut stream = self.connect_with_retry().await?;

            // Process messages until error
            while let Some(msg) = stream.inner.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Err(e) = handler(Message::Text(text)).await {
                            error!("Handler error: {}", e);
                        }
                    }
                    Ok(Message::Binary(data)) => {
                        if let Err(e) = handler(Message::Binary(data)).await {
                            error!("Handler error: {}", e);
                        }
                    }
                    Ok(Message::Ping(data)) => {
                        if let Err(e) = stream.inner.send(Message::Pong(data)).await {
                            error!("Failed to send pong: {}", e);
                            break;
                        }
                    }
                    Ok(Message::Close(_)) => {
                        info!("WebSocket closed by server");
                        break;
                    }
                    Err(e) => {
                        error!("WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }

            warn!(
                "WebSocket disconnected, reconnecting in {:?}",
                self.reconnect_delay
            );
            sleep(self.reconnect_delay).await;
        }
    }
}

pub struct WebSocketStream {
    inner: tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    url: String,
}

impl WebSocketStream {
    pub async fn send(&mut self, msg: Message) -> Result<()> {
        self.inner
            .send(msg)
            .await
            .map_err(|e| MarketDataError::WebSocket(e.to_string()))
    }

    pub async fn next(&mut self) -> Option<Result<Message>> {
        self.inner
            .next()
            .await
            .map(|r| r.map_err(|e| MarketDataError::WebSocket(e.to_string())))
    }

    pub fn url(&self) -> &str {
        &self.url
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_websocket_client_creation() {
        let client = WebSocketClient::new("wss://example.com".to_string())
            .with_reconnect_delay(Duration::from_secs(1))
            .with_max_attempts(3);

        assert_eq!(client.url, "wss://example.com");
        assert_eq!(client.max_reconnect_attempts, 3);
    }
}
