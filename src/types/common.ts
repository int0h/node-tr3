import {types} from './';

export type NativeTypeExtender = (t: typeof types) => typeof types;

export function applyExtensions(exts: NativeTypeExtender[]): typeof types {
    let res = types;
    for (const ext of exts) {
        res = ext(res);
    }
    return res;
}
