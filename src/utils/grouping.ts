import type { Observation } from '@/types';

import { markObservationsWithIndex } from './sorting';

type GroupingOptions = {
    dpi: number;
    pixelTolerance?: number;
    sortHorizontally?: boolean;
};

export const groupObservationsByIndex = (
    observations: Observation[],
    { dpi, pixelTolerance = 5, sortHorizontally }: GroupingOptions,
) => {
    const marked = markObservationsWithIndex(observations, dpi, pixelTolerance);
    const groups: Observation[][] = [];

    for (const m of marked) {
        if (!groups[m.index]) {
            groups[m.index] = [];
        }

        groups[m.index].push({ bbox: m.bbox, text: m.text });
    }

    if (sortHorizontally) {
        for (const group of groups) {
            group.sort((a, b) => a.bbox.x - b.bbox.x);
        }
    }

    return groups;
};

export const mergeGroupedObservations = (grouped: Observation[][]) => {
    const flattened = grouped.flatMap((group) => {
        const minX = Math.min(...group.map((o) => o.bbox.x));
        const minY = Math.min(...group.map((o) => o.bbox.y));
        const maxX = Math.max(...group.map((o) => o.bbox.x + o.bbox.width));
        const maxY = Math.max(...group.map((o) => o.bbox.y + o.bbox.height));

        return [
            {
                bbox: {
                    height: maxY - minY,
                    width: maxX - minX,
                    x: minX,
                    y: minY,
                },
                text: group.map((g) => g.text).join(' '),
            },
        ];
    });

    return flattened;
};
