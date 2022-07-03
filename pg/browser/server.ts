import express from 'express';

import {implementCurryApi, apiMiddleware, initDuplexApiServer, ContextProvider} from '../../api/duplex/server/curry';
import { jsonCodec } from '../../extensions/all';
import { binaryMsgCodec } from '../../src/duplex/msg-codecs/binary';
import { binaryCodec } from '../../src/extensions/codecs/binary';
import {apiSchema} from './common';

function vid(onProgress: (n: number) => void) {
    return new Promise<void>(resolve => {
        let i = 0;
        const timer = setInterval(() => {
            onProgress(i);
            console.log(i);
            i += 10;
        }, 1000);
        setTimeout(() => {
            clearInterval(timer);
            resolve();
        }, 12000);
    });
}

async function main() {
    const apiImpl = implementCurryApi(apiSchema, {
        listenForMessages: ctx => async (onMessage) => {
            ctx.duplex!.keepAlive();

            const timer = setInterval(() => {
                onMessage('hi');
            }, 1000);

            ctx.duplex!.onClose(() => {
                clearInterval(timer)
            });
        },
        multiply: ctx => async (getA, getB) => {
            const a = await getA();
            const b = await getB();
            return a * b;
        },
        processVideo: ctx => async (onProgress) => {
            await vid(onProgress);
        },
        getItems: ctx => async () => {
            return [
                {
                    available: true,
                    discount: 0,
                    price: 123,
                    storageAvaliability: {
                        additional: true,
                        main: false,
                    },
                    title: 'abs'
                },
                {
                    available: true,
                    discount: 0,
                    price: 123,
                    storageAvaliability: {
                        additional: true,
                        main: false,
                    },
                    title: 'abs'
                },
                {
                    available: true,
                    discount: 0,
                    price: 123,
                    storageAvaliability: {
                        additional: true,
                        main: false,
                    },
                    title: 'abs'
                },
                {
                    available: true,
                    discount: 0,
                    price: 123,
                    storageAvaliability: {
                        additional: true,
                        main: false,
                    },
                    title: 'abs'
                },
                {
                    available: true,
                    discount: 0,
                    price: 123,
                    storageAvaliability: {
                        additional: true,
                        main: false,
                    },
                    title: 'abs'
                },
                {
                    available: true,
                    discount: 0,
                    price: 123,
                    storageAvaliability: {
                        additional: true,
                        main: false,
                    },
                    title: 'abs'
                }
            ]
        }
    });

    const contextProvider: ContextProvider = async () => ({});

    const app = express();

    app.use(apiMiddleware({
        apiImpl,
        apiSchema,
        // codec: jsonCodec,
        codec: binaryCodec,
        expressNS: express,
        contextProvider,
    }));

    const server = app.listen(3000);

    initDuplexApiServer({
        apiImpl,
        apiSchema,
        // codec: jsonCodec,
        codec: binaryCodec,
        msgCodec: binaryMsgCodec,
        contextProvider,
        server,
    });
}

main();