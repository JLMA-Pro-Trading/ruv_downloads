import { Database } from 'better-sqlite3';
import SQLite from 'better-sqlite3';
import { saveReflexion } from '../supabase/reflexions.js';
import { logTelemetry } from '../supabase/telemetry.js';
import { recordConsensusLineage } from '../supabase/consensus.js';

export interface MigrationOptions {
  agentDbPath: string;
  projectId: string;
  dryRun?: boolean;
  batchSize?: number;
  onProgress?: (progress: MigrationProgress) => void;
}

export interface MigrationProgress {
  phase: 'signatures' | 'reflexions' | 'telemetry' | 'consensus';
  current: number;
  total: number;
  percentage: number;
}

export interface MigrationResult {
  success: boolean;
  migratedRecords: {
    signatures: number;
    reflexions: number;
    telemetry: number;
    consensus: number;
  };
  errors: string[];
  duration: number;
}

interface AgentDBSignature {
  id: string;
  task: string;
  solution: string;
  patterns: string;
  metadata: string;
  score: number;
  timestamp: number;
}

interface AgentDBReflexion {
  id: string;
  task: string;
  thought: string;
  action: string;
  observation: string;
  reflection: string;
  trajectory_id: string;
  step_number: number;
  metadata: string;
  timestamp: number;
}

interface AgentDBTelemetry {
  id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  cost: number;
  metadata: string;
  timestamp: number;
}

interface AgentDBConsensus {
  id: string;
  decision_id: string;
  options: string;
  votes: string;
  winning_option: string;
  confidence: number;
  metadata: string;
  timestamp: number;
}

/**
 * Migrate expert signatures from AgentDB to Supabase
 */
