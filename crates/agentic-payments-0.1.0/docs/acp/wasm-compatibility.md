# WASM Compatibility for Agentic Commerce Protocol

## Overview

This document outlines WASM (WebAssembly) compatibility considerations for the ACP integration in the agentic-payments crate. The goal is to maintain full WASM support for both AP2 and ACP protocols, enabling browser-based AI agents and lightweight deployments.

## Current WASM Support (AP2)

### Existing Implementation ✅

The agentic-payments crate already has comprehensive WASM support:

**WASM Module Structure**:
```
src/wasm/
├── bindings.rs   # Main wasm-bindgen exports
├── types.rs      # WASM-compatible type definitions
├── utils.rs      # Browser utilities
├── error.rs      # JavaScript-friendly error handling
└── mod.rs        # Module organization
```

**Key Features**:
- ✅ Ed25519 signature verification in browser
- ✅ Agent identity management
- ✅ Verifiable Credential generation
- ✅ Multi-agent consensus simulation
- ✅ No tokio runtime dependency (uses wasm-bindgen-futures)
- ✅ Browser-compatible async via JavaScript promises
- ✅ Local storage integration for key management
- ✅ Console logging for debugging

**Cargo.toml WASM Features**:
```toml
[features]
wasm = [
    "dep:wasm-bindgen",
    "dep:wasm-bindgen-futures",
    "dep:js-sys",
    "dep:web-sys",
    "dep:serde-wasm-bindgen",
    "dep:console_error_panic_hook",
    "dep:console_log",
]

[dependencies]
wasm-bindgen = { version = "0.2", optional = true }
wasm-bindgen-futures = { version = "0.4", optional = true }
js-sys = { version = "0.3", optional = true }
web-sys = { version = "0.3", features = ["console"], optional = true }
serde-wasm-bindgen = { version = "0.6", optional = true }
console_error_panic_hook = { version = "0.1", optional = true }
console_log = { version = "1.0", optional = true }
```

### Current Build Process

```bash
# Build for WASM
wasm-pack build --target web --features wasm

# Build with bundler (for webpack, etc.)
wasm-pack build --target bundler --features wasm

# Build for Node.js
wasm-pack build --target nodejs --features wasm
```

**Output**:
- `pkg/agentic_payments.js` - JavaScript bindings
- `pkg/agentic_payments_bg.wasm` - WASM binary
- `pkg/agentic_payments.d.ts` - TypeScript definitions

## ACP WASM Requirements

### Browser Agent Use Cases

1. **ChatGPT Web Interface**
   - AI agent running in browser context
   - Needs to communicate with merchant checkout APIs
   - Requires HTTP client functionality

2. **Browser Extension Agents**
   - Shopping assistants as browser extensions
   - Product discovery and comparison
   - Direct checkout initiation

3. **Progressive Web Apps (PWAs)**
   - Installable agent applications
   - Offline capability with service workers
   - Background sync for order updates

4. **Mobile Web Agents**
   - Responsive agent interfaces
   - Touch-optimized checkout flows
   - Mobile payment method integration

### WASM Challenges for ACP

| Challenge | Impact | Solution |
|-----------|--------|----------|
| **No HTTP Server** | Can't run axum in WASM | Client-only mode, use merchant's hosted API |
| **No tokio Runtime** | Async runtime unavailable | Use wasm-bindgen-futures |
| **No File System** | Can't use SQLite | Use IndexedDB via web-sys |
| **No TCP Sockets** | Direct network access limited | Use browser fetch API |
| **CORS Restrictions** | Cross-origin API calls blocked | Merchant CORS configuration required |
| **Bundle Size** | HTTP client adds weight | Feature flags, tree shaking |
| **Crypto Performance** | JS slower than native | WebAssembly crypto acceleration |

## WASM-Compatible Architecture

### Client-Only ACP Mode

For WASM deployments, ACP operates in "client mode" where the browser agent communicates with merchant-hosted ACP APIs:

```
┌─────────────────┐
│  Browser Agent  │
│   (WASM)        │
└────────┬────────┘
         │ HTTP (fetch API)
         ↓
┌────────────────────┐
│ Merchant ACP API   │
│ (Server-side)      │
└────────────────────┘
```

**WASM Agent Responsibilities**:
- Create checkout requests
- Generate Shared Payment Tokens (if delegated)
- Verify merchant responses
- Handle webhooks via postMessage
- Manage local state (IndexedDB)

**Server-Side Responsibilities**:
- Host ACP HTTP endpoints
- Process checkout sessions
- Deliver webhooks
- Manage order state
- Integrate with payment processors

### Feature Flag Strategy

