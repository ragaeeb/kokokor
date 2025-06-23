import type { BoundingBox, MapObservationsToTextLinesOptions, Observation, TextBlock } from '@/types';

import { DEFAULT_OBSERVATIONS_TO_TEXT_LINES_OPTIONS, DEFAULT_POETRY_OPTIONS } from './constants';
import { groupByIndex, mergeGroupedObservations, sortGroupsHorizontally } from './grouping';
import { getLastHorizontalLineY, isBoundingBoxContained, isObservationCentered } from './layout';
import { indexItemsAsLines, indexItemsAsParagraphs } from './marking';
import {
    filterNoisyObservations,
    mapOcrResultToRTLObservations,
    normalizeObservationsX,
    simplifyObservations,
} from './normalization';
import { calculateAverageProseDensity, isPoeticGroup } from './poetry';

/**
 * Preprocesses observations by filtering noise, flipping coordinates for RTL text,
 * and normalizing x-coordinates for proper alignment.
 *
 * @param observations - Array of text observations to preprocess
 * @param imageWidth - Total width of the document/image in pixels
 * @param dpiX - Horizontal DPI for coordinate normalization
 * @param options - Optional logging configuration
 * @returns Preprocessed observations ready for line grouping
 */
export const flipAndAlignObservations = (
    observations: Observation[],
    imageWidth: number,
    dpiX: number,
    options: Pick<MapObservationsToTextLinesOptions, 'log'> = {},
) => {
    observations = observations.filter(filterNoisyObservations);

    if (observations.length === 0) {
        return [];
    }

    if (options.log) {
        options.log('mapOcrResultToRTLObservations', observations, imageWidth);
    }

    observations = mapOcrResultToRTLObservations(observations, imageWidth);

    if (options.log) {
        options.log('normalizeObservationsX', observations, dpiX);
    }

    return normalizeObservationsX(observations, dpiX);
};

/**
 * Converts OCR observations into structured text lines with metadata.
 *
 * Groups observations into lines based on vertical proximity, applies centering detection,
 * identifies headings (text within rectangles), footnotes (text below horizontal lines),
 * and poetic content. Also performs poetry detection to preserve poetic formatting.
 *
 * @param observations - Array of OCR text observations
 * @param dpi - Document DPI information including width and height
 * @param opts - Configuration options for text line processing
 * @returns Array of text blocks with metadata (centering, headings, footnotes, poetry)
 */
export const mapObservationsToTextLines = (
    observations: Observation[],
    dpi: BoundingBox,
    opts?: Partial<MapObservationsToTextLinesOptions>,
) => {
    const options: MapObservationsToTextLinesOptions = {
        ...DEFAULT_OBSERVATIONS_TO_TEXT_LINES_OPTIONS,
        poetryDetectionOptions: DEFAULT_POETRY_OPTIONS,
        ...opts,
    };
    observations = flipAndAlignObservations(observations, dpi.width, dpi.x, options);

    if (observations.length === 0) {
        return [];
    }

    if (options.log) {
        options.log('indexObservationsAsLines', observations, dpi.y, options.pixelTolerance, options.lineHeightFactor);
    }

    const footerLineY = getLastHorizontalLineY(
        options.rectangles || [],
        options.horizontalLines || [],
        options.pixelTolerance,
    );
    const avgProseWordDensity = calculateAverageProseDensity(observations, dpi.width, options.poetryDetectionOptions!);
    const marked = indexItemsAsLines(observations, dpi.y, options.pixelTolerance!, options.lineHeightFactor).map(
        (o) => {
            const e: TextBlock & { index: number } = { ...o };

            const isObservationInsideRectangle = options.rectangles?.some((rectangle) =>
                isBoundingBoxContained(o.bbox, rectangle, options.pixelTolerance!),
            );

            if (isObservationInsideRectangle) {
                e.isHeading = true;
            }

            if (isObservationCentered(o.bbox, dpi.width, options)) {
                e.isCentered = true;
            }

            if (footerLineY !== undefined && o.bbox.y > footerLineY) {
                e.isFootnote = true;
            }

            return e;
        },
    );

    let groups = groupByIndex(marked);

    if (options.log) {
        options.log('sortGroupsHorizontally', groups);
    }

    groups = sortGroupsHorizontally(groups);

    if (options.log) {
        options.log(
            'isPoeticGroup',
            groups.map((g) => simplifyObservations(g)),
            avgProseWordDensity,
            options.poetryDetectionOptions,
        );
    }

    for (const group of groups) {
        if (isPoeticGroup(group, dpi.width, avgProseWordDensity, options.poetryDetectionOptions!)) {
            for (const observation of group) {
                observation.isPoetic = true;
            }
        }
    }

    return mergeGroupedObservations(groups) as TextBlock[];
};

const groupProseToParagraphs = (textLines: TextBlock[], verticalJumpFactor: number, widthTolerance: number) => {
    const result: TextBlock[] = [];
    const current: TextBlock[] = [];

    const mergeCurrentParagraph = () => {
        const marked = indexItemsAsParagraphs(current, verticalJumpFactor, widthTolerance);
        const groups = groupByIndex(marked);
        result.push(...(mergeGroupedObservations(groups) as TextBlock[]));
    };

    for (const line of textLines) {
        if (line.isPoetic) {
            if (current.length > 0) {
                // we encountered a poetry line, so collapse all previously accumulated lines into paragraph then add this one
                mergeCurrentParagraph();
                current.length = 0;
            }

            result.push(line);
        } else {
            current.push(line);
        }
    }

    if (current.length > 0) {
        mergeCurrentParagraph();
    }

    return result;
};

/**
 * Groups text lines into coherent paragraphs, handling both prose and poetry.
 *
 * Prose lines are grouped into paragraphs based on vertical spacing and line width patterns.
 * Poetic lines are preserved individually to maintain their formatting.
 * Processes body content and footnotes separately.
 *
 * @param textLines - Array of text lines to group into paragraphs
 * @param verticalJumpFactor - Factor for detecting paragraph breaks based on vertical spacing (default: 2)
 * @param widthTolerance - Threshold for identifying "short" lines that indicate paragraph breaks (default: 0.85)
 * @returns Array of text blocks representing complete paragraphs
 */
export const mapTextLinesToParagraphs = (textLines: TextBlock[], verticalJumpFactor = 2, widthTolerance = 0.85) => {
    const bodyBlocks: TextBlock[] = groupProseToParagraphs(
        textLines.filter((t) => !t.isFootnote),
        verticalJumpFactor,
        widthTolerance,
    );
    const footerBlocks: TextBlock[] = groupProseToParagraphs(
        textLines.filter((t) => t.isFootnote),
        verticalJumpFactor,
        widthTolerance,
    );

    return bodyBlocks.concat(footerBlocks);
};
