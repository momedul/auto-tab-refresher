// background.js
let currentRefreshAlarm = null;
let currentRefreshTabId = null;
let currentRefreshInterval = null;

// Function to clear any existing alarm
function clearExistingAlarm() {
    if (currentRefreshAlarm) {
        chrome.alarms.clear(currentRefreshAlarm.name);
        currentRefreshAlarm = null;
    }
    currentRefreshTabId = null;
    currentRefreshInterval = null;
    chrome.storage.local.set({ isRefreshing: false, refreshTabId: null, refreshInterval: null });
}

// Listener for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startRefresh') {
        clearExistingAlarm(); // Clear any previous refresh

        const intervalInMinutes = request.interval / 60; // Alarms work best with minutes
        const alarmName = `refresh-tab-${request.tabId}`;

        chrome.alarms.create(alarmName, { periodInMinutes: intervalInMinutes });

        currentRefreshAlarm = { name: alarmName, periodInMinutes: intervalInMinutes };
        currentRefreshTabId = request.tabId;
        currentRefreshInterval = request.interval;

        // Store status in local storage
        chrome.storage.local.set({
            isRefreshing: true,
            refreshTabId: currentRefreshTabId,
            refreshInterval: currentRefreshInterval
        });

        console.log(`Started refreshing tab ${currentRefreshTabId} every ${currentRefreshInterval} seconds.`);
        sendResponse({ success: true });

    } else if (request.action === 'stopRefresh') {
        clearExistingAlarm();
        console.log('Stopped refreshing.');
        sendResponse({ success: true });
    }
    // Return true to indicate that sendResponse will be called asynchronously
    return true;
});

// Listener for alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
    if (currentRefreshAlarm && alarm.name === currentRefreshAlarm.name) {
        if (currentRefreshTabId) {
            chrome.tabs.get(currentRefreshTabId, (tab) => {
                if (chrome.runtime.lastError || !tab) {
                    console.error(`Tab ${currentRefreshTabId} not found or error:`, chrome.runtime.lastError);
                    clearExistingAlarm(); // Stop refreshing if tab is gone
                    return;
                }
                // Check if the tab is still active and in the current window (optional, but good for focus)
                // For a general tab refresher, we just refresh it regardless of its active state
                chrome.tabs.reload(currentRefreshTabId, () => {
                    if (chrome.runtime.lastError) {
                        console.error(`Failed to reload tab ${currentRefreshTabId}:`, chrome.runtime.lastError);
                        // If reload fails, it might mean the tab was closed. Clear the alarm.
                        clearExistingAlarm();
                    } else {
                        console.log(`Tab ${currentRefreshTabId} reloaded at ${new Date().toLocaleTimeString()}`);
                    }
                });
            });
        } else {
            console.log('No tab ID found for refresh. Clearing alarm.');
            clearExistingAlarm();
        }
    }
});

// Listen for tab removals to stop refreshing if the tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (currentRefreshTabId === tabId) {
        console.log(`Target tab ${tabId} was closed. Stopping refresh.`);
        clearExistingAlarm();
    }
});

// Listen for tab updates (e.g., URL change) - optional, but can be useful
// If the user navigates away from the page they wanted to refresh, you might want to stop.
// For this basic version, we'll keep refreshing the tab ID.
// If you want to stop on URL change, you'd add logic here to check tab.url and clear alarm.

// On extension startup, try to restore previous state
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['isRefreshing', 'refreshTabId', 'refreshInterval'], (result) => {
        if (result.isRefreshing && result.refreshTabId && result.refreshInterval) {
            const intervalInMinutes = result.refreshInterval / 60;
            const alarmName = `refresh-tab-${result.refreshTabId}`;
            chrome.alarms.create(alarmName, { periodInMinutes: intervalInMinutes });
            currentRefreshAlarm = { name: alarmName, periodInMinutes: intervalInMinutes };
            currentRefreshTabId = result.refreshTabId;
            currentRefreshInterval = result.refreshInterval;
            console.log(`Restored refresh for tab ${currentRefreshTabId} every ${currentRefreshInterval} seconds.`);
        }
    });
});
