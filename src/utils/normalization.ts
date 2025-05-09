import type { Observation } from '@/types';

/**
 * Adjusts the x-coordinates of observations for right-to-left (RTL) text processing.
 *
 * This function transforms the x-coordinates of text observations to account for
 * right-to-left text direction, which is necessary for languages like Arabic, Hebrew, etc.
 * It flips the x-coordinate to start from the right edge of the image.
 *
 * @param observations - Array of text observations with bounding box data
 * @param imageWidth - Total width of the document/image in pixels
 * @returns A new array of observations with adjusted x-coordinates for RTL processing
 */
export const mapOcrResultToRTLObservations = (observations: Observation[], imageWidth: number) => {
    return observations.map((o) => ({ ...o, bbox: { ...o.bbox, x: imageWidth - o.bbox.x - o.bbox.width } }));
};

/**
 * Normalizes the x-coordinates of observations to align them properly.
 *
 * This function identifies observations that are approximately aligned (within a threshold)
 * to the leftmost observation and standardizes their x-coordinates to create clean,
 * aligned paragraphs. The threshold is calculated based on the DPI ratio.
 *
 * @param observations - Array of text observations to normalize
 * @param dpi - The dots per inch of the source document
 * @param standardDPI - The standard DPI to normalize against (typically 300)
 * @returns A new array of observations with normalized x-coordinates
 */
export const normalizeObservationsX = (observations: Observation[], dpi: number, standardDPI: number) => {
    const thresholdPx = (standardDPI / dpi) * 5;
    const minX = Math.min(...observations.map((o) => o.bbox.x));

    return observations.map((o) => {
        if (Math.abs(o.bbox.x - minX) <= thresholdPx) {
            return { ...o, bbox: { ...o.bbox, x: minX } };
        }

        return o;
    });
};

/**
 * Inserts a footer observation at the appropriate position based on vertical position.
 *
 * This function finds the correct position to insert a footer based on y-coordinates
 * and adds it just after the last observation that appears above the footer position.
 *
 * @param observations - Array of existing text observations
 * @param footer - The footer observation to be inserted
 * @returns A new array of observations with the footer inserted at the correct position
 */
export const applyFooter = (observations: Observation[], footer: Observation) => {
    const insertAfter = observations.findLastIndex((o) => o.bbox.y < footer.bbox.y);

    if (insertAfter >= 0) {
        const observationsWithFooter = observations.slice();
        observationsWithFooter.splice(insertAfter + 1, 0, footer);

        return observationsWithFooter;
    }

    console.warn('Footer not found');

    return observations;
};
