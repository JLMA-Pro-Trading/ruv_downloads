// The Odds API integration for sports betting
//
// Features:
// - Real-time odds from 40+ bookmakers
// - Pre-match and live odds
// - Multiple sports (football, basketball, baseball, etc.)
// - Historical odds data

use chrono::{DateTime, Utc};
use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use reqwest::Client;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::num::NonZeroU32;
use std::time::Duration;
use tracing::{debug, error};

/// The Odds API configuration
#[derive(Debug, Clone)]
pub struct OddsAPIConfig {
    /// API key from the-odds-api.com
    pub api_key: String,
    /// Request timeout
    pub timeout: Duration,
}

impl Default for OddsAPIConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            timeout: Duration::from_secs(30),
        }
    }
}

/// The Odds API client for sports betting
pub struct OddsAPIClient {
    client: Client,
    config: OddsAPIConfig,
    base_url: String,
    rate_limiter: DefaultDirectRateLimiter,
}

impl OddsAPIClient {
    /// Create a new Odds API client
    pub fn new(config: OddsAPIConfig) -> Self {
        let client = Client::builder()
            .timeout(config.timeout)
            .build()
            .expect("Failed to create HTTP client");

        // Free tier: 500 requests per month
        let quota = Quota::per_hour(NonZeroU32::new(20).unwrap());
        let rate_limiter = RateLimiter::direct(quota);

        Self {
            client,
            config,
            base_url: "https://api.the-odds-api.com/v4".to_string(),
            rate_limiter,
        }
    }

    /// Get available sports
    pub async fn get_sports(&self) -> Result<Vec<Sport>, OddsAPIError> {
        self.rate_limiter.until_ready().await;

        let url = format!("{}/sports", self.base_url);
        let params = [("apiKey", &self.config.api_key)];

        debug!("Odds API: fetching sports");

        let response = self
            .client
            .get(&url)
            .query(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let sports = response.json().await?;
            Ok(sports)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            error!("Odds API error: {}", error_text);
            Err(OddsAPIError::ApiError(error_text))
        }
    }

    /// Get odds for a specific sport
    pub async fn get_odds(
        &self,
        sport_key: &str,
        regions: Vec<&str>, // us, uk, eu, au
        markets: Vec<&str>, // h2h (moneyline), spreads, totals
        odds_format: &str,  // decimal, american
    ) -> Result<Vec<Event>, OddsAPIError> {
        self.rate_limiter.until_ready().await;

        let url = format!("{}/sports/{}/odds", self.base_url, sport_key);
        let params = [
            ("apiKey", self.config.api_key.as_str()),
            ("regions", &regions.join(",")),
            ("markets", &markets.join(",")),
            ("oddsFormat", odds_format),
        ];

        debug!("Odds API: fetching odds for {}", sport_key);

        let response = self
            .client
            .get(&url)
            .query(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let events = response.json().await?;
            Ok(events)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(OddsAPIError::ApiError(error_text))
        }
    }

    /// Get historical odds
    pub async fn get_historical_odds(
        &self,
        sport_key: &str,
        event_id: &str,
        regions: Vec<&str>,
        markets: Vec<&str>,
        date: DateTime<Utc>,
    ) -> Result<Event, OddsAPIError> {
        self.rate_limiter.until_ready().await;

        let url = format!(
            "{}/sports/{}/events/{}/odds",
            self.base_url, sport_key, event_id
        );

        let params = [
            ("apiKey", self.config.api_key.as_str()),
            ("regions", &regions.join(",")),
            ("markets", &markets.join(",")),
            ("date", &date.to_rfc3339()),
        ];

        let response = self
            .client
            .get(&url)
            .query(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let event = response.json().await?;
            Ok(event)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(OddsAPIError::ApiError(error_text))
        }
    }

    /// Get event scores (for completed games)
    pub async fn get_scores(
        &self,
        sport_key: &str,
        days_from: u32, // Number of days in the past
    ) -> Result<Vec<EventScore>, OddsAPIError> {
        self.rate_limiter.until_ready().await;

        let url = format!("{}/sports/{}/scores", self.base_url, sport_key);
        let params = [
            ("apiKey", self.config.api_key.as_str()),
            ("daysFrom", &days_from.to_string()),
        ];

        let response = self
            .client
            .get(&url)
            .query(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let scores = response.json().await?;
            Ok(scores)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(OddsAPIError::ApiError(error_text))
        }
    }

    /// Find arbitrage opportunities
    pub async fn find_arbitrage(
        &self,
        sport_key: &str,
        regions: Vec<&str>,
    ) -> Result<Vec<ArbitrageOpportunity>, OddsAPIError> {
        let events = self.get_odds(sport_key, regions, vec!["h2h"], "decimal").await?;

        let mut opportunities = Vec::new();

        for event in events {
            for bookmaker in &event.bookmakers {
                for market in &bookmaker.markets {
                    if market.key == "h2h" && market.outcomes.len() == 2 {
                        let outcome1 = &market.outcomes[0];
                        let outcome2 = &market.outcomes[1];

                        // Calculate arbitrage
                        let implied1 = Decimal::ONE / outcome1.price;
                        let implied2 = Decimal::ONE / outcome2.price;
                        let total_implied = implied1 + implied2;

                        if total_implied < Decimal::ONE {
                            let profit_margin = (Decimal::ONE - total_implied) * Decimal::from(100);

                            opportunities.push(ArbitrageOpportunity {
                                event_id: event.id.clone(),
                                home_team: event.home_team.clone(),
                                away_team: event.away_team.clone(),
                                bookmaker: bookmaker.title.clone(),
                                outcome1: outcome1.name.clone(),
                                odds1: outcome1.price,
                                outcome2: outcome2.name.clone(),
                                odds2: outcome2.price,
                                profit_margin,
                            });
                        }
                    }
                }
            }
        }

        Ok(opportunities)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sport {
    pub key: String,
    pub group: String,
    pub title: String,
    pub description: String,
    pub active: bool,
    pub has_outrights: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub sport_key: String,
    pub sport_title: String,
    pub commence_time: String,
    pub home_team: String,
    pub away_team: String,
    pub bookmakers: Vec<Bookmaker>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmaker {
    pub key: String,
    pub title: String,
    pub last_update: String,
    pub markets: Vec<Market>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    pub key: String, // h2h, spreads, totals
    pub last_update: String,
    pub outcomes: Vec<Outcome>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Outcome {
    pub name: String,
    pub price: Decimal,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub point: Option<Decimal>, // For spreads/totals
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventScore {
    pub id: String,
    pub sport_key: String,
    pub commence_time: String,
    pub completed: bool,
    pub home_team: String,
    pub away_team: String,
    pub scores: Option<Vec<TeamScore>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamScore {
    pub name: String,
    pub score: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ArbitrageOpportunity {
    pub event_id: String,
    pub home_team: String,
    pub away_team: String,
    pub bookmaker: String,
    pub outcome1: String,
    pub odds1: Decimal,
    pub outcome2: String,
    pub odds2: Decimal,
    pub profit_margin: Decimal,
}

#[derive(Debug, thiserror::Error)]
pub enum OddsAPIError {
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
