import express from 'express';
import { AsyncApi, ResolveApi } from '..';
import { getRestCfg } from '../../extensions/rest';

export function connectApiToExpress<A extends AsyncApi>(apiScheme: A, api: ResolveApi<A>): express.Router {
    const router = express.Router();

    for (const [key, fnType] of Object.entries(apiScheme)) {
        const restCfg = getRestCfg(fnType);
        const fn = api[key];

        router[restCfg.method](restCfg.path, async (req, res, next) => {
            const input = {...req.body, ...req.params};
            try {
                const result = await fn(input);
                res.send(result);
            } catch(e) {
                next(e);
            }
        });
    }

    return router;
}
