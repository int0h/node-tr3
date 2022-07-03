import {defType, defGeneric, Type, ResolveType} from '../core'
export {applyExtensions, NativeTypeExtender} from './common';

type ResolveTuple<T extends Array<Type<any, any>>> = {
    [K in keyof T]: T[K] extends Type<any, any> ? ResolveType<T[K]> : T[K];
}

type ResolveFn<T extends Type<any, any>, R extends Type<any, any>> = (...args: ResolveType<T>) => ResolveType<R>;

export const args = <T extends Array<Type<any, any>>>(...args: T) => atomicTypes.tuple(...args);

export const argType = <T extends Type<any, any>>(argItemType: T) => atomicTypes.array<ResolveType<T>>(argItemType);

export const returns = <T extends Type<any, any>>(resultType: T) => {
    return resultType as any as ResolveType<T>;
}

export const resolves = <T extends Type<any, any>>(resultType: T) => {
    const promisified = types.promise(resultType);
    return promisified as any as ResolveType<typeof promisified>;
}

type EnumParam = {
    variantMap: Record<string, number>;
    reverseMap: Map<number, string>;
    allowedStrings: Set<string>;
}

function _enum<T extends string[]>(...variants: T): Type<T[number], EnumParam>;
function _enum<T extends Record<string, number>>(variantMap: T): Type<keyof T, EnumParam>;
function _enum<T>(...variants: any[]): Type<string, EnumParam> {
    if (variants.length === 1 && Object.getPrototypeOf(variants[0]) === Object.prototype) {
        const reverseMap = new Map<number, string>();
        const allowedStrings = new Set(Object.keys(variants[0]));
        for (const k of Object.keys(variants[0])) {
            const variant = variants[0][k];
            if (reverseMap.has(variant)) {
                throw new Error(`Enum duplicate value for ${k}: ${variant}`);
            }
            reverseMap.set(variant, k);
        }
        const variantMap = variants[0] as Record<string, any>;
        return defType<string>().setParam({variantMap, reverseMap, allowedStrings});
    }
    const variantMap: Record<string, number> = {};
    const reverseMap = new Map<number, string>();
    const allowedStrings = new Set(variants);
    variants.forEach((variant, index) => {
        variantMap[variant] = index;
        reverseMap.set(index, variant);
    });
    return defType<string>().setParam({variantMap, reverseMap, allowedStrings});
}

function getUnionPropValue(type: Type<any, any>, prop: string) {
    if (!type.isSubtypeOf(types.object)) {
        throw new Error('unionProp variants must be objects');
    }

    const propValue = type.param.shape[prop];

    if (!type.param.shape[prop] || !type.param.shape[prop].isSubtypeOf(types.literal)) {
        throw new Error('unionProp must be literal');
    }

    return propValue.param.literal;
}

let currentLiteralId = 0;
const literalReverseMap = new Map<any, number>();
const literalMap: {[n: number]: any} = {};

const regLiteral = (literal: any) => {
    const id = currentLiteralId++;
    literalMap[id] = literal;
    literalReverseMap.set(literal, id);
    return id;
};

export const encodeLiteral = (literal: any): number => {
    const id = literalReverseMap.get(literal);
    if (id === undefined) {
        throw new Error('literal not found');
    }
    return id;
}

export const decodeLiteral = (id: number) => {
    if (!Object.prototype.hasOwnProperty.call(literalMap, id)) {
        throw new Error('literal not found');
    }
    return literalMap[id];
}

type NumberMeta = {
    range: [number, number];
    onlyInteger: boolean;
    onlyFinate: boolean;
}

const defaultNumberMeta: NumberMeta = {
    range: [-Infinity, Infinity],
    onlyInteger: false,
    onlyFinate: false,
};

type StringMeta = {
    lengthRange: [number, number];
    format: RegExp | null;
};

const defaultStringMeta: StringMeta = {
    format: null,
    lengthRange: [0, Infinity],
}

const atomicTypes = {
    number: defType<number>().rename('number').setParam<NumberMeta>(defaultNumberMeta),

    string: defType<string>().rename('string').setParam<StringMeta>(defaultStringMeta),

    boolean: defType<boolean>().rename('boolean'),
    bigint: defType<bigint>().rename('bigint'),
    symbol: defType<symbol>().rename('symbol'),
    unknown: defType<unknown>().rename('unknown'),

    array: defGeneric('array', <T>(itemType: Type<T, any>) => defType<T[]>().setParam({itemType})),
    tuple: defGeneric('tuple', <T extends Array<Type<any, any>>>(...items: T) => defType<ResolveTuple<T>>().setParam({items})),
    object: defGeneric('object', <T extends Record<string, Type<any, any>>>(shape: T) => defType<{[key in keyof T]: ResolveType<T[key]>}>().setParam({shape, keys: Object.keys(shape).sort()})),
    record: defGeneric('record', <T>(valueType: Type<T, any>) => defType<Record<string, T>>().setParam({valueType})),

    oneOf: defGeneric('oneOf', <T extends Array<Type<any, any>>>(...variants: T) => defType<ResolveType<T[number]>>().setParam({variants})),

    propUnion: defGeneric('propUnion', <P extends string, T extends Array<Type<any, any>>>(trait: P, variants: T) => {
        const variantMap: Record<number, Type<any, any>> = {};
        variants.forEach(v => {
            const val = getUnionPropValue(v, trait);
            const id = encodeLiteral(val);
            if (variantMap[id]) {
                throw new Error('variant collision');
            }
            variantMap[id] = v;
        });
        return defType<ResolveType<T[number]>>().setParam({variants, trait, variantMap});
    }),

    literal: defGeneric('literal', <T>(literal: T) => defType<T>().setParam({literal, literalId: regLiteral(literal)})),

    instance: defGeneric('instance', <T extends new (...args: any[]) => any>(Class: T) => defType<InstanceType<T>>().setParam({Class})),

    promise: defGeneric('promise', <T extends Type<any, any>>(type: T) => defType<Promise<ResolveType<T>>>().setParam({type})),

    enum: defGeneric('enum', _enum),
}

