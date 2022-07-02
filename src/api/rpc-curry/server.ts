import { Api } from "..";
import { ResolveType } from "../../core";
import http from 'http';
import express from 'express';
import { decodeJs, encodeJs } from "../../extensions/encode/js-encode";
import { implementFn } from "../../implement";

export interface Context {};

export type ResolveCurryApi<A extends Api> = {
    [K in keyof A]: (ctx: Context) => ResolveType<A[K]>;
}

type ImplementCurryApiParams = {
    contextProvider: (req: express.Request) => Context;
}

export function implementCurryApi<T extends Api>(api: T, implementation: ResolveCurryApi<T>): ResolveCurryApi<T> {
    const res = {} as any;
    for (const key of Object.keys(api)) {
        res[key] = (context: Context) => implementFn(api[key], implementation[key](context));
    }
    return res;
}

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
    basePath?: string;
    methodMetas?: MethodMetas<A>;
    getContext?: (req: express.Request) => Context;
};

type ExpressLikeRouter = {
    [K in 'post' | 'get' | 'put' | 'patch' | 'delete' | 'options']: (url: string, ...requestHandlers: Array<(req: any, res: any, next: () => void) => any>) => any;
}

export async function apiMiddleware<A extends Api>(expressNS: typeof express, apiSchema: A, curryImplementation: ResolveCurryApi<A>, params?: RegisterApiParams<A>) {
    const router = expressNS.Router();

    for (const methodName of Object.keys(apiSchema)) {
        const methodType = apiSchema[methodName];
        const methodImpl = curryImplementation[methodName];
        const meta = params?.methodMetas?.[methodName] ?? {};
        const httpMethod = 'put';
        const matchingPath = methodName;
        if (!/^[a-z0-9_\-\.\~]+$/gi.test(matchingPath)) {
            throw new Error(`Method name '${matchingPath}' is not supported`);
        }
        const fullPath = '/' + matchingPath;
        const maxBodySize = meta.maxBodySize ?? '100kb';
        router[httpMethod](fullPath, expressNS.json({strict: false, inflate: true, limit: maxBodySize}), async (req, res) => {
            const args = decodeJs(methodType.param.args, req.body);
            try {
                const context = await params?.getContext?.(req) ?? {};
                const result = await methodImpl(context as any).apply(null, args);
                const encoded = encodeJs(methodType.param.returns.param.type, result);
                res.status(200).json({
                    ok: true,
                    result: encoded,
                });
            } catch(e) {
                res.status(500).json({
                    ok: false,
                    error: e instanceof Error ? e.message : 'unknown error',
                });
            }
        });
    }

    return router;
}