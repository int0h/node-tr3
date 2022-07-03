import {decodeInstance, decodeBinary, encodeBinary, defineClassEncoder, encodeInstance, setBinaryCodec} from '../../../extensions/codecs/binary';
import {types, decodeLiteral, encodeLiteral, returns} from '../../../types';
import { Type } from '../../../core';
import {packBuffers, unpackBuffers, bufferToStr, f64ToUint8, strToBuffer, uint32ToUint8} from '../../../binary-utils';

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

const arrToBuffer = (array: any[], itemTypes: (index: number) => Type<any, any>) => {
    const items = array.map((i, index) => encodeBinary(itemTypes(index), i));
    return packBuffers(items);
};

const bufferToArr = (buffer: ArrayBuffer, itemTypes: (index: number) => Type<any, any>) => {
    const bufferArr = unpackBuffers(buffer);
    return bufferArr.map((buf, index) => decodeBinary(itemTypes(index), buf));
}

const numberToTypedArray = (n: number, TaClass: typeof Uint32Array | typeof Uint8Array | typeof Float64Array | typeof Int32Array) => {
    return new TaClass([n]).buffer
}

const typedArrayToNumber = (buf: ArrayBuffer, TaClass: typeof Uint32Array | typeof Uint8Array | typeof Float64Array | typeof Int32Array) => {
    const ta = new TaClass(buf);
    return ta[0];
}

