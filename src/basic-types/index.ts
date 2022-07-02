import {defType, defGeneric, Type, ResolveType} from '../core'

type ResolveTuple<T extends Array<Type<any, any>>> = {
    [K in keyof T]: T[K] extends Type<any, any> ? ResolveType<T[K]> : T[K];
}

type ResolveFn<T extends Array<Type<any, any>>, R extends Type<any, any>> = (...args: ResolveTuple<T>) => ResolveType<R>;

export const args = <T extends Array<Type<any, any>>>(...args: T) => args;

export const returns = <T extends Type<any, any>>(resultType: T) => {
    return resultType as any as ResolveType<T>;
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

type NumberMeta = {
    range: [number, number];
    onlyInteger: boolean;
    onlyFinite: boolean;
}

const defaultNumberMeta: NumberMeta = {
    range: [-Infinity, Infinity],
    onlyInteger: false,
    onlyFinite: false,
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

    literal: defGeneric('literal', <T>(literal: T) => defType<T>().setParam({literal})),

    instance: defGeneric('instance', <T extends new (...args: any[]) => any>(Class: T) => defType<InstanceType<T>>().setParam({Class})),

    promise: defGeneric('promise', <T extends Type<any, any>>(type: T) => defType<Promise<ResolveType<T>>>().setParam({type})),

    enum: defGeneric('enum', _enum),
}

const functionType = {
    // some TS hacks as TS breaks on this for some reason.
    function: defGeneric('function', <A extends Array<Type<any, any>>, R extends Type<any, any>>(args: A, returns: R) => defType<ResolveFn<A, R>>().setParam({args: atomicTypes.tuple(...args) as any as Type<any[], {items: Type<any, any>[]}>, returns})),
};

const nullUndefined = {
    null: atomicTypes.literal(null),
    undefined: atomicTypes.literal(undefined),
}

export const someBasicTypes = {
    ...atomicTypes,
    ...nullUndefined,

    byte: atomicTypes.number.setParam<NumberMeta>({onlyInteger: true, range: [0, 255], onlyFinite: true}).rename('byte'),
    int: atomicTypes.number.setParam<NumberMeta>({onlyInteger: true, range: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], onlyFinite: true}).rename('int'),
    uint: atomicTypes.number.setParam<NumberMeta>({onlyInteger: true, range: [0, Number.MAX_SAFE_INTEGER], onlyFinite: true}).rename('uint'),
    float: atomicTypes.number.setParam<NumberMeta>({onlyInteger: false, range: [-Infinity, Infinity], onlyFinite: true}).rename('float'),

    jsonLike: defType<unknown>(),

    fn: defGeneric('function', <T extends Array<Type<any, any>>, F extends (...args: ResolveTuple<T>) => any>(args: T, fn: F) => {
        const resultType: Type<ReturnType<F>, unknown> = (fn as any)();
        const res = functionType.function(args, resultType);
        return res as any as Type<F, {args: Type<any[], {items: Type<any, any>[]}>, returns: unknown}>;
    }),

    void: atomicTypes.oneOf(nullUndefined.null, nullUndefined.undefined) as any as Type<void, {literal: void}>,

    opt: defGeneric('opt', <T extends Type<any, any>>(type: T) => atomicTypes.oneOf(nullUndefined.undefined, type).rename('opt')),

    date: atomicTypes.instance(Date),
    regexp: atomicTypes.instance(RegExp),
}

export const basicTypes = {
    ...someBasicTypes,
    ...functionType,

    partial: defGeneric('partial', <T extends Type<Record<string, any>, {shape: any}>>(targetType: T): Type<Partial<ResolveType<T>>, {shape: Type<any, any>}> => {
        const shape = {} as any;
        for (const key of Object.keys(targetType.param.shape)) {
            shape[key] = someBasicTypes.opt(targetType.param.shape[key]);
        }
        return someBasicTypes.object(shape) as any;
    })
}
