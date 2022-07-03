import {guard} from '../../extensions/validate';
import {AsyncApi, ResolveApi} from '..';
import { ResolveType, Type } from '../../core';
import {getRestCfg} from '../../extensions/rest';
import * as pathToRegexp from 'path-to-regexp';
import { normRestConfig, queryToStr } from './server/common';
import { extractAsyncFnReturnType, extractFnArgsType } from '../../rtti-utils/fn';

type ImplementRestClientCfg = {
    fetchFn: typeof fetch,
    baseUrl: string;
}

type PathMeta = {
    keys: string[];
    serialize: (data: any) => string;
};

const pathToRegexpCache: Record<string, PathMeta> = {};

function processPath(p: string): PathMeta {
    const cached = pathToRegexpCache[p];
    if (cached) {
        return cached;
    }
    const keys: string[] = [];
    pathToRegexp.parse(p).forEach(i => {
        if (typeof i === 'object' && typeof i.name === 'string') {
            keys.push(i.name);
        }
    });
    const serialize = pathToRegexp.compile(p, {
        encode: encodeURIComponent,
    });
    pathToRegexpCache[p] = {keys, serialize};
    return pathToRegexpCache[p];
}

function implementClientRestMethod<T extends Type<(data: any) => Promise<any>, any>>(fnType: T, implCfg: ImplementRestClientCfg): ResolveType<T> {
    const restCfg = normRestConfig(getRestCfg(fnType));
    const fn = async (...args: any[]): Promise<any> => {
        const fetchParams: RequestInit = {
            method: restCfg.method,
            headers: {},
        };

        const {serialize} = processPath(restCfg.path);

        const {body = '', params = {}, query, contentType} = restCfg.argsCodec.encode(args, extractFnArgsType(fnType));

        if (body) {
            if (contentType) {
                (fetchParams.headers as Record<string, string>)['Content-Type'] = contentType;
            }
            fetchParams.body = body;
        }

        const path = serialize(params);

        const queryStr = query
            ? '?' + queryToStr(query)
            : '';

        const response = await implCfg.fetchFn(implCfg.baseUrl + path + queryStr, fetchParams);
        if (response.status >= 200 && response.status < 300) {
            const responseText = await response.text();
            const decodedResult = restCfg.responseCodec.decode({
                text: responseText,
                contentType: (response.headers.get('content-type') ?? '').split(';')[0]
            }, extractAsyncFnReturnType(fnType));
            return decodedResult;
        } else {
            const errorMsg = response.headers.get('x-tr3-error');
            if (errorMsg) {
                throw new Error(errorMsg);
            }
            throw new Error(`request to ${path} returned ${response.status} HTTP code`);
        }
    };

    return guard(fnType, fn as any);
}

type ProxyCustomRestApiParams<T extends AsyncApi> = {
    apiSchema: T;
    fetchFn: typeof fetch;
    baseUrl: string;
}

export function proxyCustomRestApi<T extends AsyncApi>(params: ProxyCustomRestApiParams<T>): ResolveApi<T> {
    const {apiSchema, baseUrl, fetchFn} = params;
    const res = {} as any;
    for (const key of Object.keys(apiSchema)) {
        res[key] = implementClientRestMethod(apiSchema[key], {fetchFn, baseUrl});
    }
    return res;
}