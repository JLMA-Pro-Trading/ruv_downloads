# ACP Integration Implementation Roadmap

## Overview

This roadmap provides a phased, milestone-based plan for integrating the Agentic Commerce Protocol (ACP) into the agentic-payments crate. Each phase includes specific deliverables, success criteria, technical specifications, and testing requirements.

## Project Parameters

- **Timeline**: 12-16 weeks
- **Team Size**: 2-3 developers recommended
- **Effort**: ~18-24 person-weeks
- **Risk Level**: Medium (new protocol, HTTP infrastructure)
- **Backward Compatibility**: Mandatory (zero breaking changes to AP2)

---

## Phase 0: Planning and Preparation (Week 1-2)

### Objectives
- Finalize technical architecture
- Set up development infrastructure
- Create proof-of-concept implementations
- Establish testing and CI/CD pipelines

### Milestone 0.1: Technical Foundation Setup
**Duration**: Week 1
**Effort**: 3-4 days

#### Deliverables
- [ ] Development environment setup documentation
- [ ] Cargo workspace configuration with feature flags
- [ ] CI/CD pipeline for ACP features
- [ ] Benchmarking infrastructure
- [ ] OpenAPI tooling setup (utoipa, swagger-ui)

#### Success Criteria
- ✅ `cargo build --features acp` compiles successfully
- ✅ Existing AP2 tests pass with ACP feature disabled
- ✅ CI runs on every commit with both feature sets
- ✅ OpenAPI documentation generates from code

#### Technical Tasks
```bash
# Update Cargo.toml
[features]
default = ["ap2"]
ap2 = []  # Existing AP2 features
acp = ["axum", "tower", "tower-http", "utoipa", "utoipa-swagger-ui"]
full = ["ap2", "acp"]

[dependencies]
# HTTP server (ACP only)
axum = { version = "0.7", optional = true, features = ["macros"] }
tower = { version = "0.4", optional = true }
tower-http = { version = "0.5", optional = true, features = ["cors", "trace"] }
tokio = { version = "1.35", features = ["full"], optional = true }

# OpenAPI
utoipa = { version = "4.2", optional = true, features = ["axum_extras"] }
utoipa-swagger-ui = { version = "6.0", optional = true, features = ["axum"] }
schemars = { version = "0.8", optional = true }

# Validation
validator = { version = "0.18", optional = true, features = ["derive"] }

# HTTP client (for webhooks)
reqwest = { version = "0.11", optional = true, features = ["json"] }
```

---

### Milestone 0.2: Protocol Abstraction Layer POC
**Duration**: Week 2
**Effort**: 4-5 days

#### Deliverables
- [ ] Protocol trait definitions
- [ ] Protocol router implementation
- [ ] AP2 adapter implementation
- [ ] ACP adapter stub (no-op implementation)
- [ ] Protocol detection logic

#### Success Criteria
- ✅ Protocol abstraction compiles
- ✅ Can route to AP2 implementation
- ✅ Unit tests for protocol detection
- ✅ Zero performance overhead when single protocol used

#### Code Structure
```rust
// src/protocol/mod.rs
pub trait PaymentProtocolHandler: Send + Sync {
    async fn authorize_payment(
        &self,
        request: PaymentRequest,
    ) -> Result<Authorization>;

    async fn verify_credentials(
        &self,
        credentials: &Credentials,
    ) -> Result<VerificationResult>;

    fn protocol_version(&self) -> &str;
}

pub struct ProtocolRouter {
    ap2_handler: Option<Box<dyn PaymentProtocolHandler>>,
    acp_handler: Option<Box<dyn PaymentProtocolHandler>>,
}

impl ProtocolRouter {
    pub async fn route_payment(
        &self,
        request: PaymentRequest,
    ) -> Result<Authorization> {
        let protocol = self.detect_protocol(&request)?;
        match protocol {
            Protocol::AP2 => self.ap2_handler.as_ref()
                .ok_or(Error::ProtocolNotAvailable)?
                .authorize_payment(request).await,
            Protocol::ACP => self.acp_handler.as_ref()
                .ok_or(Error::ProtocolNotAvailable)?
                .authorize_payment(request).await,
        }
    }

    fn detect_protocol(&self, request: &PaymentRequest) -> Result<Protocol> {
        // Check for ACP-specific fields (SPT, checkout_id)
        if request.shared_payment_token.is_some() {
            return Ok(Protocol::ACP);
        }

        // Check for AP2-specific fields (mandate chain)
        if request.intent_mandate.is_some() {
            return Ok(Protocol::AP2);
        }

        // Default or error
        Err(Error::UnknownProtocol)
    }
}
```

