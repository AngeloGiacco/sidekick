

let agentId = null;

// Load configuration from storage
async function loadConfig() {
    const result = await chrome.storage.local.get(['agentId']);
    agentId = result.agentId || null; // Will be null if not set
    console.log("Loaded config - Agent ID:", agentId);
    // No default setting here anymore
}

// Listener for when the extension is first installed or updated.
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension Installed/Updated");
    loadConfig(); // Load any previously saved config
});

// Listener for page navigation completion
chrome.webNavigation.onCompleted.addListener(async (details) => {
    // Ensure the Agent ID is loaded before trying to message content script
    if (agentId === null) {
        await loadConfig(); // Attempt to load if not already loaded
    }

    if (!agentId) {
         console.warn("Agent ID not set. Please configure it in the extension options.");
         // Optionally: could notify the user somehow, maybe via the content script?
         return;
    }

    if (details.frameId === 0 && details.url && !details.url.startsWith('chrome://')) {
        console.log(`Attempting to request text extraction for: ${details.url} in tab ${details.tabId}`);
        try {
            // Send message to content script to extract text
            await chrome.tabs.sendMessage(details.tabId, { action: "extractText" });
            console.log("Sent extractText request to tab:", details.tabId);
        } catch (error) {
            console.error(`Failed to send 'extractText' message to tab ${details.tabId}:`, error.message);
             if (error.message.includes("Could not establish connection") || error.message.includes("Receiving end does not exist")) {
                console.warn("Content script may not be available in this tab or page.");
            }
        }
    }
}, { url: [{ schemes: ["http", "https"] }] });

// Listener for messages from other parts of the extension (like content script)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getAgentId") {
        // Ensure agentId is loaded before responding
        if (agentId === null) {
             loadConfig().then(() => {
                 sendResponse({ agentId: agentId });
             });
             return true; // Indicate asynchronous response
        } else {
            sendResponse({ agentId: agentId });
            return false; // Indicate synchronous response
        }
    }
    // Allow other message types if needed in the future
    return false;
});

// Initial load of configuration when the service worker starts
loadConfig();