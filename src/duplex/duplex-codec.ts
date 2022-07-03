import {FnMgr} from './fn-mgr';
import {MsgRequester} from './msg-requester';
import {FnCodec} from './fn-codec';
import { IFnCodec } from './codec';
import { Codec } from '../extensions/codecs/common';
import { extractAsyncFnReturnType, extractFnArgsType } from '../rtti-utils/fn';

type Params<P> = {
    msgRequester: MsgRequester<P>;
    payloadCodec: Codec<P>;
    guard: (type: any, fn: any) => any;
};

export function createDuplexCodec<P>(params: Params<P>) {
    const {msgRequester, payloadCodec} = params;
    const fnMgr = new FnMgr();
    const fnCodec = new FnCodec<P>({
        fnMgr,
        msgRequester,
        payloadCodec: {
            encodePayload: (type, payload) => payloadCodec.encode(type, payload),
            decodePayload: (type, data) => payloadCodec.decode(type, data),
        }
    });
    const duplexCodec: IFnCodec = {
        encodeFn: (type, value) => fnCodec.regFn(extractFnArgsType(type), extractAsyncFnReturnType(type), value),
        decodeFn: (type, value) => params.guard(type, fnCodec.parseFn(extractFnArgsType(type), extractAsyncFnReturnType(type), value)),
    };
    const destroyDuplexCodec = () => {
        fnCodec.destroy();
        msgRequester.destroy();
        fnMgr.destroy();
    }
    return {duplexCodec, destroyDuplexCodec};
}