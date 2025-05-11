import { describe, expect, it } from 'bun:test';

import { indexObservationsAsLines, indexObservationsAsParagraphs } from './indexing';

describe('indexing', () => {
    describe('indexObservationsAsLines', () => {
        it('should assign the same line index to observations within vertical threshold', () => {
            const observations = [
                { bbox: { height: 20, width: 100, x: 10, y: 10 }, text: 'First line part 1' },
                { bbox: { height: 20, width: 100, x: 120, y: 12 }, text: 'First line part 2' }, // Close to first, should be same line
                { bbox: { height: 20, width: 100, x: 10, y: 50 }, text: 'Second line' }, // Far from first, should be new line
                { bbox: { height: 20, width: 100, x: 10, y: 52 }, text: 'Still second line' }, // Close to previous, same line
            ];

            const indexed = indexObservationsAsLines(observations, 72, 5);

            expect(indexed[0].index).toBe(0);
            expect(indexed[1].index).toBe(0); // Same line as first
            expect(indexed[2].index).toBe(1); // New line
            expect(indexed[3].index).toBe(1); // Same line as third
        });

        it('should not group the 2nd line after the heading with the first line', () => {
            const actual = indexObservationsAsLines(
                [
                    {
                        bbox: {
                            height: 75,
                            width: 380,
                            x: 780,
                            y: 214,
                        },
                        text: 'بشاشة',
                    },
                    {
                        bbox: {
                            height: 68,
                            width: 539,
                            x: 343,
                            y: 312,
                        },
                        text: 'بشائر',
                    },
                    {
                        bbox: {
                            height: 80,
                            width: 537,
                            x: 1017,
                            y: 308,
                        },
                        text: 'ومن',
                    },
                    {
                        bbox: {
                            height: 79,
                            width: 531,
                            x: 350,
                            y: 395,
                        },
                        text: 'ومن',
                    },
                    {
                        bbox: {
                            height: 115,
                            width: 532,
                            x: 1017,
                            y: 374,
                        },
                        text: 'يُملُ',
                    },
                    {
                        bbox: {
                            height: 60,
                            width: 528,
                            x: 347,
                            y: 501,
                        },
                        text: 'أتى',
                    },
                ],
                72,
                5,
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 75,
                        width: 380,
                        x: 780,
                        y: 214,
                    },
                    index: 0,
                    text: 'بشاشة',
                },
                {
                    bbox: {
                        height: 80,
                        width: 537,
                        x: 1017,
                        y: 308,
                    },
                    index: 1,
                    text: 'ومن',
                },
                {
                    bbox: {
                        height: 68,
                        width: 539,
                        x: 343,
                        y: 312,
                    },
                    index: 1,
                    text: 'بشائر',
                },
                {
                    bbox: {
                        height: 115,
                        width: 532,
                        x: 1017,
                        y: 374,
                    },
                    index: 2,
                    text: 'يُملُ',
                },
                {
                    bbox: {
                        height: 79,
                        width: 531,
                        x: 350,
                        y: 395,
                    },
                    index: 2,
                    text: 'ومن',
                },
                {
                    bbox: {
                        height: 60,
                        width: 528,
                        x: 347,
                        y: 501,
                    },
                    index: 3,
                    text: 'أتى',
                },
            ]);
        });

        it('should handle sensitive distance', () => {
            const actual = indexObservationsAsLines(
                [
                    {
                        bbox: {
                            height: 75.97074672825268,
                            width: 380.94775390624994,
                            x: 780.754373550044,
                            y: 214.91724403387224,
                        },
                        text: 'بشاشة الحياة',
                    },
                    {
                        bbox: {
                            height: 68.3661157609501,
                            width: 539.3616943359374,
                            x: 343.23018798197756,
                            y: 312.87952305311984,
                        },
                        text: 'بشائر الخير مِن جَنبيه تَطلق',
                    },
                    {
                        bbox: {
                            height: 80.98248115698122,
                            width: 537.3461303710938,
                            x: 1017.5684144806687,
                            y: 308.4968668703253,
                        },
                        text: 'ومن حناياه هذا النور والألقُ',
                    },
                    {
                        bbox: {
                            height: 79.96920708237099,
                            width: 531.8181762695314,
                            x: 350.77370604866667,
                            y: 395.84757505773655,
                        },
                        text: 'ومن جَناه الرباضُ الخُضْرُ وارفة',
                    },
                    {
                        bbox: {
                            height: 115.7507247777975,
                            width: 532.32275390625,
                            x: 1017.5886271634922,
                            y: 374.9579761654046,
                        },
                        text: 'يُملُ منها ريعُ ضاحكٌ عَيِقُ',
                    },
                    {
                        bbox: {
                            height: 60.976520400307884,
                            width: 528.04638671875,
                            x: 347.0019683877151,
                            y: 501.80677444187836,
                        },
                        text: 'أتى إلى الناس والظلماء عاكفة',
                    },
                ],
                72,
                5,
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 75.97074672825268,
                        width: 380.94775390624994,
                        x: 780.754373550044,
                        y: 214.91724403387224,
                    },
                    index: 0,
                    text: 'بشاشة الحياة',
                },
                {
                    bbox: {
                        height: 80.98248115698122,
                        width: 537.3461303710938,
                        x: 1017.5684144806687,
                        y: 308.4968668703253,
                    },
                    index: 1,
                    text: 'ومن حناياه هذا النور والألقُ',
                },
                {
                    bbox: {
                        height: 68.3661157609501,
                        width: 539.3616943359374,
                        x: 343.23018798197756,
                        y: 312.87952305311984,
                    },
                    index: 1,
                    text: 'بشائر الخير مِن جَنبيه تَطلق',
                },
                {
                    bbox: {
                        height: 115.7507247777975,
                        width: 532.32275390625,
                        x: 1017.5886271634922,
                        y: 374.9579761654046,
                    },
                    index: 2,
                    text: 'يُملُ منها ريعُ ضاحكٌ عَيِقُ',
                },
                {
                    bbox: {
                        height: 79.96920708237099,
                        width: 531.8181762695314,
                        x: 350.77370604866667,
                        y: 395.84757505773655,
                    },
                    index: 2,
                    text: 'ومن جَناه الرباضُ الخُضْرُ وارفة',
                },
                {
                    bbox: {
                        height: 60.976520400307884,
                        width: 528.04638671875,
                        x: 347.0019683877151,
                        y: 501.80677444187836,
                    },
                    index: 3,
                    text: 'أتى إلى الناس والظلماء عاكفة',
                },
            ]);
        });

        it('should handle single observation', () => {
            const observations = [{ bbox: { height: 20, width: 100, x: 10, y: 10 }, text: 'Single observation' }];

            const result = indexObservationsAsLines(observations, 72, 5);
            expect(result).toEqual([
                { bbox: { height: 20, width: 100, x: 10, y: 10 }, index: 0, text: 'Single observation' },
            ]);
        });

        it('should consider height of observation for threshold calculation', () => {
            const observations = [
                { bbox: { height: 10, width: 100, x: 10, y: 10 }, text: 'Small height' },
                { bbox: { height: 40, width: 100, x: 120, y: 30 }, text: 'Large height' }, // Within threshold due to large height
                { bbox: { height: 10, width: 100, x: 10, y: 60 }, text: 'Far from previous' }, // Beyond threshold
            ];

            const indexed = indexObservationsAsLines(observations, 72, 5);

            expect(indexed[0].index).toBe(0);
            expect(indexed[1].index).toBe(0); // Same line due to tall height
            expect(indexed[2].index).toBe(1); // New line
        });

        it('should sort result by line and then y-coordinate', () => {
            const observations = [
                { bbox: { height: 20, width: 100, x: 10, y: 20 }, text: 'First line, second y' },
                { bbox: { height: 20, width: 100, x: 120, y: 10 }, text: 'First line, first y' },
                { bbox: { height: 20, width: 100, x: 10, y: 90 }, text: 'Second line, second y' },
                { bbox: { height: 20, width: 100, x: 120, y: 80 }, text: 'Second line, first y' },
            ];

            const indexed = indexObservationsAsLines(observations, 72, 5);

            // Should be sorted by line then y
            expect(indexed[0].text).toBe('First line, first y');
            expect(indexed[1].text).toBe('First line, second y');
            expect(indexed[2].text).toBe('Second line, first y');
            expect(indexed[3].text).toBe('Second line, second y');
        });
    });

    describe('indexObservationsAsParagraphs', () => {
        it('should keep each footnote in its own paragraph', () => {
            const actual = indexObservationsAsParagraphs(
                [
                    {
                        bbox: {
                            height: 106,
                            width: 1741,
                            x: 357,
                            y: 25,
                        },
                        text: 'وقالوا:',
                    },
                    {
                        bbox: {
                            height: 88,
                            width: 1693,
                            x: 357,
                            y: 162,
                        },
                        text: 'هو',
                    },
                    {
                        bbox: {
                            height: 88,
                            width: 283,
                            x: 357,
                            y: 283,
                        },
                        text: 'فيهما',
                    },
                    {
                        bbox: {
                            height: 79,
                            width: 1609,
                            x: 357,
                            y: 413,
                        },
                        text: 'وهذا',
                    },
                    {
                        bbox: {
                            height: 103,
                            width: 1615,
                            x: 357,
                            y: 533,
                        },
                        text: 'الهلاك',
                    },
                    {
                        bbox: {
                            height: 88,
                            width: 1623,
                            x: 357,
                            y: 655,
                        },
                        text: 'الكتاب',
                    },
                    {
                        bbox: {
                            height: 101,
                            width: 1429,
                            x: 357,
                            y: 781,
                        },
                        text: 'فكل',
                    },
                    {
                        bbox: {
                            height: 89,
                            width: 1740,
                            x: 357,
                            y: 916,
                        },
                        text: 'وفي',
                    },
                    {
                        bbox: {
                            height: 97,
                            width: 1684,
                            x: 357,
                            y: 1032,
                        },
                        text: 'نوله',
                    },
                    {
                        bbox: {
                            height: 93,
                            width: 1637,
                            x: 357,
                            y: 1158,
                        },
                        text: 'الميل',
                    },
                    {
                        bbox: {
                            height: 83,
                            width: 1191,
                            x: 357,
                            y: 1283,
                        },
                        text: 'الاعتصام،',
                    },
                    {
                        bbox: {
                            height: 98,
                            width: 888,
                            x: 357,
                            y: 1400,
                        },
                        text: 'ثم',
                    },
                    {
                        bbox: {
                            height: 102,
                            width: 1284,
                            x: 357,
                            y: 1520,
                        },
                        text: 'في',
                    },
                    {
                        bbox: {
                            height: 102,
                            width: 916,
                            x: 357,
                            y: 1646,
                        },
                        text: 'قال',
                    },
                    {
                        bbox: {
                            height: 93,
                            width: 1758,
                            x: 357,
                            y: 1771,
                        },
                        text: 'والإفك:',
                    },
                    {
                        bbox: {
                            height: 107,
                            width: 337,
                            x: 357,
                            y: 1893,
                        },
                        text: 'رضي',
                    },
                    {
                        bbox: {
                            height: 116,
                            width: 1759,
                            x: 357,
                            y: 2020,
                        },
                        text: 'وفي',
                    },
                    {
                        bbox: {
                            height: 102,
                            width: 1740,
                            x: 357,
                            y: 2144,
                        },
                        text: 'عظيم',
                    },
                    {
                        bbox: {
                            height: 74,
                            width: 1056,
                            x: 400,
                            y: 2418,
                        },
                        text: '(١)',
                    },
                    {
                        bbox: {
                            height: 75,
                            width: 1605,
                            x: 400,
                            y: 2516,
                        },
                        text: '(٢)',
                    },
                    {
                        bbox: {
                            height: 60,
                            width: 744,
                            x: 357,
                            y: 2627,
                        },
                        text: 'يسميه',
                    },
                    {
                        bbox: {
                            height: 74,
                            width: 1610,
                            x: 409,
                            y: 2718,
                        },
                        text: '(٣)',
                    },
                    {
                        bbox: {
                            height: 69,
                            width: 1195,
                            x: 357,
                            y: 2818,
                        },
                        text: 'والإلحاد',
                    },
                ],
                2,
                0.85,
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 106,
                        width: 1741,
                        x: 357,
                        y: 25,
                    },
                    index: 0,
                    text: 'وقالوا:',
                },
                {
                    bbox: {
                        height: 88,
                        width: 1693,
                        x: 357,
                        y: 162,
                    },
                    index: 0,
                    text: 'هو',
                },
                {
                    bbox: {
                        height: 88,
                        width: 283,
                        x: 357,
                        y: 283,
                    },
                    index: 0,
                    text: 'فيهما',
                },
                {
                    bbox: {
                        height: 79,
                        width: 1609,
                        x: 357,
                        y: 413,
                    },
                    index: 1,
                    text: 'وهذا',
                },
                {
                    bbox: {
                        height: 103,
                        width: 1615,
                        x: 357,
                        y: 533,
                    },
                    index: 1,
                    text: 'الهلاك',
                },
                {
                    bbox: {
                        height: 88,
                        width: 1623,
                        x: 357,
                        y: 655,
                    },
                    index: 1,
                    text: 'الكتاب',
                },
                {
                    bbox: {
                        height: 101,
                        width: 1429,
                        x: 357,
                        y: 781,
                    },
                    index: 1,
                    text: 'فكل',
                },
                {
                    bbox: {
                        height: 89,
                        width: 1740,
                        x: 357,
                        y: 916,
                    },
                    index: 2,
                    text: 'وفي',
                },
                {
                    bbox: {
                        height: 97,
                        width: 1684,
                        x: 357,
                        y: 1032,
                    },
                    index: 2,
                    text: 'نوله',
                },
                {
                    bbox: {
                        height: 93,
                        width: 1637,
                        x: 357,
                        y: 1158,
                    },
                    index: 2,
                    text: 'الميل',
                },
                {
                    bbox: {
                        height: 83,
                        width: 1191,
                        x: 357,
                        y: 1283,
                    },
                    index: 2,
                    text: 'الاعتصام،',
                },
                {
                    bbox: {
                        height: 98,
                        width: 888,
                        x: 357,
                        y: 1400,
                    },
                    index: 3,
                    text: 'ثم',
                },
                {
                    bbox: {
                        height: 102,
                        width: 1284,
                        x: 357,
                        y: 1520,
                    },
                    index: 4,
                    text: 'في',
                },
                {
                    bbox: {
                        height: 102,
                        width: 916,
                        x: 357,
                        y: 1646,
                    },
                    index: 5,
                    text: 'قال',
                },
                {
                    bbox: {
                        height: 93,
                        width: 1758,
                        x: 357,
                        y: 1771,
                    },
                    index: 6,
                    text: 'والإفك:',
                },
                {
                    bbox: {
                        height: 107,
                        width: 337,
                        x: 357,
                        y: 1893,
                    },
                    index: 6,
                    text: 'رضي',
                },
                {
                    bbox: {
                        height: 116,
                        width: 1759,
                        x: 357,
                        y: 2020,
                    },
                    index: 7,
                    text: 'وفي',
                },
                {
                    bbox: {
                        height: 102,
                        width: 1740,
                        x: 357,
                        y: 2144,
                    },
                    index: 7,
                    text: 'عظيم',
                },
                {
                    bbox: {
                        height: 74,
                        width: 1056,
                        x: 400,
                        y: 2418,
                    },
                    index: 8,
                    text: '(١)',
                },
                {
                    bbox: {
                        height: 75,
                        width: 1605,
                        x: 400,
                        y: 2516,
                    },
                    index: 9,
                    text: '(٢)',
                },
                {
                    bbox: {
                        height: 60,
                        width: 744,
                        x: 357,
                        y: 2627,
                    },
                    index: 9,
                    text: 'يسميه',
                },
                {
                    bbox: {
                        height: 74,
                        width: 1610,
                        x: 409,
                        y: 2718,
                    },
                    index: 10,
                    text: '(٣)',
                },
                {
                    bbox: {
                        height: 69,
                        width: 1195,
                        x: 357,
                        y: 2818,
                    },
                    index: 10,
                    text: 'والإلحاد',
                },
            ]);
        });

        it('should not introduce a gap', () => {
            const actual = indexObservationsAsParagraphs(
                [
                    {
                        bbox: {
                            height: 36,
                            width: 286,
                            x: 375,
                            y: 89,
                        },
                        text: 'مِن',
                    },
                    {
                        bbox: {
                            height: 50,
                            width: 716,
                            x: 169,
                            y: 170,
                        },
                        text: 'إن',
                    },
                ],
                2,
                0.85,
            );

            expect(actual).toEqual([
                {
                    bbox: {
                        height: 36,
                        width: 286,
                        x: 375,
                        y: 89,
                    },
                    index: 0,
                    text: 'مِن',
                },
                {
                    bbox: {
                        height: 50,
                        width: 716,
                        x: 169,
                        y: 170,
                    },
                    index: 1,
                    text: 'إن',
                },
            ]);
        });

        it('should index the paragraphs consistently', () => {
            const paragraphs = indexObservationsAsParagraphs(
                [
                    {
                        bbox: {
                            height: 41,
                            width: 371,
                            x: 226,
                            y: 153,
                        },
                        text: 'وعلى غلاف هذا الكتاب ما يأتي:',
                    },
                    {
                        bbox: {
                            height: 46,
                            width: 692,
                            x: 223,
                            y: 208,
                        },
                        text: 'راجعه وقدم له جماعة من هيئة كبار العلماء وغيرهم',
                    },
                    {
                        bbox: {
                            height: 50,
                            width: 828,
                            x: 230,
                            y: 259,
                        },
                        text: 'وكل هذا أو ذاك دعاية وترويج لكتاب قد يضر بالقراء، لأن كتاباً هذا حاله قد',
                    },
                    {
                        bbox: {
                            height: 49,
                            width: 574,
                            x: 176,
                            y: 321,
                        },
                        text: 'يجعلهم يتصورون أنه قد جاوز القنطرة فلا يعلى عليه.',
                    },
                    {
                        bbox: {
                            height: 45,
                            width: 832,
                            x: 228,
                            y: 394,
                        },
                        text: 'والناس كإبل مائة لا تكاد تجد فيها راحلة كما قال رسول اللّٰه -صلى اللّٰه عليه',
                    },
                    {
                        bbox: {
                            height: 45,
                            width: 104,
                            x: 178,
                            y: 455,
                        },
                        text: 'وسلّم-.',
                    },
                    {
                        bbox: {
                            height: 45,
                            width: 818,
                            x: 237,
                            y: 527,
                        },
                        text: 'وبحكم أني قرأت الكتاب وعرفت حقيقة حاله وعرفت حقيقة موقف العلماء',
                    },
                    {
                        bbox: {
                            height: 45,
                            width: 880,
                            x: 178,
                            y: 591,
                        },
                        text: 'منه، تعين عليّ بيان حال هذا الكتاب، وحقيقة موقف العلماء منه وهل قدموا',
                    },
                    {
                        bbox: {
                            height: 45,
                            width: 337,
                            x: 178,
                            y: 652,
                        },
                        text: 'لكتابه ؟ وحقيقة هذا التقديم.',
                    },
                    {
                        bbox: {
                            height: 50,
                            width: 825,
                            x: 226,
                            y: 713,
                        },
                        text: 'أولاً - لقد أرسل أبو الحسن كتابه " السراج الوهاج " إلى سماحة العلامة الشيخ',
                    },
                    {
                        bbox: {
                            height: 45,
                            width: 432,
                            x: 178,
                            y: 776,
                        },
                        text: '/ عبد العزيز بن عبد اللّٰه بن باز رحمه اللّٰه',
                    },
                    {
                        bbox: {
                            height: 48,
                            width: 823,
                            x: 230,
                            y: 840,
                        },
                        text: 'فأحاله إلى معالي نائبه آنذاك ومفتي المملكة الحالي الشيخ / عبد العزيز بن عبد',
                    },
                    {
                        bbox: {
                            height: 47,
                            width: 877,
                            x: 178,
                            y: 901,
                        },
                        text: 'اللّٰه بن محمد آل الشيخ حفظه اللّٰه نظراً لضيق وقته كما نص على ذلك في خطابه',
                    },
                    {
                        bbox: {
                            height: 47,
                            width: 880,
                            x: 178,
                            y: 964,
                        },
                        text: 'لأبي الحسن فقام معالي الشيخ / عبد العزيز آنذاك بقراءة الكتاب ثم وجه خطاباً',
                    },
                    {
                        bbox: {
                            height: 51,
                            width: 876,
                            x: 178,
                            y: 1025,
                        },
                        text: 'إلى الشيخ ابن باز تضمن بيان ما حواه الكتاب من العقائد من الإيمان بالله',
                    },
                    {
                        bbox: {
                            height: 43,
                            width: 574,
                            x: 178,
                            y: 1089,
                        },
                        text: 'وملائكته وكتبه ورسله واليوم الآخر والقدر خيره وشره.',
                    },
                    {
                        bbox: {
                            height: 39,
                            width: 79,
                            x: 230,
                            y: 1218,
                        },
                        text: 'ثم قال:',
                    },
                    {
                        bbox: {
                            height: 38,
                            width: 934,
                            x: 144,
                            y: 1351,
                        },
                        text: 'وقال أيضاً في نفس الشريط رقم ٦ الوجه (٢):" أنا كما قلت من قبل أريد الحدادية أن يأخذوا هذا الكتاب وأن',
                    },
                    {
                        bbox: {
                            height: 34,
                            width: 925,
                            x: 144,
                            y: 1405,
                        },
                        text: 'يكتبوا على كل فقرة كلامهم وينشروه فإن وافقوه فلماذا يعترضون وإن خالفوه فلينشروا فلينشروا لنعرف من معهم',
                    },
                    {
                        bbox: {
                            height: 38,
                            width: 930,
                            x: 145,
                            y: 1451,
                        },
                        text: 'من العلماء على قولهم وإن خالفوا شيئاً دون شيء فينظر أصابوا أم أخطئوا فإن أخطئوا فلا وزن لهذا الكلام وإن',
                    },
                    {
                        bbox: {
                            height: 34,
                            width: 945,
                            x: 145,
                            y: 1506,
                        },
                        text: 'أصابوا ننظر مرة أخرى ما حدود الخطأ الذي أنا أخطأت فيه هل هذا الخطأ يوجب الإخراج من السنة أم لا؟..".',
                    },
                ],
                2,
                0.85,
            );

            expect(paragraphs).toEqual([
                {
                    bbox: {
                        height: 41,
                        width: 371,
                        x: 226,
                        y: 153,
                    },
                    index: 0,
                    text: 'وعلى غلاف هذا الكتاب ما يأتي:',
                },
                {
                    bbox: {
                        height: 46,
                        width: 692,
                        x: 223,
                        y: 208,
                    },
                    index: 1,
                    text: 'راجعه وقدم له جماعة من هيئة كبار العلماء وغيرهم',
                },
                {
                    bbox: {
                        height: 50,
                        width: 828,
                        x: 230,
                        y: 259,
                    },
                    index: 2,
                    text: 'وكل هذا أو ذاك دعاية وترويج لكتاب قد يضر بالقراء، لأن كتاباً هذا حاله قد',
                },
                {
                    bbox: {
                        height: 49,
                        width: 574,
                        x: 176,
                        y: 321,
                    },
                    index: 2,
                    text: 'يجعلهم يتصورون أنه قد جاوز القنطرة فلا يعلى عليه.',
                },
                {
                    bbox: {
                        height: 45,
                        width: 832,
                        x: 228,
                        y: 394,
                    },
                    index: 3,
                    text: 'والناس كإبل مائة لا تكاد تجد فيها راحلة كما قال رسول اللّٰه -صلى اللّٰه عليه',
                },
                {
                    bbox: {
                        height: 45,
                        width: 104,
                        x: 178,
                        y: 455,
                    },
                    index: 3,
                    text: 'وسلّم-.',
                },
                {
                    bbox: {
                        height: 45,
                        width: 818,
                        x: 237,
                        y: 527,
                    },
                    index: 4,
                    text: 'وبحكم أني قرأت الكتاب وعرفت حقيقة حاله وعرفت حقيقة موقف العلماء',
                },
                {
                    bbox: {
                        height: 45,
                        width: 880,
                        x: 178,
                        y: 591,
                    },
                    index: 4,
                    text: 'منه، تعين عليّ بيان حال هذا الكتاب، وحقيقة موقف العلماء منه وهل قدموا',
                },
                {
                    bbox: {
                        height: 45,
                        width: 337,
                        x: 178,
                        y: 652,
                    },
                    index: 4,
                    text: 'لكتابه ؟ وحقيقة هذا التقديم.',
                },
                {
                    bbox: {
                        height: 50,
                        width: 825,
                        x: 226,
                        y: 713,
                    },
                    index: 5,
                    text: 'أولاً - لقد أرسل أبو الحسن كتابه " السراج الوهاج " إلى سماحة العلامة الشيخ',
                },
                {
                    bbox: {
                        height: 45,
                        width: 432,
                        x: 178,
                        y: 776,
                    },
                    index: 5,
                    text: '/ عبد العزيز بن عبد اللّٰه بن باز رحمه اللّٰه',
                },
                {
                    bbox: {
                        height: 48,
                        width: 823,
                        x: 230,
                        y: 840,
                    },
                    index: 6,
                    text: 'فأحاله إلى معالي نائبه آنذاك ومفتي المملكة الحالي الشيخ / عبد العزيز بن عبد',
                },
                {
                    bbox: {
                        height: 47,
                        width: 877,
                        x: 178,
                        y: 901,
                    },
                    index: 6,
                    text: 'اللّٰه بن محمد آل الشيخ حفظه اللّٰه نظراً لضيق وقته كما نص على ذلك في خطابه',
                },
                {
                    bbox: {
                        height: 47,
                        width: 880,
                        x: 178,
                        y: 964,
                    },
                    index: 6,
                    text: 'لأبي الحسن فقام معالي الشيخ / عبد العزيز آنذاك بقراءة الكتاب ثم وجه خطاباً',
                },
                {
                    bbox: {
                        height: 51,
                        width: 876,
                        x: 178,
                        y: 1025,
                    },
                    index: 6,
                    text: 'إلى الشيخ ابن باز تضمن بيان ما حواه الكتاب من العقائد من الإيمان بالله',
                },
                {
                    bbox: {
                        height: 43,
                        width: 574,
                        x: 178,
                        y: 1089,
                    },
                    index: 6,
                    text: 'وملائكته وكتبه ورسله واليوم الآخر والقدر خيره وشره.',
                },
                {
                    bbox: {
                        height: 39,
                        width: 79,
                        x: 230,
                        y: 1218,
                    },
                    index: 7,
                    text: 'ثم قال:',
                },
                {
                    bbox: {
                        height: 38,
                        width: 934,
                        x: 144,
                        y: 1351,
                    },
                    index: 8,
                    text: 'وقال أيضاً في نفس الشريط رقم ٦ الوجه (٢):" أنا كما قلت من قبل أريد الحدادية أن يأخذوا هذا الكتاب وأن',
                },
                {
                    bbox: {
                        height: 34,
                        width: 925,
                        x: 144,
                        y: 1405,
                    },
                    index: 8,
                    text: 'يكتبوا على كل فقرة كلامهم وينشروه فإن وافقوه فلماذا يعترضون وإن خالفوه فلينشروا فلينشروا لنعرف من معهم',
                },
                {
                    bbox: {
                        height: 38,
                        width: 930,
                        x: 145,
                        y: 1451,
                    },
                    index: 8,
                    text: 'من العلماء على قولهم وإن خالفوا شيئاً دون شيء فينظر أصابوا أم أخطئوا فإن أخطئوا فلا وزن لهذا الكلام وإن',
                },
                {
                    bbox: {
                        height: 34,
                        width: 945,
                        x: 145,
                        y: 1506,
                    },
                    index: 8,
                    text: 'أصابوا ننظر مرة أخرى ما حدود الخطأ الذي أنا أخطأت فيه هل هذا الخطأ يوجب الإخراج من السنة أم لا؟..".',
                },
            ]);
        });

        it('should group observations into paragraphs based on vertical gaps', () => {
            const observations = [
                { bbox: { height: 20, width: 500, x: 10, y: 10 }, text: 'First paragraph line 1' },
                { bbox: { height: 20, width: 500, x: 10, y: 40 }, text: 'First paragraph line 2' },
                { bbox: { height: 20, width: 500, x: 10, y: 120 }, text: 'Second paragraph line 1' }, // Big jump = new paragraph
                { bbox: { height: 20, width: 500, x: 10, y: 150 }, text: 'Second paragraph line 2' },
            ];

            const paragraphs = indexObservationsAsParagraphs(observations, 2, 0.85);

            expect(paragraphs[0].index).toBe(0);
            expect(paragraphs[1].index).toBe(0); // Same paragraph
            expect(paragraphs[2].index).toBe(1); // New paragraph due to big jump
            expect(paragraphs[3].index).toBe(1); // Same paragraph
        });

        it('should create new paragraph after short lines', () => {
            const observations = [
                { bbox: { height: 20, width: 500, x: 10, y: 10 }, text: 'Full width line' },
                { bbox: { height: 20, width: 250, x: 10, y: 40 }, text: 'Short line' }, // Short line should end paragraph
                { bbox: { height: 20, width: 500, x: 10, y: 70 }, text: 'Next paragraph' }, // Should be new paragraph
            ];

            const paragraphs = indexObservationsAsParagraphs(observations, 2, 0.85);

            expect(paragraphs[0].index).toBe(0);
            expect(paragraphs[1].index).toBe(0); // Same paragraph
            expect(paragraphs[2].index).toBe(1); // New paragraph after short line
        });

        it('should handle empty array', () => {
            const result = indexObservationsAsParagraphs([], 2, 0.85);
            expect(result).toEqual([]);
        });

        it('should handle single observation', () => {
            const observations = [{ bbox: { height: 20, width: 100, x: 10, y: 10 }, text: 'Single observation' }];

            const result = indexObservationsAsParagraphs(observations, 2, 0.85);
            expect(result).toEqual([
                { bbox: { height: 20, width: 100, x: 10, y: 10 }, index: 0, text: 'Single observation' },
            ]);
        });

        it('should detect paragraph breaks based on increasing gap size patterns', () => {
            const observations = [
                { bbox: { height: 20, width: 500, x: 10, y: 10 }, text: 'Line 1' },
                { bbox: { height: 20, width: 500, x: 10, y: 40 }, text: 'Line 2' }, // Gap of 30
                { bbox: { height: 20, width: 500, x: 10, y: 70 }, text: 'Line 3' }, // Gap of 30
                { bbox: { height: 20, width: 500, x: 10, y: 160 }, text: 'Line 4' }, // Gap of 90 (> 30*2)
            ];

            const paragraphs = indexObservationsAsParagraphs(observations, 2, 0.85);

            expect(paragraphs[0].index).toBe(0);
            expect(paragraphs[1].index).toBe(0);
            expect(paragraphs[2].index).toBe(0);
            expect(paragraphs[3].index).toBe(1); // New paragraph due to gap increase
        });

        it('should create new paragraph for significant vertical jumps', () => {
            const observations = [
                { bbox: { height: 10, width: 200, x: 10, y: 10 }, index: 0, text: 'Line 1' },
                { bbox: { height: 10, width: 200, x: 10, y: 30 }, index: 1, text: 'Line 2' },
                // Huge vertical jump
                { bbox: { height: 10, width: 200, x: 10, y: 150 }, index: 2, text: 'Line 3' },
            ];

            const result = indexObservationsAsParagraphs(observations, 2, 0.85);

            expect(result[0].index).toBe(result[1].index);
            expect(result[1].index).not.toBe(result[2].index);
        });

        it('should sort result by paragraph and then y-coordinate', () => {
            const observations = [
                { bbox: { height: 20, width: 500, x: 10, y: 40 }, text: 'Para 1 line 2' },
                { bbox: { height: 20, width: 500, x: 10, y: 10 }, text: 'Para 1 line 1' },
                { bbox: { height: 20, width: 500, x: 10, y: 140 }, text: 'Para 2 line 2' },
                { bbox: { height: 20, width: 500, x: 10, y: 110 }, text: 'Para 2 line 1' },
            ];

            const paragraphs = indexObservationsAsParagraphs(observations, 2, 0.85);

            // Should be sorted by paragraph then y
            expect(paragraphs[0].text).toBe('Para 1 line 1');
            expect(paragraphs[1].text).toBe('Para 1 line 2');
            expect(paragraphs[2].text).toBe('Para 2 line 1');
            expect(paragraphs[3].text).toBe('Para 2 line 2');
        });

        it('should create new paragraph for lines with width below tolerance', () => {
            const observations = [
                { bbox: { height: 10, width: 200, x: 10, y: 10 }, index: 0, text: 'Line 1' },
                { bbox: { height: 10, width: 160, x: 10, y: 30 }, index: 1, text: 'Line 2' }, // Width within tolerance
                { bbox: { height: 10, width: 50, x: 10, y: 50 }, index: 2, text: 'Line 3' }, // Width below tolerance
            ];

            const result = indexObservationsAsParagraphs(observations, 2, 0.85);

            expect(result[0].index).toBe(result[1].index); // Same paragraph
            expect(result[1].index).not.toBe(result[2].index); // New paragraph
        });
    });
});
