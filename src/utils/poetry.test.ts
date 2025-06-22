import { describe, expect, it } from 'bun:test';

import { DEFAULT_POETRY_OPTIONS } from './constants';
import { calculateAverageProseDensity, isPoeticGroup, isPoetryPair, isWidePoeticLine } from './poetry';

describe('poetry', () => {
    const createObservation = (text: string, x: number, y: number, width: number, height: number = 20) => ({
        bbox: { height, width, x, y },
        text,
    });

    const imageWidth = 1000;

    describe('calculateAverageProseDensity', () => {
        it('should calculate average prose density for typical prose observations', () => {
            const observations = [
                // Prose-like observations: not centered, wide, appropriate word count
                createObservation('This is a normal prose line with several words', 50, 100, 500),
                createObservation('Another prose line that spans most of the width', 60, 120, 480),
                createObservation('Yet another line of prose text content', 55, 140, 450),
            ];

            const options = {
                centerToleranceRatio: 0.05,
                minMarginRatio: 0.1,
                minWordCount: 2,
            };

            const density = calculateAverageProseDensity(observations, imageWidth, options);

            // Total words: 9 + 9 + 7 = 25 words
            // Total width: 500 + 480 + 450 = 1430 pixels
            // Expected density: 25 / 1430 ≈ 0.0175
            expect(density).toBeCloseTo(25 / 1430, 5);
        });

        it('should exclude observations with insufficient width', () => {
            const observations = [
                // Wide enough observation (width > 40% of image width = 400)
                createObservation('This is a normal prose line', 50, 100, 450),
                // Too narrow observation (should be excluded)
                createObservation('Short line', 100, 120, 300), // 30% of image width
            ];

            const options = {
                centerToleranceRatio: 0.05,
                minMarginRatio: 0.1,
                minWordCount: 2,
            };

            const density = calculateAverageProseDensity(observations, imageWidth, options);

            // Only first observation should count: 6 words / 450 width
            expect(density).toBeCloseTo(6 / 450, 5);
        });

        it('should exclude observations with too few words', () => {
            const observations = [
                // Sufficient words
                createObservation('This is a normal prose line', 50, 100, 450),
                // Too few words (should be excluded)
                createObservation('One', 60, 120, 400),
            ];

            const options = {
                centerToleranceRatio: 0.05,
                minMarginRatio: 0.1,
                minWordCount: 2,
            };

            const density = calculateAverageProseDensity(observations, imageWidth, options);

            // Only first observation should count: 6 words / 450 width
            expect(density).toBeCloseTo(6 / 450, 5);
        });

        it('should exclude observations with too many words (over MAX_PROSE_WORD_COUNT)', () => {
            const observations = [
                // Normal word count
                createObservation('This is a normal prose line', 50, 100, 450),
                // Too many words (26 words, over MAX_PROSE_WORD_COUNT of 25)
                createObservation(
                    'A very long line with many many many many many many many many many many many many many many many many many many many many many many many many words',
                    60,
                    120,
                    800,
                ),
            ];

            const options = {
                centerToleranceRatio: 0.05,
                minMarginRatio: 0.1,
                minWordCount: 2,
            };

            const density = calculateAverageProseDensity(observations, imageWidth, options);

            // Only first observation should count: 6 words / 450 width
            expect(density).toBeCloseTo(6 / 450, 5);
        });

        it('should return 0 when no observations meet prose criteria', () => {
            const observations = [
                // All centered observations
                createObservation('Centered line one', 450, 100, 100),
                createObservation('Centered line two', 460, 120, 80),
            ];

            const options = {
                centerToleranceRatio: 0.05,
                minMarginRatio: 0.1,
                minWordCount: 2,
            };

            const density = calculateAverageProseDensity(observations, imageWidth, options);
            expect(density).toBe(0);
        });

        it('should return 0 when observations array is empty', () => {
            const observations = [];

            const options = {
                centerToleranceRatio: 0.05,
                minMarginRatio: 0.1,
                minWordCount: 2,
            };

            const density = calculateAverageProseDensity(observations, imageWidth, options);
            expect(density).toBe(0);
        });

        it('should handle observations with different minWordCount threshold', () => {
            const observations = [
                createObservation('This is a normal prose line', 50, 100, 450),
                createObservation('Two words', 60, 120, 400),
                createObservation('Three word line', 70, 140, 420),
            ];

            const options = {
                centerToleranceRatio: 0.05,
                minMarginRatio: 0.1,
                minWordCount: 3, // Higher threshold
            };

            const density = calculateAverageProseDensity(observations, imageWidth, options);

            // Only first and third observations should count (6 + 3 words, 450 + 420 width)
            expect(density).toBeCloseTo(9 / 870, 5);
        });
    });

    describe('isPoetryPair', () => {
        it('should be true pairs that are not completely centered but have a large gap in between while having a small word count for poetry', () => {
            const actual = isPoetryPair(
                {
                    bbox: {
                        height: 158,
                        width: 910,
                        x: 808,
                        y: 576,
                    },
                    text: 'ويحيط سركما الوجود',
                },
                {
                    bbox: {
                        height: 187,
                        width: 1040,
                        x: 2396,
                        y: 576,
                    },
                    text: 'فليس شيء يخفى عنكما',
                },
                4961,
            );

            expect(actual).toBeTrue();
        });

        it('should detect the pair even though it is not centered due to the large gap', () => {
            const actual = isPoetryPair(
                {
                    bbox: {
                        height: 176,
                        width: 1096,
                        x: 826,
                        y: 1563,
                    },
                    text: 'صلى عليه اللّٰه ما بدر زها',
                },
                {
                    bbox: {
                        height: 210,
                        width: 1332,
                        x: 2293,
                        y: 1559,
                    },
                    text: 'والآل والصحب النجوم الزاهرة',
                },
                4961,
            );

            expect(actual).toBeTrue();
        });
    });

    describe('isPoeticGroup', () => {
        const avgProseWordDensity = 0.02;

        describe('single observation groups', () => {
            it('should reject single observation with insufficient width', () => {
                const group = [
                    // Too narrow (less than 60% of image width = 600)
                    createObservation('Short poetic line', 400, 100, 500),
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity);
                expect(result).toBe(false);
            });

            it('should reject single observation that is not centered', () => {
                const group = [
                    // Not centered (left-aligned)
                    createObservation('A poetic line with spacing', 50, 100, 600),
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity);
                expect(result).toBe(false);
            });

            it('should reject single observation with high word density', () => {
                // Word density: 14/600 = 0.0233, which is > 0.019 (threshold: 0.02 * 0.95)
                const group = [
                    createObservation(
                        'Many many many many many many many many many many many many many words',
                        200,
                        100,
                        600,
                    ), // 14 words
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity);
                expect(result).toBe(false);
            });

            it('should reject single observation with too few words', () => {
                const group = [
                    createObservation('One', 400, 100, 600), // Only 1 word, less than minWordCount of 2
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity);
                expect(result).toBe(false);
            });

            it('should handle zero word density gracefully', () => {
                const group = [
                    createObservation('Poetry line', 300, 100, 600), // 2 words
                ];

                // Test with avgProseWordDensity = 0
                const result = isPoeticGroup(group, imageWidth, 0);
                expect(result).toBe(false); // Should return false when density comparison fails
            });
        });

        describe('two observation groups (hemistichs)', () => {
            it('should identify valid poetry pair with similar widths and word counts', () => {
                const group = [
                    createObservation('First half of line', 350, 100, 200), // 4 words, width 200
                    createObservation('Second half line', 450, 100, 180), // 3 words, width 180
                ];

                // Combined bbox: x=350, width=280 (350+200-350=200, but rightmost is 450+180=630, so width=630-350=280)
                // Center at 350+280/2 = 490, image center = 500, within tolerance
                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, DEFAULT_POETRY_OPTIONS);
                expect(result).toBe(true);
            });

            it('should reject poetry pair with dissimilar widths', () => {
                const group = [
                    createObservation('Short line', 400, 100, 100), // 2 words, width 100
                    createObservation('Much longer line with more words', 300, 100, 400), // 6 words, width 400
                ];

                // Width difference ratio: |100-400|/((100+400)/2) = 300/250 = 1.2, which is > 0.4
                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, DEFAULT_POETRY_OPTIONS);
                expect(result).toBe(false);
            });

            it('should reject poetry pair with dissimilar word counts', () => {
                const group = [
                    createObservation('Two words', 400, 100, 150), // 2 words
                    createObservation('Many many many many many many words here', 380, 100, 160), // 8 words
                ];

                // Word count difference ratio: |2-8|/max(2,8) = 6/8 = 0.75, which is > 0.5
                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, DEFAULT_POETRY_OPTIONS);
                expect(result).toBe(false);
            });

            it('should reject poetry pair that is not centered when combined', () => {
                const group = [
                    createObservation('Left side text', 50, 100, 150), // Far left
                    createObservation('More left text', 250, 100, 160), // Still left side
                ];

                // Combined would not be centered
                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, DEFAULT_POETRY_OPTIONS);
                expect(result).toBe(false);
            });

            it('should reject poetry pair when first observation has too few words', () => {
                const group = [
                    createObservation('One', 400, 100, 150), // 1 word, less than minWordCount
                    createObservation('Two words here', 380, 100, 160), // 3 words
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, DEFAULT_POETRY_OPTIONS);
                expect(result).toBe(false);
            });

            it('should reject poetry pair when second observation has too few words', () => {
                const group = [
                    createObservation('Two words here', 400, 100, 150), // 3 words
                    createObservation('One', 380, 100, 160), // 1 word, less than minWordCount
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, DEFAULT_POETRY_OPTIONS);
                expect(result).toBe(false);
            });

            it('should handle edge case where combined bbox calculation spans different positions', () => {
                const group = [
                    createObservation('Right side first', 600, 100, 150), // Starts at 600, ends at 750
                    createObservation('Left side second', 250, 100, 160), // Starts at 250, ends at 410
                ];

                // Combined bbox: leftX = min(600, 250) = 250, rightmost = max(750, 410) = 750
                // Width = 750 - 250 = 500, center = 250 + 500/2 = 500 (exactly image center)
                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, DEFAULT_POETRY_OPTIONS);
                expect(result).toBe(true);
            });
        });

        describe('edge cases with different poetry options', () => {
            it('should work with stricter centering tolerance', () => {
                const strictOptions = {
                    ...DEFAULT_POETRY_OPTIONS,
                    centerToleranceRatio: 0.01, // Very strict centering
                };

                const group = [
                    createObservation('Slightly off center', 520, 100, 600), // Center at 820, off by 320 from page center
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, strictOptions);
                expect(result).toBe(false); // Should fail with strict centering
            });

            it('should work with higher minimum word count', () => {
                const strictOptions = {
                    ...DEFAULT_POETRY_OPTIONS,
                    minWordCount: 5,
                };

                const group = [
                    createObservation('Only four words here', 300, 100, 600), // 4 words, less than required 5
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, strictOptions);
                expect(result).toBe(false);
            });

            it('should work with higher minimum width ratio for merged lines', () => {
                const strictOptions = {
                    ...DEFAULT_POETRY_OPTIONS,
                    minWidthRatioForMerged: 0.8, // Require 80% of image width
                };

                const group = [
                    createObservation('Poetry line with spacing', 200, 100, 700), // 70% of image width
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, strictOptions);
                expect(result).toBe(false); // Should fail width requirement
            });
        });

        describe('groups with more than two observations', () => {
            it('should reject groups with three observations', () => {
                const group = [
                    createObservation('First line', 400, 100, 150),
                    createObservation('Second line', 380, 120, 160),
                    createObservation('Third line', 390, 140, 155),
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, DEFAULT_POETRY_OPTIONS);
                expect(result).toBe(false);
            });

            it('should reject groups with four observations', () => {
                const group = [
                    createObservation('First line', 400, 100, 150),
                    createObservation('Second line', 380, 120, 160),
                    createObservation('Third line', 390, 140, 155),
                    createObservation('Fourth line', 385, 160, 165),
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, DEFAULT_POETRY_OPTIONS);
                expect(result).toBe(false);
            });

            it('should detect the valid pair that takes up full width', () => {
                const actual = isPoeticGroup(
                    [
                        {
                            bbox: {
                                height: 258.94726753234863,
                                width: 1865.3965878086237,
                                x: 572.5475456774307,
                                y: 3374.017852695907,
                            },
                            text: 'أنا عبدٌ أنا ربٌّ',
                        },
                        {
                            bbox: {
                                height: 258.94726753234863,
                                width: 1893.100440338368,
                                x: 2557.994506287425,
                                y: 3374.0178519176575,
                            },
                            text: 'أنا عز أنا ذلَّ',
                        },
                    ],
                    4959,
                    0,
                    DEFAULT_POETRY_OPTIONS,
                );

                expect(actual).toBeTrue();
            });

            it('should detect the valid pair that is centered', () => {
                const actual = isPoeticGroup(
                    [
                        {
                            bbox: {
                                height: 93.2325592041014,

                                width: 600.22509765625,

                                x: 479.2495638535215,

                                y: 36.99999869252285,
                            },

                            text: 'أعادوا بها معنى سواع ومثله',
                        },
                        {
                            bbox: {
                                height: 74.4883728027343,

                                width: 609.5309448242188,

                                x: 1260.9380962813182,

                                y: 46.511627718234266,
                            },

                            text: 'يغوث وود بئس ذلك من ود',
                        },
                    ],
                    2480,
                    0,
                    DEFAULT_POETRY_OPTIONS,
                );

                expect(actual).toBeTrue();
            });

            it('should detect a valid pair even that has a footnote', () => {
                const actual = isPoeticGroup(
                    [
                        {
                            bbox: {
                                height: 84.04650878906281,
                                width: 632,

                                x: 469.94373167906724,

                                y: 413.9534900240734,
                            },

                            text: 'وكم طائف حول القبور مقبلاً',
                        },
                        {
                            bbox: {
                                height: 114.97213745117172,

                                width: 664.7333374023438,

                                x: 1240.5349732146512,

                                y: 398.09846366479695,
                            },

                            text: 'ويستلم الأركان منهن باليد (١)',
                        },
                    ],
                    2480,
                    0,
                    DEFAULT_POETRY_OPTIONS,
                );

                expect(actual).toBeTrue();
            });

            it('should not detect a split up line as poetry', () => {
                const actual = isPoeticGroup(
                    [
                        {
                            bbox: {
                                height: 222.41071428571385,
                                width: 627.9552903211753,
                                x: 757.240232419881,
                                y: 1257.1726190476193,
                            },
                            text: 'أليس اللَّه',
                        },
                        {
                            bbox: {
                                height: 240.3488254547117,
                                width: 2428.709411155177,
                                x: 1357.4917061605674,
                                y: 1266.4534951738071,
                            },
                            text: 'ل يقول: (إِنَّ الدِّينَ عِندَ ٱللَّهِ الْإِسْلَٰامُ)',
                        },
                    ],
                    4959,
                    0,
                    DEFAULT_POETRY_OPTIONS,
                );

                expect(actual).toBeFalse();
            });
        });

        describe('empty groups', () => {
            it('should reject empty groups', () => {
                const group = [];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, DEFAULT_POETRY_OPTIONS);
                expect(result).toBe(false);
            });
        });

        it('should detect the valid line', () => {
            const groups = [
                [
                    {
                        bbox: {
                            height: 268.44823428562677,
                            width: 4017.0670885857735,
                            x: 544.8435446307676,
                            y: 277.3255783167656,
                        },
                        text: 'عن معانيهم لأنفسهم، والإجمال والستر على من باينهم في طريقتهم ؛ لتكون',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 268.52159636361245,
                            width: 4007.832471075859,
                            x: 544.8435426451952,
                            y: 545.4069770215788,
                        },
                        text: 'معاني ألفاظهم مستبهمة على الأجانب؛ غيرة منهم أن يشيع استعمالها في غير',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 186.13095238095244,
                            width: 674.128474140895,
                            x: 526.3743098752797,
                            y: 831.2797619047623,
                        },
                        text: 'أهلها». اه.',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 221.86045056297607,
                            width: 3795.435883267235,
                            x: 748.0054843929938,
                            y: 1155.523262397291,
                        },
                        text: 'قلت: ليس الأمر كما قال المؤلف؛ بل أبهموا على غيرهم، أو جاءوا',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 249.5930249350411,
                            width: 4007.832471075859,
                            x: 526.3742781888523,
                            y: 1405.1162772701812,
                        },
                        text: 'بألفاظ محتملة حتى لا يحكم عليهم بالردة فيقتلوا، ولهذا حكى صاحب',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 231.10465004330618,
                            width: 2234.7820583663824,
                            x: 517.1397325700027,
                            y: 1682.4418614292913,
                        },
                        text: 'الكشف (ص ٥٠)، عن أبي مدين أنه قال :',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 265.77976090567466,
                            width: 3817.173297212324,
                            x: 616.9778192908329,
                            y: 1945.766513021073,
                        },
                        text: 'وفي السر أسرارٌ دقاق لطيفة تراق دمانا جهرةً لو بها بحنا',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 249.9598593938919,
                            width: 3823.1397357969795,
                            x: 720.3016364247173,
                            y: 2283.313952225133,
                        },
                        text: 'معنى هذا البيت أنهم يبطنون كلماتهم بمعان هي تعتبر عند أهل الشريعة',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 278.6152362823491,
                            width: 4019.4742273228776,
                            x: 543.5255713998667,
                            y: 2543.938187219862,
                        },
                        text: 'كفرًا وزندقة، ولو أظهروها لأبيحت دماؤهم وقتلوا بسببها، ونقل صاحب',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 222.41071428571456,
                            width: 2437.944028665091,
                            x: 507.905045468804,
                            y: 2828.244047619047,
                        },
                        text: 'الكشف أيضًا (ص٥٩)، عن ابن هود أنه قال :',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 295.8139501299178,
                            width: 3767.731645656906,
                            x: 627.9555025760064,
                            y: 3078.3139556653628,
                        },
                        text: 'علمُ قومي بي جهل إن شأني لأجلُّ',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 258.94726753234863,
                            width: 1865.3965878086237,
                            x: 572.5475456774307,
                            y: 3374.017852695907,
                        },
                        text: 'أنا عبدٌ أنا ربٌّ',
                    },
                    {
                        bbox: {
                            height: 258.94726753234863,
                            width: 1893.100440338368,
                            x: 2557.994506287425,
                            y: 3374.0178519176575,
                        },
                        text: 'أنا عز أنا ذلَّ',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 231.87499999999952,
                            width: 1856.1619702987089,
                            x: 581.7821504671731,
                            y: 3678.452380952381,
                        },
                        text: 'أنا دنيا أنا أخرى',
                    },
                    {
                        bbox: {
                            height: 287.2667385282968,
                            width: 1865.3965878086233,
                            x: 2548.7598208050827,
                            y: 3651.453494339285,
                        },
                        text: 'أنا بعضٌ أنا كلُّ',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 249.5930249350411,
                            width: 1883.8658228284528,
                            x: 591.0168394212194,
                            y: 3974.9999981519295,
                        },
                        text: 'أنا معشوق لذاتي',
                    },
                    {
                        bbox: {
                            height: 213.16653887430834,
                            width: 1828.4581177689647,
                            x: 2594.932973943635,
                            y: 3984.244180728958,
                        },
                        text: 'لست عنه الدهر أسلو',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 203.51882389613567,
                            width: 3740.027793127162,
                            x: 784.9442323125213,
                            y: 4307.790699050686,
                        },
                        text: '* أقول : يجب على من يقول أن الصوفية من مذاهب أهل السنة والجماعة',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 268.5215963636131,
                            width: 4026.301706095688,
                            x: 517.1396672854689,
                            y: 4520.406975904572,
                        },
                        text: 'أن يستغفر اللَّه كثيرًا؛ لعلَّ اللَّه أن يتوب عليه من هذا القول السيئ، فإن',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 249.84981627691374,
                            width: 4026.301706095687,
                            x: 507.905045468804,
                            y: 4825.208328295651,
                        },
                        text: 'الصوفية في هذا الزمن هي الصوفية التي تجعل العبد ربَّا، والعكس ؛ لتمزج',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 231.10465004330618,
                            width: 2419.474793645262,
                            x: 535.6089880271143,
                            y: 5112.034884537456,
                        },
                        text: 'بين الخالق والمخلوق، ولهذا يقول شاعرهم :',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 231.10465004330547,
                            width: 1883.8658228284528,
                            x: 600.2514552090613,
                            y: 5380.11627912108,
                        },
                        text: 'الربُّ عبدٌ والعبد رب',
                    },
                    {
                        bbox: {
                            height: 240.3488254547124,
                            width: 1828.4581177689647,
                            x: 2576.463677990971,
                            y: 5389.360471178457,
                        },
                        text: 'فليت شعري من المكلف',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 240.3488254547124,
                            width: 3767.731645656906,
                            x: 748.0057013406131,
                            y: 5703.662796420899,
                        },
                        text: 'وهذا ابن هود يقول في الأبيات السابقة، واصفًا لنفسه بأنه قد جمع بين',
                    },
                ],
                [
                    {
                        bbox: {
                            height: 231.10465004330618,
                            width: 4007.8324710758584,
                            x: 526.3742930726762,
                            y: 5971.7441871454985,
                        },
                        text: 'المتناقضات، فهو عبدٌ وربُّ في آن واحد، وهو دنيا وأخرى في آن واحد،',
                    },
                ],
            ];

            const avgProseWordDensity = calculateAverageProseDensity(groups.flat(), 4959, DEFAULT_POETRY_OPTIONS);

            const poetry = groups
                .filter((g) => {
                    return isPoeticGroup(g, 4959, avgProseWordDensity, DEFAULT_POETRY_OPTIONS);
                })
                .flat()
                .map((o) => o.text);

            expect(poetry).toEqual([
                'وفي السر أسرارٌ دقاق لطيفة تراق دمانا جهرةً لو بها بحنا',
                'علمُ قومي بي جهل إن شأني لأجلُّ',
                'أنا عبدٌ أنا ربٌّ',
                'أنا عز أنا ذلَّ',
                'أنا دنيا أنا أخرى',
                'أنا بعضٌ أنا كلُّ',
                'أنا معشوق لذاتي',
                'لست عنه الدهر أسلو',
                'الربُّ عبدٌ والعبد رب',
                'فليت شعري من المكلف',
            ]);
        });
    });

    describe('isWidePoeticLine', () => {
        it('should detect the poetic line after the pair', () => {
            const proseAndPoetry = [
                {
                    bbox: {
                        height: 372,
                        width: 4096,
                        x: 432,
                        y: 148,
                    },
                    text: 'رحمته ورضوانه؛ وجزاكم اللَّه خيرًا، ونفع بعلمكم أبناء المسلمين، والسلام',
                },
                {
                    bbox: {
                        height: 301,
                        width: 1460,
                        x: 488,
                        y: 431,
                    },
                    text: 'عليكم ورحمة اللَّه وبركاته.',
                },
                {
                    bbox: {
                        height: 263,
                        width: 3844,
                        x: 645,
                        y: 788,
                    },
                    text: 'الجواب: الحمد لله رب العالمين، والصلاة والسلا على أشرف الخل',
                },
                {
                    bbox: {
                        height: 249,
                        width: 3028,
                        x: 461,
                        y: 1053,
                    },
                    text: 'أجمعين؛ نبينا محمد وعلى آله وصحبه أجمعين، ، وبعد.',
                },
                {
                    bbox: {
                        height: 268,
                        width: 1616,
                        x: 1671,
                        y: 1423,
                    },
                    text: 'جماعة الإخوان المسلمون',
                },
                {
                    bbox: {
                        height: 277,
                        width: 3841,
                        x: 637,
                        y: 1811,
                    },
                    text: 'تعريف الإخوان المسلمون: هم أتباع حسن البنا، ومنهجهم عليه',
                },
                {
                    bbox: {
                        height: 313,
                        width: 1520,
                        x: 463,
                        y: 2034,
                    },
                    text: 'ملاحظات، أهمها ما يلي:',
                },
                {
                    bbox: {
                        height: 290,
                        width: 3809,
                        x: 653,
                        y: 2392,
                    },
                    text: '١- التهاون في توحيد العبادة، الذي هو أهمُّ شيء في الإسلام، ولا يصح',
                },
                {
                    bbox: {
                        height: 194,
                        width: 960,
                        x: 443,
                        y: 2717,
                    },
                    text: 'إسلام عبد إلا به.',
                },
                {
                    bbox: {
                        height: 259,
                        width: 3823,
                        x: 646,
                        y: 3004,
                    },
                    text: '٢- سكوتُهم وإقرارهم للناس على الشرك الأكبر؛ من الدعاء لغير اللَّه،',
                },
                {
                    bbox: {
                        height: 350,
                        width: 4005,
                        x: 440,
                        y: 3241,
                    },
                    text: 'والتطوف بالقبور، والنذر لأصحابها، والذبح على أسمائهم، وما إلى ذلك.',
                },
                {
                    bbox: {
                        height: 297,
                        width: 3817,
                        x: 644,
                        y: 3589,
                    },
                    text: '٣- أن هذا المنهج مؤسِّسُه صوفيٌّ ؛ له علاقة في الصوفية ؛ حيث أخذ',
                },
                {
                    bbox: {
                        height: 249,
                        width: 3407,
                        x: 415,
                        y: 3900,
                    },
                    text: 'البيعة من عبد الوهاب الحصافي على طريقته الحصافية الشاذلية.',
                },
                {
                    bbox: {
                        height: 249,
                        width: 3813,
                        x: 646,
                        y: 4233,
                    },
                    text: '٤- وجود البدع عندهم، وتعبدهم بها بل إن مؤسِّس المنهج ؛ يقرر بأن',
                },
                {
                    bbox: {
                        height: 261,
                        width: 3992,
                        x: 403,
                        y: 4506,
                    },
                    text: 'النبي ااِلفه يحضر مجالس ذكرهم ويغفر لهم ما قد مضى من ذنوبهم ؛ في قوله :',
                },
                {
                    bbox: {
                        height: 292,
                        width: 1836,
                        x: 540,
                        y: 4738,
                    },
                    text: 'صلَّى الإله على النور الذي ظهرا',
                },
                {
                    bbox: {
                        height: 213,
                        width: 1883,
                        x: 2502,
                        y: 4815,
                    },
                    text: 'للعالمين ففاق الشمس والقمرا',
                },
                {
                    bbox: {
                        height: 238,
                        width: 3845,
                        x: 530,
                        y: 5088,
                    },
                    text: 'هذا الحبيب مع الأحباب قد حضرا وسامح الكل فيما قد مضى وجرا',
                },
                {
                    bbox: {
                        height: 256,
                        width: 3778,
                        x: 655,
                        y: 5407,
                    },
                    text: '٥- دعوتهم إلى خلافة، وهذا بدعة، فإن الرسل وأتباعهم ما كلفوا ؛ إلَّا',
                },
                {
                    bbox: {
                        height: 260,
                        width: 4063,
                        x: 406,
                        y: 5665,
                    },
                    text: 'بالدعوة على التوحيد؛ قال تعالى : (وَلَقَدْ بَعَتْنَا فِي كُلِّ أُمَّةٍ رَسُولًا أَنِ اعْبُدُواْ',
                },
                {
                    bbox: {
                        height: 325,
                        width: 1799,
                        x: 403,
                        y: 5868,
                    },
                    text: 'اللّهَ وَاجْتَنِبُوا الطَّغُوتَ) [النحل: ٣٦)',
                },
            ];

            const avgProseWordDensity = calculateAverageProseDensity(proseAndPoetry, 4959);
            const poetry = proseAndPoetry.filter((p) => isWidePoeticLine(p, 4959, avgProseWordDensity));
            expect(poetry).toEqual([
                {
                    bbox: {
                        height: 238,
                        width: 3845,
                        x: 530,
                        y: 5088,
                    },
                    text: 'هذا الحبيب مع الأحباب قد حضرا وسامح الكل فيما قد مضى وجرا',
                },
            ]);
        });

        it('should be an empty list for an introduction page which is only composed of prose paragraphs', () => {
            const prose = [
                {
                    bbox: {
                        height: 274,
                        width: 2203,
                        x: 1363,
                        y: 172,
                    },
                    text: 'مقدمة الشيخ أحمد بن يحيى النجمي',
                },
                {
                    bbox: {
                        height: 293,
                        width: 3789,
                        x: 654,
                        y: 508,
                    },
                    text: 'الحمد لله رب العالمين، والصلاة والسلام على رسول اللَّه، وعلى آله',
                },
                {
                    bbox: {
                        height: 147,
                        width: 507,
                        x: 452,
                        y: 822,
                    },
                    text: 'وصحبه.',
                },
                {
                    bbox: {
                        height: 307,
                        width: 3754,
                        x: 699,
                        y: 1016,
                    },
                    text: 'وبعد: فقد اطلعت على الأسئلة والأجوبة الخاصَّة بالمناهج الدعوية',
                },
                {
                    bbox: {
                        height: 250,
                        width: 4017,
                        x: 424,
                        y: 1293,
                    },
                    text: 'المستوردة؛ التي خلطت الحقَّ بالباطل، والسنة بالبدعة، وغبَّشَت على كثير من',
                },
                {
                    bbox: {
                        height: 258,
                        width: 3527,
                        x: 434,
                        y: 1534,
                    },
                    text: 'الشباب، وخلطت عليهم الأمور، وألبستهم فتنةً كانوا في غنِّى عنها.',
                },
                {
                    bbox: {
                        height: 268,
                        width: 3776,
                        x: 646,
                        y: 1821,
                    },
                    text: 'وقد تنبَّه بعض الشباب لهذا اللبس والتغبيش، فحاولوا الاستيضاح عمَّا',
                },
                {
                    bbox: {
                        height: 268,
                        width: 4007,
                        x: 452,
                        y: 2070,
                    },
                    text: 'يجري على الساحة من خلال تلك الأسئلة التي حصلت في ظروف مختلفة أشار',
                },
                {
                    bbox: {
                        height: 259,
                        width: 3998,
                        x: 434,
                        y: 2310,
                    },
                    text: 'إليها الكاتب في أوَّل مقدمته، فجمعها، -وهو الشيخ: حسن بن محمد بن',
                },
                {
                    bbox: {
                        height: 317,
                        width: 3956,
                        x: 469,
                        y: 2506,
                    },
                    text: 'منصور الدغريري جزاه اللَّه خيرًا - بعضها إلى بعض؛ لتنشر في كُتيب، وتعم بها',
                },
                {
                    bbox: {
                        height: 163,
                        width: 458,
                        x: 435,
                        y: 2817,
                    },
                    text: 'الفائدة.',
                },
                {
                    bbox: {
                        height: 278,
                        width: 3789,
                        x: 644,
                        y: 3070,
                    },
                    text: 'وقد استأذن منِّي قبل أن يخطو أوَّل خطوة، فأذنت له في جمعها ، وتخريج ما',
                },
                {
                    bbox: {
                        height: 268,
                        width: 3989,
                        x: 434,
                        y: 3318,
                    },
                    text: 'ورد فيها من آيات وأحاديث، والتعليق في بعض المواضع ؛ راجيًا من اللَّه أن يعمَّ',
                },
                {
                    bbox: {
                        height: 282,
                        width: 3983,
                        x: 432,
                        y: 3560,
                    },
                    text: 'بها النفع، ويحقّق من خلالها الفائدة، فتوضِّح شبهة، أو تزيل حيرة؛ أو تثبت',
                },
                {
                    bbox: {
                        height: 175,
                        width: 434,
                        x: 461,
                        y: 3845,
                    },
                    text: 'معلومة.',
                },
                {
                    bbox: {
                        height: 268,
                        width: 3778,
                        x: 645,
                        y: 4069,
                    },
                    text: 'ولست أدعي بذلك الكمال، فما الكمال إلَّا لله، وما العصمة إلا للأنبياء،',
                },
                {
                    bbox: {
                        height: 257,
                        width: 3982,
                        x: 421,
                        y: 4351,
                    },
                    text: 'ومِنْ لازم البشرية النقصُ ، والمرجو من القارئ دعوة صالحة لي، ولجامعها',
                },
                {
                    bbox: {
                        height: 372,
                        width: 3968,
                        x: 421,
                        y: 4533,
                    },
                    text: 'وكاتبها، وصلى اللَّه وسلم على نبينا محمد، وعلى آله وصحبه وسلم تسليمًا',
                },
                {
                    bbox: {
                        height: 194,
                        width: 341,
                        x: 443,
                        y: 4843,
                    },
                    text: 'كثيرًا .',
                },
                {
                    bbox: {
                        height: 157,
                        width: 304,
                        x: 2853,
                        y: 5130,
                    },
                    text: 'كتبه',
                },
                {
                    bbox: {
                        height: 213,
                        width: 729,
                        x: 2687,
                        y: 5333,
                    },
                    text: 'فضيلة الشيخ',
                },
                {
                    bbox: {
                        height: 213,
                        width: 1265,
                        x: 2382,
                        y: 5574,
                    },
                    text: 'أحمد بن يحيى النجمي',
                },
                {
                    bbox: {
                        height: 184,
                        width: 906,
                        x: 2584,
                        y: 5810,
                    },
                    text: 'في ١٤١٩/٩/١٣ه',
                },
            ];

            const avgProseWordDensity = calculateAverageProseDensity(prose, 4959);
            const poetry = prose.filter((p) => isWidePoeticLine(p, 4959, avgProseWordDensity));
            expect(poetry).toBeEmpty();
        });

        it('should be an empty list if it is purely body prose', () => {
            const prose = [
                {
                    bbox: {
                        height: 242,
                        width: 3788,
                        x: 700,
                        y: 206,
                    },
                    text: 'وكان من ضمن العلماء الذين انبروا لتفنيد تلك الضلالات، ووجَّهوا',
                },
                {
                    bbox: {
                        height: 258,
                        width: 3952,
                        x: 507,
                        y: 462,
                    },
                    text: 'سهام النقد والبيان إليها، وحذَّروا الناس من الاغترار بها، والوقوع في',
                },
                {
                    bbox: {
                        height: 259,
                        width: 3980,
                        x: 489,
                        y: 758,
                    },
                    text: 'حبائلها وبراثنها فضيلة الشيخ أحمد بن يحيى النجمي؛ حفظه الله ورعاه،',
                },
                {
                    bbox: {
                        height: 259,
                        width: 3961,
                        x: 489,
                        y: 1016,
                    },
                    text: 'وأمدَّ اللَّه في عمره، وأعمار مشايخنا الفضلاء؛ لإعلاء كلمة اللَّه، وصد',
                },
                {
                    bbox: {
                        height: 278,
                        width: 4017,
                        x: 470,
                        y: 1275,
                    },
                    text: 'عدوان المبطلين الصَّادِّين عن سبيل اللَّه، وأعانَهم بمنه وكرمه وتوفيقه لإحياء',
                },
                {
                    bbox: {
                        height: 213,
                        width: 2123,
                        x: 461,
                        y: 1608,
                    },
                    text: 'السنن، وإماتة الجهل والضلال والبدع.',
                },
                {
                    bbox: {
                        height: 231,
                        width: 3749,
                        x: 711,
                        y: 1913,
                    },
                    text: 'وإليك أخي القارئ الكريم هذه الفتاوى النافعة بحوله وقوته، والتي',
                },
                {
                    bbox: {
                        height: 231,
                        width: 4007,
                        x: 461,
                        y: 2181,
                    },
                    text: 'أجاب فيها شيخنا الفاضل إجابة شافية كافية لمن أراد الفقه في دينه، والخوف',
                },
                {
                    bbox: {
                        height: 213,
                        width: 1920,
                        x: 498,
                        y: 2458,
                    },
                    text: 'من عقاب ربه، وأليم جزائه وحسابه .',
                },
                {
                    bbox: {
                        height: 241,
                        width: 3767,
                        x: 701,
                        y: 2773,
                    },
                    text: 'وقد أطنب الكلام في بعض المواضع -وفقه الله- وأوجز في بعضها ؛',
                },
                {
                    bbox: {
                        height: 221,
                        width: 3961,
                        x: 507,
                        y: 3059,
                    },
                    text: 'متحريًا في ذلك لكل سؤال ما يناسبه بحسب الحالة من الإطناب والإيجاز؛',
                },
                {
                    bbox: {
                        height: 261,
                        width: 4018,
                        x: 461,
                        y: 3299,
                    },
                    text: 'آخذًا من كتاب ربه دليلًا ، ومن سنة نبيه برهانًا منيرًا، ومن نَهج الصحابة',
                },
                {
                    bbox: {
                        height: 249,
                        width: 3758,
                        x: 480,
                        y: 3586,
                    },
                    text: 'وتابعيهم طريقًا واضحًا قويمًا ؛ في جميع أبواب العلم والعمل وغيرهما .',
                },
                {
                    bbox: {
                        height: 231,
                        width: 3749,
                        x: 711,
                        y: 3919,
                    },
                    text: 'قدوةً في الحق دون ميل ولا اعوجاج عن هديهم، فهم خير الأمة دينًا،',
                },
                {
                    bbox: {
                        height: 296,
                        width: 4026,
                        x: 470,
                        y: 4140,
                    },
                    text: 'وأعمقهم علمًا، وأقلهم تكلفًا ؛ -رضوان اللَّه عليهم أجمعين، وجمعنا اللَّه',
                },
                {
                    bbox: {
                        height: 303,
                        width: 3976,
                        x: 495,
                        y: 4430,
                    },
                    text: 'بهم في دار النجاة والنعيم، فكانت فتاواه -رعاه الله- وافيةً بالغرض وشافيةً',
                },
                {
                    bbox: {
                        height: 184,
                        width: 517,
                        x: 498,
                        y: 4779,
                    },
                    text: 'من العي.',
                },
                {
                    bbox: {
                        height: 249,
                        width: 3751,
                        x: 700,
                        y: 5040,
                    },
                    text: 'وقد خرَّج كاتب هذه الأسطر، الفقير إلى عفو ربه الأستاذ حسن بن محمد',
                },
                {
                    bbox: {
                        height: 269,
                        width: 4010,
                        x: 460,
                        y: 5311,
                    },
                    text: 'ابن منصور الدغريري ما في هذا السفر المبارك؛ آياته القرآنية، وأحاديثه',
                },
                {
                    bbox: {
                        height: 287,
                        width: 4026,
                        x: 461,
                        y: 5565,
                    },
                    text: 'النبوية؛ مستعينًا في ذلك بجهاز الكمبيوتر، ولم أقم بهذا العمل إلَّا بعد أن',
                },
                {
                    bbox: {
                        height: 241,
                        width: 3176,
                        x: 341,
                        y: 5869,
                    },
                    text: '• استأذنت من شيخي أحمد بن يحيى النجمي -حفظه الله-.',
                },
            ];

            const avgProseWordDensity = calculateAverageProseDensity(prose, 4959);

            const poetry = prose.filter((p) => isWidePoeticLine(p, 4959, avgProseWordDensity));
            expect(poetry).toBeEmpty();
        });

        it('should not detect any poetry in a document with just prose', () => {
            const prose = [
                {
                    bbox: {
                        height: 213,
                        width: 2890,
                        x: 701,
                        y: 212,
                    },
                    text: '- و : ((رسالة الإرشاد إلى بيان الحق في حكم الجهاد)) .',
                },
                {
                    bbox: {
                        height: 203,
                        width: 2964,
                        x: 711,
                        y: 536,
                    },
                    text: '- و : ((فتح الرب الودود في الفتاوى والرسائل والردود) .',
                },
                {
                    bbox: {
                        height: 259,
                        width: 3758,
                        x: 692,
                        y: 822,
                    },
                    text: 'وهناك فتاوى غيرها ستطبع قريبًا -إن شاء الله-، للشيخ أحمد - حفظه',
                },
                {
                    bbox: {
                        height: 221,
                        width: 4007,
                        x: 461,
                        y: 1081,
                    },
                    text: 'الله- خلاصات نافعة على بعض الكتب وشروحاتها ؛ أملاها علينا فضيلته منذ',
                },
                {
                    bbox: {
                        height: 222,
                        width: 3980,
                        x: 470,
                        y: 1358,
                    },
                    text: 'زمن ؛ بل على تلامذته من قبلي ؛ فبعضها قد اكتمل شرحه ، وبعضها لم يكتمل',
                },
                {
                    bbox: {
                        height: 249,
                        width: 3989,
                        x: 489,
                        y: 1599,
                    },
                    text: 'بعد كإملاءاته على ((فتح الباري بشرح أحاديث صحيح البخاري)» وعلى ((شرح',
                },
                {
                    bbox: {
                        height: 231,
                        width: 3933,
                        x: 517,
                        y: 1867,
                    },
                    text: 'صحيح الإمام مسلم للنووي) -رحمهما الله-، و ((نيل الأوطار بشرح منتقى',
                },
                {
                    bbox: {
                        height: 264,
                        width: 4010,
                        x: 451,
                        y: 2097,
                    },
                    text: 'الأخبار من أحاديث سيد الأخيار» وعلى (عون المعبود بشرح أحاديث سنن',
                },
                {
                    bbox: {
                        height: 299,
                        width: 4030,
                        x: 440,
                        y: 2344,
                    },
                    text: 'أبي داود)» و ((تحفة الأحوذي بشرح أحاديث جامع الترمذي) و ((الروضة الندية',
                },
                {
                    bbox: {
                        height: 250,
                        width: 3980,
                        x: 480,
                        y: 2624,
                    },
                    text: 'شرح الدرر البهية) وعلى ((سبل السلام بشرح أحاديث بلوغ المرام)» وعلى',
                },
                {
                    bbox: {
                        height: 308,
                        width: 3229,
                        x: 467,
                        y: 2863,
                    },
                    text: '(«شرح السنة للإمام أحمد) و (شرح السنة، للإمام البربهاري)).',
                },
                {
                    bbox: {
                        height: 289,
                        width: 3771,
                        x: 691,
                        y: 3178,
                    },
                    text: 'وأغلب هذه الكتب التي سبرناها لك أخي القارئ الكريم ما زالت تدرَّس',
                },
                {
                    bbox: {
                        height: 296,
                        width: 3970,
                        x: 470,
                        y: 3419,
                    },
                    text: 'في مسجده وفي غيره من المساجد في المنطقة، وكلُّها تحتاج من أهل الفضل',
                },
                {
                    bbox: {
                        height: 258,
                        width: 3991,
                        x: 460,
                        y: 3721,
                    },
                    text: 'والإحسان، ومحبِّي العلم والإيمان إلى عناية ومتابعة ومساعدة؛ لإحيائها',
                },
                {
                    bbox: {
                        height: 221,
                        width: 4007,
                        x: 452,
                        y: 3993,
                    },
                    text: 'ونشرها بين الناس، فلن تخرج إلى حيِّز الوجود حتى يهيئ اللّه لها من يقوم',
                },
                {
                    bbox: {
                        height: 255,
                        width: 3936,
                        x: 525,
                        y: 4215,
                    },
                    text: 'طبعها، وتحقيقها، وإخراجها بثوب جديد، فجزى اللّه خيرًا من أراد أن',
                },
                {
                    bbox: {
                        height: 260,
                        width: 4044,
                        x: 424,
                        y: 4473,
                    },
                    text: 'يتسبب في نشر هذا العلم إلى ذويه، ومبتغيه، وجزى اللَّه شيخنا الفاضل خيرًا',
                },
                {
                    bbox: {
                        height: 306,
                        width: 3986,
                        x: 468,
                        y: 4723,
                    },
                    text: 'على ما قدَّمه وما يقدمه لطلبة العلم من العلم الجم الغزير الطيب النافع',
                },
                {
                    bbox: {
                        height: 250,
                        width: 4007,
                        x: 443,
                        y: 5009,
                    },
                    text: 'المبارك، فقد قضى فضيلته جميع أوقاته ما بين كاتب، وناشر ومعلُّم ومفسر،',
                },
                {
                    bbox: {
                        height: 238,
                        width: 3991,
                        x: 451,
                        y: 5273,
                    },
                    text: 'ومرشد ومبصِّر؛ إلى جانب جلوسه للفتوى، واستقباله للناس دون ضجر،',
                },
                {
                    bbox: {
                        height: 277,
                        width: 2013,
                        x: 443,
                        y: 5500,
                    },
                    text: 'ولا ملل مبتغيًا بذلك وجه اللَّه الكريم .',
                },
                {
                    bbox: {
                        height: 295,
                        width: 3795,
                        x: 646,
                        y: 5796,
                    },
                    text: 'أطال اللَّه عمر شيخنا، وجميع مشايخ السنة في كلِّ قطر ومصر،',
                },
            ];
            const avgProseWordDensity = calculateAverageProseDensity(prose, 4959);

            const poetry = prose.filter((p) => isWidePoeticLine(p, 4959, avgProseWordDensity));
            expect(poetry).toBeEmpty();
        });

        it('should not detect any poetry for regular prose', () => {
            const prose = [
                {
                    bbox: {
                        height: 214,
                        width: 2201,
                        x: 1421,
                        y: 83,
                    },
                    text: 'تقديم العلامة الشيخ صالح بن فوزان الفوزان',
                },
                {
                    bbox: {
                        height: 186,
                        width: 929,
                        x: 2053,
                        y: 344,
                    },
                    text: 'بسم اللّٰه الرحمن الرحيم',
                },
                {
                    bbox: {
                        height: 192,
                        width: 2807,
                        x: 732,
                        y: 591,
                    },
                    text: 'الحمد لله رب العالمين والصلاة والسلام على نبينا محمد وآله وصحبه',
                },
                {
                    bbox: {
                        height: 176,
                        width: 3493,
                        x: 733,
                        y: 865,
                    },
                    text: 'وبعد : فقد اطلعت على ما كتبه فضيلة الشيخ : ربيع بن هادي المدخلي في رده',
                },
                {
                    bbox: {
                        height: 225,
                        width: 3467,
                        x: 751,
                        y: 1074,
                    },
                    text: 'على الكتاب المسمى "محمد بن عبد الوهاب داعية إصلاحي وليس نبياً" للمدعو',
                },
                {
                    bbox: {
                        height: 186,
                        width: 3455,
                        x: 771,
                        y: 1349,
                    },
                    text: 'حسن بن فرحان المالكي ، ذلكم الكتاب الذي تطاول فيه على الإمام محمد بن',
                },
                {
                    bbox: {
                        height: 186,
                        width: 3483,
                        x: 752,
                        y: 1590,
                    },
                    text: 'عبد الوهاب زاعماً الرد على كتابه العظيم "كشف الشبهات" ولم يكتف هذا',
                },
                {
                    bbox: {
                        height: 168,
                        width: 3502,
                        x: 733,
                        y: 1851,
                    },
                    text: 'الكاتب المفتون بهذا العمل المخزي بل تمادى في غيه وضلاله وتطاول على جبال',
                },
                {
                    bbox: {
                        height: 176,
                        width: 3483,
                        x: 733,
                        y: 2093,
                    },
                    text: 'الإسلام بإفكه وانتحاله وحاول أن ينتقد ما كتبه أئمة الإسلام وهداة الأنام في بيان',
                },
                {
                    bbox: {
                        height: 223,
                        width: 3521,
                        x: 715,
                        y: 2325,
                    },
                    text: 'العقائد الصحيحة ودحض العقائد القبيحة فوجدت رد الشيخ ربيع حفظه اللّٰه وافياً',
                },
                {
                    bbox: {
                        height: 205,
                        width: 3521,
                        x: 715,
                        y: 2576,
                    },
                    text: 'في موضوعه جيداً في أسلوبه مفحماً للخصم فجزاه اللّٰه خير الجزاء وأثابه على ما قام',
                },
                {
                    bbox: {
                        height: 196,
                        width: 3474,
                        x: 752,
                        y: 2836,
                    },
                    text: 'به من نصرة الحق وقمع الباطل وأهله . وصلى اللّٰه وسلم على نبينا محمد وآله',
                },
                {
                    bbox: {
                        height: 102,
                        width: 427,
                        x: 733,
                        y: 3153,
                    },
                    text: 'وصحبه .',
                },
                {
                    bbox: {
                        height: 130,
                        width: 287,
                        x: 2963,
                        y: 3358,
                    },
                    text: 'كتبه :',
                },
                {
                    bbox: {
                        height: 158,
                        width: 1137,
                        x: 2673,
                        y: 3575,
                    },
                    text: 'صالح بن فوزان بن عبد اللّٰه الفوزان',
                },
                {
                    bbox: {
                        height: 121,
                        width: 771,
                        x: 3075,
                        y: 3795,
                    },
                    text: 'عضو هيئة كبار العلماء',
                },
                {
                    bbox: {
                        height: 114,
                        width: 623,
                        x: 3222,
                        y: 3989,
                    },
                    text: 'في ١٤٢٣/٨/٩ه',
                },
            ];

            const avgProseWordDensity = calculateAverageProseDensity(prose, 4961);

            const poetry = prose.filter((p) => isWidePoeticLine(p, 4961, avgProseWordDensity));
            expect(poetry).toBeEmpty();
        });

        it('should not detect any poetry for purely titles and body text', () => {
            const prose = [
                {
                    bbox: {
                        height: 232.59447561748473,
                        width: 2331.8557377654774,
                        x: 1374.958878109614,
                        y: 74.43023387742252,
                    },
                    isCentered: true,
                    text: 'تقديم العلامة الشيخ أحمد بن يحيى النجمي',
                },
                {
                    bbox: {
                        height: 167.46802438251527,
                        width: 891.8651859529949,
                        x: 2034.5674057955362,
                        y: 362.8473830025166,
                    },
                    isCentered: true,
                    text: 'بسم اللّٰه الرحمن الرحيم',
                },
                {
                    bbox: {
                        height: 186.40785499413784,
                        width: 3493.1385158311846,
                        x: 733.9307359090458,
                        y: 585.8058043548826,
                    },
                    text: 'إنَّ الحمد لله نحمده ، ونستعينه ، ونستهديه ، ونستغفره ، ونتوب إليه ، ونعوذ بالله من',
                },
                {
                    bbox: {
                        height: 230.70500913688156,
                        width: 3467.9226129669755,
                        x: 760.4787500115895,
                        y: 806.2135947448572,
                    },
                    text: 'شرور أنفسنا ، وسيئات أعمالنا من يهده اللّٰه فلا مضل له ، ومن يضلل فلا هادي له',
                },
                {
                    bbox: {
                        height: 176.7718048606599,
                        width: 3493.138515831184,
                        x: 733.9307323703788,
                        y: 1069.9345915563495,
                    },
                    text: 'وأشهد أن لا إله إلا اللّٰه وحده لا شريك له ، وأشهد أن محمداً عبده ورسوله صلى اللّٰه',
                },
                {
                    bbox: {
                        height: 149.22966269841288,
                        width: 1309.9269434366943,
                        x: 743.220997670503,
                        y: 1320.841269841269,
                    },
                    text: 'عليه وعلى آله وصحبه ، وبعد :',
                },
                {
                    bbox: {
                        height: 176.77179274861766,
                        width: 3455.9774018407857,
                        x: 752.5113124535824,
                        y: 1544.4273321375956,
                    },
                    isPoetic: true,
                    text: 'فقد قرأت كتاب : " دحر افتراءات أهل الزيغ والإرتياب عن دعوة الإمام محمد بن عبد',
                },
                {
                    bbox: {
                        height: 206.4194560013121,
                        width: 3485.5541010470397,
                        x: 742.3657759942398,
                        y: 1762.460961972466,
                    },
                    isPoetic: true,
                    text: 'الوهاب رحمه اللّٰه " فألفيته كتاباً عظيماً لعظمة موضوعه ، وهو الدفاع عن التوحيد وأهل',
                },
                {
                    bbox: {
                        height: 194.6584207254744,
                        width: 3476.302471099873,
                        x: 733.170303845412,
                        y: 2001.810498389462,
                    },
                    isPoetic: true,
                    text: 'التوحيد ، ودعاة التوحيد ، وحماة التوحيد ،والوقوف في وجوه أعداء الدين ومروجي',
                },
                {
                    bbox: {
                        height: 168.28025793650733,
                        width: 3483.8481404700497,
                        x: 733.9308484079311,
                        y: 2260.670634920635,
                    },
                    isPoetic: true,
                    text: 'الضلالة الحاقدين على التوحيد وأهله من صنائع الرفض ، والتصوف ودعاة الزيغ',
                },
                {
                    bbox: {
                        height: 186.1494203484243,
                        width: 3493.138515831184,
                        x: 733.9307328278128,
                        y: 2484.109012507682,
                    },
                    isPoetic: true,
                    text: 'والضلال الذين يريدون أن يظهروا أعظم دعاة التوحيد الذي أحيا اللّٰه به أمماً لا يحصون ،',
                },
                {
                    bbox: {
                        height: 176.95639238471074,
                        width: 3446.6870264796516,
                        x: 752.5114590728763,
                        y: 2725.822671543664,
                    },
                    isPoetic: true,
                    text: 'فعادت بلاد نجد إلى الدين الحق كأنها في عصر الخلفاء الراشدين فأراد هذا الماكر الخبيث',
                },
                {
                    bbox: {
                        height: 177.80555555555492,
                        width: 3483.8481404700497,
                        x: 733.9308672054949,
                        y: 2967.130208333334,
                    },
                    isPoetic: true,
                    text: 'أن يلصق به النحلة الخارجية التكفيرية ، التي انتشرت في هذا العصر بواسطة كتب سيد',
                },
                {
                    bbox: {
                        height: 199.06780365440588,
                        width: 3494.6643102332255,
                        x: 733.1835831957478,
                        y: 3191.5953356526293,
                    },
                    isPoetic: true,
                    text: 'قطب ، واقتنع بهذه الفكرة أقوام لا يحصون من إخوانية وسرورية ، وقطبية ، وجهاد ،',
                },
                {
                    bbox: {
                        height: 177.80555555555563,
                        width: 3474.558152563055,
                        x: 733.9305697120071,
                        y: 3441.8075396825393,
                    },
                    isPoetic: true,
                    text: 'وغيرهم ، ثم نشروها زاعمين أنها هي الحق ، فجاء هذا المالكي ليلصقها بالشيخ محمد',
                },
                {
                    bbox: {
                        height: 205.0012327489397,
                        width: 3476.1056443969183,
                        x: 751.9228827357729,
                        y: 3659.294324705893,
                    },
                    isPoetic: true,
                    text: 'بن عبد الوهاب رحمه اللّٰه ظلماً ، وعدواناً ، وزوراً وبهتاناً فتصدى له الشيخ ربيع بن',
                },
                {
                    bbox: {
                        height: 208.1295310239944,
                        width: 3495.1854360510893,
                        x: 751.5890724240512,
                        y: 3899.268062655428,
                    },
                    isPoetic: true,
                    text: 'هادي المدخلي الذي مارس هذه المعامع من زمن طويل جهاداً في سبيل اللّٰه ، ودحراً',
                },
                {
                    bbox: {
                        height: 167.46802438251527,
                        width: 3474.558152563055,
                        x: 743.2208904046474,
                        y: 4140.18168486291,
                    },
                    isPoetic: true,
                    text: 'لأعداء اللّٰه ، وبياناً لمن انطوى عليه هؤلاء المبتدعة من ضلال زعموه هدىً وغواية',
                },
                {
                    bbox: {
                        height: 186.51861962061116,
                        width: 3502.428891192318,
                        x: 733.9306091306212,
                        y: 4381.636903467543,
                    },
                    text: 'زعموها رشداً ، فهنيئاً له ما قام به من جهاد لصالح الإسلام، دافع به عن السنة المطهرة',
                },
                {
                    bbox: {
                        height: 167.46802438251527,
                        width: 2647.7248192297216,
                        x: 743.2209097781233,
                        y: 4614.6744191577545,
                    },
                    text: '، فجزاه اللّٰه خيراً وبارك فيه ، وأسأل اللّٰه أن يثبتنا وإياه على الحق .',
                },
                {
                    bbox: {
                        height: 158.75496031746047,
                        width: 3465.26777720192,
                        x: 743.2209288002218,
                        y: 4856.314236111111,
                    },
                    isPoetic: true,
                    text: 'فلقد بين وفقه اللّٰه ضلالات سيد قطب ، وانحرافات عبد الرحمن بن عبد الخالق وغلو',
                },
                {
                    bbox: {
                        height: 233.80180399001603,
                        width: 3486.332108959508,
                        x: 732.6672203791618,
                        y: 5063.5107936572895,
                    },
                    isPoetic: true,
                    text: 'الحدادية ، ووقف للخوارج الجدد أصحاب النحلة التكفيرية موقف الناقد الخبير والموجه',
                },
                {
                    bbox: {
                        height: 176.84563987028037,
                        width: 3511.7192665534526,
                        x: 724.6402961960771,
                        y: 5330.99156736074,
                    },
                    text: 'البصير ، فبين ما هم عليه من غواية وضلال ، ثم تصدى لأبي الحسن المصري ثم المأربي ،',
                },
                {
                    bbox: {
                        height: 168.28025793650804,
                        width: 3465.26777720192,
                        x: 752.5112492955445,
                        y: 5572.299107142858,
                    },
                    isPoetic: true,
                    text: 'فبين شطحاته ، وتلبيساته ، وأخيراً بين تمويهات المالكي ، ومكره ، ودجله وخداعه',
                },
            ];

            const avgProseWordDensity = calculateAverageProseDensity(prose, 4961);

            const poetry = prose.filter((p) => isWidePoeticLine(p, 4961, avgProseWordDensity));
            expect(poetry).toBeEmpty();
        });

        it('should not detect any poetry in the body nor footnotes', () => {
            const prose = [
                {
                    bbox: {
                        height: 186,
                        width: 3363,
                        x: 752,
                        y: 74,
                    },
                    text: 'من إقرار الكفار في قوله: (قل من يرزقكم من السماء والأرض أمن يملك السمع',
                },
                {
                    bbox: {
                        height: 158,
                        width: 1505,
                        x: 733,
                        y: 325,
                    },
                    text: 'والأبصار) (يونس: ٣١) وغير ذلك.',
                },
                {
                    bbox: {
                        height: 187,
                        width: 3112,
                        x: 743,
                        y: 566,
                    },
                    text: 'قالوا: القرآن لا يجوز العمل به لنا، ولأمثالنا، ولا بكلام الرسول، ولا بكلام',
                },
                {
                    bbox: {
                        height: 217,
                        width: 1908,
                        x: 732,
                        y: 806,
                    },
                    text: 'المتقدمين، ولا نطيع إلا ما ذكره المتأخرون (١).',
                },
                {
                    bbox: {
                        height: 195,
                        width: 3335,
                        x: 752,
                        y: 1069,
                    },
                    text: 'قلت لهم: أنا أخاصم الحنفي، بكلام المتأخرين من الحنفية، والمالكي، والشافعي،',
                },
                {
                    bbox: {
                        height: 195,
                        width: 3335,
                        x: 724,
                        y: 1311,
                    },
                    text: 'والحنبلي، كلاً: أخاصمه بكتب المتأخرين من علمائهم، الذين يعتمدون عليهم،',
                },
                {
                    bbox: {
                        height: 186,
                        width: 3335,
                        x: 743,
                        y: 1563,
                    },
                    text: 'فلما أبوا ذلك، نقلت كلام العلماء من كل مذهب لأهله، وذكرت كل ما قالوا،',
                },
                {
                    bbox: {
                        height: 176,
                        width: 3428,
                        x: 761,
                        y: 1823,
                    },
                    text: 'بعدما صرحت الدعوة عند القبور، والنذر لها، فعرفوا ذلك، وتحققوه، فلم يزدهم إلا',
                },
                {
                    bbox: {
                        height: 177,
                        width: 334,
                        x: 761,
                        y: 2046,
                    },
                    text: 'نفوراً (٢).',
                },
                {
                    bbox: {
                        height: 177,
                        width: 3344,
                        x: 743,
                        y: 2316,
                    },
                    text: 'وأما التكفير: فأنا أكفر من عرف دين الرسول، ثم بعد ما عرفه سبه، ونهى الناس',
                },
                {
                    bbox: {
                        height: 176,
                        width: 3400,
                        x: 752,
                        y: 2558,
                    },
                    text: 'عنه، وعادى من فعله، فهذا: هو الذي أكفر، وأكثر الأمة - ولله الحمد - ليسوا',
                },
                {
                    bbox: {
                        height: 204,
                        width: 3335,
                        x: 752,
                        y: 2790,
                    },
                    text: 'كذلك(٣)، وأما القتال: فلم نقاتل أحداً إلى اليوم، إلا دون النفس والحرمة، وهم:',
                },
                {
                    bbox: {
                        height: 195,
                        width: 3242,
                        x: 733,
                        y: 3041,
                    },
                    text: 'الذين أتونا في ديارنا، ولا أبقوا ممكناً(٤)، ولكن: قد نقاتل بعضهم، على سبيل',
                },
                {
                    bbox: {
                        height: 158,
                        width: 3279,
                        x: 733,
                        y: 3321,
                    },
                    text: 'المقابلة، وجزاء سيئة سيئة مثلها، وكذلك. من جاهر بسب دين الرسول، بعدما',
                },
                {
                    bbox: {
                        height: 186,
                        width: 3483,
                        x: 752,
                        y: 3554,
                    },
                    text: 'عرف، فإنا نبين لكم: أن هذا هو الحق، الذي لا ريب فيه، وأن الواجب: إشاعته في',
                },
                {
                    bbox: {
                        height: 158,
                        width: 1430,
                        x: 733,
                        y: 3823,
                    },
                    text: 'الناس، وتعليمه النساء، والرجال.',
                },
                {
                    bbox: {
                        height: 149,
                        width: 3158,
                        x: 808,
                        y: 4437,
                    },
                    text: '(١) انظر إلى هذا التمرد والعناد على كتاب اللّٰه وسنة رسوله ومنهج الصحابة العظماء والسلف',
                },
                {
                    bbox: {
                        height: 130,
                        width: 306,
                        x: 733,
                        y: 4642,
                    },
                    text: 'الكرماء.',
                },
                {
                    bbox: {
                        height: 149,
                        width: 3205,
                        x: 780,
                        y: 4837,
                    },
                    text: '(٢) وانظر إلى هذا التمرد والعناد أيضاً حتى على كتب المتأخرين بعد تنزل الإمام محمد معهم إلى',
                },
                {
                    bbox: {
                        height: 140,
                        width: 3353,
                        x: 761,
                        y: 5042,
                    },
                    text: 'هذا المستوى فأي مبالغة في إقناع هؤلاء المتمردين وأي حرص على هدايتهم أي تنزل معهم يفوق هذا',
                },
                {
                    bbox: {
                        height: 158,
                        width: 3446,
                        x: 733,
                        y: 5228,
                    },
                    text: 'الذي قام به الإمام محمد بعد شيخ الإسلام ابن تيمية وتلاميذه ألا بعداً وسحقاً للمعاندين المستكبرين.',
                },
                {
                    bbox: {
                        height: 167,
                        width: 2889,
                        x: 780,
                        y: 5433,
                    },
                    text: '(٣) ولا أظلم ممن يفتري عليه أنه يكفر على طريقة الخوارج وأنه يكفر عموم المسلمين.',
                },
                {
                    bbox: {
                        height: 130,
                        width: 2684,
                        x: 789,
                        y: 5646,
                    },
                    text: '(٤) هل يلام الإمام محمد وأنصاره بعد كل هذا في قتال هؤلاء الضالين المعتدين.',
                },
            ];

            const avgProseWordDensity = calculateAverageProseDensity(prose, 4961);

            const poetry = prose.filter((p) => isWidePoeticLine(p, 4961, avgProseWordDensity));
            expect(poetry).toBeEmpty();
        });
    });
});
