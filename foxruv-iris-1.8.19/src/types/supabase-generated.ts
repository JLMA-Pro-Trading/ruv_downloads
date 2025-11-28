export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_decisions: {
        Row: {
          agent_id: string
          created_at: string
          decision_data: Json
          decision_type: string
          id: string
          public_key: string
          run_id: string | null
          signature: string
          tenant_id: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          decision_data: Json
          decision_type: string
          id?: string
          public_key: string
          run_id?: string | null
          signature: string
          tenant_id: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          decision_data?: Json
          decision_type?: string
          id?: string
          public_key?: string
          run_id?: string | null
          signature?: string
          tenant_id?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_decisions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_decisions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_decisions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_executions: {
        Row: {
          agent_id: string
          completed_at: string | null
          cost_usd: number | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          execution_type: string
          id: string
          input_data: Json
          metrics: Json | null
          output_data: Json | null
          parent_execution_id: string | null
          started_at: string | null
          status: string
          tenant_id: string
          tokens_used: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          execution_type: string
          id?: string
          input_data: Json
          metrics?: Json | null
          output_data?: Json | null
          parent_execution_id?: string | null
          started_at?: string | null
          status?: string
          tenant_id: string
          tokens_used?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          execution_type?: string
          id?: string
          input_data?: Json
          metrics?: Json | null
          output_data?: Json | null
          parent_execution_id?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          tokens_used?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_executions_parent_fk"
            columns: ["parent_execution_id"]
            isOneToOne: false
            referencedRelation: "agent_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_failures: {
        Row: {
          agent_id: string
          context: Json | null
          created_at: string
          error_message: string
          failure_type: string
          id: string
          learned_at: string | null
          reflection: string | null
          resolution: string | null
          run_id: string | null
          tenant_id: string
        }
        Insert: {
          agent_id: string
          context?: Json | null
          created_at?: string
          error_message: string
          failure_type: string
          id?: string
          learned_at?: string | null
          reflection?: string | null
          resolution?: string | null
          run_id?: string | null
          tenant_id: string
        }
        Update: {
          agent_id?: string
          context?: Json | null
          created_at?: string
          error_message?: string
          failure_type?: string
          id?: string
          learned_at?: string | null
          reflection?: string | null
          resolution?: string | null
          run_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_failures_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_failures_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_failures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_instances: {
        Row: {
          agent_id: string
          agent_type: string
          capabilities: Json | null
          created_at: string
          id: string
          last_heartbeat_at: string | null
          performance_metrics: Json | null
          status: string
          swarm_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_type: string
          capabilities?: Json | null
          created_at?: string
          id?: string
          last_heartbeat_at?: string | null
          performance_metrics?: Json | null
          status?: string
          swarm_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_type?: string
          capabilities?: Json | null
          created_at?: string
          id?: string
          last_heartbeat_at?: string | null
          performance_metrics?: Json | null
          status?: string
          swarm_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_instances_swarm_id_fkey"
            columns: ["swarm_id"]
            isOneToOne: false
            referencedRelation: "agent_swarms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_keypairs: {
        Row: {
          agent_id: string
          algorithm: string
          created_at: string
          encrypted_private_key: string
          encryption_key_id: string
          expires_at: string | null
          id: string
          nonce: string
          public_key: string
          rotated_at: string | null
          tenant_id: string
        }
        Insert: {
          agent_id: string
          algorithm?: string
          created_at?: string
          encrypted_private_key: string
          encryption_key_id: string
          expires_at?: string | null
          id?: string
          nonce: string
          public_key: string
          rotated_at?: string | null
          tenant_id: string
        }
        Update: {
          agent_id?: string
          algorithm?: string
          created_at?: string
          encrypted_private_key?: string
          encryption_key_id?: string
          expires_at?: string | null
          id?: string
          nonce?: string
          public_key?: string
          rotated_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_keypairs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_keypairs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memories: {
        Row: {
          access_count: number
          agent_id: string
          causal_links: string[] | null
          content: string
          created_at: string
          embedding: string | null
          expires_at: string | null
          id: string
          importance_score: number
          last_accessed_at: string
          memory_type: string
          metadata: Json | null
          tenant_id: string
        }
        Insert: {
          access_count?: number
          agent_id: string
          causal_links?: string[] | null
          content: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance_score?: number
          last_accessed_at?: string
          memory_type: string
          metadata?: Json | null
          tenant_id: string
        }
        Update: {
          access_count?: number
          agent_id?: string
          causal_links?: string[] | null
          content?: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance_score?: number
          last_accessed_at?: string
          memory_type?: string
          metadata?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_memories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memory: {
        Row: {
          access_count: number | null
          agent_id: string
          content: string
          created_at: string | null
          embedding: string | null
          expires_at: string | null
          id: string
          importance_score: number | null
          last_accessed_at: string | null
          memory_type: string
          metadata: Json | null
          tenant_id: string
        }
        Insert: {
          access_count?: number | null
          agent_id: string
          content: string
          created_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance_score?: number | null
          last_accessed_at?: string | null
          memory_type: string
          metadata?: Json | null
          tenant_id: string
        }
        Update: {
          access_count?: number | null
          agent_id?: string
          content?: string
          created_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance_score?: number | null
          last_accessed_at?: string | null
          memory_type?: string
          metadata?: Json | null
          tenant_id?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_instance_id: string
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          input_data: Json
          metrics: Json | null
          output_data: Json | null
          sandbox_id: string | null
          started_at: string | null
          status: string
          task_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agent_instance_id: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_data?: Json
          metrics?: Json | null
          output_data?: Json | null
          sandbox_id?: string | null
          started_at?: string | null
          status?: string
          task_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agent_instance_id?: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_data?: Json
          metrics?: Json | null
          output_data?: Json | null
          sandbox_id?: string | null
          started_at?: string | null
          status?: string
          task_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_skills: {
        Row: {
          agent_id: string
          created_at: string
          description: string | null
          id: string
          implementation: Json
          last_used_at: string | null
          performance_score: number | null
          skill_name: string
          skill_type: string
          tenant_id: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          description?: string | null
          id?: string
          implementation: Json
          last_used_at?: string | null
          performance_score?: number | null
          skill_name: string
          skill_type: string
          tenant_id: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          description?: string | null
          id?: string
          implementation?: Json
          last_used_at?: string | null
          performance_score?: number | null
          skill_name?: string
          skill_type?: string
          tenant_id?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_skills_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_skills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_swarms: {
        Row: {
          agent_count: number
          config: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          project_id: string | null
          status: string
          tenant_id: string
          topology: string
          updated_at: string
        }
        Insert: {
          agent_count?: number
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          project_id?: string | null
          status?: string
          tenant_id: string
          topology?: string
          updated_at?: string
        }
        Update: {
          agent_count?: number
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          project_id?: string | null
          status?: string
          tenant_id?: string
          topology?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_swarms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_swarms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      artifacts: {
        Row: {
          agent_run_id: string | null
          artifact_type: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          mime_type: string | null
          name: string
          size_bytes: number
          storage_path: string
          task_id: string | null
          tenant_id: string
        }
        Insert: {
          agent_run_id?: string | null
          artifact_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          name: string
          size_bytes: number
          storage_path: string
          task_id?: string | null
          tenant_id: string
        }
        Update: {
          agent_run_id?: string | null
          artifact_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          name?: string
          size_bytes?: number
          storage_path?: string
          task_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifacts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          tenant_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          tenant_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          tenant_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          amount_usd: number | null
          created_at: string
          currency: string | null
          event_type: string
          id: string
          metadata: Json | null
          stripe_event_id: string | null
          tenant_id: string
        }
        Insert: {
          amount_usd?: number | null
          created_at?: string
          currency?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          stripe_event_id?: string | null
          tenant_id: string
        }
        Update: {
          amount_usd?: number | null
          created_at?: string
          currency?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          stripe_event_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      consensus_lineage: {
        Row: {
          confidence: number | null
          contributing_experts: Json
          created_at: string | null
          disagreement_score: number | null
          final_decision: Json
          id: string
          metadata: Json | null
          project: string
          reasoning_chains: Json | null
          run_id: string | null
          section_tag: string | null
          task_id: string | null
          tenant_id: string | null
          winning_version: string | null
        }
        Insert: {
          confidence?: number | null
          contributing_experts: Json
          created_at?: string | null
          disagreement_score?: number | null
          final_decision: Json
          id?: string
          metadata?: Json | null
          project: string
          reasoning_chains?: Json | null
          run_id?: string | null
          section_tag?: string | null
          task_id?: string | null
          tenant_id?: string | null
          winning_version?: string | null
        }
        Update: {
          confidence?: number | null
          contributing_experts?: Json
          created_at?: string | null
          disagreement_score?: number | null
          final_decision?: Json
          id?: string
          metadata?: Json | null
          project?: string
          reasoning_chains?: Json | null
          run_id?: string | null
          section_tag?: string | null
          task_id?: string | null
          tenant_id?: string | null
          winning_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consensus_lineage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_signatures: {
        Row: {
          active: boolean | null
          created_at: string | null
          expert_id: string
          id: string
          metadata: Json | null
          performance_metrics: Json | null
          project: string
          prompt: string
          signature: Json | null
          tenant_id: string | null
          updated_at: string | null
          version: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          expert_id: string
          id?: string
          metadata?: Json | null
          performance_metrics?: Json | null
          project: string
          prompt: string
          signature?: Json | null
          tenant_id?: string | null
          updated_at?: string | null
          version: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          expert_id?: string
          id?: string
          metadata?: Json | null
          performance_metrics?: Json | null
          project?: string
          prompt?: string
          signature?: Json | null
          tenant_id?: string | null
          updated_at?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_signatures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      iris_api_keys: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          last_used_at: string | null
          project_id: string
          project_name: string
          revoked_at: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          last_used_at?: string | null
          project_id: string
          project_name: string
          revoked_at?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          last_used_at?: string | null
          project_id?: string
          project_name?: string
          revoked_at?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      iris_reports: {
        Row: {
          created_at: string | null
          drift_alerts_count: number | null
          health_score: number
          id: string
          metadata: Json | null
          overall_health: string
          project: string
          recommended_actions_count: number | null
          report_data: Json
          report_type: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          drift_alerts_count?: number | null
          health_score: number
          id?: string
          metadata?: Json | null
          overall_health: string
          project: string
          recommended_actions_count?: number | null
          report_data: Json
          report_type: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          drift_alerts_count?: number | null
          health_score?: number
          id?: string
          metadata?: Json | null
          overall_health?: string
          project?: string
          recommended_actions_count?: number | null
          report_data?: Json
          report_type?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      iris_telemetry: {
        Row: {
          confidence: number | null
          created_at: string | null
          event_type: string | null
          expert_id: string
          id: string
          latency_ms: number | null
          metadata: Json | null
          outcome: string | null
          project_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          event_type?: string | null
          expert_id: string
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          outcome?: string | null
          project_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          event_type?: string | null
          expert_id?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          outcome?: string | null
          project_id?: string
        }
        Relationships: []
      }
      learned_patterns: {
        Row: {
          created_at: string | null
          domain: string | null
          embedding: string | null
          expert_id: string | null
          id: string
          last_used_at: string | null
          metadata: Json | null
          pattern_data: Json
          pattern_name: string
          pattern_type: string
          project: string
          success_rate: number | null
          tags: string[] | null
          tenant_id: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          embedding?: string | null
          expert_id?: string | null
          id?: string
          last_used_at?: string | null
          metadata?: Json | null
          pattern_data: Json
          pattern_name: string
          pattern_type: string
          project: string
          success_rate?: number | null
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          embedding?: string | null
          expert_id?: string | null
          id?: string
          last_used_at?: string | null
          metadata?: Json | null
          pattern_data?: Json
          pattern_name?: string
          pattern_type?: string
          project?: string
          success_rate?: number | null
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          metadata: Json | null
          role: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          metadata?: Json | null
          role?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          metadata?: Json | null
          role?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      model_run_log: {
        Row: {
          confidence: number | null
          consensus_participation: boolean | null
          cost_usd: number | null
          error_message: string | null
          expert_id: string
          id: string
          input_hash: string | null
          latency_ms: number | null
          metadata: Json | null
          outcome: string | null
          project: string
          reflexion_ids: string[] | null
          reflexion_used: boolean | null
          run_id: string | null
          tenant_id: string | null
          timestamp: string | null
          tokens_in: number | null
          tokens_out: number | null
          version: string | null
        }
        Insert: {
          confidence?: number | null
          consensus_participation?: boolean | null
          cost_usd?: number | null
          error_message?: string | null
          expert_id: string
          id?: string
          input_hash?: string | null
          latency_ms?: number | null
          metadata?: Json | null
          outcome?: string | null
          project: string
          reflexion_ids?: string[] | null
          reflexion_used?: boolean | null
          run_id?: string | null
          tenant_id?: string | null
          timestamp?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          version?: string | null
        }
        Update: {
          confidence?: number | null
          consensus_participation?: boolean | null
          cost_usd?: number | null
          error_message?: string | null
          expert_id?: string
          id?: string
          input_hash?: string | null
          latency_ms?: number | null
          metadata?: Json | null
          outcome?: string | null
          project?: string
          reflexion_ids?: string[] | null
          reflexion_used?: boolean | null
          run_id?: string | null
          tenant_id?: string | null
          timestamp?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_run_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          name: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string | null
          id: string
          limit_value: number
          resource_type: string
          tenant_id: string
          window_seconds: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          limit_value: number
          resource_type: string
          tenant_id: string
          window_seconds: number
        }
        Update: {
          created_at?: string | null
          id?: string
          limit_value?: number
          resource_type?: string
          tenant_id?: string
          window_seconds?: number
        }
        Relationships: []
      }
      reflexion_bank: {
        Row: {
          confidence: number | null
          context: Json
          created_at: string | null
          embedding: string | null
          expert_id: string | null
          id: string
          impact_score: number | null
          last_reused_at: string | null
          outcome: Json
          project: string
          reflexion_type: string
          reuse_count: number | null
          success: boolean
          tenant_id: string | null
        }
        Insert: {
          confidence?: number | null
          context: Json
          created_at?: string | null
          embedding?: string | null
          expert_id?: string | null
          id?: string
          impact_score?: number | null
          last_reused_at?: string | null
          outcome: Json
          project: string
          reflexion_type: string
          reuse_count?: number | null
          success: boolean
          tenant_id?: string | null
        }
        Update: {
          confidence?: number | null
          context?: Json
          created_at?: string | null
          embedding?: string | null
          expert_id?: string | null
          id?: string
          impact_score?: number | null
          last_reused_at?: string | null
          outcome?: Json
          project?: string
          reflexion_type?: string
          reuse_count?: number | null
          success?: boolean
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reflexion_bank_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      research_citations: {
        Row: {
          authors: string[] | null
          citation_text: string | null
          created_at: string
          doi: string | null
          id: string
          publication_date: string | null
          relevance_score: number | null
          research_job_id: string
          source: string
          tenant_id: string
          title: string
          url: string | null
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          authors?: string[] | null
          citation_text?: string | null
          created_at?: string
          doi?: string | null
          id?: string
          publication_date?: string | null
          relevance_score?: number | null
          research_job_id: string
          source: string
          tenant_id: string
          title: string
          url?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          authors?: string[] | null
          citation_text?: string | null
          created_at?: string
          doi?: string | null
          id?: string
          publication_date?: string | null
          relevance_score?: number | null
          research_job_id?: string
          source?: string
          tenant_id?: string
          title?: string
          url?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_citations_research_job_id_fkey"
            columns: ["research_job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_citations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      research_jobs: {
        Row: {
          agent_run_id: string | null
          citation_count: number | null
          completed_at: string | null
          created_at: string
          id: string
          quality_score: number | null
          query: string
          results: Json | null
          search_strategy: Json | null
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          agent_run_id?: string | null
          citation_count?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          quality_score?: number | null
          query: string
          results?: Json | null
          search_strategy?: Json | null
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          agent_run_id?: string | null
          citation_count?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          quality_score?: number | null
          query?: string
          results?: Json | null
          search_strategy?: Json | null
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_jobs_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sandboxes: {
        Row: {
          cpu_usage_percent: number | null
          created_at: string
          e2b_sandbox_id: string
          env_vars: Json | null
          id: string
          last_heartbeat_at: string | null
          memory_usage_mb: number | null
          metadata: Json | null
          started_at: string | null
          status: string
          template: string
          tenant_id: string
          terminated_at: string | null
        }
        Insert: {
          cpu_usage_percent?: number | null
          created_at?: string
          e2b_sandbox_id: string
          env_vars?: Json | null
          id?: string
          last_heartbeat_at?: string | null
          memory_usage_mb?: number | null
          metadata?: Json | null
          started_at?: string | null
          status?: string
          template: string
          tenant_id: string
          terminated_at?: string | null
        }
        Update: {
          cpu_usage_percent?: number | null
          created_at?: string
          e2b_sandbox_id?: string
          env_vars?: Json | null
          id?: string
          last_heartbeat_at?: string | null
          memory_usage_mb?: number | null
          metadata?: Json | null
          started_at?: string | null
          status?: string
          template?: string
          tenant_id?: string
          terminated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sandboxes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          agent_id: string | null
          analysis: Json
          blocked: boolean
          created_at: string
          event_type: string
          id: string
          resolved: boolean
          resolved_at: string | null
          severity: string
          source_ip: unknown
          tenant_id: string
          threat_score: number | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          analysis?: Json
          blocked?: boolean
          created_at?: string
          event_type: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          source_ip?: unknown
          tenant_id: string
          threat_score?: number | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          analysis?: Json
          blocked?: boolean
          created_at?: string
          event_type?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          source_ip?: unknown
          tenant_id?: string
          threat_score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_versions: {
        Row: {
          changelog: string | null
          created_at: string | null
          diff: Json | null
          expert_id: string
          from_version: string | null
          id: string
          improvement_metrics: Json | null
          project: string
          rollback_reason: string | null
          tenant_id: string | null
          to_version: string | null
        }
        Insert: {
          changelog?: string | null
          created_at?: string | null
          diff?: Json | null
          expert_id: string
          from_version?: string | null
          id?: string
          improvement_metrics?: Json | null
          project: string
          rollback_reason?: string | null
          tenant_id?: string | null
          to_version?: string | null
        }
        Update: {
          changelog?: string | null
          created_at?: string | null
          diff?: Json | null
          expert_id?: string
          from_version?: string | null
          id?: string
          improvement_metrics?: Json | null
          project?: string
          rollback_reason?: string | null
          tenant_id?: string | null
          to_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          error_message: string | null
          id: string
          input_data: Json | null
          output_data: Json | null
          priority: string
          project_id: string | null
          started_at: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          priority?: string
          project_id?: string | null
          started_at?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          priority?: string
          project_id?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          limits: Json
          metadata: Json | null
          name: string
          plan: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          limits?: Json
          metadata?: Json | null
          name: string
          plan?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          limits?: Json
          metadata?: Json | null
          name?: string
          plan?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      usage_records: {
        Row: {
          cost_usd: number | null
          id: string
          metadata: Json | null
          quantity: number
          recorded_at: string
          resource_id: string | null
          resource_type: string
          tenant_id: string
          unit: string
        }
        Insert: {
          cost_usd?: number | null
          id?: string
          metadata?: Json | null
          quantity: number
          recorded_at?: string
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          unit: string
        }
        Update: {
          cost_usd?: number | null
          id?: string
          metadata?: Json | null
          quantity?: number
          recorded_at?: string
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          metadata: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          metadata?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      workflow_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_step: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input_data: Json
          output_data: Json | null
          started_at: string | null
          status: string
          steps_completed: number | null
          tenant_id: string
          total_steps: number
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_data: Json
          output_data?: Json | null
          started_at?: string | null
          status?: string
          steps_completed?: number | null
          tenant_id: string
          total_steps: number
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_data?: Json
          output_data?: Json | null
          started_at?: string | null
          status?: string
          steps_completed?: number | null
          tenant_id?: string
          total_steps?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          avg_duration_ms: number | null
          created_at: string | null
          created_by: string | null
          definition: Json
          description: string | null
          execution_count: number | null
          failure_count: number | null
          id: string
          last_executed_at: string | null
          name: string
          status: string
          success_count: number | null
          tenant_id: string
          updated_at: string | null
          version: number | null
          workflow_type: string
        }
        Insert: {
          avg_duration_ms?: number | null
          created_at?: string | null
          created_by?: string | null
          definition: Json
          description?: string | null
          execution_count?: number | null
          failure_count?: number | null
          id?: string
          last_executed_at?: string | null
          name: string
          status?: string
          success_count?: number | null
          tenant_id: string
          updated_at?: string | null
          version?: number | null
          workflow_type: string
        }
        Update: {
          avg_duration_ms?: number | null
          created_at?: string | null
          created_by?: string | null
          definition?: Json
          description?: string | null
          execution_count?: number | null
          failure_count?: number | null
          id?: string
          last_executed_at?: string | null
          name?: string
          status?: string
          success_count?: number | null
          tenant_id?: string
          updated_at?: string | null
          version?: number | null
          workflow_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_performance_metrics: {
        Row: {
          agent_id: string | null
          avg_duration_ms: number | null
          failed_executions: number | null
          last_execution_at: string | null
          p95_duration_ms: number | null
          p99_duration_ms: number | null
          successful_executions: number | null
          tenant_id: string | null
          total_cost_usd: number | null
          total_executions: number | null
          total_tokens_used: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_tenant_limit: {
        Args: { p_resource_type: string; p_tenant_id: string }
        Returns: boolean
      }
      delete_expired_memories: { Args: never; Returns: number }
      get_tenant_id: { Args: never; Returns: string }
      increment_pattern_usage: {
        Args: { pattern_id: string }
        Returns: undefined
      }
      increment_usage_count: { Args: { key_id: string }; Returns: number }
      is_service_role: { Args: never; Returns: boolean }
      match_patterns: {
        Args: {
          filter_domain?: string
          filter_project?: string
          filter_type?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          domain: string
          expert_id: string
          id: string
          pattern_data: Json
          pattern_name: string
          pattern_type: string
          project: string
          similarity: number
          success_rate: number
          tags: string[]
          usage_count: number
        }[]
      }
      refresh_agent_performance_metrics: { Args: never; Returns: undefined }
      search_agent_memories: {
        Args: {
          p_agent_id: string
          p_embedding: string
          p_limit?: number
          p_memory_type?: string
          p_similarity_threshold?: number
          p_tenant_id: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          importance_score: number
          metadata: Json
          similarity: number
        }[]
      }
      search_agent_memory: {
        Args: {
          p_agent_id: string
          p_embedding: string
          p_limit?: number
          p_memory_type?: string
          p_similarity_threshold?: number
          p_tenant_id: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          importance_score: number
          metadata: Json
          similarity: number
        }[]
      }
      user_is_tenant_admin: {
        Args: { check_tenant_id: string }
        Returns: boolean
      }
      user_is_tenant_member: {
        Args: { check_tenant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
