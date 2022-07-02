import {ResolveType, Type, defineExtensionMethod, GenericType, NormType, extendMeta} from '../../../core/';
import { Decoder, Encoder } from '../common';
import {decodeTransform, encodeTransform, getTransformType} from '../transform';

const encoderNamespaceSymbol = Symbol('encoderNamespaceSymbol');

type MetaData = {
    encoder: Encoder<any, any>;
    decoder: Decoder<any, any>;
}

declare module '../../../core/' {
    export interface Meta {
        [encoderNamespaceSymbol]?: MetaData;
    }

    export interface Methods {
        setJsEncoder: typeof setJsEncoder;
    }
}

const classEncoders = new WeakMap<any, {encoder: (data: any) => any, decoder: (data: any) => any}>();

defineExtensionMethod('setJsEncoder', setJsEncoder);

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

function setJsEncoder<T extends Type<any, any> | GenericType<any>, S>(this: T, encoder: Encoder<NormType<T>, S>, decoder: Decoder<NormType<T>, S>): T {
    return extendMeta(this, encoderNamespaceSymbol, {
        ...this.getMeta()[encoderNamespaceSymbol],
        encoder,
        decoder,
    });
}

export function encodeJs<T extends Type<any, any>>(type: T, data: ResolveType<T>): unknown {
    const transformType = getTransformType(type);
    if (transformType) {
        return encodeJs(transformType, encodeTransform(type, data))
    }

    const meta = type.getMeta()[encoderNamespaceSymbol];
    if (!meta) {
        throw new Error(`No encoder set up for type ${type.typeName}`);
    }
    const {encoder} = meta;
    return encoder(type, data);
}

export function decodeJs<T extends Type<any, any>>(type: T, serialized: unknown): ResolveType<T> {
    const transformType = getTransformType(type);
    if (transformType) {
        return decodeJs(transformType, decodeTransform(type, serialized as any));
    }

    const meta = type.getMeta()[encoderNamespaceSymbol];
    if (!meta) {
        throw new Error(`No encoder set up for type ${type.typeName}`);
    }
    const {decoder} = meta;
    return decoder(type, serialized) as any;
}
