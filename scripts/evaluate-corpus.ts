import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { reconstructParagraphs } from '../src/index';
import type { BoundingBox, Observation } from '../src/types';

type OcrPage = {
    height: number;
    observations: (Observation & { confidence?: number })[];
    page: number;
    width: number;
};

type OcrBook = {
    dpi: { x: number; y: number };
    pages: OcrPage[];
};

type SkaluPage = {
    height: number;
    horizontal_lines?: BoundingBox[];
    page: number;
    rectangles?: BoundingBox[];
    width: number;
};

type SkaluBook = { pages: SkaluPage[] };

type Finding = {
    book: number;
    page: number;
    [key: string]: number;
};

const parseArg = (name: string) => {
    const index = Bun.argv.indexOf(name);
    return index >= 0 ? Bun.argv[index + 1] : undefined;
};

const ocrDir = parseArg('--ocr-dir');
const skaluDir = parseArg('--skalu-dir');
const outputPath = parseArg('--output');

if (!ocrDir || !skaluDir) {
    throw new Error('Usage: bun scripts/evaluate-corpus.ts --ocr-dir <dir> --skalu-dir <dir> [--output <file>]');
}

const isArabicLetter = (character: string) => /\p{Letter}/u.test(character) && /\p{Script=Arabic}/u.test(character);

const countArabicLetters = (text: string) => [...text.normalize('NFKC')].filter(isArabicLetter).length;

