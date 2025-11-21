//! ACP REST API handlers

#[cfg(feature = "acp")]
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json, Response},
};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use uuid::Uuid;

use crate::acp::models::*;

type SharedState = Arc<RwLock<AppState>>;

/// Application state for in-memory storage
#[derive(Default)]
pub struct AppState {
    sessions: HashMap<String, CheckoutSession>,
    idempotency_cache: HashMap<String, CheckoutSession>,
}

/// POST /checkout_sessions
#[cfg(feature = "acp")]
pub async fn create_checkout(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(req): Json<CheckoutSessionCreateRequest>,
) -> Result<(StatusCode, Json<CheckoutSession>), AcpError> {
    // Check idempotency key
    let idempotency_key = headers
        .get("Idempotency-Key")
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    if let Some(key) = &idempotency_key {
        let state_read = state.read().unwrap();
        if let Some(cached) = state_read.idempotency_cache.get(key) {
            return Ok((StatusCode::OK, Json(cached.clone())));
        }
    }

    // Validate request
    if req.items.is_empty() {
        return Err(AcpError::InvalidRequest {
            code: "items_required".to_string(),
            message: "At least one item is required".to_string(),
            param: Some("items".to_string()),
        });
    }

    // Create session
    let mut session = CheckoutSession::new(req.items, "USD".to_string());
    session.buyer = req.buyer;
    session.fulfillment_address = req.fulfillment_address;

    // Calculate totals
    let total_amount: i64 = session.line_items.iter().map(|li| li.total).sum();
    session.totals.push(Total {
        r#type: TotalType::Total,
        display_text: "Total".to_string(),
        amount: total_amount,
    });

    // Update status based on completeness
    if session.buyer.is_some() && session.fulfillment_address.is_some() {
        session.status = CheckoutStatus::ReadyForPayment;
    }

    let id = session.id.clone();
    let mut state_write = state.write().unwrap();
    state_write.sessions.insert(id.clone(), session.clone());

    // Cache for idempotency
    if let Some(key) = idempotency_key {
        state_write.idempotency_cache.insert(key, session.clone());
    }

    Ok((StatusCode::CREATED, Json(session)))
}

