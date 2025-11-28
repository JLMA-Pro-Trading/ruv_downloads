use crate::error::{GovernanceError, Result};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Treasury transaction type
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum TransactionType {
    Deposit,
    Withdrawal,
    Allocation,
    Fee,
    Dividend,
    Emergency,
}

/// Treasury transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub transaction_type: TransactionType,
    pub amount: Decimal,
    pub from: Option<String>,
    pub to: Option<String>,
    pub purpose: String,
    pub proposal_id: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub approved: bool,
}

impl Transaction {
    pub fn new(
        transaction_type: TransactionType,
        amount: Decimal,
        from: Option<String>,
        to: Option<String>,
        purpose: String,
        proposal_id: Option<String>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            transaction_type,
            amount,
            from,
            to,
            purpose,
            proposal_id,
            timestamp: Utc::now(),
            approved: false,
        }
    }
}

/// Budget allocation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetAllocation {
    pub category: String,
    pub allocated: Decimal,
    pub spent: Decimal,
    pub remaining: Decimal,
    pub last_updated: DateTime<Utc>,
}

impl BudgetAllocation {
    pub fn new(category: String, allocated: Decimal) -> Self {
        Self {
            category,
            allocated,
            spent: Decimal::ZERO,
            remaining: allocated,
            last_updated: Utc::now(),
        }
    }

    pub fn spend(&mut self, amount: Decimal) -> Result<()> {
        if amount > self.remaining {
            return Err(GovernanceError::TreasuryOperationFailed(
                "Insufficient budget allocation".to_string(),
            ));
        }
        self.spent += amount;
        self.remaining -= amount;
        self.last_updated = Utc::now();
        Ok(())
    }

    pub fn increase_allocation(&mut self, amount: Decimal) {
        self.allocated += amount;
        self.remaining += amount;
        self.last_updated = Utc::now();
    }
}

/// Treasury manager
pub struct TreasuryManager {
    balance: Arc<DashMap<String, Decimal>>, // asset -> balance
    transactions: Arc<DashMap<String, Transaction>>,
    budgets: Arc<DashMap<String, BudgetAllocation>>,
    emergency_fund: Decimal,
    emergency_threshold: Decimal,
}

impl TreasuryManager {
    pub fn new(initial_balance: Decimal, emergency_threshold: Decimal) -> Self {
        let balance = Arc::new(DashMap::new());
        balance.insert("USD".to_string(), initial_balance);

        Self {
            balance,
            transactions: Arc::new(DashMap::new()),
            budgets: Arc::new(DashMap::new()),
            emergency_fund: Decimal::ZERO,
            emergency_threshold,
        }
    }

    /// Get current balance for an asset
    pub fn get_balance(&self, asset: &str) -> Decimal {
        self.balance
            .get(asset)
            .map(|r| *r.value())
            .unwrap_or(Decimal::ZERO)
    }

    /// Deposit funds
    pub fn deposit(&self, asset: &str, amount: Decimal, from: String, purpose: String) -> Result<String> {
        if amount <= Decimal::ZERO {
            return Err(GovernanceError::InvalidParameter(
                "Amount must be positive".to_string(),
            ));
        }

        // Create transaction
        let transaction = Transaction::new(
            TransactionType::Deposit,
            amount,
            Some(from),
            None,
            purpose,
            None,
        );
        let tx_id = transaction.id.clone();

        // Update balance
        self.balance
            .entry(asset.to_string())
            .and_modify(|b| *b += amount)
            .or_insert(amount);

        // Record transaction
        self.transactions.insert(tx_id.clone(), transaction);

        Ok(tx_id)
    }

