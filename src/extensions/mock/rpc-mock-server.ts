import express from 'express';
import { AsyncApi } from "../../api";
import cors from 'cors';
import { mockCurryApi } from '../../extensions/mock';
import { apiMiddleware } from '../../api/rpc/server/curry';
import { jsonCodec } from '../codecs/json';

type Params = {
    apiSchema: AsyncApi;
    port: number;
}

export function createRpcMockServer(params: Params) {
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

    app.use(apiMiddleware({
        apiImpl,
        codec: jsonCodec,
        apiSchema,
        expressNS: express,
        contextProvider: async () => ({} as any),
    }));

    app.listen(port);
}