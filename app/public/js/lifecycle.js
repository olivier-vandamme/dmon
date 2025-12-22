/**
 * lifecycle.js
 *
 * Description : Lifecycle management for the application (SSE, visibility, update checks, cache).
 * Project     : Dmon - Docker containers monitor
 * Author      : Olivier Vandamme
 * Copyright   : (c) 2025 Olivier Vandamme
 * License     : MIT (see the LICENSE file at project root)
 *
 * Notes :
 * - Manages the SSE connection, restoring from cache, suspend-on-hidden behavior and update checks.
 */

// SSE with reconnection
/**
 * Establishes the SSE (/stream) connection and handles reconnection with exponential backoff.
 */
const connectSSE = () => {
    eventSource?.close();
    eventSource = new EventSource('/stream');

    eventSource.onmessage = ({ data }) => {
        const parsed = JSON.parse(data);
        renderAllData(parsed);
        try { localStorage.setItem('dmon:lastSSE', data); } catch {}
        sseReconnectDelay = 1000;
        if (sseReconnectTimer) { clearTimeout(sseReconnectTimer); sseReconnectTimer = null; }
    };

    eventSource.onerror = () => {
        lastUpdateSpan.textContent = 'Connection error. Retrying...';
        if (loadingMessage) {
            loadingMessage.textContent = 'Error: Data stream failed.';
            loadingMessage.style.display = 'block';
        }
        if (!sseReconnectTimer) {
            sseReconnectTimer = setTimeout(() => {
                connectSSE();
                sseReconnectTimer = null;
                sseReconnectDelay = Math.min(30000, sseReconnectDelay * 2); // Exponential backoff: double delay on each failure, but cap at 30000ms (30s)
            }, sseReconnectDelay);
        }
    };
};

/**
 * Restores state from local cache (localStorage) if available.
 * @param {boolean} [showMsg=true] - shows a restore message if true
 * @returns {boolean} true if a restore occurred
 */
const restoreFromCache = (showMsg = true) => {
    try {
        const cached = localStorage.getItem('dmon:lastSSE');
        if (cached) { isFirstRender = true; renderAllData(JSON.parse(cached), showMsg); return true; }
    } catch {}
    return false;
};

// Init
restoreFromCache(true);
connectSSE();
if (echartsReady) initHostCharts();

// Track last visible timestamp for conditional reload
//window._dmonLastVisible = Date.now();

// Event handlers
window.addEventListener('pageshow', e => { if (e.persisted) { /* Do not restore cached view on pageshow */ connectSSE(); } });

// Visibility / suspend handling
let _visiblePromiseResolve;
let _hiddenTimeout;
let _wasHidden = false;

/**
 * Handler called when the page becomes hidden: prepares suspension and closes the SSE connection.
 */
function _onHidden() {
    if (_visiblePromiseResolve) return; // already waiting

    _wasHidden = true;

    // Create a resolver that will be called on visible
    let resolver;
    const p = new Promise(r => { resolver = r; });
    p.resolve = resolver;
    _visiblePromiseResolve = p;

    // Close SSE to avoid background use; reconnection will wait until visible
    try { eventSource?.close(); } catch (e) {}

    // ensure we wake on focus
    window.addEventListener('focus', _onVisible, { once: true });
}

/**
 * Handler called when the page becomes visible again: restores the SSE connection and clears temporary state.
 */
function _onVisible() {
    if (_hiddenTimeout) { clearTimeout(_hiddenTimeout); _hiddenTimeout = undefined; }

    const wasHidden = _wasHidden;
    _wasHidden = false;

    if (_visiblePromiseResolve) {
        try { _visiblePromiseResolve.resolve?.(); } catch (e) {}
        _visiblePromiseResolve = undefined;
    }

    // otherwise ensure SSE reconnects
    if (!eventSource || eventSource.readyState === EventSource.CLOSED) connectSSE();
    if (loadingMessage) loadingMessage.style.display = 'none';
    lastUpdateSpan.textContent = '';
}

/**
 * Checks current visibility and calls the appropriate handlers.
 */
function _checkVisibility() { document.hidden ? _onHidden() : _onVisible(); }

// Handle visibility changes and keep the previous reload-after-long-hidden logic
document.addEventListener('visibilitychange', () => {
    _checkVisibility();
});


/**
 * Periodically checks whether a new version is available server-side and displays the update link.
 */
const checkUpdate = async () => {
    try {
        const { needUpdate, latestVersion } = await fetch('/check-update').then(r => r.json());
        $('update-link').style.display = needUpdate ? 'inline-block' : 'none';
        if (needUpdate) $('update-button').textContent = `Update available to v${latestVersion}`;
        $('latest-version').textContent = `Latest: v${latestVersion}`;
    } catch {}
};

setTimeout(checkUpdate, 2000); // 1st update check 2s after loading
setInterval(checkUpdate, 21600000); // update ckeck all 6 hours

// Service Worker
navigator.serviceWorker?.register('/sw.js').catch(() => {});