    /// Withdraw funds (requires governance approval for large amounts)
    pub fn withdraw(
        &self,
        asset: &str,
        amount: Decimal,
        to: String,
        purpose: String,
        proposal_id: Option<String>,
    ) -> Result<String> {
        if amount <= Decimal::ZERO {
            return Err(GovernanceError::InvalidParameter(
                "Amount must be positive".to_string(),
            ));
        }

        let current_balance = self.get_balance(asset);
        if amount > current_balance {
            return Err(GovernanceError::TreasuryOperationFailed(
                "Insufficient balance".to_string(),
            ));
        }

        // Create transaction
        let mut transaction = Transaction::new(
            TransactionType::Withdrawal,
            amount,
            None,
            Some(to),
            purpose,
            proposal_id.clone(),
        );

        // Require approval if no proposal_id or large amount
        transaction.approved = proposal_id.is_some();

        let tx_id = transaction.id.clone();

        // Update balance only if approved
        if transaction.approved {
            self.balance
                .entry(asset.to_string())
                .and_modify(|b| *b -= amount);
        }

        // Record transaction
        self.transactions.insert(tx_id.clone(), transaction);

        Ok(tx_id)
    }

    /// Allocate budget to a category
    pub fn allocate_budget(&self, category: String, amount: Decimal, proposal_id: String) -> Result<()> {
        if amount <= Decimal::ZERO {
            return Err(GovernanceError::InvalidParameter(
                "Amount must be positive".to_string(),
            ));
        }

        // Check if sufficient balance
        let balance = self.get_balance("USD");
        if amount > balance {
            return Err(GovernanceError::TreasuryOperationFailed(
                "Insufficient treasury balance".to_string(),
            ));
        }

        // Create or update budget allocation
        self.budgets
            .entry(category.clone())
            .and_modify(|b| b.increase_allocation(amount))
            .or_insert_with(|| BudgetAllocation::new(category, amount));

        // Record transaction
        let transaction = Transaction::new(
            TransactionType::Allocation,
            amount,
            Some("Treasury".to_string()),
            None,
            "Budget allocation".to_string(),
            Some(proposal_id),
        );
        self.transactions.insert(transaction.id.clone(), transaction);

        Ok(())
    }

    /// Spend from budget allocation
    pub fn spend_from_budget(&self, category: &str, amount: Decimal, purpose: String) -> Result<String> {
        let mut budget = self.budgets
            .get_mut(category)
            .ok_or_else(|| {
                GovernanceError::TreasuryOperationFailed("Budget category not found".to_string())
            })?;

        budget.spend(amount)?;

        // Record transaction
        let transaction = Transaction::new(
            TransactionType::Withdrawal,
            amount,
            Some(format!("Budget:{}", category)),
            None,
            purpose,
            None,
        );
        let tx_id = transaction.id.clone();
        self.transactions.insert(tx_id.clone(), transaction);

        Ok(tx_id)
    }

    /// Transfer to emergency fund
    pub fn transfer_to_emergency_fund(&self, amount: Decimal) -> Result<()> {
        let balance = self.get_balance("USD");
        if amount > balance {
            return Err(GovernanceError::TreasuryOperationFailed(
                "Insufficient balance for emergency fund transfer".to_string(),
            ));
        }

        self.balance
            .entry("USD".to_string())
            .and_modify(|b| *b -= amount);

        // In a real system, this would be stored separately
        // For now, we'll just track it
        let transaction = Transaction::new(
            TransactionType::Emergency,
            amount,
            Some("Treasury".to_string()),
            Some("EmergencyFund".to_string()),
            "Emergency fund allocation".to_string(),
            None,
        );
        self.transactions.insert(transaction.id.clone(), transaction);

        Ok(())
    }

    /// Access emergency fund (requires governance approval)
    pub fn access_emergency_fund(&self, amount: Decimal, proposal_id: String, purpose: String) -> Result<String> {
        if amount > self.emergency_fund {
            return Err(GovernanceError::TreasuryOperationFailed(
                "Insufficient emergency fund".to_string(),
            ));
        }

        let transaction = Transaction::new(
            TransactionType::Emergency,
            amount,
            Some("EmergencyFund".to_string()),
            None,
            purpose,
            Some(proposal_id),
        );
        let tx_id = transaction.id.clone();
        self.transactions.insert(tx_id.clone(), transaction);

        Ok(tx_id)
    }

    /// Get transaction by ID
    pub fn get_transaction(&self, tx_id: &str) -> Result<Transaction> {
        self.transactions
            .get(tx_id)
            .map(|r| r.value().clone())
            .ok_or_else(|| {
                GovernanceError::TreasuryOperationFailed(format!("Transaction {} not found", tx_id))
            })
    }

