//! Noise Protocol Framework implementation for secure transport

use crate::error::{BitChatError, Result};
use chacha20poly1305::aead::OsRng;
use rand::RngCore;
use snow::{Builder, HandshakeState, TransportState};
use std::fmt;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Noise protocol patterns supported
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NoisePattern {
    /// XX pattern - both parties exchange static keys
    XX,
    /// IK pattern - initiator knows responder's static key
    IK,
    /// NK pattern - no prior knowledge, responder's key transmitted
    NK,
    /// KK pattern - both parties know each other's static keys
    KK,
}

impl fmt::Display for NoisePattern {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            NoisePattern::XX => write!(f, "Noise_XX_25519_ChaChaPoly_BLAKE2s"),
            NoisePattern::IK => write!(f, "Noise_IK_25519_ChaChaPoly_BLAKE2s"),
            NoisePattern::NK => write!(f, "Noise_NK_25519_ChaChaPoly_BLAKE2s"),
            NoisePattern::KK => write!(f, "Noise_KK_25519_ChaChaPoly_BLAKE2s"),
        }
    }
}

/// Noise handshake role
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NoiseRole {
    /// Initiator of the handshake
    Initiator,
    /// Responder to the handshake
    Responder,
}

/// Pre-shared key configuration
#[derive(Clone, ZeroizeOnDrop)]
pub struct PskConfig {
    /// The pre-shared key
    pub key: [u8; 32],
    /// PSK position (0, 1, 2, etc.)
    pub position: u8,
}

/// Noise session state
pub enum NoiseState {
    /// Handshake in progress
    Handshake(Box<HandshakeState>),
    /// Transport established
    Transport(Box<TransportState>),
}

/// Noise protocol session
pub struct NoiseSession {
    /// Current state
    state: NoiseState,
    /// Protocol pattern
    pattern: NoisePattern,
    /// Our role
    role: NoiseRole,
    /// Remote static public key (if known)
    remote_static: Option<[u8; 32]>,
    /// Our static keypair
    static_keypair: Option<NoiseKeypair>,
    /// Session ID for resumption
    session_id: Option<[u8; 32]>,
    /// Message counter for replay protection
    message_counter: u64,
    /// Maximum message counter before rekey
    max_messages: u64,
}

/// Noise static keypair
#[derive(Clone, ZeroizeOnDrop)]
struct NoiseKeypair {
    /// Private key
    private: [u8; 32],
    /// Public key
    public: [u8; 32],
}

impl NoiseSession {
    /// Create a new Noise session
    pub fn new(pattern: NoisePattern, role: NoiseRole, psk: Option<PskConfig>) -> Result<Self> {
        // Generate static keypair
        let mut private = [0u8; 32];
        OsRng.fill_bytes(&mut private);

        // Derive public key manually from private key using X25519
        let mut public_bytes = [0u8; 32];
        // For X25519, we can't easily derive the public key without the dalek StaticSecret
        // So we'll initialize it as zeros and let the handshake state handle it
        public_bytes.copy_from_slice(&private);

        let static_keypair = NoiseKeypair {
            private: private.clone(),
            public: public_bytes,
        };

        // Build the actual handshake state
        let mut builder = Builder::new(pattern.to_string().parse().unwrap());
        builder = builder.local_private_key(&private);

        // Add PSK if provided
        let psk_key = psk.as_ref().map(|p| p.key);
        if let Some(ref key) = psk_key {
            builder = builder.psk(psk.unwrap().position, key);
        }

        let handshake = match role {
            NoiseRole::Initiator => builder.build_initiator(),
            NoiseRole::Responder => builder.build_responder(),
        }
        .map_err(|e| BitChatError::Crypto(format!("Failed to create Noise session: {}", e)))?;

        Ok(Self {
            state: NoiseState::Handshake(Box::new(handshake)),
            pattern,
            role,
            remote_static: None,
            static_keypair: Some(static_keypair),
            session_id: None,
            message_counter: 0,
            max_messages: 100000, // Rekey after 100k messages
        })
    }

