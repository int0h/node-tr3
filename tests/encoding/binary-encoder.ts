import test from 'tape';
import {t} from '../../types/withAll';
import {decodeBinary, encodeBinary} from '../../extensions/all';
import { ResolveType, Type } from '../../src/core';

test('ecnoding of basic types', q => {
    const c = <T extends Type<any, any>>(type: T, value: ResolveType<T>) => {
        const encoded = encodeBinary(type, value);
        const decoded = decodeBinary(type, encoded);
        q.deepEqual(decoded, value);
    };


    c(t.int, 10);;
    c(t.number, 10);
    c(t.number, 0);
    c(t.number, -1);
    c(t.number, NaN);
    c(t.number, Infinity);

    c(t.string, 'abc');
    c(t.string, '');

    c(t.boolean, false);
    c(t.boolean, true);

    const literal = {a: 1};
    c(t.literal(literal), literal);

    c(t.object({a: t.number}), {a: 1});
    c(t.array(t.number), [1]);

    q.end();
});
