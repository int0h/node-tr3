import { Api, ResolveCurryApi } from ".";
import { guard } from "../extensions/validate";
import { Context } from "./context";

export function implementCurryApi<T extends Api>(api: T, implementation: ResolveCurryApi<T>): ResolveCurryApi<T> {
    const res = {} as any;
    for (const key of Object.keys(api)) {
        res[key] = (context: Context) => guard(api[key], implementation[key](context));
    }
    return res;
}