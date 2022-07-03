import { proxyCustomRestApi } from "../../src/api/rest/client";
import { apiSchema } from "./common";

const impl = proxyCustomRestApi({
    apiSchema,
    baseUrl: 'http://localhost:3000',
    fetchFn: fetch.bind(window),
});

const w = window as any;

w.impl = impl;