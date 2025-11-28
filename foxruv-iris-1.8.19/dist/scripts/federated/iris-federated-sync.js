/**
 * Iris Federated Sync
 *
 * Syncs local learning (AgentDB + Checkpoints) to the Federated Cloud (Supabase).
 * Enables cross-project learning.
 *
 * @module scripts/federated/iris-federated-sync
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import chalk from 'chalk';
// Load env
dotenv.config();
export default async function sync(options) {
    console.log(chalk.blue('\n🌐 Iris Federated Sync\n'));
    const supabaseUrl = process.env.FOXRUV_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.FOXRUV_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.error(chalk.red('❌ Supabase credentials not found in .env'));
        console.log('Required: FOXRUV_SUPABASE_URL, FOXRUV_SUPABASE_SERVICE_ROLE_KEY');
        return;
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const project = options.project || process.env.PROJECT_ID || 'unknown-project';
    console.log(`Syncing project: ${chalk.cyan(project)}...`);
    // 1. Sync Ax Checkpoints
    await syncCheckpoints(supabase, project);
    // 2. Sync AgentDB (Placeholder for now - usually requires SQLite dump or export)
    // In v1.5, we'd read AgentDB 'expert_metrics' table and upsert to Supabase 'telemetry_events'
    console.log(chalk.green('\n✅ Federated Sync Complete!'));
}
async function syncCheckpoints(supabase, project) {
    const checkpointDir = path.resolve(process.cwd(), '.iris/cache/ax_checkpoints');
    try {
        await fs.access(checkpointDir);
    }
    catch {
        console.log('  - No Ax checkpoints found to sync.');
        return;
    }
    const files = await fs.readdir(checkpointDir);
    console.log(`  - Found ${files.length} checkpoints.`);
    for (const file of files) {
        if (!file.endsWith('.json'))
            continue;
        const content = await fs.readFile(path.join(checkpointDir, file), 'utf-8');
        const json = JSON.parse(content);
        const experimentId = file.replace('.json', '').replace('ax_', '');
        // Upsert to Supabase
        const { error } = await supabase
            .from('federated_checkpoints')
            .upsert({
            project_id: project,
            experiment_id: experimentId,
            data: json,
            updated_at: new Date().toISOString()
        }, { onConflict: 'experiment_id' });
        if (error) {
            console.warn(`  ⚠️ Failed to sync ${file}: ${error.message}`);
        }
        else {
            console.log(`  ✓ Synced ${file}`);
        }
    }
}
