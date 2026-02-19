declare module 'json-diff' {
  export interface DiffOptions {
    color?: boolean;
    full?: boolean;
    keysOnly?: boolean;
    sort?: boolean;
    outputKeys?: string;
    excludeKeys?: string;
    keepUnchangedValues?: boolean;
    outputNewOnly?: boolean;
    maxElisions?: number;
    precision?: number;
  }

  export function diffString(obj1: unknown, obj2: unknown, options?: DiffOptions): string;
  export function diff(obj1: unknown, obj2: unknown, options?: DiffOptions): unknown;
}
