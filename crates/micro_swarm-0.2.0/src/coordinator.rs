//! Swarm coordination and distributed consensus

use alloc::{vec::Vec, collections::BTreeMap, string::String, boxed::Box, vec};

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

use crate::{
    Result, SwarmError, AgentId, TaskId, Message, MessageType, MessagePayload,
    SwarmTopology, Agent, AgentState, Task, TaskPriority,
};

/// Coordination configuration
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct CoordinationConfig {
    /// Swarm topology
    pub topology: SwarmTopology,
    /// Maximum coordination group size
    pub max_group_size: usize,
    /// Consensus threshold (percentage)
    pub consensus_threshold: f32,
    /// Enable fault tolerance
    pub fault_tolerance: bool,
    /// Leader election enabled
    pub leader_election: bool,
    /// Heartbeat interval
    pub heartbeat_interval: u64,
}

impl Default for CoordinationConfig {
    fn default() -> Self {
        Self {
            topology: SwarmTopology::Mesh,
            max_group_size: 16,
            consensus_threshold: 0.67, // 2/3 majority
            fault_tolerance: true,
            leader_election: true,
            heartbeat_interval: 100,
        }
    }
}

/// Coordination role of an agent
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum CoordinationRole {
    /// Leader agent (coordinates others)
    Leader,
    /// Follower agent (executes tasks)
    Follower,
    /// Observer agent (monitors but doesn't participate)
    Observer,
    /// Candidate for leadership
    Candidate,
}

/// Consensus state for distributed decisions
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum ConsensusState {
    /// Proposal phase
    Proposing,
    /// Voting phase
    Voting,
    /// Decision reached
    Decided,
    /// Consensus failed
    Failed,
}

/// Consensus proposal
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct ConsensusProposal {
    /// Proposal ID
    pub id: u64,
    /// Proposer agent
    pub proposer: AgentId,
    /// Proposal type
    pub proposal_type: ProposalType,
    /// Proposal data
    pub data: Vec<u8>,
    /// Required votes
    pub required_votes: usize,
    /// Current votes
    pub votes: BTreeMap<AgentId, Vote>,
    /// Proposal state
    pub state: ConsensusState,
    /// Creation timestamp
    pub created_at: u64,
}

/// Types of consensus proposals
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum ProposalType {
    /// Task assignment proposal
    TaskAssignment,
    /// Resource allocation proposal
    ResourceAllocation,
    /// Agent registration proposal
    AgentRegistration,
    /// Configuration change proposal
    ConfigurationChange,
    /// Emergency response proposal
    EmergencyResponse,
}

/// Vote on a consensus proposal
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct Vote {
    /// Voter agent ID
    pub voter: AgentId,
    /// Vote decision
    pub decision: VoteDecision,
    /// Vote timestamp
    pub timestamp: u64,
    /// Optional vote reason
    pub reason: Option<String>,
}

/// Vote decision
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum VoteDecision {
    /// Vote in favor
    Approve,
    /// Vote against
    Reject,
    /// Abstain from voting
    Abstain,
}

/// Coordination group information
#[derive(Debug, Clone)]
pub struct CoordinationGroup {
    /// Group ID
    pub id: u64,
    /// Group members
    pub members: Vec<AgentId>,
    /// Group leader
    pub leader: Option<AgentId>,
    /// Group capabilities
    pub capabilities: Vec<String>,
    /// Active proposals
    pub active_proposals: BTreeMap<u64, ConsensusProposal>,
    /// Group health status
    pub health: GroupHealth,
}

/// Group health status
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum GroupHealth {
    /// All members healthy
    Healthy,
    /// Some members degraded
    Degraded,
    /// Group is unhealthy
    Unhealthy,
    /// Group is failed
    Failed,
}

/// Swarm coordinator for distributed coordination
pub struct SwarmCoordinator {
    /// Configuration
    config: CoordinationConfig,
    /// Coordination groups
    groups: BTreeMap<u64, CoordinationGroup>,
    /// Agent roles
    agent_roles: BTreeMap<AgentId, CoordinationRole>,
    /// Agent health status
    agent_health: BTreeMap<AgentId, AgentHealthInfo>,
    /// Global leader (if centralized topology)
    global_leader: Option<AgentId>,
    /// Active consensus proposals
    global_proposals: BTreeMap<u64, ConsensusProposal>,
    /// Coordination statistics
    stats: CoordinationStats,
}

/// Agent health information
#[derive(Debug, Clone)]
struct AgentHealthInfo {
    /// Agent ID
    agent_id: AgentId,
    /// Last heartbeat timestamp
    last_heartbeat: u64,
    /// Health status
    health: AgentHealth,
    /// Failure count
    failure_count: u32,
}

