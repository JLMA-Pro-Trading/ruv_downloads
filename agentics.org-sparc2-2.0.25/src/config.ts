/**
 * Configuration module for SPARC 2.0
 * Handles loading and validation of TOML configuration and environment variables.
 */

import { parse } from "https://deno.land/std@0.215.0/toml/mod.ts";
import { load } from "https://deno.land/std@0.215.0/dotenv/mod.ts";

/**
 * SPARC 2.0 configuration interface
 */
export interface SPARCConfig {
  execution: {
    mode: "automatic" | "semi" | "manual" | "custom";
    diff_mode: "file" | "function";
    processing: "parallel" | "sequential" | "concurrent" | "swarm";
  };
  logging: {
    enable: boolean;
    vector_logging: boolean;
  };
  rollback: {
    checkpoint_enabled: boolean;
    temporal_rollback: boolean;
  };
  models: {
    reasoning: string;
    instruct: string;
  };
}

/**
 * Environment configuration interface
 */
export interface EnvConfig {
  OPENAI_API_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_ORG: string;
  EDGE_FUNCTION_URL: string;
  E2B_API_KEY: string;
  VECTOR_DB_URL: string;
}

/**
 * Load and validate TOML configuration
 * @param configPath Path to TOML config file
 * @returns Validated SPARCConfig object
 * @throws Error if config is invalid
 */
export async function loadConfig(configPath: string): Promise<SPARCConfig> {
  const tomlContent = await Deno.readTextFile(configPath);
  const rawConfig = parse(tomlContent) as {
    execution?: {
      mode?: string;
      diff_mode?: string;
      processing?: string;
    };
    logging?: {
      enable?: boolean;
      vector_logging?: boolean;
    };
    rollback?: {
      checkpoint_enabled?: boolean;
      temporal_rollback?: boolean;
    };
    models?: {
      reasoning?: string;
      instruct?: string;
    };
  };

  // Validate required sections exist
  if (!rawConfig.execution || !rawConfig.logging || !rawConfig.rollback || !rawConfig.models) {
    throw new Error("Missing required configuration sections");
  }

  // Validate execution mode
  if (!["automatic", "semi", "manual", "custom"].includes(rawConfig.execution.mode || "")) {
    throw new Error("Invalid execution mode");
  }

  // Validate diff mode
  if (!["file", "function"].includes(rawConfig.execution.diff_mode || "")) {
    throw new Error("Invalid diff mode");
  }

  // Validate processing mode
  if (
    !["parallel", "sequential", "concurrent", "swarm"].includes(
      rawConfig.execution.processing || "",
    )
  ) {
    throw new Error("Invalid processing mode");
  }

  // Cast validated config
  const config: SPARCConfig = {
    execution: {
      mode: rawConfig.execution.mode as "automatic" | "semi" | "manual" | "custom",
      diff_mode: rawConfig.execution.diff_mode as "file" | "function",
      processing: rawConfig.execution.processing as
        | "parallel"
        | "sequential"
        | "concurrent"
        | "swarm",
    },
    logging: {
      enable: Boolean(rawConfig.logging.enable),
      vector_logging: Boolean(rawConfig.logging.vector_logging),
    },
    rollback: {
      checkpoint_enabled: Boolean(rawConfig.rollback.checkpoint_enabled),
      temporal_rollback: Boolean(rawConfig.rollback.temporal_rollback),
    },
    models: {
      reasoning: String(rawConfig.models.reasoning || ""),
      instruct: String(rawConfig.models.instruct || ""),
    },
  };

  return config;
}

/**
 * Load and validate environment variables
 * @returns Validated EnvConfig object
 * @throws Error if required variables are missing
 */
export async function loadEnvConfig(): Promise<EnvConfig> {
  // Load .env file if it exists
  await load();

  const requiredVars = [
    "OPENAI_API_KEY",
    "GITHUB_TOKEN",
    "GITHUB_ORG",
    "EDGE_FUNCTION_URL",
    "E2B_API_KEY",
    "VECTOR_DB_URL",
  ] as const;

  const config = {} as EnvConfig;
  const missing: string[] = [];

  for (const varName of requiredVars) {
    const value = Deno.env.get(varName);
    if (!value) {
      missing.push(varName);
    } else {
      config[varName] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return config;
}