#### Testing
- Protocol detection accuracy: 100%
- Routing latency: <1ms
- Concurrent protocol handling

---

## Phase 1: HTTP API Infrastructure (Week 3-6)

### Objectives
- Build RESTful HTTP server
- Implement core ACP endpoints
- Set up authentication and middleware
- Create OpenAPI specification

### Milestone 1.1: HTTP Server Foundation
**Duration**: Week 3
**Effort**: 5-6 days

#### Deliverables
- [ ] Axum HTTP server with graceful shutdown
- [ ] Router configuration with versioning
- [ ] Authentication middleware (API keys)
- [ ] CORS middleware for browser agents
- [ ] Request tracing and logging
- [ ] Health check endpoint
- [ ] Metrics endpoint (Prometheus)

#### Success Criteria
- ✅ Server starts and accepts connections
- ✅ Health check returns 200 OK
- ✅ Authentication middleware blocks unauthenticated requests
- ✅ CORS headers present on all responses
- ✅ Request tracing spans created
- ✅ Metrics exported at `/metrics`

#### Code Structure
```rust
// src/acp/server.rs
use axum::{
    Router,
    routing::{get, post},
    middleware,
    extract::Extension,
};
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
};

pub struct AcpServer {
    router: Router,
    port: u16,
}

impl AcpServer {
    pub fn new(config: ServerConfig) -> Self {
        let router = Router::new()
            // Health check
            .route("/health", get(health_check))
            .route("/metrics", get(metrics))

            // API routes (v1)
            .nest("/v1", api_v1_routes())

            // Middleware
            .layer(TraceLayer::new_for_http())
            .layer(CorsLayer::permissive())
            .layer(middleware::from_fn(auth_middleware))
            .layer(Extension(config));

        Self {
            router,
            port: config.port,
        }
    }

    pub async fn serve(self) -> Result<()> {
        let addr = SocketAddr::from(([0, 0, 0, 0], self.port));
        axum::Server::bind(&addr)
            .serve(self.router.into_make_service())
            .with_graceful_shutdown(shutdown_signal())
            .await?;
        Ok(())
    }
}

fn api_v1_routes() -> Router {
    Router::new()
        .route("/checkout", post(create_checkout))
        .route("/checkout/:id", get(get_checkout))
        .route("/checkout/:id/complete", post(complete_checkout))
        .route("/checkout/:id/cancel", post(cancel_checkout))
}
```

#### Testing
- [ ] Server startup/shutdown tests
- [ ] Authentication bypass attempts
- [ ] CORS preflight requests
- [ ] Health check reliability
- [ ] Metrics accuracy

---

### Milestone 1.2: OpenAPI Integration
**Duration**: Week 4
**Effort**: 5-6 days

#### Deliverables
- [ ] OpenAPI schema generation with utoipa
- [ ] Swagger UI integration
- [ ] Request/response validation
- [ ] Schema compliance tests
- [ ] API documentation generation

#### Success Criteria
- ✅ OpenAPI spec available at `/swagger/openapi.json`
- ✅ Swagger UI accessible at `/swagger-ui`
- ✅ All endpoints documented with examples
- ✅ Request validation rejects invalid payloads
- ✅ 100% schema coverage for all endpoints

