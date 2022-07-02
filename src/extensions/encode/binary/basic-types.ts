import {decodeInstance, decodeBinary, encodeBinary, defineClassEncoder, encodeInstance} from './';
import {basicTypes, returns} from '../../../basic-types';
import { Type } from '../../../core';

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

const strToBuffer = (s: string) => {
    const encoder = new TextEncoder();
    return encoder.encode(s).buffer;
};

const bufferToStr = (buffer: ArrayBuffer) => {
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
};

const uint32ToUint8 = (n: number) => {
    return new Uint8Array(new Uint32Array([n]));
};

const f64ToUint8 = (n: number) => {
    return new Uint8Array(new Float64Array([n]));
};

const packBuffers = (bufferArr: ArrayBuffer[]): ArrayBuffer => {
    // buffer data * n + buffer len * n + n
    const len = bufferArr.reduce((acc, cur) => acc + cur.byteLength, bufferArr.length * 4 + 4);
    let index = 4;
    const result = new Uint8Array(len);
    result.set(uint32ToUint8(bufferArr.length));
    for (const buf of bufferArr) {
        result.set(uint32ToUint8(buf.byteLength), index);
        index += 4;
        result.set(new Uint8Array(buf), index);
        index += buf.byteLength;
    }
    return result;
}

const unpackBuffers = (buffer: ArrayBuffer): ArrayBuffer[] => {
    const u32ar = new Uint32Array(buffer);
    const u8arr = new Uint8Array(buffer);
    const arraySize = u32ar[0];
    const res: any[] = [];
    let currentOffset = 4;
    for (let i = 0; i < arraySize; i++) {
        const itemLength = u32ar[currentOffset];
        currentOffset += 4;
        const itemBuffer = u8arr.slice(currentOffset, currentOffset + itemLength);
        currentOffset += 4;
        res.push(itemBuffer.buffer);
    }
    return res;
}

const arrToBuffer = (array: any[], itemTypes: (index: number) => Type<any, any>) => {
    const items = array.map((i, index) => encodeBinary(itemTypes(index), i));
    return packBuffers(items);
};

const bufferToArr = (buffer: ArrayBuffer, itemTypes: (index: number) => Type<any, any>) => {
    const bufferArr = unpackBuffers(buffer);
    return bufferArr.map((buf, index) => decodeBinary(itemTypes(index), buf));
}

export function basicEncoders(t: typeof basicTypes): typeof basicTypes {
    return {
        number: t.number.setBinaryEncoder(
            (type, n) => {
                return new Float64Array([n]).buffer;
            },
            (type, buffer) => {
                const ta = new Float64Array(buffer);
                return ta[0];
            }
        ),

        string: t.string.setBinaryEncoder((type, s) => strToBuffer(s), (type, buffer) => bufferToStr(buffer)),

        boolean: t.boolean.setBinaryEncoder(
                (type, b) => {
                return new Uint8Array([b ? 1 : 0]).buffer;
            },
            (type, buffer) => {
                const ta = new Uint8Array(buffer);
                return ta[0] === 1;
            }
        ),

        bigint: t.bigint.setBinaryEncoder((type, b) => strToBuffer(String(b)), (type, buffer) => BigInt(bufferToStr(buffer))),

        symbol: t.symbol.setBinaryEncoder(symbolThrower, symbolThrower),

        unknown: t.unknown.setBinaryEncoder(unknownThrower, unknownThrower),

        array: t.array.setBinaryEncoder(
            (type, array) => arrToBuffer(array, () => type.param.itemType),
            (type, buffer) => bufferToArr(buffer, () => type.param.itemType),
        ),

        tuple: t.tuple.setBinaryEncoder(
            (type, array) => arrToBuffer(array, n => type.param.items[n]),
            (type, buffer) => bufferToArr(buffer, n => type.param.items[n]),
        ),

        object: t.object.setBinaryEncoder(
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
        ),

        record: t.record.setBinaryEncoder(
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
        ),

        oneOf: t.oneOf.setBinaryEncoder(oneOfThrower, oneOfThrower),

        enum: t.enum.setBinaryEncoder(
            (type, value) => uint32ToUint8(type.param.variantMap[value]).buffer,
            (type, value) => type.param.reverseMap.get(new Uint32Array(value)[0])!,
        ),

        function: t.function.setBinaryEncoder(fnThrower, fnThrower),

        instance: t.instance.setBinaryEncoder((type, i) => encodeInstance(type.param.Class, i), (type, i) => decodeInstance(type.param.Class, i)),

        jsonLike: t.jsonLike.setBinaryEncoder((type, data) => strToBuffer(JSON.stringify(data)), (type, data) => JSON.parse(bufferToStr(data))),

        opt: t.opt.setBinaryEncoder(
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
        ),

        void: t.void.setBinaryEncoder(
            (type, data) => {
                return new Uint8Array([data === undefined ? 0 : 1]).buffer;
            },
            (type, buffer) => {
                const ua = new Uint8Array(buffer);
                return ua[0] === 0 ? undefined : null;
            }
        ),

        promise: t.promise.setBinaryEncoder(promiseThrower, promiseThrower),

        literal: t.literal.setBinaryEncoder(() => new Uint8Array([]), type => type.param.literal),


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

defineClassEncoder(Date, date => f64ToUint8(date.getTime()).buffer, buffer => new Date(new Float64Array(buffer)[0]));

defineClassEncoder(RegExp,
    regexp => packBuffers([regexp.source, regexp.flags].map(str => strToBuffer(str))),
    buffer => {
        const [source, flags] = unpackBuffers(buffer).map(buf => bufferToStr(buf));
        return new RegExp(source, flags);
    },
)