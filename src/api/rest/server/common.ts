import { RestCfg } from "../../../extensions/rest";
import { firstArgJsonArgsCodec, jsonCodecReponseCodec } from "./rest-codecs";

export function queryToStr(query: any) {
    return new URLSearchParams(query).toString();
}

export function strToQuery(str: string) {
    const res = {} as any;
    new URLSearchParams('a=123&b=hi').forEach((value, key) => {
        res[key] = value;
    });
    return res;
}

export function normRestConfig(cfg: RestCfg<any>): Required<RestCfg<any>> {
    return {
        ...cfg,
        argsCodec: cfg.argsCodec ?? firstArgJsonArgsCodec,
        responseCodec: cfg.responseCodec ?? jsonCodecReponseCodec,
    }
}