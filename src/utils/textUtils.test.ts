import { describe, expect, it } from 'bun:test';
import {
    normalizeArabicText,
    extractDigits,
    tokenizeText,
    handleFootnoteFusion,
    handleFootnoteSelection,
    handleStandaloneFootnotes,
} from './textUtils';

describe('textUtils', () => {
    describe('normalizeArabicText', () => {
        it('should remove diacritics from Arabic text', () => {
            const input = 'اَلسَّلَامُ عَلَيْكُمْ';
            const expected = 'السلام عليكم';
            expect(normalizeArabicText(input)).toBe(expected);
        });

        it('should remove tatweel marks', () => {
            const input = 'الـــرحـــمن';
            const expected = 'الرحمن';
            expect(normalizeArabicText(input)).toBe(expected);
        });

        it('should handle empty string', () => {
            expect(normalizeArabicText('')).toBe('');
        });

        it('should trim whitespace', () => {
            const input = '  النص  ';
            const expected = 'النص';
            expect(normalizeArabicText(input)).toBe(expected);
        });
    });

    describe('extractDigits', () => {
        it('should extract Arabic digits', () => {
            const input = '(٥)أخرجه البخاري';
            expect(extractDigits(input)).toBe('٥');
        });

        it('should extract Western digits', () => {
            const input = 'See note (123) for details';
            expect(extractDigits(input)).toBe('123');
        });

        it('should return first digit sequence', () => {
            const input = '(١) some text (٢)';
            expect(extractDigits(input)).toBe('١');
        });

        it('should return empty string if no digits found', () => {
            const input = 'no digits here';
            expect(extractDigits(input)).toBe('');
        });

        it('should handle empty string', () => {
            expect(extractDigits('')).toBe('');
        });

        it('should extract multi-digit sequences', () => {
            const input = '(١٢٣)';
            expect(extractDigits(input)).toBe('١٢٣');
        });
    });

    describe('tokenizeText', () => {
        it('should tokenize simple text', () => {
            const input = 'hello world test';
            const expected = ['hello', 'world', 'test'];
            expect(tokenizeText(input)).toEqual(expected);
        });

        it('should preserve special symbols', () => {
            const input = 'محمد ﷺ رسول الله';
            const expected = ['محمد', 'ﷺ', 'رسول', 'الله'];
            expect(tokenizeText(input, ['ﷺ'])).toEqual(expected);
        });

        it('should remove HTML tags', () => {
            const input = '<p>hello</p> <b>world</b>';
            const expected = ['hello', 'world'];
            expect(tokenizeText(input)).toEqual(expected);
        });

        it('should handle empty string', () => {
            expect(tokenizeText('')).toEqual([]);
        });

        it('should handle whitespace-only string', () => {
            expect(tokenizeText('   ')).toEqual([]);
        });

        it('should handle multiple preserve symbols', () => {
            const input = 'بسم ﷽ الله ﷻ الرحمن';
            const expected = ['بسم', '﷽', 'الله', 'ﷻ', 'الرحمن'];
            expect(tokenizeText(input, ['﷽', 'ﷻ'])).toEqual(expected);
        });

        it('should handle preserve symbols at boundaries', () => {
            const input = 'ﷺ start and end ﷺ';
            const expected = ['ﷺ', 'start', 'and', 'end', 'ﷺ'];
            expect(tokenizeText(input, ['ﷺ'])).toEqual(expected);
        });
    });

    describe('handleFootnoteFusion', () => {
        it('should fuse standalone with embedded footnote', () => {
            const result = ['(٥)'];
            const success = handleFootnoteFusion(result, '(٥)', '(٥)أخرجه');
            expect(success).toBe(true);
            expect(result).toEqual(['(٥)أخرجه']);
        });

        it('should skip trailing standalone footnote', () => {
            const result = ['(٥)أخرجه'];
            const success = handleFootnoteFusion(result, '(٥)أخرجه', '(٥)');
            expect(success).toBe(true);
            expect(result).toEqual(['(٥)أخرجه']);
        });

        it('should not fuse when digits differ', () => {
            const result = ['(٥)'];
            const success = handleFootnoteFusion(result, '(٥)', '(٦)أخرجه');
            expect(success).toBe(false);
            expect(result).toEqual(['(٥)']);
        });

        it('should handle Western digits', () => {
            const result = ['(5)'];
            const success = handleFootnoteFusion(result, '(5)', '(5)reference');
            expect(success).toBe(true);
            expect(result).toEqual(['(5)reference']);
        });

        it('should not process non-footnote tokens', () => {
            const result = ['hello'];
            const success = handleFootnoteFusion(result, 'hello', 'world');
            expect(success).toBe(false);
            expect(result).toEqual(['hello']);
        });
    });

    describe('handleFootnoteSelection', () => {
        it('should prefer embedded footnote over plain text', () => {
            const result = handleFootnoteSelection('text', '(١)text');
            expect(result).toEqual(['(١)text']);
        });

        it('should prefer plain text when first has embedded footnote', () => {
            const result = handleFootnoteSelection('(١)text', 'text');
            expect(result).toEqual(['(١)text']);
        });

        it('should prefer shorter embedded footnote', () => {
            const result = handleFootnoteSelection('(١)longtext', '(١)text');
            expect(result).toEqual(['(١)text']);
        });

        it('should return null for non-footnote tokens', () => {
            const result = handleFootnoteSelection('hello', 'world');
            expect(result).toBeNull();
        });

        it('should handle both tokens having embedded footnotes', () => {
            const result = handleFootnoteSelection('(١)very long text here', '(٢)short');
            expect(result).toEqual(['(٢)short']);
        });
    });

    describe('handleStandaloneFootnotes', () => {
        it('should return both when first is footnote', () => {
            const result = handleStandaloneFootnotes('(١)', 'text');
            expect(result).toEqual(['(١)', 'text']);
        });

        it('should return both when second is footnote', () => {
            const result = handleStandaloneFootnotes('text', '(١)');
            expect(result).toEqual(['(١)', 'text']);
        });

        it('should prefer shorter when both are footnotes', () => {
            const result = handleStandaloneFootnotes('(١)', '(٢).');
            expect(result).toEqual(['(١)']);
        });

        it('should return null for non-footnote tokens', () => {
            const result = handleStandaloneFootnotes('hello', 'world');
            expect(result).toBeNull();
        });

        it('should handle Arabic footnote patterns', () => {
            const result = handleStandaloneFootnotes('(٥)،', 'النص');
            expect(result).toEqual(['(٥)،', 'النص']);
        });
    });
});
