import { describe, expect, it } from 'bun:test';
import path from 'node:path';

import {
    mapOcrResultToRTLObservations,
    normalizeObservationsX,
    normalizeObservationsY,
    realignSplitLines,
    reconstructParagraphs,
} from './index';

describe('index', () => {
    describe('mapOcrResultToRTLObservations', () => {
        it('should correct the x-coordinates to be from the right', () => {
            const actual = mapOcrResultToRTLObservations({
                height: 100,
                observations: [{ bbox: { height: 1, width: 50, x: 0, y: 0 }, text: 'Ewwo' }],
                width: 100,
            });

            expect(actual).toEqual([{ bbox: { height: 1, width: 50, x: 50, y: 0 }, text: 'Ewwo' }]);
        });

        it.only('should handle real data', async () => {
            const [ocrData, structures] = await Promise.all([
                Bun.file(path.join('test', 'mixed', 'ocr.json')).json(),
                Bun.file(path.join('test', 'mixed', 'structures.json')).json(),
            ]);

            const imageFile = '14.jpg';
            const result = mapOcrResultToRTLObservations(ocrData[imageFile]);
            const normalized = normalizeObservationsX(result, structures[imageFile].image_info.dpi_x);
            const normalizedY = normalizeObservationsY(normalized, structures[imageFile].image_info.dpi_x);
            const realigned = realignSplitLines(normalizedY, structures[imageFile].image_info.dpi_y);

            const actual = reconstructParagraphs(realigned);

            await Bun.file('output.txt').write(actual.join('\n'));
        });
    });
});
