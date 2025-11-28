use governance::types::*;
use governance::GovernanceSystem;
use rust_decimal::Decimal;
use std::thread;
use std::time::Duration;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Neural Trader Governance System Demo ===\n");

    // Create governance system with custom configuration
    let mut config = GovernanceConfig::default();
    config.quorum_percentage = Decimal::from(50); // 50% participation required
    config.passing_threshold = Decimal::from(66); // 66% approval required
    config.voting_period_seconds = 5; // 5 seconds for demo purposes
    let voting_period = config.voting_period_seconds; // Save for later use

    let governance = GovernanceSystem::new(config);

    println!("1. Registering Members");
    println!("----------------------");

    // Register different types of members
    governance.register_member("alice".to_string(), Role::Admin, Decimal::from(200))?;
    println!("✓ Registered Alice as Admin with 200 voting power");

    governance.register_member("bob".to_string(), Role::Guardian, Decimal::from(300))?;
    println!("✓ Registered Bob as Guardian with 300 voting power");

    governance.register_member("charlie".to_string(), Role::Member, Decimal::from(100))?;
    println!("✓ Registered Charlie as Member with 100 voting power");

    governance.register_member("diana".to_string(), Role::Member, Decimal::from(150))?;
    println!("✓ Registered Diana as Member with 150 voting power");

    println!("\nTotal members: {}", governance.member_count());
    println!();

    // Demonstrate delegation
    println!("2. Delegating Voting Power");
    println!("--------------------------");
    governance.delegate("charlie", "alice")?;
    println!("✓ Charlie delegated voting power to Alice");
    println!("✓ Alice's effective voting power is now: 300 (200 + 100)\n");

    // Initialize treasury
    println!("3. Treasury Setup");
    println!("-----------------");
    governance.treasury().deposit(
        "USD",
        Decimal::from(1_000_000),
        "Initial Funding".to_string(),
        "Startup capital".to_string(),
    )?;
    let stats = governance.get_treasury_statistics();
    println!("✓ Treasury balance: ${}\n", stats.total_balance);

    // Create various types of proposals
    println!("4. Creating Proposals");
    println!("---------------------");

    // Proposal 1: Parameter Change
    let proposal1_id = governance.create_proposal(
        "Increase Max Position Size".to_string(),
        "Proposal to increase the maximum position size from 10% to 15% of portfolio".to_string(),
        ProposalType::ParameterChange {
            parameter: "max_position_size".to_string(),
            old_value: "0.10".to_string(),
            new_value: "0.15".to_string(),
        },
        "alice".to_string(),
    )?;
    println!("✓ Proposal 1 (Parameter Change): {}", proposal1_id);

    // Proposal 2: Risk Limit Adjustment
    let proposal2_id = governance.create_proposal(
        "Adjust Daily VaR Limit".to_string(),
        "Increase daily Value at Risk limit to accommodate growth".to_string(),
        ProposalType::RiskLimitAdjustment {
            limit_type: "daily_var".to_string(),
            old_limit: Decimal::from(50000),
            new_limit: Decimal::from(75000),
        },
        "bob".to_string(),
    )?;
    println!("✓ Proposal 2 (Risk Limit): {}", proposal2_id);

    // Proposal 3: Strategy Approval
    let proposal3_id = governance.create_proposal(
        "Approve Mean Reversion Strategy".to_string(),
        "Deploy new mean reversion trading strategy for equity markets".to_string(),
        ProposalType::StrategyApproval {
            strategy_id: "strategy_mr_001".to_string(),
            strategy_name: "Mean Reversion V1".to_string(),
            risk_level: "Medium".to_string(),
        },
        "alice".to_string(),
    )?;
    println!("✓ Proposal 3 (Strategy Approval): {}", proposal3_id);

    // Proposal 4: Treasury Allocation
    let proposal4_id = governance.create_proposal(
        "Allocate Development Budget".to_string(),
        "Allocate Q1 budget for development team".to_string(),
        ProposalType::TreasuryAllocation {
            recipient: "dev_team".to_string(),
            amount: Decimal::from(100000),
            purpose: "Q1 2025 Development Budget".to_string(),
        },
        "alice".to_string(),
    )?;
    println!("✓ Proposal 4 (Treasury Allocation): {}\n", proposal4_id);

    // Voting on proposals
    println!("5. Voting on Proposals");
    println!("----------------------");

    // Vote on Proposal 1
    governance.vote(&proposal1_id, "alice", VoteType::For, Some("Needed for portfolio diversification".to_string()))?;
    println!("✓ Alice voted FOR Proposal 1 (with delegation: 300 voting power)");

    governance.vote(&proposal1_id, "bob", VoteType::For, None)?;
    println!("✓ Bob voted FOR Proposal 1 (300 voting power)");

    governance.vote(&proposal1_id, "diana", VoteType::Against, Some("Too aggressive for current market".to_string()))?;
    println!("✓ Diana voted AGAINST Proposal 1 (150 voting power)");

    // Vote on Proposal 2
    governance.vote(&proposal2_id, "alice", VoteType::For, None)?;
    governance.vote(&proposal2_id, "bob", VoteType::For, None)?;
    governance.vote(&proposal2_id, "diana", VoteType::For, None)?;
    println!("✓ All members voted FOR Proposal 2\n");

    // Vote on Proposal 3
    governance.vote(&proposal3_id, "alice", VoteType::For, None)?;
    governance.vote(&proposal3_id, "bob", VoteType::Abstain, Some("Need more backtesting data".to_string()))?;
    governance.vote(&proposal3_id, "diana", VoteType::For, None)?;
    println!("✓ Mixed voting on Proposal 3");
    println!("  - Bob abstained with reason\n");

    println!("6. Voting Statistics");
    println!("--------------------");
    let stats1 = governance.get_voting_statistics(&proposal1_id)?;
    println!("Proposal 1 Statistics:");
    println!("  Participation: {:.2}%", stats1.participation_rate);
    println!("  For: {}", stats1.votes_for);
    println!("  Against: {}", stats1.votes_against);
    println!("  Approval Rate: {:.2}%", stats1.approval_rate);
    println!("  Quorum Reached: {}", if stats1.quorum_reached { "YES" } else { "NO" });
    println!();

    // Wait for voting period to end
    println!("7. Waiting for Voting Period to End");
    println!("------------------------------------");
    println!("⏳ Waiting {} seconds...", voting_period);
    thread::sleep(Duration::from_secs(voting_period as u64 + 1));
    println!("✓ Voting period ended\n");

    // Finalize voting
    println!("8. Finalizing Votes");
    println!("-------------------");

    governance.finalize_voting(&proposal1_id)?;
    let proposal1 = governance.get_proposal(&proposal1_id)?;
    println!("✓ Proposal 1 finalized - Status: {}", proposal1.state);

    governance.finalize_voting(&proposal2_id)?;
    let proposal2 = governance.get_proposal(&proposal2_id)?;
    println!("✓ Proposal 2 finalized - Status: {}", proposal2.state);

    governance.finalize_voting(&proposal3_id)?;
    let proposal3 = governance.get_proposal(&proposal3_id)?;
    println!("✓ Proposal 3 finalized - Status: {}\n", proposal3.state);

    // Execute passed proposals
    println!("9. Executing Passed Proposals");
    println!("------------------------------");

    if proposal1.state == ProposalState::Passed {
        let result = governance.execute_proposal(&proposal1_id, "alice")?;
        println!("✓ Proposal 1 executed: {}", result.message);
    }

    if proposal2.state == ProposalState::Passed {
        let result = governance.execute_proposal(&proposal2_id, "bob")?;
        println!("✓ Proposal 2 executed: {}", result.message);
    }

    if proposal3.state == ProposalState::Passed {
        let result = governance.execute_proposal(&proposal3_id, "alice")?;
        println!("✓ Proposal 3 executed: {}", result.message);
    }

    println!();

    // Demonstrate veto
    println!("10. Demonstrating Veto Power");
    println!("----------------------------");

    // Create an emergency proposal
    let emergency_id = governance.create_proposal(
        "Emergency Trading Halt".to_string(),
        "Halt all trading due to detected market anomaly".to_string(),
        ProposalType::EmergencyAction {
            action: "halt_all_trading".to_string(),
            reason: "Unusual price movements detected".to_string(),
        },
        "alice".to_string(),
    )?;

    // Quick vote and pass
    governance.vote(&emergency_id, "alice", VoteType::For, None)?;
    governance.vote(&emergency_id, "diana", VoteType::For, None)?;

    thread::sleep(Duration::from_secs(6));
    governance.finalize_voting(&emergency_id)?;

    let emergency_proposal = governance.get_proposal(&emergency_id)?;
    if emergency_proposal.state == ProposalState::Passed {
        // Guardian vetoes
        governance.veto_proposal(
            &emergency_id,
            "bob",
            "False alarm - anomaly was due to exchange maintenance".to_string(),
        )?;
        println!("✓ Guardian Bob vetoed the emergency proposal");
        println!("  Reason: False alarm - anomaly was due to exchange maintenance\n");
    }

    // Final statistics
    println!("11. Final Statistics");
    println!("--------------------");
    println!("Total Proposals: {}", governance.proposal_count());
    println!("Total Members: {}", governance.member_count());

    let treasury_stats = governance.get_treasury_statistics();
    println!("Treasury Balance: ${}", treasury_stats.total_balance);
    println!("Transactions: {}", treasury_stats.transaction_count);

    println!();
    println!("=== Demo Complete ===");
    println!();
    println!("This demo showcased:");
    println!("✓ Member registration with different roles");
    println!("✓ Voting power delegation");
    println!("✓ Multiple proposal types");
    println!("✓ Weighted voting system");
    println!("✓ Quorum and threshold requirements");
    println!("✓ Proposal execution");
    println!("✓ Guardian veto power");
    println!("✓ Treasury management");

    Ok(())
}
