(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.bench = {})));
}(this, (function (exports) { 'use strict';

function Module(imports) {
    const { emitMapping1, emitMapping4, emitMapping5, emitNewline } = imports.env;
    const asciiToUint6 = new Uint8Array(127);
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach((char, i) => {
        asciiToUint6[char.charCodeAt(0)] = i;
    });
    function decodeVLQ(reader) {
        let num = 0;
        let shift = 0;
        let digit = 0;
        let cont = 0;
        let negate = 0;
        do {
            digit = asciiToUint6[reader.bytes[reader.pos++] & 0x7F];
            cont = digit & 32;
            digit = digit & 31;
            if (shift == 0) {
                negate = digit & 1;
                num = digit >> 1;
                shift = 4;
            }
            else {
                num |= digit << shift;
                shift += 5;
            }
        } while (cont && shift < 30);
        return negate ? -num : num;
    }
    function emitMapping(fieldCount, column, source, sourceLine, sourceColumn, name) {
        switch (fieldCount) {
            case 1:
                emitMapping1(column);
                break;
            case 4:
                emitMapping4(column, source, sourceLine, sourceColumn);
                break;
            case 5:
                emitMapping5(column, source, sourceLine, sourceColumn, name);
                break;
        }
    }
    function decode(reader) {
        let byte;
        let fieldCount = 0;
        let column = 0;
        let source = 0;
        let sourceLine = 0;
        let sourceColumn = 0;
        let name = 0;
        let value = 0;
        while ((byte = reader.bytes[reader.pos]) != 0) {
            switch (byte) {
                case 59:// semicolon
                    if (fieldCount > 0) {
                        emitMapping(fieldCount, column, source, sourceLine, sourceColumn, name);
                    }
                    emitNewline();
                    column = 0;
                    fieldCount = 0;
                    reader.pos++;
                    break;
                case 44:// comma
                    emitMapping(fieldCount, column, source, sourceLine, sourceColumn, name);
                    fieldCount = 0;
                    reader.pos++;
                    break;
                default:
                    value = decodeVLQ(reader);
                    switch (fieldCount) {
                        case 0:
                            column += value;
                            fieldCount = 1;
                            break;
                        case 1:
                            source += value;
                            fieldCount = 2;
                            break;
                        case 2:
                            sourceLine += value;
                            fieldCount = 3;
                            break;
                        case 3:
                            sourceColumn += value;
                            fieldCount = 4;
                            break;
                        case 4:
                            name += value;
                            fieldCount = 5;
                            break;
                    }
                    break;
            }
        }
        if (fieldCount > 0) {
            emitMapping(fieldCount, column, source, sourceLine, sourceColumn, name);
        }
    }
    return { decode };
}

var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class JsDecoder {
    constructor(imports) {
        this._decode = Module(imports).decode;
    }
    decode(mappings) {
        const bytes = new Uint8Array(mappings.length + 1);
        for (let i = 0; i < mappings.length; i++) {
            bytes[i] = mappings.charCodeAt(i);
        }
        this._decode({ bytes, pos: 0 });
    }
}
// tslint:disable-next-line:max-classes-per-file
class WasmDecoder {
    constructor(mod) {
        const { memory, decode } = mod.exports;
        this._memory = memory;
        this._decode = decode;
    }
    decode(mappings) {
        this._writeReader(512, mappings);
        this._decode(512);
    }
    _writeReader(ptr, mappings) {
        const strPtr = ptr + (4 << 2);
        this._ensureMem(strPtr + mappings.length + 1);
        const heap32 = new Int32Array(this._memory.buffer);
        heap32[(ptr >> 2)] = 0;
        heap32[(ptr >> 2) + 1] = strPtr;
        heap32[(ptr >> 2) + 2] = mappings.length;
        this._writeString(strPtr, mappings);
    }
    _ensureMem(want) {
        const needed = want - this._memory.buffer.byteLength;
        if (needed > 0) {
            const pages = Math.ceil(needed / 65536);
            this._memory.grow(pages);
        }
    }
    _writeString(ptr, str) {
        const bytes = new Uint8Array(this._memory.buffer);
        for (let i = 0; i < str.length; i++) {
            bytes[ptr + i] = str.charCodeAt(i);
        }
    }
}
function createJsDecoderFactory() {
    return {
        create(imports) {
            const decoder = new JsDecoder(imports);
            return Promise.resolve(decoder);
        },
    };
}
function createWasmDecoderFactory(buffer) {
    return {
        create(imports) {
            return WebAssembly.compile(buffer).then((mod) => {
                const wasmModule = new WebAssembly.Instance(mod, imports);
                const decoder = new WasmDecoder(wasmModule);
                return decoder;
            });
        },
    };
}
class CountDelegate {
    constructor() {
        this.lines = 1;
    }
    reset() {
        this.lines = 1;
    }
    validate() {
        if (this.lines !== 379201) {
            throw new Error("mappings incorect");
        }
    }
    emitNewline() {
        this.lines++;
    }
    emitMapping1(_col) {
        // noop
    }
    emitMapping4(_col, _src, _srcLine, _srcCol) {
        // noop
    }
    emitMapping5(_col, _src, _srcLine, _srcCol, _name) {
        // noop
    }
}
class MappingDelegate {
    constructor() {
        this.currentLine = [];
        this.mappings = [this.currentLine];
    }
    reset() {
        this.currentLine.length = 0;
        this.mappings.length = 1;
    }
    validate() {
        if (this.mappings.length !== 379201) {
            throw new Error("mappings incorect");
        }
    }
    emitNewline() {
        this.mappings.push(this.currentLine = []);
    }
    emitMapping1(col) {
        this.currentLine.push({
            col,
            fieldCount: 1,
            name: 0,
            src: 0,
            srcCol: 0,
            srcLine: 0,
        });
    }
    emitMapping4(col, src, srcLine, srcCol) {
        this.currentLine.push({
            col,
            fieldCount: 4,
            name: 0,
            src,
            srcCol,
            srcLine,
        });
    }
    emitMapping5(col, src, srcLine, srcCol, name) {
        this.currentLine.push({
            col,
            fieldCount: 5,
            name,
            src,
            srcCol,
            srcLine,
        });
    }
}
function createDecoder(decoderFactory, delegate) {
    const imports = {
        env: {
            emitMapping1: delegate.emitMapping1.bind(delegate),
            emitMapping4: delegate.emitMapping4.bind(delegate),
            emitMapping5: delegate.emitMapping5.bind(delegate),
            emitNewline: delegate.emitNewline.bind(delegate),
        },
    };
    return decoderFactory.create(imports);
}
function createDecoderFactory(host, type) {
    return __awaiter(this, void 0, void 0, function* () {
        if (type === "wasm") {
            const buffer = yield host.readbuffer("out/decode.wasm");
            return createWasmDecoderFactory(buffer);
        }
        if (type === "js") {
            return createJsDecoderFactory();
        }
        throw new Error("unknown decoder type " + type);
    });
}
function createDelegate(type) {
    if (type === "mapping") {
        return new MappingDelegate();
    }
    if (type === "count") {
        return new CountDelegate();
    }
    throw new Error("unknown delegate type " + type);
}
function readMappings(host) {
    return __awaiter(this, void 0, void 0, function* () {
        return JSON.parse(yield host.read("vendor/scala.js.map")).mappings;
    });
}
function run(host, decoderType, delegateType, iterations) {
    return __awaiter(this, void 0, void 0, function* () {
        const factory = yield createDecoderFactory(host, decoderType);
        const delegate = createDelegate(delegateType);
        const mappings = yield readMappings(host);
        const decoder = yield createDecoder(factory, delegate);
        function sample() {
            const start = Date.now();
            decoder.decode(mappings);
            return Date.now() - start;
        }
        delegate.reset();
        // warmup;
        sample();
        delegate.validate();
        delegate.reset();
        for (let i = 0; i < iterations; i++) {
            const ms = sample();
            host.print(`${decoderType}-${delegateType},${i},${ms}`);
            delegate.reset();
            host.gc();
            yield host.delay(10);
        }
    });
}

exports.run = run;

Object.defineProperty(exports, '__esModule', { value: true });

})));
