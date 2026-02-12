/**
 * Represents a rectangular bounding box with position and dimensions.
 * Used to define the location and size of text elements and structural components
 * within a document coordinate system.
 *
 * The coordinate system typically uses:
 * - Origin (0,0) at the top-left corner of the document
 * - X-axis extending rightward (for LTR text) or leftward (for RTL text after normalization)
 * - Y-axis extending downward
 */
export type BoundingBox = Size & {
    /**
     * The x-coordinate of the top-left corner of the bounding box in pixels.
     * This coordinate may be normalized depending on text direction:
     * - For LTR (left-to-right) text: represents distance from left edge
     * - For RTL (right-to-left) text: may be adjusted during processing
     */
    x: number;

    /**
     * The y-coordinate of the top-left corner of the bounding box in pixels.
     * Represents the distance from the top edge of the document.
     */
    y: number;
};

/**
 * Configuration options for determining if text content is centered on a page.
 * These settings control the tolerance and margin requirements for center detection,
 * which is important for identifying titles, headings, and poetic content.
 */
export type CenteringOptions = {
    /**
     * The tolerance for center point alignment as a ratio of image width.
     * This determines how precisely text must be centered to be considered "centered".
     *
     * For example:
     * - 0.05 means the observation's center can be within 5% of the page width
     *   from the true center and still be considered centered
     * - 0.02 would require more precise centering (within 2%)
     * - 0.1 would allow looser centering requirements (within 10%)
     *
     * @default 0.05
     */
    readonly centerToleranceRatio: number;

    /**
     * The minimum margin required on each side as a ratio of image width.
     * This ensures that "centered" text has adequate whitespace around it.
     *
     * For example:
     * - 0.1 means there must be at least 10% of the page width as whitespace
     *   on both the left and right sides of the observation
     * - 0.2 would require larger margins (20% on each side)
     * - 0.05 would allow tighter margins (5% on each side)
     *
     * @default 0.1
     */
    readonly minMarginRatio: number;
};

/**
 * Configuration options for the main text line mapping function.
 *
 * This type combines all the configuration needed to process OCR observations
 * into structured text lines, including poetry detection, centering analysis,
 * and layout element detection.
 */
export type MapObservationsToTextLinesOptions = CenteringOptions & {
    /**
     * Optional array of horizontal line elements detected in the document.
     * These are typically used to identify sections, headers, footers, or decorative elements.
     * When provided, text appearing below these lines may be classified as footnotes.
     */
    horizontalLines?: BoundingBox[];

    /** Are the coordinates from a RTL language? If it is we would flip the x-axis. */
    isRTL?: boolean;

    /**
     * Optional fixed line height factor for grouping observations into lines.
     * If not provided, the system will compute an adaptive factor based on document analysis.
     *
     * Typical values:
     * - 0.5: Very tight line grouping
     * - 1.0: Standard line height
     * - 1.5: Generous line spacing tolerance
     */
    lineHeightFactor?: number;

    /**
     * Optional logging function for debugging and monitoring the text processing pipeline.
     * When provided, the system will output detailed information about its decisions
     * and intermediate processing steps.
     *
     * @param message - Primary log message
     * @param args - Additional arguments for formatting or context
     */
    log?: (message: string, ...args: any[]) => void;

    /**
     * Additional vertical tolerance in pixels (at 72 DPI) for line grouping.
     * This value is automatically scaled based on the document's actual DPI.
     *
     * Higher values make line grouping more permissive (more text on same line).
     * Lower values make line grouping stricter (more separate lines).
     *
     * @default 5 pixels at 72 DPI
     */
    pixelTolerance?: number;

    /**
     * Configuration options for poetry detection algorithms.
     * If not provided, default poetry detection settings will be used.
     * Set to null or undefined to disable poetry detection entirely.
     */
    poetryDetectionOptions?: Partial<PoetryDetectionOptions>;

    /**
     * Optional array of rectangular elements detected in the document.
     * These are typically used to identify text boxes, highlighted sections, or headers.
     * When provided, text within these rectangles may be classified as headings.
     */
    rectangles?: BoundingBox[];
};

/**
 * Options for grouping text lines into paragraphs.
 *
 * These options replace positional arguments with named fields so callers can
 * tune behavior without relying on parameter ordering.
 */
