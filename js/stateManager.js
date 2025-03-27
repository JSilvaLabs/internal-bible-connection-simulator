// --- Module State ---

let currentlyHoveredVerseId = null;
let currentlySelectedVerseId = null;

// --- State Modifiers (Setters) ---

/**
 * Sets the currently hovered verse ID in the application state.
 * @param {string | null} verseId The verse ID being hovered, or null if none.
 */
function setHoveredVerse(verseId) {
    if (verseId !== currentlyHoveredVerseId) {
        // console.log(`Hover state changed: ${currentlyHoveredVerseId} -> ${verseId}`); // Optional: for debugging hover
        currentlyHoveredVerseId = verseId;
    }
}

/**
 * Sets the currently selected verse ID in the application state.
 * @param {string | null} verseId The verse ID being selected, or null to clear selection.
 */
function setSelectedVerse(verseId) {
    if (verseId !== currentlySelectedVerseId) {
        console.log(`Selection state changed: ${currentlySelectedVerseId} -> ${verseId}`); // Optional: for debugging selection
        currentlySelectedVerseId = verseId;
        // When a selection changes, the hover state is implicitly cleared conceptually,
        // though the mouse might still be over it. Resetting hover state here can simplify logic elsewhere.
        // setHoveredVerse(null); // Decide if this automatic reset is desired. Might depend on interaction flow.
    }
}

// --- State Accessors (Getters) ---

/**
 * Gets the ID of the verse currently being hovered over.
 * @returns {string | null} The hovered verse ID, or null if none.
 */
function getHoveredVerse() {
    return currentlyHoveredVerseId;
}

/**
 * Gets the ID of the verse currently selected by the user.
 * @returns {string | null} The selected verse ID, or null if none.
 */
function getSelectedVerse() {
    return currentlySelectedVerseId;
}

// --- Export Public Interface ---
export {
    setHoveredVerse,
    setSelectedVerse,
    getHoveredVerse,
    getSelectedVerse
};