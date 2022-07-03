import { ISocket, ISocketClient } from "../../msg-mgr";

export type BrowserSocketClientParams = {
    url: string;
    payloadType: 'text' | 'binary';
};

export const makeBrowserSocketClient = (params: BrowserSocketClientParams): ISocketClient<string | ArrayBuffer> => {
    return {
        connect: (handler) => {
            const wsc = new WebSocket(params.url);
            if (params.payloadType === 'binary') {
                wsc.binaryType = 'arraybuffer';
            }
            wsc.onopen = () => {
                const socket: ISocket<string | ArrayBuffer> = {
                    onClose: (handler) => {
                        wsc.addEventListener('close', handler);
                        return () => wsc.removeEventListener('close', handler);
                    },
                    close: () => wsc.close(),
                    send: (msg) => wsc.send(msg),
                    subscribe: (fn) => {
                        const listener = (e: WebSocketEventMap['message']) => {
                            fn(e.data);
                        };
                        wsc.addEventListener('message', listener);
                        return () => {
                            wsc.removeEventListener('message', listener);
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