export type ParagraphOptions = {
    /**
     * Factor for detecting paragraph breaks based on vertical spacing.
     *
     * Higher values make break detection stricter.
     *
     * @default 2
     */
    verticalJumpFactor: number;

    /**
     * Threshold for identifying short lines that indicate paragraph endings.
     *
     * Lower values mark fewer lines as "short".
     *
     * @default 0.85
     */
    widthTolerance: number;
};

/**
 * Represents a basic text observation extracted from OCR processing.
 *
 * This is the fundamental unit of OCR output, containing both the recognized
 * text content and its precise location within the document. Observations
 * typically represent individual words or short phrases as identified by
 * the OCR engine.
 */
export type Observation = {
    /**
     * The bounding box defining the exact position and dimensions of the text
     * within the document coordinate system. This includes:
     * - Position (x, y) of the top-left corner
     * - Dimensions (width, height) of the text area
     */
    bbox: BoundingBox;

    /**
     * The recognized text content of the observation.
     * This is the actual text string extracted by the OCR engine,
     * which may include punctuation, numbers, or special characters.
     */
    text: string;
};

/**
 * Canonical page metadata required for reconstruction.
 */
export type PageContext = {
    /**
     * Page width in pixels.
     */
    width: number;

    /**
     * Page height in pixels.
     */
    height: number;

    /**
     * Horizontal DPI.
     */
    dpiX: number;

    /**
     * Vertical DPI.
     */
    dpiY: number;
};

/**
 * Optional layout primitives extracted from a page.
 */
export type LayoutElements = {
    /**
     * Horizontal separators used for footnote boundary detection.
     */
    horizontalLines?: BoundingBox[];

    /**
     * Rectangles used for heading/boxed-content detection.
     */
    rectangles?: BoundingBox[];
};

/**
 * Input payload for one-shot paragraph reconstruction.
 */
export type ReconstructInput = {
    /**
     * OCR observations to reconstruct.
     */
    observations: Observation[];

    /**
     * Page geometry and DPI context.
     */
    page: PageContext;

    /**
     * Optional structural layout hints.
     */
    layout?: LayoutElements;
};

/**
 * Optional knobs for one-shot paragraph reconstruction.
 */
export type ReconstructOptions = {
    /**
     * Line-detection options.
     */
    line?: Partial<MapObservationsToTextLinesOptions>;

    /**
     * Paragraph-detection options.
     */
    paragraph?: Partial<ParagraphOptions>;

    /**
     * Text formatting options.
     */
    format?: {
        /**
         * Optional symbol to insert before first footnote.
         */
        footerSymbol?: string;
    };
};

/**
 * Configuration options to fine-tune the poetry detection algorithm.
 *
 * Poetry detection uses multiple heuristics to identify poetic content:
 * 1. **Paired hemistichs**: Two short lines that appear to be halves of a verse
 * 2. **Merged lines**: Single lines with distinctive spacing/density characteristics
 * 3. **Centering**: Lines that are centered with appropriate margins
 *
 * These options allow fine-tuning of each heuristic to balance precision and recall
 * for different types of documents and poetry styles.
 */
export type PoetryDetectionOptions = Partial<CenteringOptions> & {
    /**
     * Maximum allowed vertical gap between observations to be considered a poetry pair.
     * This controls how close two lines must be to be considered hemistichs (halves of a verse).
     *
     * The gap is measured as a ratio of the average height of the two observations:
     * - 2.0 means the gap can be up to 200% of the average line height
     * - 1.5 would require closer spacing (150% of average height)
     * - 3.0 would allow wider spacing (300% of average height)
     *
     * @default 2.0 (200% of average height)
     */
    maxVerticalGapRatio: number;

    /**
     * For merged lines heuristic: The minimum width a line must have to be considered.
     * This prevents very short lines (like page numbers) from being analyzed for poetry.
     *
     * Specified as a ratio of the image width:
     * - 0.6 means the line must span at least 60% of the page width
     * - 0.4 would include shorter lines (40% of page width)
     * - 0.8 would require longer lines (80% of page width)
     *
     * @default 0.6 (60% of image width)
     */
    minWidthRatioForMerged: null | number;

    /**
     * The minimum number of words a line must contain to be considered poetry.
     * This helps filter out noise like page numbers, single-word labels, or artifacts.
     *
     * Higher values reduce false positives but may miss short poetic lines.
     * Lower values increase sensitivity but may include more noise.
     *
     * @default 2
     */
    minWordCount: number;

    /**
     * For paired lines heuristic: How similar in width two hemistichs must be.
     * This determines whether two lines are balanced enough to be verse halves.
     *
     * The similarity check: `|width1 - width2| / average(width1, width2) < ratio`
     * - 0.4 means widths can differ by up to 40% of their average
     * - 0.2 would require more similar widths (20% difference)
     * - 0.6 would allow more variation (60% difference)
     *
     * @default 0.4 (40% width difference allowed)
     */
    pairWidthSimilarityRatio: number;

    /**
     * For paired lines heuristic: How similar in word count two hemistichs must be.
     * This ensures that verse halves have balanced content length.
     *
     * The similarity check: `|count1 - count2| / max(count1, count2) < ratio`
     * - 0.5 means word counts can differ by up to 50% of the larger count
     * - 0.3 would require more similar counts (30% difference)
     * - 0.7 would allow more variation (70% difference)
     *
     * @default 0.5 (50% word count difference allowed)
     */
    pairWordCountSimilarityRatio: number;

    /**
     * For merged lines heuristic: Word density threshold for identifying poetry.
     * Poetry typically has lower word density (more spacing) than prose.
     *
     * A line is considered poetic if its density (words per pixel) is less than
     * this ratio multiplied by the average prose density of the document.
     *
     * - 0.8 means poetic lines should have ≤80% of average prose density
     * - 0.9 would require density closer to prose (≤90%)
     * - 0.7 would require sparser text (≤70% of prose density)
     *
     * @default 0.8 (80% of average prose density)
     */
    wordDensityComparisonRatio: number;
};

