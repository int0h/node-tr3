import { createSchemaCodec, strToBuffer, u32ToBuf, bufToU32, u8ToBuf, bufToU8, bufferToStr } from '../../binary-utils';
import {Message, messageTypes, MsgCodec} from '../msg-mgr';

const codecs = {
    [messageTypes.methodCallRequest]: createSchemaCodec('methodName', 'args'),
    [messageTypes.methodResult]: createSchemaCodec('result'),
    [messageTypes.methodError]: createSchemaCodec('error'),
    [messageTypes.callbackCallRequest]: createSchemaCodec('callbackId', 'requestId', 'args'),
    [messageTypes.callbackResult]: createSchemaCodec('requestId', 'result'),
    [messageTypes.callbackError]: createSchemaCodec('requestId', 'error'),
}

const encodeBody = (msg: Message<ArrayBuffer>): ArrayBuffer => {
    switch (msg.type) {
        case messageTypes.methodCallRequest:
            return codecs[messageTypes.methodCallRequest].encode({
                args: msg.args,
                methodName: strToBuffer(msg.methodName),
            });
        case messageTypes.methodResult:
            return codecs[messageTypes.methodResult].encode({
                result: msg.result,
            });
        case messageTypes.methodError:
            return codecs[messageTypes.methodError].encode({
                error: strToBuffer(msg.error),
            });
        case messageTypes.callbackCallRequest:
            return codecs[messageTypes.callbackCallRequest].encode({
                args: msg.args,
                callbackId: u32ToBuf(msg.callbackId),
                requestId: u32ToBuf(msg.requestId),
            });
        case messageTypes.callbackResult:
            return codecs[messageTypes.callbackResult].encode({
                result: msg.result,
                requestId: u32ToBuf(msg.requestId),
            });
        case messageTypes.callbackError:
            return codecs[messageTypes.callbackError].encode({
                error: strToBuffer(msg.error),
                requestId: u32ToBuf(msg.requestId),
            });
        default:
            const _: never = msg;
            throw new Error('unknown msg type');
    }
}

const decodeBody = (buf: ArrayBuffer, type: Message<any>['type']): Message<ArrayBuffer> => {
    switch (type) {
        case messageTypes.methodCallRequest: {
            const {args, methodName} = codecs[messageTypes.methodCallRequest].decode(buf);
            return {
                type,
                args,
                methodName: bufferToStr(methodName),
            };
        }
        case messageTypes.methodResult: {
            const {result} = codecs[messageTypes.methodResult].decode(buf);
            return {
                type,
                result,
            };
        }
        case messageTypes.methodError: {
            const {error} = codecs[messageTypes.methodError].decode(buf);
            return {
                type,
                error: bufferToStr(error),
            };
        }
        case messageTypes.callbackCallRequest: {
            const {args, callbackId, requestId} = codecs[messageTypes.callbackCallRequest].decode(buf);
            return {
                type,
                args,
                callbackId: bufToU32(callbackId),
                requestId: bufToU32(requestId),
            };
        }
        case messageTypes.callbackResult: {
            const {requestId, result} = codecs[messageTypes.callbackResult].decode(buf);
            return {
                type,
                requestId: bufToU32(requestId),
                result,
            };
        }
        case messageTypes.callbackError: {
            const {error, requestId} = codecs[messageTypes.callbackError].decode(buf);
            return {
                type,
                requestId: bufToU32(requestId),
                error: bufferToStr(error),
            };
        }
        default:
            const _: never = type;
            throw new Error('unknown msg type');
    }
}

export const binaryMsgCodec: MsgCodec<ArrayBuffer, ArrayBuffer> = {
    encodeMsg: (msg) => {
        const body = encodeBody(msg);
        const res = new Uint8Array(body.byteLength + 1);
        res[0] = msg.type;
        res.set(new Uint8Array(body), 1);
        return res;
    },
    decodeMsg: (data) => {
        const body = data.slice(1);
        const res = decodeBody(body, new Uint8Array(data)[0] as Message<any>['type']);
        return res;
    },
}