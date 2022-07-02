// class Placeholder {
//     private branded = 'yes';
// };

// export function decycle<T>(fn: (_: Type<Placeholder, unknown>) => Type<T, any>): Dec<T, T> {
//     return 0 as any;
// }


// type Dec<T, R> = {
//     [K in keyof T]: T[K] extends Placeholder
//         ? Dec<R, R>
//         : T[K] extends object
//             ? Dec<T[K], R>
//             : T[K]
// }