/**
 * Represents the dimensions of a rectangular area.
 * Used as a base type for defining size properties in bounding boxes and other geometric shapes.
 */
export type Size = {
    /**
     * The height of the rectangular area in pixels.
     */
    readonly height: number;

    /**
     * The width of the rectangular area in pixels.
     */
    readonly width: number;
};

/**
 * A processed text block reconstructed from raw OCR observations.
 *
 * TextBlock represents a higher-level text unit (typically a line or paragraph)
 * that has been assembled from individual OCR observations and enriched with
 * semantic information about its role and characteristics within the document.
 *
 * This type extends the basic Observation with additional metadata that helps
 * in document structure analysis, formatting preservation, and content classification.
 */
export type TextBlock = Observation & {
    /**
     * Indicates whether the text is centered on the page.
     *
     * This is determined by analyzing the text's position relative to page margins
     * and ensuring adequate whitespace on both sides. Centered text often indicates:
     * - Document titles and headings
     * - Poetry or verse content
     * - Section headers
     * - Epigraphs or quotes
     *
     * The centering detection uses configurable tolerance and margin ratios
     * to account for slight misalignments and varying document layouts.
     */
    isCentered?: boolean;

    /**
     * Indicates whether this text is identified as a footnote.
     *
     * Footnotes are typically detected by their position relative to horizontal
     * line elements in the document. Text appearing below the last significant
     * horizontal line is often classified as footnote content. This classification
     * helps in:
     * - Separating main content from supplementary information
     * - Proper document structure reconstruction
     * - Academic and formal document processing
     */
    isFootnote?: boolean;

    /**
     * Indicates whether the text represents a heading or title.
     *
     * Headings are often identified by their visual presentation, such as:
     * - Being enclosed within rectangular borders or boxes
     * - Having distinctive spacing or positioning
     * - Being centered or specially formatted
     *
     * This classification helps in:
     * - Document outline generation
     * - Hierarchical content structuring
     * - Navigation and indexing
     */
    isHeading?: boolean;

    /**
     * Indicates whether this text is identified as a line of poetry or verse.
     *
     * Poetic content is detected using multiple heuristics including:
     * - Line length and spacing patterns
     * - Word density analysis
     * - Centering and alignment characteristics
     * - Paired hemistich detection
     *
     * Poetic lines receive special treatment during processing:
     * - They are not merged into standard paragraphs
     * - Line breaks are preserved as semantically significant
     * - Spacing and formatting are maintained more strictly
     *
     * This is crucial for preserving the artistic and structural integrity
     * of poems, verses, and other formatted literary content.
     */
    isPoetic?: boolean;
};

/**
 * Output payload from one-shot paragraph reconstruction.
 */
export type ReconstructResult = {
    /**
     * Intermediate line-level blocks.
     */
    lines: TextBlock[];

    /**
     * Final paragraph-level blocks.
     */
    paragraphs: TextBlock[];

    /**
     * Formatted plain text output.
     */
    text: string;
};
