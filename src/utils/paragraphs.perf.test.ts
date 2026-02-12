import { describe, expect, it } from 'bun:test';

import type { TextBlock } from '@/types';

import { mapTextLinesToParagraphs } from './paragraphs';

const generateSyntheticLines = (pageIndex: number): TextBlock[] => {
    const lines: TextBlock[] = [];

    for (let i = 0; i < 28; i++) {
        const isParagraphEnd = i % 7 === 6;
        const isIndentedStart = i % 7 === 0 && i > 0;
        const width = isParagraphEnd ? 520 : 900;
        const x = isIndentedStart ? 70 : 20;

        lines.push({
            bbox: {
                height: 24,
                width,
                x,
                y: i * 34 + pageIndex * 1000,
            },
            text: `page-${pageIndex}-line-${i}`,
        });
    }

    return lines;
};

describe('paragraphs performance', () => {
    it('should process large synthetic workloads', () => {
        const pageCount = process.env.PERF_STRESS === 'true' ? 10_000 : 200;
        let paragraphCount = 0;

        for (let page = 0; page < pageCount; page++) {
            const paragraphs = mapTextLinesToParagraphs(generateSyntheticLines(page), {
                verticalJumpFactor: 2,
                widthTolerance: 0.85,
            });
            paragraphCount += paragraphs.length;
        }

        expect(paragraphCount).toBeGreaterThan(0);
    });
});
