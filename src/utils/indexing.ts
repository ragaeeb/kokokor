import type { IndexedObservation, Observation } from '@/types';

/**
 * Given an array of observations, sort them by y,
 * then assign `line` numbers by clustering any two
 * neighbors whose vertical gap is <= half the taller
 * of the two bbox heights plus a tolerance scaled by dpi.
 *
 * @param observations   array of OCR observations
 * @param dpi            image DPI (defaults to 72)
 * @param pixelTolerance extra vertical slack in “pixels at 72dpi”
 */
export const indexObservationsAsLines = (observations: Observation[], dpi: number, pixelTolerance: number) => {
    // how many device‐pixels of slack at this DPI?
    const effectiveYTolerance = pixelTolerance * (dpi / 72);

    // 1) sort top→bottom by y
    const byY = observations.slice().sort((a, b) => a.bbox.y - b.bbox.y);

    const marked: IndexedObservation[] = [];
    let currentLine = 0;
    let prev = byY[0];

    marked.push({ ...prev, index: currentLine });

    for (let i = 1; i < byY.length; i++) {
        const obs = byY[i];
        const dy = obs.bbox.y - prev.bbox.y;

        // half the taller box + extra tolerance
        const baseThresh = Math.max(prev.bbox.height, obs.bbox.height) * 0.5;
        const threshold = baseThresh + effectiveYTolerance;

        if (dy > threshold) {
            currentLine += 1;
        }

        marked.push({ ...obs, index: currentLine });
        prev = obs;
    }

    // finally, ensure grouped by line then y
    return marked.sort((a, b) => (a.index !== b.index ? a.index - b.index : a.bbox.y - b.bbox.y));
};

export const indexObservationsAsParagraphs = (
    observations: Observation[],
    verticalJumpFactor: number,
    widthTolerance: number,
) => {
    // ensure top→bottom order
    const byY = observations.toSorted((a, b) => a.bbox.y - b.bbox.y);

    // precompute width threshold
    const maxWidth = Math.max(...byY.map((o) => o.bbox.width));
    const thresholdWidth = maxWidth * widthTolerance;

    const out: IndexedObservation[] = [];
    let index = 0;

    for (let i = 0; i < byY.length; i++) {
        const o = byY[i];

        // check for big vertical jump
        if (i > 1) {
            const prev = byY[i - 1];
            const prevPrev = byY[i - 2];
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