/// GET /checkout_sessions/:id
#[cfg(feature = "acp")]
pub async fn get_checkout(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Result<Json<CheckoutSession>, AcpError> {
    let state_read = state.read().unwrap();
    state_read
        .sessions
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(AcpError::SessionNotFound(id))
}

/// POST /checkout_sessions/:id
#[cfg(feature = "acp")]
pub async fn update_checkout(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    Json(req): Json<CheckoutSessionUpdateRequest>,
) -> Result<Json<CheckoutSession>, AcpError> {
    let mut state_write = state.write().unwrap();
    let session = state_write
        .sessions
        .get_mut(&id)
        .ok_or(AcpError::SessionNotFound(id.clone()))?;

    // Check if session can be updated
    if matches!(session.status, CheckoutStatus::Completed | CheckoutStatus::Canceled) {
        return Err(AcpError::SessionCompleted);
    }

    // Update fields
    if let Some(buyer) = req.buyer {
        session.buyer = Some(buyer);
    }
    if let Some(items) = req.items {
        session.line_items = items
            .into_iter()
            .map(|item| {
                let base_amount = 0;
                LineItem {
                    id: format!("li_{}", Uuid::new_v4()),
                    item,
                    base_amount,
                    discount: 0,
                    subtotal: base_amount,
                    tax: 0,
                    total: base_amount,
                }
            })
            .collect();
    }
    if let Some(address) = req.fulfillment_address {
        session.fulfillment_address = Some(address);
    }
    if let Some(option_id) = req.fulfillment_option_id {
        session.fulfillment_option_id = Some(option_id);
    }

    // Recalculate totals
    let total_amount: i64 = session.line_items.iter().map(|li| li.total).sum();
    session.totals = vec![Total {
        r#type: TotalType::Total,
        display_text: "Total".to_string(),
        amount: total_amount,
    }];

    // Update status
    if session.buyer.is_some() && session.fulfillment_address.is_some() {
        session.status = CheckoutStatus::ReadyForPayment;
    }

    Ok(Json(session.clone()))
}

/// POST /checkout_sessions/:id/complete
#[cfg(feature = "acp")]
pub async fn complete_checkout(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    Json(req): Json<CheckoutSessionCompleteRequest>,
) -> Result<Json<CheckoutSessionWithOrder>, AcpError> {
    let mut state_write = state.write().unwrap();
    let session = state_write
        .sessions
        .get_mut(&id)
        .ok_or(AcpError::SessionNotFound(id.clone()))?;

    // Check if session can be completed
    match session.status {
        CheckoutStatus::Completed => return Err(AcpError::SessionCompleted),
        CheckoutStatus::Canceled => return Err(AcpError::SessionCanceled),
        CheckoutStatus::NotReadyForPayment => return Err(AcpError::NotReadyForPayment),
        _ => {}
    }

    // Update buyer if provided
    if let Some(buyer) = req.buyer {
        session.buyer = Some(buyer);
    }

    // Process payment (placeholder)
    if req.payment_data.token.is_empty() {
        return Err(AcpError::PaymentDeclined("Invalid payment token".to_string()));
    }

    // Mark as completed
    session.status = CheckoutStatus::Completed;

    // Create order
    let order = Order {
        id: format!("ord_{}", Uuid::new_v4()),
        checkout_session_id: session.id.clone(),
        permalink_url: format!("https://merchant.example.com/orders/{}", session.id),
    };

    let result = CheckoutSessionWithOrder {
        session: session.clone(),
        order,
    };

    Ok(Json(result))
}

/// POST /checkout_sessions/:id/cancel
#[cfg(feature = "acp")]
pub async fn cancel_checkout(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Result<Json<CheckoutSession>, AcpError> {
    let mut state_write = state.write().unwrap();
    let session = state_write
        .sessions
        .get_mut(&id)
        .ok_or(AcpError::SessionNotFound(id))?;

    // Check if session can be canceled
    if matches!(session.status, CheckoutStatus::Completed | CheckoutStatus::Canceled) {
        return Err(AcpError::CannotCancel);
    }

    session.status = CheckoutStatus::Canceled;
    Ok(Json(session.clone()))
}

/// POST /agentic_commerce/delegate_payment
#[cfg(feature = "acp")]
pub async fn delegate_payment(
    State(_state): State<SharedState>,
    Json(req): Json<DelegatePaymentRequest>,
) -> Result<(StatusCode, Json<DelegatePaymentResponse>), AcpError> {
    // Validate request
    if req.checkout_session_id.is_empty() {
        return Err(AcpError::InvalidRequest {
            code: "session_required".to_string(),
            message: "checkout_session_id is required".to_string(),
            param: Some("checkout_session_id".to_string()),
        });
    }

    // Create payment token (placeholder)
    let token_id = format!("spt_{}", Uuid::new_v4());
    let created = chrono::Utc::now().to_rfc3339();

    let response = DelegatePaymentResponse {
        id: token_id,
        created,
        metadata: req.metadata,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// ACP-specific error type
#[derive(Debug)]
pub enum AcpError {
    InvalidRequest {
        code: String,
        message: String,
        param: Option<String>,
    },
    SessionNotFound(String),
    SessionCompleted,
    SessionCanceled,
    NotReadyForPayment,
    PaymentDeclined(String),
    CannotCancel,
}

#[cfg(feature = "acp")]
impl IntoResponse for AcpError {
    fn into_response(self) -> Response {
        let (status, error_response) = match self {
            AcpError::InvalidRequest { code, message, param } => (
                StatusCode::BAD_REQUEST,
                ErrorResponse {
                    r#type: "invalid_request".to_string(),
                    code,
                    message,
                    param,
                },
            ),
            AcpError::SessionNotFound(id) => (
                StatusCode::NOT_FOUND,
                ErrorResponse {
                    r#type: "invalid_request".to_string(),
                    code: "session_not_found".to_string(),
                    message: format!("Checkout session not found: {}", id),
                    param: Some("checkout_session_id".to_string()),
                },
            ),
            AcpError::SessionCompleted => (
                StatusCode::METHOD_NOT_ALLOWED,
                ErrorResponse {
                    r#type: "invalid_request".to_string(),
                    code: "session_completed".to_string(),
                    message: "Session is already completed".to_string(),
                    param: None,
                },
            ),
            AcpError::SessionCanceled => (
                StatusCode::METHOD_NOT_ALLOWED,
                ErrorResponse {
                    r#type: "invalid_request".to_string(),
                    code: "session_canceled".to_string(),
                    message: "Session is canceled".to_string(),
                    param: None,
                },
            ),
            AcpError::NotReadyForPayment => (
                StatusCode::BAD_REQUEST,
                ErrorResponse {
                    r#type: "invalid_request".to_string(),
                    code: "not_ready_for_payment".to_string(),
                    message: "Session is not ready for payment".to_string(),
                    param: None,
                },
            ),
            AcpError::PaymentDeclined(reason) => (
                StatusCode::PAYMENT_REQUIRED,
                ErrorResponse {
                    r#type: "processing_error".to_string(),
                    code: "payment_declined".to_string(),
                    message: reason,
                    param: None,
                },
            ),
            AcpError::CannotCancel => (
                StatusCode::METHOD_NOT_ALLOWED,
                ErrorResponse {
                    r#type: "invalid_request".to_string(),
                    code: "cannot_cancel".to_string(),
                    message: "Session cannot be canceled".to_string(),
                    param: None,
                },
            ),
        };

        (status, Json(error_response)).into_response()
    }
}