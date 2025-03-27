import { getBibleMeta, getVerseText } from './dataLoader.js'; // May need getVerseText for validation
import { parseVerseId } from './utils.js'; // To help with selector updates

// --- Module State & Configuration ---
let onSelectRequestCallback = null; // Function to call when user selects via UI

// --- DOM Element References ---
let elements = {}; // Object to hold references to DOM elements

// --- Initialization ---

/**
 * Initializes the UI Controller.
 * Gets references to DOM elements and attaches event listeners.
 * @param {Function} selectCallback - The function to call (from main.js) when a verse is selected via UI controls.
 */
function init(selectCallback) {
    console.log("Initializing UI Controller...");
    onSelectRequestCallback = selectCallback;

    elements = {
        bookSelect: document.getElementById('book-select'),
        chapterSelect: document.getElementById('chapter-select'),
        verseSelect: document.getElementById('verse-select'),
        goButton: document.getElementById('goto-verse-button'),
        displayTitle: document.getElementById('verse-display-title'),
        displayText: document.getElementById('verse-display-text'),
        connectionsList: document.getElementById('verse-connections-list'),
        loadingIndicator: document.getElementById('loading-indicator'),
        errorMessage: document.getElementById('error-message')
    };

    // --- Event Listeners ---
    elements.bookSelect?.addEventListener('change', handleBookChange);
    elements.chapterSelect?.addEventListener('change', handleChapterChange);
    // Verse select change doesn't need an action here, waits for 'Go' button
    elements.goButton?.addEventListener('click', handleGoButtonClick);
    elements.connectionsList?.addEventListener('click', handleConnectionLinkClick); // Use event delegation

     // Check if elements exist before proceeding
    if (!elements.bookSelect || !elements.chapterSelect || !elements.verseSelect || !elements.goButton || !elements.displayTitle || !elements.displayText || !elements.connectionsList || !elements.loadingIndicator || !elements.errorMessage) {
        console.error("UI Controller Init Error: One or more required DOM elements not found.");
        displayError("UI setup error. Please refresh."); // Show error to user
        return; // Stop initialization if elements are missing
    }

    console.log("UI Controller initialized.");
}

// --- Selector Population ---

/**
 * Populates the Book, Chapter, and Verse dropdown selectors.
 * @param {Array} bibleMeta - The Bible metadata array.
 */
function populateSelectors(bibleMeta) {
    if (!bibleMeta || !elements.bookSelect) return;
    console.log("Populating UI selectors...");

    // Clear existing options
    elements.bookSelect.innerHTML = '';
    elements.chapterSelect.innerHTML = '';
    elements.verseSelect.innerHTML = '';

    // Populate Book Select
    bibleMeta.forEach((book, index) => {
        const option = document.createElement('option');
        option.value = book.book_abbr; // Use abbreviation as value
        option.textContent = book.book_name;
        option.dataset.index = index; // Store index for easy lookup of chapter counts
        elements.bookSelect.appendChild(option);
    });

    // Trigger initial population of Chapter and Verse based on the first book
    handleBookChange(); // This will cascade to handleChapterChange
    console.log("UI selectors populated.");
}

function handleBookChange() {
    if (!elements.bookSelect || !elements.chapterSelect) return;

    const selectedBookOption = elements.bookSelect.options[elements.bookSelect.selectedIndex];
    const bookIndex = parseInt(selectedBookOption.dataset.index, 10);
    const bibleMeta = getBibleMeta(); // Assumes dataLoader has loaded data

    if (bibleMeta && bibleMeta[bookIndex]) {
        const bookData = bibleMeta[bookIndex];
        const numChapters = bookData.chapters.length;

        elements.chapterSelect.innerHTML = ''; // Clear previous chapters
        for (let i = 1; i <= numChapters; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Chapter ${i}`;
            elements.chapterSelect.appendChild(option);
        }
        // Automatically trigger verse update for the newly selected first chapter
        handleChapterChange();
    } else {
        // Handle error case - book data not found
         elements.chapterSelect.innerHTML = '<option>N/A</option>';
         elements.verseSelect.innerHTML = '<option>N/A</option>';
    }
}

function handleChapterChange() {
     if (!elements.bookSelect || !elements.chapterSelect || !elements.verseSelect) return;

    const selectedBookOption = elements.bookSelect.options[elements.bookSelect.selectedIndex];
    const bookIndex = parseInt(selectedBookOption.dataset.index, 10);
    const chapterNum = parseInt(elements.chapterSelect.value, 10);
    const bibleMeta = getBibleMeta();

    if (bibleMeta && bibleMeta[bookIndex] && bibleMeta[bookIndex].chapters[chapterNum - 1] !== undefined) {
        const numVerses = bibleMeta[bookIndex].chapters[chapterNum - 1];

        elements.verseSelect.innerHTML = ''; // Clear previous verses
        for (let i = 1; i <= numVerses; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Verse ${i}`;
            elements.verseSelect.appendChild(option);
        }
    } else {
         // Handle error case - chapter data not found
         elements.verseSelect.innerHTML = '<option>N/A</option>';
    }
}

// --- UI Update Functions ---

