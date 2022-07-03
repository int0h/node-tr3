import { args, resolves, t } from "../../types/withAll";
import {} from '../../extensions/all';
import { configireRest } from "../../src/extensions/rest";
import {firstArgJsonArgsCodec,jsonCodecReponseCodec} from '../../extensions/rest';

export const repeat = t.fn(
    args(t.string, t.uint),

    (str: string, n: number) => resolves(t.string),
).extend(type => configireRest(type, {
    method: 'get',
    path: '/repeat-path',
    argsCodec: {
        encode: ([str, n]) => ({
            query: {str, n: String(n)}
        }),
        decode: ({query = {}}) => [query.str, Number(query.n)] as [string, number]
    },
    responseCodec: {
        encode: (text) => ({text}),
        decode: ({text}) => text,
    }
}));

export const multiply = t.fn(
    args(t.object({a: t.number, b: t.number})),

    (arg: {a: number, b: number}) => resolves(t.number),
).extend(type => configireRest(type, {
    method: 'post',
    path: '/repeat-path',
    argsCodec: firstArgJsonArgsCodec,
    responseCodec: jsonCodecReponseCodec,
}));


export const apiSchema = {repeat, multiply};