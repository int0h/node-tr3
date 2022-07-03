import {AsyncApi, ResolveApi, AsyncMethodType} from '../../../../api';
import { ResolveType, Type } from '../../../core';
import { guard, validateData } from '../../../extensions/validate';
import { Codec } from '../../../extensions/codecs/common';
import { duplexCodecScope } from '../../codec';
import { createDuplexCodec } from '../../duplex-codec';
import { ISocket, ISocketClient, MsgCodec, MsgMgr } from '../../msg-mgr';
import { MsgRequester } from '../../msg-requester';
import { extractAsyncFnReturnType, extractFnArgsType } from '../../../rtti-utils/fn';

type ProxyDuplexFnParmas<F extends AsyncMethodType, P> = {
    fnType: F;
    methodName: string;
    msgCodec: MsgCodec<any, P>;
    socketClientImplementation: ISocketClient<any>;
    codec: Codec<any>;
}

export type DuplexController = {
    close: () => void;
    onClose: (handler: () => void) => () => void;
};

const duplexCtrlMap = new WeakMap<Promise<any>, DuplexController>();

function withDuplexCtrl<T extends Promise<any>>(promise: T, dc: DuplexController): T {
    duplexCtrlMap.set(promise, dc);
    return promise;
}

export function getDuplexController(promise: Promise<any>) {
    const found = duplexCtrlMap.get(promise);
    if (!found) {
        throw new Error('duplexController not found');
    }
    return found;
}

export function proxyDuplexFn<F extends AsyncMethodType, P>(params: ProxyDuplexFnParmas<F, P>): ResolveType<F> {
    if (!params.fnType.param.isDuplex) {
        throw new Error('duplex function type expected');
    }

    const fn = (...args: any[]) => {
        // validate input:
        const argsErrors = validateData(extractFnArgsType(params.fnType), args);
        if (argsErrors.length > 0) {
            const err = new Error('invalid arguments');
            (err as any).details = argsErrors;
            throw err;
        }

        let isClosed = false;
        const onCloseListeners = new Set<() => void>();
        const scope: {duplexController: DuplexController} = {
            duplexController: {
                close: () => {
                    isClosed = true;
                    onCloseListeners.forEach(l => l());
                },
                onClose: (handler) => {
                    onCloseListeners.add(handler);
                    return () => onCloseListeners.delete(handler);
                },
            }
        }

        const duplexController: DuplexController = {
            close: () => scope.duplexController.close(),
            onClose: (handler) => scope.duplexController.onClose(handler),
        }

        const resultPromise = new Promise<any>((resolve, reject) => {
            const main = async (ws: ISocket<P>) => {
                if (isClosed) {
                    throw new Error('duplex connection was prematurely closed');
                }
                // prepare:
                const msgMgr = new MsgMgr({
                    msgCodec: params.msgCodec,
                    socketImpl: ws,
                })
                const msgRequester = new MsgRequester({
                    msgMgr,
                });
                const {duplexCodec, destroyDuplexCodec} = createDuplexCodec({msgRequester, payloadCodec: params.codec, guard});

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
                scope.duplexController.close = () => {
                    cleanAll();
                }

                // call
                const encodedArgs = duplexCodecScope(duplexCodec, () => params.codec.encode(extractFnArgsType(params.fnType), args));
                const apiResponse = await msgRequester.callMethod(params.methodName, encodedArgs as any);
                const decodedResult = duplexCodecScope(duplexCodec, () => params.codec.decode(extractAsyncFnReturnType(params.fnType), apiResponse) as any);

                // validateResult:
                const errors = validateData(extractAsyncFnReturnType(params.fnType), decodedResult);
                if (errors.length > 0) {
                    const err = new Error('invalid result of function');
                    (err as any).details = errors;
                    throw err;
                }

                return decodedResult;
            };

            params.socketClientImplementation.connect(ws => {
                main(ws)
                    .then(res => resolve(res))
                    .catch(e => reject(e));
            });
        });

        return withDuplexCtrl(resultPromise, duplexController);
    };

    return fn as any;
}