import type { IndexedObservation, Observation } from '@/types';

/**
 * Groups observations by their assigned index value.
 * This function takes an array of indexed observations and groups them into subarrays
 * based on their index property, which typically represents lines or paragraphs.
 *
 * @param marked - Array of observations with index properties
 * @returns An array of observation groups, where each group contains observations with the same index
 */
export const groupObservationsByIndex = (marked: IndexedObservation[]) => {
    const groups: Observation[][] = [];

    for (const m of marked) {
        if (!groups[m.index]) {
            groups[m.index] = [];
        }

        groups[m.index].push({ bbox: m.bbox, text: m.text });
    }

    return groups;
};

/**
 * Sorts observations within each group horizontally by their x-coordinate.
 * This ensures proper reading order (left-to-right) for observations within the same line.
 * The function creates a copy of the input array to avoid modifying the original.
 *
 * @param grouped - Array of observation groups to be sorted
 * @returns A new array with the same structure but with observations sorted by x-coordinate within each group
 */
export const sortGroupsHorizontally = (grouped: Observation[][]) => {
    const groups = grouped.slice();

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        groups[i] = group.toSorted((a, b) => a.bbox.x - b.bbox.x);
    }

    return groups;
};

/**
 * Merges multiple observations within each group into a single observation.
 * For each group, this function:
 * 1. Calculates the combined bounding box that encompasses all observations in the group
 * 2. Concatenates the text of all observations with spaces between them
 *
 * @param grouped - Array of observation groups to be merged
 * @returns An array of merged observations, where each item represents a complete line or paragraph
 */
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
