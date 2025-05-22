/**
 * Represents a rectangular bounding box with position and dimensions.
 * Used to define the location and size of text elements and structural components.
 */
export type BoundingBox = {
    /**
     * The height of the bounding box.
     */
    readonly height: number;

    /**
     * The width of the bounding box.
     */
    readonly width: number;

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

/**
 * Represents a basic text observation from OCR with position and content.
 * Contains the text content and its bounding box coordinates within the document.
 */
export type Observation = {
    /**
     * The bounding box defining the position and dimensions of the text in the document.
     */
    readonly bbox: BoundingBox;

    /**
     * The text content of the observation.
     */
    readonly text: string;
};

/**
 * Represents the complete result of an OCR operation on a document.
 * Contains the document dimensions, observations, and optional structural elements.
 */
export type OcrResult = {
    /**
     * The dimensions and DPI information of the document.
     */
    readonly dpi: BoundingBox;

    /**
     * Optional array of horizontal lines detected in the document.
     * Often used for identifying page breaks, section separators, or footers.
     */
    readonly horizontalLines?: BoundingBox[];

    /**
     * Array of text observations extracted from the document.
     */
    readonly observations: Observation[];

    /**
     * Matching observations extracted from surya for typo corrections.
     */
    readonly suryaObservations?: Observation[];

    /**
     * Optional array of rectangle coordinates to process chapter titles.
     */
    readonly rectangles?: BoundingBox[];
};

export type FixTypoOptions = {
    readonly typoSymbols: string[];
    readonly similarityThreshold: number;
    readonly highSimilarityThreshold: number;
};

/**
 * Configuration options for OCR result processing and paragraph reconstruction.
 * These options control how text observations are grouped, aligned, and formatted.
 */
export type RebuildOptions = Partial<FixTypoOptions> & {
    /**
     * The default DPI to use when the OCR result doesn't provide DPI information.
     * This ensures consistent scaling even with incomplete metadata.
     * @default 72
     */
    readonly fallbackDPI?: number;

    /**
     * Symbol or text to use as a footer marker when horizontal lines are detected.
     * When provided, this text will be inserted below the last horizontal line in the document.
     * @default undefined
     */
    readonly footerSymbol?: string;

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

type SuryaTextLine = {
    /** the axis-aligned rectangle for the text line in (x1, y1, x2, y2) format. (x1, y1) is the top left corner, and (x2, y2) is the bottom right corner. */
    readonly bbox: number[];

    /** the text in the line */
    readonly text: string;

    /** the individual characters in the line */
    readonly chars: SuryaTextLine[];
};

export type SuryaPageOcrResult = {
    readonly text_lines: SuryaTextLine[];
};