#### Code Structure
```rust
// src/acp/openapi.rs
use utoipa::{OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Agentic Commerce Protocol API",
        version = "1.0.0",
        description = "RESTful API for AI agent checkout flows"
    ),
    paths(
        create_checkout,
        get_checkout,
        complete_checkout,
        cancel_checkout,
    ),
    components(
        schemas(
            CheckoutRequest,
            CheckoutResponse,
            CheckoutState,
            OrderItem,
            SharedPaymentToken,
        )
    ),
    tags(
        (name = "checkout", description = "Checkout operations"),
        (name = "webhooks", description = "Webhook management"),
    )
)]
pub struct ApiDoc;

pub fn swagger_routes() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui")
        .url("/swagger/openapi.json", ApiDoc::openapi())
}
```

#### Testing
- [ ] OpenAPI spec validation with validator tools
- [ ] Schema round-trip (serialize → deserialize)
- [ ] Example request execution
- [ ] Client generation from spec (optional)

---

### Milestone 1.3: Checkout API Endpoints
**Duration**: Week 5-6
**Effort**: 8-10 days

#### Deliverables
- [ ] `POST /v1/checkout` - Create checkout session
- [ ] `GET /v1/checkout/:id` - Retrieve checkout state
- [ ] `POST /v1/checkout/:id/complete` - Complete checkout
- [ ] `POST /v1/checkout/:id/cancel` - Cancel checkout
- [ ] Checkout state machine implementation
- [ ] Idempotency key support
- [ ] Rate limiting per endpoint

#### Success Criteria
- ✅ All CRUD operations work correctly
- ✅ State transitions follow ACP specification
- ✅ Idempotency prevents duplicate checkouts
- ✅ Rate limiting blocks excessive requests
- ✅ Error responses follow OpenAPI schema
- ✅ Average latency <50ms for checkout operations

#### Code Structure
```rust
// src/acp/checkout.rs
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CheckoutRequest {
    /// Unique idempotency key to prevent duplicate checkouts
    #[schema(example = "idem_123abc")]
    pub idempotency_key: String,

    /// Line items in the checkout
    pub items: Vec<OrderItem>,

    /// Shipping address (optional for digital goods)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shipping_address: Option<Address>,

    /// Metadata for the checkout
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CheckoutResponse {
    /// Unique checkout identifier
    pub checkout_id: String,

    /// Current checkout state
    pub state: CheckoutState,

    /// Line items with calculated prices
    pub items: Vec<OrderItem>,

    /// Total amount in smallest currency unit
    pub total_amount: i64,

    /// Currency code (ISO 4217)
    pub currency: String,

    /// Checkout expiration timestamp
    pub expires_at: i64,

    /// Available payment methods
    pub payment_methods: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CheckoutState {
    /// Checkout created, awaiting payment
    Pending,

    /// Payment authorized, processing order
    Processing,

    /// Order completed successfully
    Completed,

    /// Checkout cancelled
    Cancelled,

    /// Checkout expired
    Expired,
}

#[utoipa::path(
    post,
    path = "/v1/checkout",
    request_body = CheckoutRequest,
    responses(
        (status = 201, description = "Checkout created", body = CheckoutResponse),
        (status = 400, description = "Invalid request"),
        (status = 409, description = "Duplicate idempotency key"),
    ),
    tag = "checkout"
)]
pub async fn create_checkout(
    Extension(state): Extension<AppState>,
    Json(req): Json<CheckoutRequest>,
) -> Result<Json<CheckoutResponse>, AppError> {
    // Idempotency check
    if let Some(existing) = state.checkout_repo
        .find_by_idempotency_key(&req.idempotency_key).await? {
        return Ok(Json(existing));
    }

    // Create checkout
    let checkout = state.checkout_service
        .create(req).await?;

    Ok(Json(checkout))
}
```

