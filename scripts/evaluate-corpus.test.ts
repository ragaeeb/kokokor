import { describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const makeObservation = (text: string, y: number, x = 0, width = 700, confidence?: number | null | string) => {
    const observation: {
        bbox: { height: number; width: number; x: number; y: number };
        confidence?: number | null | string;
        text: string;
    } = {
        bbox: { height: 20, width, x, y },
        text,
    };
    if (confidence !== undefined) {
        observation.confidence = confidence;
    }
    return observation;
};

describe('evaluate-corpus', () => {
    it('uses the content policy and counts only finite confidence scores', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'kokokor-evaluate-'));
        const ocrDir = path.join(root, 'ocr');
        const skaluDir = path.join(root, 'skalu');

        try {
            await Promise.all([mkdir(ocrDir), mkdir(skaluDir)]);
            await Bun.write(
                path.join(ocrDir, '1.json'),
                JSON.stringify({
                    dpi: { x: 72, y: 72 },
                    pages: [
                        { height: 1200, observations: [makeObservation('١٢٣', 100)], page: 1, width: 800 },
                        { height: 1200, observations: [makeObservation('﵀', 100)], page: 2, width: 800 },
                        {
                            height: 1200,
                            observations: [makeObservation('﵀', 100), makeObservation('٣', 100, 700, 40)],
                            page: 3,
                            width: 800,
                        },
                        {
                            height: 1200,
                            observations: [makeObservation('نص عربي', 100), makeObservation('٣', 100, 700, 40)],
                            page: 4,
                            width: 800,
                        },
                        { height: 1200, observations: [makeObservation('noise', 100)], page: 5, width: 800 },
                        {
                            height: 1200,
                            observations: [
                                makeObservation('الله', 100, 0, 700, 0),
                                makeObservation('نص عربي', 150, 0, 700, 0.9),
                                makeObservation('كلمة عربية', 200, 0, 700, null),
                                makeObservation('سطر عربي', 250, 0, 700, 'invalid'),
                                makeObservation('نص آخر', 300),
                            ],
                            page: 6,
                            width: 800,
                        },
                    ],
                }),
            );
            await Bun.write(path.join(skaluDir, '1.json'), JSON.stringify({ pages: [] }));

            const child = Bun.spawn(
                [process.execPath, 'scripts/evaluate-corpus.ts', '--ocr-dir', ocrDir, '--skalu-dir', skaluDir],
                { cwd: process.cwd(), stderr: 'pipe', stdout: 'pipe' },
            );
            const [stdout, stderr, exitCode] = await Promise.all([
                new Response(child.stdout).text(),
                new Response(child.stderr).text(),
                child.exited,
            ]);

            expect(exitCode).toBe(0);
            expect(stderr).toBe('');

            const report = JSON.parse(stdout);
            expect(report.findings.falsePositiveOnlyPages.map((finding: { page: number }) => finding.page)).toEqual([
                1, 5,
            ]);
            expect(report.findings.falsePositiveOutputPages).toEqual([]);
            expect(report.findings.nonArabicOutputPages.map((finding: { page: number }) => finding.page)).toContain(2);
            expect(report.totals.observationsWithConfidence).toBe(2);
            expect(report.books['1'].observationsWithConfidence).toBe(2);
            expect(report.findings.salutationCandidatePages).toEqual([
                { book: 1, observationsWithConfidence: 2, page: 6 },
            ]);
            expect(report.totals.lowConfidenceObservations).toBeUndefined();
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });
});
