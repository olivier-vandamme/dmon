/**
 * server.js
 *
 * Description : Main Express server for Dmon; routes, Docker stats retrieval and SSE.
 * Project     : Dmon - Docker containers monitor
 * Author      : Olivier Vandamme
 * Copyright   : (c) 2025 Olivier Vandamme
 * License     : MIT (see the LICENSE file at project root)
 *
 * Notes :
 * - Exposes '/' (render index), '/stream' (SSE), '/check-update'.
 * - Uses dockerode, systeminformation and EJS.
 */

const VERSION = '1.3.0'; // Application Version

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
const CACHE_TTL = 2000; // 2s cache for Docker stats

// --- CONFIGURATION ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// --- HOST CPU USAGE ---
/**
 * Retrieves the current host CPU usage percentage using systeminformation.
 * @returns {Promise<number>} Current CPU usage as a percentage.
 */
const getHostCpuUsage = async () => {
    try {
        return (await si.currentLoad()).currentLoad;
    } catch {
        return 0;
    }
};

/**
 * Retrieves statistics for the host machine (RAM, CPU, Load Average).
 */
const getHostStats = async () => {
    const totalMem = os.totalmem();
    const memUsage = ((totalMem - os.freemem()) / totalMem) * 100;

    return {
        totalMemory: (totalMem / 1048576) | 0, // Convert to MiB using bitwise OR for floor
        memoryUsagePercent: memUsage,
        cpuCores: os.cpus().length,
        cpuUsage: await getHostCpuUsage(),
        loadAverage: os.loadavg()
    }; 
};

// --- CONTAINER CPU USAGE ---
/**
 * Calculates the CPU usage percentage for a specific container (0-100% scale).
 */
const calculateCpuPercent = (stats, prev) => {
    if (!prev?.cpu_stats || !stats?.cpu_stats) return 0;
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (prev.cpu_stats.cpu_usage.total_usage || 0);
    const sysDelta = stats.cpu_stats.system_cpu_usage - (prev.cpu_stats.system_cpu_usage || 0);
    return sysDelta > 0 && cpuDelta > 0 ? Math.min(100, Math.max(0, (cpuDelta / sysDelta) * 100)) : 0;
};

/**
 * Fetches stats for a single container by ID.
 */
const getContainerStats = async (id) => {
    try {
        const stats = await docker.getContainer(id).stats({ stream: false });
        const cpu = calculateCpuPercent(stats, cpuStats[id]);
        cpuStats[id] = stats;
        const { usage = 0, limit = os.totalmem() } = stats.memory_stats || {};
        return { cpu, ramUsage: (usage / 1048576) | 0, ramLimit: (limit / 1048576) | 0 };
    } catch {
        delete cpuStats[id];
        return { cpu: 0, ramUsage: 0, ramLimit: 0 };
    }
};

/**
 * Retrieves a list of all containers and their current stats.
 */
const getDockerStats = async () => {
    try {
        const containers = await docker.listContainers({ all: true });
        return Promise.all(containers.map(async ({ Id, Names, Image, Status, State }) => {
            const isRunning = State === 'running' || Status.toLowerCase().includes('up');
            const stats = isRunning ? await getContainerStats(Id) : (delete cpuStats[Id], { cpu: 0, ramUsage: 0, ramLimit: 0 });
            return { id: Id, name: Names[0].slice(1), image: Image, status: Status, ...stats };
        }));
    } catch {
        return [];
    }
};

// --- CACHE MECHANISM ---
/**
 * Cached version of getDockerStats to prevent overloading the Docker daemon.
 */
const getDockerStatsCached = async () => {
    const now = Date.now();
    if (!lastStats || now - lastStatsTime >= CACHE_TTL) {
        lastStats = await getDockerStats();
        lastStatsTime = now;
    }
    return lastStats;
};

// --- VERSION MANAGEMENT ---
// No caching for latest version: always fetch remote package.json
/**
 * Fetches the latest version from remote package.json (no caching)
 */
const getLatestVersion = () => {
    return new Promise((resolve) => {
        const fallback = () => resolve(VERSION);
        const req = https.request({
            hostname: 'dmon.fr',
            path: '/package.json',
            method: 'GET',
            agent: new https.Agent({ rejectUnauthorized: false }),
            timeout: 3000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const remoteVersion = JSON.parse(data).version;
                    resolve(remoteVersion || VERSION);
                } catch { fallback(); }
            });
        });
        req.on('error', fallback).on('timeout', () => { req.destroy(); fallback(); });
        req.end();
    });
};

// --- ROUTES ---
app.get('/', async (req, res) => {
    // Parallel fetch for faster initial load
    const [host, latestVersion] = await Promise.all([
        getHostStats(),
        getLatestVersion()
    ]);
    const needUpdate = VERSION != latestVersion;
    
    res.render('index', { 
        title: `Dmon`,
        version: VERSION,
        latestVersion: latestVersion,
        needUpdate: needUpdate,
        host: host // Pass host data for instant display
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

    // SSE client reconnection retry in ms (client will wait this long before retrying on error)
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

    // Send data over SSE every 2000ms (2s).
    // Note: Docker stats are cached with a 2000ms TTL, so container stats may only be refreshed every ~2s.
    const interval = setInterval(sendData, 2000);

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
