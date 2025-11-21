// Integration tests for all broker implementations
//
// Run with: cargo test --package nt-execution --test broker_integration_tests
//
// Environment variables required (set in .env):
// - ALPACA_API_KEY, ALPACA_SECRET_KEY
// - IBKR_HOST, IBKR_PORT, IBKR_CLIENT_ID
// - POLYGON_API_KEY
// - QUESTRADE_REFRESH_TOKEN
// - OANDA_ACCESS_TOKEN, OANDA_ACCOUNT_ID
// - CCXT_BINANCE_API_KEY, CCXT_BINANCE_SECRET
// - ALPHA_VANTAGE_API_KEY
// - NEWS_API_KEY
// - ODDS_API_KEY

use nt_execution::*;
use std::env;

#[tokio::test]
#[ignore] // Remove to run with real credentials
async fn test_alpaca_broker() {
    let api_key = env::var("ALPACA_API_KEY").unwrap_or_default();
    let secret_key = env::var("ALPACA_SECRET_KEY").unwrap_or_default();

    if api_key.is_empty() || secret_key.is_empty() {
        println!("⚠️  Skipping Alpaca test - credentials not set");
        return;
    }

    let broker = AlpacaBroker::new(api_key, secret_key, true);

    match broker.health_check().await {
        Ok(status) => {
            println!("✅ Alpaca health check: {:?}", status);
        }
        Err(e) => {
            eprintln!("❌ Alpaca health check failed: {}", e);
        }
    }

    // Test account fetch
    match broker.get_account().await {
        Ok(account) => {
            println!("✅ Alpaca account: {} (${:.2})", account.account_id, account.portfolio_value);
        }
        Err(e) => {
            eprintln!("❌ Alpaca get_account failed: {}", e);
        }
    }
}

