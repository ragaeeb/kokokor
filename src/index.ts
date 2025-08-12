import type { TextBlock } from './types';

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

export * from './types';
export { mergeObservations } from './utils/grouping';
export { filterHorizontalLinesOutsideRectangles, mapMatrixToBoundingBox } from './utils/layout';
export { calculateDPI } from './utils/marking';
export { flipAndAlignObservations, mapObservationsToTextLines, mapTextLinesToParagraphs } from './utils/paragraphs';
