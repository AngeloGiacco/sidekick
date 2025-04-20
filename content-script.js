console.log("Content Script Loaded V2");

const WIDGET_SCRIPT_URL = "https://elevenlabs.io/convai-widget/index.js";
const WIDGET_TAG_NAME = "elevenlabs-convai";
let agentId = null;
let widgetInjected = false;

function addClientToolsListener() {
    const widgetElement = document.querySelector(WIDGET_TAG_NAME);
    if (!widgetElement) {
        console.warn("Widget element not found when trying to add client tools listener.");
        return;
    }

    // Prevent adding the listener multiple times if ensureWidgetInjected runs again
    if (widgetElement.dataset.clientToolsListenerAdded === 'true') {
        return;
    }

    console.log("Adding 'elevenlabs-convai:call' listener for client tools.");
    widgetElement.addEventListener('elevenlabs-convai:call', (event) => {
        console.log("Intercepting 'elevenlabs-convai:call' event to inject client tools.");
        if (event.detail && event.detail.config) {
            event.detail.config.clientTools = {
                goToUrl: ({ url }) => {
                    if (url) {
                        console.log(`Client Tool: Navigating to URL: ${url}`);
                        window.open(url, '_blank', 'noopener,noreferrer');
                        return `Navigating to ${url}`; // Confirmation for the agent
                    } else {
                        console.error("Client Tool: goToUrl called without a URL.");
                        return "Error: No URL provided for navigation.";
                    }
                },

                goToEmail: () => {
                    const emailUrl = 'https://gmail.com';
                    console.log(`Client Tool: Navigating to Email: ${emailUrl}`);
                    window.open(emailUrl, '_blank', 'noopener,noreferrer');
                    return "Navigating to your email.";
                },

                search: ({ query }) => {
                    if (query) {
                        const searchUrl = `https://perplexity.ai/?q=${encodeURIComponent(query)}`;
                        console.log(`Client Tool: Searching for: ${query} on Perplexity`);
                        window.open(searchUrl, '_blank', 'noopener,noreferrer');
                        return `Searching Perplexity for "${query}"`;
                    } else {
                        console.error("Client Tool: search called without a query.");
                        return "Error: No search query provided.";
                    }
                },
            };
            console.log("Injected clientTools into event.detail.config.");
        } else {
             console.warn("'elevenlabs-convai:call' event missing detail or config property.");
        }
    });
    widgetElement.dataset.clientToolsListenerAdded = 'true'; // Mark listener as added
}


async function ensureWidgetInjected() {
    const existingWidget = document.querySelector(WIDGET_TAG_NAME);
    if (widgetInjected || existingWidget) {
        widgetInjected = true;
        if (existingWidget && existingWidget.dataset.clientToolsListenerAdded !== 'true') {
             addClientToolsListener(); // Ensure listener is attached if widget already existed
        }
        return;
    }

    if (!agentId) {
        try {
            const response = await chrome.runtime.sendMessage({ action: "getAgentId" });
            agentId = response?.agentId;
        } catch (error) {
            console.error("Error requesting Agent ID:", error);
            return;
        }
    }

     if (!agentId || agentId === "YOUR_ELEVENLABS_AGENT_ID") {
        console.error("Agent ID not configured correctly in service-worker.js");
        return;
    }

    console.log("Injecting ElevenLabs Convai Widget with Agent ID:", agentId);

    try {
        const script = document.createElement('script');
        script.src = WIDGET_SCRIPT_URL;
        script.async = true;
        script.type = "text/javascript";
        (document.head || document.documentElement).appendChild(script);

        await customElements.whenDefined(WIDGET_TAG_NAME);

        const widgetElement = document.createElement(WIDGET_TAG_NAME);
        widgetElement.setAttribute('agent-id', agentId);
        // Add other attributes if needed (e.g., variant='full')
        document.body.appendChild(widgetElement);

        widgetInjected = true;
        console.log("ElevenLabs Convai Widget injected successfully.");
        addClientToolsListener(); // Add listener immediately after injecting

    } catch (error) {
        console.error("Error injecting widget script or element:", error);
    }
}

function extractMainText() {
    console.log("Attempting to extract main text...");
    //remove noise
    const selectorsToRemove = 'nav, footer, header, aside, script, style, noscript, iframe, [role="navigation"], [role="banner"], [role="complementary"], [aria-hidden="true"], #sidebar, .sidebar';
    const bodyClone = document.body.cloneNode(true);
    bodyClone.querySelectorAll(selectorsToRemove).forEach(el => el.remove());

    const potentialSelectors = ['article', 'main', '.post-content', '.article-body', '#content', '#main', '.entry-content', 'body'];
    let mainText = '';

    for (const selector of potentialSelectors) {
        const element = bodyClone.querySelector(selector);
        if (element) {
            mainText = element.innerText;
            if (mainText && mainText.trim().length > 200) {
                console.log(`Extracted text using selector: ${selector}`);
                break;
            }
        }
    }

    if (!mainText || mainText.trim().length <= 200) {
        mainText = bodyClone.innerText || '';
        console.log("Extracted text using body as fallback.");
    }

    mainText = mainText.replace(/\s\s+/g, ' ').trim();
    console.log("Extraction complete, length:", mainText.length);
    return mainText;
}

async function sendContextToWidget(text) {
    if (!widgetInjected) {
        console.warn("Widget not injected yet, attempting injection before sending context.");
        await ensureWidgetInjected();
        if (!widgetInjected) {
             console.error("Widget injection failed, cannot send context.");
             return;
        }
    }

    const widgetElement = document.querySelector(WIDGET_TAG_NAME);
    if (!widgetElement) {
        console.error("Could not find the widget element to send context.");
        widgetInjected = false;
        return;
    }

    if (typeof widgetElement.sendContextualUpdate === 'function') {
        try {
            console.log("Sending context to widget element:", text.substring(0, 100) + "...");
            widgetElement.sendContextualUpdate(text);
        } catch (error) {
            console.error("Error calling sendContextualUpdate on widget:", error);
        }
    } else {
        console.warn(`The ${WIDGET_TAG_NAME} element does not seem to have a 'sendContextualUpdate' method.`);
    }
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received in CS:", message);

    if (message.action === "extractText") {
        ensureWidgetInjected().then(() => {
            if (widgetInjected) {
                 const text = extractMainText();
                 if (text) {
                    sendContextToWidget(text);
                 } else {
                     console.log("No significant text extracted.");
                 }
            } else {
                console.warn("Widget injection failed, cannot send context.");
            }
        });
        return false;
    }
    // Added a check for unknown actions for better debugging
    // console.warn("Unknown message action received:", message.action);
    // return false;
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    ensureWidgetInjected();
} else {
    document.addEventListener('DOMContentLoaded', ensureWidgetInjected);
}
