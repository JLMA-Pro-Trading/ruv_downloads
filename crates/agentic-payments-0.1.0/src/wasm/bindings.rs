//! Main WASM bindings for agentic-payments

use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use js_sys::{Promise, Uint8Array};
use ed25519_dalek::{Signer, Verifier, SigningKey, VerifyingKey};

use crate::crypto::{self, AgentIdentity as RustAgentIdentity, Signature as RustSignature};
use crate::ap2::{Credential, CredentialSubject, Issuer};
use super::error::{WasmError, WasmResult};
use super::types::{VerificationResult, to_uint8_array, from_uint8_array, to_js_value};
use super::utils::now_ms;

/// Agent Identity for WASM
#[wasm_bindgen]
pub struct AgentIdentity {
    inner: RustAgentIdentity,
}

#[wasm_bindgen]
impl AgentIdentity {
    /// Generate a new agent identity
    #[wasm_bindgen]
    pub fn generate() -> Result<AgentIdentity, JsValue> {
        RustAgentIdentity::generate()
            .map(|inner| AgentIdentity { inner })
            .map_err(|e| WasmError::from(e).into())
    }

    /// Create identity from private key bytes (32 bytes)
    #[wasm_bindgen(js_name = fromPrivateKey)]
    pub fn from_private_key(private_key: &Uint8Array) -> Result<AgentIdentity, JsValue> {
        let bytes = from_uint8_array(private_key);

        if bytes.len() != 32 {
            return Err(WasmError::new(
                "Private key must be exactly 32 bytes".to_string(),
                "CryptoError".to_string(),
            ).into());
        }

        let mut key_bytes = [0u8; 32];
        key_bytes.copy_from_slice(&bytes);

        let signing_key = SigningKey::from_bytes(&key_bytes);

        RustAgentIdentity::from_signing_key(signing_key)
            .map(|inner| AgentIdentity { inner })
            .map_err(|e| WasmError::from(e).into())
    }

    /// Get public key as bytes (32 bytes)
    #[wasm_bindgen(js_name = publicKey)]
    pub fn public_key(&self) -> Uint8Array {
        to_uint8_array(self.inner.verifying_key().as_bytes())
    }

    /// Get public key as base64
    #[wasm_bindgen(js_name = publicKeyBase64)]
    pub fn public_key_base64(&self) -> String {
        base64::encode(self.inner.verifying_key().as_bytes())
    }

    /// Get public key as hex
    #[wasm_bindgen(js_name = publicKeyHex)]
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.inner.verifying_key().as_bytes())
    }

    /// Get DID identifier
    #[wasm_bindgen]
    pub fn did(&self) -> String {
        self.inner.did().to_string()
    }

    /// Sign a message (accepts string or Uint8Array)
    #[wasm_bindgen]
    pub fn sign(&self, message: JsValue) -> Result<Uint8Array, JsValue> {
        let message_bytes = if message.is_string() {
            message.as_string().unwrap().into_bytes()
        } else if message.is_instance_of::<Uint8Array>() {
            from_uint8_array(&Uint8Array::from(message))
        } else {
            return Err(WasmError::new(
                "Message must be string or Uint8Array".to_string(),
                "TypeError".to_string(),
            ).into());
        };

        self.inner.sign(&message_bytes)
            .map(|sig| to_uint8_array(&sig.to_bytes()))
            .map_err(|e| WasmError::from(e).into())
    }

    /// Sign and return base64 signature
    #[wasm_bindgen(js_name = signBase64)]
    pub fn sign_base64(&self, message: &str) -> Result<String, JsValue> {
        self.inner.sign(message.as_bytes())
            .map(|sig| base64::encode(&sig.to_bytes()))
            .map_err(|e| WasmError::from(e).into())
    }

    /// Export as JSON
    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner)
            .map_err(|e| WasmError::new(
                format!("JSON serialization error: {}", e),
                "SerializationError".to_string(),
            ).into())
    }

    /// Import from JSON
    #[wasm_bindgen(js_name = fromJSON)]
    pub fn from_json(json: &str) -> Result<AgentIdentity, JsValue> {
        serde_json::from_str::<RustAgentIdentity>(json)
            .map(|inner| AgentIdentity { inner })
            .map_err(|e| WasmError::new(
                format!("JSON deserialization error: {}", e),
                "DeserializationError".to_string(),
            ).into())
    }
}

/// Verify a signature (synchronous)
#[wasm_bindgen]
pub fn verify_sync(
    signature: &Uint8Array,
    message: JsValue,
    public_key: &Uint8Array,
) -> Result<bool, JsValue> {
    let sig_bytes = from_uint8_array(signature);
    let pk_bytes = from_uint8_array(public_key);

    let message_bytes = if message.is_string() {
        message.as_string().unwrap().into_bytes()
    } else if message.is_instance_of::<Uint8Array>() {
        from_uint8_array(&Uint8Array::from(message))
    } else {
        return Err(WasmError::new(
            "Message must be string or Uint8Array".to_string(),
            "TypeError".to_string(),
        ).into());
    };

    // Parse signature
    let signature = RustSignature::from_bytes(&sig_bytes)
        .map_err(|e| WasmError::from(e))?;

    // Parse public key
    let verifying_key = VerifyingKey::from_bytes(
        pk_bytes.as_slice().try_into()
            .map_err(|_| WasmError::new(
                "Public key must be 32 bytes".to_string(),
                "CryptoError".to_string(),
            ))?
    ).map_err(|e| WasmError::new(
        format!("Invalid public key: {}", e),
        "CryptoError".to_string(),
    ))?;

    crypto::verify_signature(&verifying_key, &message_bytes, &signature)
        .map_err(|e| WasmError::from(e).into())
}

