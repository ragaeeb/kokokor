/**
 * Represents a rectangular bounding box with position and dimensions.
 * Used to define the location and size of text elements and structural components.
 */
export type BoundingBox = Size & {
    /**
     * The x-coordinate of the top-left corner of the bounding box.
     * This coordinate may be normalized depending on text direction.
     */
    x: number;

    /**
     * The y-coordinate of the top-left corner of the bounding box.
     */
    y: number;
};

/**
 * Configuration options for OCR result processing and paragraph reconstruction.
 * These options control how text observations are grouped, aligned, and formatted.
 */
export type BuildTextBoxOptions = Partial<CenteringOptions> & {
    /**
     * The default DPI to use when the OCR result doesn't provide DPI information.
     * This ensures consistent scaling even with incomplete metadata.
     * @default 72
     */
    readonly fallbackDPI?: number;

    /**
     * The ratio used to consider what a line is based on the vertical proximity.
     * @default 0.49
     */
    readonly lineHeightFactor?: number;

    /**
     * Vertical tolerance in pixels (at 72 DPI) for line detection.
     * Higher values will be more lenient in grouping text with vertical offsets into the same line.
     * @default 5
     */
    readonly pixelTolerance?: number;

    /**
     * The target DPI for x-coordinate normalization.
     * Used to ensure consistent alignment thresholds regardless of source document resolution.
     * @default 300
     */
    readonly standardDpiX?: number;

    /**
     * Factor determining how much larger a vertical gap needs to be to indicate a paragraph break.
     * A value of 2 means a gap twice as large as the previous gap will start a new paragraph.
     * @default 2
     */
    readonly verticalJumpFactor?: number;

    /**
     * Fraction of maximum line width below which a line is considered "short" (0-1).
     * Short lines typically indicate paragraph endings and trigger paragraph breaks.
     * @default 0.85
     */
    readonly widthTolerance?: number;
};

/**
 * Configuration options for determining if an observation is centered.
 */
export type CenteringOptions = {
    /**
     * The tolerance for center point alignment as a ratio of image width.
     * For example, 0.05 means the observation's center can be within 5% of the page width
     * from the true center and still be considered centered.
     *
     * @default 0.05
     */
    readonly centerToleranceRatio: number;

    /**
     * The minimum margin required on each side as a ratio of image width.
     * For example, 0.1 means there must be at least 10% of the page width
     * as whitespace on both the left and right sides of the observation.
     *
     * @default 0.1
     */
    readonly minMarginRatio: number;
};

/**
 * Represents an observation with an index used for grouping observations by line or paragraph.
 * This extends the base Observation type by adding an index property for sorting and grouping.
 */
export type IndexedObservation = Observation & {
    /**
     * The index representing the line or paragraph number this observation belongs to.
     * Used for grouping related text elements together.
     */
    readonly index: number;
};

export type MapObservationsToTextLinesOptions = CenteringOptions & {
    horizontalLines?: BoundingBox[];
    lineHeightFactor?: number;
    log?: (message: string, ...args: any[]) => void;
    pixelTolerance?: number;
    poetryDetectionOptions?: PoetryDetectionOptions;
    rectangles?: BoundingBox[];
};

/**
 * Represents a basic text observation from OCR with position and content.
 * Contains the text content and its bounding box coordinates within the document.
 */
export type Observation = {
    /**
     * The bounding box defining the position and dimensions of the text in the document.
     */
    bbox: BoundingBox;

    /**
     * The text content of the observation.
     */
    text: string;
};

/**
 * Configuration options to fine-tune the poetry detection logic.
 */
export type PoetryDetectionOptions = CenteringOptions & {
    /**
     * Maximum allowed vertical gap between observations to be considered a poetry pair.
     * As a ratio of the average height of the two observations.
     * @default 2.0 (200% of average height)
     */
    maxVerticalGapRatio: number;

    /**
     * For merged lines: The minimum width a line must have to be considered for
     * this heuristic, as a ratio of the image width.
     * @default 0.6 (60%)
     */
    minWidthRatioForMerged: number;

    /**
     * The minimum number of words a line must have to be considered poetry.
     * Helps filter out noise like page numbers or single-word labels.
     * @default 2
     */
    minWordCount: number;

    /**
     * For paired lines: How similar in width two hemistichs must be.
     * The check is `|w1 - w2| / avg(w1, w2) < ratio`.
     * @default 0.4 (40%)
     */
    pairWidthSimilarityRatio: number;

    /**
     * For paired lines: How similar in word count two hemistichs must be.
     * The check is `|c1 - c2| / max(c1, c2) < ratio`.
     * @default 0.5 (50%)
     */
    pairWordCountSimilarityRatio: number;

    /**
     * For merged lines: A line is poetic if its density (words/pixel) is less than
     * this ratio multiplied by the average prose density of the document.
     * @default 0.8 (80%)
     */
    wordDensityComparisonRatio: number;
};

export type RebuildOptions = BuildTextBoxOptions & {
    /**
     * Symbol or text to use as a footer marker when horizontal lines are detected.
     * When provided, this text will be inserted below the last horizontal line in the document.
     * @default undefined
     */
    readonly footerSymbol?: string;
};

export type Size = {
    /**
     * The height of the bounding box.
     */
    readonly height: number;

    /**
     * The width of the bounding box.
     */
    readonly width: number;
};

/**
 * A reconstructed text paragraph from the raw OCR data.
 */
export type TextBlock = IndexedObservation & {
    /** If the text is centered on the page. This is true if there is at least some padding around the text and it does not span up to the margins. */
    isCentered?: boolean;

    /** If this text is a footnote. This is generally associated with texts appearing below the last horizontal line. */
    isFootnote?: boolean;

    /** If the text represents a heading. This is generally associated with texts that are surrounded in rectangles. */
    isHeading?: boolean;

    /** Is a line of poem. These will not be merged into paragraphs. */
    isPoetic?: boolean;
};
