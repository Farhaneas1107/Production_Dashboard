document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initFilters();
});

const dateFilterSingle = document.getElementById('dateFilterSingle');
const dateFilterEnd = document.getElementById('dateFilterEnd');
const dateRangeInputs = document.getElementById('dateRangeInputs');
const toggleRangeModeBtn = document.getElementById('toggleRangeModeBtn');
const customTimeInputs = document.getElementById('customTimeInputs');
const customStartTime = document.getElementById('customStartTime');
const customEndTime = document.getElementById('customEndTime');
const shiftToggles = document.getElementById('shiftToggles').querySelectorAll('button');
const plantFilter = document.getElementById('plantFilter');
const machineFilter = document.getElementById('machineFilter');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');

const headerContext = document.getElementById('headerContext');
const headerDateTxt = document.getElementById('headerDateTxt');

const kpiActiveMachines = document.getElementById('kpiActiveMachines');
const kpiTotalQty = document.getElementById('kpiTotalQty');
const kpiTotalDowntime = document.getElementById('kpiTotalDowntime');
const machineGrid = document.getElementById('machineGridV4');
const runTableBody = document.getElementById('runTableBody');
const downtimeChart = document.getElementById('downtimeChart');
const downtimeFeed = document.getElementById('downtimeFeed');

const prevDateBtn = document.getElementById('prevDateBtn');
const nextDateBtn = document.getElementById('nextDateBtn');

let ACTIVE_DATA = { plants: [], machines: [], orders: [], downtimes: [], products: [] };
let activeShift = '1';
let isDateRangeMode = false;

async function initFilters() {
    const todayStr = new Date().toISOString().split('T')[0];
    dateFilterSingle.value = todayStr;
    dateFilterEnd.value = todayStr;
    headerDateTxt.innerText = new Date().toLocaleDateString('en-GB');

    const data = await EnlyzeAPI.getLiveData();
    if (data) ACTIVE_DATA = data;

    plantFilter.innerHTML = '<option value="all">Global Plant Status</option>';
    ACTIVE_DATA.plants.forEach(plant => {
        const option = document.createElement('option');
        option.value = plant.uuid;
        option.textContent = plant.name;
        plantFilter.appendChild(option);
    });

    updateMachineDropdown('all');

    dateFilterSingle.addEventListener('change', fetchAndRender);
    dateFilterEnd.addEventListener('change', fetchAndRender);
    customStartTime.addEventListener('change', fetchAndRender);
    customEndTime.addEventListener('change', fetchAndRender);
    plantFilter.addEventListener('change', (e) => {
        updateMachineDropdown(e.target.value);
        fetchAndRender();
    });
    machineFilter.addEventListener('change', fetchAndRender);

    shiftToggles.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.target.closest('button');
            if (!btnEl) return;
            shiftToggles.forEach(b => b.classList.remove('active'));
            btnEl.classList.add('active');
            activeShift = btnEl.dataset.shift;
            
            if (activeShift === 'custom') {
                customTimeInputs.style.display = 'flex';
            } else {
                customTimeInputs.style.display = 'none';
            }
            
            fetchAndRender();
        });
    });

    refreshBtn.addEventListener('click', async () => {
        let icon = refreshBtn.querySelector('svg');
        if (icon) icon.classList.add('spin-anim');
        
        try {
            // Ensure the button spins for exactly 1 second
            const spinPromise = new Promise(resolve => setTimeout(resolve, 1000));
            const fetchPromise = fetchAndRender();
            await Promise.all([spinPromise, fetchPromise]);
        } finally {
            // Re-query the SVG! fetchAndRender() calls lucide.createIcons() 
            // which destroys the old SVG and builds a replacement in the DOM.
            icon = refreshBtn.querySelector('svg');
            if (icon) icon.classList.remove('spin-anim');
        }
    });
    
    exportBtn.addEventListener('click', () => window.print());

    prevDateBtn.addEventListener('click', () => changeDateByOffset(-1));
    nextDateBtn.addEventListener('click', () => changeDateByOffset(1));

    toggleRangeModeBtn.addEventListener('click', () => {
        isDateRangeMode = !isDateRangeMode;
        if (isDateRangeMode) {
            dateRangeInputs.style.display = 'flex';
            toggleRangeModeBtn.style.color = 'var(--naue-green)';
        } else {
            dateRangeInputs.style.display = 'none';
            toggleRangeModeBtn.style.color = 'var(--text-gray)';
        }
        fetchAndRender();
    });

    fetchAndRender();
}

