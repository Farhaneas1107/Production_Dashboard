// Initialize Lucide icons on load
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initFilters();
});

// DOM Elements
const dateFilter = document.getElementById('dateFilter');
const shiftFilter = document.getElementById('shiftFilter');
const plantFilter = document.getElementById('plantFilter');
const machineFilter = document.getElementById('machineFilter');
const dashboardContent = document.getElementById('dashboardContent');
const exportBtn = document.getElementById('exportBtn');
const refreshBtn = document.getElementById('refreshBtn');

// Global state holding live API data
let ACTIVE_DATA = {
    plants: [],
    machines: [],
    orders: [],
    downtimes: [],
    products: []
};

async function initFilters() {
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i data-lucide="loader"></i> Initializing...';
    lucide.createIcons();
    
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

    dateFilter.addEventListener('change', fetchAndRenderDashboard);
    shiftFilter.addEventListener('change', fetchAndRenderDashboard);
    plantFilter.addEventListener('change', (e) => {
        updateMachineDropdown(e.target.value);
        fetchAndRenderDashboard();
    });
    machineFilter.addEventListener('change', fetchAndRenderDashboard);
    
    refreshBtn.addEventListener('click', () => {
        refreshBtn.classList.add('rotating'); 
        fetchAndRenderDashboard().then(() => {
            refreshBtn.classList.remove('rotating');
        });
    });

    setInterval(() => {
        console.log("Auto-refreshing dashboard...");
        fetchAndRenderDashboard();
    }, 8 * 60 * 60 * 1000);

    exportBtn.addEventListener('click', () => {
        window.print();
    });
    
    exportBtn.disabled = false;
    exportBtn.innerHTML = '<i data-lucide="printer"></i> Print / Export PDF';
    lucide.createIcons();

    await fetchAndRenderDashboard();
}

function updateMachineDropdown(plantId) {
    machineFilter.innerHTML = '<option value="all">All Machines</option>';
    const filteredMachines = plantId === 'all' 
        ? ACTIVE_DATA.machines 
        : ACTIVE_DATA.machines.filter(m => m.site === plantId);
    
    filteredMachines.forEach(m => {
        const option = document.createElement('option');
        option.value = m.uuid;
        option.textContent = m.name;
        machineFilter.appendChild(option);
    });
}

function getProductName(productUuid) {
    const p = ACTIVE_DATA.products.find(prod => prod.uuid === productUuid);
    return p ? (p.name || p.external_id) : 'Unknown Product';
}

function getDuration(startStr, endStr) {
    if (!startStr) return '';
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : new Date();
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
}

