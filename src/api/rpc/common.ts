export type RpcResponseWrapper = {
    ok: true;
    result: any;
} | {
    ok: false;
    error: string;
};