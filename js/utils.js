/**
 * Sanitizes a string, typically a verse ID (like "Gen 1:1"),
 * so it can be safely used as part of a CSS class name or ID selector.
 * Replaces common problematic characters (spaces, colons) with underscores.
 *
 * @param {string} id The input string (e.g., verse ID).
 * @returns {string} The sanitized string suitable for CSS.
 */
function sanitizeForCSS(id) {
    if (typeof id !== 'string') {
        return ''; // Return empty string for non-string input
    }
    // Replace one or more occurrences of space or colon with a single underscore
    return id.replace(/[\s:]+/g, '_');
}

/**
 * (Optional) Parses a standard verse ID string into an object.
 * Example: "Gen 1:1" -> { book: "Gen", chapter: 1, verse: 1 }
 * Handles potential variations in spacing.
 *
 * @param {string} verseId The verse ID string.
 * @returns {object|null} An object with book, chapter, verse, or null if parsing fails.
 */
function parseVerseId(verseId) {
    if (typeof verseId !== 'string') return null;

    // Regex: Match Book (letters, possibly digits like 1Jn), space(s), Chapter (digits), colon, Verse (digits)
    // Allows for variation in spacing around book name.
    const match = verseId.trim().match(/^([a-zA-Z0-9]+)\s+(\d+):(\d+)$/);

    if (match) {
        return {
            book: match[1],
            chapter: parseInt(match[2], 10),
            verse: parseInt(match[3], 10)
        };
    } else {
        console.warn(`Could not parse verse ID: ${verseId}`);
        return null; // Failed to parse
    }
}


// Export the utility functions
export {
    sanitizeForCSS,
    parseVerseId // Exporting the optional parser as well
};