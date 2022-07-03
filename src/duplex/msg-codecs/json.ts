import {Message, MsgCodec} from '../msg-mgr';

export const jsonMsgCodec: MsgCodec<string, any> = {
    encodeMsg: (msg) => {
        return JSON.stringify(msg);
    },
    decodeMsg: (data) => JSON.parse(data) as Message<any>,
}