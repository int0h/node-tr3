import {ResolveType, Type, defineExtensionMethod, NormType, extendMeta} from '../../../core/';

const transformNamespaceSymbol = Symbol('transformNamespaceSymbol');

type MetaData<F extends Type<any, any>, T extends Type<any, any>> = {
    targetType: T;
    transformTo: (value: ResolveType<F>) => ResolveType<T>;
    transformFrom: (value: ResolveType<T>) => ResolveType<F>;
}

declare module '../../../core/' {
    export interface Meta {
        [transformNamespaceSymbol]?: MetaData<any, any>;
    }

    export interface Methods {
        transformEncoder: typeof transformEncoder;
    }
}

defineExtensionMethod('transformEncoder', transformEncoder);

function transformEncoder<T extends Type<any, any>, R extends Type<any, any>>(this: T, toType: R, transformTo: (data: ResolveType<T>) => ResolveType<R>, transformFrom: (data: ResolveType<R>) => ResolveType<T>): T {
    const meta: MetaData<T, R> = {
        targetType: toType,
        transformTo,
        transformFrom,
    };
    return extendMeta(this, transformNamespaceSymbol, meta);
}

export function encodeTransform<T extends Type<any, any>>(type: T, value: ResolveType<T>): unknown {
    const meta = type.getMeta()[transformNamespaceSymbol];
    if (!meta) {
        return value;
    }
    return meta.transformTo(value);
}

export function decodeTransform<T extends Type<any, any>>(type: T, encoded: unknown): ResolveType<T> {
    const meta = type.getMeta()[transformNamespaceSymbol];
    if (!meta) {
        return encoded as any;
    }
    return meta.transformFrom(encoded) as any;
}

export function getTransformType(type: Type<any, any>): Type<any, any> | null {
    const meta = type.getMeta()[transformNamespaceSymbol];
    if (!meta) {
        return null;
    }
    return meta.targetType;
}


