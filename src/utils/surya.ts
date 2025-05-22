import { Observation, SuryaPageOcrResult } from '@/types';

/**
 * Converts bounding box coordinates from array format to object format.
 * Transforms [x1, y1, x2, y2] coordinates to {x, y, width, height} format.
 *
 * @param box - Array containing [x1, y1, x2, y2] coordinates
 * @returns Bounding box object with x, y, width, and height properties
 */
const mapBoundingBox = (box: number[]) => {
    const [x1, y1, x2, y2] = box;
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

/**
 * Converts Surya OCR page results to standardized Observation format.
 * Maps each text line from Surya format to the common Observation structure
 * used throughout the application.
 *
 * @param surya - Surya OCR page result containing text lines with bounding boxes
 * @returns Array of observations in standardized format
 */
export const mapSuryaPageResultToObservations = (surya: SuryaPageOcrResult): Observation[] => {
    return surya.text_lines.map((line) => ({ bbox: mapBoundingBox(line.bbox), text: line.text }));
};