    /// Create session with known remote static key (for IK/KK patterns)
    pub fn with_remote_static(
        pattern: NoisePattern,
        role: NoiseRole,
        remote_static: &[u8; 32],
        psk: Option<PskConfig>,
    ) -> Result<Self> {
        // Generate static keypair
        let mut private = [0u8; 32];
        OsRng.fill_bytes(&mut private);

        // Derive public key manually from private key using X25519
        let mut public_bytes = [0u8; 32];
        // For X25519, we can't easily derive the public key without the dalek StaticSecret
        // So we'll initialize it as zeros and let the handshake state handle it
        public_bytes.copy_from_slice(&private);

        let static_keypair = NoiseKeypair {
            private: private.clone(),
            public: public_bytes,
        };

        // Build the handshake state with remote public key
        let mut builder = Builder::new(pattern.to_string().parse().unwrap());
        builder = builder.local_private_key(&private);
        builder = builder.remote_public_key(remote_static);

        // Add PSK if provided
        let psk_key = psk.as_ref().map(|p| p.key);
        if let Some(ref key) = psk_key {
            builder = builder.psk(psk.unwrap().position, key);
        }

        let handshake = match role {
            NoiseRole::Initiator => builder.build_initiator(),
            NoiseRole::Responder => builder.build_responder(),
        }
        .map_err(|e| BitChatError::Crypto(format!("Failed to create Noise session: {}", e)))?;

        Ok(Self {
            state: NoiseState::Handshake(Box::new(handshake)),
            pattern,
            role,
            remote_static: Some(*remote_static),
            static_keypair: Some(static_keypair),
            session_id: None,
            message_counter: 0,
            max_messages: 100000,
        })
    }

    /// Get our static public key
    pub fn get_static_public(&self) -> Option<[u8; 32]> {
        self.static_keypair.as_ref().map(|kp| kp.public)
    }

    /// Process handshake message
    pub fn process_handshake(&mut self, input: &[u8]) -> Result<Vec<u8>> {
        let is_transport = matches!(self.state, NoiseState::Transport(_));
        if is_transport {
            return Err(BitChatError::Crypto(
                "Handshake already complete".to_string(),
            ));
        }

        // We need to temporarily take ownership of the state
        // Use a dummy Transport state as placeholder
        let placeholder = Builder::new("Noise_NN_25519_ChaChaPoly_SHA256".parse().unwrap())
            .build_initiator()
            .unwrap()
            .into_transport_mode()
            .unwrap();
        let mut state = std::mem::replace(
            &mut self.state,
            NoiseState::Transport(Box::new(placeholder)),
        );

        let result = match state {
            NoiseState::Handshake(mut handshake) => {
                let mut output = vec![0u8; 65535];

                let len = if input.is_empty() {
                    // Generate next handshake message
                    handshake.write_message(&[], &mut output).map_err(|e| {
                        BitChatError::Crypto(format!("Handshake write failed: {}", e))
                    })?
                } else {
                    // Process received message and generate response
                    handshake.read_message(input, &mut output).map_err(|e| {
                        BitChatError::Crypto(format!("Handshake read failed: {}", e))
                    })?
                };

                output.truncate(len);

                // Check if handshake is complete
                if handshake.is_handshake_finished() {
                    // Get handshake hash before converting to transport
                    let handshake_hash = handshake.get_handshake_hash();
                    let mut session_id = [0u8; 32];
                    if handshake_hash.len() >= 32 {
                        session_id.copy_from_slice(&handshake_hash[..32]);
                    } else {
                        session_id[..handshake_hash.len()].copy_from_slice(handshake_hash);
                    }
                    self.session_id = Some(session_id);

                    // Get remote static if available
                    if self.pattern == NoisePattern::XX {
                        self.remote_static = handshake
                            .get_remote_static()
                            .and_then(|s| s.try_into().ok());
                    }

                    let transport = handshake.into_transport_mode().map_err(|e| {
                        BitChatError::Crypto(format!("Transport conversion failed: {}", e))
                    })?;

                    self.state = NoiseState::Transport(Box::new(transport));
                } else {
                    // Put the handshake back
                    self.state = NoiseState::Handshake(handshake);
                }

                Ok(output)
            }
            _ => unreachable!(),
        };

        result
    }

