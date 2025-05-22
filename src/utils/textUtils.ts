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
 * Normalizes Arabic text by removing diacritics, tatweel marks, and basic HTML tags.
 * This normalization enables better text comparison by focusing on core characters
 * while ignoring decorative elements that don't affect meaning.
 *
 * @param text - Arabic text to normalize
 * @returns Normalized text with diacritics, tatweel, and basic tags removed
 * @example
 * normalizeArabicText('اَلسَّلَامُ عَلَيْكُمْ') // Returns 'السلام عليكم'
 */
export const normalizeArabicText = (text: string): string => {
    return text.replace(PATTERNS.basicTag, '').replace(PATTERNS.tatweel, '').replace(PATTERNS.diacritics, '').trim();
};

/**
 * Extracts the first sequence of Arabic or Western digits from text.
 * Used primarily for footnote number comparison to match related footnote elements.
 *
 * @param text - Text containing digits to extract
 * @returns First digit sequence found, or empty string if none found
 * @example
 * extractDigits('(٥)أخرجه البخاري') // Returns '٥'
 * extractDigits('See note (123)') // Returns '123'
 */
export const extractDigits = (text: string): string => {
    const match = text.match(PATTERNS.arabicDigits);
    return match ? match[0] : '';
};

/**
 * Tokenizes text into individual words while preserving special symbols.
 * Removes HTML tags, adds spacing around preserved symbols to ensure they
 * are tokenized separately, then splits on whitespace.
 *
 * @param text - Text to tokenize
 * @param preserveSymbols - Array of symbols that should be tokenized as separate tokens
 * @returns Array of tokens, or empty array if input is empty/whitespace
 * @example
 * tokenizeText('Hello ﷺ world', ['ﷺ']) // Returns ['Hello', 'ﷺ', 'world']
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
 * Handles fusion of standalone and embedded footnotes during token processing.
 * Detects patterns where standalone footnotes should be merged with embedded ones
 * or where trailing standalone footnotes should be skipped.
 *
 * @param result - Current result array being built
 * @param previousToken - The previous token in the sequence
 * @param currentToken - The current token being processed
 * @returns True if the current token was handled (fused or skipped), false otherwise
 * @example
 * // (٥) + (٥)أخرجه → result gets (٥)أخرجه
 * // (٥)أخرجه + (٥) → (٥) is skipped
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
 * Handles selection logic for tokens with embedded footnotes during alignment.
 * Prefers tokens that contain embedded footnotes over plain text, and among
 * tokens with embedded footnotes, prefers the shorter one.
 *
 * @param tokenA - First token to compare
 * @param tokenB - Second token to compare
 * @returns Array containing selected token(s), or null if no special handling needed
 * @example
 * handleFootnoteSelection('text', '(١)text') // Returns ['(١)text']
 * handleFootnoteSelection('(١)longtext', '(١)text') // Returns ['(١)text']
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
 * Handles selection logic for standalone footnote tokens during alignment.
 * Manages cases where one or both tokens are standalone footnotes, preserving
 * both tokens when one is a footnote and the other is regular text.
 *
 * @param tokenA - First token to compare
 * @param tokenB - Second token to compare
 * @returns Array containing selected token(s), or null if no special handling needed
 * @example
 * handleStandaloneFootnotes('(١)', 'text') // Returns ['(١)', 'text']
 * handleStandaloneFootnotes('(١)', '(٢)') // Returns ['(١)'] (shorter one)
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
