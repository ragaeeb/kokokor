import { describe, expect, it } from 'bun:test';
import type {
    BoundingBox,
    CenteringOptions,
    LayoutElements,
    MapObservationsToTextLinesOptions,
    Observation,
    PageContext,
    ParagraphOptions,
    PoetryDetectionOptions,
    ReconstructInput,
    ReconstructOptions,
    ReconstructResult,
    Size,
    TextBlock,
} from '../dist/index.js';
import * as kokokor from '../dist/index.js';

describe('Build Exports Validation', () => {
    it('should export all expected functions and constants from the main bundle', () => {
        const expectedRuntimeExports = [
            'calculateDPI',
            'filterHorizontalLinesOutsideRectangles',
            'flipAndAlignObservations',
            'formatTextBlocks',
            'mapMatrixToBoundingBox',
            'mapObservationsToTextLines',
            'mapTextLinesToParagraphs',
            'mergeObservations',
            'reconstructParagraphs',
        ].sort();

        const actualRuntimeExports = Object.keys(kokokor).sort();
        expect(actualRuntimeExports).toEqual(expectedRuntimeExports);

        for (const exportName of expectedRuntimeExports) {
            expect(kokokor[exportName as keyof typeof kokokor]).toBeDefined();
        }
    });

    it('should have valid type definitions for all public interfaces', () => {
        // No-op assignments to verify type exports remain available from dist.
        const _size: Size = { height: 10, width: 20 };
        const _bbox: BoundingBox = { ..._size, x: 1, y: 2 };
        const _observation: Observation = { bbox: _bbox, text: 'hello' };
        const _textBlock: TextBlock = { ..._observation, isCentered: true };
        const _centering: CenteringOptions = { centerToleranceRatio: 0.05, minMarginRatio: 0.2 };
        const _poetryOptions: PoetryDetectionOptions = {
            centerToleranceRatio: 0.05,
            maxVerticalGapRatio: 2,
            minMarginRatio: 0.1,
            minWidthRatioForMerged: 0.6,
            minWordCount: 2,
            pairWidthSimilarityRatio: 0.4,
            pairWordCountSimilarityRatio: 0.5,
            wordDensityComparisonRatio: 0.95,
        };
        const _lineOptions: MapObservationsToTextLinesOptions = {
            ..._centering,
            isRTL: true,
            pixelTolerance: 5,
            poetryDetectionOptions: _poetryOptions,
        };
        const _paragraphOptions: ParagraphOptions = { verticalJumpFactor: 2, widthTolerance: 0.85 };
        const _page: PageContext = { dpiX: 72, dpiY: 72, height: 1000, width: 800 };
        const _layout: LayoutElements = { horizontalLines: [_bbox], rectangles: [_bbox] };
        const _input: ReconstructInput = { layout: _layout, observations: [_observation], page: _page };
        const _options: ReconstructOptions = {
            format: { footerSymbol: '___' },
            line: _lineOptions,
            paragraph: _paragraphOptions,
        };
        const _result: ReconstructResult = { lines: [_textBlock], paragraphs: [_textBlock], text: 'hello' };

        expect([
            _bbox,
            _centering,
            _input,
            _layout,
            _lineOptions,
            _observation,
            _options,
            _page,
            _paragraphOptions,
            _poetryOptions,
            _result,
            _size,
            _textBlock,
        ]).toBeDefined();
    });

    it('should keep new one-shot API export available from dist', () => {
        expect(kokokor.reconstructParagraphs).toBeFunction();
    });
});
