import type { Observation, OcrResult } from './types';

export const mapOcrResultToRTLObservations = ({ observations, width }: OcrResult) => {
    return observations.map((o) => ({ ...o, bbox: { ...o.bbox, x: width - o.bbox.x - o.bbox.width } }));
};

export function normalizeObservationsX(observations: Observation[], dpi: number, standardDPI = 300) {
    const thresholdPx = (standardDPI / dpi) * 5;
    const minX = Math.min(...observations.map((o) => o.bbox.x));
    const minY = Math.min(...observations.map((o) => o.bbox.y));

    return observations.map((o) => {
        const observation = { ...o };

        if (Math.abs(o.bbox.x - minX) <= thresholdPx) {
            observation.bbox.x = minX;
        }

        if (Math.abs(o.bbox.y - minY) <= thresholdPx) {
            observation.bbox.y = minY;
        }

        return o;
    });
}

export const normalizeObservationsY = (observations: Observation[], dpi = 72, pixelTolerance = 5): Observation[] => {
    const effectiveYTolerance = pixelTolerance * (dpi / 72); // adjust for DPI

    const sorted = observations.toSorted((a, b) => a.bbox.y - b.bbox.y);

    const clusters: Observation[][] = [];
    let currentCluster: Observation[] = [];

    for (const obs of sorted) {
        if (!currentCluster.length) {
            currentCluster.push(obs);
            continue;
        }

        const last = currentCluster[currentCluster.length - 1];
        const yDiff = Math.abs(obs.bbox.y - last.bbox.y);

        if (yDiff <= effectiveYTolerance) {
            currentCluster.push(obs);
        } else {
            clusters.push(currentCluster);
            currentCluster = [obs];
        }
    }

    if (currentCluster.length) {
        clusters.push(currentCluster);
    }

    return clusters.flat();
};

export const realignSplitLines = (observations: Observation[], dpi = 72, pixelTolerance = 5): Observation[] => {
    const effectiveYTolerance = pixelTolerance * (dpi / 72);
    const sorted = observations.toSorted((a, b) => a.bbox.y - b.bbox.y);

    const mergedObservations: Observation[] = [];
    let currentGroup: Observation[] = [];

    for (const obs of sorted) {
        if (!currentGroup.length) {
            currentGroup.push(obs);
            continue;
        }

        const last = currentGroup[currentGroup.length - 1];
        const yDiff = Math.abs(obs.bbox.y - last.bbox.y);

        if (yDiff <= effectiveYTolerance) {
            currentGroup.push(obs);
        } else {
            mergedObservations.push(mergeObservationGroup(currentGroup));
            currentGroup = [obs];
        }
    }

    if (currentGroup.length) {
        mergedObservations.push(mergeObservationGroup(currentGroup));
    }

    return mergedObservations;
};

type ReconstructionOptions = {
    verticalJumpFactor?: number;
    widthTolerance?: number;
};

export const reconstructParagraphs = (
    observations: Observation[],
    { verticalJumpFactor = 2, widthTolerance = 0.85 }: ReconstructionOptions = {},
) => {
    const maxWidth = Math.max(...observations.map((o) => o.bbox.width));
    const thresholdWidth = maxWidth * widthTolerance;

    const paragraphs = [];
    let currentParagraph = '';

    for (let i = 0; i < observations.length; i++) {
        const o = observations[i];
        const text = o.text.trim();

        const currentY = o.bbox.y;

        let isLargeVerticalGap = false;

        if (i > 0) {
            const prevY = observations[i - 1].bbox.y;
            const gap = currentY - prevY;

            if (i > 1) {
                const prevPrevY = observations[i - 2].bbox.y;
                const prevGap = prevY - prevPrevY;

                if (gap > prevGap * verticalJumpFactor) {
                    isLargeVerticalGap = true;
                }
            }
        }

        if (isLargeVerticalGap) {
            if (currentParagraph.trim()) {
                paragraphs.push(currentParagraph.trim());
            }
            currentParagraph = text;
        } else {
            if (currentParagraph) {
                currentParagraph += ' ';
            }
            currentParagraph += text;
        }

        const lineWidth = o.bbox.width;

        if (lineWidth < thresholdWidth) {
            if (currentParagraph.trim()) {
                paragraphs.push(currentParagraph.trim());
                currentParagraph = '';
            }
        }
    }

    if (currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim());
    }

    return paragraphs.filter(Boolean);
};

function mergeObservationGroup(group: Observation[]): Observation {
    if (group.length === 1) {
        return group[0];
    }

    // Sort x descending (right to left on image)
    const sorted = group.toSorted((a, b) => b.bbox.x - a.bbox.x);

    // Reverse to join in correct RTL text order
    const combinedText = sorted
        .slice()
        .reverse()
        .map((o) => o.text)
        .join(' ');

    const minX = Math.min(...sorted.map((o) => o.bbox.x));
    const minY = Math.min(...sorted.map((o) => o.bbox.y));
    const maxX = Math.max(...sorted.map((o) => o.bbox.x + o.bbox.width));
    const maxY = Math.max(...sorted.map((o) => o.bbox.y + o.bbox.height));

    return {
        bbox: {
            height: maxY - minY,
            width: maxX - minX,
            x: minX,
            y: minY,
        },
        text: combinedText,
    };
}