/// Verify a signature (asynchronous for consistency)
#[wasm_bindgen]
pub fn verify(
    signature: Uint8Array,
    message: JsValue,
    public_key: Uint8Array,
) -> Promise {
    future_to_promise(async move {
        verify_sync(&signature, message, &public_key)
            .map(|valid| JsValue::from(valid))
    })
}

/// Verify a base64-encoded signature
#[wasm_bindgen(js_name = verifyBase64)]
pub fn verify_base64(
    signature_b64: &str,
    message: &str,
    public_key_b64: &str,
) -> Promise {
    let sig_b64 = signature_b64.to_string();
    let msg = message.to_string();
    let pk_b64 = public_key_b64.to_string();

    future_to_promise(async move {
        let sig_bytes = base64::decode(&sig_b64)
            .map_err(|e| WasmError::new(
                format!("Invalid signature base64: {}", e),
                "DecodingError".to_string(),
            ))?;

        let pk_bytes = base64::decode(&pk_b64)
            .map_err(|e| WasmError::new(
                format!("Invalid public key base64: {}", e),
                "DecodingError".to_string(),
            ))?;

        let signature = to_uint8_array(&sig_bytes);
        let public_key = to_uint8_array(&pk_bytes);

        verify_sync(&signature, JsValue::from_str(&msg), &public_key)
            .map(|valid| JsValue::from(valid))
    })
}

/// Create an AP2 credential
#[wasm_bindgen(js_name = createCredential)]
pub fn create_credential(
    identity: &AgentIdentity,
    subject_did: &str,
    credential_type: &str,
) -> Result<String, JsValue> {
    let issuer = Issuer {
        id: identity.did().to_string(),
        name: Some("Agent Issuer".to_string()),
    };

    let subject = CredentialSubject {
        id: subject_did.to_string(),
        credential_type: credential_type.to_string(),
        properties: serde_json::Value::Object(serde_json::Map::new()),
    };

    let credential = Credential::new(issuer, subject)
        .map_err(|e| WasmError::from(e))?;

    serde_json::to_string(&credential)
        .map_err(|e| WasmError::new(
            format!("Credential serialization error: {}", e),
            "SerializationError".to_string(),
        ).into())
}

/// Batch verify multiple signatures (async)
#[wasm_bindgen(js_name = batchVerify)]
pub fn batch_verify(
    signatures: js_sys::Array,
    messages: js_sys::Array,
    public_keys: js_sys::Array,
) -> Promise {
    future_to_promise(async move {
        let count = signatures.length();

        if count != messages.length() || count != public_keys.length() {
            return Err(WasmError::new(
                "Arrays must have the same length".to_string(),
                "ValidationError".to_string(),
            ).into());
        }

        let mut results = Vec::with_capacity(count as usize);

        for i in 0..count {
            let sig = Uint8Array::from(signatures.get(i));
            let msg = messages.get(i);
            let pk = Uint8Array::from(public_keys.get(i));

            let result = verify_sync(&sig, msg, &pk)
                .unwrap_or(false);

            results.push(result);
        }

        // Convert results to JS array
        let js_results = js_sys::Array::new();
        for result in results {
            js_results.push(&JsValue::from(result));
        }

        Ok(JsValue::from(js_results))
    })
}

/// Generate a random keypair for testing
#[wasm_bindgen(js_name = generateKeypair)]
pub fn generate_keypair() -> Result<JsValue, JsValue> {
    let identity = AgentIdentity::generate()?;

    let obj = js_sys::Object::new();
    js_sys::Reflect::set(
        &obj,
        &"publicKey".into(),
        &identity.public_key(),
    )?;
    js_sys::Reflect::set(
        &"publicKeyBase64".into(),
        &obj,
        &identity.public_key_base64().into(),
    )?;
    js_sys::Reflect::set(
        &obj,
        &"did".into(),
        &identity.did().into(),
    )?;

    Ok(obj.into())
}

/// Utility: Convert bytes to base64
#[wasm_bindgen(js_name = bytesToBase64)]
pub fn bytes_to_base64(bytes: &Uint8Array) -> String {
    base64::encode(&from_uint8_array(bytes))
}

/// Utility: Convert base64 to bytes
#[wasm_bindgen(js_name = base64ToBytes)]
pub fn base64_to_bytes(b64: &str) -> Result<Uint8Array, JsValue> {
    base64::decode(b64)
        .map(|bytes| to_uint8_array(&bytes))
        .map_err(|e| WasmError::new(
            format!("Base64 decode error: {}", e),
            "DecodingError".to_string(),
        ).into())
}

/// Utility: Convert bytes to hex
#[wasm_bindgen(js_name = bytesToHex)]
pub fn bytes_to_hex(bytes: &Uint8Array) -> String {
    hex::encode(&from_uint8_array(bytes))
}

/// Utility: Convert hex to bytes
#[wasm_bindgen(js_name = hexToBytes)]
pub fn hex_to_bytes(hex_str: &str) -> Result<Uint8Array, JsValue> {
    hex::decode(hex_str)
        .map(|bytes| to_uint8_array(&bytes))
        .map_err(|e| WasmError::new(
            format!("Hex decode error: {}", e),
            "DecodingError".to_string(),
        ).into())
}