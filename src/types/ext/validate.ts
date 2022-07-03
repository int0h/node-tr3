import {guard, Guardian, setGuardian, setValidator, validateData, validateInstance} from '../../extensions/validate';
import { extractFnArgsType, extractFnReturnType } from '../../rtti-utils/fn';
import {types, encodeLiteral} from '../../types';

const fnThrower = () => {
    return [];
    throw new Error(`it's impossible to validate functions`);
}

const promiseThrower = () => {
    throw new Error(`it's impossible to validate promise`);
}

const fnGuardian: Guardian<any> = (type, fn: any) => {
    if (extractFnReturnType(type).isSubtypeOf(types.promise)) {
        return async function(this: any, ...args: any[]) {
            const argsErrors = validateData(extractFnArgsType(type), args);
            if (argsErrors.length > 0) {
                const err = new Error('invalid arguments');
                (err as any).details = argsErrors;
                throw err;
            }
            const resPromise = fn.apply(this, args);
            return guard(extractFnReturnType(type), resPromise);
        };
    } else {
        return function(this: any, ...args: any[]) {
            const argsErrors = validateData(extractFnArgsType(type), args);
            if (argsErrors.length > 0) {
                const err = new Error('invalid arguments');
                (err as any).details = argsErrors;
                throw err;
            }
            const res = fn.apply(this, args);
            const resultErrors = validateData(extractFnReturnType(type), res);
            if (resultErrors.length > 0) {
                const err = new Error('invalid result of function');
                (err as any).details = resultErrors;
                throw err;
            }
            return res;
        }
    }
};

export function withValidators(t: typeof types): typeof types {
    return {
        number: t.number.extend(type => setValidator(type, (type, data) => {
            if (typeof data !== 'number') {
                return [
                    new Error(`${data} is not a number`),
                ];
            }
            const errors: Error[] = [];
            if (data < type.param.range[0] || data > type.param.range[1]) {
                errors.push(new Error(`Number ${data} is out of range of type ${type.typeName}`));
            }
            if (!Number.isFinite(data) && type.param.onlyFinate) {
                errors.push(new Error(`Type ${type.typeName} can take only finate values (no NaN or Infinity)`));
            }
            if (!Number.isInteger(data) && type.param.onlyInteger) {
                errors.push(new Error(`Type ${type.typeName} can take only integer values`));
            }
            return errors;
        })),

        string: t.string.extend(type => setValidator(type, (type, data) => {
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
        })),

        boolean: t.boolean.extend(type => setValidator(type, (type, data) => typeof data === 'boolean' ? [] : [new Error(`${data} is not a boolean`)])),

        bigint: t.bigint.extend(type => setValidator(type, (type, data) => typeof data === 'bigint' ? [] : [new Error(`${data} is not a bigint`)])),

        symbol: t.symbol.extend(type => setValidator(type, (type, data) => typeof data === 'symbol' ? [] : [new Error(`${String(data)} is not a symbol`)])),

        array: t.array.extend(type => setValidator(type, (type, value, params) => {
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
        })),

        tuple: t.tuple.extend(type => setValidator(type, (type, value, params) => {
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
        })),

        object: t.object.extend(type => setValidator(type, (type, value, params) => {
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
        })),

        record: t.record.extend(type => setValidator(type, (type, value, params) => {
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
        })),

        oneOf: t.oneOf.extend(type => setValidator(type, (type, value, params) => {
            for (const variant of type.param.variants) {
                const errors = validateData(variant, value, {...params, earlyReturn: true});
                if (errors.length === 0) {
                    return [];
                }
            }
            return [new Error(`${value} does not match any variant of oneOf type`)];
        })),

        propUnion: t.propUnion.extend(type => setValidator(type, (type, value, params) => {
            const litValue = value[type.param.trait];
            const variantId = encodeLiteral(litValue);
            const variantType = type.param.variantMap[variantId];
            if (!variantType) {
                throw new Error('propUnion variant not found');
            }
            return validateData(variantType, value, params);
        })),

        enum: t.enum.extend(type => setValidator(type, (type, value) => {
            if (type.param.allowedStrings.has(value)) {
                return [];
            }
            return [new Error(`${value} is not in the list of allowed enum values`)];
        })),

        function: t.function.extend(type => {
            setValidator(type, fnThrower)
            setGuardian(type, fnGuardian)
        }),

        fn: t.fn.extend(type => {
            setValidator(type, fnThrower)
            setGuardian(type, fnGuardian)
        }),

        duplexFn: t.duplexFn.extend(type => {
            setValidator(type, fnThrower)
            setGuardian(type, fnGuardian)
        }),

        duplexFunction: t.duplexFunction.extend(type => {
            setValidator(type, fnThrower)
            setGuardian(type, fnGuardian)
        }),

        instance: t.instance.extend(type => setValidator(type, (type, value, params) => {
            return validateInstance(type.param.Class, value);
        })),

        jsonLike: t.jsonLike.extend(type => setValidator(type, (type, value) => {
            try {
                JSON.stringify(value);
                return [];
            } catch(e) {
                return [new Error(`${value} cannot be JSON serialized`)];
            }
        })),

        literal: t.literal.extend(type => setValidator(type, (type, value) => {
            return value === type.param.literal ? [] : [new Error(`${value} is supposed to be ${type.param.literal}`)];
        })),

        unknown: t.unknown.extend(type => setValidator(type, () => [])),

        promise: t.promise.extend(type => {
            setValidator(type, promiseThrower);
            setGuardian(type, (type, promise) => {
                return promise
                    .then(result => {
                        const errors = validateData(type.param.type, result);
                        if (errors.length > 0) {
                            throw new Error('promise resolved with invalid data');
                        }
                        return result;
                    });
            })
        }),

        typedArray: t.typedArray.extend(type => setValidator(type, (type, value) => {
            return value instanceof type.param.TypedArrayClass ? [] : [new Error(`${value} is supposed to be ${type.param.variant}`)];
        })),

        arrayBuffer: t.arrayBuffer.extend(type => setValidator(type, (type, value) => {
            return value instanceof ArrayBuffer ? [] : [new Error(`${value} is supposed to be ArrayBuffer`)];
        })),
        // fn: t.fn, // fallbacks
        // duplexFn: t.duplexFn,
        // duplexFunction: t.duplexFunction,
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
