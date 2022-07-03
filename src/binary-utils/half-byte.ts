const TextDecoderPolyfill = typeof TextDecoder === 'undefined'
    ? (eval(`require('util')`) as typeof import('util')).TextDecoder
    : TextDecoder;

export function toHalfByte(buffer: ArrayBuffer) {
    const decoder = new TextDecoderPolyfill('utf-8');
    const ta = new Uint8Array(buffer);
    const targetBuf = new Uint8Array(ta.length * 2);
    for (let i = 0; i < ta.length; i++) {
        const byte = ta[i];
        const h = byte >> 4;
        const l = byte & 0b1111;
        targetBuf[i * 2] = h + 97;
        targetBuf[i * 2 + 1] = l + 97;
    }
    return decoder.decode(targetBuf);
}

export function fromHalfByte(str: string): ArrayBuffer {
    const resLen = str.length / 2;
    const res = new Uint8Array(resLen);
    for (let i = 0; i < resLen; i++) {
        const h = str.charCodeAt(i * 2) - 97;
        const l = str.charCodeAt(i * 2 + 1) - 97;
        res[i] = (h << 4) + l;
    }
    return res.buffer;
}