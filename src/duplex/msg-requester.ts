import {MsgMgr, messageTypes} from './msg-mgr';

type MsgRequesterParams<P> = {
    msgMgr: MsgMgr<P>;
}

export class MsgRequester<P> {
    private msgMgr: MsgMgr<P>;
    private currentRequestId = 0;

    constructor (params: MsgRequesterParams<P>) {
        this.msgMgr = params.msgMgr;
    }

    subscribeMethod(fn: (methodName: string, args: P) => Promise<P>): () => void {
        const unsubscribe = this.msgMgr.subscribe(async msg => {
            if (msg.type !== messageTypes.methodCallRequest) {
                return;
            }
            unsubscribe();
            try {
                const res = await fn(msg.methodName, msg.args);
                this.msgMgr.send({
                    type: messageTypes.methodResult,
                    result: res,
                });
            } catch(e) {
                this.msgMgr.send({
                    type: messageTypes.methodError,
                    error: e instanceof Error ? e.message : 'unknown error',
                });
            }
        });
        return unsubscribe;
    }

    subscribeCallback(callbackId: number, cb: (args: P) => Promise<P>): () => void {
        const unsubscribe = this.msgMgr.subscribe(async msg => {
            if (msg.type !== messageTypes.callbackCallRequest || msg.callbackId !== callbackId) {
                return;
            }
            try {
                const res = await cb(msg.args);
                this.msgMgr.send({
                    type: messageTypes.callbackResult,
                    requestId: msg.requestId,
                    result: res,
                });
            } catch(e) {
                this.msgMgr.send({
                    type: messageTypes.callbackError,
                    requestId: msg.requestId,
                    error: e instanceof Error ? e.message : 'unknown error',
                });
            }
        });
        return unsubscribe;
    }

    callMethod(methodName: string, args: P): Promise<P> {
        return new Promise((resolve, reject) => {
            const unsubscribe = this.msgMgr.subscribe(msg => {
                switch (msg.type) {
                    case messageTypes.methodError:
                        reject(new Error(msg.error));
                        unsubscribe();
                        return;
                    case messageTypes.methodResult:
                        resolve(msg.result);
                        unsubscribe();
                        return;
                    default:
                        return;
                }
            });
            this.msgMgr.send({
                type: messageTypes.methodCallRequest,
                args,
                methodName
            });
        });
    }

    callCallback(callbackId: number, args: P): Promise<P> {
        const requestId = this.currentRequestId++;
        return new Promise((resolve, reject) => {
            const unsubscribe = this.msgMgr.subscribe(msg => {
                if (!('requestId' in msg) || msg.requestId !== requestId) {
                    return;
                }
                switch (msg.type) {
                    case messageTypes.callbackError:
                        reject(new Error(msg.error));
                        unsubscribe();
                        return;
                    case messageTypes.callbackResult:
                        resolve(msg.result);
                        unsubscribe();
                        return;
                    default:
                        return;
                }
            });
            this.msgMgr.send({
                type: messageTypes.callbackCallRequest,
                args,
                callbackId,
                requestId,
            });
        });
    }

    destroy() {
        this.msgMgr.kill();
    }
}