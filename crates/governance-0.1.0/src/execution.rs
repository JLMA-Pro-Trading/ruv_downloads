use crate::error::{GovernanceError, Result};
use crate::member::MemberManager;
use crate::proposal::ProposalManager;
use crate::types::{ExecutionConfig, ProposalState, ProposalType};
use chrono::Utc;
use rust_decimal::Decimal;
use std::sync::Arc;

/// Execution result
#[derive(Debug, Clone)]
pub struct ExecutionResult {
    pub proposal_id: String,
    pub success: bool,
    pub message: String,
    pub executed_at: chrono::DateTime<Utc>,
}

/// Proposal executor
pub struct ProposalExecutor {
    proposal_manager: Arc<ProposalManager>,
    member_manager: Arc<MemberManager>,
    config: ExecutionConfig,
}

impl ProposalExecutor {
    pub fn new(
        proposal_manager: Arc<ProposalManager>,
        member_manager: Arc<MemberManager>,
        config: ExecutionConfig,
    ) -> Self {
        Self {
            proposal_manager,
            member_manager,
            config,
        }
    }

    /// Execute a passed proposal
    pub fn execute_proposal(&self, proposal_id: &str, executor_id: &str) -> Result<ExecutionResult> {
        // Verify executor permissions
        let executor = self.member_manager.get_member(executor_id)?;
        if !executor.role.can_execute() {
            return Err(GovernanceError::InsufficientPermissions {
                required: "Execution rights".to_string(),
                actual: executor.role.to_string(),
            });
        }

        // Get proposal
        let proposal = self.proposal_manager.get_proposal(proposal_id)?;

        // Verify proposal state
        if proposal.state != ProposalState::Passed {
            return Err(GovernanceError::InvalidProposalState {
                expected: ProposalState::Passed.to_string(),
                actual: proposal.state.to_string(),
            });
        }

        // Check if already executed
        if proposal.executed_at.is_some() {
            return Err(GovernanceError::AlreadyExecuted);
        }

        // Check timelock
        if let Some(execution_time) = proposal.execution_time {
            let now = Utc::now();
            if now < execution_time {
                let remaining = (execution_time - now).num_seconds();
                return Err(GovernanceError::TimelockNotExpired { remaining });
            }
        }

        // Execute based on proposal type
        let result = self.execute_proposal_action(&proposal.proposal_type)?;

        // Mark as executed
        self.proposal_manager.mark_executed(proposal_id)?;

        Ok(ExecutionResult {
            proposal_id: proposal_id.to_string(),
            success: true,
            message: result,
            executed_at: Utc::now(),
        })
    }

    /// Execute the specific action based on proposal type
    fn execute_proposal_action(&self, proposal_type: &ProposalType) -> Result<String> {
        match proposal_type {
            ProposalType::ParameterChange {
                parameter,
                old_value,
                new_value,
            } => {
                // In a real system, this would update the parameter in the configuration
                Ok(format!(
                    "Updated parameter '{}' from '{}' to '{}'",
                    parameter, old_value, new_value
                ))
            }
            ProposalType::StrategyApproval {
                strategy_id,
                strategy_name,
                risk_level,
            } => {
                // In a real system, this would activate the strategy
                Ok(format!(
                    "Approved strategy '{}' (ID: {}, Risk: {})",
                    strategy_name, strategy_id, risk_level
                ))
            }
            ProposalType::RiskLimitAdjustment {
                limit_type,
                old_limit,
                new_limit,
            } => {
                // In a real system, this would update risk limits
                Ok(format!(
                    "Adjusted {} risk limit from {} to {}",
                    limit_type, old_limit, new_limit
                ))
            }
            ProposalType::EmergencyAction { action, reason } => {
                // In a real system, this would execute the emergency action
                Ok(format!(
                    "Executed emergency action: '{}' (Reason: {})",
                    action, reason
                ))
            }
            ProposalType::TreasuryAllocation {
                recipient,
                amount,
                purpose,
            } => {
                // In a real system, this would transfer funds
                Ok(format!(
                    "Allocated {} to '{}' for '{}'",
                    amount, recipient, purpose
                ))
            }
            ProposalType::MemberManagement { action, member_id } => {
                use crate::types::MemberAction;
                match action {
                    MemberAction::Add { role, voting_power } => {
                        self.member_manager.register_member(
                            member_id.clone(),
                            *role,
                            *voting_power,
                        )?;
                        Ok(format!("Added member '{}' with role {:?}", member_id, role))
                    }
                    MemberAction::Remove => {
                        self.member_manager.remove_member(member_id)?;
                        Ok(format!("Removed member '{}'", member_id))
                    }
                    MemberAction::UpdateRole { new_role } => {
                        self.member_manager.update_role(member_id, *new_role)?;
                        Ok(format!(
                            "Updated member '{}' role to {:?}",
                            member_id, new_role
                        ))
                    }
                    MemberAction::UpdateVotingPower { new_power } => {
                        self.member_manager.update_voting_power(member_id, *new_power)?;
                        Ok(format!(
                            "Updated member '{}' voting power to {}",
                            member_id, new_power
                        ))
                    }
                }
            }
        }
    }

