# Sidekick

Sidekick is a browsing companion

## Overview

Sidekick is a Google Chrome extension that integrates the ElevenLabs Conversational AI SDK to provide users with an interactive voice assistant. It appears as an on-screen widget and maintains conversational context based on the content of the web pages the user browses. As the user navigates, the extension extracts text from the current page and sends it to the ElevenLabs AI agent, allowing for discussions, summaries, or Q&A about the viewed content.

The extension is developed using Chrome's Manifest V3 (MV3) platform.

## Features

*   **Interactive Voice Assistant:** Provides an on-screen widget for voice interaction.
*   **Real-time Context Updates:** Automatically updates the AI's context as the user navigates to new pages.
*   **Manifest V3:** Built on the modern Chrome extension platform.

## Core Technologies

*   **Chrome Extensions (Manifest V3):**
    *   **`manifest.json`:** Defines metadata, permissions, and components.
    *   **Service Workers:** Event-driven background scripts for managing core logic and SDK integration.
    *   **Content Scripts:** JavaScript/CSS injected into web pages for DOM interaction (text extraction) and UI widget management.
    *   **MV3 Permissions Model:** Stricter control over API and host permissions.
*   **ElevenLabs Conversational AI SDK (`@11labs/client`):**
    *   Manages WebSocket connection, microphone input, audio output.
    *   `Conversation` class: Handles the session lifecycle and events.
    *   `sendContextualUpdate(text)`: Method used to send page content as context to the AI agent.

## Architecture Overview

The extension employs a separation of concerns across its main components:

1.  **Service Worker (`service-worker.js`):**
    *   Central hub for initializing and managing the ElevenLabs SDK `Conversation` instance.
    *   Handles the WebSocket connection lifecycle and SDK events.
    *   Manages overall extension state (connection status, configuration) using `chrome.storage`.
    *   Listens for page navigation events (`chrome.webNavigation.onCompleted`) to trigger context updates.
    *   Communicates with the content script via message passing.
    *   Manages keep-alive mechanisms (e.g., `chrome.alarms`) to maintain the SDK connection within the ephemeral service worker environment.
2.  **Content Script (`content-script.js`):**
    *   Injects and manages the UI widget overlay on web pages (potentially using Shadow DOM for style isolation).
    *   Listens for messages from the service worker (e.g., requests to extract text).
    *   Accesses and parses the page's DOM to extract relevant textual content using heuristics.
    *   Sends messages (extracted text, UI interactions) back to the service worker.
3.  **UI Widget (Managed by Content Script):**
    *   Provides the user interface (HTML/CSS) for displaying status, messages, and controls.
    *   User interactions trigger messages sent via the content script to the service worker.
4.  **Message Passing:** Uses `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage` for communication between the service worker and content script(s).

**Contextual Update Flow:**

1.  User navigates to a new page.
2.  Service worker detects page load completion (`onCompleted`).
3.  Service worker requests text extraction from the relevant content script.
4.  Content script extracts main text content using DOM heuristics.
5.  Content script sends extracted text back to the service worker.
6.  Service worker calls `conversation.sendContextualUpdate()` with the extracted text.
7.  ElevenLabs backend makes the context available to the AI agent (effectiveness depends on the agent's system prompt configuration).


## Contributing

Contributions welcome 

## License
MIT license 