#### Testing
- [ ] Create checkout with valid payload
- [ ] Retrieve existing checkout
- [ ] Complete checkout flow end-to-end
- [ ] Cancel pending checkout
- [ ] Idempotency key collision handling
- [ ] Invalid state transitions rejected
- [ ] Expired checkout handling
- [ ] Rate limiting thresholds

---

## Phase 2: Shared Payment Tokens (Week 7-9)

### Objectives
- Implement SPT data structures
- Build SPT generation and validation
- Integrate with Stripe SPT API
- Abstract PSP layer for non-Stripe processors

### Milestone 2.1: SPT Core Implementation
**Duration**: Week 7
**Effort**: 5-6 days

#### Deliverables
- [ ] SPT data structure
- [ ] Token generation from credentials
- [ ] Token scoping (time, amount, merchant)
- [ ] Token expiration validation
- [ ] Token serialization/deserialization

#### Success Criteria
- ✅ Generate valid SPT from payment method
- ✅ Validate SPT scope constraints
- ✅ Expired tokens rejected
- ✅ Token signing with Ed25519
- ✅ JSON serialization matches ACP format

#### Code Structure
```rust
// src/acp/spt.rs
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SharedPaymentToken {
    /// Unique token identifier
    pub token_id: String,

    /// Reference to underlying payment method
    pub payment_method: String,

    /// Merchant identifier this token is scoped to
    pub merchant_id: String,

    /// Maximum amount that can be charged (smallest currency unit)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount_limit: Option<i64>,

    /// Currency code (ISO 4217)
    pub currency: String,

    /// Token expiration timestamp (Unix)
    pub expires_at: i64,

    /// Allowed operations
    pub scope: Vec<TokenScope>,

    /// Custom metadata
    #[serde(default)]
    pub metadata: HashMap<String, String>,

    /// Ed25519 signature over token data
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum TokenScope {
    Charge,
    Refund,
    Capture,
}

impl SharedPaymentToken {
    /// Generate a new SPT
    pub fn generate(
        payment_method: String,
        merchant_id: String,
        config: SptConfig,
        signing_key: &SigningKey,
    ) -> Result<Self> {
        let token_id = format!("spt_{}", Uuid::new_v4().simple());
        let expires_at = Utc::now().timestamp() + config.ttl_seconds;

        let mut token = Self {
            token_id,
            payment_method,
            merchant_id,
            amount_limit: config.amount_limit,
            currency: config.currency,
            expires_at,
            scope: config.scope,
            metadata: config.metadata,
            signature: String::new(), // Will be set below
        };

        // Sign token
        token.signature = token.sign(signing_key)?;

        Ok(token)
    }

    /// Validate token constraints
    pub fn validate(&self, charge_amount: i64) -> Result<()> {
        // Check expiration
        if Utc::now().timestamp() > self.expires_at {
            return Err(Error::TokenExpired);
        }

        // Check amount limit
        if let Some(limit) = self.amount_limit {
            if charge_amount > limit {
                return Err(Error::AmountExceedsLimit);
            }
        }

        // Verify signature
        self.verify_signature()?;

        Ok(())
    }

    fn sign(&self, key: &SigningKey) -> Result<String> {
        let data = self.signing_data()?;
        let signature = key.sign(&data);
        Ok(base64::encode(signature.to_bytes()))
    }

    fn verify_signature(&self) -> Result<()> {
        // Signature verification logic
        Ok(())
    }

    fn signing_data(&self) -> Result<Vec<u8>> {
        // Canonical JSON for signing
        let json = serde_json::json!({
            "token_id": self.token_id,
            "payment_method": self.payment_method,
            "merchant_id": self.merchant_id,
            "amount_limit": self.amount_limit,
            "currency": self.currency,
            "expires_at": self.expires_at,
            "scope": self.scope,
        });
        Ok(serde_json::to_vec(&json)?)
    }
}
```

#### Testing
- [ ] Generate SPT with various configurations
- [ ] Validate SPT constraints (time, amount)
- [ ] Expired token rejection
- [ ] Invalid signature detection
- [ ] Amount limit enforcement
- [ ] Scope validation

