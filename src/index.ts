import type { TextBlock } from './types';

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
export { filterHorizontalLinesOutsideRectangles, mapMatrixToBoundingBox } from './utils/layout';
export { calculateDPI } from './utils/marking';
export { flipAndAlignObservations, mapObservationsToTextLines, mapTextLinesToParagraphs } from './utils/paragraphs';
