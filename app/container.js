const os = require('os');
const Docker = require('dockerode');

// Initialize Docker client with socket path (defaults to /var/run/docker.sock)
const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock' });

// --- CACHE ---
/** Cache des dernières statistiques par conteneur (clé = container ID).
 * Utilisé pour calculer les différences entre deux mesures afin d'estimer l'utilisation CPU.
 */
const cpuStats = {}; // Stats per container

/**
 * Calcule le pourcentage d'utilisation CPU d'un conteneur.
 * Basé sur la logique recommandée par l'API Docker :
 *  - cpuDelta = current.total_usage - previous.total_usage
 *  - sysDelta = current.system_cpu_usage - previous.system_cpu_usage
 *  - percent = (cpuDelta / sysDelta) * 100 (si sysDelta > 0)
 *
 * @param {Object} stats - Statistiques actuelles retournées par Docker (container.stats).
 * @param {Object|undefined} prev - Statistiques précédentes stockées pour ce conteneur.
 * @returns {number} Pourcentage CPU (0-100), borné entre 0 et 100.
 */
function calculateCpuPercent(stats, prev) {
    if (!prev || !stats.cpu_stats) return 0;

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (prev.cpu_stats.cpu_usage.total_usage || 0);
    const sysDelta = stats.cpu_stats.system_cpu_usage - (prev.cpu_stats.system_cpu_usage || 0);

    let percent = sysDelta > 0 && cpuDelta > 0 ? (cpuDelta / sysDelta) * 100 : 0;

    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    return percent;
}

/**
 * Récupère les statistiques d'un conteneur via l'API Docker.
 * Met à jour le cache `cpuStats` pour le calcul des deltas CPU.
 *
 * @param {string} id - ID du conteneur Docker.
 * @returns {Promise<{cpu:number, ramUsage:number, ramLimit:number}>} Statistiques CPU (%) et mémoire (MiB).
 */
async function getContainerStats(id) {
    try {
        const container = docker.getContainer(id);
        const currentStats = await container.stats({ stream: false });

        const prev = cpuStats[id];
        const cpuPercent = calculateCpuPercent(currentStats, prev);
        cpuStats[id] = currentStats;

        const memUsage = currentStats.memory_stats?.usage || 0;
        const memLimit = currentStats.memory_stats?.limit || os.totalmem();

        return {
            cpu: cpuPercent,
            ramUsage: Math.round(memUsage / 1024 / 1024), // Convert to MiB
            ramLimit: Math.round(memLimit / 1024 / 1024)  // Convert to MiB
        };
    } catch (e) {
        console.error("Stats error:", e.message);
        delete cpuStats[id];
        return { cpu: 0, ramUsage: 0, ramLimit: 0 };
    }
}

/**
 * Liste tous les conteneurs (y compris arrêtés) et renvoie leurs statistiques.
 * Pour les conteneurs en cours d'exécution, appelle `getContainerStats`; sinon réinitialise le cache.
 *
 * @returns {Promise<Array<{id:string,name:string,image:string,status:string,cpu:number,ramUsage:number,ramLimit:number}>>}
 */
async function getDockerStats() {
    try {
        const containers = await docker.listContainers({ all: true });

        return Promise.all(containers.map(async c => {
            let stats = { cpu: 0, ramUsage: 0, ramLimit: 0 };

            if (c.State === "running" || c.Status.toLowerCase().includes("up")) {
                stats = await getContainerStats(c.Id);
            } else {
                delete cpuStats[c.Id];
            }

            return {
                id: c.Id,
                name: c.Names[0].replace('/', ''),
                image: c.Image,
                status: c.Status,
                cpu: stats.cpu,
                ramUsage: stats.ramUsage,
                ramLimit: stats.ramLimit
            };
        }));
    } catch (e) {
        console.error("Error in listContainers:", e.message);
        return [];
    }
}

let lastStats = null;
let lastStatsTime = 0;

/**
 * Version mise en cache de `getDockerStats` pour limiter la charge sur le démon Docker.
 * TTL du cache : 2000 ms.
 *
 * @returns {Promise<Array>} Données des conteneurs (peut être servies depuis le cache).
 */
async function getDockerStatsCached() {
    const now = Date.now();
    if (lastStats && now - lastStatsTime < 2000) return lastStats;
    lastStats = await getDockerStats();
    lastStatsTime = now;
    return lastStats;
}

module.exports = {
    cpuStats,
    calculateCpuPercent,
    getContainerStats,
    getDockerStats,
    getDockerStatsCached
};