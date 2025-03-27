// --- Internal Module State ---
let bibleMeta = null;       // Will hold the array of book metadata
let bibleTextMap = new Map(); // Will hold verseId -> verseText
let crossRefsMap = new Map(); // Will hold verseId -> [refVerseId1, refVerseId2, ...]

// --- Constants ---
const META_PATH = 'data/bibleMeta.json';
const TEXT_PATH = 'data/webBibleText.json';
const REFS_PATH = 'data/crossRefs.json';

// --- Core Loading Function ---

/**
 * Asynchronously fetches and processes all required Bible data (metadata, text, cross-references).
 * Populates internal module variables upon success.
 * @returns {Promise<void>} A promise that resolves when loading is complete, or rejects on error.
 */
async function loadAllData() {
    console.log('Starting data load...');
    try {
        const [metaResponse, textResponse, refsResponse] = await Promise.all([
            fetch(META_PATH),
            fetch(TEXT_PATH),
            fetch(REFS_PATH)
        ]);

        // Check if all fetch requests were successful
        if (!metaResponse.ok) throw new Error(`Failed to load ${META_PATH}: ${metaResponse.statusText}`);
        if (!textResponse.ok) throw new Error(`Failed to load ${TEXT_PATH}: ${textResponse.statusText}`);
        if (!refsResponse.ok) throw new Error(`Failed to load ${REFS_PATH}: ${refsResponse.statusText}`);

        // Parse JSON data concurrently
        const [rawMeta, rawText, rawRefs] = await Promise.all([
            metaResponse.json(),
            textResponse.json(),
            refsResponse.json()
        ]);

        // --- Process and Store Data ---

        // 1. Bible Metadata
        if (!Array.isArray(rawMeta)) {
            throw new Error('Invalid format for bibleMeta.json: Expected an array.');
        }
        bibleMeta = rawMeta;
        console.log(`Loaded metadata for ${bibleMeta.length} books.`);

        // 2. Bible Text (convert to Map for efficient lookup)
        bibleTextMap = new Map();
        let textEntries = 0;
        for (const verseId in rawText) {
            if (Object.hasOwnProperty.call(rawText, verseId)) {
                bibleTextMap.set(verseId, rawText[verseId]);
                textEntries++;
            }
        }
        if (textEntries === 0) {
            console.warn('No text entries found in webBibleText.json.');
        } else {
            console.log(`Loaded text for ${textEntries} verses.`);
        }


        // 3. Cross References (convert to Map for efficient lookup)
        crossRefsMap = new Map();
        let refEntries = 0;
        let totalRefs = 0;
        for (const verseId in rawRefs) {
            if (Object.hasOwnProperty.call(rawRefs, verseId)) {
                const references = rawRefs[verseId] || []; // Ensure it's always an array
                if (Array.isArray(references)) {
                    crossRefsMap.set(verseId, references);
                    refEntries++;
                    totalRefs += references.length;
                } else {
                     console.warn(`Invalid reference data for ${verseId}: Expected an array.`);
                }
            }
        }
         if (refEntries === 0) {
            console.warn('No cross-reference entries found in crossRefs.json.');
        } else {
            console.log(`Loaded ${totalRefs} cross-references for ${refEntries} verses.`);
        }

        console.log('Data load and processing complete.');
        // No explicit return value needed for success, promise resolves implicitly.

    } catch (error) {
        console.error('Error during data loading:', error);
        // Clear potentially partially loaded data? Or leave as is? Decide based on desired robustness.
        bibleMeta = null;
        bibleTextMap.clear();
        crossRefsMap.clear();
        // Re-throw the error so the caller (main.js) knows it failed
        throw error;
    }
}

// --- Exported Getter Functions ---

/**
 * Gets the loaded Bible metadata.
 * @returns {Array|null} The array of book metadata objects, or null if not loaded.
 */
function getBibleMeta() {
    return bibleMeta;
}

/**
 * Gets the text for a specific verse.
 * @param {string} verseId - The standardized verse identifier (e.g., "Gen 1:1").
 * @returns {string|undefined} The verse text, or undefined if the verse ID is not found.
 */
function getVerseText(verseId) {
    return bibleTextMap.get(verseId);
}

/**
 * Gets the list of cross-referenced verse IDs for a specific verse.
 * @param {string} verseId - The standardized verse identifier.
 * @returns {string[]} An array of cross-referenced verse IDs. Returns an empty array if the verse has no references or the ID is not found.
 */
function getCrossRefs(verseId) {
    return crossRefsMap.get(verseId) || []; // Always return an array
}

/**
 * Gets all verse IDs that have cross-references associated with them.
 * @returns {string[]} An array of verse IDs.
 */
function getAllVerseIdsWithRefs() {
    return Array.from(crossRefsMap.keys());
}


// --- Export the public functions ---
export {
    loadAllData,
    getBibleMeta,
    getVerseText,
    getCrossRefs,
    getAllVerseIdsWithRefs
};