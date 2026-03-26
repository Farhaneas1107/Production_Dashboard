document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initFilters();
});

const dateFilter = document.getElementById('dateFilter');
const shiftToggles = document.getElementById('shiftToggles').querySelectorAll('.shift-btn');
const plantFilter = document.getElementById('plantFilter');
const machineFilter = document.getElementById('machineFilter');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');

// DOM Output Areas
const kpiActiveMachines = document.getElementById('kpiActiveMachines');
const kpiTotalQty = document.getElementById('kpiTotalQty');
const kpiTotalDowntime = document.getElementById('kpiTotalDowntime');
const machineGrid = document.getElementById('machineGridV2');
const runTableBody = document.getElementById('runTableBody');
const downtimeChart = document.getElementById('downtimeChart');
const downtimeFeed = document.getElementById('downtimeFeed');
const sidebarTitle = document.getElementById('sidebarTitle');
const sidebarSubtitle = document.getElementById('sidebarSubtitle');

const prevDateBtn = document.getElementById('prevDateBtn');
const nextDateBtn = document.getElementById('nextDateBtn');

let ACTIVE_DATA = { plants: [], machines: [], orders: [], downtimes: [], products: [] };
let activeShift = '1';

async function initFilters() {
    dateFilter.value = new Date().toISOString().split('T')[0];

    const data = await EnlyzeAPI.getLiveData();
    if (data) ACTIVE_DATA = data;

    ACTIVE_DATA.plants.forEach(plant => {
        const option = document.createElement('option');
        option.value = plant.uuid;
        option.textContent = plant.name;
        plantFilter.appendChild(option);
    });

    updateMachineDropdown('all');

    dateFilter.addEventListener('change', fetchAndRenderV2);
    plantFilter.addEventListener('change', (e) => {
        updateMachineDropdown(e.target.value);
        fetchAndRenderV2();
    });
    machineFilter.addEventListener('change', fetchAndRenderV2);

    shiftToggles.forEach(btn => {
        btn.addEventListener('click', (e) => {
            shiftToggles.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeShift = e.target.dataset.shift;
            fetchAndRenderV2();
        });
    });

    refreshBtn.addEventListener('click', fetchAndRenderV2);
    exportBtn.addEventListener('click', () => window.print());

    prevDateBtn.addEventListener('click', () => changeDateByOffsetV2(-1));
    nextDateBtn.addEventListener('click', () => changeDateByOffsetV2(1));

    fetchAndRenderV2();
}

function changeDateByOffsetV2(offset) {
    if (!dateFilter.value) return;
    const current = new Date(dateFilter.value);
    current.setDate(current.getDate() + offset);
    dateFilter.value = current.toISOString().split('T')[0];
    fetchAndRenderV2();
}

function updateMachineDropdown(plantId) {
    machineFilter.innerHTML = '<option value="all">All machines</option>';
    const fMach = plantId === 'all' ? ACTIVE_DATA.machines : ACTIVE_DATA.machines.filter(m => m.site === plantId);
    fMach.forEach(m => {
        const option = document.createElement('option');
        option.value = m.uuid;
        option.textContent = m.name;
        machineFilter.appendChild(option);
    });
}

function getProductName(productUuid) {
    const p = ACTIVE_DATA.products.find(prod => prod.uuid === productUuid);
    return p ? (p.name || p.external_id) : 'Unknown';
}

function getDurationMs(startStr, endStr) {
    if (!startStr) return 0;
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : new Date();
    return end - start;
}

