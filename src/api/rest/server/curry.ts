import express from 'express';
import { AsyncApi, ResolveCurryApi } from '../..';
import { getRestCfg } from '../../../extensions/rest';
import { extractAsyncFnReturnType, extractFnArgsType } from '../../../rtti-utils/fn';
import { ContextProvider } from '../../context';
import { normRestConfig } from './common';

type ImplementCustomRestApiParams<A extends AsyncApi> = {
    expressNS: typeof express;
    apiSchema: A;
    apiImpl: ResolveCurryApi<A>;
    contextProvider: ContextProvider;
    cors?: '*';
}

export function customRestApiMiddleware<A extends AsyncApi>(params: ImplementCustomRestApiParams<A>): express.Router {
    const {apiImpl, contextProvider, apiSchema, expressNS} = params;

    const router = expressNS.Router();

    for (const [key, fnType] of Object.entries(apiSchema)) {
        const restCfg = normRestConfig(getRestCfg(fnType));
        const fn = apiImpl[key];

        router[restCfg.method](restCfg.path, async (req, res) => {
            try {
                const ctx = contextProvider(req);
                const args = restCfg.argsCodec.decode({
                    body: req.body,
                    contentType: req.headers['content-type'],
                    params: req.params,
                    query: req.query as any,
                }, extractFnArgsType(fnType));
                const result = await fn(ctx as any)(...args);
                const {text, contentType} = restCfg.responseCodec.encode(result, extractAsyncFnReturnType(fnType));
                if (contentType) {
                    res.set('content-type', contentType);
                }
                res.status(200).send(text);
            } catch(e: any) {
                res
                    .set('x-tr3-error', e.message)
                    .status(500)
                    .send();
            }
        });
    }

    return router;
}
