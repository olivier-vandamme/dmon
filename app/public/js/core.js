/**
 * core.js
 *
 * Description : Shared state, constants and core utilities for Dmon.
 * Project     : Dmon - Docker containers monitor
 * Author      : Olivier Vandamme
 * Copyright   : (c) 2025 Olivier Vandamme
 * License     : MIT (see the LICENSE file at project root)
 *
 * Notes :
 * - Defines constants, global state and the DOM cache.
 */

const MAX_DATA_POINTS = 60;
const COLORS = { cpu: '#007bff', ram: '#ffc107', hostCpu: '#20c997' };

// State
const charts = {};
const historyData = {}; 
let isFirstRender = true;
let echartsReady = typeof echarts !== 'undefined'; 
let eventSource = null;
let hostTotalMemory = 0; 
let sseReconnectDelay = 1000, sseReconnectTimer = null;
let lastRenderedData = null; 

// DOM cache
const $ = id => document.getElementById(id); 
const containerGrid = $('container-data');
const lastUpdateSpan = $('last-update');
const loadingMessage = $('loading-message');

// ECharts loader: set ready flag and trigger init callbacks if available
if (!echartsReady) {
    const echartsScript = $('echarts-script');
    // Handler called when the ECharts script is loaded: mark ECharts as ready and initialize charts if needed
    if (echartsScript) echartsScript.onload = () => {
        echartsReady = true;
        if (typeof initHostCharts === 'function') initHostCharts();
        if (lastRenderedData && typeof renderAllData === 'function') renderAllData(lastRenderedData, true);
    };
} else {
    if (typeof initHostCharts === 'function') initHostCharts();
} 