```toml
[features]
# Existing features
default = ["ap2"]
ap2 = []
wasm = ["wasm-bindgen", "wasm-bindgen-futures", "js-sys", "web-sys"]

# New ACP features
acp = ["axum", "tower", "utoipa"]  # Server-side only
acp-client = ["reqwest"]           # HTTP client for WASM

# Combined WASM support
wasm-acp = ["wasm", "acp-client"]
wasm-full = ["wasm", "ap2", "acp-client"]

# Server build
server = ["ap2", "acp", "tokio"]
```

**Build Examples**:
```bash
# WASM with AP2 only (existing)
wasm-pack build --features wasm

# WASM with ACP client support
wasm-pack build --features wasm-acp

# WASM with both protocols
wasm-pack build --features wasm-full

# Server build (non-WASM)
cargo build --features server
```

## WASM-Specific Implementations

### 1. HTTP Client (reqwest with wasm feature)

```toml
[dependencies]
reqwest = { version = "0.11", default-features = false, features = ["json"], optional = true }

# WASM-specific reqwest features
[target.'cfg(target_arch = "wasm32")'.dependencies]
reqwest = { version = "0.11", default-features = false, features = ["json", "js"], optional = true }
```

**Usage in WASM**:
```rust
// src/acp/wasm_client.rs
#[cfg(target_arch = "wasm32")]
use reqwest::Client;

pub struct WasmAcpClient {
    client: Client,
    base_url: String,
}

impl WasmAcpClient {
    pub fn new(base_url: String) -> Self {
        let client = Client::new();
        Self { client, base_url }
    }

    pub async fn create_checkout(
        &self,
        request: CheckoutRequest,
    ) -> Result<CheckoutResponse> {
        let response = self.client
            .post(&format!("{}/v1/checkout", self.base_url))
            .json(&request)
            .send()
            .await?;

        let checkout: CheckoutResponse = response.json().await?;
        Ok(checkout)
    }
}
```

### 2. Storage (IndexedDB via web-sys)

Instead of SQLite (not available in WASM), use IndexedDB:

```rust
// src/acp/wasm_storage.rs
#[cfg(target_arch = "wasm32")]
use web_sys::{IdbDatabase, IdbFactory, window};

pub struct IndexedDbStorage {
    db: IdbDatabase,
}

impl IndexedDbStorage {
    pub async fn new(db_name: &str) -> Result<Self> {
        let window = window().ok_or(Error::NoWindow)?;
        let factory: IdbFactory = window
            .indexed_db()?
            .ok_or(Error::NoIndexedDb)?;

        let open_request = factory.open(db_name)?;

        // Convert to async using wasm-bindgen-futures
        let db = wasm_bindgen_futures::JsFuture::from(open_request)
            .await?
            .dyn_into::<IdbDatabase>()?;

        Ok(Self { db })
    }

    pub async fn store_checkout(&self, checkout: &CheckoutResponse) -> Result<()> {
        let transaction = self.db
            .transaction_with_str_and_mode(
                "checkouts",
                web_sys::IdbTransactionMode::Readwrite,
            )?;

        let store = transaction.object_store("checkouts")?;

        let value = serde_wasm_bindgen::to_value(checkout)?;
        let key = JsValue::from_str(&checkout.checkout_id);

        let request = store.put_with_key(&value, &key)?;
        wasm_bindgen_futures::JsFuture::from(request).await?;

        Ok(())
    }

    pub async fn get_checkout(&self, checkout_id: &str) -> Result<Option<CheckoutResponse>> {
        let transaction = self.db
            .transaction_with_str("checkouts")?;

        let store = transaction.object_store("checkouts")?;

        let key = JsValue::from_str(checkout_id);
        let request = store.get(&key)?;

        let result = wasm_bindgen_futures::JsFuture::from(request).await?;

        if result.is_null() || result.is_undefined() {
            return Ok(None);
        }

        let checkout: CheckoutResponse = serde_wasm_bindgen::from_value(result)?;
        Ok(Some(checkout))
    }
}
```

### 3. Webhooks via postMessage

Browsers can't receive direct HTTP webhooks. Instead, use postMessage for cross-origin communication:

```rust
// src/acp/wasm_webhooks.rs
#[cfg(target_arch = "wasm32")]
use web_sys::{window, MessageEvent};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

#[wasm_bindgen]
pub struct WebhookReceiver {
    callback: Closure<dyn FnMut(MessageEvent)>,
}

#[wasm_bindgen]
impl WebhookReceiver {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<WebhookReceiver, JsValue> {
        let callback = Closure::wrap(Box::new(move |event: MessageEvent| {
            if let Ok(data) = event.data().into_serde::<WebhookEvent>() {
                // Process webhook event
                Self::handle_webhook(data);
            }
        }) as Box<dyn FnMut(MessageEvent)>);

        let window = window().ok_or(JsValue::from_str("No window"))?;
        window.add_event_listener_with_callback(
            "message",
            callback.as_ref().unchecked_ref(),
        )?;

        Ok(Self { callback })
    }

    fn handle_webhook(event: WebhookEvent) {
        web_sys::console::log_1(&JsValue::from_str(&format!(
            "Received webhook: {:?}",
            event
        )));

        // Update local state, trigger UI updates, etc.
    }
}

// Usage in JavaScript:
// window.postMessage({ type: "order.completed", payload: {...} }, "*");
```

