import { getDuplexController, proxySemiDuplexApi } from "../../api/duplex/client";
import { jsonCodec } from "../../extensions/all";
import { binaryMsgCodec } from "../../src/duplex/msg-codecs/binary";
import { binaryCodec } from "../../src/extensions/codecs/binary";
import { apiSchema } from "./common";

const impl = proxySemiDuplexApi({
    apiSchema,
    baseUrl: 'http://localhost:3000/api',
    // codec: jsonCodec,

    codec: binaryCodec,
    msgCodec: binaryMsgCodec,
    payloadType: 'binary',

    wsUrl: 'ws://localhost:3000/ws',
});

const w = window as any;

w.impl = impl;

w.getDuplexController = getDuplexController;
