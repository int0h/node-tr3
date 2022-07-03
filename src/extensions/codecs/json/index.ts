import {ResolveType, Type, definfeExtensionMethod, GenericType, NormType, extendMeta, getTypeMeta} from '../../../core';
import { Codec, Decoder, Encoder } from '../common';
import {decodeTransform, encodeTransform, getTransformType} from '../transform';

const jsonCodecNamespaceSymbol = Symbol('encoderNamespaceSymbol');

type MetaData = {
    encoder: Encoder<any, any>;
    decoder: Decoder<any, any>;
}


const classEncoders = new WeakMap<any, {encoder: (data: any) => any, decoder: (data: any) => any}>();

export function defineClassEncoder<T extends new (...args: any[]) => any, S>(Class: T, encoder: (instance: InstanceType<T>) => S, decoder: (serialized: S) => InstanceType<T>) {
    const found = classEncoders.get(Class);
    if (found) {
        throw new Error(`There is already an encoder for class ${Class}`);
    }
    classEncoders.set(Class, {encoder, decoder});
}

export function encodeInstance<T extends new (...args: any[]) => any>(Class: T, data: InstanceType<T>): unknown {
    const found = classEncoders.get(Class);
    if (!found) {
        throw new Error(`There is no encoder/decoder for class ${Class}`);
    }
    return found.encoder(data);
}

export function decodeInstance<T extends new (...args: any[]) => any>(Class: T, data: any): InstanceType<T> {
    const found = classEncoders.get(Class);
    if (!found) {
        throw new Error(`There is no encoder/decoder for class ${Class}`);
    }
    return found.decoder(data);
}

export function setJsonCodec<T extends Type<any, any> | GenericType<any>, S>(type: T, encoder: Encoder<NormType<T>, S>, decoder: Decoder<NormType<T>, S>): T {
    return extendMeta(type, jsonCodecNamespaceSymbol, {
        ...getMeta(type),
        encoder,
        decoder,
    });
}

function getMeta(type: Type<any, any> | GenericType<any>): MetaData | undefined {
    return getTypeMeta(type)[jsonCodecNamespaceSymbol];
}

export function encodeJson<T extends Type<any, any>>(type: T, data: ResolveType<T>): unknown {
    const transformType = getTransformType(type);
    if (transformType) {
        return encodeJson(transformType, encodeTransform(type, data))
    }

    const meta = getMeta(type);
    if (!meta) {
        throw new Error(`No encoder set up for type ${type.typeName}`);
    }
    const {encoder} = meta;
    return encoder(type, data);
}

export function decodeJson<T extends Type<any, any>>(type: T, serialized: unknown): ResolveType<T> {
    const transformType = getTransformType(type);
    if (transformType) {
        return decodeTransform(type, decodeJson(transformType, serialized));
    }

    const meta = getMeta(type);
    if (!meta) {
        throw new Error(`No encoder set up for type ${type.typeName}`);
    }
    const {decoder} = meta;
    return decoder(type, serialized) as any;
}

export const jsonCodec: Codec<any> = {
    encode: encodeJson,
    decode: decodeJson,
};
