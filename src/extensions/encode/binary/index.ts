import {ResolveType, Type, defineExtensionMethod, GenericType, NormType, extendMeta} from '../../../core/';
import { Decoder, Encoder } from '../common';
import {decodeTransform, encodeTransform, getTransformType} from '../transform';

const binaryEncoderNamespaceSymbol = Symbol('binaryEncoderNamespaceSymbol');

type MetaData = {
    encoder: Encoder<any, ArrayBuffer>;
    decoder: Decoder<any, ArrayBuffer>;
}

declare module '../../../core/' {
    export interface Meta {
        [binaryEncoderNamespaceSymbol]?: MetaData;
    }

    export interface Methods {
        setBinaryEncoder: typeof setBinaryEncoder;
    }
}

const classEncoders = new WeakMap<any, {encoder: (data: any) => any, decoder: (data: any) => any}>();

defineExtensionMethod('setBinaryEncoder', setBinaryEncoder);

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

function setBinaryEncoder<T extends Type<any, any> | GenericType<any>>(this: T, encoder: Encoder<NormType<T>, ArrayBuffer>, decoder: Decoder<NormType<T>, ArrayBuffer>): T {
    return extendMeta(this, binaryEncoderNamespaceSymbol, {
        ...this.getMeta()[binaryEncoderNamespaceSymbol],
        encoder,
        decoder,
    });
}

export function encodeBinary<T extends Type<any, any>>(type: T, data: ResolveType<T>): ArrayBuffer {
    const transformType = getTransformType(type);
    if (transformType) {
        return encodeBinary(transformType, encodeTransform(type, data))
    }

    const meta = type.getMeta()[binaryEncoderNamespaceSymbol];
    if (!meta) {
        throw new Error(`No encoder set up for type ${type.typeName}`);
    }
    const {encoder} = meta;
    return encoder(type, data);
}

export function decodeBinary<T extends Type<any, any>>(type: T, serialized: ArrayBuffer): ResolveType<T> {
    const transformType = getTransformType(type);
    if (transformType) {
        return decodeBinary(transformType, decodeTransform(type, serialized as any));
    }

    const meta = type.getMeta()[binaryEncoderNamespaceSymbol];
    if (!meta) {
        throw new Error(`No encoder set up for type ${type.typeName}`);
    }
    const {decoder} = meta;
    return decoder(type, serialized) as any;
}
