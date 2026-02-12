<script setup lang="ts">
import {
    mapObservationsToTextLines,
    mapTextLinesToParagraphs,
    type BoundingBox,
    type Observation,
} from 'kokokor';
import { computed } from 'vue';
import demoPackage from '../package.json';
import rootPackage from '../../package.json';
import ocrFixture from '../../test/mixed/ocr.json';
import structuresFixture from '../../test/mixed/structures.json';

type Metadata = {
    dpi: Partial<BoundingBox>;
    horizontal_lines?: BoundingBox[];
    rectangles?: BoundingBox[];
};

type OcrFixtureEntry = {
    observations: Observation[];
};

type ParagraphView = {
    isCentered: boolean;
    isHeading: boolean;
    isPoetry: boolean;
    text: string;
};

type DemoRow = {
    bodyParagraphs: ParagraphView[];
    footnoteParagraphs: ParagraphView[];
    imageFile: string;
    imageUrl: string;
    originalLines: string[];
};

const sanitizeVersion = (value: string): string => value.replace(/\^/g, '');

const projectName = rootPackage.name;
const demoDependencies = demoPackage.dependencies ?? {};
const demoDependencyName =
    Object.keys(demoDependencies).find((dependencyName) => dependencyName === projectName) ||
    Object.keys(demoDependencies)[0] ||
    projectName;
const demoDependencyVersion = sanitizeVersion(demoDependencies[demoDependencyName] ?? 'unknown');

const imageModules = import.meta.glob('../../test/mixed/*.jpg', {
    eager: true,
    import: 'default',
}) as Record<string, string>;

const imageUrlByFile = Object.fromEntries(
    Object.entries(imageModules).map(([modulePath, url]) => [modulePath.split('/').pop() ?? modulePath, url]),
);

const sortImageFiles = (left: string, right: string): number => {
    const leftNumber = Number.parseInt(left, 10);
    const rightNumber = Number.parseInt(right, 10);

    if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) {
        return left.localeCompare(right);
    }

    return leftNumber - rightNumber;
};

const rows = computed<DemoRow[]>(() => {
    const fixtureData = ocrFixture as Record<string, OcrFixtureEntry>;
    const structures = (structuresFixture as { result: Record<string, Metadata> }).result;

    return Object.keys(fixtureData)
        .sort(sortImageFiles)
        .map((imageFile) => {
            const fixture = fixtureData[imageFile];
            const structure = structures[imageFile] ?? { dpi: {} };

            const dpi: BoundingBox = {
                height: structure.dpi.height ?? 0,
                width: structure.dpi.width ?? 0,
                x: structure.dpi.x ?? 72,
                y: structure.dpi.y ?? 72,
            };

            const lines = mapObservationsToTextLines(fixture.observations, dpi, {
                horizontalLines: structure.horizontal_lines,
                rectangles: structure.rectangles,
            });
            const paragraphs = mapTextLinesToParagraphs(lines);

            const toParagraphView = (paragraph: (typeof paragraphs)[number]): ParagraphView => ({
                isCentered: !!paragraph.isCentered,
                isHeading: !!paragraph.isHeading,
                isPoetry: !!paragraph.isPoetic,
                text: paragraph.text,
            });

            return {
                bodyParagraphs: paragraphs.filter((paragraph) => !paragraph.isFootnote).map(toParagraphView),
                footnoteParagraphs: paragraphs.filter((paragraph) => paragraph.isFootnote).map(toParagraphView),
                imageFile,
                imageUrl: imageUrlByFile[imageFile] ?? '',
                originalLines: fixture.observations.map((observation) => observation.text),
            };
        });
});
</script>

<template>
    <main class="page">
        <header class="header">
            <div>
                <h1>{{ projectName }}</h1>
                <p class="subtitle">
                    Demo dependency:
                    <code>{{ demoDependencyName }}@{{ demoDependencyVersion }}</code>
                </p>
            </div>
            <p class="meta">Dataset pages: {{ rows.length }}</p>
        </header>

        <section class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>Processed / Formatted Paragraphs</th>
                        <th>Original OCR Text</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in rows" :key="row.imageFile">
                        <td class="image-column">
                            <img v-if="row.imageUrl" :src="row.imageUrl" :alt="`Source page ${row.imageFile}`" loading="lazy" />
                            <p v-if="row.imageUrl" class="image-file">{{ row.imageFile }}</p>
                            <p v-else class="missing-image">Image not available in demo bundle.</p>
                        </td>
                        <td class="processed-column">
                            <div v-if="row.bodyParagraphs.length > 0" class="text-flow body-flow" dir="rtl">
                                <p
                                    v-for="(paragraph, index) in row.bodyParagraphs"
                                    :key="`${row.imageFile}-body-${index}`"
                                    class="paragraph-line"
                                    :class="{
                                        'centered-line': paragraph.isCentered,
                                        'heading-line': paragraph.isHeading,
                                        'poetry-line': paragraph.isPoetry,
                                    }"
                                >
                                    <em v-if="paragraph.isPoetry">{{ paragraph.text }}</em>
                                    <template v-else>{{ paragraph.text }}</template>
                                </p>
                            </div>

                            <section v-if="row.footnoteParagraphs.length > 0" class="footnote-section" dir="rtl">
                                <hr class="footnote-divider" />
                                <div class="text-flow footnote-flow">
                                    <p
                                        v-for="(paragraph, index) in row.footnoteParagraphs"
                                        :key="`${row.imageFile}-footnote-${index}`"
                                        class="paragraph-line footnote-line"
                                        :class="{
                                            'centered-line': paragraph.isCentered,
                                            'heading-line': paragraph.isHeading,
                                            'poetry-line': paragraph.isPoetry,
                                        }"
                                    >
                                        <em v-if="paragraph.isPoetry">{{ paragraph.text }}</em>
                                        <template v-else>{{ paragraph.text }}</template>
                                    </p>
                                </div>
                            </section>
                        </td>
                        <td class="original-column">
                            <div class="text-flow original-flow" dir="rtl">
                                <p v-for="(line, index) in row.originalLines" :key="`${row.imageFile}-raw-${index}`" class="original-line">
                                    {{ line }}
                                </p>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </section>
    </main>
</template>
