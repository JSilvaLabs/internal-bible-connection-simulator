# -*- coding: utf-8 -*-
"""
Script to preprocess Bible data for the Internal Bible Connection Simulator.

Input:
1. A USFX Bible file package (containing .xml files).
2. A cross-reference file (e.g., cross_references.txt).

Output:
1. ../data/bibleMeta.json: Contains book names, abbreviations, and chapter/verse counts (Protestant Canon).
2. ../data/webBibleText.json: Contains {VerseID: "Verse Text"} pairs (Protestant Canon).
3. ../data/crossRefs.json: Contains {VerseID: [RefVerseID1, RefVerseID2,...]} pairs.
"""

import json
import os
import re
import xml.etree.ElementTree as ET

# --- Configuration ---
# Assumes the unzipped folder structure
METADATA_SOURCE_FILE = '../source_data/engwebu_usfx/engwebumetadata.xml' # Path to metadata
BOOKNAMES_SOURCE_FILE = '../source_data/engwebu_usfx/BookNames.xml' # Separate book names file
USFX_SOURCE_FILE = '../source_data/engwebu_usfx/engwebu_usfx.xml'    # Main scripture text
CROSSREF_SOURCE_FILE = '../source_data/cross_references.txt'
OUTPUT_DIR = '../data/'

# --- Define Standard 66-Book Protestant Canon (Using 3-Letter Codes) ---
PROTESTANT_CANON_CODES = {
    "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
    "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
    "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
    "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT",
    "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP",
    "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE",
    "2PE", "1JN", "2JN", "3JN", "JUD", "REV"
}
# Note: Corrected EZK for Ezekiel based on your previous output

print("--- Bible Data Preprocessing Started ---")
print(f"Metadata Source: {os.path.abspath(METADATA_SOURCE_FILE)}") # Included for reference, not directly used yet
print(f"BookNames Source: {os.path.abspath(BOOKNAMES_SOURCE_FILE)}")
print(f"USFX Source: {os.path.abspath(USFX_SOURCE_FILE)}")
print(f"CrossRef Source: {os.path.abspath(CROSSREF_SOURCE_FILE)}")
print(f"Output Directory: {os.path.abspath(OUTPUT_DIR)}")

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- Abbreviation Mapping (For Cross-Reference File) ---
# *** REVIEW AND ADJUST THIS MAP BASED ON YOUR cross_references.txt ***
ABBR_MAP = {
    'Gen': 'GEN', 'Exod': 'EXO', 'Ex': 'EXO', 'Lev': 'LEV', 'Num': 'NUM', 'Deut': 'DEU',
    'Josh': 'JOS', 'Judg': 'JDG', 'Jdgs': 'JDG', 'Ruth': 'RUT',
    '1 Sam': '1SA', '2 Sam': '2SA', '1Sam': '1SA', '2Sam': '2SA',
    '1 Kgs': '1KI', '1Kgs': '1KI', # Added
    '2 Kgs': '2KI', '2Kgs': '2KI', # Added
    '1 Chr': '1CH', '1Chr': '1CH', # Added
    '2 Chr': '2CH', '2Chr': '2CH', # Added
    'Ezra': 'EZR', 'Neh': 'NEH', 'Esth': 'EST', 'Job': 'JOB', 'Ps': 'PSA', 'Psa': 'PSA',
    'Prov': 'PRO', 'Eccl': 'ECC', 'Song': 'SNG', 'Isa': 'ISA', 'Jer': 'JER',
    'Lam': 'LAM', 'Ezek': 'EZK', 'Dan': 'DAN', 'Hos': 'HOS', 'Joel': 'JOL',
    'Amos': 'AMO', 'Obad': 'OBA', 'Jonah': 'JON', 'Mic': 'MIC', 'Nah': 'NAM',
    'Hab': 'HAB', 'Zeph': 'ZEP', 'Hag': 'HAG', 'Zech': 'ZEC', 'Mal': 'MAL',
    'Matt': 'MAT', 'Mark': 'MRK', 'Mk': 'MRK', 'Luke': 'LUK', 'Lk': 'LUK',
    'John': 'JHN', 'Jn': 'JHN',
    'Acts': 'ACT', 'Rom': 'ROM',
    '1 Cor': '1CO', '1Cor': '1CO', # Added
    '2 Cor': '2CO', '2Cor': '2CO', # Added
    'Gal': 'GAL', 'Eph': 'EPH', 'Phil': 'PHP', 'Col': 'COL',
    '1 Thess': '1TH', '1Thess': '1TH', # Added
    '2 Thess': '2TH', '2Thess': '2TH',# Potential addition if needed
    '1 Tim': '1TI', '1Tim': '1TI',   # Added
    '2 Tim': '2TI', # Potential addition if needed
    'Titus': 'TIT', 'Phlm': 'PHM', 'Heb': 'HEB', 'Jas': 'JAS',
    '1 Pet': '1PE', '1Pet': '1PE',# Potential addition if needed
    '2 Pet': '2PE', '2Pet': '2PE',   # Added
    '1 John': '1JN', '1John': '1JN', # Added
    '2 John': '2JN', # Potential addition if needed
    '3 John': '3JN', # Potential addition if needed
    'Jude': 'JUD', 'Rev': 'REV',
}
print(f"Loaded {len(ABBR_MAP)} cross-reference abbreviation mappings.")


