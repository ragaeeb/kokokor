import type { Observation } from '@/types';

export const isObservationCentered = (observation: Observation, imageWidth: number, toleranceRatio = 0.05) => {
    const pageCenter = imageWidth / 2;
    const tolPx = imageWidth * toleranceRatio;
    const centerX = observation.bbox.x + observation.bbox.width / 2;
    return Math.abs(centerX - pageCenter) <= tolPx;
};

/**
 * @param  lines           Array of “rows” (each row is an array of Observations on that horizontal band)
 * @param  expectedCols    How many segments per row to expect (2 for most Arabic poetry)
 * @param  minPoeticRatio  What fraction of rows must match expectedCols in order to call it “poetic”
 */
export const isPoeticLayout = (lines: Observation[][], expectedCols = 2, minPoeticRatio = 0.6) => {
    if (lines.length < 3) {
        return false;
    }

    const poeticCount = lines.filter((row) => row.length === expectedCols).length;
    const ratio = poeticCount / lines.length;

    return ratio >= minPoeticRatio;
};
