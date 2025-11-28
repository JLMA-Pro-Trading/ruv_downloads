// REST API client with rate limiting and retry logic
//
// Performance target: <50ms p99 for API calls

use crate::errors::{MarketDataError, Result};
use governor::{
    clock::DefaultClock,
    state::{direct::NotKeyed, InMemoryState},
    Quota, RateLimiter,
};
use reqwest::{Client, Method, StatusCode};
use serde::{de::DeserializeOwned, Serialize};
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{error, warn};

pub struct RestClient {
    client: Client,
    base_url: String,
    rate_limiter: Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>,
}

impl RestClient {
    pub fn new(base_url: String, requests_per_minute: u32) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");

        let quota = Quota::per_minute(NonZeroU32::new(requests_per_minute).unwrap());
        let rate_limiter = Arc::new(RateLimiter::direct(quota));

        Self {
            client,
            base_url,
            rate_limiter,
        }
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.client = Client::builder()
            .timeout(timeout)
            .build()
            .expect("Failed to build HTTP client");
        self
    }

    /// Make HTTP request with rate limiting
    pub async fn request<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        headers: Vec<(&str, &str)>,
        body: Option<impl Serialize>,
    ) -> Result<T> {
        // Wait for rate limiter
        self.rate_limiter.until_ready().await;

        let url = format!("{}{}", self.base_url, path);
        let mut req = self.client.request(method.clone(), &url);

        // Add headers
        for (key, value) in headers {
            req = req.header(key, value);
        }

        // Add body if present
        if let Some(body) = body {
            req = req.json(&body);
        }

        // Send request with retry
        self.send_with_retry(req, 3).await
    }

    /// Send request with exponential backoff retry
    async fn send_with_retry<T: DeserializeOwned>(
        &self,
        req: reqwest::RequestBuilder,
        max_attempts: u32,
    ) -> Result<T> {
        let mut attempt = 0;
        let mut delay = Duration::from_millis(100);

        loop {
            attempt += 1;

            let req_clone = req
                .try_clone()
                .ok_or_else(|| MarketDataError::Network("Failed to clone request".to_string()))?;

            match req_clone.send().await {
                Ok(response) => {
                    return self.handle_response(response).await;
                }
                Err(e) if attempt >= max_attempts => {
                    error!("Request failed after {} attempts: {}", max_attempts, e);
                    return Err(MarketDataError::Network(e.to_string()));
                }
                Err(e) => {
                    warn!(
                        "Request attempt {} failed: {}, retrying in {:?}",
                        attempt, e, delay
                    );
                    sleep(delay).await;
                    delay *= 2; // Exponential backoff
                }
            }
        }
    }

    /// Handle HTTP response
    async fn handle_response<T: DeserializeOwned>(&self, response: reqwest::Response) -> Result<T> {
        match response.status() {
            StatusCode::OK => response
                .json()
                .await
                .map_err(|e| MarketDataError::Parse(format!("Failed to parse response: {}", e))),
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                let error_text = response.text().await.unwrap_or_default();
                Err(MarketDataError::Auth(error_text))
            }
            StatusCode::TOO_MANY_REQUESTS => Err(MarketDataError::RateLimit),
            StatusCode::NOT_FOUND => Err(MarketDataError::SymbolNotFound("Unknown".to_string())),
            StatusCode::SERVICE_UNAVAILABLE | StatusCode::GATEWAY_TIMEOUT => {
                let error_text = response.text().await.unwrap_or_default();
                Err(MarketDataError::ProviderUnavailable(error_text))
            }
            _ => {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                Err(MarketDataError::Network(format!(
                    "HTTP {}: {}",
                    status, error_text
                )))
            }
        }
    }

    /// GET request
    pub async fn get<T: DeserializeOwned>(
        &self,
        path: &str,
        headers: Vec<(&str, &str)>,
    ) -> Result<T> {
        self.request(Method::GET, path, headers, None::<()>).await
    }

    /// POST request
    pub async fn post<T: DeserializeOwned, B: Serialize>(
        &self,
        path: &str,
        headers: Vec<(&str, &str)>,
        body: B,
    ) -> Result<T> {
        self.request(Method::POST, path, headers, Some(body)).await
    }

    /// DELETE request
    pub async fn delete<T: DeserializeOwned>(
        &self,
        path: &str,
        headers: Vec<(&str, &str)>,
    ) -> Result<T> {
        self.request(Method::DELETE, path, headers, None::<()>)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rest_client_creation() {
        let client = RestClient::new("https://api.example.com".to_string(), 200);
        assert_eq!(client.base_url, "https://api.example.com");
    }

    #[tokio::test]
    async fn test_rate_limiting() {
        let client = RestClient::new("https://api.example.com".to_string(), 60);

        // Rate limiter should allow immediate first call
        let start = std::time::Instant::now();
        client.rate_limiter.until_ready().await;
        assert!(start.elapsed() < Duration::from_millis(100));
    }
}
