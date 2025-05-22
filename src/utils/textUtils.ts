const PATTERNS = {
    htmlTag: /<\/?[^>]+>/g,
    basicTag: /<\/?[a-z][^>]*?>/i,
    tatweel: /\u0640/g,
    diacritics: /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g,
    footnoteStandalone: /^\(?[0-9\u0660-\u0669]+\)?[،\.]?$/,
    footnoteEmbedded: /\([0-9\u0660-\u0669]+\)/,
    arabicDigits: /[0-9\u0660-\u0669]+/,
    whitespace: /\s+/,
};

/**
 * Normalizes Arabic text by removing diacritics, tatweel, and basic tags
 */
export const normalizeArabicText = (text: string): string => {
    return text.replace(PATTERNS.basicTag, '').replace(PATTERNS.tatweel, '').replace(PATTERNS.diacritics, '').trim();
};

/**
 * Extracts digit sequence from text for footnote comparison
 */
export const extractDigits = (text: string): string => {
    const match = text.match(PATTERNS.arabicDigits);
    return match ? match[0] : '';
};

/**
 * Tokenizes text while preserving honorific symbols and removing HTML
 */
export const tokenizeText = (text: string, preserveSymbols: string[] = []): string[] => {
    if (!text?.trim()) return [];

    let processedText = text.replace(PATTERNS.htmlTag, ' ');

    // Add spaces around each preserve symbol to ensure they're tokenized separately
    for (const symbol of preserveSymbols) {
        const symbolRegex = new RegExp(symbol, 'g');
        processedText = processedText.replace(symbolRegex, ` ${symbol} `);
    }

    return processedText.trim().split(PATTERNS.whitespace).filter(Boolean);
};

/**
 * Handles fusion of standalone and embedded footnotes
 */
export const handleFootnoteFusion = (result: string[], previousToken: string, currentToken: string): boolean => {
    const prevIsStandalone = PATTERNS.footnoteStandalone.test(previousToken);
    const currHasEmbedded = PATTERNS.footnoteEmbedded.test(currentToken);
    const currIsStandalone = PATTERNS.footnoteStandalone.test(currentToken);
    const prevHasEmbedded = PATTERNS.footnoteEmbedded.test(previousToken);

    const prevDigits = extractDigits(previousToken);
    const currDigits = extractDigits(currentToken);

    // Replace standalone with fused version: (٥) + (٥)أخرجه → (٥)أخرجه
    if (prevIsStandalone && currHasEmbedded && prevDigits === currDigits) {
        result[result.length - 1] = currentToken;
        return true;
    }

    // Skip trailing standalone: (٥)أخرجه + (٥) → (٥)أخرجه
    if (prevHasEmbedded && currIsStandalone && prevDigits === currDigits) {
        return true;
    }

    return false;
};

/**
 * Handles selection logic for tokens with embedded footnotes
 */
export const handleFootnoteSelection = (tokenA: string, tokenB: string): string[] | null => {
    const aHasEmbedded = PATTERNS.footnoteEmbedded.test(tokenA);
    const bHasEmbedded = PATTERNS.footnoteEmbedded.test(tokenB);

    if (aHasEmbedded && !bHasEmbedded) return [tokenA];
    if (bHasEmbedded && !aHasEmbedded) return [tokenB];
    if (aHasEmbedded && bHasEmbedded) {
        return [tokenA.length <= tokenB.length ? tokenA : tokenB];
    }

    return null;
};

/**
 * Handles selection logic for standalone footnote tokens
 */
export const handleStandaloneFootnotes = (tokenA: string, tokenB: string): string[] | null => {
    const aIsFootnote = PATTERNS.footnoteStandalone.test(tokenA);
    const bIsFootnote = PATTERNS.footnoteStandalone.test(tokenB);

    if (aIsFootnote && !bIsFootnote) return [tokenA, tokenB];
    if (bIsFootnote && !aIsFootnote) return [tokenB, tokenA];
    if (aIsFootnote && bIsFootnote) {
        return [tokenA.length <= tokenB.length ? tokenA : tokenB];
    }

    return null;
};
