use governance::types::*;
use governance::*;
use rust_decimal::Decimal;
use std::thread;
use std::time::Duration;

#[test]
fn test_simple_voting() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());

    // Register members
    governance.register_member("alice".to_string(), Role::Member, Decimal::from(100)).unwrap();
    governance.register_member("bob".to_string(), Role::Member, Decimal::from(150)).unwrap();

    // Create proposal
    let proposal_id = governance
        .create_proposal(
            "Test Proposal".to_string(),
            "Testing voting".to_string(),
            ProposalType::ParameterChange {
                parameter: "test".to_string(),
                old_value: "1".to_string(),
                new_value: "2".to_string(),
            },
            "alice".to_string(),
        )
        .unwrap();

    // Vote
    governance.vote(&proposal_id, "alice", VoteType::For, None).unwrap();
    governance.vote(&proposal_id, "bob", VoteType::For, None).unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.votes.len(), 2);
}

#[test]
fn test_weighted_voting() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());

    governance.register_member("whale".to_string(), Role::Member, Decimal::from(1000)).unwrap();
    governance.register_member("minnow".to_string(), Role::Member, Decimal::from(10)).unwrap();

    let proposal_id = governance
        .create_proposal(
            "Test".to_string(),
            "Test".to_string(),
            ProposalType::ParameterChange {
                parameter: "test".to_string(),
                old_value: "1".to_string(),
                new_value: "2".to_string(),
            },
            "whale".to_string(),
        )
        .unwrap();

    governance.vote(&proposal_id, "whale", VoteType::For, None).unwrap();
    governance.vote(&proposal_id, "minnow", VoteType::Against, None).unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.votes.len(), 2);

    // Whale's vote should have more weight
    let whale_vote = proposal.votes.iter().find(|v| v.voter_id == "whale").unwrap();
    let minnow_vote = proposal.votes.iter().find(|v| v.voter_id == "minnow").unwrap();
    assert!(whale_vote.voting_power > minnow_vote.voting_power);
}

#[test]
fn test_delegation() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());

    governance.register_member("delegator".to_string(), Role::Member, Decimal::from(100)).unwrap();
    governance.register_member("delegate".to_string(), Role::Member, Decimal::from(200)).unwrap();

    // Delegate voting power
    governance.delegate("delegator", "delegate").unwrap();

    let proposal_id = governance
        .create_proposal(
            "Test".to_string(),
            "Test".to_string(),
            ProposalType::ParameterChange {
                parameter: "test".to_string(),
                old_value: "1".to_string(),
                new_value: "2".to_string(),
            },
            "delegate".to_string(),
        )
        .unwrap();

    // Delegate votes with combined power
    governance.vote(&proposal_id, "delegate", VoteType::For, None).unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    let vote = &proposal.votes[0];

    // Vote should have combined power (200 + 100 = 300)
    // Note: reputation increases slightly from creating the proposal, so it's ~301
    assert!(vote.voting_power >= Decimal::from(300) && vote.voting_power <= Decimal::from(305));
}

#[test]
fn test_prevent_duplicate_vote() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());
    governance.register_member("voter".to_string(), Role::Member, Decimal::from(100)).unwrap();

    let proposal_id = governance
        .create_proposal(
            "Test".to_string(),
            "Test".to_string(),
            ProposalType::ParameterChange {
                parameter: "test".to_string(),
                old_value: "1".to_string(),
                new_value: "2".to_string(),
            },
            "voter".to_string(),
        )
        .unwrap();

    governance.vote(&proposal_id, "voter", VoteType::For, None).unwrap();
    let result = governance.vote(&proposal_id, "voter", VoteType::Against, None);

    assert!(result.is_err());
}

#[test]
fn test_voting_with_reason() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());
    governance.register_member("voter".to_string(), Role::Member, Decimal::from(100)).unwrap();

    let proposal_id = governance
        .create_proposal(
            "Test".to_string(),
            "Test".to_string(),
            ProposalType::ParameterChange {
                parameter: "test".to_string(),
                old_value: "1".to_string(),
                new_value: "2".to_string(),
            },
            "voter".to_string(),
        )
        .unwrap();

    governance
        .vote(
            &proposal_id,
            "voter",
            VoteType::For,
            Some("I support this change because...".to_string()),
        )
        .unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert!(proposal.votes[0].reason.is_some());
}

#[test]
fn test_abstain_vote() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());
    governance.register_member("voter".to_string(), Role::Member, Decimal::from(100)).unwrap();

    let proposal_id = governance
        .create_proposal(
            "Test".to_string(),
            "Test".to_string(),
            ProposalType::ParameterChange {
                parameter: "test".to_string(),
                old_value: "1".to_string(),
                new_value: "2".to_string(),
            },
            "voter".to_string(),
        )
        .unwrap();

    governance.vote(&proposal_id, "voter", VoteType::Abstain, None).unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.votes[0].vote_type, VoteType::Abstain);
}

#[test]
fn test_quorum_calculation() {
    let mut config = GovernanceConfig::default();
    config.quorum_percentage = Decimal::from(50);
    config.voting_period_seconds = 1;

    let governance = GovernanceSystem::new(config);

    // Register 4 members
    for i in 1..=4 {
        governance.register_member(
            format!("member{}", i),
            Role::Member,
            Decimal::from(100),
        ).unwrap();
    }

    let proposal_id = governance
        .create_proposal(
            "Test".to_string(),
            "Test".to_string(),
            ProposalType::ParameterChange {
                parameter: "test".to_string(),
                old_value: "1".to_string(),
                new_value: "2".to_string(),
            },
            "member1".to_string(),
        )
        .unwrap();

    // Only 2 members vote (50% participation)
    governance.vote(&proposal_id, "member1", VoteType::For, None).unwrap();
    governance.vote(&proposal_id, "member2", VoteType::For, None).unwrap();

    thread::sleep(Duration::from_secs(2));

    governance.finalize_voting(&proposal_id).unwrap();

    let stats = governance.get_voting_statistics(&proposal_id).unwrap();
    assert!(stats.quorum_reached);
}

#[test]
fn test_passing_threshold() {
    let mut config = GovernanceConfig::default();
    config.quorum_percentage = Decimal::from(50);
    config.passing_threshold = Decimal::from(66);
    config.voting_period_seconds = 1;

    let governance = GovernanceSystem::new(config);

    for i in 1..=3 {
        governance.register_member(
            format!("member{}", i),
            Role::Member,
            Decimal::from(100),
        ).unwrap();
    }

    let proposal_id = governance
        .create_proposal(
            "Test".to_string(),
            "Test".to_string(),
            ProposalType::ParameterChange {
                parameter: "test".to_string(),
                old_value: "1".to_string(),
                new_value: "2".to_string(),
            },
            "member1".to_string(),
        )
        .unwrap();

    // 2 for, 1 against (66.6% approval)
    governance.vote(&proposal_id, "member1", VoteType::For, None).unwrap();
    governance.vote(&proposal_id, "member2", VoteType::For, None).unwrap();
    governance.vote(&proposal_id, "member3", VoteType::Against, None).unwrap();

    thread::sleep(Duration::from_secs(2));

    governance.finalize_voting(&proposal_id).unwrap();

    let stats = governance.get_voting_statistics(&proposal_id).unwrap();
    assert!(stats.passed);
}