    /// Get all transactions
    pub fn get_all_transactions(&self) -> Vec<Transaction> {
        self.transactions.iter().map(|r| r.value().clone()).collect()
    }

    /// Get budget allocation
    pub fn get_budget(&self, category: &str) -> Result<BudgetAllocation> {
        self.budgets
            .get(category)
            .map(|r| r.value().clone())
            .ok_or_else(|| {
                GovernanceError::TreasuryOperationFailed(format!("Budget {} not found", category))
            })
    }

    /// Get all budget allocations
    pub fn get_all_budgets(&self) -> Vec<BudgetAllocation> {
        self.budgets.iter().map(|r| r.value().clone()).collect()
    }

    /// Get treasury statistics
    pub fn get_statistics(&self) -> TreasuryStatistics {
        let total_balance: Decimal = self.balance.iter().map(|r| *r.value()).sum();
        let total_allocated: Decimal = self.budgets.iter().map(|r| r.value().allocated).sum();
        let total_spent: Decimal = self.budgets.iter().map(|r| r.value().spent).sum();

        TreasuryStatistics {
            total_balance,
            total_allocated,
            total_spent,
            emergency_fund: self.emergency_fund,
            transaction_count: self.transactions.len(),
            budget_categories: self.budgets.len(),
        }
    }
}

/// Treasury statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreasuryStatistics {
    pub total_balance: Decimal,
    pub total_allocated: Decimal,
    pub total_spent: Decimal,
    pub emergency_fund: Decimal,
    pub transaction_count: usize,
    pub budget_categories: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_treasury_creation() {
        let treasury = TreasuryManager::new(Decimal::from(1000000), Decimal::from(100000));
        assert_eq!(treasury.get_balance("USD"), Decimal::from(1000000));
    }

    #[test]
    fn test_deposit() {
        let treasury = TreasuryManager::new(Decimal::from(1000000), Decimal::from(100000));
        let tx_id = treasury.deposit(
            "USD",
            Decimal::from(50000),
            "Investor".to_string(),
            "Investment".to_string(),
        ).unwrap();

        assert!(!tx_id.is_empty());
        assert_eq!(treasury.get_balance("USD"), Decimal::from(1050000));
    }

    #[test]
    fn test_withdraw() {
        let treasury = TreasuryManager::new(Decimal::from(1000000), Decimal::from(100000));
        let tx_id = treasury.withdraw(
            "USD",
            Decimal::from(50000),
            "Recipient".to_string(),
            "Payment".to_string(),
            Some("proposal123".to_string()),
        ).unwrap();

        assert!(!tx_id.is_empty());
        assert_eq!(treasury.get_balance("USD"), Decimal::from(950000));
    }

    #[test]
    fn test_budget_allocation() {
        let treasury = TreasuryManager::new(Decimal::from(1000000), Decimal::from(100000));
        assert!(treasury.allocate_budget(
            "Development".to_string(),
            Decimal::from(200000),
            "proposal456".to_string(),
        ).is_ok());

        let budget = treasury.get_budget("Development").unwrap();
        assert_eq!(budget.allocated, Decimal::from(200000));
        assert_eq!(budget.remaining, Decimal::from(200000));
    }

    #[test]
    fn test_spend_from_budget() {
        let treasury = TreasuryManager::new(Decimal::from(1000000), Decimal::from(100000));
        treasury.allocate_budget(
            "Development".to_string(),
            Decimal::from(200000),
            "proposal456".to_string(),
        ).unwrap();

        assert!(treasury.spend_from_budget(
            "Development",
            Decimal::from(50000),
            "Contractor payment".to_string(),
        ).is_ok());

        let budget = treasury.get_budget("Development").unwrap();
        assert_eq!(budget.spent, Decimal::from(50000));
        assert_eq!(budget.remaining, Decimal::from(150000));
    }

    #[test]
    fn test_insufficient_balance() {
        let treasury = TreasuryManager::new(Decimal::from(1000), Decimal::from(100));
        assert!(treasury.withdraw(
            "USD",
            Decimal::from(2000),
            "Recipient".to_string(),
            "Payment".to_string(),
            Some("proposal789".to_string()),
        ).is_err());
    }
}