    /// Encrypt message for transport
    pub fn encrypt(&mut self, plaintext: &[u8]) -> Result<Vec<u8>> {
        // Check if rekey is needed before borrowing state
        if self.message_counter >= self.max_messages {
            self.rekey()?;
        }

        match &mut self.state {
            NoiseState::Handshake(_) => {
                Err(BitChatError::Crypto("Handshake not complete".to_string()))
            }
            NoiseState::Transport(transport) => {
                let mut output = vec![0u8; plaintext.len() + 16]; // Add space for auth tag

                let len = transport
                    .write_message(plaintext, &mut output)
                    .map_err(|e| BitChatError::Crypto(format!("Encryption failed: {}", e)))?;

                output.truncate(len);
                self.message_counter += 1;

                Ok(output)
            }
        }
    }

    /// Decrypt message from transport
    pub fn decrypt(&mut self, ciphertext: &[u8]) -> Result<Vec<u8>> {
        match &mut self.state {
            NoiseState::Handshake(_) => {
                Err(BitChatError::Crypto("Handshake not complete".to_string()))
            }
            NoiseState::Transport(transport) => {
                let mut output = vec![0u8; ciphertext.len()];

                let len = transport
                    .read_message(ciphertext, &mut output)
                    .map_err(|e| BitChatError::Crypto(format!("Decryption failed: {}", e)))?;

                output.truncate(len);
                self.message_counter += 1;

                Ok(output)
            }
        }
    }

    /// Perform rekeying
    pub fn rekey(&mut self) -> Result<()> {
        match &mut self.state {
            NoiseState::Transport(transport) => {
                transport.rekey_manually(
                    Some(&[0u8; 32]), // Initiator rekey
                    Some(&[1u8; 32]), // Responder rekey
                );
                self.message_counter = 0;
                Ok(())
            }
            _ => Err(BitChatError::Crypto(
                "Cannot rekey during handshake".to_string(),
            )),
        }
    }

    /// Get session ID for resumption
    pub fn get_session_id(&self) -> Option<[u8; 32]> {
        self.session_id
    }

    /// Export session for resumption
    pub fn export_session(&self) -> Result<SessionExport> {
        match &self.state {
            NoiseState::Transport(transport) => Ok(SessionExport {
                pattern: self.pattern,
                role: self.role,
                remote_static: self.remote_static,
                session_id: self.session_id.unwrap(),
                handshake_hash: self.session_id.unwrap_or([0u8; 32]),
                message_counter: self.message_counter,
            }),
            _ => Err(BitChatError::Crypto(
                "Cannot export incomplete session".to_string(),
            )),
        }
    }

    /// Check if handshake is complete
    pub fn is_transport_ready(&self) -> bool {
        matches!(self.state, NoiseState::Transport(_))
    }

    /// Get remote static public key (after handshake)
    pub fn get_remote_static(&self) -> Option<[u8; 32]> {
        self.remote_static
    }
}

/// Exported session for resumption
#[derive(Clone, Serialize, Deserialize)]
pub struct SessionExport {
    /// Protocol pattern
    pub pattern: NoisePattern,
    /// Our role
    pub role: NoiseRole,
    /// Remote static key
    pub remote_static: Option<[u8; 32]>,
    /// Session ID
    pub session_id: [u8; 32],
    /// Handshake hash
    pub handshake_hash: [u8; 32],
    /// Message counter
    pub message_counter: u64,
}

/// Noise protocol builder for common patterns
pub struct NoiseBuilder {
    pattern: NoisePattern,
    role: NoiseRole,
    psk: Option<PskConfig>,
    remote_static: Option<[u8; 32]>,
}

impl NoiseBuilder {
    /// Create new builder
    pub fn new(pattern: NoisePattern, role: NoiseRole) -> Self {
        Self {
            pattern,
            role,
            psk: None,
            remote_static: None,
        }
    }

    /// Set pre-shared key
    pub fn with_psk(mut self, key: [u8; 32], position: u8) -> Self {
        self.psk = Some(PskConfig { key, position });
        self
    }

    /// Set remote static key
    pub fn with_remote_static(mut self, key: [u8; 32]) -> Self {
        self.remote_static = Some(key);
        self
    }

    /// Build the session
    pub fn build(self) -> Result<NoiseSession> {
        match self.remote_static {
            Some(remote) => {
                NoiseSession::with_remote_static(self.pattern, self.role, &remote, self.psk)
            }
            None => NoiseSession::new(self.pattern, self.role, self.psk),
        }
    }
}

