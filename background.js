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



// add blocker
(function(){

// background.js

// Define the URL for the adblock filter list
const FILTER_LIST_URL = "https://ublockorigin.github.io/uAssets/filters/filters.min.txt";
const FILTER_REFRESH_INTERVAL_MINUTES = 24 * 60; // Refresh interval in minutes (24 hours)
const MAX_DNR_RULES = chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES || 5000; // Max rules Chrome allows

// Global array to store declarativeNetRequest rule objects
let adblockRules = [];
let isBlockingActive = true; // Default state: adblocker is active

// Hardcoded rules for common ad platforms (Google, Meta, YouTube)
// These rules are given a higher priority (2) to ensure they are applied first.
const HARDCODED_AD_RULES = [
  // Google Ads
  {
    id: 900001,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://adservice.google.com/*",
      resourceTypes: ["main_frame", "sub_frame", "script", "image", "media", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900002,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://pagead2.googlesyndication.com/*",
      resourceTypes: ["main_frame", "sub_frame", "script", "image", "media", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900003,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://googleadservices.com/*",
      resourceTypes: ["main_frame", "sub_frame", "script", "image", "media", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900004,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://tpc.googlesyndication.com/*",
      resourceTypes: ["main_frame", "sub_frame", "script", "image", "media", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900005,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://googlesyndication.com/*", // Broader match
      resourceTypes: ["main_frame", "sub_frame", "script", "image", "media", "xmlhttprequest", "other"]
    }
  },
    {
    id: 900006,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://ad.doubleclick.net/*", // DoubleClick (Google's ad serving platform)
      resourceTypes: ["main_frame", "sub_frame", "script", "image", "media", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900007,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://static.doubleclick.net/*",
      resourceTypes: ["script", "image", "media", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900008,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://r.youtube.com/ads/*", // YouTube ads
      resourceTypes: ["media", "other"]
    }
  },

  // Meta (Facebook/Instagram) Ads
  // Meta (Facebook/Instagram) Ads
  {
    id: 900009,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://connect.facebook.net/*", // Facebook Pixel/SDK related to ads
      resourceTypes: ["script", "other"]
    }
  },
  {
    id: 9000010,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://www.facebook.com/ads/*", // Direct Facebook ad content
      resourceTypes: ["main_frame", "sub_frame", "image", "media", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900011,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://pixel.facebook.com/*", // Facebook tracking pixel
      resourceTypes: ["image", "script", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900012,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://static.xx.fbcdn.net/rsrc.php/*/r/FB_ADS_*", // Facebook ad resources
      resourceTypes: ["image", "script", "media", "other"]
    }
  },

  // Amazon Ads
  {
    id: 900013,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://fls-na.amazon.com/*", // Amazon advertising/tracking
      resourceTypes: ["script", "image", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900014,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://m.media-amazon.com/images/I/*_SL*.*", // Amazon sponsored product images (often have specific URL patterns)
      resourceTypes: ["image"]
    }
  },
  {
    id: 900015,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://ir-na.amazon-adsystem.com/*", // Amazon ad system
      resourceTypes: ["script", "image", "media", "xmlhttprequest", "other"]
    }
  },

  // Other common ad/tracking domains (examples, a real list is much longer)
  {
    id: 900016,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://ad.yieldmanager.com/*", // Generic ad network example
      resourceTypes: ["script", "image", "media", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900017,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://quantserve.com/*", // Analytics/tracking, often related to ads
      resourceTypes: ["script", "image", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900018,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://scorecardresearch.com/*", // Market research, often linked to ad measurement
      resourceTypes: ["script", "image", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900019,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://securepubads.g.doubleclick.net/*", // Google Publisher Tag (GPT) for DFP/Ad Manager
      resourceTypes: ["script", "image", "media", "xmlhttprequest", "other"]
    }
  },

  // YouTube Ads
  // YouTube Ads (Enhanced Blocking)
  {
    id: 900020,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://*.youtube.com/api/ads/*",
      resourceTypes: ["main_frame", "sub_frame", "script", "image", "media", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900021,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://*.youtube.com/pagead/*",
      resourceTypes: ["main_frame", "sub_frame", "script", "image", "media", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900022,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: "*://*.youtube.com/ptracking/*", // YouTube ad tracking
      resourceTypes: ["main_frame", "sub_frame", "script", "image", "media", "xmlhttprequest", "other"]
    }
  },
  {
    id: 900023,
    priority: 2,
    action: { type: "block" },
    condition: {
      // More specific pattern for video ads from googlevideo.com
      urlFilter: "*://*.googlevideo.com/videoplayback?*adformat=*,*adtag=*,*ctier=*,*ei=*,*dur=*,*plid=*",
      resourceTypes: ["media"]
    }
  },
  {
    id: 900024,
    priority: 2,
    action: { type: "block" },
    condition: {
      // Blocking common YouTube ad segments in video manifest/playlist requests
      urlFilter: "*://*.youtube.com/api/timedtext?*v=*,*ad=*",
      resourceTypes: ["xmlhttprequest", "other"]
    }
  },
  {
    id: 900025,
    priority: 2,
    action: { type: "block" },
    condition: {
      // Blocking common YouTube ad segments in video manifest/playlist requests
      urlFilter: "*://*.youtube.com/get_video_info?*ad=*",
      resourceTypes: ["xmlhttprequest", "other"]
    }
  },
  {
    id: 900026,
    priority: 2,
    action: { type: "block" },
    condition: {
      // Blocking YouTube ad-related scripts
      urlFilter: "*://*.youtube.com/yts/jsbin/player-*.js?*ads*",
      resourceTypes: ["script"]
    }
  },
  {
    id: 900027,
    priority: 2,
    action: { type: "block" },
    condition: {
      // Blocking YouTube ad-related manifest requests
      urlFilter: "*://*.youtube.com/s/player/*.js",
      resourceTypes: ["script"],
      // Exclude if it's not an ad-related script
      excludedInitiatorDomains: ["youtube.com"], // This is a placeholder, actual exclusion logic might be complex
      urlFilter: "*://*.youtube.com/s/player/*.js?*ad_module=1*" // More specific to ad modules
    }
  },
  {
    id: 900028,
    priority: 2,
    action: { type: "block" },
    condition: {
      // Blocking YouTube ad-related manifest requests
      urlFilter: "*://*.youtube.com/api/stats/ads*",
      resourceTypes: ["xmlhttprequest", "ping", "other"]
    }
  }
];


/**
 * Converts an Adblock Plus style filter rule into a declarativeNetRequest urlFilter pattern.
 * This is a simplified conversion and does not cover all ABP syntax or regex capabilities.
 * It focuses on common blocking patterns for URL matching.
 *
 * @param {string} filter The ABP filter rule string.
 * @returns {string|null} A urlFilter string if successful, otherwise null.
 */
function convertFilterToUrlFilter(filter) {
  let urlFilter = filter;

  // Handle ||domain^ (matches domain and its subdomains)
  // Example: ||example.com^  ->  *://*.example.com/*
  if (urlFilter.startsWith('||')) {
    urlFilter = urlFilter.substring(2); // Remove '||'
    // Remove trailing '^' if present, as it's not directly supported in urlFilter glob
    if (urlFilter.endsWith('^')) {
      urlFilter = urlFilter.slice(0, -1);
    }
    // Convert to glob pattern for domain and subdomains
    urlFilter = `*://*.${urlFilter}/*`;
  }
  // Handle |path (matches beginning of URL)
  // Example: |/ads/ -> */ads/*
  else if (urlFilter.startsWith('|')) {
    urlFilter = urlFilter.substring(1); // Remove '|'
    // Convert to glob pattern for path. This is a simplification.
    // A strict | means "start of URL", which is often covered by the full URL match.
    // For paths, using * at the start and end is a common compromise for urlFilter.
    urlFilter = `*${urlFilter}*`;
  }
  // Handle ^ (separator character) - simplified to wildcard for urlFilter
  // In ABP, ^ matches anything but a letter, digit, or underscore, or the end of the address.
  // For urlFilter, treating it as a wildcard is a compromise for broader matching.
  urlFilter = urlFilter.replace(/\^/g, '*');

  // Handle * (wildcard) - already compatible with urlFilter glob, no change needed.

  // No aggressive stripping of characters. urlFilter uses glob, not regex,
  // so characters like '.', '-', '_' are treated literally unless they are glob wildcards.

  // Basic validation: ensure the filter is not empty or just whitespace after conversion
  if (urlFilter.trim().length === 0) {
    return null;
  }

  return urlFilter;
}

/**
 * Processes the raw filter list text into declarativeNetRequest rule objects.
 * This function attempts to translate ABP syntax to DNR rules, but is simplified.
 *
 * @param {string} text The raw filter list content.
 * @param {number} startId The starting ID for the generated rules.
 * @param {number} maxRulesToGenerate The maximum number of rules to generate from this text.
 * @returns {Array<chrome.declarativeNetRequest.Rule>} An array of DNR rule objects.
 */
function processFilterText(text, startId, maxRulesToGenerate) {
  const newRules = [];
  const lines = text.split('\n');
  let ruleIdCounter = startId;

  for (const line of lines) {
    // Stop if we've reached the maximum number of rules for this batch
    if (newRules.length >= maxRulesToGenerate) {
      //console.warn(`Reached maximum rules (${maxRulesToGenerate}) for fetched filter list. Truncating.`);
      break;
    }

    const trimmedLine = line.trim();

    // Skip empty lines, comments, and specific complex rules not easily translated.
    // Lines with '!' are comments. Lines starting with '[' are often headers.
    // Lines with '$' often contain ABP options (e.g., $script, $domain, $third-party)
    // or element hiding rules ('#') which are not directly supported by simple
    // declarativeNetRequest urlFilter blocking without content scripts or more complex rule logic.
    if (!trimmedLine || trimmedLine.startsWith('!') || trimmedLine.startsWith('[') ||
        trimmedLine.includes('#') || trimmedLine.includes('$')) {
      continue;
    }

    // Handle whitelist rules (@@) - these will not be added as block rules.
    // For declarativeNetRequest, whitelisting is often handled by not creating a block rule
    // or by having allow rules with higher priority (which is not implemented in this simplified version).
    if (trimmedLine.startsWith('@@')) {
      continue;
    }

    // Convert blocking rules
    const urlFilter = convertFilterToUrlFilter(trimmedLine);
    if (urlFilter) {
      // Basic validation to prevent invalid urlFilters
      if (urlFilter.length > 0 && !urlFilter.includes(' ')) { // Simple check for empty or spaces
        newRules.push({
          id: ruleIdCounter++,
          priority: 1, // Fetched rules have lower priority than hardcoded
          action: { type: "block" },
          condition: {
            urlFilter: urlFilter,
            // Common resource types to block. This can be expanded based on filter analysis.
            resourceTypes: [
              "main_frame", "sub_frame", "stylesheet", "script", "image",
              "font", "media", "websocket", "xmlhttprequest", "ping",
              "csp_report", "other"
            ]
          }
        });
        // Uncomment the line below for debugging to see generated rules
        // //console.log(`ABP Filter: "${trimmedLine}" -> URL Filter: "${urlFilter}"`);
      } else {
        //console.warn(`Skipping invalid URL filter generated from ABP rule: "${trimmedLine}" -> "${urlFilter}"`);
      }
    }
  }
  return newRules;
}

/**
 * Fetches the adblock filter list, parses it, and saves it to local storage.
 * It also prepares the declarativeNetRequest rules and updates them.
 */
async function fetchAndParseFilterList() {
  //console.log("Attempting to fetch adblock filter list...");
  try {
    const response = await fetch(FILTER_LIST_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    //console.log("Filter list fetched successfully. Saving to storage and processing...");

    // Save the fetched text and timestamp to local storage
    await chrome.storage.local.set({
      adblockFilterList: text,
      lastFetchedTimestamp: Date.now()
    });

    // Calculate how many fetched rules we can add after hardcoded rules
    const remainingRuleCapacity = MAX_DNR_RULES - HARDCODED_AD_RULES.length;
    if (remainingRuleCapacity < 0) {
        //console.error("Hardcoded rules exceed MAX_DNR_RULES. No space for fetched rules.");
        adblockRules = HARDCODED_AD_RULES; // Only use hardcoded rules
    } else {
        // Process the text into declarativeNetRequest rules, starting IDs after hardcoded rules
        // and limiting to remaining capacity.
        const fetchedRules = processFilterText(text, HARDCODED_AD_RULES.length + 1, remainingRuleCapacity);
        adblockRules = [...HARDCODED_AD_RULES, ...fetchedRules];
    }

    //console.log(`Total prepared declarativeNetRequest rules: ${adblockRules.length} (Hardcoded: ${HARDCODED_AD_RULES.length}, Fetched: ${adblockRules.length - HARDCODED_AD_RULES.length}).`);

    // Update the declarativeNetRequest rules in Chrome
    await updateDeclarativeNetRequestRules();

  } catch (error) {
    //console.error("Failed to fetch or parse filter list:", error);
    // Optionally, implement retry logic or notify user if critical
  }
}

/**
 * Updates the declarativeNetRequest rules in Chrome based on the current
 * `isBlockingActive` state and the `adblockRules` array.
 */
async function updateDeclarativeNetRequestRules() {
  try {
    // Get existing dynamic rules to remove them first
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map(rule => rule.id);

    // Remove all existing dynamic rules to prevent duplicates and ensure a clean state
    if (existingRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds
      });
      //console.log(`Removed ${existingRuleIds.length} existing dynamic rules.`);
    }

    // Add new rules if blocking is active and there are rules to add
    if (isBlockingActive && adblockRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: adblockRules
      });
      //console.log(`Added ${adblockRules.length} dynamic rules.`);
    } else {
      //console.log("Adblocker is inactive or no rules to add, no rules were added.");
    }
  } catch (error) {
    //console.error("Error updating declarativeNetRequest rules:", error);
  }
}

// Listen for messages from the popup script to toggle adblocker state
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'toggleAdblock') {
        isBlockingActive = request.isBlockingActive;
        //console.log(`Adblocker is now ${isBlockingActive ? 'active' : 'inactive'}.`);
        await updateDeclarativeNetRequestRules(); // Update rules immediately when state changes
    }
});

/**
 * Initializes the adblocker: loads state from storage, attempts to use cached
 * filter list, or fetches a new one, and sets up the periodic refresh alarm.
 */
async function initializeAdblocker() {
    // Load blocking active state and cached filter list from storage
    const storageResult = await chrome.storage.local.get(['isBlockingActive', 'adblockFilterList', 'lastFetchedTimestamp']);
    isBlockingActive = storageResult.isBlockingActive !== false; // Default to true if not set
    //console.log(`Adblocker initialized to ${isBlockingActive ? 'active' : 'inactive'}.`);

    const storedFilterList = storageResult.adblockFilterList;
    const lastFetchedTimestamp = storageResult.lastFetchedTimestamp;
    const twentyFourHoursInMs = FILTER_REFRESH_INTERVAL_MINUTES * 60 * 1000;

    // Check if a stored filter list exists and is relatively fresh
    if (storedFilterList && lastFetchedTimestamp && (Date.now() - lastFetchedTimestamp < twentyFourHoursInMs)) {
        //console.log("Using cached filter list.");
        // Calculate how many fetched rules we can add after hardcoded rules
        const remainingRuleCapacity = MAX_DNR_RULES - HARDCODED_AD_RULES.length;
        if (remainingRuleCapacity < 0) {
            //console.error("Hardcoded rules exceed MAX_DNR_RULES. No space for fetched rules.");
            adblockRules = HARDCODED_AD_RULES; // Only use hardcoded rules
        } else {
            const fetchedRules = processFilterText(storedFilterList, HARDCODED_AD_RULES.length + 1, remainingRuleCapacity);
            adblockRules = [...HARDCODED_AD_RULES, ...fetchedRules];
        }
        //console.log(`Total parsed declarativeNetRequest rules from cache: ${adblockRules.length} (Hardcoded: ${HARDCODED_AD_RULES.length}, Fetched: ${adblockRules.length - HARDCODED_AD_RULES.length}).`);
    } else {
        //console.log("Cached filter list not found or expired. Fetching new list.");
        // fetchAndParseFilterList will also call updateDeclarativeNetRequestRules
        await fetchAndParseFilterList();
    }

    // Ensure rules are set based on initial state after loading/fetching
    await updateDeclarativeNetRequestRules();

    // Set up an alarm to periodically refresh the filter list
    // Clear any existing alarm first to prevent duplicates
    chrome.alarms.clear('refreshFilterList', (wasCleared) => {
        if (wasCleared) {
            //console.log("Cleared existing 'refreshFilterList' alarm.");
        }
        chrome.alarms.create('refreshFilterList', {
            periodInMinutes: FILTER_REFRESH_INTERVAL_MINUTES
        });
        //console.log(`Scheduled filter list refresh every ${FILTER_REFRESH_INTERVAL_MINUTES} minutes.`);
    });
}

// Listen for the alarm to trigger a filter list refresh
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'refreshFilterList') {
        //console.log("Alarm triggered: Refreshing filter list.");
        fetchAndParseFilterList(); // This will also update rules
    }
});

// Initialize the adblocker when the service worker starts
initializeAdblocker();


})();