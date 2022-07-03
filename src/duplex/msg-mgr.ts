export const messageTypes = {
    methodCallRequest: 0,
    methodResult: 1,
    methodError: 2,
    callbackCallRequest: 3,
    callbackResult: 4,
    callbackError: 5,
} as const;

type MessageTypes = typeof messageTypes;

export type MethodRequestMessage<P> = {
    type: MessageTypes['methodCallRequest'];
    methodName: string;
    args: P;
};

export type MethodResultMessage<P> = {
    type: MessageTypes['methodResult'];
    result: P;
}

export type MethodErrorMessage<P> = {
    type: MessageTypes['methodError'];
    error: string;
}

export type CallbackCallRequestMessage<P> = {
    type: MessageTypes['callbackCallRequest'];
    args: P;
    callbackId: number;
    requestId: number;
}

export type CallbackResultMessage<P> = {
    type: MessageTypes['callbackResult'];
    result: P;
    requestId: number;
}

export type CallbackErrorMessage = {
    type: MessageTypes['callbackError'];
    error: string;
    requestId: number;
}

// export type FreeCallbackMessage = {
//     type: MessageTypes['freeCallback'];
//     callbackId: number;
// }

export type Message<P> = MethodRequestMessage<P>
    | MethodResultMessage<P>
    | MethodErrorMessage<P>
    | CallbackCallRequestMessage<P>
    | CallbackResultMessage<P>
    | CallbackErrorMessage;
    // | FreeCallbackMessage;

export type ISocketServer<P> = {
    subscribeConnection: (handler: (ws: ISocket<P>, req: any) => void) => () => void;
};

export type ISocketClient<P> = {
    connect: (handler: (ws: ISocket<P>) => void) => () => void;
}

export type ISocket<P> = {
    send: (data: P) => void;
    subscribe: (handler: (data: P) => void) => () => void;
    close: () => void;
    onClose: (handler: () => void) => () => void;
}

export type MsgCodec<T, P> = {
    encodeMsg: (msg: Message<P>) => T;
    decodeMsg: (data: T) => Message<P>;
}

type MsgMgrParams<P> = {
    msgCodec: MsgCodec<any, P>;
    socketImpl: ISocket<P>;
}

export class MsgMgr<P> {
    private msgCodec: MsgCodec<any, P>;
    private socket: ISocket<P>;
    private killer = () => {};
    private listeners = new Set<(msg: Message<P>) => void>();

    constructor(params: MsgMgrParams<P>) {
        this.msgCodec = params.msgCodec;
        this.socket = params.socketImpl;

        const unsubscribe = this.socket.subscribe(data => {
            const decoded = this.msgCodec.decodeMsg(data);
            this.listeners.forEach(fn => fn(decoded));
        });
        this.killer = () => unsubscribe();
    }

    subscribe(fn: (msg: Message<P>) => void) {
        this.listeners.add(fn);
        const unsubscribe = () => this.listeners.delete(fn);
        return unsubscribe;
    }

    send(msg: Message<P>): void {
        this.socket.send(this.msgCodec.encodeMsg(msg));
    }

    kill() {
        this.killer();
        this.listeners.clear();
    }
}
