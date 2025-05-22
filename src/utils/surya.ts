import { Observation, SuryaPageOcrResult } from '@/types';

const mapBoundingBox = (box: number[]) => {
    const [x1, y1, x2, y2] = box;
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

export const mapSuryaPageResultToObservations = (surya: SuryaPageOcrResult): Observation[] => {
    return surya.text_lines.map((line) => ({ bbox: mapBoundingBox(line.bbox), text: line.text }));
};

export const levenshtein = (a: string, b: string): number => {
    const m = a.length,
        n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[] = Array.from({ length: n + 1 }, (_, k) => k);

    for (let i = 1; i <= m; i++) {
        let prevDiag = dp[0];
        dp[0] = i;
        for (let j = 1; j <= n; j++) {
            const tmp = dp[j];
            dp[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, dp[j - 1], dp[j]);
            prevDiag = tmp;
        }
    }
    return dp[n];
};

// ---------------------------------------------------------------------------
// 1 · Regex constants and normalisation
// ---------------------------------------------------------------------------
const HONORIFIC_SYMBOL = 'ﷺ';
const TAG_RE = /<\/?[a-z][^>]*?>/i; // crude “<sup> …”
const HTML_TAG_RE = /<\/?[^>]+>/g; // any tag
const TATWEEL_RE = /\u0640/g; // ــ
const DIACRITIC_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const FOOTNOTE_RE = /^\(?[0-9\u0660-\u0669]+\)?[،\.]?$/; // (٥) ١،

const normalise = (s: string) => s.replace(TAG_RE, '').replace(TATWEEL_RE, '').replace(DIACRITIC_RE, '').trim();

// ---------------------------------------------------------------------------
// 2 · Tokeniser   (stand-alone “ﷺ”, strips HTML)
// ---------------------------------------------------------------------------
const tokenize = (txt: string): string[] =>
    txt
        .replace(HTML_TAG_RE, ' ')
        .replace(new RegExp(HONORIFIC_SYMBOL, 'g'), ` ${HONORIFIC_SYMBOL} `)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

const similarity = (a: string, b: string) => {
    const max = Math.max(a.length, b.length) || 1;
    return (max - levenshtein(a, b)) / max;
};

// ---------------------------------------------------------------------------
// 3 · Needleman-Wunsch alignment on tokens
// ---------------------------------------------------------------------------
type Cell = { score: number; prev: 'diag' | 'up' | 'left' | null };

const align = (a: string[], b: string[]): [string | null, string | null][] => {
    const m = a.length,
        n = b.length;
    const T: { score: number; prev: 'diag' | 'up' | 'left' | null }[][] = Array.from({ length: m + 1 }, () =>
        Array.from({ length: n + 1 }, () => ({ score: 0, prev: null })),
    );

    const MATCH = 2;
    const SOFT = 1; // close but not identical
    const GAP = -1;
    const BAD = -MATCH;

    for (let i = 1; i <= m; i++) T[i][0] = { score: i * GAP, prev: 'up' };
    for (let j = 1; j <= n; j++) T[0][j] = { score: j * GAP, prev: 'left' };

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const normA = normalise(a[i - 1]);
            const normB = normalise(b[j - 1]);

            let diagGain: number;
            if (normA === normB) {
                diagGain = MATCH; // perfect match
            } else if (
                a[i - 1] === HONORIFIC_SYMBOL ||
                b[j - 1] === HONORIFIC_SYMBOL ||
                similarity(normA, normB) >= 0.6
            ) {
                diagGain = SOFT; // honourific or near-match
            } else {
                diagGain = BAD; // real mismatch
            }

            const diag = T[i - 1][j - 1].score + diagGain;
            const up = T[i - 1][j].score + GAP;
            const left = T[i][j - 1].score + GAP;

            const best = Math.max(diag, up, left);
            T[i][j] = { score: best, prev: best === diag ? 'diag' : best === up ? 'up' : 'left' };
        }
    }

    // back-track
    const out: [string | null, string | null][] = [];
    let i = m,
        j = n;
    while (i > 0 || j > 0) {
        const step = T[i][j].prev!;
        if (step === 'diag') out.push([a[--i], b[--j]]);
        else if (step === 'up') out.push([a[--i], null]);
        else out.push([null, b[--j]]);
    }
    return out.reverse();
};

// ---------------------------------------------------------------------------
// 4 · Decide per aligned column
// ---------------------------------------------------------------------------
const chooseColumn = (o: string | null, s: string | null): string[] => {
    // missing on one side
    if (o === null) return [s!];
    if (s === null) return [o];

    // same after normalisation → keep OBS (keeps diacritics)
    if (normalise(o) === normalise(s)) return [o];

    // foot-note logic
    if (FOOTNOTE_RE.test(o) && !FOOTNOTE_RE.test(s)) return [o, s];
    if (FOOTNOTE_RE.test(s) && !FOOTNOTE_RE.test(o)) return [s, o];
    if (FOOTNOTE_RE.test(o) && FOOTNOTE_RE.test(s)) return [o.length <= s.length ? o : s];

    // keep the symbol itself
    if (o === HONORIFIC_SYMBOL || s === HONORIFIC_SYMBOL) return [HONORIFIC_SYMBOL];

    // otherwise similarity
    const max = Math.max(o.length, s.length) || 1;
    const sim = (max - levenshtein(normalise(o), normalise(s))) / max;
    return [sim > 0.6 ? o : s];
};

// ---------------------------------------------------------------------------
// 5 · Deduplicate bursts (فهــــذِه vs فهذه, trailing echoes, etc.)
// ---------------------------------------------------------------------------
const dedupBursts = (toks: string[]): string[] => {
    const out: string[] = [],
        same = (a: string, b: string) => similarity(normalise(a), normalise(b)) >= 0.8;
    for (const t of toks) {
        if (out.length && same(out[out.length - 1], t)) {
            if (t.length < out[out.length - 1].length) out[out.length - 1] = t;
        } else {
            out.push(t);
        }
    }
    return out;
};

// ---------------------------------------------------------------------------
// 6 · Core worker
// ---------------------------------------------------------------------------
export const fixTyposInternal = (obsText: string, suryaText: string): string => {
    if (!suryaText.includes(HONORIFIC_SYMBOL)) return obsText;

    const obs = tokenize(obsText);
    const surya = tokenize(suryaText);

    const merged = align(obs, surya).flatMap(([o, s]) => chooseColumn(o, s));
    const final = dedupBursts(merged).join(' ');

    // ── debug (comment out in prod) ─────────────────────────────────
    /*console.log('suryaText', suryaText);
    console.log('obsText', obsText);
    //console.log('obs', obs);
    console.log('fixed', final, '\n'); */
    // ───────────────────────────────────────────────────────────────

    return final;
};

// ---------------------------------------------------------------------------
// 7 · API you call from the rest of the codebase
// ---------------------------------------------------------------------------
export const findAndFixTypos = (suryaObservations: Observation[], observations: Observation[]): Observation[] => {
    if (suryaObservations.length !== observations.length) {
        throw new Error('The two observation arrays must be parallel.');
    }

    return observations.map((o, idx) => ({
        ...o,
        text: fixTyposInternal(o.text, suryaObservations[idx].text),
    }));
};
