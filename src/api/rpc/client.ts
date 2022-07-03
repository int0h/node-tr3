import {AsyncApi, AsyncMethodType, ResolveApi} from '..';
import { ResolveType } from '../../core';
import { guard } from '../../extensions/validate';
import { Codec } from '../../extensions/codecs/common';
import { RpcResponseWrapper } from './common';
import { extractAsyncFnReturnType, extractFnArgsType } from '../../rtti-utils/fn';

type ProxyFetchFnParams<F extends AsyncMethodType> = {
    codec: Codec<any>;
    fetcher: typeof fetch;
    methodName: string;
    baseUrl: string;
    fnType: F;
}

export function proxyFetchFn<F extends AsyncMethodType>(params: ProxyFetchFnParams<F>): ResolveType<F> {
    const {baseUrl, fetcher, codec, fnType, methodName} = params;

    if (fnType.param.isDuplex) {
        throw new Error('duplex functions not supported by rpc');
    }

    const fn = async function (...args: any[]) {
        const encodedArgs = codec.encode(extractFnArgsType(fnType), args);
        const apiResponse: RpcResponseWrapper = await fetcher(baseUrl + '/' + methodName, {
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(encodedArgs),
            method: 'PUT',
        }).then(r => r.json());

        if (apiResponse.ok) {
            const decodedResult = codec.decode(extractAsyncFnReturnType(fnType), apiResponse.result);
            return decodedResult;
        } else {
            throw new Error(apiResponse.error)
        }
    };

    return guard(fnType, fn as any) as ResolveType<F>;
}

type ProxyFetchApiParams<A extends AsyncApi> = {
    apiSchema: A;
    codec: Codec<any>;
    fetcher: typeof fetch;
    baseUrl: string;
}

export function proxyFetchApi<A extends AsyncApi>(params: ProxyFetchApiParams<A>): ResolveApi<A> {
    const {apiSchema, fetcher, baseUrl, codec} = params;

    const res: ResolveApi<A> = {} as any;
    for (const k of Object.keys(apiSchema)) {
        const key = k as keyof A;
        res[key] = proxyFetchFn({
            baseUrl,
            codec,
            fetcher,
            fnType: apiSchema[key],
            methodName: k,
        });
    }

    return res;
}