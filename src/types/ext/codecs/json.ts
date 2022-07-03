import { fromHalfByte, toHalfByte } from '../../../binary-utils/half-byte';
import {decodeInstance, decodeJson, defineClassEncoder, encodeInstance, encodeJson, setJsonCodec} from '../../../extensions/codecs/json';
import {types, decodeLiteral, encodeLiteral} from '../../../types';

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

export function withJsonCodec(t: typeof types): typeof types {
    return {
        number: t.number.extend(type => setJsonCodec(type, (type, n) => {
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
        })),
        string: t.string.extend(type => setJsonCodec(type, (type, s) => s, (type, s) => s)),
        boolean: t.boolean.extend(type => setJsonCodec(type, (type, b) => b, (type, b) => b)),
        bigint: t.bigint.extend(type => setJsonCodec(type, (type, b) => String(b), (type, b) => BigInt(b))),
        symbol: t.symbol.extend(type => setJsonCodec(type, symbolThrower, symbolThrower)),

        unknown: t.unknown.extend(type => setJsonCodec(type, unknownThrower, unknownThrower)),

        array: t.array.extend(type => setJsonCodec(type,
            (type, data) => data.map(i => encodeJson(type.param.itemType, i)),
            (type, data) => data.map(i => decodeJson(type.param.itemType, i)),
        )),

        tuple: t.tuple.extend(type => setJsonCodec(type,
            (type, data) => type.param.items.map((itemType, index) => encodeJson(itemType, data[index])),
            (type, data) => type.param.items.map((itemType, index) => decodeJson(itemType, data[index])),
        )),

        object: t.object.extend(type => setJsonCodec(type,
            (type, obj) => objMap(type.param.shape, (propType, key) => encodeJson(propType, obj[key])),
            (type, obj) => objMap(type.param.shape, (propType, key) => decodeJson(propType, obj[key])),
        )),
        record: t.record.extend(type => setJsonCodec(type,
            (type, obj) => objMap(obj, (value) => encodeJson(type.param.valueType, value)),
            (type, obj) => objMap(obj, (value) => decodeJson(type.param.valueType, value)),
        )),

        oneOf: t.oneOf.extend(type => setJsonCodec(type, oneOfThrower, oneOfThrower)),

        propUnion: t.propUnion.extend(type => setJsonCodec(type,
            (type, value) => {
                const litValue = value[type.param.trait];
                const variantId = encodeLiteral(litValue);
                const variantType = type.param.variantMap[variantId];
                return {variantId, data: encodeJson(variantType, value)};
            },
            (type, value) => {
                const {data, variantId} = value;
                const variantType = type.param.variantMap[variantId];
                return decodeJson(variantType, data);
            }
        )),

        enum: t.enum.extend(type => setJsonCodec(type,
            (type, value) => type.param.variantMap[value],
            (type, value) => type.param.reverseMap.get(value)!,
        )),

        function: t.function.extend(type => setJsonCodec(type, fnThrower, fnThrower)),

        instance: t.instance.extend(type => setJsonCodec(type, (type, i) => encodeInstance(type.param.Class, i), (type, i) => decodeInstance(type.param.Class, i))),

        jsonLike: t.jsonLike.extend(type => setJsonCodec(type, (type, data) => JSON.stringify(data), (type, data) => JSON.parse(data))),

        opt: t.opt.extend(type => setJsonCodec(type,
            (type, data) => {
                if (data === undefined) {
                    return undefined;
                }
                const definedType = type.param.variants[1];
                return encodeJson(definedType, data);
            },
            (type, data) => {
                if (data === undefined) {
                    return undefined;
                }
                const definedType = type.param.variants[1];
                return decodeJson(definedType, data);
            },
        )),

        void: t.void.extend(type => setJsonCodec(type,
            (type, data) => {
                return data;
            },
            (type, data) => {
                return data;
            }
        )),

        promise: t.promise.extend(type => setJsonCodec(type, promiseThrower, promiseThrower)),

        literal: t.literal.extend(type => setJsonCodec(type, (type) => encodeLiteral(type.param.literal), (type, value) => decodeLiteral(value))),


        typedArray: t.typedArray.extend(type => setJsonCodec(type,
            (type, ta) => toHalfByte(ta.buffer),
            (type, buffer) => new type.param.TypedArrayClass(fromHalfByte(buffer))),
        ),
        arrayBuffer: t.arrayBuffer.extend(type => setJsonCodec(type,
            (type, ta) => toHalfByte(ta),
            (type, buffer) => fromHalfByte(buffer),
        )),

        fn: t.fn, // fallbacks
        duplexFn: t.duplexFn,
        duplexFunction: t.duplexFunction,
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