    /// Set timelock for a proposal
    pub fn set_timelock(&self, proposal_id: &str) -> Result<()> {
        let proposal = self.proposal_manager.get_proposal(proposal_id)?;

        if proposal.state != ProposalState::Passed {
            return Err(GovernanceError::InvalidProposalState {
                expected: ProposalState::Passed.to_string(),
                actual: proposal.state.to_string(),
            });
        }

        let execution_time = Utc::now()
            + chrono::Duration::seconds(self.config.timelock_duration_seconds);

        self.proposal_manager.set_execution_time(proposal_id, execution_time)?;

        Ok(())
    }

    /// Veto a proposal (guardian/admin only)
    pub fn veto_proposal(&self, proposal_id: &str, vetoer_id: &str, reason: String) -> Result<()> {
        // Verify vetoer permissions
        let vetoer = self.member_manager.get_member(vetoer_id)?;
        if !vetoer.role.can_veto() {
            return Err(GovernanceError::InsufficientPermissions {
                required: "Veto rights".to_string(),
                actual: vetoer.role.to_string(),
            });
        }

        // Get proposal
        let proposal = self.proposal_manager.get_proposal(proposal_id)?;

        // Check veto period
        if let Some(execution_time) = proposal.execution_time {
            let veto_deadline = execution_time
                + chrono::Duration::seconds(self.config.veto_period_seconds);
            if Utc::now() > veto_deadline {
                return Err(GovernanceError::VetoPeriodExpired);
            }
        }

        // Execute veto
        self.proposal_manager.veto_proposal(proposal_id, vetoer_id.to_string(), reason)?;

        Ok(())
    }

    /// Check if proposal is ready for execution
    pub fn is_ready_for_execution(&self, proposal_id: &str) -> Result<bool> {
        let proposal = self.proposal_manager.get_proposal(proposal_id)?;
        Ok(proposal.is_ready_for_execution())
    }

    /// Auto-execute proposals if configured
    pub async fn auto_execute_proposals(&self, executor_id: &str) -> Vec<ExecutionResult> {
        if !self.config.auto_execute {
            return Vec::new();
        }

        let executable_proposals = self.proposal_manager.get_executable_proposals();
        let mut results = Vec::new();

        for proposal in executable_proposals {
            match self.execute_proposal(&proposal.id, executor_id) {
                Ok(result) => results.push(result),
                Err(e) => results.push(ExecutionResult {
                    proposal_id: proposal.id,
                    success: false,
                    message: e.to_string(),
                    executed_at: Utc::now(),
                }),
            }
        }

        results
    }

    /// Get execution configuration
    pub fn get_config(&self) -> &ExecutionConfig {
        &self.config
    }

    /// Update execution configuration
    pub fn update_config(&mut self, config: ExecutionConfig) {
        self.config = config;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{GovernanceConfig, Role};

    #[test]
    fn test_executor_creation() {
        let proposal_manager = Arc::new(ProposalManager::new());
        let member_manager = Arc::new(MemberManager::new());
        let config = ExecutionConfig::default();
        let _executor = ProposalExecutor::new(proposal_manager, member_manager, config);
    }

    #[test]
    fn test_execute_permission_check() {
        let proposal_manager = Arc::new(ProposalManager::new());
        let member_manager = Arc::new(MemberManager::new());
        let config = ExecutionConfig::default();
        let executor = ProposalExecutor::new(proposal_manager.clone(), member_manager.clone(), config);

        // Register member without execution rights
        member_manager.register_member("member1".to_string(), Role::Observer, Decimal::from(0)).unwrap();

        // Create and pass a proposal
        let proposal_id = proposal_manager.create_proposal(
            "Test".to_string(),
            "Desc".to_string(),
            ProposalType::EmergencyAction {
                action: "Test".to_string(),
                reason: "Test".to_string(),
            },
            "member1".to_string(),
            1, // 1 second voting period
        ).unwrap();

        // Should fail due to insufficient permissions
        assert!(executor.execute_proposal(&proposal_id, "member1").is_err());
    }

    #[test]
    fn test_veto_permission_check() {
        let proposal_manager = Arc::new(ProposalManager::new());
        let member_manager = Arc::new(MemberManager::new());
        let config = ExecutionConfig::default();
        let executor = ProposalExecutor::new(proposal_manager.clone(), member_manager.clone(), config);

        // Register member without veto rights
        member_manager.register_member("member1".to_string(), Role::Member, Decimal::from(100)).unwrap();

        let proposal_id = proposal_manager.create_proposal(
            "Test".to_string(),
            "Desc".to_string(),
            ProposalType::EmergencyAction {
                action: "Test".to_string(),
                reason: "Test".to_string(),
            },
            "member1".to_string(),
            3600,
        ).unwrap();

        // Should fail due to insufficient permissions
        assert!(executor.veto_proposal(&proposal_id, "member1", "Test veto".to_string()).is_err());
    }
}
