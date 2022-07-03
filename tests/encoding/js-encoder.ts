import test from 'tape';
import {t} from '../../types/withAll';
import {decodeJson, encodeJson} from '../../extensions/all';

test('ecnoding of basic types', q => {
    q.is(decodeJson(t.int, encodeJson(t.int, 10)), 10);
    q.is(decodeJson(t.number, encodeJson(t.number, 10)), 10);
    q.is(decodeJson(t.number, encodeJson(t.number, 0)), 0);
    q.is(decodeJson(t.number, encodeJson(t.number, -1)), -1);
    q.is(decodeJson(t.number, encodeJson(t.number, NaN)), NaN);
    q.is(decodeJson(t.number, encodeJson(t.number, Infinity)), Infinity);

    q.is(decodeJson(t.string, encodeJson(t.string, 'abc')), 'abc');
    q.is(decodeJson(t.string, encodeJson(t.string, '')), '');

    q.is(decodeJson(t.boolean, encodeJson(t.boolean, false)), false);
    q.is(decodeJson(t.boolean, encodeJson(t.boolean, true)), true);

    const literal = {a: 1};
    q.is(decodeJson(t.literal(literal), encodeJson(t.literal(literal), literal)), literal);

    q.deepEqual(decodeJson(t.object({a: t.number}), encodeJson(t.object({a: t.number}), {a: 1})), {a: 1});
    q.deepEqual(decodeJson(t.array(t.number), encodeJson(t.array(t.number), [1])), [1]);

    q.end();
});
