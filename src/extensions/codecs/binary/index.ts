import {ResolveType, Type, definfeExtensionMethod, GenericType, NormType, extendMeta, getTypeMeta} from '../../../core';
import { Codec, Decoder, Encoder } from '../common';
import {decodeTransform, encodeTransform, getTransformType} from '../transform';

const binaryEncoderNamespaceSymbol = Symbol('binaryEncoderNamespaceSymbol');

type MetaData = {
    encoder: Encoder<any, ArrayBuffer>;
    decoder: Decoder<any, ArrayBuffer>;
}

const classEncoders = new WeakMap<any, {encoder: (data: any) => any, decoder: (data: any) => any}>();

export function defineClassEncoder<T extends new (...args: any[]) => any>(Class: T, encoder: (instance: InstanceType<T>) => ArrayBuffer, decoder: (serialized: ArrayBuffer) => InstanceType<T>) {
    const found = classEncoders.get(Class);
    if (found) {
        throw new Error(`There is already an encoder for class ${Class}`);
    }
    classEncoders.set(Class, {encoder, decoder});
}

export function encodeInstance<T extends new (...args: any[]) => any>(Class: T, data: InstanceType<T>): ArrayBuffer {
    const found = classEncoders.get(Class);
    if (!found) {
        throw new Error(`There is no encoder/decoder for class ${Class}`);
    }
    return found.encoder(data);
}

export function decodeInstance<T extends new (...args: any[]) => any>(Class: T, data: ArrayBuffer): InstanceType<T> {
    const found = classEncoders.get(Class);
    if (!found) {
        throw new Error(`There is no encoder/decoder for class ${Class}`);
    }
    return found.decoder(data);
}

function getMeta(type: Type<any, any> | GenericType<any>): MetaData | undefined {
    return getTypeMeta(type)[binaryEncoderNamespaceSymbol];
}

export function setBinaryCodec<T extends Type<any, any> | GenericType<any>>(type: T, encoder: Encoder<NormType<T>, ArrayBuffer>, decoder: Decoder<NormType<T>, ArrayBuffer>): T {
    return extendMeta(type, binaryEncoderNamespaceSymbol, {
        ...getTypeMeta(type),
        encoder,
        decoder,
    });
}

export function encodeBinary<T extends Type<any, any>>(type: T, data: ResolveType<T>): ArrayBuffer {
    const transformType = getTransformType(type);
    if (transformType) {
        return encodeBinary(transformType, encodeTransform(type, data))
    }

    const meta = getMeta(type);
    if (!meta) {
        throw new Error(`No encoder set up for type ${type.typeName}`);
    }
    const {encoder} = meta;
    return encoder(type, data);
}

export function decodeBinary<T extends Type<any, any>>(type: T, serialized: ArrayBuffer): ResolveType<T> {
    const transformType = getTransformType(type);
    if (transformType) {
        return decodeTransform(type, decodeBinary(transformType, serialized));
        // return decodeBinary(transformType, decodeTransform(type, serialized as any));
    }

    const meta = getMeta(type);
    if (!meta) {
        throw new Error(`No encoder set up for type ${type.typeName}`);
    }
    const {decoder} = meta;
    return decoder(type, serialized) as any;
}

export const binaryCodec: Codec<ArrayBuffer> = {
    encode: encodeBinary,
    decode: decodeBinary,
};
