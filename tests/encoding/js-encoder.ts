import test from 'tape';
import {t} from 'tr3/types';
import {decodeJs, encodeJs} from 'tr3/extensions/all';

test('encoding of basic types', q => {
    q.is(decodeJs(t.int, encodeJs(t.int, 10)), 10);
    q.is(decodeJs(t.number, encodeJs(t.number, 10)), 10);
    q.is(decodeJs(t.number, encodeJs(t.number, 0)), 0);
    q.is(decodeJs(t.number, encodeJs(t.number, -1)), -1);
    q.is(decodeJs(t.number, encodeJs(t.number, NaN)), NaN);
    q.is(decodeJs(t.number, encodeJs(t.number, Infinity)), Infinity);

    q.is(decodeJs(t.string, encodeJs(t.string, 'abc')), 'abc');
    q.is(decodeJs(t.string, encodeJs(t.string, '')), '');

    q.is(decodeJs(t.boolean, encodeJs(t.boolean, false)), false);
    q.is(decodeJs(t.boolean, encodeJs(t.boolean, true)), true);

    const literal = {a: 1};
    q.is(decodeJs(t.literal(literal), encodeJs(t.literal(literal), literal)), literal);

    q.deepEqual(decodeJs(t.object({a: t.number}), encodeJs(t.object({a: t.number}), {a: 1})), {a: 1});
    q.deepEqual(decodeJs(t.array(t.number), encodeJs(t.array(t.number), [1])), [1]);

    q.end();
});