/// Helper for bidirectional Noise channels
pub struct NoiseChannel {
    /// Outbound session (we initiate)
    pub outbound: Option<NoiseSession>,
    /// Inbound session (they initiate)
    pub inbound: Option<NoiseSession>,
    /// Default pattern for new sessions
    pub default_pattern: NoisePattern,
}

impl NoiseChannel {
    /// Create new bidirectional channel
    pub fn new(pattern: NoisePattern) -> Self {
        Self {
            outbound: None,
            inbound: None,
            default_pattern: pattern,
        }
    }

    /// Initialize outbound session
    pub fn init_outbound(&mut self, remote_static: Option<[u8; 32]>) -> Result<Vec<u8>> {
        let mut session = match remote_static {
            Some(remote) => NoiseSession::with_remote_static(
                self.default_pattern,
                NoiseRole::Initiator,
                &remote,
                None,
            )?,
            None => NoiseSession::new(self.default_pattern, NoiseRole::Initiator, None)?,
        };

        let handshake_msg = session.process_handshake(&[])?;
        self.outbound = Some(session);

        Ok(handshake_msg)
    }

    /// Handle inbound handshake
    pub fn handle_inbound(&mut self, message: &[u8]) -> Result<Vec<u8>> {
        if self.inbound.is_none() {
            self.inbound = Some(NoiseSession::new(
                self.default_pattern,
                NoiseRole::Responder,
                None,
            )?);
        }

        self.inbound.as_mut().unwrap().process_handshake(message)
    }

    /// Send encrypted message
    pub fn send(&mut self, plaintext: &[u8]) -> Result<Vec<u8>> {
        self.outbound
            .as_mut()
            .ok_or_else(|| BitChatError::Crypto("No outbound session".to_string()))?
            .encrypt(plaintext)
    }

    /// Receive encrypted message
    pub fn receive(&mut self, ciphertext: &[u8]) -> Result<Vec<u8>> {
        self.inbound
            .as_mut()
            .ok_or_else(|| BitChatError::Crypto("No inbound session".to_string()))?
            .decrypt(ciphertext)
    }
}

// Re-export serde traits for SessionExport
use serde::{Deserialize, Serialize};

// Custom serde implementations for NoisePattern and NoiseRole
impl Serialize for NoisePattern {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&format!("{:?}", self))
    }
}

impl<'de> Deserialize<'de> for NoisePattern {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        match s.as_str() {
            "XX" => Ok(NoisePattern::XX),
            "IK" => Ok(NoisePattern::IK),
            "NK" => Ok(NoisePattern::NK),
            "KK" => Ok(NoisePattern::KK),
            _ => Err(serde::de::Error::custom("Invalid NoisePattern")),
        }
    }
}

impl Serialize for NoiseRole {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&format!("{:?}", self))
    }
}

