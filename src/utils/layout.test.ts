import { describe, expect, it } from 'bun:test';

import { isObservationCentered } from './layout';

describe('layout', () => {
    describe('isObservationCentered', () => {
        it('should be true if the observation is in the center of the page', () => {
            expect(isObservationCentered({ bbox: { width: 286, x: 298 } }, 960)).toBeTrue();
        });

        it('should be false if the observation is in not in the center of the page', () => {
            expect(isObservationCentered({ bbox: { width: 716, x: 73 } }, 960)).toBeFalse();
        });

        it('should be false if the footnote is not centered', () => {
            expect(isObservationCentered({ bbox: { width: 726, x: 103.82 } }, 960)).toBeTrue();
        });
    });
});
