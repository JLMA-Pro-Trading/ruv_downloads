use governance::types::*;
use governance::*;
use rust_decimal::Decimal;
use std::thread;
use std::time::Duration;

#[test]
fn test_complete_governance_workflow() {
    // Setup
    let mut config = GovernanceConfig::default();
    config.voting_period_seconds = 1;
    config.quorum_percentage = Decimal::from(50);
    config.passing_threshold = Decimal::from(66);
    config.execution_config.timelock_duration_seconds = 1; // Short timelock for testing

    let governance = GovernanceSystem::new(config);

    // Register members
    governance.register_member("admin".to_string(), Role::Admin, Decimal::from(200)).unwrap();
    governance.register_member("member1".to_string(), Role::Member, Decimal::from(100)).unwrap();
    governance.register_member("member2".to_string(), Role::Member, Decimal::from(150)).unwrap();
    governance.register_member("guardian".to_string(), Role::Guardian, Decimal::from(300)).unwrap();

    assert_eq!(governance.member_count(), 4);

    // Create proposal
    let proposal_id = governance
        .create_proposal(
            "Increase Risk Limits".to_string(),
            "Proposal to increase daily VaR limits from $50k to $75k".to_string(),
            ProposalType::RiskLimitAdjustment {
                limit_type: "daily_var".to_string(),
                old_limit: Decimal::from(50000),
                new_limit: Decimal::from(75000),
            },
            "admin".to_string(),
        )
        .unwrap();

    // Verify proposal state
    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.state, ProposalState::Active);
    assert!(proposal.is_voting_active());

    // Cast votes
    governance.vote(&proposal_id, "admin", VoteType::For, Some("Needed for growth".to_string())).unwrap();
    governance.vote(&proposal_id, "member1", VoteType::For, None).unwrap();
    governance.vote(&proposal_id, "member2", VoteType::Against, Some("Too risky".to_string())).unwrap();
    governance.vote(&proposal_id, "guardian", VoteType::For, None).unwrap();

    // Wait for voting period to end
    thread::sleep(Duration::from_secs(2));

    // Finalize voting
    governance.finalize_voting(&proposal_id).unwrap();

    // Check results
    let stats = governance.get_voting_statistics(&proposal_id).unwrap();
    assert!(stats.quorum_reached);
    assert!(stats.passed);

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.state, ProposalState::Passed);

    // Wait for timelock to expire
    thread::sleep(Duration::from_secs(2));

    // Execute proposal
    let result = governance.execute_proposal(&proposal_id, "admin").unwrap();
    assert!(result.success);

    // Verify execution
    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.state, ProposalState::Executed);
    assert!(proposal.executed_at.is_some());
}

#[test]
fn test_proposal_rejection() {
    let mut config = GovernanceConfig::default();
    config.voting_period_seconds = 1;
    config.quorum_percentage = Decimal::from(50);
    config.passing_threshold = Decimal::from(66);

    let governance = GovernanceSystem::new(config);

    governance.register_member("member1".to_string(), Role::Member, Decimal::from(100)).unwrap();
    governance.register_member("member2".to_string(), Role::Member, Decimal::from(100)).unwrap();
    governance.register_member("member3".to_string(), Role::Member, Decimal::from(100)).unwrap();

    let proposal_id = governance
        .create_proposal(
            "Bad Proposal".to_string(),
            "This will be rejected".to_string(),
            ProposalType::ParameterChange {
                parameter: "test".to_string(),
                old_value: "1".to_string(),
                new_value: "2".to_string(),
            },
            "member1".to_string(),
        )
        .unwrap();

    // Majority vote against
    governance.vote(&proposal_id, "member1", VoteType::Against, None).unwrap();
    governance.vote(&proposal_id, "member2", VoteType::Against, None).unwrap();
    governance.vote(&proposal_id, "member3", VoteType::For, None).unwrap();

    thread::sleep(Duration::from_secs(2));

    governance.finalize_voting(&proposal_id).unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.state, ProposalState::Rejected);
}

#[test]
fn test_veto_mechanism() {
    let mut config = GovernanceConfig::default();
    config.voting_period_seconds = 1;

    let governance = GovernanceSystem::new(config);

    governance.register_member("admin".to_string(), Role::Admin, Decimal::from(200)).unwrap();
    governance.register_member("guardian".to_string(), Role::Guardian, Decimal::from(300)).unwrap();
    governance.register_member("member1".to_string(), Role::Member, Decimal::from(100)).unwrap();

    let proposal_id = governance
        .create_proposal(
            "Controversial Change".to_string(),
            "This will be vetoed".to_string(),
            ProposalType::EmergencyAction {
                action: "risky_action".to_string(),
                reason: "Emergency".to_string(),
            },
            "admin".to_string(),
        )
        .unwrap();

    // Vote passes
    governance.vote(&proposal_id, "admin", VoteType::For, None).unwrap();
    governance.vote(&proposal_id, "member1", VoteType::For, None).unwrap();

    thread::sleep(Duration::from_secs(2));

    governance.finalize_voting(&proposal_id).unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.state, ProposalState::Passed);

    // Guardian vetoes
    governance
        .veto_proposal(&proposal_id, "guardian", "Too risky for current market conditions".to_string())
        .unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.state, ProposalState::Vetoed);
    assert_eq!(proposal.vetoed_by, Some("guardian".to_string()));
}

