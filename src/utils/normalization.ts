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
 * Purely for helping debug by simplifying an observation by narrowing down its floating point and text.
 * @param observation The observation to simplify.
 */
export const simplifyObservation = (observation: Observation): Observation => {
    return {
        bbox: {
            height: Math.trunc(observation.bbox.height),
            width: Math.trunc(observation.bbox.width),
            x: Math.trunc(observation.bbox.x),
            y: Math.trunc(observation.bbox.y),
        },
        text: observation.text
            .split(' ')
            .filter((word) => word.length > 1)
            .slice(0, 1)
            .join(' '),
    };
};
