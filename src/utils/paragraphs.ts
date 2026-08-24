import type {
    MapObservationsToTextLinesOptions,
    Observation,
    PageContext,
    ParagraphOptions,
    PoetryDetectionOptions,
    TextBlock,
} from '@/types';

import { DEFAULT_OBSERVATIONS_TO_TEXT_LINES_OPTIONS, DEFAULT_POETRY_OPTIONS } from './constants';
import { groupByIndex, mergeGroupedObservations, mergeObservations, sortGroupsHorizontally } from './grouping';
import {
    filterStructuralRectangles,
    getFootnoteSeparatorY,
    isBoundingBoxContained,
    isObservationCentered,
} from './layout';
import { indexItemsAsLines, indexItemsAsParagraphs } from './marking';
import {
    filterObservationsByContent,
    mapOcrResultToRTLObservations,
    normalizeObservationsX,
    simplifyObservations,
} from './normalization';
import { resolveWithDefaults } from './options';
import { calculateAverageProseDensity, isPoeticGroup } from './poetry';

type ResolvedParagraphOptions = Required<ParagraphOptions>;

const DEFAULT_PARAGRAPH_OPTIONS: ResolvedParagraphOptions = {
    verticalJumpFactor: 2,
    widthTolerance: 0.85,
};

const isPoetryPairGroup = (group: (Observation & { isPoetic?: boolean })[]) =>
    group.length === 2 && group.every((item) => item.isPoetic);

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
    options: Partial<Pick<MapObservationsToTextLinesOptions, 'contentFilter' | 'isRTL' | 'log'>> = {},
) => {
    observations = filterObservationsByContent(observations, options.contentFilter);

    if (observations.length === 0) {
        return [];
    }

    if (options.log) {
        options.log('mapOcrResultToRTLObservations', observations, imageWidth);
    }

    if (options.isRTL) {
        observations = mapOcrResultToRTLObservations(observations, imageWidth);
    }

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
 * @param page - Page dimensions and DPI information.
 * @param opts - Configuration options for text line processing
 * @returns Array of text blocks with metadata (centering, headings, footnotes, poetry)
 */
export const mapObservationsToTextLines = (
    observations: Observation[],
    page: PageContext,
    opts?: Partial<MapObservationsToTextLinesOptions>,
) => {
    const options: MapObservationsToTextLinesOptions = {
        ...resolveWithDefaults(DEFAULT_OBSERVATIONS_TO_TEXT_LINES_OPTIONS, opts),
        // Merge poetry options specifically instead of replacing them
        poetryDetectionOptions: resolveWithDefaults(DEFAULT_POETRY_OPTIONS, opts?.poetryDetectionOptions ?? {}),
    };
    observations = flipAndAlignObservations(observations, page.width, page.dpiX, options);

    if (observations.length === 0) {
        return [];
    }

    const structuralRectangles = filterStructuralRectangles(options.rectangles || [], page);

    if (options.log) {
        options.log(
            'indexObservationsAsLines',
            observations,
            page.dpiY,
            options.pixelTolerance,
            options.lineHeightFactor,
        );
    }

    const footerLineY = getFootnoteSeparatorY(
        structuralRectangles,
        options.horizontalLines || [],
        { observations, pageHeight: page.height, pageWidth: page.width },
        options.pixelTolerance,
    );
    const avgProseWordDensity = calculateAverageProseDensity(
        observations,
        page.width,
        options.poetryDetectionOptions as PoetryDetectionOptions,
    );
    const marked = indexItemsAsLines(observations, page.dpiY, options.pixelTolerance!, options.lineHeightFactor).map(
        (o) => {
            const e: TextBlock & { index: number } = { ...o };

            const isObservationInsideRectangle = structuralRectangles.some((rectangle) =>
                isBoundingBoxContained(o.bbox, rectangle, options.pixelTolerance!),
            );

            if (isObservationInsideRectangle) {
                e.isHeading = true;
            }

            if (isObservationCentered(o.bbox, page.width, options)) {
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
        if (
            isPoeticGroup(
                group,
                page.width,
                avgProseWordDensity,
                options.poetryDetectionOptions as PoetryDetectionOptions,
            )
        ) {
            for (const observation of group) {
                observation.isPoetic = true;
            }
        }
    }

    const merged = groups.map((group) => {
        if (group.length === 1) {
            return group[0];
        }

        const delimiter = isPoetryPairGroup(group) ? (options.poetryPairDelimiter ?? ' ') : ' ';
        return mergeObservations(group, delimiter);
    });

    return merged as TextBlock[];
};

/**
 * Collapses consecutive prose lines into paragraphs while preserving poetry blocks.
 *
 * @param textLines - The ordered text lines to group.
 * @param verticalJumpFactor - Factor that determines when a vertical gap indicates a new paragraph.
 * @param widthTolerance - Threshold for identifying short lines that should terminate a paragraph.
 * @returns Text blocks that represent merged prose paragraphs alongside untouched poetry lines.
 */
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
 * @param options - Object-based paragraph detection settings.
 * @returns Array of text blocks representing complete paragraphs
 */
export const mapTextLinesToParagraphs = (textLines: TextBlock[], options: ParagraphOptions = {}) => {
    const resolvedOptions = resolveWithDefaults(DEFAULT_PARAGRAPH_OPTIONS, options);
    const bodyBlocks: TextBlock[] = groupProseToParagraphs(
        textLines.filter((t) => !t.isFootnote),
        resolvedOptions.verticalJumpFactor,
        resolvedOptions.widthTolerance,
    );
    const footerBlocks: TextBlock[] = groupProseToParagraphs(
        textLines.filter((t) => t.isFootnote),
        resolvedOptions.verticalJumpFactor,
        resolvedOptions.widthTolerance,
    );

    return bodyBlocks.concat(footerBlocks);
};