#[test]
fn test_treasury_integration() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());

    governance.register_member("admin".to_string(), Role::Admin, Decimal::from(100)).unwrap();

    // Deposit funds
    governance
        .treasury()
        .deposit(
            "USD",
            Decimal::from(500000),
            "Investor".to_string(),
            "Initial funding".to_string(),
        )
        .unwrap();

    assert_eq!(governance.treasury().get_balance("USD"), Decimal::from(500000));

    // Create budget allocation proposal
    let _proposal_id = governance
        .create_proposal(
            "Allocate Development Budget".to_string(),
            "Q1 Development Budget".to_string(),
            ProposalType::TreasuryAllocation {
                recipient: "dev_team".to_string(),
                amount: Decimal::from(100000),
                purpose: "Q1 Development".to_string(),
            },
            "admin".to_string(),
        )
        .unwrap();

    // Vote and pass the proposal (simplified for testing)
    governance.vote(&_proposal_id, "admin", VoteType::For, None).unwrap();

    // This is a simplified test - in real usage, voting would happen here
    let stats = governance.get_treasury_statistics();
    assert_eq!(stats.total_balance, Decimal::from(500000));
}

#[test]
fn test_member_reputation() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());

    governance.register_member("active_member".to_string(), Role::Member, Decimal::from(100)).unwrap();

    // Create and vote on multiple proposals
    for i in 0..5 {
        let proposal_id = governance
            .create_proposal(
                format!("Proposal {}", i),
                format!("Description {}", i),
                ProposalType::ParameterChange {
                    parameter: format!("param_{}", i),
                    old_value: "old".to_string(),
                    new_value: "new".to_string(),
                },
                "active_member".to_string(),
            )
            .unwrap();

        governance.vote(&proposal_id, "active_member", VoteType::For, None).unwrap();
    }

    // Check member statistics
    let member = governance.get_member("active_member").unwrap();
    assert_eq!(member.proposals_created, 5);
    assert_eq!(member.votes_cast, 5);
    assert!(member.reputation > Decimal::from(100)); // Reputation increased from activity
}

#[test]
fn test_concurrent_proposals() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());

    governance.register_member("admin".to_string(), Role::Admin, Decimal::from(100)).unwrap();
    governance.register_member("member1".to_string(), Role::Member, Decimal::from(100)).unwrap();

    // Create multiple proposals concurrently
    let mut proposal_ids = Vec::new();
    for i in 0..3 {
        let id = governance
            .create_proposal(
                format!("Proposal {}", i),
                format!("Description {}", i),
                ProposalType::ParameterChange {
                    parameter: format!("param_{}", i),
                    old_value: "old".to_string(),
                    new_value: "new".to_string(),
                },
                "admin".to_string(),
            )
            .unwrap();
        proposal_ids.push(id);
    }

    assert_eq!(governance.get_active_proposals().len(), 3);

    // Vote on all proposals
    for proposal_id in &proposal_ids {
        governance.vote(proposal_id, "admin", VoteType::For, None).unwrap();
        governance.vote(proposal_id, "member1", VoteType::For, None).unwrap();
    }

    // Verify all proposals have votes
    for proposal_id in &proposal_ids {
        let proposal = governance.get_proposal(proposal_id).unwrap();
        assert_eq!(proposal.votes.len(), 2);
    }
}

#[test]
fn test_member_role_upgrade() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());

    governance.register_member("admin".to_string(), Role::Admin, Decimal::from(200)).unwrap();
    governance.register_member("new_member".to_string(), Role::Observer, Decimal::from(0)).unwrap();

    // Observer cannot create proposals
    let result = governance.create_proposal(
        "Test".to_string(),
        "Test".to_string(),
        ProposalType::ParameterChange {
            parameter: "test".to_string(),
            old_value: "1".to_string(),
            new_value: "2".to_string(),
        },
        "new_member".to_string(),
    );
    assert!(result.is_err());

    // Create proposal to upgrade member
    let _proposal_id = governance
        .create_proposal(
            "Upgrade Member Role".to_string(),
            "Upgrade new_member to Member role".to_string(),
            ProposalType::MemberManagement {
                action: MemberAction::UpdateRole {
                    new_role: Role::Member,
                },
                member_id: "new_member".to_string(),
            },
            "admin".to_string(),
        )
        .unwrap();

    // In real usage, voting would happen, but for this test we'll directly update
    governance.members().update_role("new_member", Role::Member).unwrap();

    // Now member can create proposals
    let result = governance.create_proposal(
        "My Proposal".to_string(),
        "Test".to_string(),
        ProposalType::ParameterChange {
            parameter: "test".to_string(),
            old_value: "1".to_string(),
            new_value: "2".to_string(),
        },
        "new_member".to_string(),
    );
    assert!(result.is_ok());
}