### 4. Local Key Management

Store Ed25519 keys securely in browser:

```rust
// src/wasm/key_storage.rs
#[cfg(target_arch = "wasm32")]
use web_sys::window;

pub struct WasmKeyStorage;

impl WasmKeyStorage {
    /// Store key in localStorage (encrypted recommended)
    pub fn store_key(key_id: &str, key_bytes: &[u8]) -> Result<()> {
        let window = window().ok_or(Error::NoWindow)?;
        let storage = window
            .local_storage()?
            .ok_or(Error::NoLocalStorage)?;

        let encoded = base64::encode(key_bytes);
        storage.set_item(key_id, &encoded)?;
        Ok(())
    }

    /// Retrieve key from localStorage
    pub fn get_key(key_id: &str) -> Result<Option<Vec<u8>>> {
        let window = window().ok_or(Error::NoWindow)?;
        let storage = window
            .local_storage()?
            .ok_or(Error::NoLocalStorage)?;

        if let Some(encoded) = storage.get_item(key_id)? {
            let bytes = base64::decode(encoded)?;
            Ok(Some(bytes))
        } else {
            Ok(None)
        }
    }

    /// Delete key from localStorage
    pub fn delete_key(key_id: &str) -> Result<()> {
        let window = window().ok_or(Error::NoWindow)?;
        let storage = window
            .local_storage()?
            .ok_or(Error::NoLocalStorage)?;

        storage.remove_item(key_id)?;
        Ok(())
    }
}
```

## WASM Bundle Size Optimization

### Baseline Sizes
- **AP2 WASM (current)**: ~250KB gzipped
- **Target ACP WASM**: <500KB gzipped

### Optimization Techniques

1. **Feature Flags**: Only include needed functionality
2. **LTO (Link Time Optimization)**: Cargo profile settings
3. **wasm-opt**: Post-build optimization
4. **Tree Shaking**: Remove unused code
5. **Lazy Loading**: Split into multiple WASM modules

**Optimized Cargo.toml**:
```toml
[profile.release]
opt-level = "z"       # Optimize for size
lto = true            # Link-time optimization
codegen-units = 1     # Better optimization
strip = true          # Strip symbols
panic = "abort"       # Smaller panic handler
```

**Build Script**:
```bash
#!/bin/bash
# Build and optimize WASM

# Build with wasm-pack
wasm-pack build \
    --target web \
    --features wasm-acp \
    --release

# Optimize with wasm-opt (from binaryen)
wasm-opt \
    -Oz \
    --enable-simd \
    --enable-bulk-memory \
    pkg/agentic_payments_bg.wasm \
    -o pkg/agentic_payments_bg.wasm

# Compress with brotli
brotli -q 11 pkg/agentic_payments_bg.wasm

# Report size
ls -lh pkg/agentic_payments_bg.wasm*
```

## Performance Considerations

### Crypto Performance in WASM

| Operation | Native (Rust) | WASM (Browser) | Overhead |
|-----------|---------------|----------------|----------|
| Ed25519 Sign | ~30μs | ~100μs | 3.3x |
| Ed25519 Verify | ~60μs | ~200μs | 3.3x |
| SHA-256 Hash | ~5μs | ~20μs | 4x |
| JSON Serialize | ~10μs | ~30μs | 3x |

**Mitigation**:
- Use SIMD instructions where available
- Batch operations to amortize overhead
- Cache verification results
- Use Web Crypto API for hashing (faster than WASM)

### Network Performance

WASM network operations use browser fetch API:
- **Latency**: Same as native browser requests
- **Throughput**: Limited by browser connection pooling
- **CORS**: Requires proper server configuration

## Testing WASM Implementation

### Unit Tests
```bash
# Run WASM tests in headless browser
wasm-pack test --headless --chrome --features wasm-acp

# Run with Firefox
wasm-pack test --headless --firefox --features wasm-acp
```

### Integration Tests
```javascript
// JavaScript test using WASM module
import init, { WasmAcpClient } from './pkg/agentic_payments.js';

async function testCheckout() {
    await init();

    const client = new WasmAcpClient('https://merchant.example.com');

    const checkout = await client.create_checkout({
        items: [{ product_id: 'prod_123', quantity: 1 }],
        idempotency_key: 'test_' + Date.now(),
    });

    console.log('Checkout created:', checkout);
}

testCheckout();
```

