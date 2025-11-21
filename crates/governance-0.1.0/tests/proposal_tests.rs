use governance::types::*;
use governance::*;
use rust_decimal::Decimal;

#[test]
fn test_create_parameter_change_proposal() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());
    governance
        .register_member("proposer".to_string(), Role::Member, Decimal::from(100))
        .unwrap();

    let proposal_id = governance
        .create_proposal(
            "Update Max Position Size".to_string(),
            "Increase maximum position size from 10% to 15%".to_string(),
            ProposalType::ParameterChange {
                parameter: "max_position_size".to_string(),
                old_value: "0.10".to_string(),
                new_value: "0.15".to_string(),
            },
            "proposer".to_string(),
        )
        .unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.title, "Update Max Position Size");
    assert_eq!(proposal.state, ProposalState::Active);
}

#[test]
fn test_create_strategy_approval_proposal() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());
    governance
        .register_member("proposer".to_string(), Role::Admin, Decimal::from(100))
        .unwrap();

    let proposal_id = governance
        .create_proposal(
            "Approve Mean Reversion Strategy".to_string(),
            "Deploy new mean reversion trading strategy".to_string(),
            ProposalType::StrategyApproval {
                strategy_id: "strategy_001".to_string(),
                strategy_name: "Mean Reversion V1".to_string(),
                risk_level: "Medium".to_string(),
            },
            "proposer".to_string(),
        )
        .unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert!(proposal.is_voting_active());
}

#[test]
fn test_create_risk_limit_adjustment_proposal() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());
    governance
        .register_member("proposer".to_string(), Role::Member, Decimal::from(100))
        .unwrap();

    let proposal_id = governance
        .create_proposal(
            "Adjust Daily VaR Limit".to_string(),
            "Increase daily Value at Risk limit".to_string(),
            ProposalType::RiskLimitAdjustment {
                limit_type: "daily_var".to_string(),
                old_limit: Decimal::from(50000),
                new_limit: Decimal::from(75000),
            },
            "proposer".to_string(),
        )
        .unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.proposer, "proposer");
}

#[test]
fn test_create_emergency_action_proposal() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());
    governance
        .register_member("guardian".to_string(), Role::Guardian, Decimal::from(200))
        .unwrap();

    let proposal_id = governance
        .create_proposal(
            "Emergency Trading Halt".to_string(),
            "Halt all trading due to market anomaly".to_string(),
            ProposalType::EmergencyAction {
                action: "halt_trading".to_string(),
                reason: "Detected market manipulation".to_string(),
            },
            "guardian".to_string(),
        )
        .unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.state, ProposalState::Active);
}

#[test]
fn test_create_treasury_allocation_proposal() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());
    governance
        .register_member("admin".to_string(), Role::Admin, Decimal::from(150))
        .unwrap();

    let proposal_id = governance
        .create_proposal(
            "Allocate Development Budget".to_string(),
            "Allocate funds for Q1 development".to_string(),
            ProposalType::TreasuryAllocation {
                recipient: "dev_team".to_string(),
                amount: Decimal::from(100000),
                purpose: "Q1 Development Budget".to_string(),
            },
            "admin".to_string(),
        )
        .unwrap();

    let proposal = governance.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.proposer, "admin");
}

#[test]
fn test_proposal_without_permission() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());
    governance
        .register_member("observer".to_string(), Role::Observer, Decimal::from(0))
        .unwrap();

    let result = governance.create_proposal(
        "Test".to_string(),
        "Test".to_string(),
        ProposalType::EmergencyAction {
            action: "Test".to_string(),
            reason: "Test".to_string(),
        },
        "observer".to_string(),
    );

    assert!(result.is_err());
}

#[test]
fn test_multiple_proposals() {
    let governance = GovernanceSystem::new(GovernanceConfig::default());
    governance
        .register_member("proposer".to_string(), Role::Member, Decimal::from(100))
        .unwrap();

    for i in 0..5 {
        let _ = governance.create_proposal(
            format!("Proposal {}", i),
            format!("Description {}", i),
            ProposalType::ParameterChange {
                parameter: format!("param_{}", i),
                old_value: "old".to_string(),
                new_value: "new".to_string(),
            },
            "proposer".to_string(),
        );
    }

    assert_eq!(governance.proposal_count(), 5);
    assert_eq!(governance.get_active_proposals().len(), 5);
}