---

### Milestone 2.2: Stripe SPT API Integration
**Duration**: Week 8
**Effort**: 5-6 days

#### Deliverables
- [ ] Stripe API client for SPT operations
- [ ] Create SPT via Stripe API
- [ ] Charge SPT via Stripe API
- [ ] Refund via SPT
- [ ] Webhook handling for Stripe events
- [ ] Error handling for Stripe API errors

#### Success Criteria
- ✅ Successfully create SPT using Stripe API
- ✅ Charge SPT and receive payment confirmation
- ✅ Handle Stripe webhooks for payment events
- ✅ Graceful error handling for API failures
- ✅ Retry logic for transient failures

#### Code Structure
```rust
// src/acp/stripe.rs
use reqwest::Client;

pub struct StripeClient {
    client: Client,
    api_key: String,
    base_url: String,
}

impl StripeClient {
    pub async fn create_shared_payment_token(
        &self,
        payment_method: &str,
        config: SptConfig,
    ) -> Result<SharedPaymentToken> {
        let response = self.client
            .post(&format!("{}/v1/shared_payment_tokens", self.base_url))
            .bearer_auth(&self.api_key)
            .json(&json!({
                "payment_method": payment_method,
                "merchant": config.merchant_id,
                "amount_limit": config.amount_limit,
                "currency": config.currency,
                "expires_in": config.ttl_seconds,
            }))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(Error::StripeApiError(response.text().await?));
        }

        let spt: SharedPaymentToken = response.json().await?;
        Ok(spt)
    }

    pub async fn charge_shared_payment_token(
        &self,
        token: &SharedPaymentToken,
        amount: i64,
        currency: &str,
    ) -> Result<ChargeResponse> {
        // Validate token first
        token.validate(amount)?;

        let response = self.client
            .post(&format!("{}/v1/charges", self.base_url))
            .bearer_auth(&self.api_key)
            .json(&json!({
                "amount": amount,
                "currency": currency,
                "source": token.token_id,
            }))
            .send()
            .await?;

        let charge: ChargeResponse = response.json().await?;
        Ok(charge)
    }
}
```

#### Testing
- [ ] Create SPT via Stripe (test mode)
- [ ] Charge SPT successfully
- [ ] Handle declined charges
- [ ] Webhook signature verification
- [ ] Retry logic for 5xx errors
- [ ] Rate limiting handling

---

### Milestone 2.3: PSP Abstraction Layer
**Duration**: Week 9
**Effort**: 5-6 days

#### Deliverables
- [ ] Payment service provider trait
- [ ] Stripe PSP implementation
- [ ] Mock PSP for testing
- [ ] PSP factory/registry
- [ ] Multi-PSP support

#### Success Criteria
- ✅ Abstract PSP interface defined
- ✅ Stripe implementation complete
- ✅ Mock PSP for unit testing
- ✅ Can switch PSPs via configuration
- ✅ Support for custom PSP implementations

#### Code Structure
```rust
// src/acp/psp.rs
#[async_trait]
pub trait PaymentServiceProvider: Send + Sync {
    async fn create_spt(
        &self,
        payment_method: &str,
        config: SptConfig,
    ) -> Result<SharedPaymentToken>;

    async fn charge_spt(
        &self,
        token: &SharedPaymentToken,
        amount: i64,
        currency: &str,
    ) -> Result<ChargeResponse>;

    async fn refund_charge(
        &self,
        charge_id: &str,
        amount: Option<i64>,
    ) -> Result<RefundResponse>;

    fn provider_name(&self) -> &str;
}

pub struct PspRegistry {
    providers: HashMap<String, Box<dyn PaymentServiceProvider>>,
    default_provider: String,
}

impl PspRegistry {
    pub fn register<P: PaymentServiceProvider + 'static>(
        &mut self,
        name: String,
        provider: P,
    ) {
        self.providers.insert(name, Box::new(provider));
    }

    pub fn get(&self, name: &str) -> Result<&dyn PaymentServiceProvider> {
        self.providers.get(name)
            .map(|p| p.as_ref())
            .ok_or(Error::PspNotFound(name.to_string()))
    }
}
```

