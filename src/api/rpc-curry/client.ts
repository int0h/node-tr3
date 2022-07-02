import {AsyncApi, ResolveApi} from '..';
import { decodeJs, encodeJs, guard } from '../../extensions/all';

type Params = {
    fetcher: typeof fetch;
    baseUrl: string;
}

export function initClientApi<A extends AsyncApi>(apiSchema: A, params: Params): ResolveApi<A> {
    const res: any = {};
    for (const key of Object.keys(apiSchema)) {
        const fn = async function (...args: any[]) {
            const encodedArgs = encodeJs(apiSchema[key].param.args, args);
            const apiResponse: {ok: true, result: any} | {ok: false, error: string} = await params.fetcher(params.baseUrl + '/' + key, {
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(encodedArgs),
                method: 'PUT',
            }).then(r => r.json());

            if (apiResponse.ok) {
                const decodedResult = decodeJs(apiSchema[key].param.returns.param.type, apiResponse.result);
                return decodedResult;
            } else {
                throw new Error(apiResponse.error)
            }
        };

        res[key] = guard(apiSchema[key], fn);
    }
    return res;
}