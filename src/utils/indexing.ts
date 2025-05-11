import type { IndexedObservation, Observation } from '@/types';

const LINE_HEIGHT_FACTOR = 0.49;

/**
 * Groups observations into lines based on vertical proximity.
 *
 * This function sorts observations by y-coordinate and then groups them into lines
 * based on their vertical proximity. Two observations are considered to be on the same line
 * if the vertical distance between them is less than or equal to half the height of the taller
 * observation plus a DPI-adjusted tolerance.
 *
 * @param observations - Array of OCR observations to be grouped into lines
 * @param dpi - Document DPI (dots per inch), used to scale tolerance values appropriately
 * @param pixelTolerance - Additional vertical tolerance in pixels at 72 DPI
 * @returns Array of observations with index properties indicating their line assignments
 */
export const indexObservationsAsLines = (observations: Observation[], dpi: number, pixelTolerance: number) => {
    // how many device‐pixels of slack at this DPI?
    const effectiveYTolerance = pixelTolerance * (dpi / 72);
    const byY = observations.toSorted((a, b) => a.bbox.y - b.bbox.y);

    const marked: IndexedObservation[] = [];
    let currentLine = 0;
    let [prev] = byY;

    marked.push({ ...prev, index: currentLine });

    for (let i = 1; i < byY.length; i++) {
        const obs = byY[i];
        const dy = obs.bbox.y - prev.bbox.y;

        const baseThresh = Math.max(prev.bbox.height, obs.bbox.height) * LINE_HEIGHT_FACTOR;
        const threshold = baseThresh + effectiveYTolerance;

        if (dy > threshold) {
            currentLine += 1;
        }

        marked.push({ ...obs, index: currentLine });
        prev = obs;
    }

    return marked.sort((a, b) => (a.index !== b.index ? a.index - b.index : a.bbox.y - b.bbox.y));
};

/**
 * Groups observations into paragraphs based on vertical spacing and line width.
 *
 * This function analyzes the pattern of vertical spacing between observations and their widths
 * to identify paragraph breaks. A new paragraph is created when:
 * 1. There's a significant increase in vertical gap compared to previous gaps, or
 * 2. An observation's width is significantly less than the maximum width (indicating a short line)
 *
 * @param observations - Array of OCR observations (typically lines) to be grouped into paragraphs
 * @param verticalJumpFactor - Factor determining how much larger a gap needs to be to indicate a paragraph break
 * @param widthTolerance - Fraction of maximum width below which a line is considered "short" (0-1)
 * @returns Array of observations with index properties indicating their paragraph assignments
 */
export const indexObservationsAsParagraphs = (
    observations: Observation[],
    verticalJumpFactor: number,
    widthTolerance: number,
): IndexedObservation[] => {
    if (observations.length === 0) {
        return [];
    }
    // 1) compute width threshold
    const maxWidth = Math.max(...observations.map((o) => o.bbox.width));
    const thresholdWidth = maxWidth * widthTolerance;

    const out: IndexedObservation[] = [];
    let index = 0;

    for (let i = 0; i < observations.length; i++) {
        const o = observations[i];

        // a) only apply vertical‐jump if *both* of the two preceding lines
        //    were “full” (not short).  This prevents double‐counting at the
        //    body→footer cut.
        if (i > 1) {
            const prev = observations[i - 1];
            const prevPrev = observations[i - 2];
            if (prev.bbox.width >= thresholdWidth && prevPrev.bbox.width >= thresholdWidth) {
                const gap = o.bbox.y - prev.bbox.y;
                const prevGap = prev.bbox.y - prevPrev.bbox.y;
                // Ensure prevGap is not zero to avoid division by zero or infinite jumpFactor sensitivity
                if (prevGap > 0 && gap > prevGap * verticalJumpFactor) {
                    index++;
                } else if (prevGap === 0 && gap > 0) {
                    // If previous gap was zero (overlapping lines), consider it a paragraph break
                    // if the current gap is significant compared to line height
                    if (gap > o.bbox.height * 0.5 * verticalJumpFactor) {
                        index++;
                    }
                }
            }
        } else if (i === 1) {
            const prev = observations[i - 1]; // This is observations[0]
            // Only consider a vertical jump if the FIRST line was full-width.
            // If the first line was short, its shortness already incremented 'index' for the current line.
            if (prev.bbox.width >= thresholdWidth) {
                const gap = o.bbox.y - prev.bbox.y;
                if (gap > prev.bbox.height * verticalJumpFactor) {
                    index++;
                }
            }
        }

        // tag
        out.push({ ...o, index });

        // b) short‐width break for the *next* line
        if (o.bbox.width < thresholdWidth) {
            index++;
        }
    }

    // stable sort by index then y
    return out.sort((a, b) => (a.index !== b.index ? a.index - b.index : a.bbox.y - b.bbox.y));
};

/**
 * Ensures that the set of `index` values on your observations
 * forms a contiguous 0…N sequence with no gaps.
 * Throws an Error if it finds any missing index.
 */
export function assertIndicesContinuous<T extends { index: number }>(marked: T[]): void {
    // collect the unique indices, sorted
    const unique = Array.from(new Set(marked.map((o) => o.index))).sort((a, b) => a - b);

    if (unique.length === 0) return;

    // must start at zero
    if (unique[0] !== 0) {
        throw new Error(`Paragraph indices must start at 0, but first index is ${unique[0]}`);
    }

    // check for gaps
    for (let i = 0; i < unique.length; i++) {
        if (unique[i] !== i) {
            throw new Error(
                `Paragraph index gap: expected index ${i} but got ${unique[i]}. ` +
                    `Full index list: [${unique.join(', ')}]`,
            );
        }
    }
}
