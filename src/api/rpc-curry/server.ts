import { Api } from "..";
import { ResolveType } from "../../core";
import http from 'http';
import { decodeJs, encodeJs } from "../../extensions/encode/js-encode";
import { implementFn } from "../../implement";

export interface Context {};

export type ResolveCurryApi<A extends Api> = {
    [K in keyof A]: (ctx: Context) => ResolveType<A[K]>;
}

// type ImplementCurryApiParams = {
//     contextProvider: (req: http.IncomingMessage) => Context;
// }

// export function implementCurryApi<T extends Api>(api: T, implementation: ResolveCurryApi<T>): ResolveCurryApi<T> {
//     const res = {} as any;
//     for (const key of Object.keys(api)) {
//         res[key] = (context: Context) => implementFn(api[key], implementation[key](context));
//     }
//     return res;
// }

type MethodMetas<A extends Api> = {
    [K in keyof A]?: {
        maxBodySize?: number;
        timeout?: number;
        // below goes to common as they might be used in client
        // httpMethod?: 'post' | 'get' | 'put' | 'patch' | 'delete' | 'options';
        // path:
    }
}

type RegisterApiParams<A extends Api> = {
    apiSchema: A;
    basePath?: string;
    methodMetas?: MethodMetas<A>;
    getContext?: (req: http.IncomingMessage) => Promise<Context>;
    getBody?: (req: http.IncomingMessage) => Promise<any>;
};

type ExpressLikeRouter = {
    [K in 'post' | 'get' | 'put' | 'patch' | 'delete' | 'options']: (url: string, ...requestHandlers: Array<(req: any, res: any, next: () => void) => any>) => any;
}

const limit100Kb = 2 ** 20 * 100;

class HttpError extends Error {
    safeMessage: string = '';
    httpCode: number = 500;

    constructor(message: string) {
        super(message);
    }
}

function throwHttp(code: number, msg: string): never {
    const err = new HttpError(msg);
    err.safeMessage = msg;
    err.httpCode = code;
    throw err;
}

async function readJsonBody(req: http.IncomingMessage, sizeLimit: number = limit100Kb) {
    let bufSize = 0;
    const buffers = [];

    for await (const c of req) {
        const chunk: Buffer = c;
        buffers.push(chunk);
        bufSize += chunk.length;
        if (bufSize > sizeLimit) {
            throwHttp(400, 'request exceeded body size limit');
        }
    }

    const data = Buffer.concat(buffers).toString();
    return JSON.parse(data);
}

export function createApiMiddleware<A extends Api>(params: RegisterApiParams<A>, curryImplementation: ResolveCurryApi<A>): http.RequestListener {
    const methodsImplemented = {} as any;
    for (const key of Object.keys(params.apiSchema)) {
        methodsImplemented[key] = (context: Context) => implementFn(params.apiSchema[key], curryImplementation[key](context));
    }

    return async (req, res) => {
        try {
            if (req.method !== 'PUT') {
                throwHttp(400, 'invalid HTTP method');
            }
            const urlParsed = new URL(req.url!, 'http://localhost');
            const methodName = urlParsed.pathname.slice(1);
            const methodType = params.apiSchema[methodName];
            if (!methodType) {
                throwHttp(404, `method "${methodName}" not found`);
            }
            const methodImpl = methodsImplemented[methodName];
            const meta = params?.methodMetas?.[methodName] ?? {};
            const body = params?.getBody
                ? await params.getBody(req)
                : await readJsonBody(req, meta.maxBodySize);
            const context = await params?.getContext?.(req) ?? {};
            const args = decodeJs(methodType.param.args, body);
            const result = await methodImpl(context as any).apply(null, args);
            const encodedResult = encodeJs(methodType.param.returns.param.type, result);
            res.statusCode = 200;
            res.end(JSON.stringify({
                ok: true,
                result: encodedResult,
            }));
        } catch(e) {
            if (e instanceof HttpError) {
                res.statusCode = e.httpCode;
                res.end(JSON.stringify({
                    ok: false,
                    error: e.safeMessage,
                }));
                return;
            } else {
                res.statusCode = 500;
                res.end(JSON.stringify({
                    ok: false,
                    error: e instanceof Error ? e.message : 'unknown error',
                }));
            }
        }
    };
}
