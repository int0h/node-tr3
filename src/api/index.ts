import { ResolveType, Type } from '../core';

export type Api = Record<string, Type<(...args: any[]) => any, {args: Type<any[], any>, returns: any}>>;

export type AsyncApi = Record<string, Type<(...args: any[]) => Promise<any>, {args: Type<any[], any>, returns: any}>>;

export type ResolveApi<T extends Api> = {
    [K in keyof T]: ResolveType<T[K]>;
}