export function withBinaryCodec(t: typeof types): typeof types {
    return {
        number: t.number.extend(type => setBinaryCodec(type, (type, n) => numberToTypedArray(n, Float64Array), (type, buf) => typedArrayToNumber(buf, Float64Array))),
        byte: t.byte.extend(type => setBinaryCodec(type, (type, n) => numberToTypedArray(n, Uint8Array), (type, buf) => typedArrayToNumber(buf, Uint8Array))),
        int: t.int.extend(type => setBinaryCodec(type, (type, n) => numberToTypedArray(n, Int32Array), (type, buf) => typedArrayToNumber(buf, Int32Array))),
        float: t.float.extend(type => setBinaryCodec(type, (type, n) => numberToTypedArray(n, Float64Array), (type, buf) => typedArrayToNumber(buf, Float64Array))),
        uint: t.uint.extend(type => setBinaryCodec(type, (type, n) => numberToTypedArray(n, Uint32Array), (type, buf) => typedArrayToNumber(buf, Uint32Array))),

        string: t.string.extend(type => setBinaryCodec(type, (type, s) => strToBuffer(s), (type, buffer) => bufferToStr(buffer))),

        boolean: t.boolean.extend(type => setBinaryCodec(type,
                (type, b) => {
                return new Uint8Array([b ? 1 : 0]).buffer;
            },
            (type, buffer) => {
                const ta = new Uint8Array(buffer);
                return ta[0] === 1;
            }
        )),

        bigint: t.bigint.extend(type => setBinaryCodec(type,(type, b) => strToBuffer(String(b)), (type, buffer) => BigInt(bufferToStr(buffer)))),

        symbol: t.symbol.extend(type => setBinaryCodec(type,symbolThrower, symbolThrower)),

        unknown: t.unknown.extend(type => setBinaryCodec(type,unknownThrower, unknownThrower)),

        array: t.array.extend(type => setBinaryCodec(type,
            (type, array) => arrToBuffer(array, () => type.param.itemType),
            (type, buffer) => bufferToArr(buffer, () => type.param.itemType),
        )),

        tuple: t.tuple.extend(type => setBinaryCodec(type,
            (type, array) => arrToBuffer(array, n => type.param.items[n]),
            (type, buffer) => bufferToArr(buffer, n => type.param.items[n]),
        )),

        object: t.object.extend(type => setBinaryCodec(type,
            (type, obj) => {
                const values = type.param.keys.map(key => {
                    return encodeBinary(type.param.shape[key], obj[key]);
                });
                return packBuffers(values);
            },
            (type, buffer) => {
                const res = {} as any;
                const bufferArr = unpackBuffers(buffer);
                bufferArr.forEach((buf, index) => {
                    const key = type.param.keys[index];
                    const decoded = decodeBinary(type.param.shape[key], buf);
                    res[key] = decoded;
                });
                return res;
            },
        )),

        record: t.record.extend(type => setBinaryCodec(type,
            (type, obj) => {
                const keyValuePairs = Object.entries(obj);
                const kvBuffers = keyValuePairs.map(([key, value]) => {
                    return packBuffers([
                        strToBuffer(key),
                        encodeBinary(type.param.valueType, value),
                    ]);
                });
                return packBuffers(kvBuffers);
            },
            (type, buffer) => {
                const res = {} as any;
                const pairBuffers = unpackBuffers(buffer);
                pairBuffers.forEach(pairBuf => {
                    const [keyBuf, valueBuf] = unpackBuffers(pairBuf);
                    const key = bufferToStr(keyBuf);
                    const value = decodeBinary(type.param.valueType, valueBuf);
                    res[key] = value;
                });
                return res;
            },
        )),

        oneOf: t.oneOf.extend(type => setBinaryCodec(type, oneOfThrower, oneOfThrower)),

        propUnion: t.propUnion.extend(type => setBinaryCodec(type,
            (type, value) => {
                const litValue = value[type.param.trait];
                const variantId = encodeLiteral(litValue);
                const variantType = type.param.variantMap[variantId];
                return packBuffers([
                    uint32ToUint8(variantId).buffer,
                    encodeBinary(variantType, value),
                ]);
            },
            (type, value) => {
                const [varIdBuf, dataBuf] = unpackBuffers(value);
                const variantId = new Uint32Array(varIdBuf)[0];
                const variantType = type.param.variantMap[variantId];
                return decodeBinary(variantType, dataBuf);
            }
        )),

        enum: t.enum.extend(type => setBinaryCodec(type,
            (type, value) => uint32ToUint8(type.param.variantMap[value]).buffer,
            (type, value) => type.param.reverseMap.get(new Uint32Array(value)[0])!,
        )),

        function: t.function.extend(type => setBinaryCodec(type, fnThrower, fnThrower)),

        instance: t.instance.extend(type => setBinaryCodec(type, (type, i) => encodeInstance(type.param.Class, i), (type, i) => decodeInstance(type.param.Class, i))),

        jsonLike: t.jsonLike.extend(type => setBinaryCodec(type, (type, data) => strToBuffer(JSON.stringify(data)), (type, data) => JSON.parse(bufferToStr(data)))),

        opt: t.opt.extend(type => setBinaryCodec(type,
            (type, data) => {
                if (data === undefined) {
                    return new Uint8Array([0]).buffer;
                }
                const d = encodeBinary(type.param.variants[1], data);
                const ua = new Uint8Array(d.byteLength + 1);
                ua[0] = 1;
                ua.set(new Uint8Array(encodeBinary(type.param.variants[1], data)), 1);
                return ua.buffer;
            },
            (type, buffer) => {
                const ua = new Uint8Array(buffer);
                if (ua[0] === 0) {
                    return undefined;
                }
                const dataUa = ua.slice(1);
                return decodeBinary(type.param.variants[1], dataUa.buffer);
            },
        )),

        void: t.void.extend(type => setBinaryCodec(type,
            (type, data) => {
                return new Uint8Array([data === undefined ? 0 : 1]).buffer;
            },
            (type, buffer) => {
                const ua = new Uint8Array(buffer);
                return ua[0] === 0 ? undefined : null;
            }
        )),

        promise: t.promise.extend(type => setBinaryCodec(type, promiseThrower, promiseThrower)),

        literal: t.literal.extend(type => setBinaryCodec(type, type => new Uint32Array([encodeLiteral(type.param.literal)]), (type, buffer) => decodeLiteral(new Uint32Array(buffer)[0]))),


        typedArray: t.typedArray.extend(type => setBinaryCodec(type,
            (type, ta) => ta.buffer,
            (type, buffer) => new type.param.TypedArrayClass(buffer)),
        ),
        arrayBuffer: t.arrayBuffer.extend(type => setBinaryCodec(type,
            (type, ta) => ta,
            (type, buffer) => buffer),
        ),

        fn: t.fn, // fallbacks
        duplexFn: t.duplexFn,
        duplexFunction: t.duplexFunction,
        null: t.null,
        undefined: t.undefined,
        partial: t.partial,
        // byte: t.byte,
        // int: t.int,
        // float: t.float,
        // uint: t.uint,

        // class encoders
        date: t.date,
        regexp: t.regexp,
    };
}

defineClassEncoder(Date, date => f64ToUint8(date.getTime()).buffer, buffer => new Date(new Float64Array(buffer)[0]));

defineClassEncoder(RegExp,
    regexp => packBuffers([regexp.source, regexp.flags].map(str => strToBuffer(str))),
    buffer => {
        const [source, flags] = unpackBuffers(buffer).map(buf => bufferToStr(buf));
        return new RegExp(source, flags);
    },
)