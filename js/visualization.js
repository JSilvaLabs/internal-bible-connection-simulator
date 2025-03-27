import { sanitizeForCSS } from './utils.js';

// --- Module Scope Variables ---
let svg, mainGroup; // D3 selections for SVG elements
let width, height, radius, innerRadius; // Dimensions

let bibleMeta = null; // Bible structure data
let getCrossRefsCallback = null; // Function to retrieve cross-refs for a verse
let onVerseHoverCallback = null; // Callback for hover events
let onVerseClickCallback = null; // Callback for click events

let angleScale = null; // D3 scale mapping verse index to angle
let versePositionsMap = new Map(); // Map<verseId, { verseId, book, chapter, verse, startAngle, endAngle, midAngle, centroidX, centroidY }>
let bookLayoutData = []; // Array of { book_abbr, startAngle, endAngle } for drawing book arcs

let allConnectionPairs = []; // Array of { source: verseId, target: verseId }

let currentlyHoveredVerseId = null;
let currentlySelectedVerseId = null;

// --- Constants ---
const BOOK_ARC_THICKNESS = 30; // How thick the book arcs are
const CONNECTION_RADIUS_OFFSET = 5; // Offset inwards from inner book radius for connection points

// --- Initialization ---

/**
 * Initializes the D3 visualization.
 * @param {string} containerSelector - CSS selector for the container div.
 * @param {Array} meta - Bible metadata.
 * @param {Function} getRefsFunc - Function to get cross-references for a verseId.
 * @param {Function} hoverCallback - Callback when a verse is hovered.
 * @param {Function} clickCallback - Callback when a verse is clicked.
 */
