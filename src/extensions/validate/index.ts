import {ResolveType, Type, definfeExtensionMethod, GenericType, NormType, extendMeta, getTypeMeta} from '../../core';

const validateNamespaceSymbol = Symbol('validateNamespaceSymbol');

type ValidatorParams = {earlyReturn?: boolean};

type Validator<T extends Type<any, any>> = (type: T, value: ResolveType<T>, parmas: ValidatorParams) => Error[];

export type Guardian<T extends Type<any, any>> = (type: T, value: ResolveType<T>) => ResolveType<T>;

type MetaData = {
    validator: Validator<any>;
    guardian: Guardian<any>;
}

function getMeta(type: Type<any, any> | GenericType<any>): MetaData | undefined {
    return getTypeMeta(type)[validateNamespaceSymbol];
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

export function setValidator<T extends Type<any, any> | GenericType<any>, S>(type: T, validator: Validator<NormType<T>>): T {
    return extendMeta(type, validateNamespaceSymbol, {
        ...getMeta(type),
        validator,
    });
}

export function setGuardian<T extends Type<any, any> | GenericType<any>, S>(type: T, guardian: Guardian<NormType<T>>): T {
    return extendMeta(type, validateNamespaceSymbol, {
        ...getMeta(type),
        guardian
    });
}

export function guard<T extends Type<any, any>>(type: T, value: ResolveType<T>): ResolveType<T> {
    const meta = getMeta(type);
    if (!meta) {
        throw new Error(`No validator/guardian set up for type ${type.typeName}`);
    }
    return meta.guardian(type, value) as any;
}

export function validateData<T extends Type<any, any>>(type: T, data: ResolveType<T>, params: ValidatorParams = {}): Error[] {
    const meta = getMeta(type);
    if (!meta) {
        throw new Error(`No validator/guardian set up for type ${type.typeName}`);
    }
    return meta.validator(type, data, params);
}
