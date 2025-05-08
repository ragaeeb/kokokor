import { describe, expect, it } from 'bun:test';

import { mapOcrResultToRTLObservations } from './normalization';

describe('normalization', () => {
    describe('mapOcrResultToRTLObservations', () => {
        it('should correct the x-coordinates to be from the right', () => {
            const actual = mapOcrResultToRTLObservations(
                [{ bbox: { height: 1, width: 50, x: 0, y: 0 }, text: 'Ewwo' }],
                100,
            );

            expect(actual).toEqual([{ bbox: { height: 1, width: 50, x: 50, y: 0 }, text: 'Ewwo' }]);
        });
    });
});
