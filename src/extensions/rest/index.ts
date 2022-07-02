import {Type, defineExtensionMethod, extendMeta} from '../../core';

const restNamespaceSymbol = Symbol('restNamespaceSymbol');

type PathParser<T> = {
    serialize: (data: T) => string;
    parse: (str: string) => T;
}

export const pathParser = <T>(parse: PathParser<T>['parse'], serialize: PathParser<T>['serialize']) => {
    return {parse, serialize};
}

type RestCfg = {
    path: string;
    method: 'get' | 'head' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace' | 'patch';
    body?: 'json';
}

type MetaData = RestCfg;

declare module '../../core/' {
    export interface Meta {
        [restNamespaceSymbol]?: MetaData;
    }

    export interface Methods {
        configureRest: typeof configureRest;
    }
}

defineExtensionMethod('configureRest', configureRest);

type ResolveReturnType<T extends Type<(...args: any) => Promise<any>, any>> = T extends Type<(...args: any) => Promise<infer I>, any> ? I : never;

function configureRest<T extends Type<(...args: any) => Promise<any>, any>>(this: T, cfg: RestCfg): T {
    return extendMeta(this, restNamespaceSymbol, cfg);
}

export function getRestCfg<T extends Type<(...args: any) => Promise<any>, any>>(type: T): RestCfg {
    const found = type.getMeta()[restNamespaceSymbol];
    if (!found) {
        throw new Error(`no REST config found for ${type}`);
    }
    return found as any;
}
