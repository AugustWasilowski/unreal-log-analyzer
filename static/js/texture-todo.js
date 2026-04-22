/**
 * TextureTodo — classifies parsed texture rows into prioritised issues.
 *
 * Column indices match parseTextureListingTable output:
 *   0 MaxSize, 1 CurrentSize, 2 Format, 3 LODGroup, 4 Name,
 *   5 Streaming, 6 UnknownRef, 7 VT, 8 UsageCount, 9 NumMips, 10 Uncompressed
 */
class TextureTodo {
    static COL = {
        MAX_SIZE: 0, CUR_SIZE: 1, FORMAT: 2, LOD_GROUP: 3, NAME: 4,
        STREAMING: 5, UNK_REF: 6, VT: 7, USAGE_COUNT: 8, NUM_MIPS: 9, UNCOMPRESSED: 10
    };

    static UNCOMPRESSED_FORMATS = new Set([
        'PF_B8G8R8A8', 'PF_FloatRGBA', 'PF_A32B32G32R32F',
        'PF_R32G32B32A32_UINT', 'PF_R32_SINT'
    ]);

    static HDR_FORMATS = new Set(['PF_FloatRGBA', 'PF_A32B32G32R32F']);

    static PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2 };

    // Extract MB from "4096x4096 (65536 KB)"
    static parseSizeMb(curSizeStr) {
        const m = curSizeStr && curSizeStr.match(/\((\d+)\s+KB\)/);
        return m ? parseInt(m[1], 10) / 1024 : 0;
    }

    // Extract {w, h} from "4096x4096 ..."
    static parseDims(sizeStr) {
        const m = sizeStr && sizeStr.match(/^(\d+)x(\d+)/);
        return m ? { w: parseInt(m[1], 10), h: parseInt(m[2], 10) } : { w: 0, h: 0 };
    }

    static isPowerOfTwo(n) {
        return n > 0 && (n & (n - 1)) === 0;
    }

    static nextPow2(n) {
        if (n <= 1) return 1;
        return Math.pow(2, Math.ceil(Math.log2(n)));
    }

    static compressionSuggestion(format, group, w, h) {
        if (this.HDR_FORMATS.has(format)) return 'Compress to BC6H (HDR) or BC7 if LDR content';
        if (group.includes('NormalMap')) return 'Compress to BC5 (normal maps)';
        if (group === 'UI' || group === 'TEXTUREGROUP_UI') {
            if (w > 1024 || h > 1024) {
                return `Scale to ${Math.min(w, 1024)}x${Math.min(h, 1024)}; compress to BC7`;
            }
            return 'Compress to BC7';
        }
        return 'Compress to BC7';
    }

    /**
     * Classify a single texture row.
     * @param {string[]} row - Array of 11 column values
     * @param {number} [minMb=1] - Minimum size threshold
     * @returns {{ priority, assetName, sizeMb, format, group, issues, suggestion } | null}
     */
    static classify(row, minMb = 1) {
        if (!row || row.length < 11) return null;

        const curSizeStr  = row[this.COL.CUR_SIZE];
        const format      = row[this.COL.FORMAT];
        const lodGroup    = row[this.COL.LOD_GROUP].replace('TEXTUREGROUP_', '');
        const name        = row[this.COL.NAME];
        const streaming   = row[this.COL.STREAMING];
        const usageCount  = parseInt(row[this.COL.USAGE_COUNT], 10) || 0;
        const uncompressed = row[this.COL.UNCOMPRESSED];

        const sizeMb = this.parseSizeMb(curSizeStr);
        if (sizeMb < minMb) return null;

        const isTransient = name.startsWith('/Engine/Transient');
        const dims = this.parseDims(curSizeStr);
        const assetName = name.includes('.') ? name.split('.').pop() : name.split('/').pop();

        const issues = [];
        const suggestions = [];
        let priority = null;

        // P0 — uncompressed format
        const isUncompressed = uncompressed === 'YES' || this.UNCOMPRESSED_FORMATS.has(format);
        if (isUncompressed && !isTransient) {
            issues.push(`Uncompressed format (${format})`);
            priority = 'P0';
            suggestions.push(this.compressionSuggestion(format, lodGroup, dims.w, dims.h));
        }

        // P1 — non-streaming + 0 usage
        if (streaming === 'NO' && usageCount === 0 && !isTransient) {
            issues.push('Non-streaming / 0 usage (dormant resident)');
            if (priority === null) priority = 'P1';
            suggestions.push('Verify if active in gameplay loop; consider conditional load or removal');
        }

        // P2 — non-power-of-two dimensions
        if (dims.w > 0 && dims.h > 0 && (!this.isPowerOfTwo(dims.w) || !this.isPowerOfTwo(dims.h))) {
            const pw = this.nextPow2(dims.w);
            const ph = this.nextPow2(dims.h);
            issues.push(`Non-power-of-two dims (${dims.w}x${dims.h})`);
            if (priority === null) priority = 'P2';
            suggestions.push(`Resize to ${pw}x${ph} for optimal GPU memory alignment`);
        }

        if (issues.length === 0) return null;

        return {
            priority,
            assetName,
            fullPath: name,
            sizeMb,
            format,
            group: lodGroup,
            streaming,
            usageCount,
            issues,
            suggestion: [...new Set(suggestions)].join('; '),
        };
    }

    /**
     * Process all texture sections from a parsed memreport.
     * Returns deduplicated, sorted rows ready for display.
     *
     * @param {Object[]} sections - All parsed sections from the memreport
     * @param {number} [minMb=1]
     * @returns {{ rows: Object[], counts: {P0,P1,P2} }}
     */
    static process(sections, minMb = 1) {
        const textureSections = sections.filter(s =>
            s.type === 'table' &&
            s.title && /listing.*texture/i.test(s.title) &&
            Array.isArray(s.columns) && s.columns.includes('Uncompressed')
        );

        if (textureSections.length === 0) return { rows: [], counts: { P0: 0, P1: 0, P2: 0 } };

        // Classify and deduplicate by full asset path
        const byPath = new Map();

        for (const section of textureSections) {
            const sectionLabel = section.title.replace(/Listing\s+/i, '').replace(/\.$/, '').trim();
            for (const row of (section.rows || [])) {
                const result = this.classify(row, minMb);
                if (!result) continue;

                const key = result.fullPath;
                if (!byPath.has(key)) {
                    byPath.set(key, { ...result, appearsIn: [sectionLabel] });
                } else {
                    const existing = byPath.get(key);
                    if (!existing.appearsIn.includes(sectionLabel)) {
                        existing.appearsIn.push(sectionLabel);
                    }
                    // Keep highest priority
                    if ((this.PRIORITY_ORDER[result.priority] ?? 99) < (this.PRIORITY_ORDER[existing.priority] ?? 99)) {
                        existing.priority = result.priority;
                    }
                    // Union issues
                    const issueSet = new Set([...existing.issues, ...result.issues]);
                    existing.issues = [...issueSet];
                }
            }
        }

        const sorted = [...byPath.values()].sort((a, b) => {
            const pa = this.PRIORITY_ORDER[a.priority] ?? 99;
            const pb = this.PRIORITY_ORDER[b.priority] ?? 99;
            return pa !== pb ? pa - pb : b.sizeMb - a.sizeMb;
        });

        const counts = { P0: 0, P1: 0, P2: 0 };
        for (const r of sorted) {
            if (r.priority in counts) counts[r.priority]++;
        }

        return { rows: sorted, counts };
    }
}
