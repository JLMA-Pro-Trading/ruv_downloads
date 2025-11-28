// Test Polygon serde deserialization in isolation

use serde::Serialize;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "ev")]
pub enum PolygonEvent {
    #[serde(rename = "T")]
    Trade {
        #[serde(rename = "sym")]
        symbol: String,
        #[serde(rename = "p")]
        price: f64,
    },
    #[serde(rename = "Q")]
    Quote {
        #[serde(rename = "sym")]
        symbol: String,
        #[serde(rename = "bp")]
        bid_price: f64,
    },
}

#[test]
fn test_simple_trade_deser() {
    let json = r#"{"ev":"T","sym":"AAPL","p":150.00}"#;
    let event: PolygonEvent = serde_json::from_str(json).unwrap();
    match event {
        PolygonEvent::Trade { symbol, price } => {
            assert_eq!(symbol, "AAPL");
            assert_eq!(price, 150.00);
        }
        _ => panic!("Wrong type"),
    }
}

#[test]
fn test_array_trade_deser() {
    let json = r#"[{"ev":"T","sym":"AAPL","p":150.00}]"#;
    let events: Vec<PolygonEvent> = serde_json::from_str(json).unwrap();
    assert_eq!(events.len(), 1);
}
