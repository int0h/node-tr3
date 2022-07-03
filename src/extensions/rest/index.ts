import {Type, definfeExtensionMethod, extendMeta, getTypeMeta, GenericType} from '../../core';

const restNamespaceSymbol = Symbol('restNamespaceSymbol');

type PathParser<T> = {
    serialize: (data: T) => string;
    parse: (str: string) => T;
}

export const pathParser = <T>(parse: PathParser<T>['parse'], serialize: PathParser<T>['serialize']) => {
    return {parse, serialize};
}

type Methods = 'get' | 'head' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace' | 'patch';

type ArgsHttpTransport = {
    body?: string;
    params?: Record<string, string>;
    query?: Record<string, string>;
    contentType?: string;
};

type ResponseHttpTransport = {
    contentType?: string;
    text: string;
}

type ResolveArgs<T> = T extends Type<(...args: infer I) => any, any> ? I : never;
type ResolveResponse<T> = T extends Type<(...args: any[]) => Promise<infer R>, any> ? R : never;

export type ArgsCodec<T> = {
    encode: (args: ResolveArgs<T>, type: Type<any, any>) => ArgsHttpTransport;
    decode: (data: ArgsHttpTransport, type: Type<any, any>) => ResolveArgs<T>;
};

export type ResponseCodec<T> = {
    encode: (res: ResolveResponse<T>, type: Type<any, any>) => ResponseHttpTransport;
    decode: (body: ResponseHttpTransport, type: Type<any, any>) => ResolveResponse<T>;
};

export type RestCfg<T> = {
    path: string;
    method: Methods;
    // body?: 'string' | 'json';
    argsCodec?: ArgsCodec<T>,
    responseCodec?: ResponseCodec<T>;
}

type MetaData = RestCfg<any>;

function getMeta(type: Type<any, any> | GenericType<any>): MetaData | undefined {
    return getTypeMeta(type)[restNamespaceSymbol];
}

// type ResolveReturnType<T extends Type<(...args: any) => Promise<any>, any>> = T extends Type<(...args: any) => Promise<infer I>, any> ? I : never;

// it breaks the types of t.fn(...).configureRest(...)
// becuase of argsCodecs and responseCodecs.
// That's why there is C here.
export function configireRest<T extends Type<(...args: any) => Promise<any>, any>, C extends T>(type: T, cfg: RestCfg<C>): T {
    return extendMeta(type, restNamespaceSymbol, cfg);
}

export function getRestCfg<T extends Type<(...args: any) => Promise<any>, any>>(type: T): RestCfg<any> {
    const found = getMeta(type);
    if (!found) {
        throw new Error(`no REST config found for ${type}`);
    }
    return found as any;
}