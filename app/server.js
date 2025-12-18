/*
 * Dmon - Docker containers monitor
 * Author : Olivier Vandamme
 * Copyright (c) 2025 Olivier Vandamme
 * Licence : MIT
 */
const VERSION = '1.2.0'; // Application Version

const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Modules refactored: host and container functions
const hostModule = require('./host');
const container = require('./container');
const versionModule = require('./version');

const app = express();
const port = 443; // HTTPS Port

// Le client Docker n'est pas initialisé ici :
// la gestion de Docker est déléguée aux modules `app/host.js` et `app/container.js`.

// --- STORAGE ---
// Storage and caches moved to dedicated modules: `app/container.js` and `app/host.js`

// --- CONFIGURATION ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// --- HOST CPU USAGE ---
// Host-related logic moved to `app/host.js`
// use `hostModule.getHostStats()` and `hostModule.getHostCpuUsage()` instead


// --- CONTAINER CPU USAGE ---
// Container-related logic moved to `app/container.js`
// use `container.getDockerStatsCached()` and related helpers instead


// --- VERSION MANAGEMENT ---
// Moved to `app/version.js` — use `versionModule.getLatestVersion()`


// --- ROUTES ---
app.get('/', async (req, res) => {
    const host = await hostModule.getHostStats();
    const latestVersion = await versionModule.getLatestVersion();
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
    const latestVersion = await versionModule.getLatestVersion();
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
                container.getDockerStatsCached(),
                hostModule.getHostStats()
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
        Object.keys(container.cpuStats).forEach(k => delete container.cpuStats[k]);
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
