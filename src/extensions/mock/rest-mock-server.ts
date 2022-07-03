import express from 'express';
import { AsyncApi } from "../../api";
import cors from 'cors';
import { mockCurryApi } from '.';
import { customRestApiMiddleware } from '../../api/rest/server/curry';

type Params = {
    apiSchema: AsyncApi;
    port: number;
}

export function createCustomRestMockServer(params: Params) {
    const {apiSchema, port} = params;

    const app = express();

    const apiImpl = mockCurryApi(apiSchema);

    app.use(express.json());

    app.use(cors({
        allowedHeaders: '*',
        methods: '*',
        exposedHeaders: '*',
    }));

    app.use((req, res, next) => {
        console.log('serving:', req.url);
        if (Object.keys(req.body ?? {}).length > 0) {
            console.log('body', JSON.stringify(req.body, null, 4));
        }
        next();
    });

    app.use(customRestApiMiddleware({
        apiImpl,
        apiSchema,
        expressNS: express,
        contextProvider: async () => ({} as any),
    }));

    app.listen(port);
}