const functionType = {
    // some TS hacks as TS breaks on this for some reason.
    function: defGeneric('function', <A extends Type<any, any>, R extends Type<any, any>>(args: A, returns: R) => defType<ResolveFn<A, R>>().setParam({
        args: args as any as (Type<any[], {items: Type<any, any>[]}> | Type<any[], {itemType: Type<any, any>[]}>),
        returns,
        isDuplex: false,
    })),

    duplexFunction: defGeneric('duplexFunction', <A extends Type<any, any>, R extends Type<any, any>>(args: A, returns: R) => defType<ResolveFn<A, R>>().setParam({
        args: args as any as (Type<any[], {items: Type<any, any>[]}> | Type<any[], {itemType: Type<any, any>[]}>),
        returns,
        isDuplex: true, // only difference
    })),
};

const nullUndefined = {
    null: atomicTypes.literal(null),
    undefined: atomicTypes.literal(undefined),
}

export const someBasicTypes = {
    ...atomicTypes,
    ...nullUndefined,

    byte: atomicTypes.number.setParam<NumberMeta>({onlyInteger: true, range: [0, 255], onlyFinate: true}).rename('byte'),
    int: atomicTypes.number.setParam<NumberMeta>({onlyInteger: true, range: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], onlyFinate: true}).rename('int'),
    uint: atomicTypes.number.setParam<NumberMeta>({onlyInteger: true, range: [0, Number.MAX_SAFE_INTEGER], onlyFinate: true}).rename('uint'),
    float: atomicTypes.number.setParam<NumberMeta>({onlyInteger: false, range: [-Infinity, Infinity], onlyFinate: true}).rename('float'),

    jsonLike: defType<unknown>(),

    fn: defGeneric('fn', <T extends Type<any, any>, F extends (...args: ResolveType<T>) => any>(args: T, fn: F) => {
        const resultType: Type<ReturnType<F>, Type<any, any>> = (fn as any)();
        const res = functionType.function(args, resultType);
        return res as any as Type<F, {args: Type<any[], {items: Type<any, any>[]}>, returns: Type<any, any>, isDuplex: false}>;
    }),

    duplexFn: defGeneric('duplexFn', <T extends Type<any, any>, F extends (...args: ResolveType<T>) => any>(args: T, fn: F) => {
        const resultType: Type<ReturnType<F>, Type<any, any>> = (fn as any)();
        const res = functionType.duplexFunction(args, resultType); // only difference
        return res as any as Type<F, {args: Type<any[], {items: Type<any, any>[]}>, returns: Type<any, any>, isDuplex: true}>;
    }),

    void: atomicTypes.oneOf(nullUndefined.null, nullUndefined.undefined) as any as Type<void, {literal: void}>,

    opt: defGeneric('opt', <T extends Type<any, any>>(type: T) => atomicTypes.oneOf(nullUndefined.undefined, type).rename('opt')),

    date: atomicTypes.instance(Date),
    regexp: atomicTypes.instance(RegExp),
}
const taMap = {
    Int8Array: (typeof Int8Array !== 'undefined' ? Int8Array : undefined) as typeof Int8Array,
    Uint8Array: (typeof Uint8Array !== 'undefined' ? Uint8Array : undefined) as typeof Uint8Array,
    Uint8ClampedArray: (typeof Uint8ClampedArray !== 'undefined' ? Uint8ClampedArray : undefined) as typeof Uint8ClampedArray,
    Int16Array: (typeof Int16Array !== 'undefined' ? Int16Array : undefined) as typeof Int16Array,
    Uint16Array: (typeof Uint16Array !== 'undefined' ? Uint16Array : undefined) as typeof Uint16Array,
    Int32Array: (typeof Int32Array !== 'undefined' ? Int32Array : undefined) as typeof Int32Array,
    Uint32Array: (typeof Uint32Array !== 'undefined' ? Uint32Array : undefined) as typeof Uint32Array,
    Float32Array: (typeof Float32Array !== 'undefined' ? Float32Array : undefined) as typeof Float32Array,
    Float64Array: (typeof Float64Array !== 'undefined' ? Float64Array : undefined) as typeof Float64Array,
    BigInt64Array: (typeof BigInt64Array !== 'undefined' ? BigInt64Array : undefined) as typeof BigInt64Array,
    BigUint64Array: (typeof BigUint64Array !== 'undefined' ? BigUint64Array : undefined) as typeof BigUint64Array,
};

type TaVariants = keyof typeof taMap;

type ResolveTa<V extends TaVariants> = (typeof taMap)[V];

const binaryTypes = {
    typedArray: defGeneric('typedArray', <V extends TaVariants>(variant: V) => {
        const TypedArrayClass = taMap[variant];
        return defType<InstanceType<ResolveTa<V>>>().setParam({TypedArrayClass, variant});
    }),

    arrayBuffer: defType<ArrayBuffer>().rename('arrayBuffer').setParam({}),
};

export const types = {
    ...someBasicTypes,
    ...functionType,
    ...binaryTypes,

    partial: defGeneric('partial', <T extends Type<Record<string, any>, {shape: any}>>(targetType: T): Type<Partial<ResolveType<T>>, {shape: Type<any, any>}> => {
        const shape = {} as any;
        for (const key of Object.keys(targetType.param.shape)) {
            shape[key] = someBasicTypes.opt(targetType.param.shape[key]);
        }
        return someBasicTypes.object(shape) as any;
    })
}
