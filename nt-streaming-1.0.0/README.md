# nt-streaming

Real-time market data streaming for Neural Trader. Provides WebSocket connections to market data providers.

## Features

- Real-time market data streaming
- WebSocket connection management
- Multiple data source support
- Automatic reconnection

## Usage

```rust
use nt_streaming::StreamingClient;

let client = StreamingClient::new(config);
client.subscribe(vec!["AAPL", "GOOGL"]).await?;
```

## License

Licensed under either of Apache License, Version 2.0 or MIT license at your option.