/// Agent health status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AgentHealth {
    /// Agent is healthy
    Healthy,
    /// Agent is degraded
    Degraded,
    /// Agent is unhealthy
    Unhealthy,
    /// Agent has failed
    Failed,
}

/// Coordination statistics
#[derive(Debug, Clone, Default)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct CoordinationStats {
    /// Total proposals created
    pub total_proposals: u64,
    /// Successful consensus decisions
    pub successful_consensus: u64,
    /// Failed consensus attempts
    pub failed_consensus: u64,
    /// Leader elections performed
    pub leader_elections: u64,
    /// Agent failures detected
    pub agent_failures: u64,
    /// Group splits/merges
    pub group_reconfigurations: u64,
}

impl SwarmCoordinator {
    /// Create a new swarm coordinator
    pub fn new(config: CoordinationConfig) -> Self {
        Self {
            config,
            groups: BTreeMap::new(),
            agent_roles: BTreeMap::new(),
            agent_health: BTreeMap::new(),
            global_leader: None,
            global_proposals: BTreeMap::new(),
            stats: CoordinationStats::default(),
        }
    }
    
    /// Initialize the coordinator
    pub fn initialize(&mut self) -> Result<()> {
        // Create initial coordination group if needed
        match self.config.topology {
            SwarmTopology::Centralized | SwarmTopology::Star => {
                // Single group with leader
                self.create_group(Vec::new())?;
            }
            SwarmTopology::Mesh | SwarmTopology::Hierarchical | SwarmTopology::Ring => {
                // Multiple groups will be created as agents join
            }
        }
        
        Ok(())
    }
    
    /// Register an agent with the coordinator
    pub fn register_agent(&mut self, agent_id: AgentId, capabilities: Vec<String>) -> Result<()> {
        // Initialize agent health
        self.agent_health.insert(agent_id, AgentHealthInfo {
            agent_id,
            last_heartbeat: self.get_current_time(),
            health: AgentHealth::Healthy,
            failure_count: 0,
        });
        
        // Assign initial role
        let role = match self.config.topology {
            SwarmTopology::Centralized | SwarmTopology::Star => {
                if self.global_leader.is_none() {
                    self.global_leader = Some(agent_id);
                    CoordinationRole::Leader
                } else {
                    CoordinationRole::Follower
                }
            }
            _ => CoordinationRole::Follower,
        };
        
        self.agent_roles.insert(agent_id, role);
        
        // Add to appropriate coordination group
        self.assign_to_group(agent_id, capabilities)?;
        
        Ok(())
    }
    
    /// Unregister an agent from coordination
    pub fn unregister_agent(&mut self, agent_id: AgentId) -> Result<()> {
        // Collect groups that need leader election
        let mut groups_needing_election = Vec::new();
        
        // Remove from all groups
        for group in self.groups.values_mut() {
            group.members.retain(|&id| id != agent_id);
            
            // Handle leader departure
            if group.leader == Some(agent_id) {
                group.leader = None;
                if !group.members.is_empty() {
                    groups_needing_election.push(group.id);
                }
            }
        }
        
        // Elect new leaders for groups
        for group_id in groups_needing_election {
            self.elect_group_leader(group_id)?;
        }
        
        // Handle global leader departure
        if self.global_leader == Some(agent_id) {
            self.global_leader = None;
            self.elect_global_leader()?;
        }
        
        self.agent_roles.remove(&agent_id);
        self.agent_health.remove(&agent_id);
        
        Ok(())
    }
    
    /// Submit a proposal for consensus
    pub fn submit_proposal(
        &mut self, 
        proposer: AgentId, 
        proposal_type: ProposalType, 
        data: Vec<u8>
    ) -> Result<u64> {
        static mut PROPOSAL_COUNTER: u64 = 0;
        let proposal_id = unsafe {
            PROPOSAL_COUNTER += 1;
            PROPOSAL_COUNTER
        };
        
        // Calculate required votes based on consensus threshold
        let total_agents = self.agent_roles.len();
        let required_votes = ((total_agents as f32) * self.config.consensus_threshold).ceil() as usize;
        
        let proposal = ConsensusProposal {
            id: proposal_id,
            proposer,
            proposal_type,
            data,
            required_votes,
            votes: BTreeMap::new(),
            state: ConsensusState::Proposing,
            created_at: self.get_current_time(),
        };
        
        self.global_proposals.insert(proposal_id, proposal);
        self.stats.total_proposals += 1;
        
        Ok(proposal_id)
    }
    
