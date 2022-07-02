import {decodeInstance, decodeJs, defineClassEncoder, encodeInstance, encodeJs} from './';
import {basicTypes} from '../../../basic-types';

function objMap(obj: any, fn: (value: any, key: string) => any): any {
    const res: any = {};
    for (const key of Object.keys(obj)) {
        res[key] = fn(obj[key], key);
    }
    return res;
}

const oneOfThrower = () => {
    throw new Error(`There is no default encoder for generic 'oneOf' type. It needs to be set for each variant of type`);
}

const fnThrower = () => {
    throw new Error(`It's generally impossible to encode/decode functions`);
};

const unknownThrower = () => {
    throw new Error(`It's generally impossible to encode/decode unknown type`);
};

const promiseThrower = () => {
    throw new Error(`It's generally impossible to encode/decode Promises`);
};

const symbolThrower = () => {
    throw new Error(`There is no default encoder/decoder for Symbols`);
};


export function basicEncoders(t: typeof basicTypes): typeof basicTypes {
    return {
        number: t.number.setJsEncoder((type, n) => {
            if (Number.isFinite(n)) {
                return n;
            } else {
                return String(n);
            }
        }, (type, n) => {
            if (typeof n === 'string') {
                return Number(n);
            } else {
                return n;
            }
        }),
        string: t.string.setJsEncoder((type, s) => s, (type, s) => s),
        boolean: t.boolean.setJsEncoder((type, b) => b, (type, b) => b),
        bigint: t.bigint.setJsEncoder((type, b) => String(b), (type, b) => BigInt(b)),
        symbol: t.symbol.setJsEncoder(symbolThrower, symbolThrower),

        unknown: t.unknown.setJsEncoder(unknownThrower, unknownThrower),

        array: t.array.setJsEncoder(
            (type, data) => data.map(i => encodeJs(type.param.itemType, i)),
            (type, data) => data.map(i => decodeJs(type.param.itemType, i)),
        ),

        tuple: t.tuple.setJsEncoder(
            (type, data) => type.param.items.map((itemType, index) => encodeJs(itemType, data[index])),
            (type, data) => type.param.items.map((itemType, index) => decodeJs(itemType, data[index])),
        ),

        object: t.object.setJsEncoder(
            (type, obj) => objMap(type.param.shape, (propType, key) => encodeJs(propType, obj[key])),
            (type, obj) => objMap(type.param.shape, (propType, key) => decodeJs(propType, obj[key])),
        ),
        record: t.record.setJsEncoder(
            (type, obj) => objMap(obj, (value) => encodeJs(type.param.valueType, value)),
            (type, obj) => objMap(obj, (value) => decodeJs(type.param.valueType, value)),
        ),

        oneOf: t.oneOf.setJsEncoder(oneOfThrower, oneOfThrower),

        enum: t.enum.setJsEncoder(
            (type, value) => type.param.variantMap[value],
            (type, value) => type.param.reverseMap.get(value)!,
        ),

        function: t.function.setJsEncoder(fnThrower, fnThrower),

        instance: t.instance.setJsEncoder((type, i) => encodeInstance(type.param.Class, i), (type, i) => decodeInstance(type.param.Class, i)),

        jsonLike: t.jsonLike.setJsEncoder((type, data) => JSON.stringify(data), (type, data) => JSON.parse(data)),

        opt: t.opt.setJsEncoder(
            (type, data) => {
                if (data === undefined) {
                    return undefined;
                }
                const definedType = type.param.variants[1];
                return encodeJs(definedType, data);
            },
            (type, data) => {
                if (data === undefined) {
                    return undefined;
                }
                const definedType = type.param.variants[1];
                return decodeJs(definedType, data);
            },
        ),

        void: t.void.setJsEncoder(
            (type, data) => {
                return data;
            },
            (type, data) => {
                return data;
            }
        ),

        promise: t.promise.setJsEncoder(promiseThrower, promiseThrower),

        literal: t.literal.setJsEncoder(() => null, type => type.param.literal),


        fn: t.fn, // fallbacks
        null: t.null,
        undefined: t.undefined,
        partial: t.partial,
        byte: t.byte,
        int: t.int,
        float: t.float,
        uint: t.uint,

        // class encoders
        date: t.date,
        regexp: t.regexp,
    };
}

defineClassEncoder(Date, date => date.toISOString(), str => new Date(str));
defineClassEncoder(RegExp, regexp => [regexp.source, regexp.flags], ([source, flags]) => new RegExp(source, flags));