# --- Verse Reference Standardization Function (WITH DEBUGGING) ---
# Regex to capture Book, Chapter, first Verse, and optionally ignore a range part
# Corrected regex to use PERIOD between chapter/verse and allow zero spaces
verse_pattern = re.compile(r'^\s*(\d*\s*[a-zA-Z]+)\.?\s*(\d+)\.(\d+)(?:-\s*(?:\d+|[a-zA-Z]+\.?\s*\d+\.\d+))?\s*$')

DEBUG_REF_STANDARDIZE = True # Set to True to enable debug prints
DEBUG_REF_LIMIT = 30 # Limit number of debug prints to avoid flooding terminal
debug_ref_count = 0

def standardize_verse_ref(ref_string, local_abbr_map, known_canon_abbrs_set):
    """Standardizes verse ref string from cross-ref file."""
    global debug_ref_count # Allow modification of global counter

    match = verse_pattern.match(ref_string)
    if match:
        book_part = match.group(1).strip()
        chapter = match.group(2)
        verse = match.group(3)

        # Try mapping first
        canon_abbr = local_abbr_map.get(book_part)
        if canon_abbr and canon_abbr in known_canon_abbrs_set:
            # Successfully mapped and known canon book
            return f"{canon_abbr} {chapter}:{verse}"
        else:
            # Try direct match if not in map (case-insensitive check against known codes)
             upper_book_part = book_part.upper()
             if book_part in known_canon_abbrs_set:
                 # Direct match (e.g., "GEN" was used in ref file)
                 return f"{book_part} {chapter}:{verse}"
             elif upper_book_part in known_canon_abbrs_set:
                  # Case-insensitive direct match (e.g., "gen" used in ref file)
                  return f"{upper_book_part} {chapter}:{verse}"
             else:
                 # --- DEBUG PRINT on failure to map/match book ---
                 if DEBUG_REF_STANDARDIZE and debug_ref_count < DEBUG_REF_LIMIT:
                      # Check if it failed because book_part wasn't in ABBR_MAP or because the mapped value wasn't in known_canon_abbrs_set
                      mapped_value = local_abbr_map.get(book_part, "Not in ABBR_MAP")
                      is_mapped_in_canon = 'Yes' if mapped_value != "Not in ABBR_MAP" and mapped_value in known_canon_abbrs_set else 'No'

                      print(f"\nDEBUG standardize_verse_ref: Failed book part.")
                      print(f"  Input='{ref_string}'")
                      print(f"  Extracted Book Part='{book_part}'")
                      print(f"  Mapped Value='{mapped_value}'")
                      print(f"  Is Mapped Value in Canon Set? {is_mapped_in_canon}")
                      print(f"  Direct Match Check (Case Sensitive: {book_part in known_canon_abbrs_set}, Case Insensitive: {upper_book_part in known_canon_abbrs_set})")
                      debug_ref_count += 1
    else:
        # --- DEBUG PRINT on regex match failure ---
        if DEBUG_REF_STANDARDIZE and debug_ref_count < DEBUG_REF_LIMIT:
            print(f"\nDEBUG standardize_verse_ref: Regex failed to match. Input='{ref_string}'")
            debug_ref_count += 1

    return None # Return None if any step failed