function changeDateByOffset(offset) {
    if (!dateFilterSingle.value) return;
    const start = new Date(dateFilterSingle.value);
    start.setDate(start.getDate() + offset);
    dateFilterSingle.value = start.toISOString().split('T')[0];
    
    if (isDateRangeMode) {
        if (!dateFilterEnd.value) return;
        const end = new Date(dateFilterEnd.value);
        end.setDate(end.getDate() + offset);
        dateFilterEnd.value = end.toISOString().split('T')[0];
    }
    fetchAndRender();
}

function updateMachineDropdown(plantId) {
    machineFilter.innerHTML = '<option value="all">Global status</option>';
    const fMach = plantId === 'all' ? ACTIVE_DATA.machines : ACTIVE_DATA.machines.filter(m => m.site === plantId);
    fMach.forEach(m => {
        const option = document.createElement('option');
        option.value = m.uuid;
        option.textContent = m.name;
        machineFilter.appendChild(option);
    });
}

function getDurationMs(startStr, endStr) {
    if (!startStr) return 0;
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : new Date();
    return end - start;
}

function formatDurExt(ms) {
    const min = Math.floor(ms / 60000);
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function formatQty(obj) {
    if (!obj || obj.value == null) return '-';
    return Number(obj.value).toLocaleString('en-US', {maximumFractionDigits:1});
}

function updateHeaderContext(sStart, sEnd) {
    const pName = plantFilter.value === 'all' ? 'GLOBAL STATUS' : plantFilter.options[plantFilter.selectedIndex].text.toUpperCase();
    
    let sName = '';
    if (activeShift === 'all') sName = 'ALL SHIFTS';
    else if (activeShift === 'custom') {
        const tS = customStartTime.value || '00:00';
        const tE = customEndTime.value || '23:59';
        sName = `CUSTOM PERIOD (${tS} &ndash; ${tE})`;
    }
    else sName = `SHIFT ${activeShift}`;
    
    const dStr1 = new Date(sStart).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const dStr2 = new Date(sEnd).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let rangeText = dStr1 === dStr2 ? dStr1 : `${dStr1} \u2014 ${dStr2}`;
    
    headerContext.innerHTML = `${pName} &bull; ${sName} &bull; ${rangeText}`;
    headerDateTxt.innerText = rangeText;
}

function inAnyShiftWindow(evStart, evEnd, windows) {
    if (!evStart) return false;
    const s = new Date(evStart);
    const e = evEnd ? new Date(evEnd) : new Date();
    return windows.some(w => s < w.end && e > w.start);
}

async function fetchAndRender() {
    const selectedStart = dateFilterSingle.value;
    const selectedEnd = isDateRangeMode ? dateFilterEnd.value : selectedStart;
    if (!selectedStart || !selectedEnd) return;

    // Hot swap data array cleanly
    const freshReq = await EnlyzeAPI.getLiveData();
    if (freshReq) ACTIVE_DATA = freshReq;

    const sShift = activeShift === 'all' ? 'all' : parseInt(activeShift);
    
    let shiftWindows = [];
    let curDate = new Date(selectedStart);
    let lastDate = new Date(selectedEnd);
    
    let limit = 0;
    while(curDate <= lastDate && limit < 100) {
        let dStr = curDate.toISOString().split('T')[0];
        
        let wStart, wEnd;
        if (activeShift === 'custom') {
            const tS = customStartTime.value || '00:00';
            const tE = customEndTime.value || '23:59';
            wStart = new Date(`${dStr}T${tS}:00`);
            wEnd = new Date(`${dStr}T${tE}:00`);
            if (wEnd <= wStart) { wEnd.setDate(wEnd.getDate() + 1); }
        } else {
            const b = getShiftBoundaries(dStr, sShift);
            wStart = b.start;
            wEnd = b.end;
        }
        
        shiftWindows.push({ start: wStart, end: wEnd });
        curDate.setDate(curDate.getDate() + 1);
        limit++;
    }

    updateHeaderContext(selectedStart, selectedEnd);
    
    if (shiftWindows.length === 0) {
        machineGrid.innerHTML = `<div style="padding:40px; width:100%; text-align:center; grid-column: 1 / -1; color:var(--naue-red); font-weight:800;">INVALID DATE RANGE: Start Date cannot be after End Date.</div>`;
        runTableBody.innerHTML = '';
        downtimeChart.innerHTML = '';
        downtimeFeed.innerHTML = '';
        kpiActiveMachines.innerHTML = '0 <span style="font-size:0.5em; opacity:0.5;">/ 0</span>';
        kpiTotalQty.innerHTML = '0 <span style="font-size:0.5em; opacity:0.5;">m</span>';
        kpiTotalDowntime.innerText = '0m';
        return;
    }

    renderGrid(shiftWindows);
}

function renderGrid(shiftWindows) {
    const pFilter = plantFilter.value;
    const mFilter = machineFilter.value;
    
    let machines = pFilter === 'all' ? ACTIVE_DATA.machines : ACTIVE_DATA.machines.filter(m => m.site === pFilter);
    if (mFilter !== 'all') { machines = machines.filter(m => m.uuid === mFilter); }

    let gQty = 0;
    let gDowntimeMs = 0;
    let activeMn = 0;

    machineGrid.innerHTML = '';
    runTableBody.innerHTML = '';
    
    let feedQueue = [];
    let aggDt = {};

    machines.forEach(mach => {
        const mOrders = ACTIVE_DATA.orders.filter(o => o.machine === mach.uuid && inAnyShiftWindow(o.start, o.end, shiftWindows));
        const mDowntimes = ACTIVE_DATA.downtimes.filter(dt => dt.machine === mach.uuid && inAnyShiftWindow(dt.start, dt.end, shiftWindows));
        
        let machDtMs = 0;
        mDowntimes.forEach(dt => {
            const dMs = getDurationMs(dt.start, dt.end);
            machDtMs += dMs;
            feedQueue.push({ ...dt, machineName: mach.name, durMs: dMs });
        });
        gDowntimeMs += machDtMs;
        if (machDtMs > 0) { aggDt[mach.name] = machDtMs; }

        const finalEnd = shiftWindows.length > 0 ? shiftWindows[shiftWindows.length-1].end : new Date();
        const isRunning = mOrders.some(o => !o.end || new Date(o.end) > finalEnd || new Date(o.end) >= new Date());
        const isDownNow = mDowntimes.some(dt => !dt.end || new Date(dt.end) > new Date());
        
        if (isRunning && !isDownNow) activeMn++;

        const mainOrder = mOrders.length > 0 ? mOrders[mOrders.length-1] : null;

        // V3 Aesthetic Critical States
        let cardMode = isDownNow ? "mc-critical" : "";
        let badgeHtml = isRunning ? `<div class="m-badge">RUNNING</div>` : `<div class="m-badge down" style="background:var(--border); color:var(--text-gray);">IDLE</div>`;
        if (isDownNow) badgeHtml = `<div class="m-badge down">DOWN</div>`;

        // Extract Product Code
        let prodName = '';
        if (mainOrder && mainOrder.product) {
            const pObj = ACTIVE_DATA.products.find(p => p.uuid === mainOrder.product);
            if (pObj && pObj.external_id) prodName = pObj.external_id + ' &bull; ';
        }
        let poText = mainOrder ? `${prodName}PO: ${mainOrder.production_order || '-'}` : 'NO ACTIVE PO';
        
        let machineTotalQty = 0;
        mOrders.forEach(o => {
            if (o.quantity_yield && o.quantity_yield.value != null) {
                machineTotalQty += Number(o.quantity_yield.value);
            }
        });
        
        // The global KPI total uses the sum of all matching orders
        gQty += machineTotalQty;
        
        // Stats
        let qTxt = '';
        if (activeShift === 'all') {
            qTxt = machineTotalQty > 0 ? formatQty({value: machineTotalQty}) : '-';
        } else {
            qTxt = mainOrder ? formatQty(mainOrder.quantity_yield) : '-';
        }
        let tTxt = mainOrder && mainOrder.average_throughput ? Number(mainOrder.average_throughput).toFixed(1) : '-';
        
        // Progress bars (maxed out at 8 hours)
        let pLossSec = mainOrder?.productivity?.time_loss || 0;
        let fLossSec = mainOrder?.performance?.time_loss || 0;
        let pLossStr = pLossSec > 0 ? formatDurExt(pLossSec * 1000) : '-';
        let fLossStr = fLossSec > 0 ? formatDurExt(fLossSec * 1000) : '-';
        
        let pLossPct = Math.min((pLossSec / 28800) * 100, 100);
        let fLossPct = Math.min((fLossSec / 28800) * 100, 100);

        // Core machine card
        if (isDownNow) {
            // "Fat Red Block" as requested in V3 design explicitly
            machineGrid.innerHTML += `
            <div class="m-card mc-critical">
                <div class="m-head"><div class="m-name">${mach.name}</div>${badgeHtml}</div>
                <div class="m-po" style="margin-bottom:2px; color:rgba(255,255,255,0.9);">${poText}</div>
                <div style="font-size:0.75rem; color:rgba(255,255,255,0.7); margin-bottom:12px;">Runtime: ${formatDurExt(getDurationMs(mainOrder?.start, mainOrder?.end))}</div>
                <div style="flex: 1; display:flex; flex-direction:column; justify-content:center; align-items:center; margin-top:20px;">
                    <div style="font-size:0.7rem; font-weight:700; opacity:0.8; letter-spacing:0.1em; margin-bottom:4px;">DOWNTIME LOSS</div>
                    <div style="font-size:2.4rem; font-weight:800;">${formatDurExt(machDtMs)}</div>
                </div>
                <div style="font-size:0.75rem; font-style:italic; opacity:0.8; margin-top:auto;">Major blockage detected.</div>
            </div>`;
        } else {
            machineGrid.innerHTML += `
            <div class="m-card">
                <div class="m-head"><div class="m-name">${mach.name}</div>${badgeHtml}</div>
                <div class="m-po" style="margin-bottom:2px;">${poText}</div>
                <div style="font-size:0.75rem; color:var(--text-gray); margin-bottom:12px;">Runtime: ${formatDurExt(getDurationMs(mainOrder?.start, mainOrder?.end))}</div>
                
                <hr style="border:none; border-top:1px solid var(--border); margin-bottom:16px;">
                
                <div style="display:flex; justify-content:space-between; margin-bottom:16px; text-align:center;">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                        <i data-lucide="database" style="width:18px; height:18px; color:var(--text-gray);"></i>
                        <span style="font-size:0.65rem; color:var(--text-gray); font-weight:600;">Total quantity</span>
                        <span style="font-weight:800; font-size:0.9rem;">${qTxt}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                        <i data-lucide="activity" style="width:18px; height:18px; color:var(--text-gray);"></i>
                        <span style="font-size:0.65rem; color:var(--text-gray); font-weight:600;">Avg throughput</span>
                        <span style="font-weight:800; font-size:0.9rem;">${tTxt}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                        <i data-lucide="gauge" style="width:18px; height:18px; color:var(--text-gray);"></i>
                        <span style="font-size:0.65rem; color:var(--text-gray); font-weight:600;">Max run speed</span>
                        <span style="font-weight:800; font-size:0.9rem;">-</span>
                    </div>
                </div>
                
                <hr style="border:none; border-top:1px solid var(--border); margin-bottom:16px;">
                
                <div style="display:flex; justify-content:space-between; gap:12px;">
                    <div style="flex:1; background:#fef2f2; border-left:3px solid var(--naue-red); padding:6px 10px; border-radius:0 4px 4px 0; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.7rem; font-weight:600; color:var(--text-dark);">Prod. time loss</span>
                        <span style="font-size:0.75rem; font-weight:800; color:var(--text-dark);">${pLossStr}</span>
                    </div>
                    <div style="flex:1; background:#fffbeb; border-left:3px solid var(--naue-yellow); padding:6px 10px; border-radius:0 4px 4px 0; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.7rem; font-weight:600; color:var(--text-dark);">Perf. time loss</span>
                        <span style="font-size:0.75rem; font-weight:800; color:var(--text-dark);">${fLossStr}</span>
                    </div>
                </div>
            </div>`;
        }

        // Ledger injection
        mOrders.forEach(o => {
            let pName = '';
            if (o.product) {
                const pObj = ACTIVE_DATA.products.find(p => p.uuid === o.product);
                if (pObj && pObj.external_id) pName = pObj.external_id + ' &bull; ';
            }
            const oText = `${pName}${o.production_order || 'N/A'}`;

            const yQty = formatQty(o.quantity_yield);
            const aThr = o.average_throughput ? Number(o.average_throughput).toFixed(1) : '-';
            const rtObj = formatDurExt(getDurationMs(o.start, o.end));
            runTableBody.innerHTML += `
            <tr>
                <td><strong>${mach.name}</strong></td>
                <td style="color:var(--text-gray); font-variant-numeric: tabular-nums;">${oText}</td>
                <td style="font-variant-numeric: tabular-nums;">${rtObj}</td>
                <td style="font-variant-numeric: tabular-nums;">${yQty}</td>
                <td><span class="yield-tag">100%</span></td>
                <td style="font-weight:800; font-variant-numeric: tabular-nums;">${aThr}</td>
            </tr>`;
        });
    });

    if (machines.length === 0) { machineGrid.innerHTML = `<div>No matching machines.</div>`; }

    // KPI Values
    kpiActiveMachines.innerHTML = `${activeMn} <span style="font-size:0.5em; opacity:0.5;">/ ${machines.length}</span>`;
    kpiTotalQty.innerHTML = `${Math.floor(gQty).toLocaleString('en-US')} <span style="font-size:0.5em; opacity:0.5;">m</span>`;
    kpiTotalDowntime.innerText = formatDurExt(gDowntimeMs);

    // Sidebar: V2 Downtime Header
    const dtHeader = document.getElementById('downtimeHeaderTitle');
    const dtTotal = document.getElementById('downtimeTotalText');
    const dtCount = document.getElementById('downtimeEventCount');
    
    let shiftDisplay = activeShift === 'all' ? 'All Day' : `Shift ${activeShift}`;
    dtHeader.innerText = `Downtime today - ${shiftDisplay}`;
    dtTotal.innerText = `${formatDurExt(gDowntimeMs)} total downtime`;
    dtCount.innerText = `${feedQueue.length} events`;

    // Sidebar: Bottleneck Chart (V2 visual style)
    downtimeChart.innerHTML = '';
    let maxAgg = 0;
    Object.keys(aggDt).forEach(k => { if(aggDt[k] > maxAgg) maxAgg = aggDt[k]; });
    let sortedAggr = Object.keys(aggDt).sort((a,b) => aggDt[b] - aggDt[a]);
    
    sortedAggr.forEach(mName => {
        let valMs = aggDt[mName];
        let pct = Math.floor((valMs / maxAgg) * 100);
        downtimeChart.innerHTML += `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:12px;">
            <div style="width:40px; text-align:right; font-size:0.85rem; font-weight:700; color:var(--text-dark);">${mName}</div>
            <div style="flex:1; background:#f0f0f0; border-radius:4px; height:10px; overflow:hidden;">
                <div style="background:#5e926f; height:100%; width:${pct}%;"></div>
            </div>
            <div style="width:50px; font-size:0.85rem; font-weight:700; color:var(--text-dark);">${formatDurExt(valMs)}</div>
        </div>`;
    });
    if (sortedAggr.length === 0) downtimeChart.innerHTML = '<span style="font-size:0.85rem; color:gray;">All lines running at optimal capacity.</span>';

    // Sidebar: Feed (V2 visual style)
    downtimeFeed.innerHTML = '';
    feedQueue.sort((a,b) => new Date(b.start) - new Date(a.start)); // Latest first
    feedQueue.forEach(dt => {
        const title = dt.reason ? (dt.reason.name || 'Unspecified') : 'Unspecified';
        const type = dt.reason ? (dt.reason.category || 'N/A') : 'N/A';
        const sTimeStr = new Date(dt.start).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:false});
        const eTimeStr = dt.end ? new Date(dt.end).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:false}) : 'Ongoing';
        
        let bColor = 'var(--naue-red)';
        if (type.toLowerCase().includes('minor') || type.toLowerCase().includes('performance')) {
            bColor = 'var(--naue-yellow)';
        }
        if (dt.end) bColor = 'var(--text-gray)';

        downtimeFeed.innerHTML += `
        <div style="background:var(--surface); border:1px solid var(--border); border-left:4px solid ${bColor}; border-radius:6px; padding:16px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.02));">
            <div>
                <div style="font-size:1rem; font-weight:800; color:var(--text-dark); margin-bottom:6px;">${title}</div>
                <div style="font-size:0.85rem; color:var(--text-gray); font-weight:500;">${dt.machineName} &bull; ${type}</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:0.85rem; color:var(--text-dark); font-weight:500; margin-bottom:6px;">${sTimeStr} - ${eTimeStr}</div>
                <div style="font-size:1rem; font-weight:800; color:var(--text-dark);">${formatDurExt(dt.durMs)}</div>
            </div>
        </div>`;
    });
    if (feedQueue.length === 0) downtimeFeed.innerHTML = '<span style="font-size:0.85rem; color:gray;">No incidents recorded in the ledger.</span>';

    lucide.createIcons();
}
