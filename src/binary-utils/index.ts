const TextEncoderPolyfill = typeof TextEncoder === 'undefined'
    ? (eval(`require('util')`) as typeof import('util')).TextEncoder
    : TextEncoder;

const TextDecoderPolyfill = typeof TextDecoder === 'undefined'
    ? (eval(`require('util')`) as typeof import('util')).TextDecoder
    : TextDecoder;

export const strToBuffer = (s: string) => {
    const encoder = new TextEncoderPolyfill();
    return encoder.encode(s).buffer;
};

export const bufferToStr = (buffer: ArrayBuffer) => {
    const decoder = new TextDecoderPolyfill();
    return decoder.decode(buffer);
};

export const u32ToBuf = (n: number) => {
    return new Uint32Array([n]).buffer;
};

export const bufToU32 = (buf: ArrayBuffer) => {
    return new Uint32Array(buf)[0];
};

export const u8ToBuf = (n: number) => {
    return new Uint8Array([n]).buffer;
};

export const bufToU8 = (buf: ArrayBuffer) => {
    return new Uint8Array(buf)[0];
};

export const uint32ToUint8 = (n: number) => {
    return new Uint8Array(new Uint32Array([n]).buffer);
};

export const f64ToUint8 = (n: number) => {
    return new Uint8Array(new Float64Array([n]).buffer);
};

export const packBuffers = (bufferArr: ArrayBuffer[]): ArrayBuffer => {
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

function readUint32(buf: ArrayBuffer, offset: number): number {
    const fourBytes = new Uint8Array(buf).slice(offset, offset + 4);
    return new Uint32Array(fourBytes.buffer)[0];
}

export const unpackBuffers = (buffer: ArrayBuffer): ArrayBuffer[] => {
    const u8arr = new Uint8Array(buffer);
    const arraySize = readUint32(buffer, 0);
    const res: any[] = [];
    let currentOffset = 4;
    for (let i = 0; i < arraySize; i++) {
        const itemLength = readUint32(buffer, currentOffset);
        currentOffset += 4;
        const itemBuffer = u8arr.slice(currentOffset, currentOffset + itemLength);
        currentOffset += itemLength;
        res.push(itemBuffer.buffer);
    }
    return res;
}

type ResolveSchemaObj<K extends string> = {
    [key in K]: ArrayBuffer;
}

type SchemaCodec<K extends string> = {
    encode: (obj: ResolveSchemaObj<K>) => ArrayBuffer;
    decode: (data: ArrayBuffer) => ResolveSchemaObj<K>;
}

export const createSchemaCodec = <K extends string[]>(...fields: K): SchemaCodec<K[number]> => {
    return {
        encode: obj => {
            return packBuffers(fields.map(k => (obj as any)[k]));
        },
        decode: data => {
            const obj: any = {};
            const buffers = unpackBuffers(data);
            fields.forEach((k, index) => {
                const buf = buffers[index];
                obj[k] = buf;
            });
            return obj;
        }
    }
}
