import path from 'node:path';

type OcrPage = {
    height: number;
    observations: unknown[];
    page: number;
    width: number;
};

type OcrBook = {
    dpi: { x: number; y: number };
    pages: OcrPage[];
};

type LayoutPage = {
    horizontal_lines?: unknown[];
    page: number;
    rectangles?: unknown[];
};

type LayoutBook = { pages: LayoutPage[] };

const readArg = (name: string) => {
    const index = Bun.argv.indexOf(name);
    return index >= 0 ? Bun.argv[index + 1] : undefined;
};

const ocrPath = readArg('--ocr');
const layoutPath = readArg('--layout');
const outputPath = readArg('--output');
const pageNumber = Number.parseInt(readArg('--page') ?? '', 10);
const sourceFile = readArg('--source-file');
const sourceSha256 = readArg('--source-sha256');

if (!ocrPath || !layoutPath || !outputPath || !sourceFile || !sourceSha256 || !Number.isFinite(pageNumber)) {
    throw new Error(
        'Usage: bun scripts/extract-corpus-page.ts --ocr <file> --layout <file> --page <number> --source-file <name> --source-sha256 <hash> --output <file>',
    );
}

const ocr = (await Bun.file(ocrPath).json()) as OcrBook;
const layout = (await Bun.file(layoutPath).json()) as LayoutBook;
const page = ocr.pages.find((candidate) => candidate.page === pageNumber);
const pageLayout = layout.pages.find((candidate) => candidate.page === pageNumber);

if (!page) {
    throw new Error(`OCR page ${pageNumber} was not found in ${ocrPath}`);
}

const fixture = {
    layout: {
        horizontalLines: pageLayout?.horizontal_lines ?? [],
        rectangles: pageLayout?.rectangles ?? [],
    },
    observations: page.observations,
    page: {
        dpiX: ocr.dpi.x,
        dpiY: ocr.dpi.y,
        height: page.height,
        width: page.width,
    },
    source: {
        file: path.basename(sourceFile),
        page: pageNumber,
        sha256: sourceSha256,
    },
};

await Bun.write(outputPath, `${JSON.stringify(fixture, null, 2)}\n`);