    /// Cast a vote on a proposal
    pub fn cast_vote(
        &mut self, 
        proposal_id: u64, 
        voter: AgentId, 
        decision: VoteDecision,
        reason: Option<String>
    ) -> Result<()> {
        // Get timestamp before borrowing mutably
        let timestamp = self.get_current_time();
        
        let proposal = self.global_proposals.get_mut(&proposal_id)
            .ok_or_else(|| SwarmError::not_found("Proposal not found"))?;
        
        if proposal.state != ConsensusState::Voting && proposal.state != ConsensusState::Proposing {
            return Err(SwarmError::invalid_state("Proposal is not accepting votes"));
        }
        
        let vote = Vote {
            voter,
            decision,
            timestamp,
            reason,
        };
        
        proposal.votes.insert(voter, vote);
        proposal.state = ConsensusState::Voting;
        
        // Check if consensus is reached
        self.check_consensus(proposal_id)?;
        
        Ok(())
    }
    
    /// Process heartbeats from agents
    pub fn process_heartbeat(&mut self, agent_id: AgentId) -> Result<()> {
        let current_time = self.get_current_time();
        
        if let Some(health_info) = self.agent_health.get_mut(&agent_id) {
            health_info.last_heartbeat = current_time;
            health_info.health = AgentHealth::Healthy;
            health_info.failure_count = 0;
        }
        
        Ok(())
    }
    
    /// Check health of all agents
    pub fn check_agent_health(&mut self) -> Result<Vec<AgentId>> {
        let current_time = self.get_current_time();
        let timeout_threshold = self.config.heartbeat_interval * 3;
        let mut failed_agents = Vec::new();
        
        for (agent_id, health_info) in self.agent_health.iter_mut() {
            let time_since_heartbeat = current_time - health_info.last_heartbeat;
            
            if time_since_heartbeat > timeout_threshold {
                health_info.failure_count += 1;
                
                let new_health = match health_info.failure_count {
                    1..=2 => AgentHealth::Degraded,
                    3..=5 => AgentHealth::Unhealthy,
                    _ => AgentHealth::Failed,
                };
                
                if health_info.health != new_health {
                    health_info.health = new_health;
                    
                    if new_health == AgentHealth::Failed {
                        failed_agents.push(*agent_id);
                        self.stats.agent_failures += 1;
                    }
                }
            }
        }
        
        // Handle failed agents
        for agent_id in &failed_agents {
            self.handle_agent_failure(*agent_id)?;
        }
        
        Ok(failed_agents)
    }
    
    /// Get coordination statistics
    pub fn stats(&self) -> &CoordinationStats {
        &self.stats
    }
    
    /// Get agent role
    pub fn get_agent_role(&self, agent_id: AgentId) -> Option<CoordinationRole> {
        self.agent_roles.get(&agent_id).copied()
    }
    
    /// Get current leader (for centralized topologies)
    pub fn get_leader(&self) -> Option<AgentId> {
        self.global_leader
    }
    
    /// Get coordination groups
    pub fn get_groups(&self) -> Vec<&CoordinationGroup> {
        self.groups.values().collect()
    }
    
    /// Create a new coordination group
    fn create_group(&mut self, initial_members: Vec<AgentId>) -> Result<u64> {
        static mut GROUP_COUNTER: u64 = 0;
        let group_id = unsafe {
            GROUP_COUNTER += 1;
            GROUP_COUNTER
        };
        
        let group = CoordinationGroup {
            id: group_id,
            members: initial_members,
            leader: None,
            capabilities: Vec::new(),
            active_proposals: BTreeMap::new(),
            health: GroupHealth::Healthy,
        };
        
        self.groups.insert(group_id, group);
        Ok(group_id)
    }
    
