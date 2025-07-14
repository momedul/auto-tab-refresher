document.addEventListener('DOMContentLoaded', () => {
    const intervalInput = document.getElementById('interval');
    const randomIntervalToggle = document.getElementById('randomIntervalToggle');
    const randomIntervalFields = document.getElementById('randomIntervalFields');
    const minIntervalInput = document.getElementById('minInterval');
    const maxIntervalInput = document.getElementById('maxInterval');
    const specificTimeToggle = document.getElementById('specificTimeToggle');
    const specificTimeField = document.getElementById('specificTimeField');
    const refreshTimeInput = document.getElementById('refreshTime');
    const hostnameFilterInput = document.getElementById('hostnameFilter');
    const clearCacheCheckbox = document.getElementById('clearCache');
    const showNotificationCheckbox = document.getElementById('showNotification');
    const refreshAllTabsCheckbox = document.getElementById('refreshAllTabs');
    const refreshByUrlListToggle = document.getElementById('refreshByUrlListToggle');
    const urlListFields = document.getElementById('urlListFields');
    const urlListTextarea = document.getElementById('urlList');
    const clickElementToggle = document.getElementById('clickElementToggle');
    const clickElementFields = document.getElementById('clickElementFields');
    const cssSelectorInput = document.getElementById('cssSelector');
    const startButton = document.getElementById('startRefresh');
    const stopButton = document.getElementById('stopRefresh');
    const statusMessage = document.getElementById('statusMessage');
    const countdownDisplay = document.getElementById('countdownDisplay');
    const currentTabUrlCopy = document.getElementById('currentTabUrlCopy');
    const currentTabUrlDisplay = document.getElementById('currentTabUrlDisplay');
    const activeTabsList = document.getElementById('activeTabsList');
    const tabItems = document.getElementsByClassName('tab-item');
    const tabContents = document.getElementsByClassName('tab-content');
    const advancedFilters = document.getElementById('advancedFilters');
    const advancedFiltersWrapper = document.getElementById('advancedFiltersWrapper');
    const advancedFiltersToggle = document.getElementById('advancedFiltersToggle');
    const hostnameFilterToggle = document.getElementById('hostnameFilterToggle');
    const hostnameFilterFields = document.getElementById('hostnameFilterFields');
    const activesTabCount = document.getElementById('activesTabCount');

    let countdownIntervalId = null;
    let currentActiveTabId = null; // To keep track of the tab the popup is currently focused on
    let activeTabsListCountdown = null;

    // Function to get and display current tab ID and load its refresh status
    const initializePopup = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                currentActiveTabId = tabs[0].id;
                currentTabUrlDisplay.textContent = tabs[0].url;

                // Request the refresh status for this specific tab from the background script
                chrome.runtime.sendMessage({ action: 'getTabRefreshStatus', tabId: currentActiveTabId }, (response) => {
                    if (response && response.isRefreshing) {
                        // Populate UI with this tab's specific refresh settings
                        const options = response.refreshOptions;
                        intervalInput.value = options.interval || 60;
                        randomIntervalToggle.checked = options.useRandomInterval || false;
                        minIntervalInput.value = options.minInterval || 30;
                        maxIntervalInput.value = options.maxInterval || 90;
                        specificTimeToggle.checked = options.useSpecificTime || false;
                        refreshTimeInput.value = options.specificTime || '';
                        hostnameFilterInput.value = options.hostnameFilter || '';
                        clearCacheCheckbox.checked = options.clearCache || false;
                        showNotificationCheckbox.checked = options.showNotification || false;
                        refreshAllTabsCheckbox.checked = options.refreshAllTabs || false; // This will be false if it's a single tab refresh
                        refreshByUrlListToggle.checked = options.useUrlList || false;
                        urlListTextarea.value = (options.urlList && options.urlList.join('\n')) || '';
                        clickElementToggle.checked = options.clickElement || false;
                        cssSelectorInput.value = options.cssSelector || '';
                        hostnameFilterToggle.checked = !(options.hostnameFilter =='' || options.hostnameFilter == null);

                        // Trigger change events to update UI visibility and disabled states correctly
                        specificTimeToggle.dispatchEvent(new Event('change'));
                        randomIntervalToggle.dispatchEvent(new Event('change'));
                        refreshByUrlListToggle.dispatchEvent(new Event('change'));
                        clickElementToggle.dispatchEvent(new Event('change'));

                        updateUI(true, currentActiveTabId, response.nextRefreshTime, response.currentInterval);
                    } else {
                        // If no refresh is active for this tab, load from storage (global default or last saved)
                        chrome.storage.local.get(['refreshOptions'], (storageResult) => {
                            const options = storageResult.refreshOptions || {};
                            intervalInput.value = options.interval || 60;
                            randomIntervalToggle.checked = options.useRandomInterval || false;
                            minIntervalInput.value = options.minInterval || 30;
                            maxIntervalInput.value = options.maxInterval || 90;
                            specificTimeToggle.checked = options.useSpecificTime || false;
                            refreshTimeInput.value = options.specificTime || '';
                            hostnameFilterInput.value = options.hostnameFilter || '';
                            clearCacheCheckbox.checked = options.clearCache || false;
                            showNotificationCheckbox.checked = options.showNotification || false;
                            refreshAllTabsCheckbox.checked = options.refreshAllTabs || false;
                            refreshByUrlListToggle.checked = options.useUrlList || false;
                            urlListTextarea.value = (options.urlList && options.urlList.join('\n')) || '';
                            clickElementToggle.checked = options.clickElement || false;
                            cssSelectorInput.value = options.cssSelector || '';

                            specificTimeToggle.dispatchEvent(new Event('change'));
                            randomIntervalToggle.dispatchEvent(new Event('change'));
                            refreshByUrlListToggle.dispatchEvent(new Event('change'));
                            clickElementToggle.dispatchEvent(new Event('change'));

                            updateUI(false, null, null, null); // No active refresh for this tab
                        });
                    }
                });
            } else {
                // No active tab found, disable start button
                showStatus('No active tab found.', 'error');
                startButton.disabled = true;
                stopButton.disabled = true;
                currentTabUrlDisplay.textContent = 'No active tab.';
            }
            renderActiveTabsList(); // Always render the list of active refreshes
        });
    };

    // --- UI Toggles ---
    if(tabItems.length){
        const tabToggleFunc = (e) => {
            var t = e.target || e.currentTarget || e.srcElement,
                t = t.nodeType ? t : t.parentNode,
                id = t.id,
                tabContent = null;
            for(var i = 0; i < tabContents.length; i++ ){
                var wrapper = (tabContents[i].dataset || {wrapper: null} ).wrapper;
                tabContents[i].classList.toggle('hidden', id!==wrapper);
                if(id!==wrapper){ tabContent = tabContents[i]; }
            }
            document.dispatchEvent(new CustomEvent('tabclick', { detail: { 'id': id, 'target': t, 'tabContent': tabContent, } }));
            document.dispatchEvent(new CustomEvent('tabclick_'.id, { detail: { 'id': id, 'target': t, 'tabContent': tabContent } }));
        };

        for(var i = 0; i < tabItems.length; i++ ){
            tabItems[i].addEventListener('click', tabToggleFunc);
        }
    }


    document.addEventListener('tabclick', (e) => {
        console.log(e);
    });


    intervalInput.addEventListener('dblclick', () => {
        if(!intervalInput.disabled) return;
        // this interval
        intervalInput.disabled = false;

        // random
        randomIntervalToggle.checked = false;
        randomIntervalFields.classList.add('hidden');

        // specific
        specificTimeToggle.checked = false;
        specificTimeField.classList.add('hidden');
    });
    
    randomIntervalToggle.addEventListener('change', () => {
        // this random
        randomIntervalFields.classList.toggle('hidden', !randomIntervalToggle.checked);
        minIntervalInput.disabled = !randomIntervalToggle.checked;
        maxIntervalInput.disabled = !randomIntervalToggle.checked;
        
        // interval
        intervalInput.disabled = randomIntervalToggle.checked;

        // specific
        specificTimeToggle.checked = false;
        specificTimeField.classList.add('hidden');
    });

    specificTimeToggle.addEventListener('change', () => {
        // this specific
        specificTimeField.classList.toggle('hidden', !specificTimeToggle.checked);
        refreshTimeInput.disabled = !specificTimeToggle.checked;

        // interval
        intervalInput.disabled = specificTimeToggle.checked;

        // random
        randomIntervalToggle.checked = false;
        randomIntervalFields.classList.add('hidden');
    });

    hostnameFilterToggle.addEventListener('change', () => {
        hostnameFilterFields.classList.toggle('hidden', !hostnameFilterToggle.checked );
        hostnameFilterInput.disabled = !hostnameFilterToggle.checked;
    });

    refreshByUrlListToggle.addEventListener('change', () => {
        urlListTextarea.disabled = !refreshByUrlListToggle.checked;
        urlListFields.classList.toggle('hidden', !refreshByUrlListToggle.checked);
    });

    currentTabUrlCopy.addEventListener('click', () => {
        copyToClipboard(currentTabUrlDisplay.textContent).then(success => {
            currentTabUrlCopy.disabled = false;
            currentTabUrlCopy.innerHTML = success ? "&#10004" : "&#9940;";
            setTimeout(()=>{
                currentTabUrlCopy.innerHTML = "&#128196;";
                currentTabUrlCopy.disabled = false;
            }, 3000);
        });
    });

    clickElementToggle.addEventListener('change', () => {
        cssSelectorInput.disabled = !clickElementToggle.checked;
        clickElementFields.classList.toggle('hidden', !clickElementToggle.checked);
    });

    advancedFiltersToggle.addEventListener('click', () => {
        var t = advancedFilters.classList.toggle('hidden');
        advancedFiltersWrapper.classList.toggle('expand', t);
    });

    // --- Update Start/Stop button labels based on Refresh All Tabs checkbox ---
    refreshAllTabsCheckbox.addEventListener('change', () => {
        if (refreshAllTabsCheckbox.checked) {
            startButton.innerHTML = '&#9654 Start All';
            stopButton.innerHTML = '&#9209; Stop All';
        } else {
            startButton.innerHTML = 'Start';
            stopButton.innerHTML = '&#9209; Stop';
        }
    });

    // --- Start Refresh Button (for current tab or all tabs) ---
    startButton.addEventListener('click', () => {
        let interval = parseInt(intervalInput.value, 10);
        let minInterval = parseInt(minIntervalInput.value, 10);
        let maxInterval = parseInt(maxIntervalInput.value, 10);
        const specificTime = refreshTimeInput.value;

        const useRandomInterval = randomIntervalToggle.checked;
        const useSpecificTime = specificTimeToggle.checked;
        const hostnameFilter = hostnameFilterInput.value.trim();
        const clearCache = clearCacheCheckbox.checked;
        const showNotification = showNotificationCheckbox.checked;
        const refreshAllTabs = refreshAllTabsCheckbox.checked;
        const useUrlList = refreshByUrlListToggle.checked;
        const urlList = urlListTextarea.value.split('\n').map(url => url.trim()).filter(url => url !== '');
        const clickElement = clickElementToggle.checked;
        const cssSelector = cssSelectorInput.value.trim();

        // Validation
        if (!useSpecificTime) {
            if (useRandomInterval) {
                if (isNaN(minInterval) || isNaN(maxInterval) || minInterval < 5 || maxInterval < 6 || minInterval >= maxInterval) {
                    showStatus('For random interval, please enter valid min/max seconds (min 5s, max > min).', 'error');
                    return;
                }
            } else {
                if (isNaN(interval) || interval < 5) {
                    showStatus('Please enter a valid refresh interval (minimum 5 seconds).', 'error');
                    return;
                }
            }
        } else {
            if (!specificTime) {
                showStatus('Please select a specific time for refresh.', 'error');
                return;
            }
        }

        if (useUrlList && urlList.length === 0) {
            showStatus('Please provide at least one URL for the URL list refresh.', 'error');
            return;
        }

        if (clickElement && !cssSelector) {
            showStatus('Please provide a CSS Selector for clicking an element.', 'error');
            return;
        }

        // Determine target tabId for the background script
        // If refreshAllTabs is checked, tabId sent to background will be null.
        // Otherwise, it's the current active tab.
        const targetTabId = refreshAllTabs ? null : currentActiveTabId;

        const options = {
            interval: interval,
            useRandomInterval: useRandomInterval,
            minInterval: minInterval,
            maxInterval: maxInterval,
            useSpecificTime: useSpecificTime,
            specificTime: specificTime,
            hostnameFilter: hostnameFilter,
            clearCache: clearCache,
            showNotification: showNotification,
            refreshAllTabs: refreshAllTabs,
            useUrlList: useUrlList,
            urlList: urlList,
            clickElement: clickElement,
            cssSelector: cssSelector
        };

        chrome.runtime.sendMessage({
            action: 'startRefresh',
            tabId: targetTabId,
            options: options
        }, (response) => {
            if (response && response.success) {
                let msg = '';
                if (useSpecificTime) {
                    msg = `Scheduled one-time refresh at ${specificTime}.`;
                } else if (useRandomInterval) {
                    msg = `Refreshing tab(s) with random interval between ${minInterval}-${maxInterval} seconds.`;
                } else {
                    msg = `Refreshing tab(s) every ${interval} seconds.`;
                }
                showStatus(msg, 'success');
                updateUI(true, targetTabId, response.nextRefreshTime, response.currentInterval);
                renderActiveTabsList(); // Re-render the list after starting a refresh
            } else if (response && response.message) {
                showStatus(response.message, 'error');
            } else {
                showStatus('Failed to start refresh.', 'error');
            }
        });
    });

    // --- Stop Refresh Button (for current tab or all tabs) ---
    stopButton.addEventListener('click', () => {
        // Determine target tabId for stopping
        const refreshAllTabs = refreshAllTabsCheckbox.checked;
        const targetTabId = refreshAllTabs ? null : currentActiveTabId;

        chrome.runtime.sendMessage({ action: 'stopRefresh', tabId: targetTabId, refreshAllTabs: refreshAllTabs }, (response) => {
            if (response && response.success) {
                showStatus('Refresh stopped.', 'info');
                updateUI(false, null, null, null);
                renderActiveTabsList(); // Re-render the list after stopping a refresh
            } else if (response && response.message) {
                showStatus(response.message, 'error');
            } else {
                showStatus('Failed to stop refresh.', 'error');
            }
        });
    });

    // --- UI Update Function ---
    function updateUI(isRefreshing, tabId, nextRefreshTime, currentInterval) {
        startButton.disabled = isRefreshing;
        stopButton.disabled = !isRefreshing;

        specificTimeToggle.disabled = isRefreshing;
        randomIntervalToggle.disabled = isRefreshing || specificTimeToggle.checked;
        intervalInput.disabled = isRefreshing || specificTimeToggle.checked || randomIntervalToggle.checked;
        minIntervalInput.disabled = isRefreshing || !randomIntervalToggle.checked || specificTimeToggle.checked;
        maxIntervalInput.disabled = isRefreshing || !randomIntervalToggle.checked || specificTimeToggle.checked;
        refreshTimeInput.disabled = isRefreshing || !specificTimeToggle.checked;

        hostnameFilterInput.disabled = isRefreshing;
        clearCacheCheckbox.disabled = isRefreshing;
        showNotificationCheckbox.disabled = isRefreshing;
        refreshAllTabsCheckbox.disabled = isRefreshing;
        refreshByUrlListToggle.disabled = isRefreshing;
        urlListTextarea.disabled = isRefreshing || !refreshByUrlListToggle.checked;
        clickElementToggle.disabled = isRefreshing;
        cssSelectorInput.disabled = isRefreshing || !clickElementToggle.checked;

        advancedFilters.classList.toggle('hidden', !(hostnameFilterToggle.checked || clearCacheCheckbox.checked || refreshAllTabsCheckbox.checked ||refreshByUrlListToggle.checked || clickElementToggle.checked) );

        if (isRefreshing) {
            //let targetTabMsg = tabId === null ? 'All tabs' : `Current tab`;
            //showStatus(`Refreshing ${targetTabMsg}.`, 'info');
            startCountdown(nextRefreshTime, currentInterval);
        } else {
            //statusMessage.classList.add('hidden');
            stopCountdown();
        }
    }

    // --- Status Message Function ---
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message'; // Reset classes
        statusMessage.classList.add(`status-${type}`);
        statusMessage.classList.remove('hidden');
        setTimeout(() => {
            statusMessage.textContent = message;
            statusMessage.className = 'status-message'; // Reset classes
            statusMessage.classList.add('hidden');
        }, 5000);
    }

    function formatSecondsToYMDHMS(seconds) {
        const secInMinute = 60;
        const secInHour = secInMinute * 60;
        const secInDay = secInHour * 24;
        const secInMonth = secInDay * 30; // Approximate
        const secInYear = secInDay * 365; // Approximate

        const units = {
            y: Math.floor(seconds / secInYear),
            M: 0,
            d: 0,
            h: 0,
            m: 0,
            s: 0,
        };
        seconds %= secInYear;

        units.M = Math.floor(seconds / secInMonth);
        seconds %= secInMonth;

        units.d = Math.floor(seconds / secInDay);
        seconds %= secInDay;

        units.h = Math.floor(seconds / secInHour);
        seconds %= secInHour;

        units.m = Math.floor(seconds / secInMinute);
        units.s = seconds % secInMinute;

        let parts = [];
        for (let [label, value] of Object.entries(units)) {
            if (value > 0 || parts.length > 0) {
            parts.push(String(value).padStart(2, "0") + label);
            }
        }

        // If all were zero
        if (parts.length === 0) {
            return "00s";
        }

        return parts.join(" ");
    }


    // --- Countdown Logic ---
    function startCountdown(nextRefreshTime, currentInterval) {
        stopCountdown(); // Clear any existing countdown
        if (!nextRefreshTime || !currentInterval) {
            countdownDisplay.classList.add('hidden');
            return;
        }

        countdownDisplay.classList.remove('hidden');
        const updateCountdown = () => {
            const now = Date.now();
            const remainingSeconds = Math.max(0, Math.floor((nextRefreshTime - now) / 1000));
            countdownDisplay.textContent = `Next refresh in: ${formatSecondsToYMDHMS(remainingSeconds)}`;

            if (remainingSeconds <= 0) {
                countdownDisplay.textContent = `Refreshing...`;
            }
        };

        countdownIntervalId = setInterval(updateCountdown, 1000);
        updateCountdown(); // Initial update
    }

    function stopCountdown() {
        if (countdownIntervalId) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
        }
        countdownDisplay.classList.add('hidden');
    }

    // --- Render Active Tabs List ---
    function renderActiveTabsList() {
        chrome.runtime.sendMessage({ action: 'getAllRefreshStatuses' }, (response) => {
            activeTabsList.innerHTML = ''; // Clear existing list
            if (response && response.activeRefreshes && response.activeRefreshes.length > 0) {
                if(activeTabsListCountdown) clearInterval(activeTabsListCountdown);
                activesTabCount.textContent = response.activeRefreshes.length;
                response.activeRefreshes.forEach(refresh => {
                    // Get tab info for display
                    chrome.tabs.get(refresh.tabId, (tab) => {
                        if (chrome.runtime.lastError || !tab) {
                            //console.warn(`Tab ${refresh.tabId} not found for active refresh list.`);
                            // If tab is gone, inform background to clear its state
                            chrome.runtime.sendMessage({ action: 'clearRefreshStateForTab', tabId: refresh.tabId });
                            return;
                        }

                        const tabItem = document.createElement('div');
                        tabItem.dataset = { time : refresh.nextRefreshTime };
                        tabItem.setAttribute('data-time', refresh.nextRefreshTime);
                        tabItem.className = 'tab-item';
                        tabItem.dataset.tabId = refresh.tabId; // Store tabId on the element

                        const tabInfo = document.createElement('div');
                        tabInfo.className = 'tab-info';
                        tabInfo.innerHTML = `
                            <div class="tab-title">${tab.title || 'No Title'}</div>
                            <div class="tab-url">${tab.url}</div>
                            <div class="tab-next text-xs text-blue-700">Next: ${formatTimeForDisplay(refresh.nextRefreshTime - Date.now())}</div>
                        `;

                        const tabActions = document.createElement('div');
                        tabActions.className = 'tab-actions';

                        const stopButton = document.createElement('button');
                        stopButton.className = 'btn-secondary';
                        stopButton.textContent = 'Stop';
                        stopButton.addEventListener('click', () => {
                            chrome.runtime.sendMessage({ action: 'stopRefresh', tabId: refresh.tabId, refreshAllTabs: false }, (stopResponse) => {
                                if (stopResponse && stopResponse.success) {
                                    showStatus(`Stopped refresh for tab ${tab.id}.`, 'info');
                                    renderActiveTabsList(); // Re-render to remove the stopped tab
                                    // If the stopped tab was the current active one, update main UI
                                    if (refresh.tabId === currentActiveTabId) {
                                        updateUI(false, null, null, null);
                                    }
                                } else {
                                    showStatus(`Failed to stop refresh for tab ${tab.id}.`, 'error');
                                }
                            });
                        });
                        tabActions.appendChild(stopButton);

                        tabItem.appendChild(tabInfo);
                        tabItem.appendChild(tabActions);
                        activeTabsList.appendChild(tabItem);
                    });
                });
                activeTabsListCountdown = setInterval(()=>{
                    var infos = activeTabsList.childNodes;
                    for(var i=0; i < infos.length; i++ ){
                        var t = parseInt(infos[i].dataset.time || infos[i].getAttribute('data-time') || 0);
                        var d = formatTimeForDisplay(t - Date.now(), false);
                        var f = d ? `Next: ${d}` : 'Refreshing';
                        (infos[i].getElementsByClassName('tab-next') || [{textContent:null}])[0].textContent = f;
                    }
                }, 1000);
            } else {
                activeTabsList.innerHTML = '<p class="text-gray-500 text-center py-2">No active refreshes.</p>';
            }
        });
    }

    // Helper to format time for display in the list (can be simpler than badge)
    function formatTimeForDisplay(milliseconds) {
        if (milliseconds <= 999) return (typeof arguments[1] !=='undefined' ? arguments[1] : '0s');
        const seconds = Math.floor(milliseconds / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        return `${days}d`;
    }

    async function copyToClipboard(text) {
        // Modern secure context
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                //console.warn("navigator.clipboard failed, trying fallback...", err);
            }
        }

        // Fallback
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed"; // Avoid scrolling
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            const success = document.execCommand("copy");
            document.body.removeChild(textarea);
            return success;
        } catch (err) {
            //console.error("Fallback copy failed", err);
            document.body.removeChild(textarea);
            return false;
        }
    }

    // Listen for updates from background script for countdown and list re-render
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateCountdown' && request.tabId === currentActiveTabId) {
            updateUI(true, request.tabId, request.nextRefreshTime, request.currentInterval);
        } else if (request.action === 'refreshStoppedForTab' || request.action === 'refreshStoppedAll' || request.action === 'refreshStartedForTab') {
            // Re-render the list whenever a refresh state changes
            renderActiveTabsList();
            // If the message is for the currently active tab, update main UI
            if (request.tabId === currentActiveTabId || request.action === 'refreshStoppedAll') {
                if (request.action === 'refreshStoppedForTab' || request.action === 'refreshStoppedAll') {
                     updateUI(false, null, null, null);
                } else if (request.action === 'refreshStartedForTab' && request.tabId === currentActiveTabId) {
                    // If a refresh was started for the current tab (e.g., from the list)
                    chrome.runtime.sendMessage({ action: 'getTabRefreshStatus', tabId: currentActiveTabId }, (response) => {
                         if (response && response.isRefreshing) {
                            updateUI(true, currentActiveTabId, response.nextRefreshTime, response.currentInterval);
                         }
                    });
                }
            }
        }
    });

    // Initialize the popup when it opens
    initializePopup();
});
