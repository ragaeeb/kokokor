import type { MapObservationsToTextLinesOptions, PoetryDetectionOptions } from '@/types';

/**
 * Conversion factor from points to inches.
 * In typography, there are 72 points in one inch.
 */
export const PTS_TO_INCHES = 72;

/**
 * Default options for poetry detection, providing a balanced starting point.
 * These values have been tuned to work well across various document types
 * while minimizing false positives and negatives in poetry identification.
 */
export const DEFAULT_POETRY_OPTIONS: PoetryDetectionOptions = {
    /** Center tolerance as 5% of image width for determining if text is centered */
    centerToleranceRatio: 0.05,
    /** Maximum vertical gap of 200% of average height between poetry observations */
    maxVerticalGapRatio: 2.0,
    /** Minimum margin of 10% of image width required on each side for centering */
    minMarginRatio: 0.1,
    /** Minimum width of 60% of image width for merged line poetry detection */
    minWidthRatioForMerged: 0.6,
    /** Minimum of 2 words required for a line to be considered poetry */
    minWordCount: 2,
    /** Paired lines must have width similarity within 40% to be considered hemistichs */
    pairWidthSimilarityRatio: 0.4,
    /** Paired lines must have word count similarity within 50% to be considered hemistichs */
    pairWordCountSimilarityRatio: 0.5,
    /** Word density must be 95% or less of average prose density to be considered poetic */
    wordDensityComparisonRatio: 0.95,
} as const;

/**
 * Default configuration options for mapping OCR observations to text lines.
 * These settings provide reasonable defaults for most document processing scenarios.
 */
export const DEFAULT_OBSERVATIONS_TO_TEXT_LINES_OPTIONS: MapObservationsToTextLinesOptions = {
    /** Center tolerance as 5% of image width for determining if text is centered */
    centerToleranceRatio: 0.05,
    /** Empty array of horizontal lines - will be populated during processing */
    horizontalLines: [],
    /** By default we will be handling RTL text. */
    isRTL: true,
    /** Minimum margin of 20% of image width required on each side for centering */
    minMarginRatio: 0.2,
    /** Pixel tolerance of 5 pixels for vertical alignment at 72 DPI */
    pixelTolerance: 5,
    /** Default poetry detection options */
    poetryDetectionOptions: DEFAULT_POETRY_OPTIONS,
    /** Default delimiter for merged poetry pairs (hemistichs) */
    poetryPairDelimiter: ' ',
    /** Empty array of rectangles - will be populated during processing */
    rectangles: [],
} as const;

/**
 * Maximum number of words expected in a typical prose line.
 * Lines exceeding this count may indicate formatting issues or merged content
 * that should be split during text processing.
 */
export const MAX_PROSE_WORD_COUNT = 25;

/**
 * A regex pattern to detect common prose punctuation.
 * This includes:
 * - Arabic and English commas (، ,)
 * - Arabic and English semicolons (؛ ;)
 * - Arabic and English question marks (؟ ?)
 * - Arabic and English periods/full stops (۔ .)
 * - Colons (:)
 * - Parentheses (())
 */
export const PROSE_PUNCTUATION_PATTERN = /[،,؛;؟?۔.:()]/;

/**
 * Percentile used as the robust reference width for paragraph grouping.
 */
export const PARAGRAPH_WIDTH_PERCENTILE = 0.75;

/**
 * Percentile used for deriving the right-edge x baseline from candidate lines.
 */
export const PARAGRAPH_BASELINE_PERCENTILE = 0.25;

/**
 * Ratio of reference width used to detect right-edge indentation.
 * This is the coarse page-scale component of indentation detection and is
 * combined with a line-height floor for DPI resilience.
 */
export const PARAGRAPH_INDENT_THRESHOLD_RATIO = 0.04;

/**
 * Minimum pixel distance required before classifying a line as indented.
 *
 * This value is calibrated around 72 DPI coordinate spaces:
 * - 3 px @ 72 DPI ~= 0.042 in (~1.06 mm)
 * It acts only as a hard floor for tiny/noisy line-height inputs.
 */
export const PARAGRAPH_MIN_INDENT_PX = 3;

/**
 * Minimum indent floor expressed as a ratio of typical line height.
 * Helps keep indentation thresholds stable across different coordinate scales.
 */
export const PARAGRAPH_MIN_INDENT_HEIGHT_RATIO = 0.15;

/**
 * Minimum width ratio for lines that can participate in indentation checks.
 */
export const PARAGRAPH_MIN_INDENT_CANDIDATE_WIDTH_RATIO = 0.7;