function formatDuration(ms) {
    const min = Math.floor(ms / 60000);
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function formatSecondsMin(secs) {
    if (secs == null) return '-';
    return `${Math.floor(Number(secs)/60)}m`;
}

function formatQty(qtyObj) {
    if (!qtyObj || qtyObj.value == null) return '-';
    return Math.floor(qtyObj.value).toLocaleString('en-US'); // No decimals per mockup
}

async function fetchAndRenderV2() {
    const selectedDate = dateFilter.value;
    if (!selectedDate) return;

    const data = await EnlyzeAPI.getLiveData();
    if (data) ACTIVE_DATA = data;

    const sShift = activeShift === 'all' ? 'all' : parseInt(activeShift);
    const { start: shiftStart, end: shiftEnd } = getShiftBoundaries(selectedDate, sShift);

    renderV2(shiftStart, shiftEnd);
}

function renderV2(shiftStart, shiftEnd) {
    const pFilter = plantFilter.value;
    const mFilter = machineFilter.value;
    
    let machines = pFilter === 'all' ? ACTIVE_DATA.machines : ACTIVE_DATA.machines.filter(m => m.site === pFilter);
    if (mFilter !== 'all') {
        machines = machines.filter(m => m.uuid === mFilter);
    }

    let globalQty = 0;
    let globalDowntimeMs = 0;
    let activeMachineCount = 0;

    machineGrid.innerHTML = '';
    runTableBody.innerHTML = '';
    
    let allDowntimesToFeed = [];
    let downtimeAggregations = {};

    machines.forEach(mach => {
        const mOrders = ACTIVE_DATA.orders.filter(o => o.machine === mach.uuid && isEventInShift(o.start, o.end, shiftStart, shiftEnd));
        const mDowntimes = ACTIVE_DATA.downtimes.filter(dt => dt.machine === mach.uuid && isEventInShift(dt.start, dt.end, shiftStart, shiftEnd));
        
        let machDowntimeMs = 0;
        mDowntimes.forEach(dt => {
            const dMs = getDurationMs(dt.start, dt.end);
            machDowntimeMs += dMs;
            allDowntimesToFeed.push({ ...dt, machineName: mach.name, durMs: dMs });
        });
        globalDowntimeMs += machDowntimeMs;
        if (machDowntimeMs > 0) { downtimeAggregations[mach.name] = machDowntimeMs; }

        const isRunning = mOrders.some(o => !o.end || new Date(o.end) > shiftEnd || new Date(o.end) >= new Date());
        const hasDown = mDowntimes.some(dt => !dt.end || new Date(dt.end) > new Date());
        
        if (isRunning) activeMachineCount++;

        let badgeHtml = isRunning ? `<div class="mc-status">RUNNING</div>` : `<div class="mc-status status-offline">IDLE</div>`;
        if (hasDown) badgeHtml = `<div class="mc-status" style="background:#e13c49; color:white;">DOWN</div>`;

        // Grab the most dominant/recent order for the card summary
        let mainOrder = mOrders.length > 0 ? mOrders[mOrders.length-1] : null;

        // Extract Product Code
        let prodName = '';
        if (mainOrder && mainOrder.product) {
            const pObj = ACTIVE_DATA.products.find(p => p.uuid === mainOrder.product);
            if (pObj && pObj.external_id) prodName = pObj.external_id + ' &bull; ';
        }
        let poText = mainOrder ? `${prodName}PO #${mainOrder.production_order || 'N/A'}` : 'No Active PO';
        let runText = mainOrder ? `Runtime: ${formatDuration(getDurationMs(mainOrder.start, mainOrder.end))}` : 'Runtime: 0';
        
        let qtyRaw = mainOrder && mainOrder.quantity_yield ? mainOrder.quantity_yield.value : 0;
        globalQty += qtyRaw;
        let qtyText = mainOrder ? formatQty(mainOrder.quantity_yield) : '-';
        let thrText = mainOrder && mainOrder.average_throughput ? Math.floor(mainOrder.average_throughput).toString() : '-';
        let spdText = mainOrder && mainOrder.maximum_run_speed ? Math.floor(mainOrder.maximum_run_speed.value).toString() + (mainOrder.maximum_run_speed.unit || '') : '-';
        let pLoss = mainOrder ? formatSecondsMin(mainOrder.productivity?.time_loss) : '-';
        let fLoss = mainOrder ? formatSecondsMin(mainOrder.performance?.time_loss) : '-';

        // Create Card HTML
        machineGrid.innerHTML += `
        <div class="mc-card">
            <div class="mc-header">
                <div class="mc-title">${mach.name}</div>
                ${badgeHtml}
            </div>
            <div class="mc-subtitle">${poText}</div>
            <div class="mc-runtime">${runText}</div>
            
            <div class="mc-metrics">
                <div class="mc-met">
                    <div class="mc-met-val"><i data-lucide="database" style="color:#5e666a; width:16px;"></i> ${qtyText}</div>
                    <div class="mc-met-label">Total quantity</div>
                </div>
                <div class="mc-met">
                    <div class="mc-met-val"><i data-lucide="activity" style="color:#5e666a; width:16px;"></i> ${thrText}</div>
                    <div class="mc-met-label">Avg throughput</div>
                </div>
                <div class="mc-met">
                    <div class="mc-met-val"><i data-lucide="gauge" style="color:#5e666a; width:16px;"></i> ${spdText}</div>
                    <div class="mc-met-label">Max run speed</div>
                </div>
            </div>

            <div class="mc-loss-bar">
                <div class="mc-loss"><span>Prod. time loss</span><span>${pLoss}</span></div>
                <div class="mc-loss yellow"><span>Perf. time loss</span><span>${fLoss}</span></div>
            </div>
        </div>`;

        // Fill table rows
        mOrders.forEach(o => {
            let pNameStr = '';
            if (o.product) {
                const pObj = ACTIVE_DATA.products.find(p => p.uuid === o.product);
                if (pObj && pObj.external_id) pNameStr = pObj.external_id + ' &bull; ';
            }
            const pName = `${pNameStr}${o.production_order || 'N/A'}`;
            const sTime = formatTime(o.start);
            const eTime = o.end ? formatTime(o.end) : 'Ongoing';
            const rTime = formatDuration(getDurationMs(o.start, o.end));
            const yQty = formatQty(o.quantity_yield);
            const aThr = o.average_throughput ? Math.floor(o.average_throughput) : '-';
            const mSpd = o.maximum_run_speed ? Math.floor(o.maximum_run_speed.value) : '-';

            runTableBody.innerHTML += `
            <tr>
                <td><strong>${mach.name}</strong></td>
                <td>${pName}</td>
                <td>${sTime}</td>
                <td>${eTime}</td>
                <td>${rTime}</td>
                <td>${yQty}</td>
                <td>${aThr}</td>
                <td>${mSpd}</td>
            </tr>`;
        });
    });

    if (machines.length === 0) { machineGrid.innerHTML = `<div style="padding: 20px;">No machines found.</div>`; }

    // Update Global KPIs
    kpiActiveMachines.innerText = activeMachineCount;
    kpiTotalQty.innerText = Math.floor(globalQty).toLocaleString('en-US');
    kpiTotalDowntime.innerText = formatDuration(globalDowntimeMs);

    // Render Sidebars
    let shiftTxt = activeShift === 'all' ? 'All Day' : `Shift ${activeShift}`;
    sidebarTitle.innerText = `Downtime today - ${shiftTxt}`;
    sidebarSubtitle.innerText = `${formatDuration(globalDowntimeMs)} total downtime · ${allDowntimesToFeed.length} events`;

    // Render Chart
    downtimeChart.innerHTML = '';
    let maxAgg = 0;
    Object.keys(downtimeAggregations).forEach(k => { if(downtimeAggregations[k] > maxAgg) maxAgg = downtimeAggregations[k]; });
    
    // Sort highest to lowest
    let sortedAggr = Object.keys(downtimeAggregations).sort((a,b) => downtimeAggregations[b] - downtimeAggregations[a]);
    sortedAggr.forEach(mName => {
        let valMs = downtimeAggregations[mName];
        let pct = Math.floor((valMs / maxAgg) * 100);
        downtimeChart.innerHTML += `
        <div class="chart-row">
            <div class="chart-label">${mName}</div>
            <div class="chart-bar-wrapper"><div class="chart-bar" style="width:${pct}%;"></div></div>
            <div class="chart-val">${formatDuration(valMs)}</div>
        </div>`;
    });

    // Render Feed
    downtimeFeed.innerHTML = '';
    // Sort latest first
    allDowntimesToFeed.sort((a,b) => new Date(b.start) - new Date(a.start));
    allDowntimesToFeed.forEach(dt => {
        const reason = dt.reason ? (dt.reason.name || 'Unknown Reason') : 'Unspecified';
        const type = dt.reason ? (dt.reason.category || 'N/A') : 'N/A';
        const sTime = formatTime(dt.start);
        const eTime = dt.end ? formatTime(dt.end) : 'Ongoing';
        
        downtimeFeed.innerHTML += `
        <div class="dt-card">
            <div class="dt-reason">${reason}</div>
            <div class="dt-meta">
                <span>${dt.machineName} &middot; ${type}</span>
                <span>${sTime} - ${eTime} &nbsp;&nbsp; <strong>${formatDuration(dt.durMs)}</strong></span>
            </div>
            <div class="dt-comment">${dt.comment || ''}</div>
        </div>`;
    });

    lucide.createIcons();
}
