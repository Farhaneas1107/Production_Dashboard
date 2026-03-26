const fs = require('fs');
const https = require('https');

const TOKEN = "aaad4edbd7e57de0f34d035176a52842900d3216";
const BASE_URL = "https://app.enlyze.com/api/v2";

const headers = {
    "Authorization": `Bearer ${TOKEN}`,
    "Content-Type": "application/json"
};

function fetchApi(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const reqOpts = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: headers
        };
        const req = https.request(reqOpts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    console.error("API Error", res.statusCode, data);
                    return resolve(null);
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

async function discover() {
    console.log("Fetching machines...");
    const machinesRes = await fetchApi('/machines');
    if (!machinesRes || !machinesRes.data) {
        console.error("Failed to fetch machines");
        return;
    }
    const machines = machinesRes.data;
    console.log(`Found ${machines.length} machines.`);

    const discovery = {};

    for (const m of machines) {
        console.log(`Fetching variables for machine ${m.name} (${m.uuid})...`);
        const varsRes = await fetchApi(`/variables?machine=${m.uuid}`);
        if (!varsRes || !varsRes.data) continue;
        let vars = varsRes.data;
        let nextCursor = varsRes.metadata?.next_cursor;
        
        while (nextCursor) {
            const nextRes = await fetchApi(`/variables?machine=${m.uuid}&cursor=${encodeURIComponent(nextCursor)}`);
            if (nextRes && nextRes.data) {
                vars = vars.concat(nextRes.data);
                nextCursor = nextRes.metadata?.next_cursor;
            } else {
                nextCursor = null;
            }
        }
        
        console.log(`Found ${vars.length} variables for ${m.name}`);
        discovery[m.uuid] = {
            machine: m,
            variables: vars
        };
    }

    fs.writeFileSync('machines_config.json', JSON.stringify(discovery, null, 2));
    console.log("\nWrote machines_config.json");
}

discover().catch(console.error);
