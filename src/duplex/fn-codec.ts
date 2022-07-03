import {FnMgr} from './fn-mgr';
import {MsgRequester} from './msg-requester';

type AnyFn = (...args: any[]) => any;

type PayloadCodec<P> = {
    encodePayload: (type: any, data: any) => P;
    decodePayload: (type: any, data: P) => any;
}

function encodeFn(argType: any, resType: any, codec: PayloadCodec<any>, fn: AnyFn) {
    return async (payload: any) => {
        const args = codec.decodePayload(argType, payload);
        const res = await fn(...args);
        const encodedRes = codec.encodePayload(resType, res);
        return encodedRes;
    };
}

type FnEncoderParams<P> = {
    msgRequester: MsgRequester<P>;
    fnMgr: FnMgr;
    payloadCodec: PayloadCodec<P>;
}

export class FnCodec<P> {
    private msgRequester: MsgRequester<P>;
    private fnMgr: FnMgr;
    private payloadCodec: PayloadCodec<P>;

    constructor(params: FnEncoderParams<P>) {
        this.fnMgr = params.fnMgr;
        this.msgRequester = params.msgRequester;
        this.payloadCodec = params.payloadCodec;
    }

    public regFn(argType: any, resType: any, fn: AnyFn): number {
        const cbId = this.fnMgr.regFn(fn);
        this.msgRequester.subscribeCallback(cbId, encodeFn(argType, resType, this.payloadCodec, fn));
        return cbId;
    }

    public parseFn(argType: any, resType: any, cbId: number): AnyFn {
        return async (...args) => {
            const payload = this.payloadCodec.encodePayload(argType, args);
            const res = await this.msgRequester.callCallback(cbId, payload);
            const decodedRes = this.payloadCodec.decodePayload(resType, res);
            return decodedRes;
        }
    }

    destroy() {
        this.fnMgr.destroy();
        this.msgRequester.destroy();
    }
}