const numericJsonFiles = (await readdir(ocrDir))
    .filter((file) => /^\d+\.json$/.test(file))
    .toSorted((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

const mostlyFootnotePages: Finding[] = [];
const overSplitPages: Finding[] = [];
const underSplitPages: Finding[] = [];
const nonArabicOutputPages: Finding[] = [];
const falsePositiveOnlyPages: Finding[] = [];
const falsePositiveOutputPages: Finding[] = [];
const salutationCandidatePages: Finding[] = [];
const books: Record<string, Record<string, number>> = {};

let totalPages = 0;
let totalObservations = 0;
let totalArabicObservations = 0;
let totalLines = 0;
let totalParagraphs = 0;
let totalFootnoteLines = 0;
let totalNonArabicLines = 0;
let totalLowConfidenceObservations = 0;

for (const file of numericJsonFiles) {
    const book = Number.parseInt(file, 10);
    const ocr = (await Bun.file(path.join(ocrDir, file)).json()) as OcrBook;
    const skalu = (await Bun.file(path.join(skaluDir, file)).json()) as SkaluBook;
    const skaluByPage = new Map(skalu.pages.map((page) => [page.page, page]));

    const bookMetrics = {
        arabicObservations: 0,
        falsePositiveOnlyPages: 0,
        falsePositiveOutputPages: 0,
        footnoteLines: 0,
        footnotePages: 0,
        lines: 0,
        lowConfidenceObservations: 0,
        mostlyFootnotePages: 0,
        nonArabicLines: 0,
        observations: 0,
        overSplitPages: 0,
        pages: ocr.pages.length,
        paragraphs: 0,
        salutationCandidatePages: 0,
        underSplitPages: 0,
    };

    for (const page of ocr.pages) {
        const layout = skaluByPage.get(page.page);
        const result = reconstructParagraphs(
            {
                layout: {
                    horizontalLines: layout?.horizontal_lines,
                    rectangles: layout?.rectangles,
                },
                observations: page.observations,
                page: {
                    dpiX: ocr.dpi.x,
                    dpiY: ocr.dpi.y,
                    height: page.height,
                    width: page.width,
                },
            },
            { line: { contentFilter: 'arabic' } },
        );

        const arabicObservations = page.observations.filter((observation) => countArabicLetters(observation.text) >= 2);
        const lowConfidenceObservations = page.observations.filter(
            (observation) => observation.confidence !== undefined,
        );
        const footnoteLines = result.lines.filter((line) => line.isFootnote);
        const nonArabicLines = result.lines.filter((line) => countArabicLetters(line.text) < 2);
        const paragraphRatio = result.lines.length === 0 ? 0 : result.paragraphs.length / result.lines.length;
        const footnoteRatio = result.lines.length === 0 ? 0 : footnoteLines.length / result.lines.length;
        const hasSalutationContext = page.observations.some(
            (observation) =>
                /[ﷺﷻؐؑؒؓ]/u.test(observation.text) ||
                (observation.confidence !== undefined && /(?:النبي|رسول|محمد|اللّٰه|الله)/u.test(observation.text)),
        );

        if (page.observations.length > 0 && arabicObservations.length === 0) {
            falsePositiveOnlyPages.push({ book, observations: page.observations.length, page: page.page });
            bookMetrics.falsePositiveOnlyPages++;
            if (result.lines.length > 0) {
                falsePositiveOutputPages.push({ book, lines: result.lines.length, page: page.page });
                bookMetrics.falsePositiveOutputPages++;
            }
        }

        if (result.lines.length >= 3 && footnoteRatio >= 0.8) {
            mostlyFootnotePages.push({
                book,
                footnoteLines: footnoteLines.length,
                lines: result.lines.length,
                page: page.page,
            });
            bookMetrics.mostlyFootnotePages++;
        }

        if (result.lines.length >= 8 && paragraphRatio >= 0.65) {
            overSplitPages.push({
                book,
                lines: result.lines.length,
                page: page.page,
                paragraphs: result.paragraphs.length,
            });
            bookMetrics.overSplitPages++;
        }

        if (result.lines.length >= 10 && result.paragraphs.length <= 1) {
            underSplitPages.push({
                book,
                lines: result.lines.length,
                page: page.page,
                paragraphs: result.paragraphs.length,
            });
            bookMetrics.underSplitPages++;
        }

        if (nonArabicLines.length > 0) {
            nonArabicOutputPages.push({ book, nonArabicLines: nonArabicLines.length, page: page.page });
        }

        if (hasSalutationContext) {
            salutationCandidatePages.push({
                book,
                lowConfidenceObservations: lowConfidenceObservations.length,
                page: page.page,
            });
            bookMetrics.salutationCandidatePages++;
        }

        bookMetrics.observations += page.observations.length;
        bookMetrics.arabicObservations += arabicObservations.length;
        bookMetrics.lowConfidenceObservations += lowConfidenceObservations.length;
        bookMetrics.lines += result.lines.length;
        bookMetrics.paragraphs += result.paragraphs.length;
        bookMetrics.footnoteLines += footnoteLines.length;
        bookMetrics.nonArabicLines += nonArabicLines.length;
        if (footnoteLines.length > 0) {
            bookMetrics.footnotePages++;
        }
    }

    books[String(book)] = bookMetrics;
    totalPages += bookMetrics.pages;
    totalObservations += bookMetrics.observations;
    totalArabicObservations += bookMetrics.arabicObservations;
    totalLowConfidenceObservations += bookMetrics.lowConfidenceObservations;
    totalLines += bookMetrics.lines;
    totalParagraphs += bookMetrics.paragraphs;
    totalFootnoteLines += bookMetrics.footnoteLines;
    totalNonArabicLines += bookMetrics.nonArabicLines;
}

const report = {
    books,
    findings: {
        falsePositiveOnlyPages,
        falsePositiveOutputPages,
        mostlyFootnotePages,
        nonArabicOutputPages,
        overSplitPages,
        salutationCandidatePages,
        underSplitPages,
    },
    totals: {
        arabicObservations: totalArabicObservations,
        falsePositiveOnlyPages: falsePositiveOnlyPages.length,
        falsePositiveOutputPages: falsePositiveOutputPages.length,
        footnoteLines: totalFootnoteLines,
        lines: totalLines,
        lowConfidenceObservations: totalLowConfidenceObservations,
        mostlyFootnotePages: mostlyFootnotePages.length,
        nonArabicLines: totalNonArabicLines,
        nonArabicOutputPages: nonArabicOutputPages.length,
        observations: totalObservations,
        overSplitPages: overSplitPages.length,
        pages: totalPages,
        paragraphs: totalParagraphs,
        salutationCandidatePages: salutationCandidatePages.length,
        underSplitPages: underSplitPages.length,
    },
};

const json = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) {
    await Bun.write(outputPath, json);
} else {
    process.stdout.write(json);
}
