# Governance Crate

A comprehensive governance system for decentralized decision-making in the Neural Trader platform.

## Features

### 🗳️ Proposal Management
- **Multiple Proposal Types**:
  - Parameter Changes
  - Strategy Approvals
  - Risk Limit Adjustments
  - Emergency Actions
  - Treasury Allocations
  - Member Management

- **Proposal States**: Draft, Active, Passed, Rejected, Executed, Expired, Vetoed
- **Metadata Tracking**: Title, description, proposer, timestamps

### 👥 Member Management
- **Role-Based Access Control**:
  - **Admin**: Full proposal, voting, and execution rights
  - **Guardian**: Can veto proposals, full voting rights
  - **Member**: Can propose and vote
  - **Observer**: Read-only access

- **Voting Power**: Stake-based or role-based weighting
- **Reputation System**: Automatic reputation tracking based on participation
- **Delegation**: Members can delegate voting power to others

### 🗳️ Voting Mechanisms
- **Vote Types**: For, Against, Abstain
- **Weighted Voting**: Voting power based on stake/shares/reputation
- **Quorum Requirements**: Minimum participation threshold
- **Passing Threshold**: Configurable approval percentage (e.g., 66%)
- **Vote Delegation**: Transfer voting power to trusted members

### ⚙️ Execution System
- **Automatic Execution**: Execute proposals after passing
- **Time-Locked Execution**: Delay period before execution
- **Veto Mechanism**: Guardian/admin override capability
- **Execution Validation**: Verify proposal state and permissions

### 💰 Treasury Integration
- **Budget Allocation**: Governance-controlled fund allocation
- **Fund Withdrawal**: Multi-signature treasury access
- **Emergency Fund**: Reserved funds for critical situations
- **Transaction History**: Complete audit trail

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
governance = { path = "../governance" }
rust_decimal = "1.33"
```

## Quick Start

```rust
use governance::{GovernanceSystem, types::*};
use rust_decimal::Decimal;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Create governance system with configuration
    let mut config = GovernanceConfig::default();
    config.quorum_percentage = Decimal::from(50);  // 50% participation
    config.passing_threshold = Decimal::from(66);  // 66% approval
    config.voting_period_seconds = 604800;         // 7 days

    let governance = GovernanceSystem::new(config);

    // 2. Register members
    governance.register_member(
        "alice".to_string(),
        Role::Admin,
        Decimal::from(100)
    )?;

    governance.register_member(
        "bob".to_string(),
        Role::Member,
        Decimal::from(150)
    )?;

    // 3. Create a proposal
    let proposal_id = governance.create_proposal(
        "Increase Risk Limit".to_string(),
        "Proposal to increase daily VaR limit from $50k to $75k".to_string(),
        ProposalType::RiskLimitAdjustment {
            limit_type: "daily_var".to_string(),
            old_limit: Decimal::from(50000),
            new_limit: Decimal::from(75000),
        },
        "alice".to_string(),
    )?;

    // 4. Cast votes
    governance.vote(&proposal_id, "alice", VoteType::For, None)?;
    governance.vote(&proposal_id, "bob", VoteType::For, None)?;

    // 5. Wait for voting period to end...

    // 6. Finalize voting
    governance.finalize_voting(&proposal_id)?;

    // 7. Execute if passed
    let result = governance.execute_proposal(&proposal_id, "alice")?;
    println!("Executed: {}", result.message);

    Ok(())
}
```

## Examples

Run the comprehensive demo:

```bash
cargo run --example governance_demo
```

## Testing

Run the test suite:

```bash
# All tests (20+ tests)
cargo test -p governance

# Specific test files
cargo test -p governance --test proposal_tests
cargo test -p governance --test voting_tests
cargo test -p governance --test integration_tests
```

## Documentation

For complete API documentation and advanced usage, see the inline documentation:

```bash
cargo doc -p governance --open
```

## License

Licensed under either of Apache License, Version 2.0 or MIT license at your option.
