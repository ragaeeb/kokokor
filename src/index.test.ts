import { describe, expect, it } from 'bun:test';
import path from 'node:path';

import type { BoundingBox, Observation, OcrResult } from './types';

import { rebuildParagraphs } from './index';

const WRITE_RESULT = false;
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
