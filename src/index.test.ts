import { describe, expect, it } from 'bun:test';
import path from 'node:path';

import type { BoundingBox, Observation, OcrResult, SuryaPageOcrResult } from './types';

import {
    alignAndAdjustObservations,
    buildTextBlocksFromOCR,
    filterHorizontalLinesOutsideRectangles,
    mapSuryaPageResultToObservations,
    rebuildParagraphs,
} from './index';

type Metadata = {
    dpi: BoundingBox;
    horizontal_lines?: BoundingBox[];
    rectangles?: BoundingBox[];
};

type OcrTestResults = { observations: Observation[] };

const loadOCRData = async (only: string[] = []) => {
    const fileToTestData: Record<string, OcrTestResults> = await Bun.file(
        path.join('test', 'mixed', 'ocr.json'),
    ).json();
    const structures: Record<string, Metadata> = (await Bun.file(path.join('test', 'mixed', 'structures.json')).json())
        .result;
    const surya: Record<string, SuryaPageOcrResult[]> = await Bun.file(path.join('test', 'mixed', 'surya.json')).json();
    const fileToData: Record<string, OcrResult> = {};

    Object.entries(fileToTestData).forEach(([imageFile, ocrResult]) => {
        if (only.length === 0 || only.includes(imageFile)) {
            const structure = structures[imageFile];
            const [suryaPage] = surya[imageFile.split('.')[0]];

            const suryaObservations = mapSuryaPageResultToObservations(suryaPage);
            const horizontalLines =
                structure.rectangles && structure.horizontal_lines
                    ? filterHorizontalLinesOutsideRectangles(structure.rectangles, structure.horizontal_lines)
                    : structure.horizontal_lines;

            fileToData[imageFile] = {
                dpi: structure.dpi,
                ...(horizontalLines && {
                    horizontalLines,
                }),
                ...(structure.rectangles && { rectangles: structure.rectangles }),
                alternateObservations: alignAndAdjustObservations(suryaObservations, {
                    dpiX: structure.dpi.x,
                    dpiY: structure.dpi.y,
                    imageWidth: structure.dpi.width,
                }).observations,
                observations: ocrResult.observations,
            };
        }
    });

    return fileToData;
};

describe('index', () => {
    describe('rebuildParagraphs', async () => {
        const testData = await loadOCRData(process.env.ONLY?.split(',').map((f) => f.trim()));

        it.each(Object.keys(testData))('should handle %s', async (imageFile) => {
            const ocrData = testData[imageFile];
            const actual = rebuildParagraphs(ocrData, { footerSymbol: '___', typoSymbols: ['ﷺ'] });

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

    describe('buildTextBlocksFromOCR', () => {
        it('should return the text blocks for ', async () => {
            const testData = await loadOCRData();
            const ocrData = testData['1.jpg'];
            const actual = buildTextBlocksFromOCR(ocrData, { typoSymbols: ['ﷺ'] });

            expect(actual).toHaveLength(5);

            expect(actual.filter((t) => t.isFootnote)).toHaveLength(2); // only last 2 are footnotes
            expect(actual.at(-1)!.isFootnote && actual.at(-2)!.isFootnote).toBeTrue();
        });
    });
});
