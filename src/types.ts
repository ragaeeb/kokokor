import { ALWAYS_BREAK, SEGMENT_BREAK } from './utils/constants';

export type Hints = Record<string, string[][]>;

/**
 * Represents a segment during the marking and processing stage.
 * Contains an array of tokens that may include segment break markers.
 */
export type MarkedSegment = {
    /**
     * End time of the segment in seconds
     */
    end: number;

    /**
     * Start time of the segment in seconds
     */
    start: number;

    /**
     * Array of tokens and segment break markers that make up this segment
     */
    tokens: MarkedToken[];
};

/**
 * Represents either a token or a segment break marker.
 * Used during the processing of text to identify natural break points.
 */
export type MarkedToken = Token | typeof ALWAYS_BREAK | typeof SEGMENT_BREAK;

export type MarkTokensWithDividersOptions = {
    fillers?: string[];
    gapThreshold: number;
    hints?: Hints;
};

/**
 * Represents a segment of text with timing information and optional word-level tokens.
 * A segment is a higher-level structure that contains a sequence of related tokens.
 */
export type Segment = Token & {
    /**
     * Word-by-word breakdown of the transcription with individual timings
     */
    tokens: Token[];
};

/**
 * Represents a single token (word or phrase) with timing information.
 * This is the basic unit of transcribed or OCRed text.
 */
export type Token = {
    /**
     * End time in seconds.
     */
    end: number;

    /**
     * Start time in seconds.
     */
    start: number;
    /**
     * The transcribed text
     */
    text: string;
};
