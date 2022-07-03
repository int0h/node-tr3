import express from 'express';
import { implementCurryApi } from '../../src/api/impl';
import cors from 'cors';

import { customRestApiMiddleware } from '../../src/api/rest/server/curry';
import {apiSchema} from './common';

async function main() {
    const apiImpl = implementCurryApi(apiSchema, {
        repeat: ctx => async (str, n) => str.repeat(n),
        multiply: ctx => async ({a, b}) => a * b,
    });

    const app = express();

    app.use(express.json());

    app.use(cors({
        allowedHeaders: '*',
        methods: '*',
        exposedHeaders: '*',
    }));
    // app.options('*', cors());

    app.use(customRestApiMiddleware({
        apiImpl,
        apiSchema,
        expressNS: express,
        contextProvider: async () => ({}),
    }));

    const server = app.listen(3000);
}

main();