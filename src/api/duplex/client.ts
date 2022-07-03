import { AsyncApi, ResolveApi } from "..";
import { proxyDuplexFn } from "../../duplex/api/client";
import { jsonMsgCodec } from "../../duplex/msg-codecs/json";
import { ISocketClient, MsgCodec } from "../../duplex/msg-mgr";
import { makeBrowserSocketClient } from "../../duplex/socket-impls/browser/client";
import { Codec } from "../../extensions/codecs/common";
import { proxyFetchFn } from "../rpc/client";

type ProxyFetchFnParams<A extends AsyncApi> = {
    apiSchema: A;
    codec: Codec<any>;
    baseUrl: string;
    wsUrl: string;
    payloadType?: 'text' | 'binary';
    fetcher?: typeof fetch;
    msgCodec?: MsgCodec<any, any>;
    socketClientImplementation?: ISocketClient<any>;
}

const normProxyFetchFnParams = <A extends AsyncApi>(params: ProxyFetchFnParams<A>): Required<ProxyFetchFnParams<A>> => {
    const payloadType = params.payloadType ?? 'text';
    return {
        ...params,
        payloadType,
        fetcher: params.fetcher ?? fetch,
        msgCodec: params.msgCodec ?? jsonMsgCodec,
        socketClientImplementation: params.socketClientImplementation ?? makeBrowserSocketClient({url: params.wsUrl, payloadType}),
    }
}

export function proxySemiDuplexApi<A extends AsyncApi>(params: ProxyFetchFnParams<A>): ResolveApi<A> {
    const {apiSchema, fetcher, baseUrl, codec, msgCodec, socketClientImplementation} = normProxyFetchFnParams(params);

    const res: ResolveApi<A> = {} as any;
    for (const k of Object.keys(apiSchema)) {
        const key = k as keyof A;
        const fnType = apiSchema[key];

        if (fnType.param.isDuplex) {
            res[key] = proxyDuplexFn({
                codec,
                fnType: apiSchema[key],
                methodName: k,
                msgCodec,
                socketClientImplementation,
            });
        } else {
            res[key] = proxyFetchFn({
                baseUrl,
                codec,
                fetcher,
                fnType: apiSchema[key],
                methodName: k,
            });
        };
    }

    return res;
}