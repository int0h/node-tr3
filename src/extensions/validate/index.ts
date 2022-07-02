import {ResolveType, Type, defineExtensionMethod, GenericType, NormType, extendMeta} from '../../core';

const validateNamespaceSymbol = Symbol('validateNamespaceSymbol');

type ValidatorParams = {earlyReturn?: boolean};

type Validator<T extends Type<any, any>> = (type: T, value: ResolveType<T>, parmas: ValidatorParams) => Error[];

type Guardian<T extends Type<any, any>> = (type: T, value: ResolveType<T>) => ResolveType<T>;

type MetaData = {
    validator: Validator<any>;
    guardian: Guardian<any>;
}

declare module '../../core/' {
    export interface Meta {
        [validateNamespaceSymbol]?: MetaData;
    }

    export interface Methods {
        setValidator: typeof setValidator;
        setGuardian: typeof setGuardian;
    }
}

const classValidators = new WeakMap<any, (instance: any) => Error[]>();

export function defineClassValidator<T extends new (...args: any[]) => any>(Class: T, validator: (instance: InstanceType<T>) => Error[]) {
    const found = classValidators.get(Class);
    if (found) {
        throw new Error(`There is already a validator for class ${Class}`);
    }
    classValidators.set(Class, validator);
}

export function validateInstance<T extends new (...args: any[]) => any>(Class: T, instance: InstanceType<T>): Error[] {
    if (!((instance as any) instanceof Class)) {
        return [new Error(`${instance} is not instance of ${Class}`)];
    }
    const found = classValidators.get(Class);
    if (found) {
        return found(instance);
    }
    return [];
}

defineExtensionMethod('setValidator', setValidator);
defineExtensionMethod('setGuardian', setGuardian);

function setValidator<T extends Type<any, any> | GenericType<any>, S>(this: T, validator: Validator<NormType<T>>): T {
    return extendMeta(this, validateNamespaceSymbol, {
        ...this.getMeta()[validateNamespaceSymbol],
        validator,
    });
}

function setGuardian<T extends Type<any, any> | GenericType<any>, S>(this: T, guardian: Guardian<NormType<T>>): T {
    return extendMeta(this, validateNamespaceSymbol, {
        ...this.getMeta()[validateNamespaceSymbol],
        guardian
    });
}

export function guard<T extends Type<any, any>>(type: T, value: ResolveType<T>): ResolveType<T> {
    const meta = type.getMeta()[validateNamespaceSymbol];
    if (!meta) {
        throw new Error(`No validator/guardian set up for type ${type.typeName}`);
    }
    return meta.guardian(type, value) as any;
}

export function validateData<T extends Type<any, any>>(type: T, data: ResolveType<T>, params: ValidatorParams = {}): Error[] {
    const meta = type.getMeta()[validateNamespaceSymbol];
    if (!meta) {
        throw new Error(`No validator/guardian set up for type ${type.typeName}`);
    }
    return meta.validator(type, data, params);
}