#### Testing
- [ ] PSP trait implementation for Stripe
- [ ] Mock PSP for testing
- [ ] PSP registry lookup
- [ ] Multi-PSP scenarios
- [ ] PSP-specific error handling

---

## Phase 3: Merchant Integration (Week 10-13)

### Objectives
- Build merchant management system
- Implement product feed
- Create merchant authentication
- Order tracking and management

### Milestone 3.1: Merchant Management
**Duration**: Week 10-11
**Effort**: 8-10 days

#### Deliverables
- [ ] Merchant data model
- [ ] Merchant registration API
- [ ] API key generation for merchants
- [ ] Merchant configuration (webhooks, PSP)
- [ ] Merchant authentication middleware
- [ ] Storage backend (PostgreSQL or SQLite)

#### Success Criteria
- ✅ Merchant registration creates account
- ✅ API keys generated securely
- ✅ Authentication middleware validates API keys
- ✅ Merchant can configure webhook URLs
- ✅ Merchant can select PSP
- ✅ Data persisted to database

#### Code Structure
```rust
// src/acp/merchant.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Merchant {
    pub merchant_id: String,
    pub name: String,
    pub email: String,
    pub api_keys: Vec<ApiKey>,
    pub webhook_url: Option<String>,
    pub psp_provider: String,
    pub psp_config: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKey {
    pub key_id: String,
    pub key_hash: String, // Hashed with bcrypt
    pub name: String,
    pub permissions: Vec<Permission>,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

pub struct MerchantRepository {
    pool: sqlx::PgPool,
}

impl MerchantRepository {
    pub async fn create(&self, merchant: Merchant) -> Result<()> {
        sqlx::query!(
            "INSERT INTO merchants (id, name, email, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5)",
            merchant.merchant_id,
            merchant.name,
            merchant.email,
            merchant.created_at,
            merchant.updated_at,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn find_by_api_key(&self, key: &str) -> Result<Option<Merchant>> {
        // Hash key and lookup
        Ok(None) // Placeholder
    }
}
```

#### Testing
- [ ] Create merchant account
- [ ] Generate and revoke API keys
- [ ] API key authentication
- [ ] Update merchant configuration
- [ ] Delete merchant
- [ ] Database migrations

---

### Milestone 3.2: Product Feed
**Duration**: Week 12
**Effort**: 5-6 days

#### Deliverables
- [ ] Product data model (following ACP spec)
- [ ] Product feed API endpoints
- [ ] Product search and filtering
- [ ] Product variant support
- [ ] Inventory tracking
- [ ] Image URLs and metadata

#### Success Criteria
- ✅ Products queryable via REST API
- ✅ Search by name, category, price
- ✅ Pagination for large catalogs
- ✅ Product variants correctly handled
- ✅ Follows ACP product feed specification

#### Code Structure
```rust
// src/acp/product_feed.rs
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Product {
    pub product_id: String,
    pub merchant_id: String,
    pub name: String,
    pub description: String,
    pub price: i64,
    pub currency: String,
    pub category: String,
    pub images: Vec<String>,
    pub variants: Vec<ProductVariant>,
    pub available: bool,
    pub metadata: HashMap<String, String>,
}

#[utoipa::path(
    get,
    path = "/v1/products",
    params(
        ("merchant_id" = String, Query, description = "Filter by merchant"),
        ("category" = Option<String>, Query, description = "Filter by category"),
        ("search" = Option<String>, Query, description = "Search query"),
        ("page" = Option<i32>, Query, description = "Page number"),
        ("limit" = Option<i32>, Query, description = "Items per page"),
    ),
    responses(
        (status = 200, description = "Product list", body = ProductListResponse),
    ),
    tag = "products"
)]
pub async fn list_products(
    Extension(state): Extension<AppState>,
    Query(params): Query<ProductQueryParams>,
) -> Result<Json<ProductListResponse>, AppError> {
    let products = state.product_repo
        .list(params).await?;

    Ok(Json(ProductListResponse {
        products,
        total: products.len(),
        page: params.page.unwrap_or(1),
    }))
}
```

