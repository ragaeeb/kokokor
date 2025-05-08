export type Observation = {
    readonly bbox: BoundingBox;
    readonly text: string;
};

export type OcrResult = {
    readonly dpi: BoundingBox;
    readonly horizontalLines?: BoundingBox[];
    readonly observations: Observation[];
};

type BoundingBox = {
    readonly height: number;
    readonly width: number;
    x: number;
    y: number;
};
