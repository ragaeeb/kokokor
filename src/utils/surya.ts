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

/** remove Arabic diacritic marks so أن / اَنْ look identical */
const stripDiacritics = (s: string) => s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');

/** very small similarity score ∈ [0, 1] */
const similarity = (a: string, b: string) => {
    const lenA = a.length;
    const lenB = b.length;
    if (lenA === 0 && lenB === 0) return 1.0;
    if (lenA === 0 || lenB === 0) return 0.0; // If one is empty and other is not, similarity is 0
    const max = Math.max(lenA, lenB);
    return (max - levenshtein(a, b)) / max;
};

/** pick the “better” of the two tokens, favouring diacritics */
const chooseToken = (obsTok: string, suryaTok: string) => {
    if (obsTok === suryaTok) return obsTok;

    if (!obsTok && suryaTok) return suryaTok; // Obs token doesn't exist (e.g., obs is shorter)
    if (obsTok && !suryaTok) return obsTok; // Surya token doesn't exist (e.g., surya is shorter)
    if (!obsTok && !suryaTok) return ''; // Both are empty (shouldn't happen with filter)

    const sStrippedObs = stripDiacritics(obsTok);
    const sStrippedSurya = stripDiacritics(suryaTok);

    // If one is empty after stripping and the other isn't, prefer the non-empty one's original form
    if (sStrippedObs.length === 0 && sStrippedSurya.length > 0) return suryaTok;
    if (sStrippedSurya.length === 0 && sStrippedObs.length > 0) return obsTok;

    const sim = similarity(sStrippedObs, sStrippedSurya);

    if (sim > 0.6) return obsTok; // Prefer observation token if similar (to keep its diacritics)
    return suryaTok; // Otherwise, Surya's token is considered more likely correct or a fix
};

const HONORIFIC_SYMBOL = 'ﷺ';

export const fixTyposInternal = (obsText: string, suryaText: string): string => {
    if (!suryaText.includes(HONORIFIC_SYMBOL)) {
        return obsText;
    }

    const suryaToks = suryaText.split(/\s+/).filter((t) => t.length > 0);
    const obsToks = obsText.split(/\s+/).filter((t) => t.length > 0);
    const result: string[] = [];

    let i = 0; // Pointer for suryaToks
    let j = 0; // Pointer for obsToks

    while (i < suryaToks.length) {
        const sTok = suryaToks[i];

        if (sTok.includes(HONORIFIC_SYMBOL)) {
            // If current Surya token contains the honorific, add it directly from Surya.
            result.push(sTok);
            // Only advance Surya pointer. Observation pointer (j) does not advance,
            // meaning the obs token at index j (if any) is effectively skipped or
            // considered "replaced" by the honorific. The next Surya token
            // will be compared against this same obs token obsToks[j].
        } else {
            // Current Surya token is not an honorific.
            // Compare with the current observation token.
            const oTok = j < obsToks.length ? obsToks[j] : '';
            result.push(chooseToken(oTok, sTok));
            // Advance observation pointer only if there was a token to consume from obsToks.
            if (j < obsToks.length) {
                j++;
            }
        }
        i++; // Always advance Surya pointer.
    }

    // If there are any remaining tokens in obsToks (because suryaToks was shorter),
    // append them. These tokens were not compared with any Surya tokens.
    if (j < obsToks.length) {
        result.push(...obsToks.slice(j));
    }

    // Your logging for the final combined string
    console.log('suryaText', suryaText);
    console.log('obsText', obsText);
    console.log('fixed', result.join(' '));
    console.log();

    return result.join(' ');
};

export const findAndFixTypos = (suryaObservations: Observation[], observations: Observation[]): Observation[] => {
    if (suryaObservations.length !== observations.length) {
        console.warn('Observation arrays do not have the same length.');
        return observations;
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
