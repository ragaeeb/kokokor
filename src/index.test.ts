import { describe, expect, it } from 'bun:test';
import path from 'node:path';

import type { BoundingBox, Observation, OcrResult } from './types';

import { rebuildParagraphs } from './index';

/**
 * When set to true, test results will overwrite the expected output files.
 * WARNING: Only enable during test data updates, should be false for regular testing.
 */
const WRITE_RESULT = false;

/**
 * Optional array of filenames to restrict testing to specific files.
 * Leave empty to test all available files.
 */
const ONLY_FILES = [];

type Metadata = {
    dpi: BoundingBox;
    horizontal_lines?: BoundingBox[];
    rectangles?: BoundingBox[];
};

type OcrTestResults = { observations: Observation[] };

const loadOCRData = async (...only: string[]) => {
    const fileToTestData: Record<string, OcrTestResults> = await Bun.file(
        path.join('test', 'mixed', 'ocr.json'),
    ).json();
    const structures: Record<string, Metadata> = (await Bun.file(path.join('test', 'mixed', 'structures.json')).json())
        .result;
    const fileToData: Record<string, OcrResult> = {};

    Object.entries(fileToTestData).forEach(([imageFile, ocrResult]) => {
        if (only.length === 0 || only.includes(imageFile)) {
            const structure = structures[imageFile];

            fileToData[imageFile] = {
                dpi: structure.dpi,
                horizontalLines: structure.horizontal_lines,
                observations: ocrResult.observations,
            };
        }
    });

    return fileToData;
};

describe('index', () => {
    describe('rebuildParagraphs', async () => {
        const testData = await loadOCRData(...ONLY_FILES);

        it.each(Object.keys(testData))('should handle %s', async (imageFile) => {
            const ocrData = testData[imageFile];
            const actual = rebuildParagraphs(ocrData);

            const parsedFile = path.parse(path.join('test', 'mixed', imageFile));
            const expectationFile = Bun.file(path.format({ dir: parsedFile.dir, ext: '.txt', name: parsedFile.name }));

            if (WRITE_RESULT) {
                await expectationFile.write(actual);
            }

            const expected = await expectationFile.text();
            expect(actual).toEqual(expected);
        });
    });
});
