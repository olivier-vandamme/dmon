/*
 * Dmon - Docker containers monitor
 * Author : Olivier Vandamme
 * Copyright (c) 2025 Olivier Vandamme
 * Licence : MIT
 */
const VERSION = '1.0.0'; // Application Version

const express = require('express');
const Docker = require('dockerode');
const os = require('os');
const path = require('path');
const fs = require('fs');
const https = require('https');
const si = require('systeminformation');

const app = express();
const port = 443; // HTTPS Port

// Initialize Docker client with socket path (defaults to /var/run/docker.sock)
const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock' });

// --- STORAGE ---
const cpuStats = {}; // Stats per container

// Global Cache
let lastStats = null;
let lastStatsTime = 0;
let cachedHostname = null;

// --- CONFIGURATION ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// --- HOST CPU USAGE ---
/**
 * Retrieves the current host CPU usage percentage using systeminformation.
 * @returns {Promise<number>} Current CPU usage as a percentage.
 */
async function getHostCpuUsage() {
    try {
        const cpuData = await si.currentLoad();
        return cpuData.currentLoad; // Retourne l'utilisation CPU actuelle en %
    } catch (error) {
        console.error('Error fetching CPU usage:', error.message);
        return 0; // Valeur par défaut en cas d'erreur
    }
}

/**
 * Retrieves statistics for the host machine (RAM, CPU, Load Average).
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

// --- CONTAINER CPU USAGE ---
/**
 * Calculates the CPU usage percentage for a specific container.
 * Based on Docker stats API calculation logic.
 */
function calculateCpuPercent(stats, prev) {
    if (!prev || !stats.cpu_stats) return 0;

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (prev.cpu_stats.cpu_usage.total_usage || 0);
    const sysDelta = stats.cpu_stats.system_cpu_usage - (prev.cpu_stats.system_cpu_usage || 0);

    // Normalize CPU usage to a 0-100% scale (percentage of total host capacity)
    // Docker's CLI multiplies by the number of CPUs, resulting in values >100 when
    // all CPUs are used (e.g., 8 CPUs => 800%). We want 100% to mean full host usage.
    let percent = sysDelta > 0 && cpuDelta > 0 ? (cpuDelta / sysDelta) * 100 : 0;

    // Clamp to [0, 100]
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    return percent;
}

/**
 * Fetches stats for a single container by ID.
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
 * Retrieves a list of all containers and their current stats.
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

// --- CACHE MECHANISM ---
/**
 * Cached version of getDockerStats to prevent overloading the Docker daemon.
 * Cache duration is set to 2000ms.
 */
async function getDockerStatsCached() {
    const now = Date.now();
    if (lastStats && now - lastStatsTime < 2000) return lastStats;
    lastStats = await getDockerStats();
    lastStatsTime = now;
    return lastStats;
}

// --- VERSION MANAGEMENT ---
/**
 * Fetches the latest version from remote package.json
 */
async function getLatestVersion() {
    return new Promise((resolve) => {
        const agent = new https.Agent({ rejectUnauthorized: false });
        const options = {
            hostname: 'dmon.fr',
            path: '/package.json',
            method: 'GET',
            agent: agent
        };

        https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log("Latest version fetched:", json.version);
                    resolve(json.version || null);
                } catch (e) {
                    console.error("Error parsing JSON:", e.message);
                    resolve(null);
                }
            });
        }).on('error', (error) => {
            console.error("Error fetching latest version:", error.message);
            resolve(null);
        }).end();
    });
}

// --- ROUTES ---
app.get('/', async (req, res) => {
    const host = await getHostStats();
    const latestVersion = await getLatestVersion();
    const needUpdate = VERSION != latestVersion;
    
    console.log("Rendering index with latestVersion:", latestVersion);
    
    res.render('index', { 
        title: `Dmon | ${host.hostname}`, 
        version: VERSION,
        latestVersion: latestVersion,
        needUpdate: needUpdate
    });
});

app.get('/check-update', async (req, res) => {
    const latestVersion = await getLatestVersion();
    const needUpdate = VERSION != latestVersion;
    res.json({ needUpdate, latestVersion });
});

// Server-Sent Events (SSE) stream for real-time updates
app.get('/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    res.write("retry: 10000\n");

    const sendData = async () => {
        try {
            const [containers, host] = await Promise.all([
                getDockerStatsCached(),
                getHostStats()
            ]);

            res.write(`data: ${JSON.stringify({ containers, host })}\n\n`);
        } catch (e) {
            res.write(`data: {"error":"server error"}\n\n`);
        }
    };

    // Send data immediately upon connection
    sendData();

    const interval = setInterval(sendData, 1000);

    req.on('close', () => {
        clearInterval(interval);
        Object.keys(cpuStats).forEach(k => delete cpuStats[k]);
        res.end();
    });
});

// --- STARTS HTTPS SERVER ---
const options = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
};

// Only start the server when running this file directly (avoid starting during tests)
if (require.main === module) {
    https.createServer(options, app).listen(port, '0.0.0.0', () => {
        console.log(`HTTPS Server started on https://0.0.0.0:${port}`);
    });
}

// Export functions for testing
module.exports = {
    calculateCpuPercent
};
