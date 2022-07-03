import { Api, ResolveCurryApi } from "../..";
import express from 'express';
import { ContextProvider } from "../../context";
import { Codec } from "../../../extensions/codecs/common";
import { RpcResponseWrapper } from "../common";
import { extractAsyncFnReturnType, extractFnArgsType } from "../../../rtti-utils/fn";

export {implementCurryApi} from '../../impl';

type MethodMetas<A extends Api> = {
    [K in keyof A]?: {
        maxBodySize?: number | string;
        timeout?: number;
        // below goes to common as they might be used in client
        // httpMethod?: 'post' | 'get' | 'put' | 'patch' | 'delete' | 'options';
        // path:
    }
}

type RegisterApiParams<A extends Api> = {
    expressNS: typeof express;
    apiSchema: A;
    apiImpl: ResolveCurryApi<A>
    codec: Codec<any>;
    contextProvider: ContextProvider;
    payloadType?: 'json' | 'binary';
    basePath?: string;
    methodMetas?: MethodMetas<A>;
};

// type ExpressLikeRouter = {
//     [K in 'post' | 'get' | 'put' | 'patch' | 'delete' | 'options']: (url: string, ...requestHandlers: Array<(req: any, res: any, next: () => void) => any>) => any;
// }

export function apiMiddleware<A extends Api>(params: RegisterApiParams<A>) {
    const {expressNS, apiSchema, apiImpl, codec, contextProvider: getContext, payloadType = 'json'} = params;

    const router = expressNS.Router();

    for (const methodName of Object.keys(apiSchema)) {
        const methodType = apiSchema[methodName];

        if (methodType.param.isDuplex) {
            continue;
        }

        const methodImpl = apiImpl[methodName];
        const meta = params?.methodMetas?.[methodName] ?? {};
        const httpMethod = 'put';
        const matchingPath = methodName;
        if (!/^[a-z0-9_\-\.\~]+$/gi.test(matchingPath)) {
            throw new Error(`Method name '${matchingPath}' is not supported`);
        }
        const fullPath = '/' + matchingPath;

        const expressHandler: express.RequestHandler = async (req, res) => {
            try {
                const args = codec.decode(extractFnArgsType(methodType), req.body);
                const context = await getContext(req) ?? {};
                const result = await methodImpl(context as any).apply(null, args);
                const encoded = codec.encode(extractAsyncFnReturnType(methodType), result);
                res.status(200).json({
                    ok: true,
                    result: encoded,
                } as RpcResponseWrapper);
            } catch(e) {
                res.status(500).json({
                    ok: false,
                    error: e instanceof Error ? e.message : 'unknown error',
                } as RpcResponseWrapper);
            }
        };

        if (payloadType === 'json') {
            const maxBodySize = meta.maxBodySize ?? '100kb';
            router[httpMethod](fullPath, expressNS.json({strict: false, inflate: true, limit: maxBodySize}), expressHandler);
        } else if (payloadType === 'binary') {
            const maxBodySize = meta.maxBodySize ?? '100kb';
            router[httpMethod](fullPath, expressNS.raw({inflate: true, limit: maxBodySize}), expressHandler);
        } else {
            throw new Error(`invalid payloadType: ${payloadType}`);
        }
    }

    return router;
}