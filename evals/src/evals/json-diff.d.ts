declare module 'json-diff' {
  export interface DiffOptions {
    color?: boolean;
    full?: boolean;
    sort?: boolean;
    keysOnly?: boolean;
    outputKeys?: string | string[];
    outputNewOnly?: boolean;
    excludeKeys?: string | string[];
    keepUnchangedValues?: boolean;
    precision?: number;
    maxElisions?: number;
  }

  export function diff(obj1: unknown, obj2: unknown, options?: DiffOptions): unknown;
  export function diffString(obj1: unknown, obj2: unknown, options?: DiffOptions): string;
}
