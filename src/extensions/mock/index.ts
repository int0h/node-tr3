import { Api, ResolveApi, ResolveCurryApi } from '../../api';
import {ResolveType, Type, GenericType, NormType, extendMeta, getTypeMeta} from '../../core';

const mockNamespaceSymbol = Symbol('mockNamespaceSymbol');

type Strategy = 'basic' | 'random' | 'stress' | 'vulnerability-test';

type MockerParams = {
    strategy: Strategy;
    indexer: () => number;
}

export type Mocker<T extends Type<any, any>> = (type: T, params: MockerParams) => ResolveType<T>;

type MetaData = {
    mockers: Record<Strategy, Mocker<any>>;
}

const classMockers = new WeakMap<any, (params: MockerParams) => any>();

export function defineClassMocker<T extends new (...args: any[]) => any>(Class: T, mocker: (params: MockerParams) => InstanceType<T>) {
    const found = classMockers.get(Class);
    if (found) {
        throw new Error(`There is already a mocker for class ${Class}`);
    }
    classMockers.set(Class, mocker);
}

export function mockInstance<T extends new (...args: any[]) => any>(Class: T, params: MockerParams): InstanceType<T> {
    const found = classMockers.get(Class);
    if (!found) {
        throw new Error(`There is no mocker for class ${Class}`);
    }
    return found(params);
}

function getMeta(type: Type<any, any> | GenericType<any>): MetaData | undefined {
    return getTypeMeta(type)[mockNamespaceSymbol];
}

export function setMocker<T extends Type<any, any> | GenericType<any>>(type: T, strategy: Strategy, mocker: Mocker<NormType<T>>): T {
    return extendMeta(type, mockNamespaceSymbol, {
        ...getMeta(type),
        mockers: {
            ...getMeta(type)?.mockers,
            [strategy]: mocker,
        }
    });
}

export function createIndexer() {
    let i = 0;
    return () => i++;
}

export function mockData<T extends Type<any, any>>(type: T, params: MockerParams): ResolveType<T> {
    const meta = getMeta(type);
    if (!meta) {
        throw new Error(`No mocker set up for type ${type.typeName}`);
    }
    const mocker = meta.mockers[params.strategy];
    return mocker(type, params) as any;
}

export function mockApi<T extends Api>(api: T, params: MockerParams = {indexer: createIndexer(), strategy: 'basic'}): ResolveApi<T> {
    const res = {} as any;
    for (const key of Object.keys(api)) {
        res[key] = mockData(api[key], params);
    }
    return res;
}

export function mockCurryApi<T extends Api>(api: T, params: MockerParams = {indexer: createIndexer(), strategy: 'basic'}): ResolveCurryApi<T> {
    const res = {} as any;
    for (const key of Object.keys(api)) {
        res[key] = () => mockData(api[key], params);
    }
    return res;
}