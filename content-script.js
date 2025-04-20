import { Readability } from '@mozilla/readability';

// Keep WIDGET_TAG_NAME for potential use, but script URL is now in iframe
const WIDGET_TAG_NAME = "elevenlabs-convai";
const IFRAME_HOST_PAGE = "widget_host.html";
const IFRAME_ID = "elevenlabs-convai-iframe";

let agentId = "dI9HdRRMHibsGDKTRTTv"; // Keep hardcoded for now, or fetch as before
let widgetFrameInjected = false;
let widgetFrameElement = null; // Store iframe element reference

// Client Tool implementations (will be called via message from iframe)
const clientToolsImpl = {
    goToUrl: ({ url }) => {
        if (url) {
            console.log(`Client Tool: Navigating to URL: ${url}`);
            window.open(url, '_blank', 'noopener,noreferrer');
            return `Navigating to ${url}`; // Confirmation message can be sent back if needed
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
    }
};

// Listener for messages FROM the iframe (e.g., client tool requests)
window.addEventListener('message', (event) => {
    // Basic security: Check the origin if possible, although iframe src is chrome-extension://
    // if (event.origin !== 'expected-origin') return;

    if (event.data && event.data.source === 'convai-widget-iframe' && event.data.action === 'callClientTool') {
        const { tool, params } = event.data.payload;
        console.log(`Content Script: Received request to call client tool '${tool}' with params:`, params);
        if (clientToolsImpl[tool]) {
            try {
                const result = clientToolsImpl[tool](params);
                // Optionally send result back to iframe if needed
                console.log(`Content Script: Client tool '${tool}' executed.`);
            } catch (error) {
                console.error(`Content Script: Error executing client tool '${tool}':`, error);
            }
        } else {
            console.warn(`Content Script: Received request for unknown client tool: ${tool}`);
        }
    }
});


async function ensureWidgetInjected() {
    // Check if iframe already exists
    const existingFrame = document.getElementById(IFRAME_ID);
    if (widgetFrameInjected || existingFrame) {
        widgetFrameInjected = true;
        widgetFrameElement = existingFrame; // Ensure we have the reference
        console.log("Widget iframe already exists.");
        return;
    }

    // Fetch Agent ID if not hardcoded
    if (!agentId) {
        try {
            console.log("Requesting Agent ID from service worker...");
            const response = await chrome.runtime.sendMessage({ action: "getAgentId" });
            agentId = response?.agentId;
             console.log("Received Agent ID:", agentId);
        } catch (error) {
            console.error("Error requesting Agent ID:", error);
            return; // Stop if we can't get the ID
        }
    }

     if (!agentId || agentId === "YOUR_ELEVENLABS_AGENT_ID") {
        console.error("Agent ID not configured or invalid:", agentId);
        return; // Stop if ID is invalid
    }

    console.log("Injecting ElevenLabs Convai Widget via iframe with Agent ID:", agentId);

    try {
        widgetFrameElement = document.createElement('iframe');
        widgetFrameElement.id = IFRAME_ID;
        // Pass agentId to the iframe page via URL parameters
        widgetFrameElement.src = chrome.runtime.getURL(`${IFRAME_HOST_PAGE}?agentId=${encodeURIComponent(agentId)}`);

        // Style the iframe to be a floating widget
        widgetFrameElement.style.position = 'fixed';
        widgetFrameElement.style.bottom = '20px';
        widgetFrameElement.style.right = '20px';
        widgetFrameElement.style.width = '350px'; // Adjust size as needed
        widgetFrameElement.style.height = '500px'; // Adjust size as needed
        widgetFrameElement.style.border = '1px solid #ccc';
        widgetFrameElement.style.borderRadius = '8px';
        widgetFrameElement.style.zIndex = '999999'; // Ensure it's on top
        widgetFrameElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        widgetFrameElement.allow = "microphone"; // Request microphone permission

        document.body.appendChild(widgetFrameElement);

        widgetFrameInjected = true;
        console.log("Widget iframe injected successfully.");

        // No need to call addClientToolsListener here anymore

    } catch (error) {
        console.error("Error injecting widget iframe:", error);
        widgetFrameElement = null; // Reset on error
    }
}

function extractMainTextWithReadability() {
    // Add console log for debugging extraction start
    console.log("Attempting text extraction with Readability...");
    const documentClone = document.cloneNode(true);

    try {
        const reader = new Readability(documentClone);
        const article = reader.parse();

        if (article && article.textContent) {
            let mainText = article.textContent;
            mainText = mainText.replace(/\s\s+/g, ' ').trim();
             console.log("Readability extraction successful, length:", mainText.length);
            return mainText;
        } else {
             console.warn("Readability parsed, but no textContent found.");
        }
    } catch (error) {
        console.error("Error using Readability.js:", error);
    }
    console.warn("Readability.js failed or found no text. Falling back to basic extraction.");
    return extractMainTextFallback();
}

function extractMainTextFallback() {
    console.log("Using fallback extraction method...");
    //remove noise
    const selectorsToRemove = 'nav, footer, header, aside, script, style, noscript, iframe, [role="navigation"], [role="banner"], [role="complementary"], [aria-hidden="true"], #sidebar, .sidebar, form, button, input, select, textarea, [class*="modal"], [id*="modal"]'; // Added form elements and modals
    const bodyClone = document.body.cloneNode(true);
    bodyClone.querySelectorAll(selectorsToRemove).forEach(el => el.remove());

    // Try more specific selectors first
    const potentialSelectors = ['article', 'main', '.post-content', '.article-body', '#content', '#main', '.entry-content', '.story-content', '.blog-post', '[itemprop="articleBody"]', 'div[class*="content"]', 'div[id*="content"]', 'body']; // Added more common selectors
    let mainText = '';
    const minLength = 200; // Minimum length to consider "good" text

    for (const selector of potentialSelectors) {
        const element = bodyClone.querySelector(selector);
        if (element) {
             // Get innerText, which tries to mimic rendered text
            let potentialText = element.innerText || '';
            potentialText = potentialText.replace(/\s\s+/g, ' ').trim();

            if (potentialText.length > minLength) {
                console.log(`Extracted text using selector: ${selector}, length: ${potentialText.length}`);
                mainText = potentialText;
                break; // Found sufficient text
            }
        }
    }

    // If no specific selector worked well, use the cleaned body's innerText
    if (!mainText || mainText.length <= minLength) {
        mainText = bodyClone.innerText || '';
        mainText = mainText.replace(/\s\s+/g, ' ').trim();
        console.log(`Extracted text using cleaned body as fallback, length: ${mainText.length}`);
    }

     // Final check for minimal length
    if (mainText.length < 50) {
         console.warn("Fallback extraction resulted in very short text. Sending anyway.");
    } else {
        console.log("Extraction complete, final length:", mainText.length);
    }

    return mainText;
}

async function sendContextToWidget(text) {
    // Ensure iframe is ready before sending
    if (!widgetFrameInjected || !widgetFrameElement) {
        console.warn("Widget iframe not injected yet, attempting injection before sending context.");
        await ensureWidgetInjected(); // Try injecting again
        if (!widgetFrameInjected || !widgetFrameElement) {
             console.error("Widget iframe injection failed, cannot send context.");
             return;
        }
    }

    if (widgetFrameElement.contentWindow) {
        console.log("Sending context to widget iframe:", text.substring(0, 100) + "...");
        // Send message to the iframe's window
        widgetFrameElement.contentWindow.postMessage({
            action: 'sendContext',
            text: text
        }, '*'); // Use specific target origin in production if possible, e.g., chrome.runtime.getURL('')
    } else {
        console.error("Could not get contentWindow of the widget iframe.");
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received message:", message); // Log received messages

    if (message.action === "extractText") {
        // Make sure injection happens first, then extract and send
        ensureWidgetInjected().then(() => {
            if (widgetFrameInjected) {
                console.log("Injection ensured, proceeding with text extraction.");
                const text = extractMainTextWithReadability(); // Use the combined function
                if (text && text.length > 0) { // Check if text is not empty
                    sendContextToWidget(text);
                } else {
                    console.log("No significant text extracted to send.");
                }
            } else {
                // Error messages are handled within ensureWidgetInjected and sendContextToWidget
                console.warn("Widget injection failed or not complete, cannot send context.");
            }
        }).catch(error => {
            console.error("Error during ensureWidgetInjected/extraction process:", error);
        });
        // Indicate that we will respond asynchronously (although we don't use sendResponse here)
        return true;
    }
    // Return false for messages not handled by this listener
    return false;
});

// Trigger injection check when the document is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
     console.log("Document already ready, ensuring widget injection.");
    ensureWidgetInjected();
} else {
     console.log("Adding DOMContentLoaded listener for widget injection.");
    document.addEventListener('DOMContentLoaded', ensureWidgetInjected);
}
