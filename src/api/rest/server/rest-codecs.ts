import { Type } from "../../../core";
import { decodeJson, encodeJson } from "../../../extensions/codecs/json";
import { ArgsCodec, ResponseCodec } from "../../../extensions/rest";

// body as a string
export const textReponseCodec: ResponseCodec<Type<(...args: any[]) => Promise<string>, any>> = {
    encode: (text) => ({text, contentType: 'text/plain'}),
    decode: ({text}) => text,
};

// body as plain JSON (no tr3 codecs here i.e. dates are not working)
export const plainJsonReponseCodec: ResponseCodec<Type<(...args: any[]) => Promise<any>, any>> = {
    encode: (obj) => ({text: JSON.stringify(obj) , contentType: 'application/json'}),
    decode: ({text}) => JSON.parse(text),
};

// jsonCodec body
export const jsonCodecReponseCodec: ResponseCodec<Type<(...args: any[]) => Promise<any>, any>> = {
    encode: (value, type) => ({
        text: JSON.stringify(encodeJson(type, value)),
        contentType: 'application/json',
    }),
    decode: (value, type) => decodeJson(type, JSON.parse(value.text)),
};

// void response
export const voidResponseCodec: ResponseCodec<Type<() => Promise<void>, any>> = {
    encode: (value, type) => ({text: ''}),
    decode: (value, type) => undefined,
}

// first argument is treated by jsonCodec and always send in body
export const firstArgJsonArgsCodec: ArgsCodec<Type<(arg: any) => Promise<any>, any>> = {
    encode: (value, type) => {
        const jsonArgs = encodeJson(type, value) as any[];
        if (jsonArgs.length === 0) {
            return {};
        }
        const body = JSON.stringify(jsonArgs[0]);
        return {body, contentType: 'application/json'};
    },
    decode: (value, type) => {
        const body = value.body;
        if (!body) {
            throw new Error('body is required');
        }
        const parsed = typeof body === 'string'
            ? JSON.parse(body)
            : body;
        return decodeJson(type, [parsed]);
    },
}

// first argument is treated as simple Map<string, string>
export const firstArgQueryArgsCodec: ArgsCodec<Type<(arg: Record<string, string>) => Promise<any>, any>> = {
    encode: (value, type) => ({query: value[0]}),
    decode: (value, type) => [value.query!],
}

// no args
export const zeroArgsCodec: ArgsCodec<Type<() => Promise<any>, any>> = {
    encode: (value, type) => ({}),
    decode: (value, type) => [],
}