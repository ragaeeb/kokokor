import { describe, expect, it } from 'bun:test';

import { DEFAULT_POETRY_OPTIONS } from './constants';
import { calculateAverageProseDensity, isPoeticGroup } from './poetry';

describe('poetry', () => {
    const createObservation = (text: string, x: number, y: number, width: number, height: number = 20) => ({
        bbox: { height, width, x, y },
        text,
    });

    const defaultPoetryOptions = {
        centerToleranceRatio: 0.05,
        maxVerticalGapRatio: 2.0,
        minMarginRatio: 0.1,
        minWidthRatioForMerged: 0.6,
        minWordCount: 2,
        pairWidthSimilarityRatio: 0.4,
        pairWordCountSimilarityRatio: 0.5,
        wordDensityComparisonRatio: 0.95,
    };

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

    describe('isPoeticGroup', () => {
        const avgProseWordDensity = 0.02;

        describe('single observation groups', () => {
            it('should reject single observation with insufficient width', () => {
                const group = [
                    // Too narrow (less than 60% of image width = 600)
                    createObservation('Short poetic line', 400, 100, 500),
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
                expect(result).toBe(false);
            });

            it('should reject single observation that is not centered', () => {
                const group = [
                    // Not centered (left-aligned)
                    createObservation('A poetic line with spacing', 50, 100, 600),
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
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

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
                expect(result).toBe(false);
            });

            it('should reject single observation with too few words', () => {
                const group = [
                    createObservation('One', 400, 100, 600), // Only 1 word, less than minWordCount of 2
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
                expect(result).toBe(false);
            });

            it('should handle zero word density gracefully', () => {
                const group = [
                    createObservation('Poetry line', 300, 100, 600), // 2 words
                ];

                // Test with avgProseWordDensity = 0
                const result = isPoeticGroup(group, imageWidth, 0, defaultPoetryOptions);
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
                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
                expect(result).toBe(true);
            });

            it('should reject poetry pair with dissimilar widths', () => {
                const group = [
                    createObservation('Short line', 400, 100, 100), // 2 words, width 100
                    createObservation('Much longer line with more words', 300, 100, 400), // 6 words, width 400
                ];

                // Width difference ratio: |100-400|/((100+400)/2) = 300/250 = 1.2, which is > 0.4
                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
                expect(result).toBe(false);
            });

            it('should reject poetry pair with dissimilar word counts', () => {
                const group = [
                    createObservation('Two words', 400, 100, 150), // 2 words
                    createObservation('Many many many many many many words here', 380, 100, 160), // 8 words
                ];

                // Word count difference ratio: |2-8|/max(2,8) = 6/8 = 0.75, which is > 0.5
                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
                expect(result).toBe(false);
            });

            it('should reject poetry pair that is not centered when combined', () => {
                const group = [
                    createObservation('Left side text', 50, 100, 150), // Far left
                    createObservation('More left text', 250, 100, 160), // Still left side
                ];

                // Combined would not be centered
                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
                expect(result).toBe(false);
            });

            it('should reject poetry pair when first observation has too few words', () => {
                const group = [
                    createObservation('One', 400, 100, 150), // 1 word, less than minWordCount
                    createObservation('Two words here', 380, 100, 160), // 3 words
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
                expect(result).toBe(false);
            });

            it('should reject poetry pair when second observation has too few words', () => {
                const group = [
                    createObservation('Two words here', 400, 100, 150), // 3 words
                    createObservation('One', 380, 100, 160), // 1 word, less than minWordCount
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
                expect(result).toBe(false);
            });

            it('should handle edge case where combined bbox calculation spans different positions', () => {
                const group = [
                    createObservation('Right side first', 600, 100, 150), // Starts at 600, ends at 750
                    createObservation('Left side second', 250, 100, 160), // Starts at 250, ends at 410
                ];

                // Combined bbox: leftX = min(600, 250) = 250, rightmost = max(750, 410) = 750
                // Width = 750 - 250 = 500, center = 250 + 500/2 = 500 (exactly image center)
                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
                expect(result).toBe(true);
            });
        });

        describe('edge cases with different poetry options', () => {
            it('should work with stricter centering tolerance', () => {
                const strictOptions = {
                    ...defaultPoetryOptions,
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
                    ...defaultPoetryOptions,
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
                    ...defaultPoetryOptions,
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

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
                expect(result).toBe(false);
            });

            it('should reject groups with four observations', () => {
                const group = [
                    createObservation('First line', 400, 100, 150),
                    createObservation('Second line', 380, 120, 160),
                    createObservation('Third line', 390, 140, 155),
                    createObservation('Fourth line', 385, 160, 165),
                ];

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
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

                const result = isPoeticGroup(group, imageWidth, avgProseWordDensity, defaultPoetryOptions);
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
});
