//! Neurodivergent traits and cognitive patterns

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Neurodivergent trait profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NeurodivergentTrait {
    pub name: String,
    pub strength: f32,
    pub category: TraitCategory,
    pub effects: TraitEffects,
}

/// Categories of neurodivergent traits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TraitCategory {
    Attention,
    Sensory,
    Processing,
    Executive,
    Memory,
    Social,
    Creative,
}

/// Effects that traits have on neural behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraitEffects {
    pub learning_rate_modifier: f32,
    pub connection_strength_modifier: f32,
    pub activation_threshold_modifier: f32,
    pub specialization_tendency: f32,
}

impl Default for TraitEffects {
    fn default() -> Self {
        Self {
            learning_rate_modifier: 1.0,
            connection_strength_modifier: 1.0,
            activation_threshold_modifier: 1.0,
            specialization_tendency: 0.0,
        }
    }
}

/// Collection of traits forming a profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraitProfile {
    pub traits: Vec<NeurodivergentTrait>,
    pub compatibility_scores: HashMap<String, f32>,
}

impl TraitProfile {
    pub fn new() -> Self {
        Self {
            traits: Vec::new(),
            compatibility_scores: HashMap::new(),
        }
    }
    
    pub fn add_trait(&mut self, trait_def: NeurodivergentTrait) {
        self.traits.push(trait_def);
    }
    
    pub fn get_trait(&self, name: &str) -> Option<&NeurodivergentTrait> {
        self.traits.iter().find(|t| t.name == name)
    }
    
    pub fn adhd_profile() -> Self {
        let mut profile = Self::new();
        
        profile.add_trait(NeurodivergentTrait {
            name: "hyperfocus".to_string(),
            strength: 0.8,
            category: TraitCategory::Attention,
            effects: TraitEffects {
                learning_rate_modifier: 1.5,
                connection_strength_modifier: 1.3,
                activation_threshold_modifier: 0.8,
                specialization_tendency: 0.7,
            },
        });
        
        profile.add_trait(NeurodivergentTrait {
            name: "distractibility".to_string(),
            strength: 0.6,
            category: TraitCategory::Attention,
            effects: TraitEffects {
                learning_rate_modifier: 0.8,
                connection_strength_modifier: 0.9,
                activation_threshold_modifier: 1.2,
                specialization_tendency: -0.3,
            },
        });
        
        profile
    }
    
    pub fn autism_profile() -> Self {
        let mut profile = Self::new();
        
        profile.add_trait(NeurodivergentTrait {
            name: "pattern_recognition".to_string(),
            strength: 0.9,
            category: TraitCategory::Processing,
            effects: TraitEffects {
                learning_rate_modifier: 1.2,
                connection_strength_modifier: 1.4,
                activation_threshold_modifier: 0.9,
                specialization_tendency: 0.8,
            },
        });
        
        profile.add_trait(NeurodivergentTrait {
            name: "detail_orientation".to_string(),
            strength: 0.8,
            category: TraitCategory::Processing,
            effects: TraitEffects {
                learning_rate_modifier: 1.1,
                connection_strength_modifier: 1.2,
                activation_threshold_modifier: 0.85,
                specialization_tendency: 0.6,
            },
        });
        
        profile
    }
}

impl Default for TraitProfile {
    fn default() -> Self {
        Self::new()
    }
}