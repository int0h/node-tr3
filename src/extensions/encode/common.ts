import {ResolveType, Type} from '../../core/';

export type Encoder<T extends Type<any, any>, S> = (type: T, data: ResolveType<T>) => S;
export type Decoder<T extends Type<any, any>, S> = (type: T, serialized: S) => ResolveType<T>;