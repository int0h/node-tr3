// import {mapType, traverseType} from '.';
// import {basicTypes} from '../../basic-types';
// import RandExp from "randexp";
// import { GenericType, Type } from '../../core';

// function objMap(obj: any, fn: (value: any, key: string) => any): any {
//     const res: any = {};
//     for (const key of Object.keys(obj)) {
//         res[key] = fn(obj[key], key);
//     }
//     return res;
// }

// const unknownVariants = [{}, {a: 123}, 'hello', NaN, undefined, 1, Infinity, () => {}, class {}, /a-z/, null, undefined];

// const randexpCache = new WeakMap<Type<any, any> | GenericType<any>, RandExp>();

// export function basicMockers(t: typeof basicTypes): typeof basicTypes {
//     return {
//         number: t.number,
//         string: t.string,
//         boolean: t.boolean,
//         bigint: t.bigint,
//         symbol: t.symbol,

//         array: t.array
//             .setTypeTraverser((type, fn) => {
//                 fn(type.param.itemType, '0');
//             })
//             .setTypeMapper((type, fn) => {
//                 const cloned = type.clone();
//                 return cloned.setParam({
//                     itemType: fn(type.param.itemType, '0'),
//                 });
//             }),

//         tuple: t.tuple
//             .setTypeTraverser((type, fn) => {
//                 type.param.items.forEach((type, index) => {
//                     fn(type, String(index));
//                 });
//             })
//             .setTypeMapper((type, fn) => {
//                 const cloned = type.clone();
//                 const items = cloned.param.items.map((itemType, index) => {
//                     return fn(itemType, String(index));
//                 })
//                 return cloned.setParam({items});
//             }),

//         object: t.object.setMocker('basic', (type, {indexer, strategy}) => {
//             indexer();
//             return objMap(type.param.shape, (propType, key) => {
//                 return mockData(propType, {strategy, indexer});
//             });
//         }),

//         record: t.record.setMocker('basic', (type, {indexer, strategy}) => {
//             const keys = mockData(t.array(t.string), {strategy, indexer});
//             indexer();
//             const res: any = {};
//             for (const key of keys) {
//                 res[key] = mockData(type.param.valueType, {strategy, indexer});
//             }
//             return res;
//         }),

//         oneOf: t.oneOf.setMocker('basic', (type, {indexer, strategy}) => {
//             const variant = indexer() % type.param.variants.length;
//             return mockData(type.param.variants[variant], {indexer, strategy});
//         }),

//         enum: t.enum.setMocker('basic', (type, {indexer, strategy}) => {
//             const vars = Object.keys(type.param.variantMap);
//             const variant = indexer() % vars.length;
//             return vars[variant];
//         }),

//         function: t.function.setMocker('basic', (type, {indexer, strategy}) => {
//             indexer();
//             return () => {
//                 return mockData(type.param.returns, {indexer, strategy});
//             };
//         }),

//         instance: t.instance.setMocker('basic', (type, params) => {
//             return mockInstance(type.param.Class, params);
//         }),

//         jsonLike: t.jsonLike.setMocker('basic', () => ({})),

//         literal: t.literal.setMocker('basic', (type) => type.param.literal),

//         unknown: t.unknown.setMocker('basic', (type, {indexer}) => {
//             const index = indexer() % unknownVariants.length;
//             return unknownVariants[index];
//         }),

//         promise: t.promise.setMocker('basic', (type, {indexer, strategy}) => {
//             indexer();
//             return new Promise(resolve => {
//                 setTimeout(() => {
//                     resolve(mockData(type.param.type, {indexer, strategy}));
//                 }, 0);
//             });
//         }),


//         fn: t.fn, // fallback to function
//         null: t.null,
//         opt: t.opt,
//         undefined: t.undefined,
//         void: t.void,
//         partial: t.partial,
//         byte: t.byte,
//         int: t.int,
//         float: t.float,
//         uint: t.uint,


//         // classes
//         date: t.date,
//         regexp: t.regexp,
//     };
// }

// defineClassMocker(Date, ({indexer}) => {
//     const base = 1577836800000; //Wed Jan 01 2020 01:00:00 GMT+0100
//     const shift = (indexer() % 365) * 24 * 60 * 60 * 1000;
//     const date = new Date();
//     date.setTime(base + shift);
//     return date;
// });

// defineClassMocker(RegExp, ({indexer}) => {
//     return indexer() % 2 === 0 ? /a-z/ : /1-9/g;
// });