#### Testing
- [ ] Create products
- [ ] Query products with filters
- [ ] Paginate through large catalogs
- [ ] Search functionality
- [ ] Product variants
- [ ] Update product availability

---

### Milestone 3.3: Order Management
**Duration**: Week 13
**Effort**: 5-6 days

#### Deliverables
- [ ] Order data model
- [ ] Order creation from checkout
- [ ] Order status tracking
- [ ] Fulfillment status updates
- [ ] Return/refund handling
- [ ] Order history for merchants

#### Success Criteria
- ✅ Orders created from completed checkouts
- ✅ Order status transitions tracked
- ✅ Fulfillment updates propagate
- ✅ Refunds processed correctly
- ✅ Merchant can query order history

#### Code Structure
```rust
// src/acp/order.rs
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Order {
    pub order_id: String,
    pub checkout_id: String,
    pub merchant_id: String,
    pub customer_email: Option<String>,
    pub items: Vec<OrderItem>,
    pub total_amount: i64,
    pub currency: String,
    pub status: OrderStatus,
    pub fulfillment_status: FulfillmentStatus,
    pub payment_status: PaymentStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    Pending,
    Processing,
    Fulfilled,
    Cancelled,
    Refunded,
}
```

#### Testing
- [ ] Create order from checkout
- [ ] Update order status
- [ ] Mark as fulfilled
- [ ] Process refund
- [ ] Query order history
- [ ] Order status webhooks

---

## Phase 4: Webhooks and Events (Week 14-15)

### Objectives
- Implement webhook delivery system
- Event queue and retry logic
- Webhook signature verification
- Webhook management API

### Milestone 4.1: Webhook Infrastructure
**Duration**: Week 14-15
**Effort**: 8-10 days

#### Deliverables
- [ ] Event data structures
- [ ] Event queue (Redis or in-memory)
- [ ] Webhook delivery worker
- [ ] Exponential backoff retry logic
- [ ] Signature generation for webhooks
- [ ] Dead letter queue for failures
- [ ] Webhook subscription management
- [ ] Webhook testing tools

#### Success Criteria
- ✅ Events enqueued reliably
- ✅ Webhooks delivered within 1 second (success case)
- ✅ Retry logic handles transient failures
- ✅ Signatures verified by receivers
- ✅ Failed webhooks moved to DLQ
- ✅ Webhook logs for debugging

#### Code Structure
```rust
// src/acp/webhooks.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookEvent {
    pub event_id: String,
    pub event_type: WebhookEventType,
    pub payload: serde_json::Value,
    pub merchant_id: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WebhookEventType {
    OrderCreated,
    OrderUpdated,
    OrderCompleted,
    OrderCancelled,
    OrderRefunded,
    CheckoutExpired,
}

pub struct WebhookDeliveryWorker {
    queue: Arc<WebhookQueue>,
    http_client: Client,
    signing_key: SigningKey,
}

impl WebhookDeliveryWorker {
    pub async fn deliver_webhook(
        &self,
        event: WebhookEvent,
        webhook_url: &str,
    ) -> Result<()> {
        let signature = self.sign_event(&event)?;

        let response = self.http_client
            .post(webhook_url)
            .header("X-Webhook-Signature", signature)
            .header("X-Webhook-Event-Type", event.event_type.to_string())
            .json(&event)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(Error::WebhookDeliveryFailed);
        }

        Ok(())
    }

    pub async fn process_with_retry(&self, event: WebhookEvent) -> Result<()> {
        let mut attempts = 0;
        let max_attempts = 5;

        loop {
            match self.deliver_webhook(event.clone(), &webhook_url).await {
                Ok(_) => return Ok(()),
                Err(e) if attempts < max_attempts => {
                    attempts += 1;
                    let delay = Duration::from_secs(2u64.pow(attempts));
                    tokio::time::sleep(delay).await;
                }
                Err(e) => {
                    // Move to dead letter queue
                    self.move_to_dlq(event).await?;
                    return Err(e);
                }
            }
        }
    }
}
```

