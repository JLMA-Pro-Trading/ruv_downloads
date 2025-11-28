/**
 * Project detection from package.json
 * Zero-config with graceful fallbacks
 */
import { readFile } from 'fs/promises';
import path from 'path';
/**
 * Detect project information from package.json
 * Falls back to directory name if package.json not found
 */
export async function detectProject(projectRoot = process.cwd()) {
    let projectId = path.basename(projectRoot);
    let projectName = projectId;
    let projectVersion;
    let projectDescription;
    try {
        const packagePath = path.join(projectRoot, 'package.json');
        const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
        if (packageJson.name) {
            // Clean project ID (remove @scope/ if present)
            projectId = packageJson.name.replace(/^@[^/]+\//, '');
            projectName = packageJson.name;
        }
        projectVersion = packageJson.version;
        projectDescription = packageJson.description;
    }
    catch {
        // Fallback: use directory name
        console.warn('⚠️  No package.json found, using directory name as projectId');
    }
    return {
        projectId,
        projectName,
        projectVersion,
        projectDescription
    };
}
/**
 * Cache for project detection
 */
const projectCache = new Map();
/**
 * Get cached project info or detect if not cached
 */
export async function getCachedProjectInfo(projectRoot = process.cwd()) {
    const cached = projectCache.get(projectRoot);
    if (cached) {
        return cached;
    }
    const info = await detectProject(projectRoot);
    projectCache.set(projectRoot, info);
    return info;
}
/**
 * Clear project cache
 */
export function clearProjectCache() {
    projectCache.clear();
}
//# sourceMappingURL=project-detector.js.map