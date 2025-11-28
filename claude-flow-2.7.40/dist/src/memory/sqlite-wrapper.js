import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let Database = null;
let sqliteAvailable = false;
let loadError = null;
async function tryLoadSQLite() {
    try {
        const require = createRequire(import.meta.url);
        Database = require('better-sqlite3');
        sqliteAvailable = true;
        return true;
    } catch (requireErr) {
        try {
            const module = await import('better-sqlite3');
            Database = module.default;
            sqliteAvailable = true;
            return true;
        } catch (importErr) {
            loadError = importErr;
            if (requireErr.message.includes('was compiled against a different Node.js version') || requireErr.message.includes('Could not locate the bindings file') || requireErr.message.includes('The specified module could not be found') || requireErr.code === 'MODULE_NOT_FOUND') {
                console.warn(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                     Windows SQLite Installation Issue                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  The native SQLite module failed to load. This is common on Windows when    ║
║  using 'npx' or when node-gyp build tools are not available.               ║
║                                                                              ║
║  Claude Flow will continue with in-memory storage (non-persistent).         ║
║                                                                              ║
║  To enable persistent storage on Windows:                                    ║
║                                                                              ║
║  Option 1 - Install Windows Build Tools:                                    ║
║  > npm install --global windows-build-tools                                 ║
║  > npm install claude-flow@alpha                                           ║
║                                                                              ║
║  Option 2 - Use Pre-built Binaries:                                        ║
║  > npm config set python python3                                           ║
║  > npm install claude-flow@alpha --build-from-source=false                 ║
║                                                                              ║
║  Option 3 - Use WSL (Windows Subsystem for Linux):                         ║
║  Install WSL and run Claude Flow inside a Linux environment                 ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
            }
            return false;
        }
    }
}
export async function isSQLiteAvailable() {
    if (sqliteAvailable !== null) {
        return sqliteAvailable;
    }
    await tryLoadSQLite();
    return sqliteAvailable;
}
export async function getSQLiteDatabase() {
    if (!sqliteAvailable && loadError === null) {
        await tryLoadSQLite();
    }
    return Database;
}
export function getLoadError() {
    return loadError;
}
export async function createDatabase(dbPath) {
    const DB = await getSQLiteDatabase();
    if (!DB) {
        throw new Error('SQLite is not available. Use fallback storage instead.');
    }
    try {
        return new DB(dbPath);
    } catch (err) {
        if (err.message.includes('EPERM') || err.message.includes('access denied')) {
            throw new Error(`Cannot create database at ${dbPath}. Permission denied. Try using a different directory or running with administrator privileges.`);
        }
        throw err;
    }
}
export function isWindows() {
    return process.platform === 'win32';
}
export function getStorageRecommendations() {
    if (isWindows()) {
        return {
            recommended: 'in-memory',
            reason: 'Windows native module compatibility',
            alternatives: [
                'Install Windows build tools for SQLite support',
                'Use WSL (Windows Subsystem for Linux)',
                'Use Docker container with Linux'
            ]
        };
    }
    return {
        recommended: 'sqlite',
        reason: 'Best performance and persistence',
        alternatives: [
            'in-memory for testing'
        ]
    };
}
tryLoadSQLite().catch(()=>{});
export default {
    isSQLiteAvailable,
    getSQLiteDatabase,
    getLoadError,
    createDatabase,
    isWindows,
    getStorageRecommendations
};

//# sourceMappingURL=sqlite-wrapper.js.map