function formatSeconds(secs) {
    if (secs == null) return '-';
    const num = Number(secs);
    const h = Math.floor(num / 3600);
    const m = Math.floor((num % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
}

function formatQty(qtyObj) {
    if (!qtyObj || qtyObj.value == null) return '-';
    // Format large numbers perfectly
    const val = Number(qtyObj.value).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const u = qtyObj.unit || '';
    return val + ' ' + u;
}

async function fetchAndRenderDashboard() {
    const selectedDate = dateFilter.value;
    const selectedShift = shiftFilter.value === 'all' ? 'all' : parseInt(shiftFilter.value);

    if (!selectedDate) return;

    // Use a clean rendering loader
    dashboardContent.innerHTML = '<div style="padding:60px; text-align:center; font-size: 1.2rem; color: var(--text-secondary);"><i data-lucide="loader" class="rotating" style="margin-right: 12px;"></i> Syncing Layout...</div>';
    lucide.createIcons();

    const { start: shiftStart, end: shiftEnd } = getShiftBoundaries(selectedDate, selectedShift);
    
    const liveData = await EnlyzeAPI.getLiveData();
    if (liveData) ACTIVE_DATA = liveData;

    renderDashboardUI(shiftStart, shiftEnd);
}

function renderDashboardUI(shiftStart, shiftEnd) {
    const selectedPlant = plantFilter.value;
    const selectedMachine = machineFilter.value;
    
    dashboardContent.innerHTML = '';

    if (selectedMachine !== 'all') {
        dashboardContent.classList.add('single-machine-report');
    } else {
        dashboardContent.classList.remove('single-machine-report');
    }

    const plantsToRender = selectedPlant === 'all' 
        ? ACTIVE_DATA.plants 
        : ACTIVE_DATA.plants.filter(p => p.uuid === selectedPlant);

    let itemsRendered = 0;

    plantsToRender.forEach(plant => {
        let machinesToRender = ACTIVE_DATA.machines.filter(m => m.site === plant.uuid);
        if (selectedMachine !== 'all') {
            machinesToRender = machinesToRender.filter(m => m.uuid === selectedMachine);
        }

        if (machinesToRender.length === 0) return;

        itemsRendered++;

        const plantSection = document.createElement('div');
        plantSection.className = 'plant-section';
        
        const plantTitle = document.createElement('h2');
        plantTitle.className = 'plant-title';
        plantTitle.innerHTML = '<i data-lucide="factory"></i> ' + plant.name;
        plantSection.appendChild(plantTitle);

        const machineGrid = document.createElement('div');
        machineGrid.className = 'machine-grid';

        machinesToRender.forEach(machine => {
            const mCard = createMachineCard(machine.uuid, machine.name, shiftStart, shiftEnd);
            machineGrid.appendChild(mCard);
        });

        plantSection.appendChild(machineGrid);
        dashboardContent.appendChild(plantSection);
    });

    if (itemsRendered === 0) {
        dashboardContent.innerHTML = '<div style="padding:60px; text-align:center; font-size: 1.2rem; color: var(--text-secondary);">No machines found for these filters. Data bridge synced?</div>';
    }

    lucide.createIcons();
}

function createMachineCard(machineUuid, machineName, shiftStart, shiftEnd) {
    const card = document.createElement('div');
    card.className = 'machine-card';

    const mOrders = ACTIVE_DATA.orders.filter(o => o.machine === machineUuid && isEventInShift(o.start, o.end, shiftStart, shiftEnd));
    const mDowntimes = ACTIVE_DATA.downtimes.filter(dt => dt.machine === machineUuid && isEventInShift(dt.start, dt.end, shiftStart, shiftEnd));

    const hasOngoing = mOrders.some(o => !o.end || new Date(o.end) > shiftEnd || new Date(o.end) >= new Date());
    const hasDowntime = mDowntimes.some(dt => !dt.end || new Date(dt.end) > new Date());
    
    let statusClass = 'status-idle';
    let statusText = 'Idle Mode';
    
    if (hasDowntime) {
        statusClass = 'status-down';
        statusText = 'Actively Down';
    } else if (hasOngoing) {
        statusClass = 'status-ongoing';
        statusText = 'Currently Running';
    }

    card.innerHTML = '' +
        '<div class="machine-header">' +
            '<div class="machine-name">' + machineName + '</div>' +
            '<div class="status-badge ' + statusClass + '">' + statusText + '</div>' +
        '</div>';

    // Product Orders Array
    const orderSec = document.createElement('div');
    orderSec.className = 'data-section';
    orderSec.innerHTML = '<h4>Production Run Log</h4>';
    if (mOrders.length > 0) {
        mOrders.forEach(o => {
            const isCompleted = !!o.end && new Date(o.end) <= shiftEnd;
            const extraClass = isCompleted ? 'order-completed' : 'order-ongoing';
            
            let prefix = "";
            let timeColorStr = "";
            if (new Date(o.start) < shiftStart) {
                prefix = '(Started ' + formatDate(o.start) + ') ';
                timeColorStr = "color: var(--warning);";
            }

            const prodName = getProductName(o.product);
            const poTitle = o.production_order || 'Unassigned PO';
            const timeRange = prefix + formatTime(o.start) + ' - ' + (o.end ? formatTime(o.end) : 'Ongoing');
            const durationTitle = getDuration(o.start, o.end);

            const maxSpeedStr = o.maximum_run_speed ? Number(o.maximum_run_speed.value).toFixed(1) + ' ' + (o.maximum_run_speed.unit || '') : '-';
            const avgThroughput = o.average_throughput ? Number(o.average_throughput).toFixed(1) : '-';
            const qtyProduced = formatQty(o.quantity_total);
            const qtyYield = formatQty(o.quantity_yield);
            const prodTimeLoss = formatSeconds(o.productivity ? o.productivity.time_loss : null);
            const perfTimeLoss = formatSeconds(o.performance ? o.performance.time_loss : null);

            orderSec.innerHTML += '' +
                '<div class="data-item ' + extraClass + '">' +
                    '<div class="data-item-header-spacious">' +
                        '<div class="title-block">' +
                            '<h3>' + prodName + '</h3>' +
                            '<span class="subtitle">PO: ' + poTitle + '</span>' +
                        '</div>' +
                        '<div class="time-block">' +
                            '<div class="time-range" style="' + timeColorStr + '">' + timeRange + '</div>' +
                            '<div class="duration-badge">' + durationTitle + ' runtime</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="metrics-spacious-grid">' +
                        '<div class="metric-box"><span class="mlabel">Total Quantity</span><span class="mvalue">' + qtyProduced + '</span></div>' +
                        '<div class="metric-box"><span class="mlabel">Yield / Good</span><span class="mvalue text-primary">' + qtyYield + '</span></div>' +
                        '<div class="metric-box"><span class="mlabel">Avg Throughput</span><span class="mvalue">' + avgThroughput + '</span></div>' +
                        '<div class="metric-box"><span class="mlabel">Max Run Speed</span><span class="mvalue">' + maxSpeedStr + '</span></div>' +
                        '<div class="metric-box"><span class="mlabel">Prod. Time Loss</span><span class="mvalue text-danger">' + prodTimeLoss + '</span></div>' +
                        '<div class="metric-box"><span class="mlabel">Perf. Time Loss</span><span class="mvalue text-danger">' + perfTimeLoss + '</span></div>' +
                    '</div>' +
                '</div>';
        });
    } else {
        orderSec.innerHTML += '<div style="font-size:1rem; font-style: italic; color:var(--text-secondary); padding: 12px 0;">No production events logged.</div>';
    }
    card.appendChild(orderSec);

    // Downtimes Array
    const dtSec = document.createElement('div');
    dtSec.className = 'data-section';
    dtSec.innerHTML = '<h4>Downtime Log</h4>';
    if (mDowntimes.length > 0) {
        mDowntimes.forEach(dt => {
            const reasonTitle = dt.reason ? (dt.reason.name || 'Unknown Reason') : 'Unspecified Downtime';
            const catTitle = dt.reason ? (dt.reason.category || 'N/A') : 'N/A';
            const timeRange = formatTime(dt.start) + ' - ' + (dt.end ? formatTime(dt.end) : 'Ongoing');
            const durationTitle = getDuration(dt.start, dt.end);
            const comment = dt.comment ? dt.comment : 'No additional comments provided.';
            
            dtSec.innerHTML += '' +
                '<div class="data-item downtime">' +
                    '<div class="data-item-header-spacious">' +
                        '<div class="title-block">' +
                            '<h3 class="text-danger"><i data-lucide="alert-triangle" style="width: 20px; height: 20px;"></i> ' + reasonTitle + '</h3>' +
                            '<span class="subtitle">' + machineName + ' &bull; Cat: ' + catTitle + '</span>' +
                        '</div>' +
                        '<div class="time-block">' +
                            '<div class="time-range text-danger">' + timeRange + '</div>' +
                            '<div class="duration-badge">' + durationTitle + ' down</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="downtime-comment">' + comment + '</div>' +
                '</div>';
        });
    } else {
        dtSec.innerHTML += '<div style="font-size:1rem; font-style: italic; color:var(--text-secondary); padding: 12px 0;">No machine downtimes recorded during this shift.</div>';
    }
    card.appendChild(dtSec);

    return card;
}
