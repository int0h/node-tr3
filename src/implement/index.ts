import {guard} from '../extensions/validate';
import {Api, ResolveApi} from '../api';
import { ResolveType, Type } from '../core';

export function implementFn<T extends Type<(...args: any[]) => any, any>>(type: T, fn: ResolveType<T>): ResolveType<T> {
    return guard(type, fn);
}

export function implementApi<T extends Api>(api: T, implementation: ResolveApi<T>): ResolveApi<T> {
    const res = {} as any;
    for (const key of Object.keys(api)) {
        res[key] = implementFn(api[key], implementation[key]);
    }
    return res;
}