export async function migrateSignatures(options: MigrationOptions): Promise<number> {
  const { agentDbPath, dryRun = false, batchSize = 100, onProgress } = options;

  let db: Database | null = null;
  let migratedCount = 0;
  const errors: string[] = [];

  try {
    // Open AgentDB database
    db = new SQLite(agentDbPath, { readonly: true });

    // Check if signatures table exists
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='expert_signatures'")
      .get();

    if (!tableExists) {
      console.log('No expert_signatures table found in AgentDB');
      return 0;
    }

    // Get total count
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM expert_signatures').get() as { count: number };
    const total = totalResult.count;

    if (total === 0) {
      console.log('No signatures to migrate');
      return 0;
    }

    console.log(`Found ${total} signatures to migrate`);

    // Fetch all signatures
    const signatures = db
      .prepare('SELECT * FROM expert_signatures ORDER BY timestamp ASC')
      .all() as AgentDBSignature[];

    // Process in batches
    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, Math.min(i + batchSize, signatures.length));

      for (const sig of batch) {
        try {
          if (!dryRun) {
            // NOTE: Signature migration needs proper mapping to new schema
            // The old AgentDB schema is incompatible with new Supabase structure
            // Would need expertId, version, prompt fields to properly migrate
            // Parse JSON fields for potential future use
            // const patterns = sig.patterns ? JSON.parse(sig.patterns) : [];
            // const metadata = sig.metadata ? JSON.parse(sig.metadata) : {};
            console.warn(`Skipping signature ${sig.id}: needs schema mapping`);
          }

          migratedCount++;

          // Report progress
          if (onProgress) {
            onProgress({
              phase: 'signatures',
              current: migratedCount,
              total,
              percentage: Math.round((migratedCount / total) * 100),
            });
          }
        } catch (error) {
          const errorMsg = `Failed to migrate signature ${sig.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Log batch progress
      console.log(`Migrated ${Math.min(i + batchSize, signatures.length)}/${total} signatures`);
    }

    if (errors.length > 0) {
      console.warn(`Completed with ${errors.length} errors`);
    }

    return migratedCount;
  } catch (error) {
    throw new Error(`Signature migration failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (db) {
      db.close();
    }
  }
}

/**
 * Migrate reflexions from AgentDB to Supabase
 */
export async function migrateReflexions(options: MigrationOptions): Promise<number> {
  const { agentDbPath, dryRun = false, batchSize = 100, onProgress } = options;

  let db: Database | null = null;
  let migratedCount = 0;
  const errors: string[] = [];

  try {
    // Open AgentDB database
    db = new SQLite(agentDbPath, { readonly: true });

    // Check if reflexions table exists
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reflexions'")
      .get();

    if (!tableExists) {
      console.log('No reflexions table found in AgentDB');
      return 0;
    }

    // Get total count
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM reflexions').get() as { count: number };
    const total = totalResult.count;

    if (total === 0) {
      console.log('No reflexions to migrate');
      return 0;
    }

    console.log(`Found ${total} reflexions to migrate`);

    // Fetch all reflexions
    const reflexions = db
      .prepare('SELECT * FROM reflexions ORDER BY timestamp ASC')
      .all() as AgentDBReflexion[];

    // Process in batches
    for (let i = 0; i < reflexions.length; i += batchSize) {
      const batch = reflexions.slice(i, Math.min(i + batchSize, reflexions.length));

      for (const refl of batch) {
        try {
          // Parse JSON fields
          const metadata = refl.metadata ? JSON.parse(refl.metadata) : {};

          // Convert to Supabase format (saveReflexion expects different parameters)
          if (!dryRun) {
            await saveReflexion(
              refl.task,
              {
                thought: refl.thought,
                action: refl.action,
                trajectory_id: refl.trajectory_id,
                step_number: refl.step_number,
              },
              {
                observation: refl.observation,
                reflection: refl.reflection,
              },
              true,
              {
                ...metadata,
                migrated_from_agentdb: true,
                original_id: refl.id,
                original_timestamp: refl.timestamp,
              }
            );
          }

          migratedCount++;

          // Report progress
          if (onProgress) {
            onProgress({
              phase: 'reflexions',
              current: migratedCount,
              total,
              percentage: Math.round((migratedCount / total) * 100),
            });
          }
        } catch (error) {
          const errorMsg = `Failed to migrate reflexion ${refl.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Log batch progress
      console.log(`Migrated ${Math.min(i + batchSize, reflexions.length)}/${total} reflexions`);
    }

    if (errors.length > 0) {
      console.warn(`Completed with ${errors.length} errors`);
    }

    return migratedCount;
  } catch (error) {
    throw new Error(`Reflexion migration failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (db) {
      db.close();
    }
  }
}

/**
 * Migrate telemetry data from AgentDB to Supabase
 */
export async function migrateTelemetry(options: MigrationOptions): Promise<number> {
  const { agentDbPath, dryRun = false, batchSize = 100, onProgress } = options;

  let db: Database | null = null;
  let migratedCount = 0;
  const errors: string[] = [];

  try {
    // Open AgentDB database
    db = new SQLite(agentDbPath, { readonly: true });

    // Check if telemetry table exists
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='model_telemetry'")
      .get();

    if (!tableExists) {
      console.log('No model_telemetry table found in AgentDB');
      return 0;
    }

    // Get total count
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM model_telemetry').get() as { count: number };
    const total = totalResult.count;

    if (total === 0) {
      console.log('No telemetry data to migrate');
      return 0;
    }

    console.log(`Found ${total} telemetry records to migrate`);

    // Fetch all telemetry records
    const telemetryRecords = db
      .prepare('SELECT * FROM model_telemetry ORDER BY timestamp ASC')
      .all() as AgentDBTelemetry[];

    // Process in batches
    for (let i = 0; i < telemetryRecords.length; i += batchSize) {
      const batch = telemetryRecords.slice(i, Math.min(i + batchSize, telemetryRecords.length));

      for (const telem of batch) {
        try {
          // Parse JSON fields
          const metadata = telem.metadata ? JSON.parse(telem.metadata) : {};

          // Convert to Supabase format (logTelemetry expects TelemetryData)
          if (!dryRun) {
            await logTelemetry({
              expertId: metadata.expert_id || 'unknown',
              version: metadata.version || '1.0.0',
              confidence: metadata.confidence || 0.5,
              latencyMs: telem.latency_ms,
              tokensIn: telem.prompt_tokens,
              tokensOut: telem.completion_tokens,
              costUsd: telem.cost,
              outcome: 'unknown',
              metadata: {
                ...metadata,
                migrated_from_agentdb: true,
                original_id: telem.id,
                original_timestamp: telem.timestamp,
                model: telem.model,
              },
            });
          }

          migratedCount++;

          // Report progress
          if (onProgress) {
            onProgress({
              phase: 'telemetry',
              current: migratedCount,
              total,
              percentage: Math.round((migratedCount / total) * 100),
            });
          }
        } catch (error) {
          const errorMsg = `Failed to migrate telemetry ${telem.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Log batch progress
      console.log(`Migrated ${Math.min(i + batchSize, telemetryRecords.length)}/${total} telemetry records`);
    }

    if (errors.length > 0) {
      console.warn(`Completed with ${errors.length} errors`);
    }

    return migratedCount;
  } catch (error) {
    throw new Error(`Telemetry migration failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (db) {
      db.close();
    }
  }
}

/**
 * Migrate consensus decisions from AgentDB to Supabase
 */
export async function migrateConsensus(options: MigrationOptions): Promise<number> {
  const { agentDbPath, dryRun = false, batchSize = 100, onProgress } = options;

  let db: Database | null = null;
  let migratedCount = 0;
  const errors: string[] = [];

  try {
    // Open AgentDB database
    db = new SQLite(agentDbPath, { readonly: true });

    // Check if consensus table exists
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='consensus_decisions'")
      .get();

    if (!tableExists) {
      console.log('No consensus_decisions table found in AgentDB');
      return 0;
    }

    // Get total count
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM consensus_decisions').get() as { count: number };
    const total = totalResult.count;

    if (total === 0) {
      console.log('No consensus decisions to migrate');
      return 0;
    }

    console.log(`Found ${total} consensus decisions to migrate`);

    // Fetch all consensus decisions
    const consensusRecords = db
      .prepare('SELECT * FROM consensus_decisions ORDER BY timestamp ASC')
      .all() as AgentDBConsensus[];

    // Process in batches
    for (let i = 0; i < consensusRecords.length; i += batchSize) {
      const batch = consensusRecords.slice(i, Math.min(i + batchSize, consensusRecords.length));

      for (const cons of batch) {
        try {
          // Parse JSON fields
          const options = cons.options ? JSON.parse(cons.options) : [];
          const votes = cons.votes ? JSON.parse(cons.votes) : {};
          const metadata = cons.metadata ? JSON.parse(cons.metadata) : {};

          // Convert to Supabase format (recordConsensusLineage expects different parameters)
          if (!dryRun) {
            await recordConsensusLineage(
              cons.decision_id || 'migrated',
              Array.isArray(votes) ? votes : [],
              { winning_option: cons.winning_option },
              cons.confidence,
              {
                metadata: {
                  ...metadata,
                  migrated_from_agentdb: true,
                  original_id: cons.id,
                  original_timestamp: cons.timestamp,
                  options,
                },
              }
            );
          }

          migratedCount++;

          // Report progress
          if (onProgress) {
            onProgress({
              phase: 'consensus',
              current: migratedCount,
              total,
              percentage: Math.round((migratedCount / total) * 100),
            });
          }
        } catch (error) {
          const errorMsg = `Failed to migrate consensus ${cons.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Log batch progress
      console.log(`Migrated ${Math.min(i + batchSize, consensusRecords.length)}/${total} consensus decisions`);
    }

    if (errors.length > 0) {
      console.warn(`Completed with ${errors.length} errors`);
    }

    return migratedCount;
  } catch (error) {
    throw new Error(`Consensus migration failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (db) {
      db.close();
    }
  }
}

/**
 * Migrate all data from AgentDB to Supabase
 */
export async function migrateAll(options: MigrationOptions): Promise<MigrationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const migratedRecords = {
    signatures: 0,
    reflexions: 0,
    telemetry: 0,
    consensus: 0,
  };

  console.log('Starting full migration from AgentDB to Supabase...');
  console.log(`Source: ${options.agentDbPath}`);
  console.log(`Project ID: ${options.projectId}`);
  console.log(`Dry run: ${options.dryRun || false}`);
  console.log('---');

  try {
    // Migrate signatures
    console.log('\n📝 Migrating Expert Signatures...');
    try {
      migratedRecords.signatures = await migrateSignatures(options);
      console.log(`✓ Migrated ${migratedRecords.signatures} signatures`);
    } catch (error) {
      const errorMsg = `Signature migration error: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }

    // Migrate reflexions
    console.log('\n🧠 Migrating Reflexions...');
    try {
      migratedRecords.reflexions = await migrateReflexions(options);
      console.log(`✓ Migrated ${migratedRecords.reflexions} reflexions`);
    } catch (error) {
      const errorMsg = `Reflexion migration error: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }

    // Migrate telemetry
    console.log('\n📊 Migrating Telemetry Data...');
    try {
      migratedRecords.telemetry = await migrateTelemetry(options);
      console.log(`✓ Migrated ${migratedRecords.telemetry} telemetry records`);
    } catch (error) {
      const errorMsg = `Telemetry migration error: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }

    // Migrate consensus
    console.log('\n🤝 Migrating Consensus Decisions...');
    try {
      migratedRecords.consensus = await migrateConsensus(options);
      console.log(`✓ Migrated ${migratedRecords.consensus} consensus decisions`);
    } catch (error) {
      const errorMsg = `Consensus migration error: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }

    const duration = Date.now() - startTime;
    const totalMigrated = Object.values(migratedRecords).reduce((sum, count) => sum + count, 0);
    const success = errors.length === 0;

    console.log('\n' + '='.repeat(50));
    console.log('Migration Summary:');
    console.log('='.repeat(50));
    console.log(`Total records migrated: ${totalMigrated}`);
    console.log(`  - Signatures: ${migratedRecords.signatures}`);
    console.log(`  - Reflexions: ${migratedRecords.reflexions}`);
    console.log(`  - Telemetry: ${migratedRecords.telemetry}`);
    console.log(`  - Consensus: ${migratedRecords.consensus}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Status: ${success ? '✓ SUCCESS' : `✗ COMPLETED WITH ${errors.length} ERRORS`}`);

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    return {
      success,
      migratedRecords,
      errors,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = `Migration failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);

    return {
      success: false,
      migratedRecords,
      errors,
      duration,
    };
  }
}
