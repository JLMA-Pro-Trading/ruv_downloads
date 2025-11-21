//! Network topology implementations for agent coordination

use crate::error::Result;
use async_trait::async_trait;
use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

/// Trait for network topology
#[async_trait]
pub trait Topology: Send + Sync {
    /// Get topology type
    fn topology_type(&self) -> TopologyType;

    /// Add a node to the topology
    async fn add_node(&self, node_id: Uuid) -> Result<()>;

    /// Remove a node from the topology
    async fn remove_node(&self, node_id: Uuid) -> Result<()>;

    /// Get neighbors for a node
    async fn get_neighbors(&self, node_id: Uuid) -> Vec<Uuid>;

    /// Get all nodes in the topology
    async fn get_all_nodes(&self) -> Vec<Uuid>;

    /// Check if topology is connected
    async fn is_connected(&self) -> bool;
}

/// Topology types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TopologyType {
    Mesh,
    Ring,
    Star,
    Hierarchical,
}

/// Mesh topology - all nodes connected to all other nodes
pub struct MeshTopology {
    nodes: Arc<DashMap<Uuid, Vec<Uuid>>>,
}

impl MeshTopology {
    /// Create a new mesh topology
    pub fn new() -> Self {
        Self {
            nodes: Arc::new(DashMap::new()),
        }
    }

    /// Rebuild mesh connections
    async fn rebuild_connections(&self) {
        let all_nodes: Vec<Uuid> = self.nodes.iter().map(|entry| *entry.key()).collect();

        // In mesh topology, every node connects to every other node
        for entry in self.nodes.iter() {
            let node_id = *entry.key();
            let neighbors: Vec<Uuid> = all_nodes
                .iter()
                .filter(|&&id| id != node_id)
                .copied()
                .collect();

            self.nodes.insert(node_id, neighbors);
        }
    }
}

impl Default for MeshTopology {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Topology for MeshTopology {
    fn topology_type(&self) -> TopologyType {
        TopologyType::Mesh
    }

    async fn add_node(&self, node_id: Uuid) -> Result<()> {
        self.nodes.insert(node_id, Vec::new());
        self.rebuild_connections().await;
        Ok(())
    }

    async fn remove_node(&self, node_id: Uuid) -> Result<()> {
        self.nodes.remove(&node_id);
        self.rebuild_connections().await;
        Ok(())
    }

    async fn get_neighbors(&self, node_id: Uuid) -> Vec<Uuid> {
        self.nodes
            .get(&node_id)
            .map(|r| r.value().clone())
            .unwrap_or_default()
    }

    async fn get_all_nodes(&self) -> Vec<Uuid> {
        self.nodes.iter().map(|entry| *entry.key()).collect()
    }

    async fn is_connected(&self) -> bool {
        // Mesh topology is always connected if it has nodes
        !self.nodes.is_empty()
    }
}

/// Ring topology - nodes connected in a circular pattern
pub struct RingTopology {
    nodes: Arc<DashMap<Uuid, Vec<Uuid>>>,
    node_order: Arc<parking_lot::RwLock<Vec<Uuid>>>,
}

impl RingTopology {
    /// Create a new ring topology
    pub fn new() -> Self {
        Self {
            nodes: Arc::new(DashMap::new()),
            node_order: Arc::new(parking_lot::RwLock::new(Vec::new())),
        }
    }

    /// Rebuild ring connections
    async fn rebuild_connections(&self) {
        let order = self.node_order.read().clone();
        let n = order.len();

        if n == 0 {
            return;
        }

        for (i, &node_id) in order.iter().enumerate() {
            let prev = order[(i + n - 1) % n];
            let next = order[(i + 1) % n];
            self.nodes.insert(node_id, vec![prev, next]);
        }
    }
}

impl Default for RingTopology {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Topology for RingTopology {
    fn topology_type(&self) -> TopologyType {
        TopologyType::Ring
    }

    async fn add_node(&self, node_id: Uuid) -> Result<()> {
        self.node_order.write().push(node_id);
        self.nodes.insert(node_id, Vec::new());
        self.rebuild_connections().await;
        Ok(())
    }

    async fn remove_node(&self, node_id: Uuid) -> Result<()> {
        self.node_order.write().retain(|&id| id != node_id);
        self.nodes.remove(&node_id);
        self.rebuild_connections().await;
        Ok(())
    }

    async fn get_neighbors(&self, node_id: Uuid) -> Vec<Uuid> {
        self.nodes
            .get(&node_id)
            .map(|r| r.value().clone())
            .unwrap_or_default()
    }

    async fn get_all_nodes(&self) -> Vec<Uuid> {
        self.node_order.read().clone()
    }

    async fn is_connected(&self) -> bool {
        self.node_order.read().len() >= 3
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mesh_topology() {
        let topology = MeshTopology::new();
        let node1 = Uuid::new_v4();
        let node2 = Uuid::new_v4();
        let node3 = Uuid::new_v4();

        topology.add_node(node1).await.unwrap();
        topology.add_node(node2).await.unwrap();
        topology.add_node(node3).await.unwrap();

        let neighbors = topology.get_neighbors(node1).await;
        assert_eq!(neighbors.len(), 2);
        assert!(neighbors.contains(&node2));
        assert!(neighbors.contains(&node3));
    }

    #[tokio::test]
    async fn test_ring_topology() {
        let topology = RingTopology::new();
        let node1 = Uuid::new_v4();
        let node2 = Uuid::new_v4();
        let node3 = Uuid::new_v4();

        topology.add_node(node1).await.unwrap();
        topology.add_node(node2).await.unwrap();
        topology.add_node(node3).await.unwrap();

        let neighbors = topology.get_neighbors(node1).await;
        assert_eq!(neighbors.len(), 2);
    }

    #[tokio::test]
    async fn test_topology_removal() {
        let topology = MeshTopology::new();
        let node1 = Uuid::new_v4();
        let node2 = Uuid::new_v4();

        topology.add_node(node1).await.unwrap();
        topology.add_node(node2).await.unwrap();
        topology.remove_node(node1).await.unwrap();

        let all_nodes = topology.get_all_nodes().await;
        assert_eq!(all_nodes.len(), 1);
        assert!(all_nodes.contains(&node2));
    }
}