### Browser Compatibility Testing
- Chrome/Chromium (v90+)
- Firefox (v89+)
- Safari (v14+)
- Edge (v90+)
- Mobile browsers (iOS Safari, Chrome Android)

## Example: Complete WASM ACP Agent

```rust
// src/wasm/acp_agent.rs
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct AcpAgent {
    client: WasmAcpClient,
    storage: IndexedDbStorage,
    key_storage: WasmKeyStorage,
}

#[wasm_bindgen]
impl AcpAgent {
    #[wasm_bindgen(constructor)]
    pub async fn new(merchant_url: String) -> Result<AcpAgent, JsValue> {
        console_error_panic_hook::set_once();

        let client = WasmAcpClient::new(merchant_url);
        let storage = IndexedDbStorage::new("acp-agent")
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(Self {
            client,
            storage,
            key_storage: WasmKeyStorage,
        })
    }

    #[wasm_bindgen]
    pub async fn create_checkout(
        &self,
        items: JsValue,
    ) -> Result<JsValue, JsValue> {
        let items: Vec<OrderItem> = serde_wasm_bindgen::from_value(items)?;

        let request = CheckoutRequest {
            idempotency_key: format!("checkout_{}", js_sys::Date::now()),
            items,
            shipping_address: None,
            metadata: HashMap::new(),
        };

        let checkout = self.client
            .create_checkout(request)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Store locally
        self.storage
            .store_checkout(&checkout)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(serde_wasm_bindgen::to_value(&checkout)?)
    }

    #[wasm_bindgen]
    pub async fn get_checkout(&self, checkout_id: String) -> Result<JsValue, JsValue> {
        // Try local storage first
        if let Some(checkout) = self.storage
            .get_checkout(&checkout_id)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?
        {
            return Ok(serde_wasm_bindgen::to_value(&checkout)?);
        }

        // Fetch from server if not found locally
        let checkout = self.client
            .get_checkout(&checkout_id)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Cache locally
        self.storage
            .store_checkout(&checkout)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(serde_wasm_bindgen::to_value(&checkout)?)
    }
}
```

**Usage in HTML**:
```html
<!DOCTYPE html>
<html>
<head>
    <title>ACP WASM Agent Demo</title>
</head>
<body>
    <h1>Agentic Commerce Agent (WASM)</h1>
    <button id="createCheckout">Create Checkout</button>
    <pre id="output"></pre>

    <script type="module">
        import init, { AcpAgent } from './pkg/agentic_payments.js';

        async function main() {
            await init();

            const agent = await new AcpAgent('https://merchant.example.com');

            document.getElementById('createCheckout').onclick = async () => {
                const checkout = await agent.create_checkout([
                    { product_id: 'prod_123', quantity: 1, price: 1999 }
                ]);

                document.getElementById('output').textContent =
                    JSON.stringify(checkout, null, 2);
            };
        }

        main();
    </script>
</body>
</html>
```

## Deployment Strategies

### CDN Hosting
```bash
# Build for CDN distribution
wasm-pack build --target web --features wasm-acp --release

# Upload to CDN
aws s3 sync pkg/ s3://your-cdn-bucket/agentic-payments/v1/
```

### NPM Package
```bash
# Build for npm
wasm-pack build --target bundler --features wasm-acp --release

# Publish
cd pkg && npm publish
```

### Browser Extension
```json
// manifest.json
{
  "manifest_version": 3,
  "name": "ACP Shopping Agent",
  "version": "1.0.0",
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }],
  "web_accessible_resources": [{
    "resources": ["pkg/*.wasm"],
    "matches": ["<all_urls>"]
  }]
}
```

## Success Criteria

### WASM ACP Implementation Checklist
- [ ] HTTP client works in browser (reqwest with wasm feature)
- [ ] IndexedDB storage for checkouts
- [ ] postMessage webhook receiver
- [ ] localStorage key management
- [ ] Bundle size <500KB gzipped
- [ ] Performance within 4x of native
- [ ] Works in all major browsers
- [ ] TypeScript definitions generated
- [ ] Example HTML page works
- [ ] Tests pass in headless browser

## Next Steps

1. **Prototype HTTP Client**: Test reqwest in WASM with ACP API
2. **IndexedDB Storage**: Implement checkout caching
3. **Bundle Size Analysis**: Measure and optimize
4. **Browser Testing**: Verify cross-browser compatibility
5. **Documentation**: Create WASM-specific API docs
6. **Examples**: Build complete WASM demo app

---

**Document Version**: 1.0
**Last Updated**: 2025-09-29
**Status**: Planning - Implementation Pending