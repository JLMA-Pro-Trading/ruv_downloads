# nt-agentdb-client

AgentDB client library for Neural Trader. Provides integration with AgentDB for agent memory and state management.

## Features

- AgentDB connection and query interface
- Vector database operations
- Agent state persistence
- Memory retrieval and storage

## Usage

```rust
use nt_agentdb_client::AgentDbClient;

let client = AgentDbClient::new("http://localhost:8000").await?;
```

## License

Licensed under either of Apache License, Version 2.0 or MIT license at your option.
