import { Observation, SuryaPageOcrResult } from '@/types';

const mapBoundingBox = (box: number[]) => {
    const [x1, y1, x2, y2] = box;
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

export const mapSuryaPageResultToObservations = (surya: SuryaPageOcrResult): Observation[] => {
    return surya.text_lines.map((line) => ({ bbox: mapBoundingBox(line.bbox), text: line.text }));
};

/** quick-n-dirty Arabic (and Latin) Levenshtein – enough for short tokens */
const levenshtein = (a: string, b: string): number => {
    const m = a.length,
        n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[] = Array.from({ length: n + 1 }, (_, k) => k);

    for (let i = 1; i <= m; i++) {
        let prevDiagonal = dp[0];
        dp[0] = i;
        for (let j = 1; j <= n; j++) {
            const temp = dp[j];
            if (a[i - 1] === b[j - 1]) {
                dp[j] = prevDiagonal;
            } else {
                dp[j] = 1 + Math.min(prevDiagonal, dp[j - 1], dp[j]);
            }
            prevDiagonal = temp;
        }
    }
    return dp[n];
};

const TAG_RE = /<\/?[a-z][^>]*?>/i; // crude “<sup> … </sup>” detector
const TATWEEL_RE = /\u0640/g; // ـــــ elongation marks
const HTML_TAG_RE = /<\/?[^>]+>/g; // <sup> … >, <span … >, …

const DIACRITIC_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

const normalise = (s: string) =>
    s
        .replace(TAG_RE, '') // strip any html
        .replace(TATWEEL_RE, '') // strip tatwīl
        .replace(DIACRITIC_RE, '') // strip tashkīl
        .trim();

/** pick the “better” of the two tokens, favouring diacritics */
const chooseToken = (obsTok: string, suryaTok: string): string => {
    if (obsTok === suryaTok) return obsTok;
    if (!obsTok) return suryaTok;
    if (!suryaTok) return obsTok;

    const a = normalise(obsTok);
    const b = normalise(suryaTok);

    // identical after normalisation?  keep obs – it carries tashkīl
    if (a === b) return obsTok;

    // otherwise fall back to the old Levenshtein similarity
    const max = Math.max(a.length, b.length) || 1;
    const sim = (max - levenshtein(a, b)) / max;
    return sim > 0.6 ? obsTok : suryaTok;
};

const HONORIFIC_SYMBOL = 'ﷺ';

/** splits text → tokens and ensures “ﷺ” is *always* a stand-alone token    */
const tokenize = (txt: string): string[] => {
    // 1) drop tags -> leave ONE space so “والثانية(٢)” becomes “والثانية (٢)”
    let s = txt.replace(HTML_TAG_RE, ' ');

    // 2) guarantee the honourific is always a stand-alone token
    s = s.replace(new RegExp(HONORIFIC_SYMBOL, 'g'), ` ${HONORIFIC_SYMBOL} `);

    // 3) collapse runs of whitespace and split
    return s.trim().split(/\s+/).filter(Boolean);
};

const dedupBursts = (toks: string[]): string[] => {
    const out: string[] = [];

    const norm = (t: string) =>
        t
            .replace(/\u0640/g, '') // tatwīl
            .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
            .trim();

    for (const tok of toks) {
        out.push(tok);

        // look for repeats of length 3, 2, or 1 (whichever matches first)
        for (let k = 3; k >= 1; k--) {
            if (out.length >= 2 * k) {
                const a = out
                    .slice(-2 * k, -k)
                    .map(norm)
                    .join(' ');
                const b = out.slice(-k).map(norm).join(' ');
                if (a === b) {
                    // keep the *shorter* version of each token, then drop duplicate
                    for (let i = 0; i < k; i++) {
                        const first = out[out.length - 2 * k + i];
                        const second = out[out.length - k + i];
                        if (second.length < first.length) out[out.length - 2 * k + i] = second;
                    }
                    out.splice(-k); // remove the echo
                    break;
                }
            }
        }
    }
    return out;
};

export const fixTyposInternal = (obsText: string, suryaText: string): string => {
    if (!suryaText.includes(HONORIFIC_SYMBOL)) {
        return obsText;
    }

    const suryaToks = tokenize(suryaText);
    const obsToks = tokenize(obsText);
    const merged: string[] = [];

    let j = 0; // pointer in obsToks

    for (const sTok of suryaToks) {
        if (sTok === HONORIFIC_SYMBOL) {
            merged.push(HONORIFIC_SYMBOL); // insert the symbol
            continue; // …but DON’T advance j
        }
        const oTok = j < obsToks.length ? obsToks[j] : '';
        merged.push(chooseToken(oTok, sTok));
        if (j < obsToks.length) j++; // consume one obs token
    }

    // append any genuinely new trailing obs tokens
    while (j < obsToks.length) {
        merged.push(obsToks[j++]);
    }

    const final = dedupBursts(merged).join(' ');

    // ─── debug ───────────────────────────────────────────────────────────────
    /*console.log('suryaText', suryaText);
    console.log('obsText', obsText);
    console.log('fixed', final, '\n'); */
    // ─────────────────────────────────────────────────────────────────────────

    return final;
};

export const findAndFixTypos = (suryaObservations: Observation[], observations: Observation[]): Observation[] => {
    if (suryaObservations.length !== observations.length) {
        throw new Error('Observation arrays do not have the same length.');
    }

    return observations.map((o, idx) => {
        const suryaObs = suryaObservations[idx];
        if (!suryaObs) {
            return o;
        }
        const correctedText = fixTyposInternal(o.text, suryaObs.text);
        return {
            ...o,
            text: correctedText,
        };
    });
};