#### Testing
- [ ] Enqueue webhook events
- [ ] Successful delivery
- [ ] Retry on transient failure (5xx)
- [ ] Give up on permanent failure (4xx)
- [ ] Signature verification
- [ ] Dead letter queue handling
- [ ] Event ordering guarantees

---

## Phase 5: Testing, Documentation, Certification (Week 16)

### Objectives
- Comprehensive testing suite
- Documentation and examples
- ACP conformance testing
- Performance benchmarks
- Security audit

### Milestone 5.1: Conformance and Certification
**Duration**: Week 16
**Effort**: 5-6 days

#### Deliverables
- [ ] OpenAI conformance test suite execution
- [ ] Fix any conformance issues
- [ ] Performance benchmarks
- [ ] Security audit report
- [ ] Documentation review
- [ ] Example applications

#### Success Criteria
- ✅ Pass 100% of OpenAI conformance tests
- ✅ Latency <50ms for checkout operations
- ✅ Throughput >5,000 checkouts/sec
- ✅ No critical security vulnerabilities
- ✅ Documentation complete and accurate
- ✅ Working example implementations

#### Testing Checklist
- [ ] All unit tests pass (>90% coverage)
- [ ] All integration tests pass
- [ ] OpenAPI schema validation
- [ ] Conformance tests pass
- [ ] Performance benchmarks meet targets
- [ ] Security scan (cargo-audit, clippy)
- [ ] WASM build successful
- [ ] Example apps run without errors

---

## Rollout Strategy

### Beta Release (Week 17-18)
- Limited beta with select partners
- Gather feedback on API ergonomics
- Identify edge cases
- Performance tuning

### Production Release (Week 19-20)
- Public release announcement
- Full documentation published
- Example applications showcased
- Community support channels opened

---

## Success Metrics

### Technical KPIs
- ✅ All AP2 tests continue to pass
- ✅ 90%+ code coverage for ACP module
- ✅ <50ms p99 latency for checkout API
- ✅ >5,000 checkout operations/second
- ✅ Zero data breaches or security incidents
- ✅ 99.9%+ uptime

### Business KPIs
- 🎯 Enable ChatGPT Instant Checkout integration
- 🎯 Support 10+ merchant integrations in first 3 months
- 🎯 Process 10,000+ checkouts in first month
- 🎯 Positive developer feedback (>4.5/5 rating)

---

## Risk Mitigation

### Technical Risks
1. **OpenAPI Spec Changes**
   - Pin to specific spec version
   - Automated conformance testing
   - Version-locked dependencies

2. **Performance Degradation**
   - Continuous benchmarking
   - Load testing before releases
   - Performance regression tests

3. **Security Vulnerabilities**
   - Regular security audits
   - Dependency scanning
   - Penetration testing

### Operational Risks
1. **Timeline Slippage**
   - 20% buffer in estimates
   - Weekly progress reviews
   - Parallel workstreams where possible

2. **Resource Constraints**
   - Cross-training team members
   - Documentation for onboarding
   - External contractors if needed

---

## Conclusion

This roadmap provides a structured, milestone-based approach to integrating ACP into the agentic-payments crate. By following this plan, we can deliver a production-ready implementation in 12-16 weeks while maintaining backward compatibility with existing AP2 functionality.

**Next Steps**:
1. Review and approve roadmap
2. Assemble development team
3. Set up development infrastructure
4. Begin Phase 0 planning and preparation

---

**Document Version**: 1.0
**Last Updated**: 2025-09-29
**Status**: Draft - Pending Review