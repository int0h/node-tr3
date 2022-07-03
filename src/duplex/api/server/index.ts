import {AsyncApi, ResolveCurryApi} from '../../../api';
import { guard } from '../../../extensions/validate';
import { Codec } from '../../../extensions/codecs/common';
import { duplexCodecScope } from '../../codec';
import { ISocketServer, MsgCodec, MsgMgr } from '../../msg-mgr';
import { MsgRequester } from '../../msg-requester';
import { ContextProvider} from '../../../api/context';
import { createDuplexCodec } from '../../duplex-codec';
import { extractAsyncFnReturnType, extractFnArgsType } from '../../../rtti-utils/fn';

export {implementCurryApi} from '../../../api/impl';

declare module '../../../api/context' {
    export interface Context {
        duplex?: DuplexCtx;
    }
}

type initDuplexApiServerParams<A extends AsyncApi, P> = {
    socketServerImplementation: ISocketServer<P>;
    codec: Codec<P>;
    msgCodec: MsgCodec<any, P>;
    apiSchema: A,
    apiImpl: ResolveCurryApi<A>;
    contextProvider: ContextProvider;
}

type DuplexCtx = {
    onClose: (handler: () => void) => () => void;
    close: () => void;
    keepAlive: () => void;
}

export function initDuplexApiServer<A extends AsyncApi, P>(params: initDuplexApiServerParams<A, P>) {
    params.socketServerImplementation.subscribeConnection((ws, req) => {
        // prepare:
        const msgMgr = new MsgMgr({
            msgCodec: params.msgCodec,
            socketImpl: ws,
        });
        const msgRequester = new MsgRequester({
            msgMgr,
        });
        const {duplexCodec, destroyDuplexCodec} = createDuplexCodec({msgRequester, payloadCodec: params.codec, guard});

        // clean up stuff
        const onCloseListeners = new Set<() => void>();
        let shouldKeepAlive = false;
        const closeSocket = () => {
            ws.close();
        };
        const freeResources = () => {
            msgMgr.kill();
            msgRequester.destroy();
            destroyDuplexCodec();
        }
        const cleanAll = () => {
            closeSocket();
            freeResources();
            notifyClose();
        }
        const notifyClose = () => {
            onCloseListeners.forEach(l => {
                l();
                onCloseListeners.delete(l);
            });
        };
        ws.onClose(() => {
            freeResources();
            notifyClose();
        });

        // duplex ctx:
        const duplexCtx: DuplexCtx = {
            close: () => cleanAll(),
            keepAlive: () => {
                shouldKeepAlive = true;
            },
            onClose: (handler) => {
                onCloseListeners.add(handler);
                return () => onCloseListeners.delete(handler);
            },
        };

        // listen:
        msgRequester.subscribeMethod(async (methodName, args): Promise<P> => {
            // validation:
            const fnType = params.apiSchema[methodName];
            if (!fnType) {
                throw new Error(`method definition ${methodName} is not found`);
            }

            if (!fnType.param.isDuplex) {
                throw new Error('duplex function type expected');
            }

            const fnImpl = params.apiImpl[methodName];
            if (!fnImpl) {
                throw new Error(`method implementation ${methodName} is not found`);
            }

            // ctx:
            const ctx = await params.contextProvider(req);
            ctx.duplex = duplexCtx;

            // guard and bind ctx:
            const impl = guard(fnType, fnImpl(ctx as any));

            // call:
            const decodedArgs = duplexCodecScope(duplexCodec, () => params.codec.decode(extractFnArgsType(fnType), args));

            try {
                const implFnResult = await impl(...decodedArgs);
                if (!shouldKeepAlive) {
                    setTimeout(() => cleanAll(), 0);
                }
                const encodedResult = duplexCodecScope(duplexCodec, () => params.codec.encode(extractAsyncFnReturnType(fnType), implFnResult));
                return encodedResult;
            } catch(e) {
                cleanAll();
                throw e;
            }
        });
    });
}
