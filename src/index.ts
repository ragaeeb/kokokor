import type { BoundingBox, ReconstructInput, ReconstructOptions, ReconstructResult, TextBlock } from './types';
import { mapObservationsToTextLines, mapTextLinesToParagraphs } from './utils/paragraphs';

/**
 * Formats an array of text blocks into a readable string with proper paragraph breaks.
 *
 * @param textBlocks - Array of text blocks to format
 * @param footerSymbol - Optional symbol to insert before the first footnote
 * @returns Formatted text string with proper line breaks and spacing
 */
export const formatTextBlocks = (textBlocks: TextBlock[], footerSymbol?: string) => {
    let isAtLeastOneFootnoteHit = false;

    const paragraphs = textBlocks.flatMap((t) => {
        if (footerSymbol && t.isFootnote && !isAtLeastOneFootnoteHit) {
            isAtLeastOneFootnoteHit = true;
            return [footerSymbol, t.text];
        }

        if (t.isHeading) {
            return [t.text, ''];
        }

        return [t.text];
    });

    return paragraphs.join('\n');
};

/**
 * One-shot API for OCR paragraph reconstruction.
 *
 * Converts observations into lines, groups lines into paragraphs, then formats text.
 */
export const reconstructParagraphs = (
    input: ReconstructInput,
    options: ReconstructOptions = {},
): ReconstructResult => {
    const page: BoundingBox = {
        height: input.page.height,
        width: input.page.width,
        x: input.page.dpiX,
        y: input.page.dpiY,
    };

    const lines = mapObservationsToTextLines(input.observations, page, {
        horizontalLines: input.layout?.horizontalLines,
        rectangles: input.layout?.rectangles,
        ...(options.line || {}),
    });
    const paragraphs = mapTextLinesToParagraphs(lines, options.paragraph || {});
    const text = formatTextBlocks(paragraphs, options.format?.footerSymbol);

    return { lines, paragraphs, text };
};

export * from './types';
export { mergeObservations } from './utils/grouping';
export { filterHorizontalLinesOutsideRectangles, mapMatrixToBoundingBox } from './utils/layout';
export { calculateDPI } from './utils/marking';
export { flipAndAlignObservations, mapObservationsToTextLines, mapTextLinesToParagraphs } from './utils/paragraphs';
