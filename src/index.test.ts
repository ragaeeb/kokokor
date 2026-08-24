import { describe, expect, it } from 'bun:test';
import path from 'node:path';
import { formatTextBlocks, mapObservationsToTextLines, mapTextLinesToParagraphs, reconstructParagraphs } from './index';
import type { BoundingBox, Observation } from './types';

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
    describe('reconstructParagraphs snapshots', async () => {
        const testData = await loadOCRData(process.env.ONLY?.split(',').map((f) => f.trim()));

        it.each(Object.keys(testData))('should handle %s', async (imageFile) => {
            const ocrData = testData[imageFile];
            const result = reconstructParagraphs(
                {
                    layout: {
                        horizontalLines: ocrData.horizontalLines,
                        rectangles: ocrData.rectangles,
                    },
                    observations: ocrData.observations,
                    page: {
                        dpiX: ocrData.dpi.x,
                        dpiY: ocrData.dpi.y,
                        height: ocrData.dpi.height,
                        width: ocrData.dpi.width,
                    },
                },
                {
                    format: { footerSymbol: '___' },
                    paragraph: { verticalJumpFactor: 2, widthTolerance: 0.85 },
                },
            );
            const actual = result.text;

            const parsedFile = path.parse(path.join('test', 'mixed', imageFile));
            const expectationFile = Bun.file(path.format({ dir: parsedFile.dir, ext: '.txt', name: parsedFile.name }));

            if (process.env.WRITE_SNAPSHOTS === 'true') {
                console.log(`Writing snapshot: ${expectationFile.name}`);
                await expectationFile.write(actual);
            }

            const expected = (await expectationFile.text()).replace(/\n$/u, '');
            expect(actual).toEqual(expected);
        });
    });

    describe('reconstructParagraphs', async () => {
        const testData = await loadOCRData(['0.jpg']);

        it('should match the low-level pipeline output', () => {
            const ocrData = testData['0.jpg'];
            const lines = mapObservationsToTextLines(
                ocrData.observations,
                {
                    dpiX: ocrData.dpi.x,
                    dpiY: ocrData.dpi.y,
                    height: ocrData.dpi.height,
                    width: ocrData.dpi.width,
                },
                {
                    horizontalLines: ocrData.horizontalLines,
                    rectangles: ocrData.rectangles,
                },
            );
            const paragraphs = mapTextLinesToParagraphs(lines);
            const text = formatTextBlocks(paragraphs, '___');

            const result = reconstructParagraphs(
                {
                    layout: {
                        horizontalLines: ocrData.horizontalLines,
                        rectangles: ocrData.rectangles,
                    },
                    observations: ocrData.observations,
                    page: {
                        dpiX: ocrData.dpi.x,
                        dpiY: ocrData.dpi.y,
                        height: ocrData.dpi.height,
                        width: ocrData.dpi.width,
                    },
                },
                {
                    format: { footerSymbol: '___' },
                    paragraph: { verticalJumpFactor: 2, widthTolerance: 0.85 },
                },
            );

            expect(result.lines).toEqual(lines);
            expect(result.paragraphs).toEqual(paragraphs);
            expect(result.text).toEqual(text);
        });

        it('should handle empty observations', () => {
            const result = reconstructParagraphs({
                observations: [],
                page: {
                    dpiX: 72,
                    dpiY: 72,
                    height: 1000,
                    width: 800,
                },
            });

            expect(result.lines).toEqual([]);
            expect(result.paragraphs).toEqual([]);
            expect(result.text).toBe('');
        });

        it('should handle missing layout context', () => {
            const result = reconstructParagraphs({
                observations: [
                    {
                        bbox: { height: 20, width: 280, x: 100, y: 120 },
                        text: 'سطر تجريبي',
                    },
                ],
                page: {
                    dpiX: 72,
                    dpiY: 72,
                    height: 1000,
                    width: 800,
                },
            });

            expect(result.lines.length).toBe(1);
            expect(result.paragraphs.length).toBe(1);
            expect(result.text).toBe('سطر تجريبي');
        });
    });
});