function init(containerSelector, meta, getRefsFunc, hoverCallback, clickCallback) {
    console.log("Initializing Visualization...");
    bibleMeta = meta;
    getCrossRefsCallback = getRefsFunc;
    onVerseHoverCallback = hoverCallback;
    onVerseClickCallback = clickCallback;

    // --- Setup SVG ---
    const container = d3.select(containerSelector);
    if (container.empty()) {
        console.error(`Visualization container "${containerSelector}" not found.`);
        return;
    }
    container.selectAll('*').remove(); // Clear previous content

    const containerRect = container.node().getBoundingClientRect();
    // Use the smaller dimension to ensure the circle fits
    width = containerRect.width;
    height = containerRect.height;
    const outerRadius = Math.min(width, height) / 2 - 30; // Outer radius with padding
    radius = outerRadius; // Use outerRadius as the main radius reference
    innerRadius = radius - BOOK_ARC_THICKNESS; // Inner radius for book arcs

    svg = container.append('svg')
        .attr('width', width)
        .attr('height', height);

    mainGroup = svg.append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`); // Center the visualization

    // --- Calculate Layout & Draw ---
    try {
        calculateLayout();
        prepareConnectionData();
        drawBaseCircle();
        drawConnections();
        attachEventListeners();
        console.log("Visualization initialized successfully.");
    } catch (error) {
        console.error("Error during visualization setup:", error);
        // Optionally display error in the container
        container.append('p').style('color', 'red').text(`Error: ${error.message}`);
    }
}

// --- Layout Calculation ---

function calculateLayout() {
    console.log("Calculating layout...");
    versePositionsMap.clear();
    bookLayoutData = [];
    let totalVerses = 0;
    let currentVerseIndex = 0;

    // 1. Calculate total verses
    bibleMeta.forEach(book => {
        book.chapters.forEach(verseCount => {
            totalVerses += verseCount;
        });
    });
    if (totalVerses === 0) throw new Error("No verses found in metadata.");

    // 2. Define angle scale
    // Maps verse index [0, totalVerses] to angle [0, 2*PI)
    // Adding a small gap at the end for visual separation (optional)
    const angleRange = [0, 2 * Math.PI * (totalVerses / (totalVerses + 1))];
    angleScale = d3.scaleLinear().domain([0, totalVerses]).range(angleRange);

    // 3. Calculate positions for each verse and book boundaries
    const connectionPointRadius = innerRadius - CONNECTION_RADIUS_OFFSET;

    bibleMeta.forEach(book => {
        const bookStartIndex = currentVerseIndex;
        const bookStartAngle = angleScale(bookStartIndex);

        book.chapters.forEach((verseCount, chapterIndex) => {
            for (let verseNum = 1; verseNum <= verseCount; verseNum++) {
                const verseId = `${book.book_abbr} ${chapterIndex + 1}:${verseNum}`;
                const startAngle = angleScale(currentVerseIndex);
                const endAngle = angleScale(currentVerseIndex + 1);
                const midAngle = (startAngle + endAngle) / 2;

                // Calculate centroid coordinates for connection lines (using fixed radius)
                // D3 arcs have 0 angle at 12 o'clock, positive clockwise. Math uses 3 o'clock. Adjust: - Math.PI / 2
                const centroidX = connectionPointRadius * Math.cos(midAngle - Math.PI / 2);
                const centroidY = connectionPointRadius * Math.sin(midAngle - Math.PI / 2);

                versePositionsMap.set(verseId, {
                    verseId, book: book.book_abbr, chapter: chapterIndex + 1, verse: verseNum,
                    startAngle, endAngle, midAngle,
                    centroidX, centroidY
                });
                currentVerseIndex++;
            }
        });

        const bookEndAngle = angleScale(currentVerseIndex);
        bookLayoutData.push({
            book_abbr: book.book_abbr,
            book_name: book.book_name,
            startAngle: bookStartAngle,
            endAngle: bookEndAngle
        });
    });

    console.log(`Layout calculated for ${totalVerses} verses.`);
    // console.log("Sample verse position:", versePositionsMap.get("Gen 1:1"));
}

// --- Data Preparation ---
function prepareConnectionData() {
    console.log("Preparing connection data...");
    allConnectionPairs = [];
    const addedPairs = new Set(); // To avoid duplicate lines (A->B and B->A)

    for (const sourceVerseId of versePositionsMap.keys()) {
        const targets = getCrossRefsCallback(sourceVerseId) || [];
        targets.forEach(targetVerseId => {
            // Ensure target verse exists in our layout and avoid self-references
            if (versePositionsMap.has(targetVerseId) && sourceVerseId !== targetVerseId) {
                // Create a canonical key for the pair to avoid duplicates
                const pairKey = [sourceVerseId, targetVerseId].sort().join('--');
                if (!addedPairs.has(pairKey)) {
                    allConnectionPairs.push({ source: sourceVerseId, target: targetVerseId });
                    addedPairs.add(pairKey);
                }
            }
        });
    }
    console.log(`Prepared ${allConnectionPairs.length} unique connection pairs.`);
}


// --- Drawing Functions ---

function drawBaseCircle() {
    console.log("Drawing base circle arcs...");
    const bookArcGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(radius)
        .startAngle(d => d.startAngle)
        .endAngle(d => d.endAngle);

    mainGroup.append('g')
        .attr('class', 'book-arcs-group')
        .selectAll('path.book-arc')
        .data(bookLayoutData)
        .join('path')
          .attr('class', d => `book-arc book-${sanitizeForCSS(d.book_abbr)}`) // Add book-specific class
          .attr('id', d => `arc-${sanitizeForCSS(d.book_abbr)}`) // Add ID for potential direct selection
          .attr('d', bookArcGenerator)
          // Add tooltip / title for book name
          .append('title')
            .text(d => d.book_name);

    // Add a background circle for capturing mouse events reliably
    mainGroup.append('circle')
        .attr('class', 'interaction-target')
        .attr('r', radius) // Cover the entire area up to the arcs
        .style('fill', 'none') // Make it invisible
        .style('pointer-events', 'all'); // Ensure it captures pointer events


    console.log("Base circle arcs drawn.");
}


function drawConnections() {
    console.log("Drawing connections...");
    const connectionsGroup = mainGroup.append('g')
        .attr('class', 'connections-group');

    connectionsGroup.selectAll('path.connection')
        .data(allConnectionPairs, d => `${d.source}--${d.target}`) // Key function for object constancy
        .join('path')
          .attr('class', d => `connection ref-${sanitizeForCSS(d.source)} ref-${sanitizeForCSS(d.target)}`)
          .attr('d', d => {
              const sourcePos = versePositionsMap.get(d.source);
              const targetPos = versePositionsMap.get(d.target);
              if (!sourcePos || !targetPos) return null; // Should not happen if prepareConnectionData is correct
              // Simple straight line for performance
              return `M ${sourcePos.centroidX} ${sourcePos.centroidY} L ${targetPos.centroidX} ${targetPos.centroidY}`;
              // Optional: Could use d3.lineRadial or curve functions for curved lines
          });
    console.log("Connections drawn.");
}

// --- Interaction ---

function attachEventListeners() {
    // Attach listener to the invisible background circle or the arcs group
    mainGroup.select('.interaction-target') // Or '.book-arcs-group' if preferred
        .on('mousemove', handleMouseMove)
        .on('mouseleave', handleMouseLeave) // Handle mouse leaving the interactive area
        .on('click', handleMouseClick);
    console.log("Event listeners attached.");
}

function handleMouseMove(event) {
    // Use d3.pointer to get coordinates relative to the mainGroup <g> element
    const [x, y] = d3.pointer(event, mainGroup.node());

    let angle = Math.atan2(y, x) + Math.PI / 2; // Angle (0 = 12 o'clock, positive clockwise)
    const distance = Math.sqrt(x * x + y * y);

    if (angle < 0) angle += 2 * Math.PI; // Ensure angle is [0, 2*PI)

    let hoveredVerseData = null;
    // Check if mouse is within the general radius of the arcs/connection points
    if (distance <= radius + 10) { // Add some buffer
         hoveredVerseData = findVerseAtAngle(angle);
    }

    const verseId = hoveredVerseData ? hoveredVerseData.verseId : null;

    // Only trigger updates if hover state changes
    if (verseId !== currentlyHoveredVerseId) {
        currentlyHoveredVerseId = verseId; // Update internal state first

        // Update visualization highlights (only hover, don't clear selection)
        clearHoverHighlight();
        if (verseId) {
            highlightVerse(verseId);
        }

        // Notify main controller
        if (onVerseHoverCallback) {
            onVerseHoverCallback(verseId);
        }
    }
}

function handleMouseLeave(event) {
     // When mouse leaves the interactive area completely
     if (currentlyHoveredVerseId !== null) {
         currentlyHoveredVerseId = null;
         clearHoverHighlight();
         if (onVerseHoverCallback) {
            onVerseHoverCallback(null);
        }
     }
}


function handleMouseClick(event) {
    // Similar logic to mouse move to find the verse
    const [x, y] = d3.pointer(event, mainGroup.node());
    let angle = Math.atan2(y, x) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    const distance = Math.sqrt(x * x + y * y);

    let clickedVerseData = null;
    if (distance <= radius + 10) {
        clickedVerseData = findVerseAtAngle(angle);
    }

    const verseId = clickedVerseData ? clickedVerseData.verseId : null;

    if (verseId) {
        // Update visualization selection
        selectVerse(verseId); // This function handles internal state and visual updates

        // Notify main controller
        if (onVerseClickCallback) {
            onVerseClickCallback(verseId);
        }
    } else {
        // Optional: Click outside arcs could clear selection
        // selectVerse(null);
        // if (onVerseClickCallback) onVerseClickCallback(null);
    }
}


function findVerseAtAngle(angle) {
    // Iterate through pre-calculated positions to find matching angle range
    // This is O(N) where N is total verses. Could optimize with binary search
    // or interval tree if performance becomes an issue, but start simple.
    for (const positionData of versePositionsMap.values()) {
        const { startAngle, endAngle } = positionData;
        // Handle wrap-around case for the last verse segment
        let within = false;
        if (startAngle <= endAngle) { // Normal case
            within = angle >= startAngle && angle < endAngle;
        } else { // Wrap-around case (e.g., Rev 22:21)
            within = angle >= startAngle || angle < endAngle;
        }
        if (within) {
            return positionData;
        }
    }
    return null; // No verse found at this angle
}

// --- Visual Update Functions ---

function clearHoverHighlight() {
    mainGroup.selectAll('.connection.highlighted')
        .classed('highlighted', false);
    mainGroup.selectAll('.book-arc.highlighted') // Clear arc highlights too if used
        .classed('highlighted', false);
}

function clearSelection() {
     mainGroup.selectAll('.connection.selected')
        .classed('selected', false);
     mainGroup.selectAll('.book-arc.selected')
        .classed('selected', false);
     currentlySelectedVerseId = null;
}

/**
 * Applies hover highlighting for a given verse. Doesn't affect selection.
 * @param {string | null} verseId The verse ID to highlight, or null to clear.
 */
function highlightVerse(verseId) {
    clearHoverHighlight(); // Clear previous hover
    if (!verseId) return;

    const sanitizedId = sanitizeForCSS(verseId);
    mainGroup.selectAll(`.connection.ref-${sanitizedId}`)
        .classed('highlighted', true)
        .raise(); // Bring highlighted lines to front

    // Optional: Highlight the book arc
    // const positionData = versePositionsMap.get(verseId);
    // if (positionData) {
    //     mainGroup.select(`#arc-${sanitizeForCSS(positionData.book)}`).classed('highlighted', true);
    // }
    console.log("Vis: Highlighting", verseId);
}

