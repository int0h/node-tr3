import {Type, GenericType, NormType, extendMeta, getTypeMeta} from '../../core';

const traverseNamespaceSymbol = Symbol('traverseNamespaceSymbol');

type TypeTraverser<T extends Type<any, any>> = (type: T, fn: (subType: Type<any, any>, key: string) => void) => void;

type TypeMapper<T extends Type<any, any>> = (type: T, fn: (subType: Type<any, any>, key: string) => Type<any, any>) => Type<any, any>;

const defaultTypeTraverser: TypeTraverser<Type<any, any>> = (type, fn) => {
    return;
}

const defaultTypeMapper: TypeMapper<Type<any, any>> = (type, fn) => {
    return type;
}

type DataTraverser = (...args: any[]) => any;

type MetaData = {
    traverseType: TypeTraverser<Type<any, any>>;
    mapType: TypeMapper<Type<any, any>>;
    traverseData: DataTraverser;
}

function getMeta(type: Type<any, any> | GenericType<any>): MetaData | undefined {
    return getTypeMeta(type)[traverseNamespaceSymbol];
}

export function setTypeTraverser<T extends Type<any, any> | GenericType<any>>(type: T, traverseType: TypeTraverser<NormType<T>>): T {
    return extendMeta(type, traverseNamespaceSymbol, {
        ...getMeta(type),
        traverseType,
    });
}

export function setTypeMapper<T extends Type<any, any> | GenericType<any>>(type: T, mapType: TypeMapper<NormType<T>>): T {
    return extendMeta(type, traverseNamespaceSymbol, {
        ...getMeta(type),
        mapType,
    });
}

export function traverseType(type: Type<any, any>, fn: (subType: Type<any, any>, key: string) => void) {
    const meta = getMeta(type);
    const traverser = meta?.traverseType ?? defaultTypeTraverser;
    traverser(type, fn);
}

export function mapType(type: Type<any, any>, fn: (subType: Type<any, any>, key: string) => Type<any, any>): Type<any, any> {
    const cloned = type.clone();
    const meta = getMeta(cloned);
    const mapper = meta?.mapType ?? defaultTypeMapper;
    return mapper(cloned, fn);
}
