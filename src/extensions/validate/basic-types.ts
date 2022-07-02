import {guard, validateData, validateInstance} from '.';
import {basicTypes} from '../../basic-types';

const fnThrower = () => {
    throw new Error(`it's impossible to validate functions`);
}

const promiseThrower = () => {
    throw new Error(`it's impossible to validate promise`);
}

export function basicValidators(t: typeof basicTypes): typeof basicTypes {
    return {
        number: t.number.setValidator((type, data) => {
            if (typeof data !== 'number') {
                return [
                    new Error(`${data} is not a number`),
                ];
            }
            const errors: Error[] = [];
            if (data < type.param.range[0] || data > type.param.range[1]) {
                errors.push(new Error(`Number ${data} is out of range of type ${type.typeName}`));
            }
            if (!Number.isFinite(data) && type.param.onlyFinite) {
                errors.push(new Error(`Type ${type.typeName} can take only finite values (no NaN or Infinity)`));
            }
            if (!Number.isInteger(data) && type.param.onlyInteger) {
                errors.push(new Error(`Type ${type.typeName} can take only integer values`));
            }
            return errors;
        }),

        string: t.string.setValidator((type, data) => {
            if (typeof data !== 'string') {
                return [
                    new Error(`${data} is not a string`),
                ];
            }
            const shortStr = data.length > 50 ? (data.slice(0, 50) + '...') : data;
            const errors: Error[] = [];
            if (data.length < type.param.lengthRange[0] || data.length > type.param.lengthRange[1]) {
                errors.push(new Error(`String "${shortStr}" length is out of range`));
            }
            if (type.param.format && !type.param.format.test(data)) {
                errors.push(new Error(`String "${shortStr}" has wrong format`));
            }
            return errors;
        }),

        boolean: t.boolean.setValidator((type, data) => typeof data === 'boolean' ? [] : [new Error(`${data} is not a boolean`)]),

        bigint: t.bigint.setValidator((type, data) => typeof data === 'bigint' ? [] : [new Error(`${data} is not a bigint`)]),

        symbol: t.symbol.setValidator((type, data) => typeof data === 'symbol' ? [] : [new Error(`${String(data)} is not a symbol`)]),

        array: t.array.setValidator((type, value, params) => {
            if (!Array.isArray(value)) {
                return [new Error(`${value} is not an array`)];
            }
            let errors: Error[] = [];
            for (const item of value) {
                const itemErrors = validateData(type.param.itemType, item, params);
                if (itemErrors.length > 0 && params.earlyReturn) {
                    return itemErrors;
                }
                errors = [...errors, ...itemErrors];
            }
            return errors;
        }),

        tuple: t.tuple.setValidator((type, value, params) => {
            if (!Array.isArray(value)) {
                return [new Error(`${value} is not an array`)];
            }
            if (value.length > type.param.items.length) {
                return [new Error(`${value} contains more elements that it should`)];
            }
            let errors: Error[] = [];
            for (let i = 0; i < type.param.items.length; i++) {
                const itemType = type.param.items[i];
                const item = value[i];
                const itemErrors = validateData(itemType, item, params);
                if (itemErrors.length > 0 && params.earlyReturn) {
                    return itemErrors;
                }
                errors = [...errors, ...itemErrors];
            }
            return errors;
        }),

        object: t.object.setValidator((type, value, params) => {
            if (typeof value !== 'object') {
                return [new Error(`${value} is not an object`)];
            }
            const usedKeys = new Set(Object.keys(value));
            let errors: Error[] = [];
            for (const [key, itemType] of Object.entries(type.param.shape)) {
                usedKeys.delete(key);
                const item = value[key];
                const itemErrors = validateData(itemType, item, params);
                if (itemErrors.length > 0 && params.earlyReturn) {
                    return itemErrors;
                }
                errors = [...errors, ...itemErrors];
            }
            for (const key of usedKeys) {
                const error = new Error(`object ${value} is not supposed to have a property ${key}`);
                if (params.earlyReturn) {
                    return [error];
                }
                errors.push(error);
            }
            return errors;
        }),

        record: t.record.setValidator((type, value, params) => {
            if (typeof value !== 'object') {
                return [new Error(`${value} is not an object`)];
            }
            let errors: Error[] = [];
            for (const [key, item] of Object.entries(value)) {
                const itemErrors = validateData(type.param.valueType, item, params);
                if (itemErrors.length > 0 && params.earlyReturn) {
                    return itemErrors;
                }
                errors = [...errors, ...itemErrors];
            }
            return errors;
        }),

        oneOf: t.oneOf.setValidator((type, value, params) => {
            for (const variant of type.param.variants) {
                const errors = validateData(variant, value, {...params, earlyReturn: true});
                if (errors.length === 0) {
                    return [];
                }
            }
            return [new Error(`${value} does not match any variant of oneOf type`)];
        }),

        enum: t.enum.setValidator((type, value) => {
            if (type.param.allowedStrings.has(value)) {
                return [];
            }
            return [new Error(`${value} is not in the list of allowed enum values`)];
        }),

        function: t.function
            .setValidator(fnThrower)
            .setGuardian((type, fn) => {
                if (type.param.returns.isSubtypeOf(t.promise)) {
                    return async function(this: any, ...args: any[]) {
                        const argsErrors = validateData(type.param.args, args);
                        if (argsErrors.length > 0) {
                            const err = new Error('invalid arguments');
                            (err as any).details = argsErrors;
                            throw err;
                        }
                        const resPromise = fn.apply(this, args);
                        return guard(type.param.returns, resPromise);
                    };
                } else {
                    return function(this: any, ...args: any[]) {
                        const argsErrors = validateData(type.param.args, args);
                        if (argsErrors.length > 0) {
                            const err = new Error('invalid arguments');
                            (err as any).details = argsErrors;
                            throw err;
                        }
                        const res = fn.apply(this, args);
                        const resultErrors = validateData(type.param.returns, res);
                        if (resultErrors.length > 0) {
                            const err = new Error('invalid result of function');
                            (err as any).details = resultErrors;
                            throw err;
                        }
                        return res;
                    }
                }
            }),

        instance: t.instance.setValidator((type, value, params) => {
            return validateInstance(type.param.Class, value);
        }),

        jsonLike: t.jsonLike.setValidator((type, value) => {
            try {
                JSON.stringify(value);
                return [];
            } catch(e) {
                return [new Error(`${value} cannot be JSON serialized`)];
            }
        }),

        literal: t.literal.setValidator((type, value) => {
            return value === type.param.literal ? [] : [new Error(`${value} is supposed to be ${type.param.literal}`)];
        }),

        unknown: t.unknown.setValidator(() => []),

        promise: t.promise
            .setValidator(promiseThrower)
            .setGuardian((type, promise) => {
                return promise
                    .then(result => {
                        const errors = validateData(type.param.type, result);
                        if (errors.length > 0) {
                            throw new Error('promise resolved with invalid data');
                        }
                        return result;
                    });
            }),


        fn: t.fn, // fallbacks
        null: t.null,
        opt: t.opt,
        undefined: t.undefined,
        void: t.void,
        partial: t.partial,
        byte: t.byte,
        int: t.int,
        float: t.float,
        uint: t.uint,


        // classes
        date: t.date,
        regexp: t.regexp,
    };
}
