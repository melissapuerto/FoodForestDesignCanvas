declare module 'rbush' {
  export type BBox = { minX: number; minY: number; maxX: number; maxY: number };
  export default class RBush<T extends BBox = BBox> {
    insert(item: T): this;
    load(items: T[]): this;
    remove(item: T, equalsFn?: (a: T, b: T) => boolean): this;
    clear(): this;
    search(box: BBox): T[];
    all(): T[];
    collides(box: BBox): boolean;
    toJSON(): unknown;
    fromJSON(data: unknown): this;
  }
}
