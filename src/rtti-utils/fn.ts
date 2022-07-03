import { types as t, args, resolves } from "../types";
import { Type } from "../core";

const TFnExample = t.function(args(...[] as any[]), t.unknown);

const TAsyncFnExample = t.function(args(...[] as any[]), t.promise(t.unknown));

type AnyFn = (...args: any[]) => any;

type AnyAsyncFn = (...args: any[]) => Promise<any>;

export type FnTypeMeta = typeof TFnExample;

export type AsyncFnTypeMeta = typeof TAsyncFnExample;

export function extractFnReturnType(fnType: FnTypeMeta) {
    return fnType.param.returns;
}

export function extractAsyncFnReturnType(fnType: AsyncFnTypeMeta) {
    return fnType.param.returns.param.type;
}

export function extractFnArgsType(fnType: AsyncFnTypeMeta) {
    return fnType.param.args;
}