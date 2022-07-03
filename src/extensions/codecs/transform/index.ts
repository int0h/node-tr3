import {ResolveType, Type, definfeExtensionMethod, NormType, extendMeta, GenericType, getTypeMeta} from '../../../core';

const transformNamespaceSymbol = Symbol('transformNamespaceSymbol');

type MetaData<F extends Type<any, any>, T extends Type<any, any>> = {
    targetType: T;
    transformTo: (sourceType: F, value: ResolveType<F>) => ResolveType<T>;
    transformFrom: (sourceType: F, value: ResolveType<T>) => ResolveType<F>;
}

function getMeta(type: Type<any, any> | GenericType<any>): MetaData<any, any> | undefined {
    return getTypeMeta(type)[transformNamespaceSymbol];
}

export type TransformCodec<S extends Type<any, any>, T extends Type<any, any>> = {
    targetType: T;
    transformTo: (sourceType: NormType<T>, data: ResolveType<S>) => ResolveType<T>;
    transformFrom: (sourceType: NormType<T>, data: ResolveType<T>) => ResolveType<S>
}

export function setTransformCodec<T extends Type<any, any> | GenericType<any>, R extends Type<any, any>>(type: T, transformCodec: TransformCodec<NormType<T>, R>): T;
export function setTransformCodec<T extends Type<any, any> | GenericType<any>, R extends Type<any, any>>(type: T, toType: R, transformTo: (sourceType: NormType<T>, data: ResolveType<T>) => ResolveType<R>, transformFrom: (sourceType: NormType<T>, data: ResolveType<R>) => ResolveType<T>): T;
export function setTransformCodec<T extends Type<any, any> | GenericType<any>, R extends Type<any, any>>(type: T, ...args: any[]): T {
    const meta: MetaData<NormType<T>, R> = args.length === 1
        ? {
            targetType: (args[0] as TransformCodec<NormType<T>, R>).targetType,
            transformTo: (args[0] as TransformCodec<NormType<T>, R>).transformTo,
            transformFrom: (args[0] as TransformCodec<NormType<T>, R>).transformFrom,
        }
        : {
            targetType: args[0],
            transformTo: args[1],
            transformFrom: args[2],
        };
    return extendMeta(type, transformNamespaceSymbol, meta);
}

export function encodeTransform<T extends Type<any, any>>(type: T, value: ResolveType<T>): unknown {
    const meta = getMeta(type);
    if (!meta) {
        return value;
    }
    return meta.transformTo(type, value);
}

export function decodeTransform<T extends Type<any, any>>(type: T, encoded: unknown): ResolveType<T> {
    const meta = getMeta(type);
    if (!meta) {
        return encoded as any;
    }
    return meta.transformFrom(type, encoded) as any;
}

export function getTransformType(type: Type<any, any>): Type<any, any> | null {
    const meta = getMeta(type);
    if (!meta) {
        return null;
    }
    return meta.targetType;
}


