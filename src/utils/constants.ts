import { MapObservationsToTextLinesOptions, PoetryDetectionOptions } from '@/types';

export const PTS_TO_INCHES = 72;

/**
 * Default options for poetry detection, providing a balanced starting point.
 */
export const DEFAULT_POETRY_OPTIONS: PoetryDetectionOptions = {
    centerToleranceRatio: 0.05,
    maxVerticalGapRatio: 2.0,
    minMarginRatio: 0.1,
    minWidthRatioForMerged: 0.6,
    minWordCount: 2,
    pairWidthSimilarityRatio: 0.4,
    pairWordCountSimilarityRatio: 0.5,
    wordDensityComparisonRatio: 0.95,
} as const;

export const DEFAULT_OBSERVATIONS_TO_TEXT_LINES_OPTIONS: MapObservationsToTextLinesOptions = {
    centerToleranceRatio: 0.05,
    horizontalLines: [],
    minMarginRatio: 0.2,
    pixelTolerance: 5,
    poetryDetectionOptions: DEFAULT_POETRY_OPTIONS,
    rectangles: [],
} as const;