# ============================================================================
# --- Main Processing Logic ---
# ============================================================================

bible_meta_list = []
bible_text_dict = {}
book_code_to_name = {} # Map 3-letter code -> short name
book_order = [] # Canonical Protestant 3-letter codes in order

try:
    # --- Step 1: Read Book Names from BookNames.xml ---
    print(f"Reading book names from: {BOOKNAMES_SOURCE_FILE}")
    if not os.path.exists(BOOKNAMES_SOURCE_FILE):
        raise FileNotFoundError(f"BookNames source file not found at {BOOKNAMES_SOURCE_FILE}")

    booknames_tree = ET.parse(BOOKNAMES_SOURCE_FILE)
    booknames_root = booknames_tree.getroot()
    for book_elem in booknames_root.findall('.//book'):
        code = book_elem.get('code')
        short_name = book_elem.get('short')
        if code and short_name:
            book_code_to_name[code] = short_name
    print(f"Read {len(book_code_to_name)} book names mappings.")
    if not book_code_to_name:
        raise ValueError("Failed to read book names from BookNames.xml")


    # --- Step 2: Process USFX Scripture Text ---
    print(f"Processing USFX scripture file: {USFX_SOURCE_FILE}...")
    if not os.path.exists(USFX_SOURCE_FILE):
        raise FileNotFoundError(f"USFX source file not found at {USFX_SOURCE_FILE}")

    tree = ET.parse(USFX_SOURCE_FILE)
    root = tree.getroot()

    book_elements = root.findall('.//book')
    if not book_elements: book_elements = root.findall('./book')
    if not book_elements: raise ValueError("Could not find <book> elements in USFX.")

    processed_book_count = 0
    # --- Iterate Through Books ---
    for book_element in book_elements:
        book_abbr = book_element.get('id') # The 3-letter code (e.g., GEN)

        # --- Filter for Protestant Canon ---
        if not book_abbr or book_abbr not in PROTESTANT_CANON_CODES:
            continue # Skip non-Protestant books

        current_book_name = book_code_to_name.get(book_abbr, book_abbr) # Use mapped name

        print(f"  Processing Book: {book_abbr} ({current_book_name})")
        book_order.append(book_abbr)
        chapter_verse_counts = []
        last_verse_in_chapter = 0
        current_chapter_num = 0 # Track current chapter number

        # --- Iterate through ALL DIRECT CHILDREN of the <book> element ---
        for book_child_node in book_element:
            # Is this node a chapter marker (<c>)?
            if book_child_node.tag == 'c':
                # Finalize count for the previous chapter before starting new one
                if current_chapter_num > 0 and last_verse_in_chapter > 0:
                    chapter_verse_counts.append(last_verse_in_chapter)
                elif current_chapter_num > 0: # Chapter marker found but no verses counted?
                     print(f"Warning: Chapter {book_abbr} {current_chapter_num} ended with verse count zero.")
                     chapter_verse_counts.append(0)

                # Update to the new chapter number
                chapter_num_str = book_child_node.get('id')
                try:
                    current_chapter_num = int(chapter_num_str)
                    last_verse_in_chapter = 0 # Reset verse count for new chapter
                except (ValueError, TypeError):
                    print(f"Warning: Invalid chapter id '{chapter_num_str}' in {book_abbr}. Stopping chapter processing for this book.")
                    current_chapter_num = 0 # Mark as invalid chapter state
                    break # Exit chapter processing loop for this book

            # Is this node something else (like <p>) AND are we inside a valid chapter?
            elif current_chapter_num > 0 and hasattr(book_child_node, 'tag'): # Ensure it's an element
                # Now process the descendants of *this* node (e.g., the <p> tag)
                # for verses belonging to current_chapter_num
                current_verse_num = 0
                verse_text_buffer = ""
                collecting_text_for_verse = 0

                # Use iter() to traverse ALL descendants within this node (e.g., <p>)
                nodes_to_process = list(book_child_node.iter())
                node_index = 0
                while node_index < len(nodes_to_process):
                    inner_node = nodes_to_process[node_index]

                    # Check if inner_node is an element before accessing tag
                    is_element = hasattr(inner_node, 'tag')

                    # --- Start of Verse Tag <v id="..."> ---
                    if is_element and inner_node.tag == 'v':
                        verse_num_str = inner_node.get('id')
                        try:
                            current_verse_num = int(verse_num_str)
                            # Save previous verse's text if buffer wasn't empty
                            if collecting_text_for_verse > 0:
                                prev_verse_id = f"{book_abbr} {current_chapter_num}:{collecting_text_for_verse}"
                                cleaned_text = re.sub(r'\s+', ' ', verse_text_buffer).strip()
                                if cleaned_text: bible_text_dict[prev_verse_id] = cleaned_text

                            # Start collecting for the new verse number
                            collecting_text_for_verse = current_verse_num
                            verse_text_buffer = "" # Reset buffer
                            last_verse_in_chapter = max(last_verse_in_chapter, current_verse_num)
                        except (ValueError, TypeError):
                            print(f"Warning: Invalid verse id '{verse_num_str}' in {book_abbr} {current_chapter_num}.")
                            collecting_text_for_verse = 0 # Stop if id is bad
                        # Add tail text of the <v> tag itself
                        if hasattr(inner_node, 'tail') and inner_node.tail and collecting_text_for_verse > 0:
                             verse_text_buffer += inner_node.tail.strip() + " "

                    # --- End of Verse Tag <ve/> ---
                    elif is_element and inner_node.tag == 've':
                        # Save text of the verse we were just collecting for
                        if collecting_text_for_verse > 0:
                            verse_id = f"{book_abbr} {current_chapter_num}:{collecting_text_for_verse}"
                            cleaned_text = re.sub(r'\s+', ' ', verse_text_buffer).strip()
                            if cleaned_text: bible_text_dict[verse_id] = cleaned_text
                        collecting_text_for_verse = 0 # Stop collecting

                    # --- Text/Word Content (if currently collecting) ---
                    elif collecting_text_for_verse > 0:
                        current_text = ""
                        # Check if it's a tag with text content (like <w>)
                        if is_element and hasattr(inner_node, 'text') and inner_node.text:
                             if inner_node.tag == 'w':
                                 current_text = inner_node.text.strip()
                             # Add other tags like <char> if needed based on XML inspection
                             # elif inner_node.tag == 'char':
                             #    current_text = inner_node.text.strip()

                        # Add text from the tag
                        if current_text:
                            verse_text_buffer += current_text + " "

                        # Add tail text (text between end of this tag and start of next)
                        if hasattr(inner_node, 'tail') and inner_node.tail:
                            # Only add tail if the node is likely an inline element
                            if is_element and inner_node.tag in ('w', 'char', 'ref', 'bk', 'v'): # Added 'v' just in case
                                verse_text_buffer += inner_node.tail.strip() + " "
                            # Avoid adding tail from block elements like <p> itself

                    node_index += 1
                # --- End of inner node processing ---
            # --- End of handling non-<c> book child node ---
        # --- End of book children loop ---

        # Add the verse count for the *last* chapter of the book
        if current_chapter_num > 0 and last_verse_in_chapter > 0:
            chapter_verse_counts.append(last_verse_in_chapter)
        elif current_chapter_num > 0: # Last chapter existed but no verses counted?
            print(f"Warning: Last chapter ({book_abbr} {current_chapter_num}) ended with verse count zero.")
            chapter_verse_counts.append(0)


        # Store book metadata if chapters were processed
        if chapter_verse_counts:
            bible_meta_list.append({
                "book_name": current_book_name,
                "book_abbr": book_abbr,
                "chapters": chapter_verse_counts
            })
            processed_book_count += 1
        else:
            print(f"Warning: Skipping book {book_abbr} ({current_book_name}) - no chapters/verses processed after full iteration.")
    # --- End of book loop ---

    print(f"USFX processing complete. Processed {processed_book_count} Protestant books.")
    if processed_book_count != 66:
        print(f"Warning: Expected 66 Protestant books, but processed {processed_book_count}.")
    if processed_book_count == 0: raise ValueError("No Protestant book data extracted.")


    # --- Step 3: Save Bible Meta and Text ---
    print("Saving bibleMeta.json and webBibleText.json...")
    meta_output_path = os.path.join(OUTPUT_DIR, 'bibleMeta.json')
    text_output_path = os.path.join(OUTPUT_DIR, 'webBibleText.json')
    # Ensure book order in meta file matches the actual processing order
    final_meta_list = [meta for book_code in book_order for meta in bible_meta_list if meta['book_abbr'] == book_code]

    with open(meta_output_path, 'w', encoding='utf-8') as f:
       json.dump(final_meta_list, f, ensure_ascii=False, indent=2) # Save ordered list
    print(f"Saved {meta_output_path}")
    with open(text_output_path, 'w', encoding='utf-8') as f:
       json.dump(bible_text_dict, f, ensure_ascii=False)
    print(f"Saved {text_output_path} ({len(bible_text_dict)} verses)")


    # --- Step 4: Process Cross References ---
    print(f"Processing cross-reference file: {CROSSREF_SOURCE_FILE}...")
    refs_intermediate = {}
    known_verses = set(bible_text_dict.keys())
    known_canon_abbrs_set = set(book_order) # Use the 3-letter codes from processed books

    processed_lines = 0; added_ref_pairs = 0; skipped_lines = 0; unmatched_refs = 0
    try:
        with open(CROSSREF_SOURCE_FILE, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f):
                processed_lines += 1
                if line.startswith('#') or not line.strip(): skipped_lines += 1; continue
                parts = line.strip().split('\t')
                if len(parts) >= 2:
                    raw_a, raw_b = parts[0], parts[1]
                    std_a = standardize_verse_ref(raw_a, ABBR_MAP, known_canon_abbrs_set)
                    std_b = standardize_verse_ref(raw_b, ABBR_MAP, known_canon_abbrs_set)
                    if std_a and std_b and std_a != std_b:
                        # Only add references between verses that are in our Protestant text dict
                        if std_a in known_verses and std_b in known_verses:
                            # Check if the link already exists implicitly before incrementing pair count
                            if std_b not in refs_intermediate.get(std_a, set()):
                                added_ref_pairs += 1 # Count unique A<->B pairs
                            refs_intermediate.setdefault(std_a, set()).add(std_b)
                            refs_intermediate.setdefault(std_b, set()).add(std_a)
                        else: unmatched_refs += 1
                    else: skipped_lines += 1
                else: skipped_lines += 1
        num_verses_with_refs = len(refs_intermediate)

        print(f"Cross-reference processing: Processed {processed_lines} lines.")
        print(f"  Skipped {skipped_lines} lines (comments, blanks, errors).") # Clarified skipped reason
        print(f"  Found {added_ref_pairs} unique reference pairs involving {num_verses_with_refs} source verses.")
        if unmatched_refs > 0: print(f"  Warning: {unmatched_refs} ref pairs skipped (verse not found in processed text).")
    except FileNotFoundError:
         print(f"WARNING: Cross-reference file not found at {CROSSREF_SOURCE_FILE}. Skipping.")
         final_cross_refs = {} # Ensure variable exists but is empty


    # --- Step 5: Finalize and Save CrossRefs ---
    print("Finalizing and saving crossRefs.json...")
    final_cross_refs = {verse: sorted(list(refs_set)) for verse, refs_set in refs_intermediate.items()}
    refs_output_path = os.path.join(OUTPUT_DIR, 'crossRefs.json')
    with open(refs_output_path, 'w', encoding='utf-8') as f:
        json.dump(final_cross_refs, f, ensure_ascii=False)
    print(f"Saved {refs_output_path}")

    print("--- Data Preparation Complete ---")


# --- Error Handling ---
except FileNotFoundError as e: print(f"\nFATAL ERROR: Required file not found.\n{e}")
except ET.ParseError as e: print(f"\nFATAL ERROR: Failed to parse XML.\n{e}")
except ValueError as e: print(f"\nFATAL ERROR during processing: {e}")
except Exception as e:
     print(f"\nFATAL UNEXPECTED ERROR: {e}")
     import traceback
     traceback.print_exc()