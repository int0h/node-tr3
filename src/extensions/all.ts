import './encode/js-encode';
import './validate';
import './mock';

import {basicEncoders as jsEncoders} from './encode/js-encode/basic-types';
import {basicValidators} from './validate/basic-types';
import {basicMockers} from './mock/basic-types';
import {basicEncoders as binaryEncoders} from './encode/binary/basic-types';

export * from './encode/js-encode';
export * from './validate';
export * from './mock';

import {basicTypes as bt} from '../basic-types';

export const basicTypes = binaryEncoders(jsEncoders(basicMockers(basicValidators(bt))));

export const refineWithAll = (types: typeof bt) => binaryEncoders(jsEncoders(basicMockers(basicValidators(bt))));
// export * from '../basic-types';