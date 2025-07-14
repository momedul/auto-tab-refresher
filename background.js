// Map to store refresh states for multiple tabs
const refreshStates = new Map(); // Key: tabId, Value: { alarmName, options, nextRefreshTime, currentInterval, urlListIndex }
let badgeUpdateIntervalId = null; // Interval ID for badge timer updates
let currentActiveBrowserTabId = null; // To track the currently active tab in the browser

// Function to clear a specific refresh state
function clearRefreshState(tabId) {
    if (refreshStates.has(tabId)) {
        const state = refreshStates.get(tabId);
        if (state.alarmName) {
            chrome.alarms.clear(state.alarmName);
        }
        refreshStates.delete(tabId);
        //console.log(`Refresh stopped for tab ${tabId}.`);
        // Notify popup if it's open and tracking this tab
        chrome.runtime.sendMessage({ action: 'refreshStoppedForTab', tabId: tabId }).catch((e) =>{
            //console.log("Popup not open or error sending message:", e)
        });
    }
    updateBadge(); // Update badge after clearing a state
    if (refreshStates.size === 0) {
        // If no more active refreshes, clear global badge interval
        if (badgeUpdateIntervalId) {
            clearInterval(badgeUpdateIntervalId);
            badgeUpdateIntervalId = null;
        }
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] });
        chrome.runtime.sendMessage({ action: 'refreshStoppedAll' }).catch((e) =>{
            //console.log("Popup not open or error sending message:", e)
        });
    }
    saveRefreshStatesToStorage();
}

// Function to clear all refresh states
function clearAllRefreshStates() {
    refreshStates.forEach((value, tabId) => {
        if (value.alarmName) {
            chrome.alarms.clear(value.alarmName);
        }
    });
    refreshStates.clear();
    if (badgeUpdateIntervalId) {
        clearInterval(badgeUpdateIntervalId);
        badgeUpdateIntervalId = null;
    }
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] });
    //console.log('All refreshes stopped and states cleared.');
    chrome.runtime.sendMessage({ action: 'refreshStoppedAll' }).catch((e) =>{
        //console.log("Popup not open or error sending message:", e)
    });
    saveRefreshStatesToStorage();
}

