import { ResolveType, Type } from '../core';
import { Context } from './context';

export type AsyncMethodType = Type<(...args: any[]) => Promise<any>, {args: Type<any[], any>, returns: Type<any, any>, isDuplex: boolean}>;

export type Api = Record<string, Type<(...args: any[]) => any, {args: Type<any[], any>, returns: any, isDuplex: boolean}>>;

export type AsyncApi = Record<string, AsyncMethodType>;

export type ResolveApi<T extends Api> = {
    [K in keyof T]: ResolveType<T[K]>;
}

export type ResolveCurryApi<T extends Api> = {
    [K in keyof T]: (ctx: Context) => ResolveType<T[K]>;
}
