// search-worker.js — off-thread log search
// Receives entries once on file load; then handles search queries off the main thread.
// Catastrophic regex backtracking is contained: the main thread times out the worker
// after 500 ms and terminates it, then restarts a fresh one.

let _entries = [];

self.onmessage = function({ data }) {
    if (data.type === 'setEntries') {
        _entries = data.entries;
        return;
    }
    if (data.type === 'search') {
        const { id, query, isRegex, caseSensitive } = data;
        if (!query) {
            self.postMessage({ type: 'result', id, indices: null });
            return;
        }
        const t0 = Date.now();
        const indices = [];
        try {
            if (isRegex) {
                const flags = caseSensitive ? '' : 'i';
                const re = new RegExp(query, flags);
                for (let i = 0; i < _entries.length; i++) {
                    re.lastIndex = 0;
                    if (re.test(_entries[i].content) || re.test(_entries[i].type))
                        indices.push(i);
                }
            } else {
                const q = caseSensitive ? query : query.toLowerCase();
                for (let i = 0; i < _entries.length; i++) {
                    const e = _entries[i];
                    const c = caseSensitive ? e.content : e.content.toLowerCase();
                    const t = caseSensitive ? e.type   : e.type.toLowerCase();
                    if (c.includes(q) || t.includes(q)) indices.push(i);
                }
            }
        } catch (err) {
            self.postMessage({ type: 'error', id, message: err.message });
            return;
        }
        self.postMessage({ type: 'result', id, indices, ms: Date.now() - t0 });
    }
};
