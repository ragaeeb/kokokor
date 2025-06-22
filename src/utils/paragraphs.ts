import type { BoundingBox, MapObservationsToTextLinesOptions, Observation, TextBlock } from '@/types';

import { DEFAULT_OBSERVATIONS_TO_TEXT_LINES_OPTIONS, DEFAULT_POETRY_OPTIONS } from './constants';
import { groupByIndex, mergeGroupedObservations, sortGroupsHorizontally } from './grouping';
import { getLastHorizontalLineY, isBoundingBoxContained, isObservationCentered } from './layout';
import { indexItemsAsLines, indexItemsAsParagraphs } from './marking';
import { filterNoisyObservations, mapOcrResultToRTLObservations, normalizeObservationsX } from './normalization';
import { calculateAverageProseDensity, isPoeticGroup } from './poetry';

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

export const mapObservationsToTextLines = (
    observations: Observation[],
    dpi: BoundingBox,
    opts: MapObservationsToTextLinesOptions,
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
