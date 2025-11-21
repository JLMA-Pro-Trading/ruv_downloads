# nt-napi-bindings

Node.js N-API bindings for Neural Trader. Provides JavaScript/TypeScript interface to Rust trading engine.

## Features

- Node.js native module
- TypeScript type definitions
- High-performance trading operations
- Cross-platform support

## Usage

```javascript
const neuralTrader = require('nt-napi-bindings');

const trader = new neuralTrader.Trader(config);
await trader.executeTrade(order);
```

## License

Licensed under either of Apache License, Version 2.0 or MIT license at your option.
