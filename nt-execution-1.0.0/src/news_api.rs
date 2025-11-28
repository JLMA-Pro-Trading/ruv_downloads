// NewsAPI integration for sentiment analysis
//
// Features:
// - Real-time news from 80,000+ sources
// - Sentiment analysis ready
// - Historical news search
// - Top headlines by country/category

use chrono::{DateTime, Utc};
use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::num::NonZeroU32;
use std::time::Duration;
use tracing::{debug, error};

/// NewsAPI configuration
#[derive(Debug, Clone)]
pub struct NewsAPIConfig {
    /// API key from newsapi.org
    pub api_key: String,
    /// Request timeout
    pub timeout: Duration,
}

impl Default for NewsAPIConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            timeout: Duration::from_secs(30),
        }
    }
}

/// NewsAPI client for market sentiment
pub struct NewsAPIClient {
    client: Client,
    config: NewsAPIConfig,
    base_url: String,
    rate_limiter: DefaultDirectRateLimiter,
}

impl NewsAPIClient {
    /// Create a new NewsAPI client
    pub fn new(config: NewsAPIConfig) -> Self {
        let client = Client::builder()
            .timeout(config.timeout)
            .build()
            .expect("Failed to create HTTP client");

        // Free tier: 100 requests per day
        // Paid tier: 250-100,000 requests per day
        let quota = Quota::per_hour(NonZeroU32::new(100).unwrap());
        let rate_limiter = RateLimiter::direct(quota);

        Self {
            client,
            config,
            base_url: "https://newsapi.org/v2".to_string(),
            rate_limiter,
        }
    }

    /// Search for news articles
    pub async fn search(
        &self,
        query: &str,
        from: Option<DateTime<Utc>>,
        to: Option<DateTime<Utc>>,
        language: Option<&str>,
        sort_by: Option<&str>, // relevancy, popularity, publishedAt
    ) -> Result<Vec<NewsArticle>, NewsAPIError> {
        self.rate_limiter.until_ready().await;

        let mut params = vec![
            ("q", query.to_string()),
            ("apiKey", self.config.api_key.clone()),
        ];

        if let Some(from_date) = from {
            params.push(("from", from_date.format("%Y-%m-%dT%H:%M:%S").to_string()));
        }

        if let Some(to_date) = to {
            params.push(("to", to_date.format("%Y-%m-%dT%H:%M:%S").to_string()));
        }

        if let Some(lang) = language {
            params.push(("language", lang.to_string()));
        }

        if let Some(sort) = sort_by {
            params.push(("sortBy", sort.to_string()));
        }

        debug!("NewsAPI search: {}", query);

        let response = self
            .client
            .get(&format!("{}/everything", self.base_url))
            .query(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let result: NewsAPIResponse = response.json().await?;

            if result.status == "ok" {
                Ok(result.articles)
            } else {
                Err(NewsAPIError::ApiError(
                    result.message.unwrap_or_else(|| "Unknown error".to_string()),
                ))
            }
        } else {
            let error_text = response.text().await.unwrap_or_default();
            error!("NewsAPI error: {}", error_text);
            Err(NewsAPIError::ApiError(error_text))
        }
    }

    /// Get top headlines
    pub async fn top_headlines(
        &self,
        country: Option<&str>, // us, gb, ca, etc.
        category: Option<&str>, // business, technology, etc.
        sources: Option<Vec<String>>,
    ) -> Result<Vec<NewsArticle>, NewsAPIError> {
        self.rate_limiter.until_ready().await;

        let mut params = vec![("apiKey", self.config.api_key.clone())];

        if let Some(country_code) = country {
            params.push(("country", country_code.to_string()));
        }

        if let Some(cat) = category {
            params.push(("category", cat.to_string()));
        }

        if let Some(source_list) = sources {
            params.push(("sources", source_list.join(",")));
        }

        let response = self
            .client
            .get(&format!("{}/top-headlines", self.base_url))
            .query(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let result: NewsAPIResponse = response.json().await?;

            if result.status == "ok" {
                Ok(result.articles)
            } else {
                Err(NewsAPIError::ApiError(
                    result.message.unwrap_or_else(|| "Unknown error".to_string()),
                ))
            }
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(NewsAPIError::ApiError(error_text))
        }
    }

    /// Get news sources
    pub async fn sources(
        &self,
        category: Option<&str>,
        language: Option<&str>,
        country: Option<&str>,
    ) -> Result<Vec<NewsSource>, NewsAPIError> {
        self.rate_limiter.until_ready().await;

        let mut params = vec![("apiKey", self.config.api_key.clone())];

        if let Some(cat) = category {
            params.push(("category", cat.to_string()));
        }

        if let Some(lang) = language {
            params.push(("language", lang.to_string()));
        }

        if let Some(country_code) = country {
            params.push(("country", country_code.to_string()));
        }

        let response = self
            .client
            .get(&format!("{}/sources", self.base_url))
            .query(&params)
            .send()
            .await?;

        if response.status().is_success() {
            #[derive(Deserialize)]
            struct SourcesResponse {
                status: String,
                sources: Vec<NewsSource>,
            }

            let result: SourcesResponse = response.json().await?;

            if result.status == "ok" {
                Ok(result.sources)
            } else {
                Err(NewsAPIError::ApiError("Failed to fetch sources".to_string()))
            }
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(NewsAPIError::ApiError(error_text))
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsArticle {
    pub source: NewsSourceInfo,
    pub author: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub url: String,
    pub url_to_image: Option<String>,
    pub published_at: String,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsSourceInfo {
    pub id: Option<String>,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsSource {
    pub id: String,
    pub name: String,
    pub description: String,
    pub url: String,
    pub category: String,
    pub language: String,
    pub country: String,
}

#[derive(Debug, Deserialize)]
struct NewsAPIResponse {
    status: String,
    #[serde(default)]
    message: Option<String>,
    #[serde(rename = "totalResults")]
    total_results: Option<i32>,
    #[serde(default)]
    articles: Vec<NewsArticle>,
}

#[derive(Debug, thiserror::Error)]
pub enum NewsAPIError {
    #[error("API error: {0}")]
    ApiError(String),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Parse error: {0}")]
    Parse(#[from] serde_json::Error),

    #[error("Rate limit exceeded")]
    RateLimit,

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}
