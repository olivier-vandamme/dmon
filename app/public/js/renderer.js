/**
 * renderer.js
 *
 * Description : Renders data and updates the UI for Dmon.
 * Project     : Dmon - Docker containers monitor
 * Author      : Olivier Vandamme
 * Copyright   : (c) 2025 Olivier Vandamme
 * License     : MIT (see the LICENSE file at project root)
 *
 * Notes :
 * - Contains rendering logic for containers and the host, and DOM management for the cards.
 */

// Render function
const renderAllData = (data, isFromCache = false) => {
    lastRenderedData = data;
    const { containers = [], host = {} } = data;

    if (loadingMessage) {
        loadingMessage.style.display = isFromCache ? 'block' : 'none';
        if (isFromCache) {
            loadingMessage.textContent = 'Restored from cache — updating...';
            setTimeout(() => loadingMessage.style.display = 'none', 1000);
        }
    }

    if (data.error) {
        containerGrid.innerHTML = `<div style="color:var(--error-color);padding:20px">${data.error}</div>`;
        return cleanUpCharts(new Set());
    }

    hostTotalMemory = host.totalMemory || hostTotalMemory;

    // Update host stats
    $('host-ram-total').textContent = host.totalMemory || 'N/A';
    $('host-cpu-cores').textContent = host.cpuCores || 'N/A';
    $('host-cpu-value').textContent = host.cpuUsage >= 0 ? host.cpuUsage.toFixed(1) : 'N/A';
    $('host-ram-val').textContent = host.memoryUsagePercent >= 0 ? host.memoryUsagePercent.toFixed(1) : 'N/A';

    if (host.loadAverage?.length === 3) {
        $('host-load-1').textContent = host.loadAverage[0].toFixed(2);
        $('host-load-5').textContent = host.loadAverage[1].toFixed(2);
        $('host-load-15').textContent = host.loadAverage[2].toFixed(2);
    }

    if (host.cpuUsage >= 0) updateChart('host-cpu-chart', COLORS.hostCpu, host.cpuUsage);
    if (host.memoryUsagePercent >= 0) updateChart('host-ram-chart', COLORS.ram, host.memoryUsagePercent);

    lastUpdateSpan.textContent = '';

    // Container cards
    const activeIds = new Set(containers.map(c => c.id));
    let newHtml = '';

    containers.forEach(c => {
        const isRunning = c.status.includes('Up') || c.status.includes('running');
        const ramPct = c.ramLimit > 0 ? (c.ramUsage / c.ramLimit) * 100 : 0;
        const ramDisplay = Math.abs(c.ramLimit - hostTotalMemory) < 10 ? 'Unlimited (Host)' : `${c.ramLimit} MiB`;
        const card = $(`card-${c.id}`);

        if (isFirstRender || !card) {
            newHtml += `<div class="container-card" id="card-${c.id}">
                <div class="card-header">
                    <span class="card-title">${c.name}</span>
                    <span class="status-badge ${isRunning ? 'status-running' : 'status-error'}">${isRunning ? 'Running' : 'Stopped / Error'}</span>
                </div>
                <div class="stats-grid">
                    <div class="stat-block">
                        <p class="stat-label">CPU Usage (Current)</p>
                        <p class="stat-value cpu-value" style="color:var(--cpu-color)">${c.cpu.toFixed(2)}%</p>
                        <div class="chart-container"><div id="${c.id}-cpu" style="width:100%;height:100%"></div></div>
                    </div>
                    <div class="stat-block">
                        <p class="stat-label">RAM Usage (Current)</p>
                        <p class="stat-value ram-value" style="color:var(--ram-color)">${ramPct.toFixed(1)}%</p>
                        <div class="chart-container"><div id="${c.id}-ram" style="width:100%;height:100%"></div></div>
                    </div>
                </div>
                <div class="metadata">
                    <p><strong>Image:</strong> <strong style="max-width:250px">${c.image}</strong></p>
                    <p><strong>RAM:</strong> <strong>${c.ramUsage} MiB / ${ramDisplay}</strong></p>
                    <p><strong>ID:</strong> <strong>${c.id.substring(0,12)}</strong></p>
                </div>
            </div>`;
        } else {
            card.querySelector('.card-title').textContent = c.name;
            const badge = card.querySelector('.status-badge');
            badge.className = `status-badge ${isRunning ? 'status-running' : 'status-error'}`;
            badge.textContent = isRunning ? 'Running' : 'Stopped / Error';
            card.querySelector('.cpu-value').textContent = c.cpu.toFixed(2) + '%';
            card.querySelector('.ram-value').textContent = ramPct.toFixed(1) + '%';
            const metas = card.querySelectorAll('.metadata strong:last-child');
            metas[0].textContent = c.image;
            metas[1].textContent = `${c.ramUsage} MiB / ${ramDisplay}`;
            metas[2].textContent = c.id.substring(0, 12);
        }

        updateChart(`${c.id}-cpu`, COLORS.cpu, c.cpu);
        updateChart(`${c.id}-ram`, COLORS.ram, ramPct);
    });

    if (isFirstRender) {
        containerGrid.innerHTML = newHtml;
        isFirstRender = false;
        containers.forEach(c => {
            initChart(`${c.id}-cpu`, COLORS.cpu, c.cpu);
            initChart(`${c.id}-ram`, COLORS.ram, c.ramLimit > 0 ? (c.ramUsage / c.ramLimit) * 100 : 0);
        });
    } else if (newHtml) {
        containerGrid.insertAdjacentHTML('beforeend', newHtml);
        containers.forEach(c => {
            if (!charts[`${c.id}-cpu`]) initChart(`${c.id}-cpu`, COLORS.cpu, c.cpu);
            if (!charts[`${c.id}-ram`]) initChart(`${c.id}-ram`, COLORS.ram, c.ramLimit > 0 ? (c.ramUsage / c.ramLimit) * 100 : 0);
        });
    }

    // Remove old cards
    [...containerGrid.children].forEach(el => {
        const id = el.id.replace('card-', '');
        if (id && !activeIds.has(id) && id !== 'loading-message') el.remove();
    });
    cleanUpCharts(activeIds);
};
