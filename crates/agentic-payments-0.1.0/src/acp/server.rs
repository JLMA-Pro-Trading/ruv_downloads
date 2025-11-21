//! ACP HTTP server with axum router

#[cfg(feature = "acp")]
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::{Arc, RwLock};

use crate::acp::handlers::*;

/// Create the ACP router with all endpoints
#[cfg(feature = "acp")]
pub fn create_router() -> Router {
    let state = Arc::new(RwLock::new(AppState::default()));

    Router::new()
        .route("/checkout_sessions", post(create_checkout))
        .route("/checkout_sessions/:id", get(get_checkout))
        .route("/checkout_sessions/:id", post(update_checkout))
        .route("/checkout_sessions/:id/complete", post(complete_checkout))
        .route("/checkout_sessions/:id/cancel", post(cancel_checkout))
        .route("/agentic_commerce/delegate_payment", post(delegate_payment))
        .with_state(state)
}

#[cfg(all(test, feature = "acp"))]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_create_checkout() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/checkout_sessions")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"items":[{"id":"item_123","quantity":1}]}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
    }

    #[tokio::test]
    async fn test_create_checkout_with_idempotency() {
        let app = create_router();

        let body = r#"{"items":[{"id":"item_123","quantity":1}]}"#;
        let idempotency_key = "test_key_123";

        // First request
        let response1 = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/checkout_sessions")
                    .header("content-type", "application/json")
                    .header("Idempotency-Key", idempotency_key)
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response1.status(), StatusCode::CREATED);

        // Second request with same key
        let response2 = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/checkout_sessions")
                    .header("content-type", "application/json")
                    .header("Idempotency-Key", idempotency_key)
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response2.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_get_checkout_not_found() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/checkout_sessions/csn_nonexistent")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_delegate_payment() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/agentic_commerce/delegate_payment")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{
                            "checkout_session_id":"csn_123",
                            "payment_method":{"type":"card"},
                            "allowance":{"max_amount":10000}
                        }"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);
    }

    #[tokio::test]
    async fn test_complete_checkout_flow() {
        let app = create_router();

        // Step 1: Create session
        let create_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/checkout_sessions")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{
                            "items":[{"id":"item_123","quantity":2}],
                            "buyer":{"first_name":"John","last_name":"Doe","email":"john@example.com"},
                            "fulfillment_address":{
                                "name":"John Doe",
                                "line_one":"123 Main St",
                                "city":"San Francisco",
                                "state":"CA",
                                "country":"US",
                                "postal_code":"94102"
                            }
                        }"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(create_response.status(), StatusCode::CREATED);

        let body = hyper::body::to_bytes(create_response.into_body())
            .await
            .unwrap();
        let session: crate::acp::models::CheckoutSession =
            serde_json::from_slice(&body).unwrap();

        // Step 2: Complete session
        let complete_response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/checkout_sessions/{}/complete", session.id))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"payment_data":{"token":"tok_123","provider":"stripe"}}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(complete_response.status(), StatusCode::OK);
    }
}