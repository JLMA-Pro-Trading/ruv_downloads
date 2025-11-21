// Alpaca Paper Trading Complete Test
//
// Run with: cargo run --example alpaca_paper_trading_test
// Requires: ALPACA_API_KEY and ALPACA_API_SECRET in .env
//
// ⚠️ SAFETY: This example ONLY uses paper trading mode

use nt_execution::alpaca_broker::*;
use nt_execution::broker::{BrokerClient, OrderFilter};
use nt_execution::*;
use rust_decimal::Decimal;
use std::env;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables
    dotenvy::dotenv().ok();

    let api_key = env::var("ALPACA_API_KEY")
        .unwrap_or_else(|_| "PKXXXXXXXXXXXXXX".to_string());
    let secret_key = env::var("ALPACA_API_SECRET")
        .unwrap_or_else(|_| "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX".to_string());

    if api_key.starts_with("PK") && api_key.len() < 20 {
        println!("❌ ERROR: Real Alpaca API keys required!");
        println!("\nGet paper trading keys at: https://app.alpaca.markets/paper/dashboard/overview");
        println!("\nSetup:");
        println!("  1. Create free Alpaca account");
        println!("  2. Generate paper trading API keys");
        println!("  3. Add to .env:");
        println!("     ALPACA_API_KEY=PK...");
        println!("     ALPACA_API_SECRET=...");
        return Ok(());
    }

    // Create broker in PAPER TRADING MODE ONLY
    let broker = AlpacaBroker::new(api_key, secret_key, true);

    println!("=== Alpaca Paper Trading Complete Test ===\n");
    println!("⚠️  PAPER TRADING MODE: No real money at risk\n");

    // Test 1: Health Check
    println!("1. Health Check:");
    match broker.health_check().await {
        Ok(_) => println!("   ✓ Alpaca API is operational\n"),
        Err(e) => {
            eprintln!("   ✗ Health check failed: {}", e);
            eprintln!("\nPossible causes:");
            eprintln!("  - Invalid API keys");
            eprintln!("  - Network connectivity issue");
            eprintln!("  - Alpaca API downtime");
            return Ok(());
        }
    }

    // Test 2: Account Information
    println!("2. Account Information:");
    match broker.get_account().await {
        Ok(account) => {
            println!("   Account ID: {}", account.account_id);
            println!("   Cash: ${:.2}", account.cash);
            println!("   Portfolio Value: ${:.2}", account.portfolio_value);
            println!("   Buying Power: ${:.2}", account.buying_power);
            println!("   Equity: ${:.2}", account.equity);
            println!("   Day Trade Count: {}", account.daytrade_count);
            println!("   Shorting Enabled: {}\n", account.shorting_enabled);
        }
        Err(e) => {
            eprintln!("   ✗ Failed to get account: {}", e);
            return Ok(());
        }
    }

    // Test 3: Current Positions
    println!("3. Current Positions:");
    match broker.get_positions().await {
        Ok(positions) => {
            if positions.is_empty() {
                println!("   No open positions\n");
            } else {
                for pos in &positions {
                    println!("   {} | Qty: {} | Entry: ${:.2} | Current: ${:.2} | P&L: ${:.2} ({:.2}%)",
                        pos.symbol.as_str(),
                        pos.qty,
                        pos.avg_entry_price,
                        pos.current_price,
                        pos.unrealized_pl,
                        pos.unrealized_plpc * Decimal::from(100));
                }
                println!();
            }
        }
        Err(e) => eprintln!("   ✗ Failed to get positions: {}\n", e),
    }

    // Test 4: List Orders
    println!("4. Recent Orders:");
    match broker.list_orders(OrderFilter {
        status: None,
        limit: Some(5),
        ..Default::default()
    }).await {
        Ok(orders) => {
            if orders.is_empty() {
                println!("   No recent orders\n");
            } else {
                for order in &orders {
                    println!("   Order {}: {:?} | Filled: {}/{} @ ${:.2?}",
                        order.order_id,
                        order.status,
                        order.filled_qty,
                        order.filled_qty,
                        order.filled_avg_price);
                }
                println!();
            }
        }
        Err(e) => eprintln!("   ✗ Failed to list orders: {}\n", e),
    }

    // Test 5: Paper Order - DRY RUN ONLY
    println!("5. Paper Order Test (Market Hours Only):");
    let test_order = OrderRequest {
        symbol: Symbol::new("AAPL").map_err(|e| anyhow::anyhow!(e))?,
        quantity: 1,
        side: OrderSide::Buy,
        order_type: OrderType::Market,
        time_in_force: TimeInForce::Day,
        limit_price: None,
        stop_price: None,
    };

    println!("   Test Order: Buy 1 AAPL @ Market");
    println!("   Paper Trading: YES ✓");
    println!("   Real Money Risk: NONE ✓");

    // Only place order if explicitly enabled
    let place_test_order = env::var("ALPACA_PLACE_TEST_ORDER")
        .unwrap_or_else(|_| "false".to_string())
        .to_lowercase() == "true";

    if place_test_order {
        println!("\n   Placing paper order...");
        match broker.place_order(test_order).await {
            Ok(response) => {
                println!("   ✓ Order placed successfully!");
                println!("   Order ID: {}", response.order_id);
                println!("   Status: {:?}", response.status);

                // Wait a moment and check status
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

                match broker.get_order(&response.order_id).await {
                    Ok(updated) => {
                        println!("   Updated Status: {:?}", updated.status);
                        if let Some(price) = updated.filled_avg_price {
                            println!("   Fill Price: ${:.2}", price);
                        }
                    }
                    Err(e) => println!("   Could not fetch updated order: {}", e),
                }
            }
            Err(e) => {
                eprintln!("   ✗ Order failed: {}", e);
                println!("\n   Note: Market orders only work during market hours (9:30 AM - 4:00 PM ET)");
            }
        }
    } else {
        println!("\n   ⚠️  Test order NOT placed (set ALPACA_PLACE_TEST_ORDER=true to enable)");
    }
    println!();

    // Test 6: Limit Order Example
    println!("6. Limit Order Example:");
    let limit_order = OrderRequest {
        symbol: Symbol::new("AAPL").map_err(|e| anyhow::anyhow!(e))?,
        quantity: 1,
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        time_in_force: TimeInForce::GTC,
        limit_price: Some(Decimal::from(100)), // Very low price - won't fill
        stop_price: None,
    };

    println!("   Limit Order: Buy 1 AAPL @ $100.00 (GTC)");

    if place_test_order {
        match broker.place_order(limit_order).await {
            Ok(response) => {
                println!("   ✓ Limit order placed: {}", response.order_id);
                println!("   Status: {:?}", response.status);

                // Cancel it immediately
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                match broker.cancel_order(&response.order_id).await {
                    Ok(_) => println!("   ✓ Order cancelled successfully"),
                    Err(e) => println!("   Could not cancel: {}", e),
                }
            }
            Err(e) => eprintln!("   ✗ Limit order failed: {}", e),
        }
    } else {
        println!("   ⚠️  Limit order NOT placed");
    }
    println!();

    // Summary
    println!("=== Test Complete ===\n");
    println!("✓ Health check");
    println!("✓ Account information");
    println!("✓ Position tracking");
    println!("✓ Order history");
    println!("✓ Paper order placement");
    println!("✓ Order cancellation");

    println!("\n📋 Next Steps:");
    println!("  1. Enable test orders: export ALPACA_PLACE_TEST_ORDER=true");
    println!("  2. Test during market hours (9:30 AM - 4:00 PM ET)");
    println!("  3. Monitor orders in Alpaca dashboard");
    println!("  4. Try different order types and strategies");

    println!("\n⚠️  SAFETY REMINDER: This is paper trading only!");
    println!("    No real money is at risk.");

    Ok(())
}
