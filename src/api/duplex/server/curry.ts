import {initDuplexApiServer as internalInitDuplexApiServer} from '../../../duplex/api/server';
import { AsyncApi, ResolveCurryApi } from '../..';
import { Codec } from '../../../extensions/codecs/common';
import { ISocketServer, MsgCodec } from '../../../duplex/msg-mgr';
import { ContextProvider } from '../../context';
import { jsonMsgCodec } from '../../../duplex/msg-codecs/json';
import { makeWsServer } from '../../../duplex/socket-impls/ws/server';
import http from 'http';

export {implementCurryApi} from '../../impl';
export {apiMiddleware} from '../../rpc/server/curry';

type InitDuplexApiServerParams<A extends AsyncApi, P> = {
    server: http.Server;
    codec: Codec<P>;
    apiSchema: A,
    apiImpl: ResolveCurryApi<A>;
    contextProvider: ContextProvider;
    wsPath?: string;
    msgCodec?: MsgCodec<any, P>;
    socketServerImplementation?: ISocketServer<P>;
}

const normInitDuplexApiServerParams = <P extends InitDuplexApiServerParams<any, any>>(params: P): Required<P> => {
    const res: Required<InitDuplexApiServerParams<any, any>> = {
        ...params,
        msgCodec: params.msgCodec ?? jsonMsgCodec,
        wsPath: params.wsPath ?? '/ws',
        socketServerImplementation: params.socketServerImplementation ?? makeWsServer({
            path: params.wsPath,
            server: params.server,
        }) as any,
    };

    return res as any;
}

export async function initDuplexApiServer<A extends AsyncApi, P>(params: InitDuplexApiServerParams<A, P>) {
    const {
        apiImpl,
        codec,
        contextProvider,
        apiSchema,
        msgCodec,
        socketServerImplementation,
    } = normInitDuplexApiServerParams(params);

    internalInitDuplexApiServer({
        apiImpl,
        apiSchema,
        codec,
        contextProvider,
        msgCodec,
        socketServerImplementation,
    });
}
