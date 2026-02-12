import type { Observation } from '@/types';

/**
 * Groups items by their assigned index value into separate arrays.
 *
 * This function takes an array of indexed items and organizes them into subarrays
 * based on their index property, which typically represents lines, paragraphs, or
 * other logical groupings. The index property is removed from the resulting items.
 *
 * @template T - Type extending an object with a numeric index property
 * @param items - Array of items with index properties to be grouped
 * @returns An array of item groups, where each group contains items with the same index
 *
 * @example
 * ```typescript
 * const items = [
 *   { text: "Hello", index: 0 },
 *   { text: "World", index: 0 },
 *   { text: "Goodbye", index: 1 }
 * ];
 * const groups = groupByIndex(items);
 * // Result: [
 * //   [{ text: "Hello" }, { text: "World" }],
 * //   [{ text: "Goodbye" }]
 * // ]
 * ```
 */
export const groupByIndex = <T extends { index: number }>(items: T[]) => {
    const groups: Omit<T, 'index'>[][] = [];

    for (const { index, ...item } of items) {
        if (!groups[index]) {
            groups[index] = [];
        }

        groups[index].push(item as Omit<T, 'index'>);
    }

    return groups;
};

/**
 * Sorts items within each group horizontally by their x-coordinate.
 *
 * This ensures proper reading order (left-to-right for LTR languages) for items
 * within the same line or group. The function creates a copy of the input array
 * to avoid modifying the original data structure.
 *
 * @template T - Type extending an object with a bbox containing x-coordinate
 * @param grouped - Array of item groups to be sorted horizontally
 * @returns A new array with the same structure but with items sorted by x-coordinate within each group
 *
 * @example
 * ```typescript
 * const groups = [
 *   [{ bbox: { x: 100 }, text: "World" }, { bbox: { x: 50 }, text: "Hello" }]
 * ];
 * const sorted = sortGroupsHorizontally(groups);
 * // Result: [[{ bbox: { x: 50 }, text: "Hello" }, { bbox: { x: 100 }, text: "World" }]]
 * ```
 */
export const sortGroupsHorizontally = <T extends { bbox: { x: number } }>(grouped: T[][]) => {
    const groups = grouped.slice();

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        groups[i] = group.toSorted((a, b) => a.bbox.x - b.bbox.x);
    }

    return groups;
};

/**
 * Merges the group of observations into a single one.
 * @param group The group of observations to merge.
 * @param delimiter Text delimiter used when concatenating observations.
 * @returns A single observation with the text of the group concatenated as well as the bounding box adjusted to fit all of the contents.
 */
export const mergeObservations = <T extends Observation>(group: T[], delimiter = ' '): T => {
    // Initialize with the first observation's values
    let minX = group[0].bbox.x;
    let minY = group[0].bbox.y;
    let maxX = group[0].bbox.x + group[0].bbox.width;
    let maxY = group[0].bbox.y + group[0].bbox.height;

    // Build the combined text
    let combinedText = group[0].text;

    // Process the rest of the observations in a single pass
    for (let i = 1; i < group.length; i++) {
        const { bbox, text } = group[i];

        // Update bounding box coordinates
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);

        // Append text with space
        combinedText += `${delimiter}${text}`;
    }

    // Create the merged observation, preserving all properties from the first observation
    return {
        ...group[0],
        bbox: {
            height: maxY - minY,
            width: maxX - minX,
            x: minX,
            y: minY,
        },
        text: combinedText,
    };
};

/**
 * Merges multiple observations within each group into a single combined observation.
 *
 * For each group, this function performs the following operations:
 * 1. Calculates a combined bounding box that encompasses all observations in the group
 * 2. Concatenates the text content of all observations with spaces between them
 * 3. Preserves all additional properties from the first observation in the group
 *
 * This is typically used to combine individual word-level OCR results into complete
 * lines or to merge line segments into full paragraphs.
 *
 * @template T - Type extending Observation (must have bbox and text properties)
 * @param grouped - Array of observation groups to be merged
 * @returns An array of merged observations, where each represents a complete line or paragraph
 *
 * @example
 * ```typescript
 * const groups = [
 *   [
 *     { bbox: { x: 0, y: 0, width: 50, height: 20 }, text: "Hello" },
 *     { bbox: { x: 60, y: 0, width: 50, height: 20 }, text: "world" }
 *   ]
 * ];
 * const merged = mergeGroupedObservations(groups);
 * // Result: [{
 * //   bbox: { x: 0, y: 0, width: 110, height: 20 },
 * //   text: "Hello world"
 * // }]
 * ```
 */
export const mergeGroupedObservations = <T extends Observation>(grouped: T[][]) => {
    const result: T[] = [];

    for (const group of grouped) {
        // Short circuit for single-observation groups
        if (group.length === 1) {
            result.push(group[0]);
            continue;
        }

        // Create the merged observation, preserving all properties from the first observation
        result.push(mergeObservations(group));
    }

    return result;
};
