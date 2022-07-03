import {ResolveType, Type} from '../../core';

export type Encoder<T extends Type<any, any>, S> = (type: T, data: ResolveType<T>) => S;
export type Decoder<T extends Type<any, any>, S> = (type: T, serialized: S) => ResolveType<T>;

export type Codec<P> = {
    encode: <T extends Type<any, any>>(type: T, data: ResolveType<T>) => P;
    decode: <T extends Type<any, any>>(type: T, data: P) => ResolveType<T>;
}