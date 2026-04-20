// log-parser.js — client-side Unreal Engine log parser
// Mirrors the regex and logic that previously lived in Python _parse_log_lines().
// Log data never leaves the browser; this module does all parsing locally.

// Regex pattern to extract log category from Unreal Engine log lines.
// Handles both timestamped and plain formats:
//   [2024.01.15-10.30.45:123][  0]LogCore: Display: message  (with timestamp)
//   LogCore: Display: message                                  (without timestamp)
//
// Group 1: timestamp string from the first bracket (e.g. "2024.01.15-10.30.45:123"), or undefined
// Group 2: log category name (e.g. "LogCore")
//
// Uses [^\]]* (any char except ']') instead of .*? for reliable bracket matching.
const LOG_LINE_PATTERN = /^(?:\[([^\]]*)\]\s*)?(?:\[[^\]]*\]\s*)*([A-Za-z][A-Za-z0-9_]*)\s*:/;

/**
 * Parse Unreal Engine log text into structured entries.
 *
 * Non-matching lines that follow a matched entry are treated as continuation
 * lines (e.g. callstack frames from a Fatal error) and appended to the
 * previous entry's content with a '\n' separator.  This allows the full
 * callstack to live on a single entry so it can be rendered with preserved
 * line breaks (white-space: pre-wrap).
 *
 * @param {string} text - Raw log file content (full text, not pre-split)
 * @returns {{ entries: Array<{type: string, content: string, timestamp?: string}>,
 *             logTypes: Array<{type: string, count: number}> }}
 */
function parseLogLines(text) {
    const lines = text.split('\n');
    const entries = [];
    const logTypeCounts = {};

    for (const rawLine of lines) {
        // trimEnd: keep any leading whitespace (indented callstack lines) but
        // strip trailing \r on Windows line endings.
        const line = rawLine.trimEnd();

        if (!line.trim()) {
            // Blank line — not a log entry and not useful as a continuation.
            continue;
        }

        const match = LOG_LINE_PATTERN.exec(line);

        if (match) {
            const timestamp = match[1] !== undefined ? match[1] : undefined;
            const logCategory = match[2];
            const contentStart = match[0].length;
            logTypeCounts[logCategory] = (logTypeCounts[logCategory] || 0) + 1;
            const entry = {
                type: logCategory,
                content: line.slice(contentStart).trim()
            };
            if (timestamp !== undefined) {
                entry.timestamp = timestamp;
            }
            entries.push(entry);
        } else if (entries.length > 0) {
            // Continuation line (e.g. a callstack frame after "Fatal error:").
            // Append to the most recent entry so the full stack is one unit.
            entries[entries.length - 1].content += '\n' + line;
        }
        // Lines before the first matched entry that don't match are dropped —
        // they're typically file headers or blank preamble.
    }

    // Sort log types alphabetically, matching the old backend behaviour.
    const logTypes = Object.keys(logTypeCounts)
        .sort()
        .map(t => ({ type: t, count: logTypeCounts[t] }));

    return { entries, logTypes };
}

// Expose for app.js and any inline test harnesses.
window.LogParser = { parseLogLines };
