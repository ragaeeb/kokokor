import { describe, expect, it } from 'bun:test';
import path from 'node:path';

import type { BoundingBox, Observation } from './types';

import { formatTextBlocks, mapObservationsToTextLines, mapTextLinesToParagraphs } from './index';

type Metadata = {
    dpi: Partial<BoundingBox>;
    horizontal_lines?: BoundingBox[];
    rectangles?: BoundingBox[];
};

/**
 * Represents the complete result of an OCR operation on a document.
 * Contains the document dimensions, observations, and optional structural elements.
 */
type OcrResult = {
    /**
     * The dimensions and DPI information of the document.
     */
    readonly dpi: BoundingBox;

    /**
     * Optional array of horizontal lines detected in the document.
     * Often used for identifying page breaks, section separators, or footers.
     */
    readonly horizontalLines?: BoundingBox[];

    /**
     * Array of text observations extracted from the document.
     */
    readonly observations: Observation[];

    /**
     * Optional array of rectangle coordinates to process chapter titles.
     */
    readonly rectangles?: BoundingBox[];
};

type OcrTestResults = { observations: Observation[] };

const loadOCRData = async (only: string[] = []) => {
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
                dpi: { x: 72, y: 72, ...structure.dpi } as BoundingBox,
                horizontalLines: structure.horizontal_lines,
                observations: ocrResult.observations,
                rectangles: structure.rectangles,
            };
        }
    });

    return fileToData;
};

describe('index', () => {
    describe('formatTextBlocks', async () => {
        const testData = await loadOCRData(process.env.ONLY?.split(',').map((f) => f.trim()));

        it.each(Object.keys(testData))('should handle %s', async (imageFile) => {
            const ocrData = testData[imageFile];
            const lines = mapObservationsToTextLines(ocrData.observations, ocrData.dpi, {
                horizontalLines: ocrData.horizontalLines,
                rectangles: ocrData.rectangles,
            });
            const blocks = mapTextLinesToParagraphs(lines);
            const actual = formatTextBlocks(blocks, '___');

            const parsedFile = path.parse(path.join('test', 'mixed', imageFile));
            const expectationFile = Bun.file(path.format({ dir: parsedFile.dir, ext: '.txt', name: parsedFile.name }));

            if (process.env.WRITE_SNAPSHOTS === 'true') {
                console.log(`Writing snapshot: ${expectationFile.name}`);
                await expectationFile.write(actual);
            }

            const expected = await expectationFile.text();
            expect(actual).toEqual(expected);
        });
    });
});
