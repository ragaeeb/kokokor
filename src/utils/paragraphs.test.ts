import { beforeEach, describe, expect, it, jest } from 'bun:test';
import type { PageContext } from '@/types';

import { flipAndAlignObservations, mapObservationsToTextLines, mapTextLinesToParagraphs } from './paragraphs';

describe('paragraphs', () => {
    describe('flipAndAlignObservations', () => {
        it('should return empty array when no observations provided', () => {
            const log = jest.fn();
            const result = flipAndAlignObservations([], 800, 72, { log });
            expect(result).toEqual([]);

            expect(log).not.toHaveBeenCalled();
        });

        it('should return empty array when all observations are filtered out', () => {
            const log = jest.fn();
            const result = flipAndAlignObservations([{ text: 'A' }], 800, 72);
            expect(result).toEqual([]);

            expect(log).not.toHaveBeenCalled();
        });

        it('should flip x-coordinates from RTL and align them when they are close', () => {
            const log = jest.fn();

            const result = flipAndAlignObservations(
                [
                    { bbox: { height: 20, width: 700, x: 0, y: 0 }, text: 'AB' },
                    {
                        bbox: {
                            height: 20,
                            width: 700,
                            x: 3,
                            y: 100,
                        },
                        text: 'CD',
                    },
                ],
                800,
                72,
                { isRTL: true, log },
            );
            expect(result).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 97,
                        y: 0,
                    },
                    text: 'AB',
                },
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 97,
                        y: 100,
                    },
                    text: 'CD',
                },
            ]);

            expect(log).toHaveBeenCalledTimes(2);
        });

        it('should keep only observations containing real Arabic text when requested', () => {
            const result = flipAndAlignObservations(
                [
                    { bbox: { height: 20, width: 100, x: 0, y: 0 }, text: '7 - ..' },
                    { bbox: { height: 20, width: 100, x: 0, y: 30 }, text: 'ABC 123' },
                    { bbox: { height: 20, width: 100, x: 0, y: 60 }, text: 'عربي' },
                    { bbox: { height: 20, width: 100, x: 0, y: 90 }, text: 'ﷺ' },
                ],
                800,
                72,
                { contentFilter: 'arabic' },
            );

            expect(result.map((observation) => observation.text)).toEqual(['عربي', 'ﷺ']);
        });

        it('should preserve a page-number fragment aligned with an Arabic contents row', () => {
            const result = flipAndAlignObservations(
                [
                    { bbox: { height: 44, width: 700, x: 100, y: 200 }, text: 'الفصل الأول' },
                    { bbox: { height: 24, width: 50, x: 850, y: 210 }, text: '٤٣٢' },
                    { bbox: { height: 24, width: 50, x: 40, y: 210 }, text: '1A' },
                    { bbox: { height: 24, width: 100, x: 800, y: 300 }, text: '(١) (ص ٥٩).' },
                    { bbox: { height: 20, width: 100, x: 0, y: 400 }, text: 'ABC 123' },
                ],
                1000,
                72,
                { contentFilter: 'arabic' },
            );

            expect(result.map((observation) => observation.text)).toEqual(['الفصل الأول', '٤٣٢', '(١) (ص ٥٩).']);
        });
    });

    describe('mapObservationsToTextLines', () => {
        let defaultDpi: PageContext;

        beforeEach(() => {
            defaultDpi = {
                dpiX: 72,
                dpiY: 72,
                height: 1200,
                width: 800,
            };
        });

        it('should map to text lines without additional metadata', () => {
            const log = jest.fn();

            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 20, width: 700, x: 0, y: 0 }, text: 'AB' },
                    {
                        bbox: {
                            height: 20,
                            width: 700,
                            x: 3,
                            y: 100,
                        },
                        text: 'CD',
                    },
                ],
                defaultDpi,
                { log },
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 97,
                        y: 0,
                    },
                    text: 'AB',
                },
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 97,
                        y: 100,
                    },
                    text: 'CD',
                },
            ]);

            expect(log).toHaveBeenCalledTimes(5);
        });

        it('should support explicit page context with dpiX and dpiY fields', () => {
            const actual = mapObservationsToTextLines(
                [{ bbox: { height: 20, width: 700, x: 0, y: 100 }, text: 'AB' }],
                {
                    dpiX: 72,
                    dpiY: 72,
                    height: 1200,
                    width: 800,
                },
                {},
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 100,
                        y: 100,
                    },
                    text: 'AB',
                },
            ]);
        });

        it('should map the observation as a footnote', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 20, width: 700, x: 0, y: 100 }, text: 'AB' },
                    { bbox: { height: 20, width: 700, x: 0, y: 200 }, text: 'CD' },
                    { bbox: { height: 20, width: 700, x: 0, y: 350 }, text: 'EF' },
                ],
                defaultDpi,
                { horizontalLines: [{ height: 2, width: 800, x: 0, y: 300 }] },
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 100,
                        y: 100,
                    },
                    text: 'AB',
                },
                { bbox: { height: 20, width: 700, x: 100, y: 200 }, text: 'CD' },
                { bbox: { height: 20, width: 700, x: 100, y: 350 }, isFootnote: true, text: 'EF' },
            ]);
        });

        it('should use the very last horizontal line to detect footnote', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 20, width: 700, x: 0, y: 100 }, text: 'AB' },
                    { bbox: { height: 20, width: 700, x: 0, y: 200 }, text: 'CD' },
                    { bbox: { height: 20, width: 700, x: 0, y: 350 }, text: 'EF' },
                ],
                defaultDpi,
                {
                    horizontalLines: [
                        { height: 2, width: 800, x: 0, y: 2 },
                        { height: 2, width: 300, x: 450, y: 300 },
                    ],
                },
            );

            expect(actual).toEqual([
                { bbox: { height: 20, width: 700, x: 100, y: 100 }, text: 'AB' },
                { bbox: { height: 20, width: 700, x: 100, y: 200 }, text: 'CD' },
                { bbox: { height: 20, width: 700, x: 100, y: 350 }, isFootnote: true, text: 'EF' },
            ]);
        });

        it('should ignore decorative header rules when they do not separate body text', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 44, width: 220, x: 500, y: 80 }, text: 'الدر النضيد' },
                    { bbox: { height: 56, width: 700, x: 100, y: 164 }, text: 'الحكمة والعقل' },
                    { bbox: { height: 58, width: 700, x: 100, y: 225 }, text: 'هذا سطر آخر من المتن' },
                ],
                defaultDpi,
                {
                    horizontalLines: [
                        { height: 5, width: 320, x: 313, y: 102 },
                        { height: 2, width: 321, x: 312, y: 109 },
                    ],
                },
            );

            expect(actual.every((line) => !line.isFootnote)).toBeTrue();
        });

        it('should keep a high footnote separator when Arabic body and note text surround it', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 37, width: 500, x: 300, y: 94 }, text: 'مجموع الردود' },
                    { bbox: { height: 60, width: 800, x: 100, y: 161 }, text: 'متن قصير فوق الحاشية' },
                    { bbox: { height: 37, width: 900, x: 100, y: 262 }, text: 'تعليق الحاشية الأول' },
                    { bbox: { height: 39, width: 900, x: 100, y: 301 }, text: 'تكملة تعليق الحاشية' },
                ],
                { ...defaultDpi, height: 1584, width: 1224 },
                { horizontalLines: [{ height: 3, width: 337, x: 716, y: 248 }] },
            );

            expect(actual.map((line) => Boolean(line.isFootnote))).toEqual([false, false, true, true]);
        });

        it('should tolerate subpixel OCR overlap at a real footnote rule', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 40, width: 800, x: 100, y: 150 }, text: 'المتن الأول فوق الحاشية' },
                    { bbox: { height: 94, width: 800, x: 100, y: 210 }, text: 'المتن الثاني فوق الحاشية' },
                    { bbox: { height: 45, width: 850, x: 100, y: 303.5 }, text: 'تخريج الحديث في الحاشية' },
                ],
                defaultDpi,
                { horizontalLines: [{ height: 4, width: 350, x: 500, y: 300 }] },
            );

            expect(actual.map((line) => Boolean(line.isFootnote))).toEqual([false, false, true]);
        });

        it('should ignore a page-edge rule when validating a nearby footnote separator', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 40, width: 650, x: 100, y: 150 }, text: 'المتن الأول فوق الحاشية' },
                    { bbox: { height: 40, width: 650, x: 100, y: 250 }, text: 'المتن الثاني فوق الحاشية' },
                    { bbox: { height: 40, width: 300, x: 450, y: 850 }, text: 'تعليق الحاشية' },
                ],
                { ...defaultDpi, height: 1000 },
                {
                    horizontalLines: [
                        { height: 3, width: 300, x: 450, y: 820 },
                        { height: 2, width: 310, x: 455, y: 998 },
                    ],
                },
            );

            expect(actual.map((line) => Boolean(line.isFootnote))).toEqual([false, false, true]);
        });

        it('should ignore paired rules that frame a centered section heading', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 44, width: 700, x: 250, y: 115 }, text: 'فتاوى فضيلة الشيخ' },
                    { bbox: { height: 60, width: 460, x: 380, y: 311 }, text: 'منهجية جمع الكتاب' },
                    { bbox: { height: 49, width: 850, x: 180, y: 485 }, text: 'أولا جمع مادة الكتاب' },
                    { bbox: { height: 48, width: 850, x: 180, y: 582 }, text: 'المواد المسموعة' },
                ],
                { ...defaultDpi, height: 1584, width: 1224 },
                {
                    horizontalLines: [
                        { height: 2, width: 257, x: 484, y: 269 },
                        { height: 3, width: 345, x: 452, y: 431 },
                    ],
                },
            );

            expect(actual.every((line) => !line.isFootnote)).toBeTrue();
        });

        it('should ignore paired title rules when the OCR box touches the frame', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 25, width: 100, x: 350, y: 50 }, text: 'رقم الصفحة' },
                    { bbox: { height: 50, width: 300, x: 250, y: 115 }, text: 'عنوان الكتاب' },
                    { bbox: { height: 50, width: 650, x: 75, y: 250 }, text: 'السطر الأول من المحتوى' },
                    { bbox: { height: 50, width: 650, x: 75, y: 350 }, text: 'السطر الثاني من المحتوى' },
                ],
                { ...defaultDpi, height: 1000 },
                {
                    horizontalLines: [
                        { height: 3, width: 320, x: 240, y: 100 },
                        { height: 3, width: 320, x: 240, y: 180 },
                    ],
                },
            );

            expect(actual.every((line) => !line.isFootnote)).toBeTrue();
        });

        it('should ignore the top edge of a framed scanned insert', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 25, width: 500, x: 300, y: 97 }, text: 'جماعة واحدة لا جماعات' },
                    { bbox: { height: 53, width: 600, x: 280, y: 175 }, text: 'صورة خطية من مقدمة الشيخ' },
                    { bbox: { height: 57, width: 700, x: 260, y: 289 }, text: 'بسم الله الرحمن الرحيم' },
                    { bbox: { height: 70, width: 700, x: 260, y: 403 }, text: 'نص المقدمة الخطية' },
                    { bbox: { height: 70, width: 700, x: 260, y: 1450 }, text: 'تكملة النص الخطي' },
                ],
                { ...defaultDpi, height: 1584, width: 1224 },
                {
                    horizontalLines: [
                        { height: 7, width: 694, x: 286, y: 247 },
                        { height: 7, width: 696, x: 279, y: 1408 },
                    ],
                },
            );

            expect(actual.every((line) => !line.isFootnote)).toBeTrue();
        });

        it('should ignore the horizontal lines that are part of the rectangle', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 20, width: 700, x: 0, y: 150 }, text: 'AB' },
                    { bbox: { height: 20, width: 700, x: 0, y: 220 }, text: 'CD' },
                    { bbox: { height: 20, width: 700, x: 0, y: 350 }, text: 'EF' },
                ],
                defaultDpi,
                {
                    horizontalLines: [
                        { height: 2, width: 800, x: 0, y: 2 },
                        { height: 2, width: 800, x: 0, y: 300 },
                        { height: 2, width: 800, x: 0, y: 98 },
                    ],
                    rectangles: [{ height: 100, width: 800, x: 0, y: 0 }],
                },
            );

            expect(actual).toEqual([
                { bbox: { height: 20, width: 700, x: 100, y: 150 }, text: 'AB' },
                { bbox: { height: 20, width: 700, x: 100, y: 220 }, text: 'CD' },
                { bbox: { height: 20, width: 700, x: 100, y: 350 }, isFootnote: true, text: 'EF' },
            ]);
        });

        it('should ignore a full-height border artifact when selecting headings and footnote rules', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 50, width: 850, x: 100, y: 1200 }, text: 'متن الصفحة قبل الحاشية' },
                    { bbox: { height: 50, width: 850, x: 100, y: 1350 }, text: 'آخر سطر من متن الصفحة' },
                    { bbox: { height: 37, width: 900, x: 100, y: 1493 }, text: 'تخريج الحديث في الحاشية' },
                ],
                { ...defaultDpi, height: 1684, width: 1190 },
                {
                    horizontalLines: [{ height: 5, width: 356, x: 679, y: 1472 }],
                    rectangles: [{ height: 1684, width: 629, x: 532, y: 0 }],
                },
            );

            expect(actual.map((line) => Boolean(line.isFootnote))).toEqual([false, false, true]);
            expect(actual.every((line) => !line.isHeading)).toBeTrue();
        });

        it('should map the observation as a heading', () => {
            const actual = mapObservationsToTextLines(
                [{ bbox: { height: 20, width: 700, x: 0, y: 10 }, text: 'AB' }],
                defaultDpi,
                { rectangles: [{ height: 100, width: 800, x: 0, y: 0 }] },
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 700,
                        x: 100,
                        y: 10,
                    },
                    isHeading: true,
                    text: 'AB',
                },
            ]);
        });

        it('should detect that observation was centered', () => {
            const actual = mapObservationsToTextLines(
                [{ bbox: { height: 20, width: 20, x: 390, y: 10 }, text: 'AB' }],
                defaultDpi,
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 20,
                        x: 390,
                        y: 10,
                    },
                    isCentered: true,
                    text: 'AB',
                },
            ]);
        });

        it('should merge a pair of poetry lines', () => {
            defaultDpi.width = 2480;

            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 20, width: 600, x: 479, y: 0 }, text: 'A B C D' },
                    { bbox: { height: 20, width: 600, x: 1260, y: 0 }, text: 'E F G H' },
                ],
                defaultDpi,
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 1381,
                        x: 620,
                        y: 0,
                    },
                    isPoetic: true,
                    text: 'E F G H A B C D',
                },
            ]);
        });

        it('should merge a pair of poetry lines using the configured delimiter', () => {
            defaultDpi.width = 2480;

            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 20, width: 600, x: 479, y: 0 }, text: 'A B C D' },
                    { bbox: { height: 20, width: 600, x: 1260, y: 0 }, text: 'E F G H' },
                ],
                defaultDpi,
                {
                    poetryPairDelimiter: ' ... ',
                },
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 20,
                        width: 1381,
                        x: 620,
                        y: 0,
                    },
                    isPoetic: true,
                    text: 'E F G H ... A B C D',
                },
            ]);
        });

        it('should merge lines that were broken up by OCR engine', () => {
            const actual = mapObservationsToTextLines(
                [
                    { bbox: { height: 20, width: 300, x: 0, y: 0 }, text: 'AB' },
                    { bbox: { height: 20, width: 200, x: 500, y: 5 }, text: 'CD' },
                ],
                defaultDpi,
                {
                    poetryPairDelimiter: ' ... ',
                },
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 25,
                        width: 700,
                        x: 100,
                        y: 0,
                    },
                    text: 'CD AB',
                },
            ]);
        });
    });

    describe('mapTextLinesToParagraphs', () => {
        it('should keep existing properties', () => {
            const textLines = [
                {
                    bbox: { height: 10, width: 10, x: 0, y: 0 },
                    isCentered: true,
                    isFootnote: true,
                    isHeading: true,
                    isPoetic: true,
                    text: 'A',
                },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toEqual(textLines);
        });

        it('should handle empty input array', () => {
            const actual = mapTextLinesToParagraphs([]);
            expect(actual).toEqual([]);
        });

        it('should separate body content from footnotes', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Body line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, text: 'Body line 2' },
                { bbox: { height: 10, width: 80, x: 0, y: 200 }, isFootnote: true, text: 'Footnote 1' },
                { bbox: { height: 10, width: 80, x: 0, y: 220 }, isFootnote: true, text: 'Footnote 2' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            // Should have body content followed by footnotes
            expect(actual).toHaveLength(2);
            expect(actual[0].text).toContain('Body line');
            expect(actual[1].text).toContain('Footnote');
        });

        it('should handle only footnotes', () => {
            const textLines = [
                { bbox: { height: 10, width: 80, x: 0, y: 200 }, isFootnote: true, text: 'Footnote 1' },
                { bbox: { height: 10, width: 80, x: 0, y: 220 }, isFootnote: true, text: 'Footnote 2' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toHaveLength(1);
            expect(actual[0].text).toContain('Footnote');
            expect(actual[0].isFootnote).toBe(true);
        });

        it('should handle only body content without footnotes', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Body line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, text: 'Body line 2' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 30,
                        width: 100,
                        x: 0,
                        y: 0,
                    },
                    text: 'Body line 1 Body line 2',
                },
            ]);
        });

        it('should preserve poetic lines individually', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Prose line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, isPoetic: true, text: 'Poetry line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 40 }, isPoetic: true, text: 'Poetry line 2' },
                { bbox: { height: 10, width: 100, x: 0, y: 60 }, text: 'Prose line 2' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toHaveLength(4); // 1 prose paragraph + 2 individual poetry lines + 1 prose paragraph
            expect(actual[0].text).toBe('Prose line 1');
            expect(actual[1].text).toBe('Poetry line 1');
            expect(actual[1].isPoetic).toBe(true);
            expect(actual[2].text).toBe('Poetry line 2');
            expect(actual[2].isPoetic).toBe(true);
            expect(actual[3].text).toBe('Prose line 2');
        });

        it('should handle multiple consecutive poetic lines', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, isPoetic: true, text: 'Poetry line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, isPoetic: true, text: 'Poetry line 2' },
                { bbox: { height: 10, width: 100, x: 0, y: 40 }, isPoetic: true, text: 'Poetry line 3' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toHaveLength(3);
            expect(actual[0].text).toBe('Poetry line 1');
            expect(actual[0].isPoetic).toBe(true);
            expect(actual[1].text).toBe('Poetry line 2');
            expect(actual[1].isPoetic).toBe(true);
            expect(actual[2].text).toBe('Poetry line 3');
            expect(actual[2].isPoetic).toBe(true);
        });

        it('should group prose lines then flush when encountering poetry', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Prose line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, text: 'Prose line 2' },
                { bbox: { height: 10, width: 100, x: 0, y: 40 }, text: 'Prose line 3' },
                { bbox: { height: 10, width: 100, x: 0, y: 60 }, isPoetic: true, text: 'Poetry line' },
                { bbox: { height: 10, width: 100, x: 0, y: 80 }, text: 'More prose 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 100 }, text: 'More prose 2' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 50,
                        width: 100,
                        x: 0,
                        y: 0,
                    },
                    text: 'Prose line 1 Prose line 2 Prose line 3',
                },
                {
                    bbox: {
                        height: 10,
                        width: 100,
                        x: 0,
                        y: 60,
                    },
                    isPoetic: true,
                    text: 'Poetry line',
                },
                {
                    bbox: {
                        height: 30,
                        width: 100,
                        x: 0,
                        y: 80,
                    },
                    text: 'More prose 1 More prose 2',
                },
            ]);
        });

        it('should flush remaining prose lines at the end', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, isPoetic: true, text: 'Poetry line' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, text: 'Prose line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 40 }, text: 'Prose line 2' },
                { bbox: { height: 10, width: 100, x: 0, y: 60 }, text: 'Prose line 3' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 10,
                        width: 100,
                        x: 0,
                        y: 0,
                    },
                    isPoetic: true,
                    text: 'Poetry line',
                },
                {
                    bbox: {
                        height: 50,
                        width: 100,
                        x: 0,
                        y: 20,
                    },
                    text: 'Prose line 1 Prose line 2 Prose line 3',
                },
            ]);
        });

        it('should handle all prose lines without poetry', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Prose line 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, text: 'Prose line 2' },
                { bbox: { height: 10, width: 100, x: 0, y: 40 }, text: 'Prose line 3' },
                { bbox: { height: 10, width: 100, x: 0, y: 60 }, text: 'Prose line 4' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 70,
                        width: 100,
                        x: 0,
                        y: 0,
                    },
                    text: 'Prose line 1 Prose line 2 Prose line 3 Prose line 4',
                },
            ]);
        });

        it('should handle mixed footnotes with body content including poetry', () => {
            const textLines = [
                { bbox: { height: 10, width: 100, x: 0, y: 0 }, text: 'Body prose 1' },
                { bbox: { height: 10, width: 100, x: 0, y: 20 }, isPoetic: true, text: 'Body poetry' },
                { bbox: { height: 10, width: 100, x: 0, y: 40 }, text: 'Body prose 2' },
                { bbox: { height: 10, width: 80, x: 0, y: 200 }, isFootnote: true, text: 'Footnote prose 1' },
                {
                    bbox: { height: 10, width: 80, x: 0, y: 220 },
                    isFootnote: true,
                    isPoetic: true,
                    text: 'Footnote poetry',
                },
                { bbox: { height: 10, width: 80, x: 0, y: 240 }, isFootnote: true, text: 'Footnote prose 2' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 10,
                        width: 100,
                        x: 0,
                        y: 0,
                    },
                    text: 'Body prose 1',
                },
                {
                    bbox: {
                        height: 10,
                        width: 100,
                        x: 0,
                        y: 20,
                    },
                    isPoetic: true,
                    text: 'Body poetry',
                },
                {
                    bbox: {
                        height: 10,
                        width: 100,
                        x: 0,
                        y: 40,
                    },
                    text: 'Body prose 2',
                },
                {
                    bbox: {
                        height: 10,
                        width: 80,
                        x: 0,
                        y: 200,
                    },
                    isFootnote: true,
                    text: 'Footnote prose 1',
                },
                {
                    bbox: {
                        height: 10,
                        width: 80,
                        x: 0,
                        y: 220,
                    },
                    isFootnote: true,
                    isPoetic: true,
                    text: 'Footnote poetry',
                },
                {
                    bbox: {
                        height: 10,
                        width: 80,
                        x: 0,
                        y: 240,
                    },
                    isFootnote: true,
                    text: 'Footnote prose 2',
                },
            ]);
        });

        it('should support object-based paragraph options', () => {
            const textLines = [
                { bbox: { height: 10, width: 200, x: 0, y: 0 }, text: 'Line 1' },
                { bbox: { height: 10, width: 200, x: 0, y: 20 }, text: 'Line 2' },
                { bbox: { height: 10, width: 200, x: 0, y: 120 }, text: 'Line 3' },
            ];

            const actual = mapTextLinesToParagraphs(textLines, {
                verticalJumpFactor: 2,
                widthTolerance: 0.85,
            });

            expect(actual).toHaveLength(2);
            expect(actual[0].text).toBe('Line 1 Line 2');
            expect(actual[1].text).toBe('Line 3');
        });

        it('should preserve defaults when only one paragraph option is provided', () => {
            const textLines = [
                { bbox: { height: 10, width: 200, x: 0, y: 0 }, text: 'Line 1' },
                { bbox: { height: 10, width: 200, x: 0, y: 20 }, text: 'Line 2' },
                { bbox: { height: 10, width: 200, x: 0, y: 120 }, text: 'Line 3' },
            ];

            const actual = mapTextLinesToParagraphs(textLines, {
                verticalJumpFactor: 2,
            });

            expect(actual).toHaveLength(2);
            expect(actual[0].text).toBe('Line 1 Line 2');
            expect(actual[1].text).toBe('Line 3');
        });

        it('should use enhanced paragraph detection by default', () => {
            const textLines = [
                { bbox: { height: 20, width: 500, x: 10, y: 0 }, text: 'Line 1' },
                { bbox: { height: 20, width: 460, x: 40, y: 20 }, text: 'Line 2' },
                { bbox: { height: 20, width: 460, x: 40, y: 40 }, text: 'Line 3' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toHaveLength(2);
            expect(actual[0].text).toBe('Line 1');
            expect(actual[1].text).toBe('Line 2 Line 3');
        });

        it('should keep repeated list starts separated using geometry without semantic tags', () => {
            const textLines = [
                { bbox: { height: 36, width: 366, x: 46, y: 0 }, text: 'Note one' },
                { bbox: { height: 34, width: 601, x: 46, y: 40 }, text: 'Note two long' },
                { bbox: { height: 38, width: 384, x: 46, y: 80 }, text: 'Note three' },
                { bbox: { height: 34, width: 601, x: 46, y: 120 }, text: 'Note four long' },
                { bbox: { height: 38, width: 585, x: 46, y: 160 }, text: 'Note five long' },
                { bbox: { height: 38, width: 731, x: 46, y: 200 }, text: 'Note six part A' },
                { bbox: { height: 20, width: 80, x: 84, y: 240 }, text: 'continued detail' },
                { bbox: { height: 34, width: 593, x: 46, y: 280 }, text: 'Note seven long' },
                { bbox: { height: 38, width: 725, x: 46, y: 320 }, text: 'Note eight part A' },
                { bbox: { height: 22, width: 68, x: 82, y: 360 }, text: 'continued citation' },
                { bbox: { height: 34, width: 599, x: 46, y: 400 }, text: 'Note nine long' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toHaveLength(9);
            expect(actual[0].text).toBe('Note one');
            expect(actual[1].text).toBe('Note two long');
            expect(actual[2].text).toBe('Note three');
            expect(actual[3].text).toBe('Note four long');
            expect(actual[4].text).toBe('Note five long');
            expect(actual[5].text).toBe('Note six part A continued detail');
            expect(actual[6].text).toBe('Note seven long');
            expect(actual[7].text).toBe('Note eight part A continued citation');
            expect(actual[8].text).toBe('Note nine long');
        });

        it('should apply indentation signal inside footnotes', () => {
            const textLines = [
                { bbox: { height: 20, width: 500, x: 10, y: 0 }, isFootnote: true, text: 'Footnote line 1' },
                { bbox: { height: 20, width: 460, x: 40, y: 20 }, isFootnote: true, text: 'Footnote line 2' },
                { bbox: { height: 20, width: 460, x: 40, y: 40 }, isFootnote: true, text: 'Footnote line 3' },
            ];

            const actual = mapTextLinesToParagraphs(textLines);

            expect(actual).toHaveLength(2);
        });
    });
});
