import {decodeJs, encodeJs} from '../../extensions/encode/js-encode';
import {guard} from '../../extensions/validate';
import {AsyncApi, ResolveApi} from '..';
import { ResolveType, Type } from '../../core';
import {getRestCfg} from '../../extensions/rest';
import pathToRegexp, { compile } from 'path-to-regexp';

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
    const serialize = compile(p, {
        encode: encodeURIComponent,
    });
    pathToRegexpCache[p] = {keys, serialize};
    return pathToRegexpCache[p];
}

export function implementClientRestMethod<T extends Type<(data: any) => Promise<any>, any>>(type: T, implCfg: ImplementRestClientCfg): ResolveType<T> {
    const restCfg = getRestCfg(type);
    const fn = async (arg: any): Promise<any> => {
        const fetchParams: RequestInit = {
            method: restCfg.method,
            headers: {},
        };

        const bodyParams = {...arg};

        const {keys, serialize} = processPath(restCfg.path);
        const pathParams: any = {};
        for (const key of keys) {
            delete bodyParams[key];
            pathParams[key] = arg[key];
        }
        const path = serialize(pathParams);

        if (restCfg.body === 'json') {
            (fetchParams.headers as Record<string, string>)['Content-Type'] = 'application/json';
            const encodedArg = encodeJs(type.param.args[0], bodyParams);
            fetchParams.body = JSON.stringify(encodedArg);
        }

        const response = await implCfg.fetchFn(implCfg.baseUrl + path, fetchParams);
        const parsedResponse = await response.json();
        const decodedResult = decodeJs(type.param.returns, parsedResponse);

        return decodedResult;
    };

    return guard(type, fn as any);
}

export function implementRestClientApi<T extends AsyncApi>(apiCfg: T, implCfg: ImplementRestClientCfg): ResolveApi<T> {
    const res = {} as any;
    for (const key of Object.keys(apiCfg)) {
        res[key] = implementClientRestMethod(apiCfg[key], implCfg);
    }
    return res;
}