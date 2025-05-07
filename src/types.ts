export type Observation = {
    readonly bbox: BoundingBox;
    readonly text: string;
};

export type OcrResult = {
    readonly height: number;
    readonly observations: Observation[];
    readonly width: number;
};

type BoundingBox = {
    readonly height: number;
    readonly width: number;
    x: number;
    y: number;
};
