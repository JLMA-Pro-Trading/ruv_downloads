/**
 * Basic usage examples for Ultrathink Skills system
 */
import { importMcpsFromSettings, syncSkillIndex, initializeSkillInfrastructure, generateSkillFromMcp, discoverSkills, getSkillMetadata } from '../index.js';
import { writeFile } from 'fs/promises';
import path from 'path';
// Example 1: Initialize skill infrastructure in a new project
export async function example1_InitializeProject() {
    console.log('Example 1: Initialize skill infrastructure\n');
    try {
        await initializeSkillInfrastructure(process.cwd());
        console.log('✅ Skill infrastructure initialized');
        console.log('   - Created mcp-skills/ directory');
        console.log('   - Created _template.md');
        console.log('   - Created mcp-manager.md');
        console.log('   - Created INDEX.md');
        console.log('   - Created/updated CLAUDE.md\n');
    }
    catch (error) {
        console.error('❌ Failed to initialize:', error);
    }
}
// Example 2: Import MCPs from Claude settings
export async function example2_ImportMcps() {
    console.log('Example 2: Import MCPs from Claude settings\n');
    try {
        // Dry run first to see what would be imported
        const dryRunSkills = await importMcpsFromSettings({
            projectRoot: process.cwd(),
            dryRun: true
        });
        console.log(`Would import ${dryRunSkills.length} skills (dry run):`);
        dryRunSkills.forEach(id => console.log(`  - ${id}`));
        // Actual import with backup
        const skills = await importMcpsFromSettings({
            projectRoot: process.cwd(),
            backup: true,
            disableGlobal: false // Keep global MCPs enabled
        });
        console.log(`\n✅ Imported ${skills.length} skills:`);
        skills.forEach(id => console.log(`  - ${id}`));
    }
    catch (error) {
        console.error('❌ Failed to import:', error);
    }
}
// Example 3: Create a custom skill programmatically
export async function example3_CreateCustomSkill() {
    console.log('Example 3: Create custom skill\n');
    try {
        // Generate skill content
        const skillContent = generateSkillFromMcp({
            skillId: 'custom-api',
            serverId: 'custom-api-server',
            command: 'node',
            args: ['./custom-api-server.js'],
            env: {
                API_KEY: 'Required for API access',
                BASE_URL: 'https://api.example.com'
            },
            category: 'custom',
            tags: ['api', 'internal', 'custom']
        });
        // Write skill file
        const skillPath = path.join(process.cwd(), 'mcp-skills', 'custom-api.md');
        await writeFile(skillPath, skillContent);
        console.log('✅ Created custom-api.md');
        // Sync index
        await syncSkillIndex({ projectRoot: process.cwd() });
        console.log('✅ Updated INDEX.md\n');
    }
    catch (error) {
        console.error('❌ Failed to create skill:', error);
    }
}
// Example 4: Discover and list all skills
export async function example4_DiscoverSkills() {
    console.log('Example 4: Discover all skills\n');
    try {
        const skillsDir = path.join(process.cwd(), 'mcp-skills');
        const skills = await discoverSkills(skillsDir);
        console.log(`Found ${skills.length} skills:`);
        for (const skillId of skills) {
            const skillPath = path.join(skillsDir, `${skillId}.md`);
            const metadata = await getSkillMetadata(skillPath);
            if (metadata) {
                console.log(`\n  📄 ${skillId}`);
                console.log(`     Category: ${metadata.category || 'uncategorized'}`);
                console.log(`     Server: ${metadata.mcp_server || 'N/A'}`);
                console.log(`     Tracking: ${metadata.agent_db_tracking ? 'enabled' : 'disabled'}`);
            }
        }
    }
    catch (error) {
        console.error('❌ Failed to discover skills:', error);
    }
}
// Example 5: Sync skills after manual changes
export async function example5_SyncAfterChanges() {
    console.log('Example 5: Sync skills after manual changes\n');
    try {
        await syncSkillIndex({
            projectRoot: process.cwd(),
            verbose: true
        });
        console.log('✅ Skills index synchronized\n');
    }
    catch (error) {
        console.error('❌ Failed to sync:', error);
    }
}
// Example 6: Batch import multiple custom MCPs
export async function example6_BatchImport() {
    console.log('Example 6: Batch import custom MCPs\n');
    const mcpConfigs = [
        {
            id: 'internal-api-1',
            command: 'node',
            args: ['./api1.js'],
            category: 'internal'
        },
        {
            id: 'internal-api-2',
            command: 'node',
            args: ['./api2.js'],
            category: 'internal'
        },
        {
            id: 'external-service',
            command: 'npx',
            args: ['-y', 'external-service-package'],
            env: { SERVICE_KEY: 'Required' },
            category: 'external'
        }
    ];
    try {
        for (const config of mcpConfigs) {
            const skillContent = generateSkillFromMcp({
                skillId: config.id,
                serverId: config.id,
                command: config.command,
                args: config.args,
                env: config.env,
                category: config.category,
                tags: ['batch-imported', config.category]
            });
            const skillPath = path.join(process.cwd(), 'mcp-skills', `${config.id}.md`);
            await writeFile(skillPath, skillContent);
            console.log(`✅ Created ${config.id}.md`);
        }
        // Sync index
        await syncSkillIndex({ projectRoot: process.cwd() });
        console.log('✅ Updated INDEX.md\n');
    }
    catch (error) {
        console.error('❌ Failed batch import:', error);
    }
}
// Run all examples
async function runAllExamples() {
    console.log('='.repeat(60));
    console.log('Ultrathink Skills - Usage Examples');
    console.log('='.repeat(60) + '\n');
    await example1_InitializeProject();
    await example2_ImportMcps();
    await example3_CreateCustomSkill();
    await example4_DiscoverSkills();
    await example5_SyncAfterChanges();
    await example6_BatchImport();
    console.log('='.repeat(60));
    console.log('All examples completed!');
    console.log('='.repeat(60));
}
// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllExamples().catch(console.error);
}
//# sourceMappingURL=basic-usage.js.map