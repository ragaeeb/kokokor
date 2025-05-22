# kokokor

[![wakatime](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/d7287da8-3536-4aaa-a706-74f2ee8b8e23.svg)](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/d7287da8-3536-4aaa-a706-74f2ee8b8e23)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)
[![Node.js CI](https://github.com/ragaeeb/kokokor/actions/workflows/build.yml/badge.svg)](https://github.com/ragaeeb/kokokor/actions/workflows/build.yml)
![GitHub License](https://img.shields.io/github/license/ragaeeb/kokokor)
![GitHub Release](https://img.shields.io/github/v/release/ragaeeb/kokokor)
[![codecov](https://codecov.io/gh/ragaeeb/kokokor/graph/badge.svg?token=IIGTM9JSR3)](https://codecov.io/gh/ragaeeb/kokokor)
[![Size](https://deno.bundlejs.com/badge?q=kokokor@latest&badge=detailed)](https://bundlejs.com/?q=kokokor%40latest)
![typescript](https://badgen.net/badge/icon/typescript?icon=typescript&label&color=blue)
![npm](https://img.shields.io/npm/dm/kokokor)
![GitHub issues](https://img.shields.io/github/issues/ragaeeb/kokokor)
![GitHub stars](https://img.shields.io/github/stars/ragaeeb/kokokor?style=social)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/ragaeeb/kokokor?utm_source=oss&utm_medium=github&utm_campaign=ragaeeb%2Fkokokor&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

A lightweight TypeScript library designed to reconstruct paragraphs from OCRed inputs. It helps format unstructured text with appropriate paragraph breaks, optimizes for readability, and includes advanced typo correction capabilities using multiple OCR sources.

## Features

- Reconstructs coherent paragraphs from raw OCR text observations
- Handles right-to-left (RTL) text formatting
- Intelligently identifies paragraph breaks based on vertical spacing and line widths
- Recognizes poetic layouts and preserves them appropriately
- **Advanced typo detection and correction** using alignment algorithms between multiple OCR sources
- **Surya OCR integration** for improved text accuracy and post-processing
- Supports customizable parameters for different document types
- Normalizes coordinates to ensure consistent results regardless of source document resolution
- **Preserves special symbols** (like Arabic religious markers) during typo correction
- **Handles footnotes** and embedded text elements intelligently

## Installation

```bash
# Using npm
npm install kokokor

# Using yarn
yarn add kokokor

# Using bun
bun add kokokor
```

## Usage

### Basic Usage

```typescript
import { rebuildParagraphs } from 'kokokor';

// Example OCR result
const ocrResult = {
    dpi: { x: 300, y: 300, width: 2480, height: 3508 },
    observations: [
        // Array of text observations with bbox coordinates
        { text: 'This is the first', bbox: { x: 100, y: 100, width: 200, height: 20 } },
        { text: 'line of text.', bbox: { x: 310, y: 100, width: 150, height: 20 } },
        { text: 'This is a new paragraph.', bbox: { x: 100, y: 150, width: 300, height: 20 } },
    ],
};

// Get reconstructed paragraphs as a string
const reconstructedText = rebuildParagraphs(ocrResult);
console.log(reconstructedText);
// Output:
// This is the first line of text.
// This is a new paragraph.
```

### Advanced Configuration with Typo Correction

```typescript
import { mapOCRResultToParagraphObservations, rebuildParagraphs } from 'kokokor';

const options = {
    fallbackDPI: 72, // Default DPI when not provided in OCR result
    pixelTolerance: 5, // Tolerance for vertical alignment in lines
    standardDpiX: 300, // Target DPI for normalization
    verticalJumpFactor: 2, // Factor for identifying paragraph breaks
    widthTolerance: 0.85, // Threshold for identifying "short" lines
    footerSymbol: '---', // Optional symbol for footers

    // Typo correction options
    typoSymbols: ['ﷺ', '﷽', 'ﷻ'], // Arabic religious symbols to preserve
    similarityThreshold: 0.7, // Threshold for token alignment
    highSimilarityThreshold: 0.9, // Threshold for duplicate removal
};

// OCR result with alternate observations for typo correction
const ocrResultWithAlternate = {
    dpi: { x: 300, y: 300, width: 2480, height: 3508 },
    observations: [
        // Primary OCR observations
        { text: 'Problematic text with typos', bbox: { x: 100, y: 100, width: 300, height: 20 } },
    ],
    alternateObservations: [
        // Surya OCR observations for comparison
        { text: 'Corrected text without typos', bbox: { x: 100, y: 100, width: 300, height: 20 } },
    ],
};

// Process with typo correction
const correctedText = rebuildParagraphs(ocrResultWithAlternate, options);
```

### Working with Surya OCR Results

`kokokor` can handle [surya](https://github.com/VikParuchuri/surya) library output.

```typescript
import { mapSuryaPageResultToObservations } from 'kokokor';

// Convert Surya OCR format to kokokor observations
const suryaResult = {
    text_lines: [
        {
            bbox: [100, 100, 400, 120], // [x1, y1, x2, y2] format
            text: 'Text from Surya OCR',
            chars: [],
        },
    ],
};

const observations = mapSuryaPageResultToObservations(suryaResult);
// Now you can use these observations in your OCR result
```

## API Reference

### Main Functions

#### `rebuildParagraphs(ocr: OcrResult, options?: RebuildOptions): string`

Reconstructs complete paragraph text from OCR results with optional typo correction.

- **Parameters:**
    - `ocr`: The OCR result containing text observations and document metadata
    - `options`: Optional configuration options (including typo correction settings)
- **Returns:** A string containing the reconstructed text with paragraphs separated by newlines

#### `mapOCRResultToParagraphObservations(ocr: OcrResult, options?: RebuildOptions): Observation[]`

Processes OCR result data to identify and reconstruct paragraphs from individual text observations.

- **Parameters:**
    - `ocr`: The OCR result containing text observations and document metadata
    - `options`: Optional configuration options (including typo correction settings)
- **Returns:** An array of merged observations, where each item represents a complete paragraph

#### `mapSuryaPageResultToObservations(surya: SuryaPageOcrResult): Observation[]`

Converts Surya OCR page results to standardized Observation format.

- **Parameters:**
    - `surya`: Surya OCR page result containing text lines with bounding boxes
- **Returns:** Array of observations in standardized format

### Types

#### `OcrResult`

```typescript
type OcrResult = {
    readonly dpi: BoundingBox;
    readonly observations: Observation[];
    readonly alternateObservations?: Observation[]; // For typo correction
    readonly horizontalLines?: BoundingBox[];
    readonly rectangles?: BoundingBox[];
};
```

#### `Observation`

```typescript
type Observation = {
    readonly bbox: BoundingBox;
    readonly text: string;
};
```

#### `BoundingBox`

```typescript
type BoundingBox = {
    readonly width: number;
    readonly height: number;
    x: number;
    y: number;
};
```

#### `RebuildOptions`

```typescript
type RebuildOptions = {
    readonly fallbackDPI?: number; // Default: 72
    readonly pixelTolerance?: number; // Default: 5
    readonly standardDpiX?: number; // Default: 300
    readonly verticalJumpFactor?: number; // Default: 2
    readonly widthTolerance?: number; // Default: 0.85
    readonly footerSymbol?: string; // Default: undefined

    // Typo correction options
    readonly typoSymbols?: string[]; // Special symbols to preserve
    readonly similarityThreshold?: number; // Default: 0.6
    readonly highSimilarityThreshold?: number; // Default: 0.8
};
```

#### `SuryaPageOcrResult`

```typescript
type SuryaPageOcrResult = {
    readonly text_lines: {
        readonly bbox: number[]; // [x1, y1, x2, y2] format
        readonly text: string;
        readonly chars: SuryaTextLine[];
    }[];
};
```

#### `FixTypoOptions`

```typescript
type FixTypoOptions = {
    readonly typoSymbols: string[]; // Symbols to preserve during correction
    readonly similarityThreshold: number; // Token alignment threshold (0.0-1.0)
    readonly highSimilarityThreshold: number; // Duplicate detection threshold (0.0-1.0)
};
```

## Typo Correction Algorithm

The typo correction feature uses advanced text alignment algorithms to compare OCR results from different sources:

1. **Token Alignment**: Uses the Needleman-Wunsch sequence alignment algorithm to align tokens between original and reference OCR results
2. **Symbol Preservation**: Automatically preserves important symbols (like Arabic religious markers) during correction
3. **Footnote Handling**: Intelligently handles embedded footnotes and standalone footnote references
4. **Similarity-Based Selection**: Chooses the best token based on configurable similarity thresholds
5. **Duplicate Removal**: Post-processes results to remove highly similar duplicate tokens
6. **Normalization**: Applies text normalization while preserving original formatting and diacritics

## Contributing

Contributions are welcome! Please make sure your contributions adhere to the coding standards and are accompanied by relevant tests.

To get started:

1. Fork the repository
2. Install dependencies: `bun install` (requires [Bun](https://bun.sh/))
3. Make your changes
4. Run tests: `bun test`
5. Submit a pull request

## License

`kokokor` is released under the MIT License. See the [LICENSE.MD](./LICENSE.MD) file for more details.

## Author

Ragaeeb Haq

---

Built with TypeScript and Bun. Uses ESM module format.