/**
 * Applies persistent selection highlighting for a given verse. Clears previous selection.
 * @param {string | null} verseId The verse ID to select, or null to clear selection.
 */
function selectVerse(verseId) {
    clearSelection(); // Clear any previous selection first

    if (!verseId) {
        console.log("Vis: Selection cleared");
        return; // Exit if clearing selection
    }

    currentlySelectedVerseId = verseId; // Update internal state

    const sanitizedId = sanitizeForCSS(verseId);
    mainGroup.selectAll(`.connection.ref-${sanitizedId}`)
        .classed('selected', true)
        .raise(); // Bring selected lines to front

    // Optional: Highlight the book arc persistently
    const positionData = versePositionsMap.get(verseId);
    if (positionData) {
         mainGroup.select(`#arc-${sanitizeForCSS(positionData.book)}`).classed('selected', true);
    }

    console.log("Vis: Selecting", verseId);

    // Also apply hover highlight if the selected verse is also the hovered one?
    // Check currentlyHoveredVerseId and apply .highlighted if needed, or assume selection style is sufficient.
}

// --- Export Public Interface ---
export {
    init,
    highlightVerse, // Allow external trigger (e.g., from UI selector)
    selectVerse,    // Allow external trigger
    clearHoverHighlight as clearHighlight // Expose hover clear maybe
    // No need to export clearSelection, selectVerse(null) does this.
};