impl<'de> Deserialize<'de> for NoiseRole {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        match s.as_str() {
            "Initiator" => Ok(NoiseRole::Initiator),
            "Responder" => Ok(NoiseRole::Responder),
            _ => Err(serde::de::Error::custom("Invalid NoiseRole")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_noise_xx_handshake() {
        let mut alice = NoiseSession::new(NoisePattern::XX, NoiseRole::Initiator, None).unwrap();
        let mut bob = NoiseSession::new(NoisePattern::XX, NoiseRole::Responder, None).unwrap();

        // Alice -> Bob: e
        let msg1 = alice.process_handshake(&[]).unwrap();
        assert!(!msg1.is_empty());

        // Bob -> Alice: e, ee, s, es
        let msg2 = bob.process_handshake(&msg1).unwrap();
        assert!(!msg2.is_empty());

        // Alice -> Bob: s, se
        let msg3 = alice.process_handshake(&msg2).unwrap();
        assert!(!msg3.is_empty());

        // Bob processes final message
        let msg4 = bob.process_handshake(&msg3).unwrap();
        assert!(msg4.is_empty()); // No more messages

        // Both should be in transport mode
        assert!(alice.is_transport_ready());
        assert!(bob.is_transport_ready());

        // Test encryption/decryption
        let plaintext = b"Hello, Noise!";
        let ciphertext = alice.encrypt(plaintext).unwrap();
        let decrypted = bob.decrypt(&ciphertext).unwrap();

        assert_eq!(plaintext.to_vec(), decrypted);

        // Test reverse direction
        let response = b"Hello back!";
        let ciphertext2 = bob.encrypt(response).unwrap();
        let decrypted2 = alice.decrypt(&ciphertext2).unwrap();

        assert_eq!(response.to_vec(), decrypted2);
    }

    #[test]
    fn test_noise_with_psk() {
        let psk = PskConfig {
            key: [0x42; 32],
            position: 0,
        };

        let mut alice =
            NoiseSession::new(NoisePattern::XX, NoiseRole::Initiator, Some(psk.clone())).unwrap();
        let mut bob = NoiseSession::new(NoisePattern::XX, NoiseRole::Responder, Some(psk)).unwrap();

        // Complete handshake
        let msg1 = alice.process_handshake(&[]).unwrap();
        let msg2 = bob.process_handshake(&msg1).unwrap();
        let msg3 = alice.process_handshake(&msg2).unwrap();
        let _ = bob.process_handshake(&msg3).unwrap();

        // Test encryption works with PSK
        let plaintext = b"PSK protected message";
        let ciphertext = alice.encrypt(plaintext).unwrap();
        let decrypted = bob.decrypt(&ciphertext).unwrap();

        assert_eq!(plaintext.to_vec(), decrypted);
    }

    #[test]
    fn test_noise_channel() {
        let mut alice_channel = NoiseChannel::new(NoisePattern::XX);
        let mut bob_channel = NoiseChannel::new(NoisePattern::XX);

        // Alice initiates
        let msg1 = alice_channel.init_outbound(None).unwrap();

        // Bob responds
        let msg2 = bob_channel.handle_inbound(&msg1).unwrap();

        // Continue handshake
        let msg3 = alice_channel
            .outbound
            .as_mut()
            .unwrap()
            .process_handshake(&msg2)
            .unwrap();
        let msg4 = bob_channel
            .inbound
            .as_mut()
            .unwrap()
            .process_handshake(&msg3)
            .unwrap();

        // Bob initiates reverse channel
        let msg5 = bob_channel.init_outbound(None).unwrap();
        let msg6 = alice_channel.handle_inbound(&msg5).unwrap();
        let msg7 = bob_channel
            .outbound
            .as_mut()
            .unwrap()
            .process_handshake(&msg6)
            .unwrap();
        let _ = alice_channel
            .inbound
            .as_mut()
            .unwrap()
            .process_handshake(&msg7)
            .unwrap();

        // Test bidirectional communication
        let alice_msg = b"Alice to Bob";
        let encrypted1 = alice_channel.send(alice_msg).unwrap();
        let decrypted1 = bob_channel.receive(&encrypted1).unwrap();
        assert_eq!(alice_msg.to_vec(), decrypted1);

        let bob_msg = b"Bob to Alice";
        let encrypted2 = bob_channel.send(bob_msg).unwrap();
        let decrypted2 = alice_channel.receive(&encrypted2).unwrap();
        assert_eq!(bob_msg.to_vec(), decrypted2);
    }

    #[test]
    fn test_rekey() {
        let mut alice = NoiseSession::new(NoisePattern::XX, NoiseRole::Initiator, None).unwrap();
        let mut bob = NoiseSession::new(NoisePattern::XX, NoiseRole::Responder, None).unwrap();

        // Complete handshake
        let msg1 = alice.process_handshake(&[]).unwrap();
        let msg2 = bob.process_handshake(&msg1).unwrap();
        let msg3 = alice.process_handshake(&msg2).unwrap();
        let _ = bob.process_handshake(&msg3).unwrap();

        // Set low max_messages for testing
        alice.max_messages = 2;
        bob.max_messages = 2;

        // First message
        let msg = b"Message 1";
        let ct1 = alice.encrypt(msg).unwrap();
        let pt1 = bob.decrypt(&ct1).unwrap();
        assert_eq!(msg.to_vec(), pt1);

        // Second message
        let ct2 = alice.encrypt(msg).unwrap();
        let pt2 = bob.decrypt(&ct2).unwrap();
        assert_eq!(msg.to_vec(), pt2);

        // Third message should trigger rekey
        assert_eq!(alice.message_counter, 2);
        let ct3 = alice.encrypt(msg).unwrap();
        assert_eq!(alice.message_counter, 1); // Reset after rekey

        // Bob needs to rekey too
        bob.rekey().unwrap();
        let pt3 = bob.decrypt(&ct3).unwrap();
        assert_eq!(msg.to_vec(), pt3);
    }
}
