type AnyFn = (...args: any[]) => any;

export class FnMgr {
    private currentCbId = 0;
    private fnMap: Record<number, AnyFn> = {};
    private reverseFnMap = new Map<AnyFn, number>();

    freeFn(fn: AnyFn) {
        const id = this.reverseFnMap.get(fn);
        if (id === undefined) {
            throw new Error(`FnMgr: unknown fn`);
        }
        delete this.fnMap[id];
        this.reverseFnMap.delete(fn);
    }

    destroy() {
        // essentially it's not needed right now.
        // but I'll keep the method in case in the future it will have some real
        // cleaning routines
        this.fnMap = {};
        this.reverseFnMap = new Map();
    }

    regFn(fn: AnyFn): number {
        const cbId = this.currentCbId++;
        this.fnMap[cbId] = fn;
        this.reverseFnMap.set(fn, cbId);
        return cbId;
    }

    parseFn(fnId: number): AnyFn {
        const fn = this.fnMap[fnId];
        if (!fn) {
            throw new Error('invalid callbackId');
        }
        return fn;
    }
}
