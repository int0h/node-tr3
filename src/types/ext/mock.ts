import {defineClassMocker, mockData, mockInstance, setMocker} from '../../extensions/mock';
import {types} from '../../types';
import RandExp from "randexp";
import { GenericType, Type } from '../../core';
import { extractFnReturnType } from '../../rtti-utils/fn';

function objMap(obj: any, fn: (value: any, key: string) => any): any {
    const res: any = {};
    for (const key of Object.keys(obj)) {
        res[key] = fn(obj[key], key);
    }
    return res;
}

const unknownVariants = [{}, {a: 123}, 'hello', NaN, undefined, 1, Infinity, () => {}, class {}, /a-z/, null, undefined];

const randexpCache = new WeakMap<Type<any, any> | GenericType<any>, RandExp>();

const mockArrayBuffer = (indexer: () => number) => {
    const len = indexer() + 5;
    const ta = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        ta[i] = indexer() % 256;
    }
    return ta.buffer;
}

export function withMock(t: typeof types): typeof types {
    return {
        number: t.number.extend(type => setMocker(type, 'basic', (type, {indexer}) => {
            let value = indexer();
            value = Math.min(Math.max(value, type.param.range[0]), type.param.range[1]);
            if (!type.param.onlyInteger) {
                value += indexer() % 2 === 0 ? 0.5 : 0;
            }
            return value;
        })),

        string: t.string.extend(type => setMocker(type, 'basic', (type, {indexer}) => {
            const basicMock = `mock-string#${indexer()}`;
            if (type.param.format) {
                let randexp = randexpCache.get(type)!;
                if (!randexp) {
                    randexp = new RandExp(type.param.format);
                    randexp.max = 5;
                    randexp.randInt = (min, max) => (indexer() % (max + 1 - min)) + min;
                    randexpCache.set(type, randexp);
                }
                return randexp.gen()
            }
            if (basicMock.length > type.param.lengthRange[1]) {
                return basicMock.slice(0, type.param.lengthRange[1]);
            }
            if (basicMock.length < type.param.lengthRange[0]) {
                return basicMock + '_'.repeat(basicMock.length - type.param.lengthRange[0]);
            }
            return basicMock;
        })),

        boolean: t.boolean.extend(type => setMocker(type, 'basic', (type, {indexer}) => indexer() % 2 === 0)),

        bigint: t.bigint.extend(type => setMocker(type, 'basic', (type, {indexer}) => BigInt(indexer()))),

        symbol: t.symbol.extend(type => setMocker(type, 'basic', () => {throw new Error(`It's impossible to mock Symbols`)})),

        array: t.array.extend(type => setMocker(type, 'basic', (type, {indexer, strategy}) => {
            const len = indexer() * 7 % 5 + 2;
            return new Array(len)
                .fill(1)
                .map(i => mockData(type.param.itemType, {strategy, indexer}))
        })),

        tuple: t.tuple.extend(type => setMocker(type, 'basic', (type, {indexer, strategy}) => {
            indexer();
            return type.param.items
                .map(itemType => mockData(itemType, {strategy, indexer}))
        })),

        object: t.object.extend(type => setMocker(type, 'basic', (type, {indexer, strategy}) => {
            indexer();
            return objMap(type.param.shape, (propType, key) => {
                return mockData(propType, {strategy, indexer});
            });
        })),

        record: t.record.extend(type => setMocker(type, 'basic', (type, {indexer, strategy}) => {
            const keys = mockData(t.array(t.string), {strategy, indexer});
            indexer();
            const res: any = {};
            for (const key of keys) {
                res[key] = mockData(type.param.valueType, {strategy, indexer});
            }
            return res;
        })),

        oneOf: t.oneOf.extend(type => setMocker(type, 'basic', (type, {indexer, strategy}) => {
            const variant = indexer() % type.param.variants.length;
            return mockData(type.param.variants[variant], {indexer, strategy});
        })),

        propUnion: t.propUnion.extend(type => setMocker(type, 'basic', (type, {indexer, strategy}) => {
            const variant = indexer() % type.param.variants.length;
            return mockData(type.param.variants[variant], {indexer, strategy});
        })),

        enum: t.enum.extend(type => setMocker(type, 'basic', (type, {indexer, strategy}) => {
            const vars = Object.keys(type.param.variantMap);
            const variant = indexer() % vars.length;
            return vars[variant];
        })),

        function: t.function.extend(type => setMocker(type, 'basic', (type, {indexer, strategy}) => {
            indexer();
            return () => {
                return mockData(extractFnReturnType(type), {indexer, strategy});
            };
        })),

        instance: t.instance.extend(type => setMocker(type, 'basic', (type, params) => {
            return mockInstance(type.param.Class, params);
        })),

        jsonLike: t.jsonLike.extend(type => setMocker(type, 'basic', () => ({}))),

        literal: t.literal.extend(type => setMocker(type, 'basic', (type) => type.param.literal)),

        unknown: t.unknown.extend(type => setMocker(type, 'basic', (type, {indexer}) => {
            const index = indexer() % unknownVariants.length;
            return unknownVariants[index];
        })),

        promise: t.promise.extend(type => setMocker(type, 'basic', (type, {indexer, strategy}) => {
            indexer();
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(mockData(type.param.type, {indexer, strategy}));
                }, 0);
            });
        })),

        typedArray: t.typedArray.extend(type => setMocker(type, 'basic', (type, {indexer}) => {
            return new type.param.TypedArrayClass(mockArrayBuffer(indexer));
        })),

        arrayBuffer: t.arrayBuffer.extend(type => setMocker(type, 'basic', (type, {indexer}) => {
            return mockArrayBuffer(indexer);
        })),


        fn: t.fn, // fallback to function
        duplexFn: t.duplexFn,
        duplexFunction: t.duplexFunction,
        null: t.null,
        opt: t.opt,
        undefined: t.undefined,
        void: t.void,
        partial: t.partial,
        byte: t.byte,
        int: t.int,
        float: t.float,
        uint: t.uint,


        // classes
        date: t.date,
        regexp: t.regexp,
    };
}

defineClassMocker(Date, ({indexer}) => {
    const base = 1577836800000; //Wed Jan 01 2020 01:00:00 GMT+0100
    const shift = (indexer() % 365) * 24 * 60 * 60 * 1000;
    const date = new Date();
    date.setTime(base + shift);
    return date;
});

defineClassMocker(RegExp, ({indexer}) => {
    return indexer() % 2 === 0 ? /a-z/ : /1-9/g;
});