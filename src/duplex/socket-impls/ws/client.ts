import {WebSocket, MessageEvent} from 'ws';
import { ISocket, ISocketClient } from "../../msg-mgr";

export type WsClientParams = {
    url: string;
};

export const makeWsClient = (params: WsClientParams): ISocketClient<string | ArrayBuffer> => {
    return {
        connect: (handler) => {
            const wsc = new WebSocket(params.url);
            wsc.onopen = () => {
                const socket: ISocket<string | ArrayBuffer> = {
                    onClose: (handler) => {
                        wsc.addEventListener('close', handler);
                        return () => wsc.removeEventListener('close', handler);
                    },
                    close: () => wsc.close(),
                    send: (msg) => wsc.send(msg),
                    subscribe: (fn) => {
                        const listener = (e: MessageEvent) => {
                            fn(e.data as any); // TODO: check me
                        };
                        wsc.on('message', listener);
                        return () => {
                            wsc.off('message', listener);
                        };
                    },
                };

                handler(socket);
            };

            return () => {
                wsc.close();
            };
        },
    };
}