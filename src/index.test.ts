import { describe, expect, it } from 'bun:test';
import path from 'node:path';

import type { Observation, OcrResult } from './types';

import { rebuildTextFromOCR } from './index';

const WRITE_RESULT = false;

type Metadata = {
    horizontal_lines: { height: number; width: number; x: number; y: number }[];
    image_info: { dpi_x: number; dpi_y: number };
};

type OcrTestResults = { height: number; observations: Observation[]; width: number };

const loadOCRData = async (...only: string[]) => {
    const fileToTestData: Record<string, OcrTestResults> = await Bun.file(
        path.join('test', 'mixed', 'ocr.json'),
    ).json();
    const structures: Record<string, Metadata> = await Bun.file(path.join('test', 'mixed', 'structures.json')).json();
    const fileToData: Record<string, OcrResult> = {};

    Object.entries(fileToTestData).forEach(([imageFile, ocrResult]) => {
        if (only.length === 0 || only.includes(imageFile)) {
            const structure = structures[imageFile];

            fileToData[imageFile] = {
                dpi: {
                    height: ocrResult.height,
                    width: ocrResult.width,
                    x: structure.image_info.dpi_x,
                    y: structure.image_info.dpi_y,
                },
                horizontalLines: structure.horizontal_lines,
                observations: ocrResult.observations,
            };
        }
    });

    return fileToData;
};

describe('index', () => {
    describe('rebuildTextFromOCR', async () => {
        const testData = await loadOCRData();

        it.each(Object.keys(testData))('should handle %s', async (imageFile) => {
            const ocrData = testData[imageFile];
            const actual = rebuildTextFromOCR(ocrData);

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
