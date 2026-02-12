<p align="center">
  <img src="./icon.png" alt="kokokor logo" width="140" />
</p>

# kokokor

[![npm version](https://img.shields.io/npm/v/kokokor)](https://www.npmjs.com/package/kokokor)
[![wakatime](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/d7287da8-3536-4aaa-a706-74f2ee8b8e23.svg)](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/d7287da8-3536-4aaa-a706-74f2ee8b8e23)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)
[![Node.js CI](https://github.com/ragaeeb/kokokor/actions/workflows/build.yml/badge.svg)](https://github.com/ragaeeb/kokokor/actions/workflows/build.yml)
![GitHub License](https://img.shields.io/github/license/ragaeeb/kokokor)
![GitHub Release](https://img.shields.io/github/v/release/ragaeeb/kokokor)
[![semantic-release](https://img.shields.io/badge/semantic--release-automatic-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![npm type definitions](https://img.shields.io/npm/types/kokokor)](https://www.npmjs.com/package/kokokor)
[![codecov](https://codecov.io/gh/ragaeeb/kokokor/graph/badge.svg?token=IIGTM9JSR3)](https://codecov.io/gh/ragaeeb/kokokor)
[![Size](https://deno.bundlejs.com/badge?q=kokokor@latest&badge=detailed)](https://bundlejs.com/?q=kokokor%40latest)
![typescript](https://badgen.net/badge/icon/typescript?icon=typescript&label&color=blue)
![npm](https://img.shields.io/npm/dm/kokokor)
![GitHub issues](https://img.shields.io/github/issues/ragaeeb/kokokor)
![GitHub stars](https://img.shields.io/github/stars/ragaeeb/kokokor?style=social)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/ragaeeb/kokokor?utm_source=oss&utm_medium=github&utm_campaign=ragaeeb%2Fkokokor&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

A lightweight TypeScript library designed to reconstruct paragraphs from OCRed inputs. It helps format unstructured text with appropriate paragraph breaks, optimizes for readability, and includes advanced poetry detection and layout analysis capabilities.

## Features

- **Intelligent text line grouping** based on vertical proximity and adaptive spacing analysis
- **Advanced paragraph reconstruction** with vertical gap and line width analysis
- **Right-to-left (RTL) text support** with coordinate flipping and normalization
- **Poetry detection and preservation** using multiple heuristics (centering, word density, hemistichs)
- **Layout structure recognition** including headings (rectangles), footnotes (below horizontal lines)
- **Coordinate normalization** ensuring consistent results regardless of source document resolution
- **Line spacing analytics** with DPI-aware thresholds and adaptive line height factors
- **Surya OCR integration** with format conversion utilities
- **Noise filtering** to remove OCR artifacts and improve text quality
- **Customizable parameters** for different document types and languages
- **Comprehensive text block metadata** including centering, heading, footnote, and poetry flags
- **Biome formatting and tsdown builds** powered by the published CLIs for a predictable developer workflow

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
import { reconstructParagraphs } from 'kokokor';

// Example OCR result
const ocrResult = {
    dpi: { x: 300, y: 300 },
    page: { width: 2480, height: 3508 },
    observations: [
        { text: 'This is the first', bbox: { x: 100, y: 100, width: 200, height: 20 } },
        { text: 'line of text.', bbox: { x: 310, y: 100, width: 150, height: 20 } },
        { text: 'This is a new paragraph.', bbox: { x: 100, y: 150, width: 300, height: 20 } },
    ],
};

const result = reconstructParagraphs({
    observations: ocrResult.observations,
    page: {
        dpiX: ocrResult.dpi.x,
        dpiY: ocrResult.dpi.y,
        height: ocrResult.page.height,
        width: ocrResult.page.width,
    },
});

console.log(result.text);
// Output:
// This is the first line of text.
// This is a new paragraph.
```

### Low-Level Pipeline (Advanced)

```typescript
import { formatTextBlocks, mapObservationsToTextLines, mapTextLinesToParagraphs } from 'kokokor';

const textLines = mapObservationsToTextLines(observations, dpi, options);
const paragraphs = mapTextLinesToParagraphs(textLines, {
    verticalJumpFactor: 2,
    widthTolerance: 0.85,
});
const reconstructedText = formatTextBlocks(paragraphs);
```

### Advanced Configuration

```typescript
import { mapObservationsToTextLines, mapTextLinesToParagraphs } from 'kokokor';

const options = {
    pixelTolerance: 5, // Tolerance for vertical alignment in lines
    lineHeightFactor: 0.3, // Fixed line height factor (optional, otherwise computed adaptively)

    // Centering detection options
    centerToleranceRatio: 0.05, // Tolerance for center point alignment (5% of page width)
    minMarginRatio: 0.2, // Minimum margin required for centering detection (20% of page width)

    // Poetry detection options
    poetryDetectionOptions: {
        centerToleranceRatio: 0.05,
        minMarginRatio: 0.1,
        maxVerticalGapRatio: 2.0, // Max gap between poetry hemistichs
        minWidthRatioForMerged: 0.6, // Minimum width for wide poetic lines
        minWordCount: 2, // Minimum words for poetry consideration
        pairWidthSimilarityRatio: 0.4, // Width similarity for poetry pairs
        pairWordCountSimilarityRatio: 0.5, // Word count similarity for poetry pairs
        wordDensityComparisonRatio: 0.95, // Density comparison for wide poetry lines
    },

    // Layout structure (optional)
    horizontalLines: [], // Array of horizontal line bounding boxes for footnote detection
    rectangles: [], // Array of rectangle bounding boxes for heading detection

    // Debug logging (optional)
    log: console.log,
};

// Process with advanced options
const textLines = mapObservationsToTextLines(observations, dpi, options);
const paragraphs = mapTextLinesToParagraphs(textLines, {
    verticalJumpFactor: 2,
    widthTolerance: 0.85,
});
```

### Working with Surya OCR Results

`kokokor` can handle [surya](https://github.com/VikParuchuri/surya) library output.

```typescript
import { mapMatrixToBoundingBox } from 'kokokor';

// Convert Surya OCR format to kokokor observations
const suryaResult = {
    text_lines: [
        {
            bbox: [100, 100, 400, 120], // [x1, y1, x2, y2] format
            text: 'Text from Surya OCR',
        },
    ],
};

// Convert Surya bounding boxes to kokokor format
const observations = suryaResult.text_lines.map((line) => ({
    text: line.text,
    bbox: mapMatrixToBoundingBox(line.bbox as [number, number, number, number]),
}));

// Now you can use these observations with kokokor
```

### Working with Layout Elements

```typescript
import { filterHorizontalLinesOutsideRectangles, calculateDPI } from 'kokokor';

// Calculate DPI from image and PDF dimensions
const dpi = calculateDPI(
    { width: 2480, height: 3508 }, // Image size
    { width: 595, height: 842 }, // PDF size in points
);

// Filter horizontal lines that aren't inside rectangles
const relevantLines = filterHorizontalLinesOutsideRectangles(
    rectangles, // Array of rectangle bounding boxes
    horizontalLines, // Array of horizontal line bounding boxes
    5, // Pixel tolerance
);
```

## API Reference

### Main Processing Functions

#### `reconstructParagraphs(input: ReconstructInput, options?: ReconstructOptions): ReconstructResult`

One-shot API that runs the complete reconstruction pipeline:
1. observations -> lines
2. lines -> paragraphs
3. paragraphs -> formatted text

Recommended for most clients.

#### `mapObservationsToTextLines(observations: Observation[], dpi: BoundingBox, options: MapObservationsToTextLinesOptions): TextBlock[]`

Converts OCR observations into structured text lines with metadata.

Groups observations into lines based on vertical proximity, applies centering detection, identifies headings (text within rectangles), footnotes (text below horizontal lines), and poetic content.

- **Parameters:**
    - `observations`: Array of OCR text observations
    - `dpi`: Document DPI information including width and height
    - `options`: Configuration options for text line processing
- **Returns:** Array of text blocks with metadata (centering, headings, footnotes, poetry)

#### `mapTextLinesToParagraphs(textLines: TextBlock[], options?: Partial<ParagraphOptions>): TextBlock[]`

Groups text lines into coherent paragraphs, handling both prose and poetry.

Prose lines are grouped into paragraphs based on vertical spacing and line width patterns. Poetic lines are preserved individually to maintain their formatting.

- **Parameters:**
    - `textLines`: Array of text lines to group into paragraphs
    - `options.verticalJumpFactor`: Factor for detecting paragraph breaks based on vertical spacing (default: 2)
    - `options.widthTolerance`: Threshold for identifying "short" lines that indicate paragraph breaks (default: 0.85)
- **Returns:** Array of text blocks representing complete paragraphs

#### `formatTextBlocks(textBlocks: TextBlock[], footerSymbol?: string): string`

Formats an array of text blocks into a readable string with proper paragraph breaks.

- **Parameters:**
    - `textBlocks`: Array of text blocks to format
    - `footerSymbol`: Optional symbol to insert before the first footnote
- **Returns:** Formatted text string with proper line breaks and spacing

### Utility Functions

#### `flipAndAlignObservations(observations: Observation[], imageWidth: number, dpiX: number, options?: object): Observation[]`

Preprocesses observations by filtering noise, flipping coordinates for RTL text, and normalizing x-coordinates for proper alignment.

#### `filterHorizontalLinesOutsideRectangles(rectangles: BoundingBox[], horizontalLines: BoundingBox[], tolerance?: number): BoundingBox[]`

Filters out horizontal lines that are contained within any of the provided rectangles so that boundary detection ignores headings and callouts.

#### `getLastHorizontalLineY(rectangles: BoundingBox[], horizontalLines: BoundingBox[], pixelTolerance?: number): number | undefined`

Returns the lowest horizontal separator that is not covered by any rectangles, helping footnote detection routines understand where the body text ends.

#### `isObservationCentered(bbox: BoundingBox, imageWidth: number, options: CenteringOptions): boolean`

Determines if an observation is centered with sufficient whitespace on both sides using DPI-relative tolerances.

#### `mapMatrixToBoundingBox(box: [number, number, number, number]): BoundingBox`

Converts bounding box coordinates from array format to object format.

#### `calculateDPI(imageSize: Size, pdfSize: Size): {x: number, y: number}`

Calculates the DPI based on image size and original PDF size.

#### `calculateAverageProseDensity(observations: Observation[], imageWidth: number, options?: Partial<PoetryDetectionOptions>): number`

Computes the baseline words-per-pixel density for prose lines so poetry heuristics can compare spacing and detect verse structures.

#### `isPoeticGroup(group: Observation[], imageWidth: number, avgProseWordDensity: number, options?: PoetryDetectionOptions): boolean`

Classifies a group of observations as poetry by inspecting hemistich pairs, centered layout, and density ratios.

#### `computeAdaptiveLineHeightFactor(heights: number[], typicalGap: number): number`

Derives a multiplier that scales acceptable line gaps based on measured heights and spacing statistics.

### Types

#### `TextBlock`

```typescript
type TextBlock = Observation & {
    isCentered?: boolean; // If the text is centered on the page
    isFootnote?: boolean; // If this text is a footnote
    isHeading?: boolean; // If the text represents a heading
    isPoetic?: boolean; // Is a line of poem (not merged into paragraphs)
};
```

#### `Observation`

```typescript
type Observation = {
    bbox: BoundingBox; // Position and dimensions
    text: string; // Text content
};
```

#### `BoundingBox`

```typescript
type BoundingBox = {
    x: number; // X-coordinate
    y: number; // Y-coordinate
    width: number; // Width
    height: number; // Height
};
```

#### `CenteringOptions`

```typescript
type CenteringOptions = {
    centerToleranceRatio: number; // Ratio of page width tolerated when checking centering
    minMarginRatio: number; // Minimum whitespace on each side expressed as a page-width ratio
};
```

#### `MapObservationsToTextLinesOptions`

```typescript
type MapObservationsToTextLinesOptions = CenteringOptions & {
    pixelTolerance?: number; // Default: 5
    lineHeightFactor?: number; // Optional fixed line height factor
    poetryDetectionOptions?: PoetryDetectionOptions;
    horizontalLines?: BoundingBox[]; // For footnote detection
    rectangles?: BoundingBox[]; // For heading detection
    log?: (message: string, ...args: any[]) => void; // Debug logging
};
```

#### `PoetryDetectionOptions`

```typescript
type PoetryDetectionOptions = Partial<CenteringOptions> & {
    maxVerticalGapRatio: number; // Default: 2.0
    minWidthRatioForMerged: number | null; // Default: 0.6
    minWordCount: number; // Default: 2
    pairWidthSimilarityRatio: number; // Default: 0.4
    pairWordCountSimilarityRatio: number; // Default: 0.5
    wordDensityComparisonRatio: number; // Default: 0.95
};
```

## Algorithm Overview

### Text Line Grouping

1. **Preprocessing**: Filters noise, flips coordinates for RTL text, normalizes x-coordinates
2. **Adaptive Line Detection**: Uses document spacing analysis to compute optimal line height factors
3. **Vertical Grouping**: Groups observations into lines based on vertical proximity
4. **Horizontal Sorting**: Sorts observations within each line by x-coordinate for proper reading order
5. **Metadata Assignment**: Identifies centered text, headings, footnotes, and poetry

### Poetry Detection

The library uses multiple heuristics to identify poetic content:

1. **Wide Poetic Lines**: Centered text with low word density compared to prose
2. **Poetry Pairs (Hemistichs)**: Two lines with similar width and word count that are centered as a unit
3. **Centering Analysis**: Uses configurable tolerances for center point alignment and margin requirements
4. **Word Density Comparison**: Compares line density against document prose baseline

### Paragraph Formation

1. **Poetry Preservation**: Poetic lines are kept separate and not merged into paragraphs
2. **Vertical Gap Analysis**: Uses vertical spacing patterns to identify paragraph breaks
3. **Line Width Analysis**: Short lines often indicate paragraph endings
4. **Separate Processing**: Body content and footnotes are processed independently

## Testing

The project includes comprehensive integration tests for OCR paragraph reconstruction. You can control test behavior using environment variables for convenience during development.

### Running Tests

```bash
# Run all tests with coverage
bun test

# Write/update test snapshots
bun run test:write

# Test only specific files
ONLY="1.jpg,2.jpg" bun test

# Combine snapshot writing with specific files
ONLY="example.jpg" bun run test:write
```

### Test Environment Variables

- `WRITE_SNAPSHOTS=true` - Updates expected test output files instead of comparing against them
- `ONLY="file1,file2"` - Restricts testing to specific image files (comma-separated)

### Examples

```bash
# Update snapshots for all tests
WRITE_SNAPSHOTS=true bun test

# Test and update snapshots for specific files only
WRITE_SNAPSHOTS=true ONLY="complex-document.jpg,simple-text.jpg" bun test

# Quick test of a single file during development
ONLY="debug-case.jpg" bun test
```

## Development

| Command | Purpose |
| --- | --- |
| `bun run lint` | Applies the Biome configuration (via Bun's formatter) to keep the codebase consistent. |
| `bun run build` | Bundles the library with the published tsdown CLI, emitting ESM output and type declarations to `dist/`. |
| `bun test` | Executes the Bun-powered unit test suite, including layout utility coverage. |

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
