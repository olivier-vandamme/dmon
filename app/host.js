const os = require('os');
const Docker = require('dockerode');
const si = require('systeminformation');

// Initialize Docker client with socket path (defaults to /var/run/docker.sock)
const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock' });

/** Nom d'hôte mis en cache (essaye d'utiliser le nom Docker si disponible). */
let cachedHostname = null;

/**
 * Récupère l'utilisation CPU actuelle de la machine hôte via `systeminformation`.
 *
 * @returns {Promise<number>} Usage CPU courant en pourcentage (0 en cas d'erreur).
 */
async function getHostCpuUsage() {
    try {
        const cpuData = await si.currentLoad();
        return cpuData.currentLoad;
    } catch (error) {
        console.error('Error fetching CPU usage:', error.message);
        return 0;
    }
}

/**
 * Récupère les statistiques principales de la machine hôte :
 * - `hostname` (préférer le nom Docker si disponible)
 * - `totalMemory` en MiB
 * - `memoryUsagePercent` (%)
 * - `cpuCores` (nombre de cœurs)
 * - `cpuUsage` (%)
 * - `loadAverage` (tableau)
 *
 * @returns {Promise<Object>} Objet contenant les informations ci-dessus.
 */
async function getHostStats() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = (usedMem / totalMem) * 100;

    if (!cachedHostname) {
        try {
            const info = await docker.info();
            cachedHostname = info && info.Name ? info.Name : os.hostname();
        } catch (e) {
            cachedHostname = os.hostname();
        }
    }

    return {
        hostname: cachedHostname,
        totalMemory: Math.floor(totalMem / 1024 / 1024), // Convert to MiB
        memoryUsagePercent: memUsage,
        cpuCores: os.cpus().length,
        cpuUsage: await getHostCpuUsage(),
        loadAverage: os.loadavg()
    };
}

module.exports = {
    getHostCpuUsage,
    getHostStats
};