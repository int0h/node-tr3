import test from 'tape';
import express from 'express';

import {t, args, returns} from '../../../types';
import {implementCurryApi, apiMiddleware} from '../../../api/rpc/server/curry';
import { initClientApi } from '../../../api/rpc/client';

const apiScheme = {
    multiply: t.fn(
        args(t.float, t.float),

        (a: number, b: number) => returns(t.promise(t.float)),
    ),

    repeat: t.fn(
        args(t.string, t.uint),

        (a: string, b: number) => returns(t.promise(t.string)),
    ),

    serialize: t.fn(
        args(t.object({a: t.number, b: t.object({c: t.number})})),

        (o: {a: number, b: {c: number}}) => returns(t.promise(t.string)),
    ),
};

const api = implementCurryApi(apiScheme, {
    multiply: ctx => async (a, b) => a * b,
    repeat: ctx => async (str, n) => str.repeat(n),
    serialize: ctx => async (o) => JSON.stringify(o),
});

const initServer = async () => {
    const app = express();

    const port = 3000;

    app.use(await apiMiddleware(express, apiScheme, api, {}));

    return app.listen(port, () => {
        console.log(`Example app listening at http://localhost:${port}`);
    });
};


const initPromise = initServer();


test('e2e: a', async q => {
    const rejects = (message: string, fn: () => Promise<any>) => {
        fn().then(() => q.fail('Did not throw: ' + message)).catch(() => q.pass('Threw: ' + message));
    }

    // :( improvements needed
    const nodeFetch = (await eval(`import('node-fetch')`)).default;

    const server = await initPromise;
    const api = initClientApi(apiScheme, {
        fetcher: nodeFetch as any,
        baseUrl: 'http://localhost:3000',
    });

    q.is(await api.multiply(33, 2), 66);
    rejects('float validation', () => api.multiply(NaN, NaN));

    q.is(await api.repeat('hi', 2), 'hihi');
    rejects('uint validation', () => api.repeat('ha', -1));
    rejects('uint validation', () => api.repeat('ha', 1.5));

    const o = {a: 1, b: {c: 3}};
    q.is(await api.serialize(o), JSON.stringify(o));

    server.close();
    q.end();
});
