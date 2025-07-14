//<!-- popup.js -->
document.addEventListener('DOMContentLoaded', () => {
    const intervalInput = document.getElementById('interval');
    const startButton = document.getElementById('startRefresh');
    const stopButton = document.getElementById('stopRefresh');
    const statusMessage = document.getElementById('statusMessage');

    // Load saved interval and status
    chrome.storage.local.get(['refreshInterval', 'isRefreshing', 'refreshTabId'], (result) => {
        if (result.refreshInterval) {
            intervalInput.value = result.refreshInterval;
        }
        updateUI(result.isRefreshing, result.refreshTabId);
    });

    startButton.addEventListener('click', () => {
        const interval = parseInt(intervalInput.value, 10);
        if (isNaN(interval) || interval < 5) {
            showStatus('Please enter a valid interval (minimum 5 seconds).', 'error');
            return;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                showStatus('No active tab found.', 'error');
                return;
            }
            const tabId = tabs[0].id;

            // Send message to background script to start refreshing
            chrome.runtime.sendMessage({
                action: 'startRefresh',
                interval: interval,
                tabId: tabId
            }, (response) => {
                if (response && response.success) {
                    showStatus(`Refreshing tab every ${interval} seconds.`, 'success');
                    updateUI(true, tabId);
                } else if (response && response.message) {
                    showStatus(response.message, 'error');
                } else {
                    showStatus('Failed to start refresh.', 'error');
                }
            });
        });
    });

    stopButton.addEventListener('click', () => {
        // Send message to background script to stop refreshing
        chrome.runtime.sendMessage({ action: 'stopRefresh' }, (response) => {
            if (response && response.success) {
                showStatus('Refresh stopped.', 'info');
                updateUI(false, null);
            } else if (response && response.message) {
                showStatus(response.message, 'error');
            } else {
                showStatus('Failed to stop refresh.', 'error');
            }
        });
    });

    // Function to update UI based on refreshing status
    function updateUI(isRefreshing, tabId) {
        if (isRefreshing) {
            startButton.disabled = true;
            stopButton.disabled = false;
            intervalInput.disabled = true;
            showStatus(`Currently refreshing tab ID: ${tabId}`, 'info');
        } else {
            startButton.disabled = false;
            stopButton.disabled = true;
            intervalInput.disabled = false;
            statusMessage.classList.add('hidden');
        }
    }

    // Function to display status messages
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message'; // Reset classes
        statusMessage.classList.add(`status-${type}`);
        statusMessage.classList.remove('hidden');
    }
});