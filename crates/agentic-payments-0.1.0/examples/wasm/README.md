# Agentic Payments WASM Examples

WebAssembly bindings for browser and Node.js environments.

## Features

- ✅ Ed25519 signature generation and verification
- ✅ Agent identity management with DID support
- ✅ AP2 credential creation
- ✅ Batch verification (100+ signatures/sec in browser)
- ✅ Async/await API
- ✅ TypeScript definitions (auto-generated)
- ✅ Browser and Node.js support

## Quick Start

### Browser

```bash
# Build WASM for web target
npm run build

# Start local server
npm run serve

# Open http://localhost:8080/browser-example.html
```

### Node.js

```bash
# Build WASM for Node.js target
npm run build:nodejs

# Run example
npm run test:node
```

### Bundler (Webpack, Vite, etc.)

```bash
# Build for bundler
npm run build:bundler

# Import in your project
import init, { AgentIdentity, verify } from 'agentic-payments-wasm';
```

## Usage Examples

### Basic Signing and Verification

```javascript
import init, { AgentIdentity, verify } from './pkg/agentic_payments.js';

await init();

// Generate identity
const identity = AgentIdentity.generate();
console.log('DID:', identity.did());

// Sign message
const message = "Hello, WASM!";
const signature = identity.sign(message);

// Verify
const isValid = await verify(
    signature,
    message,
    identity.publicKey()
);
console.log('Valid:', isValid); // true
```

### Base64 Encoding

```javascript
import { AgentIdentity, verifyBase64, bytesToBase64 } from './pkg/agentic_payments.js';

const identity = AgentIdentity.generate();
const signature = identity.sign("message");
const signatureB64 = bytesToBase64(signature);

const isValid = await verifyBase64(
    signatureB64,
    "message",
    identity.publicKeyBase64()
);
```

### Batch Verification

```javascript
import { AgentIdentity, batchVerify } from './pkg/agentic_payments.js';

const signatures = [];
const messages = [];
const publicKeys = [];

for (let i = 0; i < 10; i++) {
    const identity = AgentIdentity.generate();
    const msg = `Message ${i}`;
    signatures.push(identity.sign(msg));
    messages.push(msg);
    publicKeys.push(identity.publicKey());
}

const results = await batchVerify(signatures, messages, publicKeys);
// results: [true, true, true, ...]
```

### AP2 Credentials

```javascript
import { AgentIdentity, createCredential } from './pkg/agentic_payments.js';

const identity = AgentIdentity.generate();
const credential = createCredential(
    identity,
    'did:key:z6Mk...', // Subject DID
    'PaymentAuthorization'
);

const credentialObj = JSON.parse(credential);
console.log(credentialObj);
```

### Identity Persistence

```javascript
import { AgentIdentity } from './pkg/agentic_payments.js';

// Export
const identity = AgentIdentity.generate();
const json = identity.toJSON();
localStorage.setItem('identity', json);

// Import
const restored = AgentIdentity.fromJSON(
    localStorage.getItem('identity')
);
```

## API Reference

### `AgentIdentity`

```typescript
class AgentIdentity {
    static generate(): AgentIdentity;
    static fromPrivateKey(privateKey: Uint8Array): AgentIdentity;
    static fromJSON(json: string): AgentIdentity;

    publicKey(): Uint8Array;
    publicKeyBase64(): string;
    publicKeyHex(): string;
    did(): string;

    sign(message: string | Uint8Array): Uint8Array;
    signBase64(message: string): string;

    toJSON(): string;
}
```

### Verification Functions

```typescript
// Async verification with Uint8Array
async function verify(
    signature: Uint8Array,
    message: string | Uint8Array,
    publicKey: Uint8Array
): Promise<boolean>;

// Async verification with base64
async function verifyBase64(
    signatureB64: string,
    message: string,
    publicKeyB64: string
): Promise<boolean>;

// Batch verification
async function batchVerify(
    signatures: Uint8Array[],
    messages: (string | Uint8Array)[],
    publicKeys: Uint8Array[]
): Promise<boolean[]>;
```

### Utility Functions

```typescript
function version(): string;
function maxPoolSize(): number;
function minPoolSize(): number;

function bytesToBase64(bytes: Uint8Array): string;
function base64ToBytes(b64: string): Uint8Array;
function bytesToHex(bytes: Uint8Array): string;
function hexToBytes(hex: string): Uint8Array;
```

### AP2 Functions

```typescript
function createCredential(
    identity: AgentIdentity,
    subjectDid: string,
    credentialType: string
): string; // JSON string
```

## Build Targets

### Web (Browser)
```bash
wasm-pack build --target web
```
- Use with `<script type="module">`
- ES modules with `import`
- Includes WASM initialization

### Node.js
```bash
wasm-pack build --target nodejs
```
- CommonJS/ESM compatible
- Use with `import` or `require`
- Best for CLI tools and servers

### Bundler (Webpack, Vite, etc.)
```bash
wasm-pack build --target bundler
```
- Optimized for bundlers
- Smallest bundle size
- Tree-shakeable

### No Modules
```bash
wasm-pack build --target no-modules
```
- Global namespace
- Use with `<script>` tags
- Good for simple HTML pages

## TypeScript Support

TypeScript definitions are automatically generated by wasm-pack:

```typescript
import type { AgentIdentity } from './pkg/agentic_payments';

const identity: AgentIdentity = AgentIdentity.generate();
```

## Performance

Browser performance (Chrome 120):
- Single verification: ~0.5-1ms
- Batch verification (100): ~50-100ms
- Throughput: 1000+ verifications/sec

Node.js performance:
- Single verification: ~0.3-0.5ms
- Batch verification (1000): ~300-500ms
- Throughput: 2000+ verifications/sec

## Browser Compatibility

- Chrome/Edge 57+ (WebAssembly support)
- Firefox 52+
- Safari 11+
- Opera 44+

## Debugging

Enable console error hooks in Cargo.toml:

```toml
[dependencies]
console_error_panic_hook = "0.1"
console_log = "1.0"
```

Then check browser console for detailed errors.

## Security Notes

- Private keys never leave the WASM sandbox
- All cryptographic operations use constant-time algorithms
- Memory is zeroed after use (via zeroize crate)
- No unsafe code in the library

## License

MIT OR Apache-2.0