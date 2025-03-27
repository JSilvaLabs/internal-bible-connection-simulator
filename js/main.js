// Import functions/modules from other JavaScript files
import { loadAllData, getBibleMeta, getVerseText, getCrossRefs } from './dataLoader.js';
import { init as initVisualization, selectVerse as selectVerseInViz, highlightVerse as highlightVerseInViz, clearHighlight as clearHighlightInViz } from './visualization.js';
import { init as initUI, populateSelectors, updateVerseDisplay, displayLoading, displayError } from './uiController.js';
import { setSelectedVerse, getSelectedVerse, setHoveredVerse } from './stateManager.js';
import { sanitizeForCSS } from './utils.js'; // Assuming we'll need this utility

// --- Main Application Logic ---

// Function to handle hover events coming FROM the visualization
function handleVisualizationHover(verseId) {
    setHoveredVerse(verseId);
    const currentlySelected = getSelectedVerse();

    // Update display only if nothing is actively selected, or if hovering over the selected verse
    if (!currentlySelected || currentlySelected === verseId) {
        if (verseId) {
            const text = getVerseText(verseId);
            const refs = getCrossRefs(verseId);
            updateVerseDisplay(verseId, text, refs, 'hover');
        } else {
            // If hovering off but something is selected, show the selected verse again
            if (currentlySelected){
                const text = getVerseText(currentlySelected);
                const refs = getCrossRefs(currentlySelected);
                updateVerseDisplay(currentlySelected, text, refs, 'select');
            } else {
                 // If hovering off and nothing selected, clear display
                 updateVerseDisplay(null, null, null, 'clear');
            }
        }
    }
    // If something else is selected, the hover doesn't change the text display,
    // but the visualization highlighting still happens (handled within visualization.js)
}

// Function to handle click events coming FROM the visualization
function handleVisualizationClick(verseId) {
    if (verseId) {
        setSelectedVerse(verseId); // Update state
        const text = getVerseText(verseId);
        const refs = getCrossRefs(verseId);
        updateVerseDisplay(verseId, text, refs, 'select'); // Update UI display to selected state
        // Visualization module handles its own persistent selection display on click
        console.log("Verse selected via click:", verseId);
    }
}

// Function to handle selection requests coming FROM the UI controls (dropdowns + Go button)
function handleUISelectionRequest(verseId) {
    if (verseId && getVerseText(verseId)) { // Check if verseId is valid
        setSelectedVerse(verseId); // Update state
        selectVerseInViz(verseId); // Tell visualization to select & highlight
        const text = getVerseText(verseId);
        const refs = getCrossRefs(verseId);
        updateVerseDisplay(verseId, text, refs, 'select'); // Update UI display
        console.log("Verse selected via UI:", verseId);
    } else {
        console.warn("Requested verse ID not found:", verseId);
        // Optionally show an error to the user via uiController
        displayError(`Verse not found: ${verseId}`);
    }
}

// --- Initialization ---

async function initializeApp() {
    console.log("Initializing application...");
    displayLoading(true);
    displayError(null); // Clear any previous errors

    try {
        // 1. Load all necessary data
        await loadAllData();
        console.log("Data loading complete.");

        // 2. Get data references (assuming dataLoader holds them now)
        const bibleMeta = getBibleMeta();
        const crossRefsMap = null; // visualization.js might get refs via getCrossRefs directly if needed

        if (!bibleMeta) {
            throw new Error("Bible metadata not loaded correctly.");
        }

        // 3. Initialize UI Controller
        // Pass the handler function for when the UI requests a verse selection
        initUI(handleUISelectionRequest);
        console.log("UI Controller initialized.");

        // 4. Populate UI Selectors (dropdowns)
        populateSelectors(bibleMeta);
        console.log("UI Selectors populated.");

        // 5. Initialize Visualization
        // Pass the container ID, metadata, and event handlers
        initVisualization(
            '#visualization-container', // Where to draw the SVG
            bibleMeta,                  // Bible structure data
            getCrossRefs,               // Pass function to get refs on demand
            handleVisualizationHover,   // Callback for hover events
            handleVisualizationClick    // Callback for click events
        );
        console.log("Visualization initialized.");

        // If initialization is successful
        displayLoading(false);
        console.log("Application initialization successful.");

    } catch (error) {
        console.error("Application initialization failed:", error);
        displayLoading(false);
        displayError(`Initialization failed: ${error.message}`);
    }
}

// --- Start the application ---
initializeApp();