# @neural-trader/agentic-accounting-core

Core library for the agentic accounting system, providing precise tax calculations, compliance checking, and forensic analysis capabilities for trading portfolios.

## Features

- **Precise Decimal Arithmetic**: Uses `decimal.js` for accurate financial calculations without floating-point errors
- **Comprehensive Data Models**: TypeScript interfaces for transactions, tax lots, disposals, positions, and more
- **Multiple Accounting Methods**: Support for FIFO, LIFO, HIFO, Specific ID, and Average Cost
- **Tax Classification**: Automatic short-term vs long-term capital gains calculation
- **Database Integration**: PostgreSQL client with connection pooling
- **Type Safety**: Strict TypeScript configuration with comprehensive type definitions

## Installation

```bash
npm install @neural-trader/agentic-accounting-core
```

## Usage

### Basic Example

```typescript
import {
  Transaction,
  TransactionType,
  DecimalMath,
  Decimal
} from '@neural-trader/agentic-accounting-core';
import { v4 as uuidv4 } from 'uuid';

// Create a transaction
const transaction: Transaction = {
  id: uuidv4(),
  timestamp: new Date('2024-01-15T10:00:00Z'),
  type: TransactionType.BUY,
  asset: 'BTC',
  quantity: new Decimal('1.5'),
  price: new Decimal('45000'),
  fees: new Decimal('25'),
  currency: 'USD',
  source: 'Coinbase',
  sourceId: 'cb-123456',
  taxable: true,
  metadata: {},
};

// Calculate total cost
const totalCost = DecimalMath.add(
  DecimalMath.multiply(transaction.quantity, transaction.price),
  transaction.fees
);

console.log(`Total cost: $${DecimalMath.toFixed(totalCost, 2)}`);
// Output: Total cost: $67525.00
```

### Database Connection

```typescript
import { createDatabaseClient, DatabaseConfig } from '@neural-trader/agentic-accounting-core';

const config: DatabaseConfig = {
  host: 'localhost',
  port: 5432,
  database: 'accounting_db',
  user: 'accounting_user',
  password: process.env.DB_PASSWORD,
  max: 20, // connection pool size
  min: 2,
  idleTimeoutMillis: 30000,
};

const db = await createDatabaseClient(config);

// Query example
const result = await db.query('SELECT * FROM transactions WHERE asset = $1', ['BTC']);

// Transaction example
await db.transaction(async (client) => {
  await client.query('INSERT INTO transactions (...) VALUES ($1, $2)', [value1, value2]);
  await client.query('INSERT INTO tax_lots (...) VALUES ($1, $2)', [value3, value4]);
});

// Cleanup
await db.disconnect();
```

### Decimal Math Utilities

```typescript
import { DecimalMath, Decimal } from '@neural-trader/agentic-accounting-core';

// Basic arithmetic
const a = new Decimal('100.50');
const b = new Decimal('50.25');

const sum = DecimalMath.add(a, b);            // 150.75
const difference = DecimalMath.subtract(a, b); // 50.25
const product = DecimalMath.multiply(a, b);    // 5050.125
const quotient = DecimalMath.divide(a, b);     // 2.0

// Aggregate operations
const values = [
  new Decimal('10'),
  new Decimal('20'),
  new Decimal('30'),
];

const total = DecimalMath.sum(values);        // 60
const average = DecimalMath.average(values);  // 20

// Weighted average for cost basis calculation
const lots: Array<[Decimal, Decimal]> = [
  [new Decimal('45000'), new Decimal('1.0')],  // [price, quantity]
  [new Decimal('47000'), new Decimal('1.5')],
];

const avgCost = DecimalMath.weightedAverage(lots); // 46200

// Percentage calculations
const gain = new Decimal('5000');
const costBasis = new Decimal('45000');
const gainPercent = DecimalMath.percentage(gain, costBasis); // 11.11
```

## Data Models

### Core Types

- **Transaction**: Financial transaction records
- **TaxLot**: Individual acquisition lots for tax tracking
- **Disposal**: Sale/trade records with gain/loss calculations
- **Position**: Current holdings and unrealized gains
- **ComplianceRule**: Rule definitions for validation
- **AuditEntry**: Immutable audit trail entries

### Enums

- `TransactionType`: BUY, SELL, TRADE, INCOME, EXPENSE, TRANSFER
- `AccountingMethod`: FIFO, LIFO, HIFO, SPECIFIC_ID, AVERAGE_COST
- `CapitalGainTerm`: SHORT, LONG
- `LotStatus`: OPEN, PARTIAL, CLOSED
- `RuleType`: WASH_SALE, TRADING_LIMIT, SEGREGATION_DUTY, etc.

## API Reference

### DecimalMath

Utility class for precise decimal arithmetic:

- `from(value)` - Create Decimal from number/string/Decimal
- `add(a, b)` - Addition
- `subtract(a, b)` - Subtraction
- `multiply(a, b)` - Multiplication
- `divide(a, b)` - Division
- `percentage(value, total)` - Calculate percentage
- `round(value, places)` - Round to decimal places
- `sum(values)` - Sum array of decimals
- `average(values)` - Calculate average
- `weightedAverage(values)` - Calculate weighted average
- `min(a, b)` / `max(a, b)` - Min/max comparison
- `equals(a, b)` / `compare(a, b)` - Equality and comparison

### DatabaseClient

PostgreSQL client with connection pooling:

- `connect()` - Initialize connection pool
- `disconnect()` - Close all connections
- `query(text, params)` - Execute query
- `getClient()` - Get client for transactions
- `transaction(callback)` - Execute within transaction
- `getPoolStats()` - Get pool statistics
- `isConnected()` - Check connection status

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## License

MIT

## Related Packages

- `@neural-trader/agentic-accounting-agents` - Agent implementations
- `@neural-trader/agentic-accounting-mcp` - MCP server
- `@neural-trader/agentic-accounting-api` - REST/GraphQL APIs
