export interface Meta {};

export interface Methods {}

const methods: Methods = {} as any;


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


type TypeCore = {
    selfMeta: Meta;
    parents: AnyType[];
    typeName: string | undefined;
};

type HelperMethods = {
    getMeta: () => Meta;
    clone: <T>(this: T, name?: string) => T;
    rename: <T>(this: T, name: string) => T,
    isSubtypeOf: (type: GenericType<any>) => boolean;
    refine: <T extends Type<any, object>>(this: T, param: T extends Type<any, infer P> ? Partial<P> : never) => T;
    extend: <T>(this: T, fn: (type: T) => any) => T;
}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

export type Type<T, P> = Methods & TypeCore & HelperMethods & {
    param: P;
    _: T;
    setParam: <N>(param: N) => Type<T, N>;
};


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


type AnyTypeCreator = (...args: any[]) => Type<any, any>;

type GenericExtra = Methods & TypeCore & HelperMethods;

export type GenericType<T extends Type<any, any>> = GenericExtra & {
    (...args: any[]): T;
}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

type AnyType = Type<any, any> | GenericType<any>;

export type NormType<T extends AnyType> = T extends Type<any, any>
    ? T
    : T extends GenericType<infer R>
        ? R
        : never;


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


function cloneFn<F extends (...args: any[]) => any>(fn: F): F {
    return function(this: any, ...args: any[]): any {
        return fn.apply(this, args);
    } as any;
}

function cloneType<T>(obj: T): T {
    if (typeof obj === 'function') {
        const type: GenericType<any> = obj as any;
        const clone = cloneFn(obj as any) as GenericType<any>;
        clone.selfMeta = {} as any;
        clone.parents = [...type.parents, type];
        clone.typeName = type.typeName;
        return enhanceType(clone as any) as any;
    }
    const type: Type<any, any> = obj as any;
    const core = {
        _: null,
        param: type.param,
        selfMeta: {},
        parents: [...type.parents, type],
        typeName: type.typeName,
    };
    return enhanceType(core) as any;
}

/** mutable! */
function enhanceType(target: any): any {
    const extras = {
        setParam<T, P>(this: Type<T, any>, param: P): Type<T, P> {
            const clone = this.clone();
            clone.param = param;
            return clone;
        },

        refine<T, P>(this: Type<T, any>, param: P): Type<T, P> {
            const clone = this.clone();
            clone.param = {...clone.param, ...param};
            return clone;
        },

        extend<T extends Type<any, any> | GenericType<any>>(this: T, fn: (type: T) => any): T {
            // const clone = this.clone();
            fn(this);
            return this;
        },

        clone<T extends AnyType>(this: T, name?: string): T {
            const newType = cloneType(this);
            newType.typeName = name ? name : newType.typeName;
            return newType;
        },

        getMeta(this: AnyType) {
            const metaChain = [...this.parents.map(p => p.getMeta()), this.selfMeta];
            const res = {} as any;
            for (const meta of metaChain) {
                Object.assign(res, meta);
            }
            return res;
        },

        rename<T extends AnyType>(this: T, name: string): T {
            const clone = this.clone();
            clone.typeName = name;
            return clone;
        },

        isSubtypeOf(this: AnyType, ofType: AnyType): boolean {
            return this.parents.includes(ofType);
        }
    };
    Object.assign(target, methods, extras);
    return target;
}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


export function definfeExtensionMethod<K extends keyof Methods>(name: K, method: Methods[K]) {
    methods[name] = method;
}

export type ResolveType<T extends Type<any, any> | GenericType<any>> = T extends Type<infer R, any>
    ? R
    : T extends (...args: any[]) => Type<infer R, any>
        ? R
        : never;

export function defType<T>(): Type<T, undefined> {
    const core: TypeCore = {
        selfMeta: {},
        parents: [],
        typeName: undefined,
    };
    const extra: any = {
        param: undefined,
        _: null,
    };
    const res = {...core, ...extra};
    enhanceType(res);
    return res;
}

export const defGeneric = <TC extends AnyTypeCreator>(name: string, tc: TC): TC & GenericExtra => {
    const fn: any = (...args: any[]) => {
        const type = tc(...args) as Type<any, any>;
        type.typeName = type.typeName ?? fn.typeName;
        type.parents = [...fn.parents, ...type.parents, fn];
        return type;
    };
    const core: TypeCore = {
        parents: [],
        selfMeta: {},
        typeName: name,
    };
    Object.assign(fn, core);
    enhanceType(fn);
    return fn;
};

export function getTypeMeta(type: Type<any, any> | GenericType<any>): any {
    return type.getMeta();
}

/** immutable */
// export function extendMeta<T extends (Type<any, any> | GenericType<any>)>(type: T, newKey: string | symbol, value: unknown): T {
//     if (typeof type === 'function') {
//         const generic: GenericType<any> = type;
//         const newFn: any = function(this: any, ...args: any[]) {
//             const res = generic.apply(this, args);
//             return {
//                 typeName: newFn.typeName,
//                 ...res,
//                 get meta() {
//                     return {
//                         ...newFn.meta,
//                         ...res.meta,
//                     }
//                 },
//                 genericChain: [...res.genericChain.slice(0, -1), newFn],
//             }
//         };
//         newFn.typeName = generic.typeName;
//         newFn.meta = {
//             ...generic.meta,
//             [newKey]: value,
//         }
//         Object.assign(newFn, methods);
//         return newFn;
//     } else {
//         return {
//             ...type,
//             meta: {
//                 ...type.meta,
//                 [newKey]: value,
//             },
//         };
//     }
// }

/** mutable */
export function extendMeta<T extends (Type<any, any> | GenericType<any>)>(type: T, newKey: string | symbol, value: unknown): T {
    (type.selfMeta as any)[newKey] = value;
    return type;
}
