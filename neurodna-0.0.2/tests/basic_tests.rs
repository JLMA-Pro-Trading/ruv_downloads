use neurodna::*;

#[test]
fn test_dna_creation() {
    let dna = NeuralDNA::new(vec![4, 8, 4, 2], "sigmoid");
    assert_eq!(dna.topology, vec![4, 8, 4, 2]);
    assert_eq!(dna.activation, "sigmoid");
    assert!(dna.validate().is_ok());
}

#[test]
fn test_dna_serialization() {
    let dna = NeuralDNA::random(vec![2, 4, 2], "tanh");
    let json = dna.to_json().unwrap();
    let restored = NeuralDNA::from_json(&json).unwrap();
    
    assert_eq!(dna.topology, restored.topology);
    assert_eq!(dna.activation, restored.activation);
    assert_eq!(dna.weights.len(), restored.weights.len());
}

#[test]
fn test_mutation() {
    let mut dna = NeuralDNA::random(vec![3, 5, 3], "relu");
    let original_generation = dna.generation;
    let policy = MutationPolicy::default();
    
    mutate(&mut dna, &policy, &MutationType::Weight);
    assert_eq!(dna.generation, original_generation + 1);
}

#[test]
fn test_crossover() {
    let parent1 = NeuralDNA::random(vec![4, 6, 2], "sigmoid");
    let parent2 = NeuralDNA::random(vec![4, 6, 2], "sigmoid");
    
    let child = crossover(&parent1, &parent2).unwrap();
    assert_eq!(child.topology, parent1.topology);
    assert_eq!(child.weights.len(), parent1.weights.len());
}

#[test]
fn test_fitness_evaluation() {
    let dna = NeuralDNA::random(vec![2, 4, 1], "sigmoid");
    let scorer = StandardFitnessScorer::new();
    let score = scorer.evaluate(&dna);
    
    assert!(score.overall >= 0.0 && score.overall <= 1.0);
    assert!(!score.components.is_empty());
}

#[test]
fn test_trait_profiles() {
    let adhd = TraitProfile::adhd_profile();
    assert!(!adhd.traits.is_empty());
    
    let autism = TraitProfile::autism_profile();
    assert!(!autism.traits.is_empty());
    
    assert!(adhd.get_trait("hyperfocus").is_some());
    assert!(autism.get_trait("pattern_recognition").is_some());
}

#[test]
fn test_evolution_engine() {
    let config = EvolutionConfig {
        population_size: 10,
        elite_count: 2,
        max_generations: 5,
        ..Default::default()
    };
    
    let mut engine = EvolutionEngine::new(config, vec![2, 4, 1], "sigmoid");
    let fitness_fn = StandardFitnessScorer::new();
    
    // Dummy data
    let inputs = vec![vec![0.0, 1.0], vec![1.0, 0.0]];
    let targets = vec![vec![1.0], vec![0.0]];
    
    engine.evolve_generation(&fitness_fn, &inputs, &targets);
    assert_eq!(engine.generation, 1);
    assert!(engine.get_best_individual().is_some());
}