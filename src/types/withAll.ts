import { withDuplexTransform } from "../duplex/codec";
import { applyExtensions } from "./common";
import { withBinaryCodec } from "./ext/codecs/binary";
import { withJsonCodec } from "./ext/codecs/json";
import { withMock } from "./ext/mock";
import { withValidators } from "./ext/validate";

export const types = applyExtensions([
    withJsonCodec,
    withBinaryCodec,
    withValidators,
    withMock,
    withDuplexTransform,
]);