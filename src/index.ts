export type Observation = {
    readonly bbox: BoundingBox;
    readonly text: string;
};

type BoundingBox = {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
};

export const mapObservationsToParagraphs = (observations: Observation[]) => {
    observations.map((o) => ({ ...o, bbox: { ...o.bbox, x: o.bbox.x } }));
};
