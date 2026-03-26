# Production Dashboard

A local-first manufacturing shift report dashboard for visualizing timeseries data, machine setpoints, and production orders from the ENLYZE platform.

## Project Structure

| File | Description |
|------|-------------|
| `index_v4.html` | Latest dashboard (V4) |
| `app_v4.js` | Dashboard logic (V4) |
| `index_v4.css` | Dashboard styles (V4) |
| `api.js` | ENLYZE API connector |
| `shiftLogic.js` | Shift time calculations |
| `mockData.js` | Mock data for offline testing |
| `serve.ps1` | Local HTTP server script |
| `host_network.ps1` | Network-accessible server script |
| `fetchData.ps1` | Data fetching utility |
| `extract_timeseries.ps1` | Timeseries data extraction |
| `extract_micro_metrics.js` | Micro metrics extraction |

## Running Locally

```powershell
.\serve.ps1
```

Open `http://localhost:8080` in your browser.

## Network Access

```powershell
.\host_network.ps1
```

## Data Files

> `live_data.json` and `machines_config.json` are excluded from Git (local only).
