import type { Observation } from '@/types';

export const mapOcrResultToRTLObservations = (observations: Observation[], imageWidth: number) => {
    return observations.map((o) => ({ ...o, bbox: { ...o.bbox, x: imageWidth - o.bbox.x - o.bbox.width } }));
};

export function normalizeObservationsX(observations: Observation[], dpi: number, standardDPI = 300) {
    const thresholdPx = (standardDPI / dpi) * 5;
    const minX = Math.min(...observations.map((o) => o.bbox.x));

    return observations.map((o) => {
        const observation = { ...o };

        if (Math.abs(o.bbox.x - minX) <= thresholdPx) {
            observation.bbox.x = minX;
        }

        return o;
    });
}
