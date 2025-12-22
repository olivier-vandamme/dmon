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

/**
 * Maximum number of points kept in history for each chart.
 * @type {number}
 */
const MAX_DATA_POINTS = 60;
/**
 * Color palette used for charts.
 * @type {{cpu:string, ram:string, hostCpu:string}}
 */
const COLORS = { cpu: '#007bff', ram: '#ffc107', hostCpu: '#20c997' };
/**
 * Duration (ms) after which we force a full reload if the page was hidden.
 * @type {number}
 */
const RELOAD_THRESHOLD = 5 * 60 * 1000; // 5 minutes
/**
 * Duration (ms) before suspending the app when the page is hidden.
 * @type {number}
 */
const HIDDEN_SUSPEND_MS = 3e5; // 5 minutes

// State
/**
 * Active ECharts instances by id
 * @type {Object<string, Object>}
 */
const charts = {};
/**
 * Series history by id (cpu/ram)
 * @type {Object<string, {cpu:number[], ram:number[]}>}
 */
const historyData = {}; 
/**
 * Indicates whether this is the first render (used to build initial DOM)
 * @type {boolean}
 */
let isFirstRender = true;
/**
 * Flag indicating whether the ECharts library is loaded
 * @type {boolean}
 */
let echartsReady = typeof echarts !== 'undefined'; 
/**
 * SSE event source
 * @type {EventSource|null}
 */
let eventSource = null;
/**
 * Host total memory (MiB)
 * @type {number}
 */
let hostTotalMemory = 0; 
/**
 * Delay and timer for SSE reconnection (backoff)
 * @type {number|null}
 */
let sseReconnectDelay = 1000, sseReconnectTimer = null;
/**
 * Last rendered data (for restoration from cache)
 * @type {Object|null}
 */
let lastRenderedData = null; 

// DOM cache
/**
 * Retrieves a DOM element by its id.
 * @param {string} id - element id
 * @returns {Element|null} DOM element or null
 */
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