    /// Assign agent to appropriate coordination group
    fn assign_to_group(&mut self, agent_id: AgentId, capabilities: Vec<String>) -> Result<()> {
        match self.config.topology {
            SwarmTopology::Centralized | SwarmTopology::Star => {
                // Add to main group
                if let Some(group) = self.groups.values_mut().next() {
                    if !group.members.contains(&agent_id) {
                        group.members.push(agent_id);
                        group.capabilities.extend(capabilities);
                        group.capabilities.sort();
                        group.capabilities.dedup();
                    }
                }
            }
            SwarmTopology::Mesh => {
                // Find group with similar capabilities or create new one
                let suitable_group = self.groups.values_mut()
                    .find(|group| {
                        group.members.len() < self.config.max_group_size &&
                        capabilities.iter().any(|cap| group.capabilities.contains(cap))
                    });
                
                if let Some(group) = suitable_group {
                    group.members.push(agent_id);
                } else {
                    let group_id = self.create_group(vec![agent_id])?;
                    if let Some(group) = self.groups.get_mut(&group_id) {
                        group.capabilities = capabilities;
                    }
                }
            }
            SwarmTopology::Hierarchical => {
                // Assign based on hierarchy level (simplified)
                let group_level = agent_id.raw() % 3; // 3 levels
                let suitable_group = self.groups.values_mut()
                    .find(|group| group.id % 3 == group_level && group.members.len() < self.config.max_group_size);
                
                if let Some(group) = suitable_group {
                    group.members.push(agent_id);
                } else {
                    self.create_group(vec![agent_id])?;
                }
            }
            SwarmTopology::Ring => {
                // Add to ring (simplified - just one group)
                if self.groups.is_empty() {
                    self.create_group(vec![agent_id])?;
                } else if let Some(group) = self.groups.values_mut().next() {
                    group.members.push(agent_id);
                }
            }
        }
        
        Ok(())
    }
    
    /// Elect a leader for a specific group
    fn elect_group_leader(&mut self, group_id: u64) -> Result<()> {
        let group = self.groups.get_mut(&group_id)
            .ok_or_else(|| SwarmError::not_found("Group not found"))?;
        
        if group.members.is_empty() {
            return Ok(());
        }
        
        // Simple election: choose agent with lowest ID (deterministic)
        let new_leader = *group.members.iter().min().unwrap();
        group.leader = Some(new_leader);
        
        // Update agent role
        self.agent_roles.insert(new_leader, CoordinationRole::Leader);
        
        // Update other members to followers
        for &member in &group.members {
            if member != new_leader {
                self.agent_roles.insert(member, CoordinationRole::Follower);
            }
        }
        
        self.stats.leader_elections += 1;
        Ok(())
    }
    
    /// Elect a global leader
    fn elect_global_leader(&mut self) -> Result<()> {
        if !self.config.leader_election {
            return Ok(());
        }
        
        // Find all healthy agents
        let healthy_agents: Vec<_> = self.agent_health.iter()
            .filter(|(_, health)| matches!(health.health, AgentHealth::Healthy))
            .map(|(id, _)| *id)
            .collect();
        
        if healthy_agents.is_empty() {
            return Ok(());
        }
        
        // Simple election: choose agent with highest ID
        let new_leader = *healthy_agents.iter().max().unwrap();
        self.global_leader = Some(new_leader);
        self.agent_roles.insert(new_leader, CoordinationRole::Leader);
        
        self.stats.leader_elections += 1;
        Ok(())
    }
    
    /// Check if consensus is reached for a proposal
    fn check_consensus(&mut self, proposal_id: u64) -> Result<()> {
        let proposal = self.global_proposals.get_mut(&proposal_id)
            .ok_or_else(|| SwarmError::not_found("Proposal not found"))?;
        
        let approve_votes = proposal.votes.values()
            .filter(|vote| vote.decision == VoteDecision::Approve)
            .count();
        
        let reject_votes = proposal.votes.values()
            .filter(|vote| vote.decision == VoteDecision::Reject)
            .count();
        
        if approve_votes >= proposal.required_votes {
            proposal.state = ConsensusState::Decided;
            self.stats.successful_consensus += 1;
        } else if reject_votes > (proposal.votes.len() - proposal.required_votes) {
            proposal.state = ConsensusState::Failed;
            self.stats.failed_consensus += 1;
        }
        
        Ok(())
    }
    
    /// Handle agent failure
    fn handle_agent_failure(&mut self, agent_id: AgentId) -> Result<()> {
        if !self.config.fault_tolerance {
            return Ok(());
        }
        
        // Collect groups that need leader election
        let mut groups_needing_election = Vec::new();
        
        // Remove from groups and elect new leaders if needed
        for group in self.groups.values_mut() {
            group.members.retain(|&id| id != agent_id);
            
            if group.leader == Some(agent_id) {
                group.leader = None;
                if !group.members.is_empty() {
                    groups_needing_election.push(group.id);
                }
            }
        }
        
        // Elect new leaders for groups
        for group_id in groups_needing_election {
            self.elect_group_leader(group_id)?;
        }
        
        // Handle global leader failure
        if self.global_leader == Some(agent_id) {
            self.global_leader = None;
            self.elect_global_leader()?;
        }
        
        Ok(())
    }
    
    /// Get current time (simulation counter)
    fn get_current_time(&self) -> u64 {
        static mut COUNTER: u64 = 0;
        unsafe {
            COUNTER += 1;
            COUNTER
        }
    }
}