import type { IndexedObservation, Observation } from '@/types';

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

    // 1) sort top→bottom by y
    const byY = observations.toSorted((a, b) => a.bbox.y - b.bbox.y);

    const marked: IndexedObservation[] = [];
    let currentLine = 0;
    let prev = byY[0];

    marked.push({ ...prev, index: currentLine });

    for (let i = 1; i < byY.length; i++) {
        const obs = byY[i];
        const dy = obs.bbox.y - prev.bbox.y;

        // Calculate threshold: half the taller box + extra tolerance
        const baseThresh = Math.max(prev.bbox.height, obs.bbox.height) * 0.5;
        const threshold = baseThresh + effectiveYTolerance;

        // If vertical gap exceeds threshold, start a new line
        if (dy > threshold) {
            currentLine += 1;
        }

        marked.push({ ...obs, index: currentLine });
        prev = obs;
    }

    // finally, ensure grouped by line then y
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
) => {
    // Calculate width threshold for identifying short lines
    const maxWidth = Math.max(...observations.map((o) => o.bbox.width));
    const thresholdWidth = maxWidth * widthTolerance;

    const out: IndexedObservation[] = [];
    let index = 0;

    for (let i = 0; i < observations.length; i++) {
        const o = observations[i];

        // Check for significant vertical jump indicating paragraph break
        // Compare current gap with previous gap if we have enough observations
        if (i > 1) {
            const prev = observations[i - 1];
            const prevPrev = observations[i - 2];
            const gap = o.bbox.y - prev.bbox.y;
            const prevGap = prev.bbox.y - prevPrev.bbox.y;
            if (gap > prevGap * verticalJumpFactor) {
                index++;
            }
        }

        // tag this line
        out.push({ ...o, index });

        // if it’s a “short” line, bump to new paragraph afterwards
        if (o.bbox.width < thresholdWidth) {
            index++;
        }
    }

    // final sort by paragraph then y (just to keep stable ordering)
    return out.toSorted((a, b) => (a.index !== b.index ? a.index - b.index : a.bbox.y - b.bbox.y));
};
