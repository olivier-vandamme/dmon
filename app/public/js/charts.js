/**
 * charts.js
 *
 * Description : Chart management (options, initialization, updates, cleanup).
 * Project     : Dmon - Docker containers monitor
 * Author      : Olivier Vandamme
 * Copyright   : (c) 2025 Olivier Vandamme
 * License     : MIT (see the LICENSE file at project root)
 *
 * Notes :
 * - Uses ECharts for rendering.
 * - Contains utilities: initChart, updateChart, initHostCharts, cleanUpCharts.
 */

/**
 * Base ECharts options shared across all charts.
 * Base configuration (grids, axes, appearance) used by `getChartOption`.
 * @type {Object}
 */
const baseChartOption = {
    animation: false,
    grid: { left: '3%', right: '50px', top: '8%', bottom: '12%', containLabel: false },
    xAxis: {
        type: 'category', boundaryGap: false, show: true,
        axisLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.08)' } },
        axisTick: { show: false }, axisLabel: { show: false },
        splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.05)', type: 'dashed' } }
    },
    yAxis: {
        type: 'value', min: 0, max: 100, interval: 25, position: 'right',
        axisLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.08)' } },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.05)', type: 'dashed' } },
        axisLabel: { color: '#999', fontSize: 10, formatter: '{value}%', fontWeight: 500 }
    }
};

/**
 * Returns an ECharts option object for the given chart.
 * @param {string} color - series color
 * @param {number[]} data - array of values (0-100)
 * @returns {Object} ECharts-compatible option configuration
 */
const getChartOption = (color, data) => ({
    ...baseChartOption,
    xAxis: { ...baseChartOption.xAxis, data: Array(data.length).fill('') },
    series: [{
        type: 'line', data, smooth: 0.4, smoothMonotone: 'x', showSymbol: false,
        lineStyle: { color, width: 2.5, shadowColor: color + '40', shadowBlur: 8, shadowOffsetY: 2 },
        areaStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [{ offset: 0, color: color + '66' }, { offset: 0.5, color: color + '33' }, { offset: 1, color: color + '0A' }]
            }
        }
    }]
});

// Unified chart management
/**
 * Retrieves (or initializes) the history for a given key.
 * @param {string} key - container id or 'host'
 * @returns {{cpu:number[], ram:number[]}} history object
 */
const getHistory = (key) => historyData[key] || (historyData[key] = { cpu: [], ram: [] });

/**
 * Initializes an ECharts chart in the DOM.
 * @param {string} chartId - chart identifier / DOM id
 * @param {string} color - series color
 * @param {number|null} initialValue - initial value (0-100) if provided
 * @returns {Object|null} chart instance or null on failure
 */
const initChart = (chartId, color, initialValue = null) => {
    if (!echartsReady) return null;
    const dom = $(chartId);
    if (!dom) return null;

    charts[chartId]?.dispose();
    const [key, type] = chartId.includes('host') ? ['host', chartId.includes('cpu') ? 'cpu' : 'ram'] : [chartId.split('-')[0], chartId.split('-')[1]];
    const arr = getHistory(key)[type];

    if (!arr.length && typeof initialValue === 'number') {
        const v = Math.min(100, Math.max(0, initialValue));
        for (let i = 0; i < 10; i++) arr.push(v);
    }

    const chart = echarts.init(dom);
    chart.setOption(getChartOption(color, arr));
    return charts[chartId] = chart;
};

/**
 * Updates a chart's data: appends the new value to history and updates the displayed option.
 * @param {string} chartId - chart identifier
 * @param {string} color - color used for the series
 * @param {number} value - value (0-100) to insert
 */
const updateChart = (chartId, color, value) => {
    const [key, type] = chartId.includes('host') ? ['host', chartId.includes('cpu') ? 'cpu' : 'ram'] : [chartId.split('-')[0], chartId.split('-')[1]];
    const arr = getHistory(key)[type];
    arr.push(Math.min(100, Math.max(0, value || 0)));
    if (arr.length > MAX_DATA_POINTS) arr.shift();

    const chart = charts[chartId] || initChart(chartId, color, value);
    chart?.setOption({ xAxis: { data: Array(arr.length).fill('') }, series: [{ data: arr }] });
};

/**
 * Removes charts and histories for inactive containers.
 * @param {Set<string>} activeIds - set of active identifiers to keep
 */
const cleanUpCharts = (activeIds) => {
    Object.keys(charts).forEach(k => {
        const id = k.split('-')[0];
        if (id !== 'host' && !activeIds.has(id)) {
            charts[k].dispose();
            delete charts[k];
            delete historyData[id];
        }
    });
};

/**
 * Initializes the host charts (CPU/RAM) if ECharts is ready.
 */
const initHostCharts = () => {
    if (!echartsReady) return;
    initChart('host-cpu-chart', COLORS.hostCpu);
    initChart('host-ram-chart', COLORS.ram);
};

/**
 * Resize handler (debounced): resizes all charts after 100ms.
 */
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => Object.values(charts).forEach(c => c?.resize()), 100);
});