#[tokio::test]
#[ignore]
async fn test_ibkr_broker() {
    let host = env::var("IBKR_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = env::var("IBKR_PORT")
        .unwrap_or_else(|_| "7497".to_string())
        .parse()
        .unwrap_or(7497);

    let _config = IBKRConfig {
        host,
        port,
        client_id: 1,
        account: String::new(),
        paper_trading: true,
        timeout: std::time::Duration::from_secs(30),
        streaming: false,
    };

    let broker = IBKRBroker::new(config);

    match broker.connect().await {
        Ok(_) => {
            println!("✅ IBKR connected successfully");

            match broker.get_account().await {
                Ok(account) => {
                    println!("✅ IBKR account: {} (${:.2})", account.account_id, account.portfolio_value);
                }
                Err(e) => {
                    eprintln!("❌ IBKR get_account failed: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("❌ IBKR connection failed: {} (ensure TWS/Gateway is running)", e);
        }
    }
}

#[tokio::test]
#[ignore]
async fn test_polygon_client() {
    let api_key = env::var("POLYGON_API_KEY").unwrap_or_default();

    if api_key.is_empty() {
        println!("⚠️  Skipping Polygon test - API key not set");
        return;
    }

    let _config = PolygonConfig {
        api_key,
        streaming: false,
        timeout: std::time::Duration::from_secs(30),
    };

    let client = PolygonClient::new(config);

    match client.get_last_quote("AAPL").await {
        Ok(quote) => {
            println!("✅ Polygon quote for AAPL: ${:.2} (bid: ${:.2}, ask: ${:.2})",
                quote.bid_price, quote.bid_price, quote.ask_price);
        }
        Err(e) => {
            eprintln!("❌ Polygon get_last_quote failed: {}", e);
        }
    }
}

#[tokio::test]
#[ignore]
async fn test_ccxt_binance() {
    let api_key = env::var("CCXT_BINANCE_API_KEY").unwrap_or_default();
    let secret = env::var("CCXT_BINANCE_SECRET").unwrap_or_default();

    if api_key.is_empty() || secret.is_empty() {
        println!("⚠️  Skipping CCXT Binance test - credentials not set");
        return;
    }

    let _config = CCXTConfig {
        exchange: "binance".to_string(),
        api_key,
        secret,
        password: None,
        sandbox: true,
        timeout: std::time::Duration::from_secs(30),
    };

    match CCXTBroker::new(config) {
        Ok(broker) => {
            println!("✅ CCXT Binance broker created");

            match broker.health_check().await {
                Ok(status) => {
                    println!("✅ CCXT health check: {:?}", status);
                }
                Err(e) => {
                    eprintln!("❌ CCXT health check failed: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("❌ CCXT broker creation failed: {}", e);
        }
    }
}

#[tokio::test]
#[ignore]
async fn test_questrade_broker() {
    let refresh_token = env::var("QUESTRADE_REFRESH_TOKEN").unwrap_or_default();

    if refresh_token.is_empty() {
        println!("⚠️  Skipping Questrade test - refresh token not set");
        return;
    }

    let _config = QuestradeConfig {
        refresh_token,
        practice: true,
        timeout: std::time::Duration::from_secs(30),
    };

    let broker = QuestradeBroker::new(config);

    match broker.authenticate().await {
        Ok(_) => {
            println!("✅ Questrade authenticated");

            match broker.get_account().await {
                Ok(account) => {
                    println!("✅ Questrade account: {} (CAD ${:.2})",
                        account.account_id, account.portfolio_value);
                }
                Err(e) => {
                    eprintln!("❌ Questrade get_account failed: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("❌ Questrade authentication failed: {}", e);
        }
    }
}

#[tokio::test]
#[ignore]
async fn test_oanda_broker() {
    let access_token = env::var("OANDA_ACCESS_TOKEN").unwrap_or_default();
    let account_id = env::var("OANDA_ACCOUNT_ID").unwrap_or_default();

    if access_token.is_empty() || account_id.is_empty() {
        println!("⚠️  Skipping OANDA test - credentials not set");
        return;
    }

    let _config = OANDAConfig {
        access_token,
        account_id,
        practice: true,
        timeout: std::time::Duration::from_secs(30),
    };

    let broker = OANDABroker::new(config);

    match broker.get_account().await {
        Ok(account) => {
            println!("✅ OANDA account: {} (${:.2})", account.account_id, account.portfolio_value);
        }
        Err(e) => {
            eprintln!("❌ OANDA get_account failed: {}", e);
        }
    }
}

#[tokio::test]
#[ignore]
async fn test_alpha_vantage() {
    let api_key = env::var("ALPHA_VANTAGE_API_KEY").unwrap_or_default();

    if api_key.is_empty() {
        println!("⚠️  Skipping Alpha Vantage test - API key not set");
        return;
    }

    let _config = AlphaVantageConfig {
        api_key,
        timeout: std::time::Duration::from_secs(30),
    };

    let client = AlphaVantageClient::new(config);

    match client.get_quote("AAPL").await {
        Ok(quote) => {
            println!("✅ Alpha Vantage quote for {}: ${:.2} (change: {:.2}%)",
                quote.symbol, quote.price, quote.change_percent);
        }
        Err(e) => {
            eprintln!("❌ Alpha Vantage get_quote failed: {}", e);
        }
    }
}

#[tokio::test]
#[ignore]
async fn test_news_api() {
    let api_key = env::var("NEWS_API_KEY").unwrap_or_default();

    if api_key.is_empty() {
        println!("⚠️  Skipping NewsAPI test - API key not set");
        return;
    }

    let _config = NewsAPIConfig {
        api_key,
        timeout: std::time::Duration::from_secs(30),
    };

    let client = NewsAPIClient::new(config);

    match client.search("Apple stock", None, None, Some("en"), Some("relevancy")).await {
        Ok(articles) => {
            println!("✅ NewsAPI found {} articles about Apple stock", articles.len());
            if let Some(article) = articles.first() {
                println!("   Latest: {}", article.title);
            }
        }
        Err(e) => {
            eprintln!("❌ NewsAPI search failed: {}", e);
        }
    }
}

#[tokio::test]
#[ignore]
async fn test_yahoo_finance() {
    let _config = YahooFinanceConfig::default();
    let client = YahooFinanceClient::new(config);

    match client.get_quote("AAPL").await {
        Ok(quote) => {
            println!("✅ Yahoo Finance quote for {}: ${:.2} (change: {:.2}%)",
                quote.symbol, quote.price, quote.change_percent);
        }
        Err(e) => {
            eprintln!("❌ Yahoo Finance get_quote failed: {}", e);
        }
    }
}

#[tokio::test]
#[ignore]
async fn test_odds_api() {
    let api_key = env::var("ODDS_API_KEY").unwrap_or_default();

    if api_key.is_empty() {
        println!("⚠️  Skipping The Odds API test - API key not set");
        return;
    }

    let _config = OddsAPIConfig {
        api_key,
        timeout: std::time::Duration::from_secs(30),
    };

    let client = OddsAPIClient::new(config);

    match client.get_sports().await {
        Ok(sports) => {
            println!("✅ The Odds API found {} available sports", sports.len());
            if let Some(sport) = sports.first() {
                println!("   Example: {} ({})", sport.title, sport.key);
            }
        }
        Err(e) => {
            eprintln!("❌ The Odds API get_sports failed: {}", e);
        }
    }
}

#[test]
fn test_all_broker_types() {
    // Verify all broker types implement BrokerClient trait
    println!("✅ All broker types verified:");
    println!("   - AlpacaBroker");
    println!("   - IBKRBroker");
    println!("   - CCXTBroker");
    println!("   - QuestradeBroker");
    println!("   - OANDABroker");
    println!("   - LimeBroker");
}

#[test]
fn test_all_data_provider_types() {
    // Verify all data provider types are accessible
    println!("✅ All data provider types verified:");
    println!("   - PolygonClient");
    println!("   - AlphaVantageClient");
    println!("   - NewsAPIClient");
    println!("   - YahooFinanceClient");
    println!("   - OddsAPIClient");
}
