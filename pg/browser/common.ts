import { args, resolves, t } from "../../types/withAll";

const TNumberCallback = t.fn(args(), () => resolves(t.float));

export const multiply = t.duplexFn(
    args(TNumberCallback, TNumberCallback),

    (a: () => Promise<number>, b: () => Promise<number>) => resolves(t.float),
);

const TItem = t.object({
    price: t.float,
    title: t.string,
    available: t.boolean,
    discount: t.float,
    storageAvaliability: t.object({
        main: t.boolean,
        additional: t.boolean,
    }),
})

export const getItems = t.duplexFn(
    args(),

    () => resolves(t.array(TItem)),
);

const TOnProgressCallback = t.fn(
    args(t.float),
    (progress) => resolves(t.void)
);


const processVideo = t.duplexFn(
    args(TOnProgressCallback),
    (onProgress: (progress: number) => Promise<void>) => resolves(t.void),
)

const TOnMessageCallback = t.fn(
    args(t.string),
    (msg) => resolves(t.void)
);

const listenForMessages = t.duplexFn(
    args(TOnMessageCallback),
    (onMessage) => resolves(t.void),
)

export const apiSchema = {multiply, getItems, processVideo, listenForMessages};



