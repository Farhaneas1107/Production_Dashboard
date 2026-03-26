const EnlyzeAPI = {
    getLiveData: async () => {
        try {
            // Adds a timestamp to bypass browser caching
            const res = await fetch('./live_data.json?t=' + new Date().getTime());
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error("Local data sync not ready yet...", e);
            return null;
        }
    }
};