/**
 * Updates the verse display panel with new information.
 * @param {string | null} verseId - The verse ID to display (e.g., "Gen 1:1"), or null to clear.
 * @param {string | null} text - The text of the verse, or null.
 * @param {string[]} refs - An array of cross-referenced verse IDs.
 * @param {'hover' | 'select' | 'clear'} displayMode - Indicates the reason for the update.
 */
function updateVerseDisplay(verseId, text, refs = [], displayMode = 'clear') {
    if (!elements.displayTitle || !elements.displayText || !elements.connectionsList) return;

    if (verseId && text) {
        elements.displayTitle.textContent = verseId;
        elements.displayText.textContent = text;
        // Optionally: Scroll text area to top
        elements.displayText.scrollTop = 0;

        // Populate Connections List
        elements.connectionsList.innerHTML = ''; // Clear previous list
        if (refs && refs.length > 0) {
            refs.forEach(refId => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = `#${refId}`; // Use fragment identifier, prevents page reload
                a.textContent = refId;
                a.dataset.verseid = refId; // Store verse ID for click handler
                li.appendChild(a);
                elements.connectionsList.appendChild(li);
            });
        } else {
            elements.connectionsList.innerHTML = '<li>No documented connections.</li>';
        }

    } else {
        // Clear display
        elements.displayTitle.textContent = 'Select or hover over a verse';
        elements.displayText.textContent = '...';
        elements.connectionsList.innerHTML = '';
    }
}


/**
 * Displays or hides the loading indicator.
 * @param {boolean} isLoading - True to show, false to hide.
 */
function displayLoading(isLoading) {
    if (elements.loadingIndicator) {
        elements.loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }
}

/**
 * Displays an error message or clears it.
 * @param {string | null} message - The error message to display, or null to clear.
 */
function displayError(message) {
     if (elements.errorMessage) {
        if (message) {
            elements.errorMessage.textContent = message;
            elements.errorMessage.style.display = 'block';
        } else {
            elements.errorMessage.textContent = '';
            elements.errorMessage.style.display = 'none';
        }
    }
}


// --- Event Handlers ---

function handleGoButtonClick() {
    if (!elements.bookSelect || !elements.chapterSelect || !elements.verseSelect) return;

    const bookAbbr = elements.bookSelect.value;
    const chapter = elements.chapterSelect.value;
    const verse = elements.verseSelect.value;

    if (bookAbbr && chapter && verse) {
        const verseId = `${bookAbbr} ${chapter}:${verse}`;
        console.log("Go button clicked, requesting:", verseId);
        if (onSelectRequestCallback) {
            onSelectRequestCallback(verseId); // Call the callback passed from main.js
        }
    } else {
        console.warn("Cannot 'Go': Invalid selection in dropdowns.");
        displayError("Please ensure Book, Chapter, and Verse are selected.");
    }
}

function handleConnectionLinkClick(event) {
    // Use event delegation: check if the clicked element is an <a> tag within the list
    if (event.target.tagName === 'A' && event.target.dataset.verseid) {
        event.preventDefault(); // Prevent default anchor behavior (jumping/reloading)
        const verseId = event.target.dataset.verseid;
        console.log("Connection link clicked:", verseId);

        // Update the selectors to match the clicked verse ID
        const parsed = parseVerseId(verseId);
        if (parsed && elements.bookSelect) {
            // Find and select the corresponding options in dropdowns
            // This might involve iterating through options or having a quick lookup map
            // For simplicity here, we just trigger the selection request
             if (onSelectRequestCallback) {
                // We also need to update the dropdowns to reflect this new selection
                updateSelectorsToVerse(verseId);
                onSelectRequestCallback(verseId);
            }
        }
    }
}

/**
 * Updates the book, chapter, and verse dropdowns to match a given verse ID.
 * @param {string} verseId The target verse ID (e.g., "Joh 1:1").
 */
function updateSelectorsToVerse(verseId) {
    const parsed = parseVerseId(verseId);
    if (!parsed || !elements.bookSelect || !elements.chapterSelect || !elements.verseSelect) return;

    // Select Book
    let bookFound = false;
    for (let i = 0; i < elements.bookSelect.options.length; i++) {
        if (elements.bookSelect.options[i].value === parsed.book) {
            elements.bookSelect.selectedIndex = i;
            handleBookChange(); // This will update chapters and potentially verses
            bookFound = true;
            break;
        }
    }

    if (!bookFound) return; // Stop if book wasn't found

    // Select Chapter (handleBookChange should have populated chapters)
    let chapterFound = false;
    for (let i = 0; i < elements.chapterSelect.options.length; i++) {
        if (parseInt(elements.chapterSelect.options[i].value, 10) === parsed.chapter) {
            elements.chapterSelect.selectedIndex = i;
             handleChapterChange(); // This will update verses
             chapterFound = true;
             break;
        }
    }

     if (!chapterFound) return; // Stop if chapter wasn't found

     // Select Verse (handleChapterChange should have populated verses)
    for (let i = 0; i < elements.verseSelect.options.length; i++) {
        if (parseInt(elements.verseSelect.options[i].value, 10) === parsed.verse) {
            elements.verseSelect.selectedIndex = i;
            break;
        }
    }
    console.log(`Selectors updated to ${verseId}`);
}


// --- Export Public Interface ---
export {
    init,
    populateSelectors,
    updateVerseDisplay,
    displayLoading,
    displayError,
    updateSelectorsToVerse // Export this if main.js needs to trigger it externally
};