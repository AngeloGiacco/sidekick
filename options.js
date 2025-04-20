const agentIdInput = document.getElementById('agentId');
const saveButton = document.getElementById('saveButton');
const statusDiv = document.getElementById('status');

// Load the saved Agent ID when the options page opens
function loadOptions() {
    chrome.storage.local.get(['agentId'], (result) => {
        if (result.agentId && result.agentId !== "YOUR_ELEVENLABS_AGENT_ID") {
             agentIdInput.value = result.agentId;
        } else {
             // If it's the placeholder or not set, leave the input empty
             agentIdInput.value = '';
        }
        console.log('Loaded Agent ID:', result.agentId);
    });
}

// Save the Agent ID to chrome.storage
function saveOptions() {
    const agentId = agentIdInput.value.trim();
    if (!agentId) {
        statusDiv.textContent = 'Error: Agent ID cannot be empty.';
        statusDiv.style.color = 'red';
        setTimeout(() => { statusDiv.textContent = ''; }, 3000);
        return;
    }

    chrome.storage.local.set({ agentId: agentId }, () => {
        console.log('Agent ID saved:', agentId);
        statusDiv.textContent = 'Options saved!';
        statusDiv.style.color = 'green';
        setTimeout(() => { statusDiv.textContent = ''; }, 2000);
    });
}

document.addEventListener('DOMContentLoaded', loadOptions);
saveButton.addEventListener('click', saveOptions);

// Optional: Save on Enter key press in the input field
agentIdInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        saveOptions();
    }
});