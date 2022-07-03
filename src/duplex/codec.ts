import {setTransformCodec} from '../extensions/codecs/transform';
import {types} from '../types';
import { Type } from '../core';

export function withDuplexTransform<T>(t: typeof types): typeof types {
    return {
        ...t,
        function: t.function.extend(type => setTransformCodec(type,
            t.uint,
            (type, fn) => {
                if (!currentDuplexCodec) {
                    throw new Error('not in duplex scope');
                }
                return currentDuplexCodec.encodeFn(type, fn);
            },
            (type, fnId) => {
                if (!currentDuplexCodec) {
                    throw new Error('not in duplex scope');
                }
                return currentDuplexCodec.decodeFn(type, fnId);
            }
        )),
    };
}

type AnyFn = (...args: any[]) => any;

export type IFnCodec = {
    encodeFn: (type: Type<any, any>, fn: AnyFn) => number;
    decodeFn: (type: Type<any, any>, fnId: number) => AnyFn;
};

let currentDuplexCodec: null | IFnCodec = null;

export function duplexCodecScope<F extends () => any>(codec: IFnCodec, fn: F): ReturnType<F> {
    currentDuplexCodec = codec;
    const res = fn();
    currentDuplexCodec = null;
    return res;
}
