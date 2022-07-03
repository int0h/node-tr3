import http from 'http';
import {WebSocketServer, WebSocket} from 'ws';
import { ISocket, ISocketServer } from "../../msg-mgr";

export type WsServerParams = {
    port?: number;
    path?: string;
    server?: http.Server;
};

const a = http.createServer()

export const makeWsServer = (params: WsServerParams): ISocketServer<string | ArrayBuffer> => {
    const wss = new WebSocketServer({
        port: params.port,
        path: params.path,
        server: params.server,
    });
    return {
        subscribeConnection: (handler) => {
            const connectionListener = (ws: WebSocket, req: http.IncomingMessage) => {
                const socket: ISocket<string | ArrayBuffer> = {
                    onClose: (handler) => {
                        ws.addEventListener('close', handler);
                        return () => ws.removeEventListener('close', handler);
                    },
                    close: () => ws.close(),
                    send: (msg) => ws.send(msg),
                    subscribe: (fn) => {
                        const listener = (e: MessageEvent) => {
                            fn(e as any); // TODO: check me
                        };
                        ws.on('message', listener);
                        return () => {
                            ws.off('message', listener);
                        };
                    },
                };

                handler(socket, req);
            };

            wss.on('connection', connectionListener);

            return () => {
                wss.off('connection', connectionListener);
            };
        },
    };
}