import { describe, expect, it } from 'bun:test';

import { mapSuryaPageResultToObservations } from './surya';

describe('surya', () => {
    describe('mapSuryaPageResultToObservations', () => {
        it('should map the surya results to observations', () => {
            const actual = mapSuryaPageResultToObservations({
                text_lines: [{ chars: [], text: 'A', bbox: [27, 13, 483, 33] }],
            });

            expect(actual).toEqual([
                {
                    bbox: {
                        x: 27,
                        y: 13,
                        width: 456,
                        height: 20,
                    },
                    text: 'A',
                },
            ]);
        });
    });
});