// Function to calculate a random interval
function getRandomInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to format time for badge display with 2 digits for seconds/minutes/hours
function formatTimeForBadge(milliseconds) {
    if (milliseconds < 0) return '00s';

    const totalSeconds = Math.floor(milliseconds / 1000);

    const years = Math.floor(totalSeconds / (365.25 * 24 * 60 * 60));
    const remainingSecondsAfterYears = totalSeconds % (365.25 * 24 * 60 * 60);

    const months = Math.floor(remainingSecondsAfterYears / (30.44 * 24 * 60 * 60));
    const remainingSecondsAfterMonths = remainingSecondsAfterYears % (30.44 * 24 * 60 * 60);

    const days = Math.floor(remainingSecondsAfterMonths / (24 * 60 * 60));
    const remainingSecondsAfterDays = remainingSecondsAfterMonths % (24 * 60 * 60);

    const hours = Math.floor(remainingSecondsAfterDays / (60 * 60));
    const remainingSecondsAfterHours = remainingSecondsAfterDays % (60 * 60);

    const minutes = Math.floor(remainingSecondsAfterHours / 60);
    const seconds = remainingSecondsAfterHours % 60;

    if (years > 0) return `${years}y`;
    if (months > 0) return `${months}M`;
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${String(hours).padStart(2, '0')}h`;
    if (minutes > 0) return `${String(minutes).padStart(2, '0')}m`;
    return `${String(seconds).padStart(2, '0')}s`;
}

// Function to update the extension badge
function updateBadge() {
    // Only show timer if the currently active tab is being refreshed, OR if "refresh all tabs" is active.
    let refreshStateForActiveTab = refreshStates.get(currentActiveBrowserTabId);

    if (refreshStateForActiveTab && !refreshStateForActiveTab.options.refreshAllTabs) {
        // Active tab is being refreshed individually
        const remainingTime = refreshStateForActiveTab.nextRefreshTime - Date.now();
        const formattedTime = formatTimeForBadge(remainingTime);
        chrome.action.setBadgeText({ text: formattedTime });
        chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
    } else if (refreshStates.size > 0 && Array.from(refreshStates.values()).some(state => state.options.refreshAllTabs)) {
        // "Refresh all tabs" is active for at least one refresh, show earliest of those
        let earliestNextRefreshTime = Infinity;
        refreshStates.forEach(state => {
            if (state.options.refreshAllTabs && state.nextRefreshTime < earliestNextRefreshTime) {
                earliestNextRefreshTime = state.nextRefreshTime;
            }
        });
        if (earliestNextRefreshTime !== Infinity) {
            const remainingTime = earliestNextRefreshTime - Date.now();
            const formattedTime = formatTimeForBadge(remainingTime);
            chrome.action.setBadgeText({ text: formattedTime });
            chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
        } else {
            chrome.action.setBadgeText({ text: '' });
            chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] });
        }
    } else {
        // No relevant refresh active for the current tab, or no "refresh all tabs" active
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] });
    }
}

// Function to schedule the next alarm for a specific tab
function scheduleNextAlarmForTab(tabId, options, initialCall = false) {
    // Clear any existing alarm for this specific tab before scheduling a new one
    if (refreshStates.has(tabId)) {
        const existingState = refreshStates.get(tabId);
        if (existingState.alarmName) {
            chrome.alarms.clear(existingState.alarmName);
        }
    }

    let intervalInSeconds;
    let alarmWhen = undefined;

    if (options.useSpecificTime && initialCall) {
        const [hours, minutes] = options.specificTime.split(':').map(Number);
        const now = new Date();
        const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

        if (targetTime.getTime() <= now.getTime()) {
            targetTime.setDate(targetTime.getDate() + 1);
        }
        alarmWhen = targetTime.getTime();
        intervalInSeconds = (alarmWhen - now.getTime()) / 1000;
        //console.log(`Scheduling one-time refresh for tab ${tabId} at ${targetTime.toLocaleString()}`);
    } else {
        if (options.useRandomInterval) {
            intervalInSeconds = getRandomInterval(options.minInterval, options.maxInterval);
        } else {
            intervalInSeconds = options.interval;
        }
        //console.log(`Next refresh interval for tab ${tabId}: ${intervalInSeconds} seconds.`);
    }

    const currentCalculatedInterval = intervalInSeconds;
    const alarmName = `refresh-tab-${tabId}-${Date.now()}`; // Unique name per tab

    const nextRefreshTime = alarmWhen || (Date.now() + (intervalInSeconds * 1000));

    refreshStates.set(tabId, {
        alarmName: alarmName,
        options: options,
        nextRefreshTime: nextRefreshTime,
        currentInterval: currentCalculatedInterval,
        urlListIndex: 0 // Reset index when starting/rescheduling
    });

    if (alarmWhen) {
        chrome.alarms.create(alarmName, { when: alarmWhen });
    } else {
        chrome.alarms.create(alarmName, { periodInMinutes: intervalInSeconds / 60 });
    }

    // Ensure badge update interval is running
    if (!badgeUpdateIntervalId) {
        badgeUpdateIntervalId = setInterval(updateBadge, 1000);
    }
    updateBadge(); // Initial badge update

    saveRefreshStatesToStorage();

    // Send update to popup if it's open and tracking this tab
    chrome.runtime.sendMessage({
        action: 'updateCountdown',
        tabId: tabId,
        nextRefreshTime: nextRefreshTime,
        currentInterval: currentCalculatedInterval
    }).catch((e) =>{
        //console.log("Popup not open or error sending message:", e)
    });

    // Notify popup that a refresh has started for a specific tab
    chrome.runtime.sendMessage({ action: 'refreshStartedForTab', tabId: tabId }).catch((e) => {
        //console.log("Popup not open or error sending message:", e)
    });
}

// Function to save refresh states to chrome.storage.local
function saveRefreshStatesToStorage() {
    const serializableRefreshStates = Array.from(refreshStates.entries()).map(([tabId, state]) => ({
        tabId: tabId,
        alarmName: state.alarmName,
        options: state.options,
        nextRefreshTime: state.nextRefreshTime,
        currentInterval: state.currentInterval,
        urlListIndex: state.urlListIndex
    }));
    chrome.storage.local.set({ activeRefreshes: serializableRefreshStates });
}

// Listener for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startRefresh') {
        const options = request.options;

        if (options.refreshAllTabs) {
            chrome.tabs.query({}, (tabs) => {
                clearAllRefreshStates(); // Clear existing single tab refreshes if starting all tabs
                tabs.forEach(tab => {
                    // Only start refresh for valid tabs (e.g., http/https)
                    if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                        scheduleNextAlarmForTab(tab.id, options, true);
                    }
                });
                sendResponse({ success: true, nextRefreshTime: refreshStates.size > 0 ? Array.from(refreshStates.values()).reduce((min, s) => Math.min(min, s.nextRefreshTime), Infinity) : null, currentInterval: null });
            });
            return true; // Indicate async response
        } else {
            // Start refresh for a single specific tab
            const tabId = request.tabId;
            if (tabId) {
                scheduleNextAlarmForTab(tabId, options, true);
                const state = refreshStates.get(tabId);
                sendResponse({ success: true, nextRefreshTime: state.nextRefreshTime, currentInterval: state.currentInterval });
            } else {
                sendResponse({ success: false, message: 'No active tab ID provided for single tab refresh.' });
            }
        }
    } else if (request.action === 'stopRefresh') {
        if (request.refreshAllTabs) {
            clearAllRefreshStates();
            sendResponse({ success: true });
        } else {
            const tabId = request.tabId;
            if (tabId) {
                clearRefreshState(tabId);
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, message: 'No tab ID provided to stop refresh.' });
            }
        }
    } else if (request.action === 'getTabRefreshStatus') {
        const tabId = request.tabId;
        if (refreshStates.has(tabId)) {
            const state = refreshStates.get(tabId);
            sendResponse({
                isRefreshing: true,
                refreshOptions: state.options,
                nextRefreshTime: state.nextRefreshTime,
                currentInterval: state.currentInterval
            });
        } else {
            sendResponse({ isRefreshing: false });
        }
    } else if (request.action === 'getAllRefreshStatuses') {
        const serializableRefreshStates = Array.from(refreshStates.entries()).map(([tabId, state]) => ({
            tabId: tabId,
            options: state.options,
            nextRefreshTime: state.nextRefreshTime,
            currentInterval: state.currentInterval
        }));
        sendResponse({ activeRefreshes: serializableRefreshStates });
    } else if (request.action === 'clearRefreshStateForTab') {
        // This action is called by popup.js if it detects a tab is gone
        clearRefreshState(request.tabId);
        sendResponse({ success: true });
    }
    return true; // Indicate that sendResponse will be called asynchronously
});

// Listener for alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
    // Find the tabId associated with this alarm
    let triggeredTabId = null;
    refreshStates.forEach((state, tabId) => {
        if (state.alarmName === alarm.name) {
            triggeredTabId = tabId;
        }
    });

    if (triggeredTabId !== null) {
        const state = refreshStates.get(triggeredTabId);
        if (!state) return; // Should not happen if logic is sound

        const options = state.options;

        // If it was a specific time alarm, and not periodic, clear it after first trigger
        if (options.useSpecificTime && !options.interval && !options.useRandomInterval) {
            clearRefreshState(triggeredTabId);
            //console.log(`One-time specific time refresh completed for tab ${triggeredTabId}.`);
            return;
        }

        chrome.tabs.get(triggeredTabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                //console.error(`Tab ${triggeredTabId} not found or error:`, chrome.runtime.lastError);
                clearRefreshState(triggeredTabId); // Stop refreshing if tab is gone
                return;
            }

            // 1. Hostname Filter
            const tabHostname = new URL(tab.url).hostname;
            if (options.hostnameFilter && !tabHostname.includes(options.hostnameFilter)) {
                //console.log(`Skipping refresh for tab ${triggeredTabId}: Hostname '${tabHostname}' does not match filter '${options.hostnameFilter}'.`);
                // If hostname doesn't match, still reschedule if periodic, but don't perform refresh action
                scheduleNextAlarmForTab(triggeredTabId, options, false);
                return;
            }

            // 2. Click Element before refresh
            if (options.clickElement && options.cssSelector) {
                chrome.scripting.executeScript({
                    target: { tabId: triggeredTabId },
                    function: (selector) => {
                        try {
                            const element = document.querySelector(selector);
                            if (element) {
                                element.click();
                                //console.log(`Clicked element with selector: ${selector}`);
                            } else {
                                //console.warn(`Element with selector '${selector}' not found.`);
                            }
                        } catch (e) {
                            //console.error(`Error clicking element: ${e.message}`);
                        }
                    },
                    args: [options.cssSelector]
                }).catch((e) => {
                    //console.error("Scripting API error:", e)
                });
            }

            // 3. Refresh to URL from a list
            if (options.useUrlList && options.urlList && options.urlList.length > 0) {
                const targetUrl = options.urlList[state.urlListIndex];
                chrome.tabs.update(triggeredTabId, { url: targetUrl }, () => {
                    if (chrome.runtime.lastError) {
                        //console.error(`Failed to navigate tab ${triggeredTabId} to ${targetUrl}:`, chrome.runtime.lastError);
                    } else {
                        //console.log(`Tab ${triggeredTabId} navigated to ${targetUrl} at ${new Date().toLocaleTimeString()}`);
                    }
                });
                state.urlListIndex = (state.urlListIndex + 1) % options.urlList.length; // Cycle through list
            } else {
                // 4. Standard Refresh (with or without cache clear)
                chrome.tabs.reload(triggeredTabId, { bypassCache: options.clearCache }, () => {
                    if (chrome.runtime.lastError) {
                        //console.error(`Failed to reload tab ${triggeredTabId}:`, chrome.runtime.lastError);
                        clearRefreshState(triggeredTabId); // Stop if reload fails
                    } else {
                        //console.log(`Tab ${triggeredTabId} reloaded${options.clearCache ? ' (cache cleared)' : ''} at ${new Date().toLocaleTimeString()}`);
                    }
                });
            }

            // 5. Show Notification
            if (options.showNotification) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'Auto Tab Refresher',
                    message: `Tab "${tab.title || tab.url}" refreshed!`,
                    priority: 1
                });
            }

            // 6. Activate the tab (only if it was the active tab when refresh started and not refreshing all)
            // The `active` property is only set if it's a single tab refresh AND it was the currently active tab.
            // If it's a background tab being refreshed, it will stay in the background.
            // If it's "refresh all tabs", no tab is explicitly activated.
            if (!options.refreshAllTabs && tab.active) {
                 chrome.tabs.update(triggeredTabId, { active: true }).catch((e) => {
                    //console.error("Error activating tab:", e)
                });
            }

            // Reschedule the alarm for the next cycle if not a one-time specific time refresh
            if (!options.useSpecificTime || (options.useSpecificTime && (options.interval || options.useRandomInterval))) {
                scheduleNextAlarmForTab(triggeredTabId, options, false);
            }
        });
    }
});

// --- Event Listeners for Browser/Tab Lifecycle ---

// On tab created: (Optional: could add logic to auto-start refresh for new tabs based on rules)
chrome.tabs.onCreated.addListener((tab) => {
    //console.log(`Tab created: ${tab.id}, URL: ${tab.url}`);
    // No action by default, but could check if new tabs should be auto-refreshed
});

// On tab updated (e.g., URL change, loading complete)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // If a tab is loading/complete, re-evaluate its refresh status if it's currently being refreshed
    if (refreshStates.has(tabId) && changeInfo.status === 'complete') {
        const state = refreshStates.get(tabId);
        const options = state.options;

        // If hostname filter is active, check if the new URL still matches
        if (options.hostnameFilter && !(new URL(tab.url).hostname.includes(options.hostnameFilter))) {
            //console.log(`Tab ${tabId} URL changed and no longer matches hostname filter. Stopping refresh.`);
            clearRefreshState(tabId);
        }
        // Could also add logic here to re-align next refresh time if a manual refresh occurred
    }
    //console.log(`Tab updated: ${tabId}, Status: ${changeInfo.status}, URL: ${tab.url}`);
});

// On tab removed (closed)
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    clearRefreshState(tabId); // Clear refresh for the closed tab
    //console.log(`Tab removed: ${tabId}`);
});

// On tab activated (focused)
chrome.tabs.onActivated.addListener((activeInfo) => {
    //console.log(`Tab activated: ${activeInfo.tabId}`);
    currentActiveBrowserTabId = activeInfo.tabId; // Update the globally tracked active tab ID
    updateBadge(); // Update badge when active tab changes
});

// On browser window opened (implies new session or new window)
chrome.windows.onCreated.addListener((window) => {
    //console.log(`Window created: ${window.id}`);
    // This can be useful for logging or setting up initial states for new windows.
});

// On browser startup (when the browser is launched)
chrome.runtime.onStartup.addListener(() => {
    //console.log('Browser started up. Attempting to restore refresh states...');
    chrome.storage.local.get(['activeRefreshes'], (result) => {
        if (result.activeRefreshes && Array.isArray(result.activeRefreshes)) {
            result.activeRefreshes.forEach(savedState => {
                // Re-schedule alarms for each saved refresh state
                // Need to ensure the tab still exists before scheduling
                chrome.tabs.get(savedState.tabId, (tab) => {
                    if (chrome.runtime.lastError || !tab) {
                        //console.warn(`Tab ${savedState.tabId} not found on startup, skipping restore.`);
                        return;
                    }
                    // Re-calculate next refresh time to ensure accuracy after restart
                    const now = Date.now();
                    let newNextRefreshTime = savedState.nextRefreshTime;
                    let newCurrentInterval = savedState.currentInterval;

                    if (savedState.options.useSpecificTime) {
                        const [hours, minutes] = savedState.options.specificTime.split(':').map(Number);
                        const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
                        if (targetTime.getTime() <= now) {
                            targetTime.setDate(targetTime.getDate() + 1); // Schedule for tomorrow if past
                        }
                        newNextRefreshTime = targetTime.getTime();
                        newCurrentInterval = (newNextRefreshTime - now) / 1000;
                    } else {
                        // For periodic, just reschedule from now with the same interval
                        newNextRefreshTime = now + (savedState.currentInterval * 1000);
                    }

                    // Recreate the alarm
                    const alarmName = `refresh-tab-${savedState.tabId}-${Date.now()}`;
                    if (savedState.options.useSpecificTime) {
                        chrome.alarms.create(alarmName, { when: newNextRefreshTime });
                    } else {
                        chrome.alarms.create(alarmName, { periodInMinutes: newCurrentInterval / 60 });
                    }

                    refreshStates.set(savedState.tabId, {
                        alarmName: alarmName,
                        options: savedState.options,
                        nextRefreshTime: newNextRefreshTime,
                        currentInterval: newCurrentInterval,
                        urlListIndex: savedState.urlListIndex // Restore URL list index
                    });
                    //console.log(`Restored refresh for tab ${savedState.tabId}.`);
                });
            });
            // Start badge update after all states are potentially restored
            if (refreshStates.size > 0 && !badgeUpdateIntervalId) {
                badgeUpdateIntervalId = setInterval(updateBadge, 1000);
                updateBadge();
            }
        }
    });
});
