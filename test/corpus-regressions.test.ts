import { describe, expect, it } from 'bun:test';
import path from 'node:path';
import { reconstructParagraphs } from '../src/index';
import type { ReconstructInput } from '../src/types';

type CorpusFixture = ReconstructInput & {
    source: {
        file: string;
        page: number;
        sha256: string;
    };
};

const fixtureNames = ['albani-ba-p0707', 'albani-ba-p0721', 'albani-ba-p0780'] as const;

const readCorpusFixture = async (corpus: 'kokokor' | 'sadi-mraq', fixtureName: string) =>
    (await Bun.file(path.join('test', 'corpus', corpus, `${fixtureName}.json`)).json()) as CorpusFixture;

const readFixture = async (fixtureName: string) => readCorpusFixture('kokokor', fixtureName);

describe('real corpus regressions', () => {
    it.each(fixtureNames)('keeps every numeric-column index row separate in %s', async (fixtureName) => {
        const fixture = await readFixture(fixtureName);

        const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

        expect(result.lines).toHaveLength(23);
        expect(result.paragraphs).toHaveLength(23);
        expect(
            result.lines.every((line) => /\p{Script=Arabic}/u.test(line.text) && /\p{Number}/u.test(line.text)),
        ).toBeTrue();
        expect(result.lines.some((line) => /^[-*\s]*[0-9٠-٩]+[-*\s]*$/u.test(line.text))).toBeFalse();
        expect(result.lines.some((line) => line.isFootnote)).toBeFalse();
    });

    it('joins vertically offset citation cells to the correct Albani index row', async () => {
        const fixture = await readFixture('albani-ba-p0687');

        const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });
        const entryPattern = /^(?:[١-٩]|١[٠-٩])\s*[-_]/u;
        const entries = result.lines.filter((line) => line.bbox.y > 150 && entryPattern.test(line.text));

        expect(entries).toHaveLength(19);
        expect(entries.every((line) => (line.text.match(/\p{Number}+/gu)?.length ?? 0) >= 2)).toBeTrue();
        expect(result.lines.some((line) => /^[-*\s]*[0-9٠-٩]+[-*\s]*$/u.test(line.text))).toBeFalse();
        expect(
            result.paragraphs.filter((paragraph) => paragraph.bbox.y > 150 && entryPattern.test(paragraph.text)),
        ).toHaveLength(19);
    });

    it('drops symbol-heavy ornament OCR without dropping the Arabic page text', async () => {
        const fixture = await readFixture('najmi-fath-p0023');

        const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

        expect(result.lines.some((line) => line.text.includes('أوجه الاتفاق'))).toBeTrue();
        expect(result.lines.some((line) => line.text.includes('@'))).toBeFalse();
    });

    it('uses the contextual footnote rule instead of decorative header rules', async () => {
        const fixture = await readFixture('najmi-fataawa-p0068');

        const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });
        const footnoteLines = result.lines.filter((line) => line.isFootnote);

        expect(result.lines).toHaveLength(26);
        expect(result.lines.slice(0, 5).every((line) => !line.isFootnote)).toBeTrue();
        expect(footnoteLines).toHaveLength(21);
        expect(footnoteLines[0].text).toStartWith('(١) قال عنهم الشيخ ربيع');
    });

    it('does not treat a running-header underline as a footnote separator', async () => {
        const fixture = await readFixture('rabi-tahdir-p0015');

        const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

        expect(result.lines).toHaveLength(15);
        expect(result.lines.some((line) => line.isFootnote)).toBeFalse();
        expect(result.lines.at(-1)?.text).toContain('فَاضْرِبُوا عُنُقَ');
    });

    it('restores body text between an initial citation block and a later explicit footnote', async () => {
        const fixture = await readFixture('rabi-tahdir-p0029');
        const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

        expect(result.lines.slice(3, 7).every((line) => line.isFootnote)).toBeTrue();
        expect(result.lines.slice(7, 15).every((line) => !line.isFootnote)).toBeTrue();
        expect(result.lines.slice(15).every((line) => line.isFootnote)).toBeTrue();
        expect(result.paragraphs.find((paragraph) => paragraph.text.startsWith('قال العواء'))?.isFootnote).toBeFalsy();
    });

    it('keeps a true separator when the final body row sits directly above it', async () => {
        const fixture = await readFixture('albani-ba-p0633');

        const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });
        const footnotes = result.lines.filter((line) => line.isFootnote);

        expect(result.lines).toHaveLength(22);
        expect(result.lines.findIndex((line) => line.isFootnote)).toBe(2);
        expect(footnotes).toHaveLength(20);
        expect(footnotes[0]?.text).toStartWith('(١) الأولُ');
        expect(footnotes.some((line) => line.text === '(٤١٦/٤)')).toBeTrue();
    });

    describe('Saadi index tables', () => {
        it('keeps wrapped Quran-index continuations with their numbered row on page 131', async () => {
            const fixture = await readFixture('sadi-mraq-p0131');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });
            const delayedRow = result.paragraphs.find((paragraph) => paragraph.text.includes('فَمَنْ تَعَجَّلَ'));
            const followingRow = result.paragraphs.find((paragraph) => paragraph.text.includes('وَمِنْهُمْ مَنْ يَقُولُ'));

            expect(result.paragraphs).toHaveLength(15);
            expect(delayedRow?.text).toContain('اللّٰهَ وَاعْلَمُوا');
            expect(delayedRow?.text).not.toContain('وَمِنْهُمْ مَنْ يَقُولُ');
            expect(followingRow?.text).toContain('النَّارِ');
        });

        it('keeps every compact three-column names row separate on page 156', async () => {
            const fixture = await readFixture('sadi-mraq-p0156');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

            expect(result.paragraphs).toHaveLength(7);
            expect(result.paragraphs.slice(2).map((paragraph) => paragraph.text)).toEqual([
                'الرب ٥٣ ٥٥',
                'الوهاب ٥٣ ٥٨',
                'اللّٰه ٨٣ ١٠٧',
                'العليم ٨٣ ١٠٨',
                'الرحمن ٨٣ ١٠٩',
            ]);
        });

        it('joins wrapped topic rows without merging the next numbered row on page 161', async () => {
            const fixture = await readFixture('sadi-mraq-p0161');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });
            const divorceRow = result.paragraphs.find((paragraph) => paragraph.text.includes('وَالمُطَلَّقَاتُ'));
            const patienceRow = result.paragraphs.find((paragraph) => paragraph.text.includes('الإيمان والاحتساب'));
            const openingRows = result.paragraphs.filter((paragraph) =>
                ['فَلَمَ أَسْلَمَا', 'فَعِدَّةٌ مِنْ أَيَّامِ', 'أَوْ عَلَى سَفَرِ'].some((text) => paragraph.text.includes(text)),
            );

            expect(result.paragraphs).toHaveLength(11);
            expect(openingRows).toHaveLength(3);
            expect(divorceRow?.text).toContain('قُرُوءِ');
            expect(divorceRow?.text).toContain('بِأَنْفُسِهِنَّ');
            expect(patienceRow?.text).toContain('ذلك.');
            expect(patienceRow?.text).not.toContain('شرع اللّٰه الدين');
        });

        it('joins vertically offset numeric cells to their topic row on page 170', async () => {
            const fixture = await readFixture('sadi-mraq-p0170');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });
            const questionRow = result.paragraphs.find((paragraph) => paragraph.text.includes('ما هو الغيب'));

            expect(result.paragraphs).toHaveLength(10);
            expect(questionRow?.text).toContain('فصل');
            expect(questionRow?.text).not.toContain('أبطلَ به قولَ');
            expect(result.lines.some((line) => /٨٢.*فصل.*١٠٥/u.test(line.text))).toBeTrue();
            expect(result.paragraphs.at(-2)?.text).toContain('فهرس الآيات');
            expect(result.paragraphs.at(-1)?.text).toContain('فهرس الأحاديث');
        });

        it('keeps the final index links and closing line separate on page 171', async () => {
            const fixture = await readFixture('sadi-mraq-p0171');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

            expect(result.paragraphs).toHaveLength(6);
            expect(
                result.paragraphs.slice(1, 5).every((paragraph) => /[0-9٠-٩۰-۹]\s*$/u.test(paragraph.text)),
            ).toBeTrue();
            expect(result.paragraphs.at(-1)?.text).toBe('تم بحمد اللّٰه');
        });

        it('keeps the hadith-index header separate from its first row on page 154', async () => {
            const fixture = await readCorpusFixture('sadi-mraq', 'sadi-mraq-p0154');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

            expect(result.paragraphs).toHaveLength(16);
            expect(result.paragraphs[1]?.text).toBe('أطراف الصفحة');
            expect(result.paragraphs[2]?.text).toBe('إن الأكثرين هم الأقلون يوم القيامة ٣١');
        });

        it('keeps the two fiqh-index rows separate on page 157', async () => {
            const fixture = await readCorpusFixture('sadi-mraq', 'sadi-mraq-p0157');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

            expect(result.paragraphs).toHaveLength(4);
            expect(result.paragraphs.slice(2).map((paragraph) => paragraph.text)).toEqual([
                'ما المعتبر في العِدة التي قال اللّٰه عنها: (فَعِدَّةٌ مِنْ أَيَّامِ أُخَرَ)؟ ٢ ١٤',
                'هل لا يجب على الزوج أن يطأ زوجته إلا في كل ثلث سنة مرة؟ ٢٠ ٢٦',
            ]);
        });

        it('keeps the section marker and topic in benefit row 41 on page 165', async () => {
            const fixture = await readCorpusFixture('sadi-mraq', 'sadi-mraq-p0165');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });
            const row = result.paragraphs.find((paragraph) => paragraph.text.includes('إِذْ يُبَيُّتُونَ'));

            expect(result.paragraphs).toHaveLength(8);
            expect(row?.text).toContain('٤١ ٤٤ فصل(٤)');
            expect(row?.text).toContain('إِذْ يُبَيُّتُونَ');
            expect(result.paragraphs.filter((paragraph) => paragraph.text.includes('إِذْ يُبَيُّتُونَ'))).toHaveLength(1);
        });

        it('keeps continuation lines in rows 66 and 67 on page 168', async () => {
            const fixture = await readCorpusFixture('sadi-mraq', 'sadi-mraq-p0168');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });
            const row66 = result.paragraphs.find((paragraph) => paragraph.text.includes('قول شعيب'));
            const row67 = result.paragraphs.find((paragraph) => paragraph.text.includes('أَمْ يَقُولُونَ'));

            expect(result.paragraphs).toHaveLength(8);
            expect(row66?.text).toContain('تَوَكَّلْنَا');
            expect(row67?.text).toContain('مُعْرِضُونَ');
            expect(result.paragraphs.filter((paragraph) => paragraph.text.includes('٦٦'))).toHaveLength(1);
            expect(result.paragraphs.filter((paragraph) => paragraph.text.includes('٦٧'))).toHaveLength(1);
        });
    });

    it('does not treat a cover design seam crossing the author label as a footnote separator', async () => {
        const fixture = await readFixture('sadi-riyad-p0001');
        const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

        expect(result.lines).toHaveLength(7);
        expect(result.lines.some((line) => line.isFootnote)).toBeFalse();
        expect(result.lines.at(-1)?.text).toBe('١٣٧٦ -١٣٠٧ه');
    });

    describe('Riyad named contents rows', () => {
        it('separates the boxed index title and consecutive named rows on page 238', async () => {
            const fixture = await readFixture('sadi-riyad-p0238');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

            expect(result.paragraphs).toHaveLength(16);
            expect(result.paragraphs[1]?.text).toBe('فهرس الموضوعات');
            expect(result.paragraphs[2]?.text).toStartWith('مقدمة المؤلف');
            expect(result.paragraphs[3]?.text).toStartWith('الفصل الأول');
            expect(result.paragraphs[4]?.text).toStartWith('فصل تابع');
            expect(result.paragraphs.at(-1)?.text).toContain('التعادي والافتراق');
        });

        it('keeps wrapped chapters together while separating chapters 30, 31, 36, and 37 on page 240', async () => {
            const fixture = await readFixture('sadi-riyad-p0240');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

            expect(result.paragraphs).toHaveLength(16);
            expect(result.paragraphs.find((paragraph) => paragraph.text.includes('الفصل الثلاثون'))?.text).toContain(
                'ولا تنفّروا',
            );
            expect(
                result.paragraphs.find((paragraph) => paragraph.text.includes('الفصل الثلاثون'))?.text,
            ).not.toContain('الفصل الحَادي والثلاثون');
            expect(
                result.paragraphs.find((paragraph) => paragraph.text.includes('الفصل السادس والثلاثون'))?.text,
            ).not.toContain('الفصل السابع والثلاثون');
        });

        it('keeps the two wrapped final chapters and the index link separate on page 241', async () => {
            const fixture = await readFixture('sadi-riyad-p0241');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

            expect(result.paragraphs).toHaveLength(4);
            expect(result.paragraphs[1]?.text).toContain('اللّٰه وإلهيته');
            expect(result.paragraphs[2]?.text).toContain('إنَّما هي بحسب ما يسنح بالبال');
            expect(result.paragraphs[3]?.text).toBe('الفهرس.. ٢٣٧');
        });
    });

    it('does not restore a long Albani footnote continuation as body text', async () => {
        const fixture = await readFixture('albani-ba-p0110');
        const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

        expect(result.lines).toHaveLength(25);
        expect(result.lines.filter((line) => line.isFootnote)).toHaveLength(22);
        expect(result.lines.at(-1)?.text).toStartWith('(١) في');
    });

    it('does not restore a numbered Najmi footnote list as body text', async () => {
        const fixture = await readFixture('najmi-fataawa-p0183');
        const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

        expect(result.lines).toHaveLength(26);
        expect(result.lines.filter((line) => line.isFootnote)).toHaveLength(21);
        expect(result.lines[5]?.text).toStartWith('= ٣-');
    });

    it('keeps table-driven paragraph indices contiguous on Albani page 777', async () => {
        const fixture = await readFixture('albani-ba-p0777');
        const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

        expect(result.lines).toHaveLength(21);
        expect(result.paragraphs).toHaveLength(13);
        expect(result.paragraphs[0]?.text).toBe('٩ - الفِهْرِسُ الإجماليُّ العامُّ');
        expect(result.paragraphs.at(-1)?.text).toEndWith('التعليقات التي في الصحيحين ١٢');
    });

    describe('Rabi corpus backfills', () => {
        it('does not classify the decorative header rules as a footnote on volume 1 page 19', async () => {
            const fixture = await readFixture('rabi-01-p0019');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

            expect(result.lines).toHaveLength(27);
            expect(result.lines.filter((line) => line.isFootnote)).toHaveLength(0);
            expect(result.paragraphs[0]?.text).toBe('الدر النضيد');
        });

        it('keeps the true multi-line footnotes below the volume 1 page 100 separator', async () => {
            const fixture = await readFixture('rabi-01-p0100');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });
            const footnotes = result.lines.filter((line) => line.isFootnote);

            expect(result.lines).toHaveLength(28);
            expect(result.lines.findIndex((line) => line.isFootnote)).toBe(16);
            expect(footnotes).toHaveLength(12);
            expect(footnotes[0]?.text).toStartWith('(١) أخرجه البخاري');
            expect(result.paragraphs.filter((paragraph) => paragraph.isFootnote)).toHaveLength(3);
        });

        it('keeps a short true footnote below the volume 1 page 477 separator', async () => {
            const fixture = await readFixture('rabi-01-p0477');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });
            const footnotes = result.lines.filter((line) => line.isFootnote);

            expect(result.lines).toHaveLength(25);
            expect(result.lines.findIndex((line) => line.isFootnote)).toBe(24);
            expect(footnotes).toHaveLength(1);
            expect(footnotes[0]?.text).toBe('(١) أخرجه البخاري (٤٨٥٥)، ومسلم (١٧٧).');
        });

        it('keeps table-driven paragraph indices contiguous on volume 1 page 505', async () => {
            const fixture = await readFixture('rabi-01-p0505');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

            expect(result.lines).toHaveLength(24);
            expect(result.paragraphs).toHaveLength(22);
            expect(result.paragraphs[1]?.text).toBe('فهرس «مذكرة الحديث النبوي»');
            expect(result.paragraphs.at(-1)?.text).toStartWith('الحديث الحادي والعشرون');
        });

        it('does not treat the paired title rules on volume 14 page 4 as a footnote separator', async () => {
            const fixture = await readFixture('rabi-14-p0004');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

            expect(result.lines).toHaveLength(13);
            expect(result.lines.filter((line) => line.isFootnote)).toHaveLength(0);
            expect(result.paragraphs).toHaveLength(8);
            expect(result.paragraphs[0]?.text).toBe('المقدمة');
            expect(result.paragraphs[1]?.text).toBe('منهجية جمع وترتيب الكتاب');
        });

        it('does not treat a contents-page title rule as a footnote separator on volume 14 page 552', async () => {
            const fixture = await readFixture('rabi-14-p0552');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

            expect(result.lines).toHaveLength(15);
            expect(result.lines.filter((line) => line.isFootnote)).toHaveLength(0);
            expect(result.lines.at(-1)?.text).toContain('صفة اليدين');
        });

        it('keeps dense contents rows as separate paragraphs on volume 2 page 535', async () => {
            const fixture = await readFixture('rabi-02-p0535');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });
            const contentsRows = result.paragraphs.slice(1, 11);

            expect(result.lines).toHaveLength(23);
            expect(result.lines.filter((line) => line.isFootnote)).toHaveLength(0);
            expect(contentsRows).toHaveLength(10);
            expect(contentsRows.every((row) => /[0-9٠-٩۰-۹]\s*$/u.test(row.text))).toBeTrue();
            expect(contentsRows[0]?.text).toContain('قبول توبة التائب');
            expect(contentsRows[9]?.text).toContain('أسئلة الدرس');
        });

        it('keeps the running header separate while grouping the body on volume 12 page 442', async () => {
            const fixture = await readFixture('rabi-12-p0442');
            const result = reconstructParagraphs(fixture, { line: { contentFilter: 'arabic' } });

            expect(result.lines).toHaveLength(27);
            expect(result.paragraphs).toHaveLength(2);
            expect(result.paragraphs[0]?.text).toContain('موسوعة مؤلفات ورسائل وفتاوى الشيخ ربيع المدخلي');
            expect(result.paragraphs[1]?.text).toStartWith('٢- قال الشيرازي');
            expect(result.paragraphs[1]?.text).toContain('الكريمات حول مسجد ضرار');
        });
    });
});
