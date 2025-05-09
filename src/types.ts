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
};

/**
 * Represents a rectangular bounding box with position and dimensions.
 * Used to define the location and size of text elements and structural components.
 */
type BoundingBox = {
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
