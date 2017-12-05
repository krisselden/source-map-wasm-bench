export interface Host {
  read(file: string): Promise<string>;
  readbuffer(file: string): Promise<Uint8Array>;
  print(msg: string): void;
  delay(ms: number): Promise<void>;
  gc(): void;
}

interface Reader {
  bytes: Uint8Array;
  pos: number;
}

interface Imports {
  emitNewline(): void;
  emitMapping1(column: number): void;
  emitMapping4(column: number, source: number, sourceLine: number, sourceColumn: number): void;
  emitMapping5(column: number, source: number, sourceLine: number, sourceColumn: number, name: number): void;
}

interface Decoder {
  decode(mappings: string): void;
}

interface DecoderFactory {
  create(imports: Imports): Promise<Decoder>;
}

const asciiToUint6 = new Uint8Array(127);
'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach((char, i) => {
  asciiToUint6[char.charCodeAt(0)] = i;
});

function decodeVLQ(reader: Reader) {
  let num = 0;
  let shift = 0;
  let digit = 0;
  let cont = 0;
  let negate = 0;
  do {
    digit  = asciiToUint6[reader.bytes[reader.pos++] & 0x7F];
    cont   = digit & 32;
    digit  = digit & 31;
    if (shift == 0) {
      negate = digit & 1;
      num = digit >> 1;
      shift = 4;
    } else {
      num |= digit << shift;
      shift += 5;
    }
  } while (cont && shift < 30);
  return negate ? -num : num;
}

class JsDecoder implements Decoder {
  constructor(private imports: Imports) {
  }

  emitMapping(fieldCount: number, column: number, source: number, sourceLine: number, sourceColumn: number, name: number) {
    switch (fieldCount) {
      case 1:
        this.imports.emitMapping1(column);
        break;
      case 4:
        this.imports.emitMapping4(column, source, sourceLine, sourceColumn);
        break;
      case 5:
        this.imports.emitMapping5(column, source, sourceLine, sourceColumn, name);
        break;
    }
  }

  decode(mappings: string) {
    const bytes = new Uint8Array(mappings.length + 1);
    for (let i = 0; i < mappings.length; i++) {
      bytes[i] = mappings.charCodeAt(i);
    }
    this._decode({ bytes, pos: 0 });
  }

  _decode(reader: Reader) {
    let byte: number;
    let fieldCount = 0;
    let column = 0;
    let source = 0;
    let sourceLine = 0;
    let sourceColumn = 0;
    let name = 0;
    let value = 0;

    while ((byte = reader.bytes[reader.pos]) != 0) {
      switch (byte) {
        case 59: // semicolon
          if (fieldCount > 0) {
            this.emitMapping(fieldCount, column, source, sourceLine, sourceColumn, name);
          }
          this.imports.emitNewline();
          column = 0;
          fieldCount = 0;
          reader.pos++;
          break;
        case 44: // comma
          this.emitMapping(fieldCount, column, source, sourceLine, sourceColumn, name);
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
      this.emitMapping(fieldCount, column, source, sourceLine, sourceColumn, name);
    }
  }
}

class WasmDecoder implements Decoder {
  private _memory: WasmMemory;
  private _decode: (ptr: number) => void;

  constructor (mod: WasmModule) {
    const { memory, decode } = mod.exports;
    this._memory = memory;
    this._decode = decode;
  }

  public decode(mappings: string) {
    this._writeReader(512, mappings);
    this._decode(512);
  }

  private _writeReader(ptr: number, mappings: string) {
    const strPtr = ptr + (4 << 2);
    this._ensureMem(strPtr + mappings.length + 1);
    const heap32 = new Int32Array(this._memory.buffer);
    heap32[(ptr >> 2)] = 0;
    heap32[(ptr >> 2) + 1] = strPtr;
    heap32[(ptr >> 2) + 2] = mappings.length;
    this._writeString(strPtr, mappings);
  }

  _ensureMem(needed: number) {
    if (needed > 0) {
      const pages = Math.ceil(needed / 65536);
      this._memory.grow(pages);
    }
  }

  _writeString(ptr: number, str: string) {
    const bytes = new Uint8Array(this._memory.buffer);
    for (let i = 0; i < str.length; i++) {
      bytes[ptr + i] = str.charCodeAt(i);
    }
  }
}

function createJsDecoderFactory(): DecoderFactory {
  return {
    create(imports: Imports) {
      const decoder: Decoder = new JsDecoder(imports);
      return Promise.resolve(decoder);
    }
  };
}

function createWasmDecoderFactory(buffer: Uint8Array): DecoderFactory {
  return {
    create(imports: Imports) {
      return WebAssembly.compile(buffer).then((mod) => {
        const wasmModule = new WebAssembly.Instance(mod, { env: imports });
        const decoder: Decoder = new WasmDecoder(wasmModule);
        return decoder;
      });
    }
  };
}

interface WasmMemory {
  buffer: ArrayBuffer;
  grow(pages: number): void;
}

interface WasmModule {
  exports: {
    decode(ptr: number): void;
    memory: WasmMemory;
  };
}

declare const WebAssembly: {
  compile(buffer: Uint8Array): Promise<any>;
  Instance: {
    new (mod: any, imports: { env: Imports; } ): WasmModule;
  };
}

class CountDelegate implements Delegate {
  public lines: number;

  constructor() {
    this.lines = 1;
  }

  reset() {
    this.lines = 1;
  }

  validate() {
    if (this.lines !== 379201) {
      throw new Error('mappings incorect');
    }
  }

  emitNewline() {
    this.lines++;
  }

  emitMapping1(_col: number) {
  }

  emitMapping4(_col: number, _src: number, _srcLine: number, _srcCol: number) {
  }

  emitMapping5(_col: number, _src: number, _srcLine: number, _srcCol: number, _name: number) {
  }
}

interface Mapping {
  fieldCount: number;
  col: number;
  name: number;
  src: number;
  srcCol: number;
  srcLine: number;
}

class MappingDelegate implements Delegate {
  public currentLine: Mapping[];
  public mappings: Mapping[][];

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
      throw new Error('mappings incorect');
    }
  }

  emitNewline() {
    this.mappings.push(this.currentLine = []);
  }

  emitMapping1(col: number) {
    this.currentLine.push({
      col: col,
      fieldCount: 1,
      name: 0,
      src: 0,
      srcCol: 0,
      srcLine: 0,
    });
  }

  emitMapping4(col: number, src: number, srcLine: number, srcCol: number) {
    this.currentLine.push({
      col,
      fieldCount: 4,
      name: 0,
      src,
      srcCol,
      srcLine,
    });
  }

  emitMapping5(col: number, src: number, srcLine: number, srcCol: number, name: number) {
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

interface Delegate {
  reset(): void;
  validate(): void;

  emitNewline(): void;
  emitMapping1(column: number): void;
  emitMapping4(column: number, source: number, sourceLine: number, sourceColumn: number): void;
  emitMapping5(column: number, source: number, sourceLine: number, sourceColumn: number, name: number): void;
}

function createDecoder(decoderFactory: DecoderFactory, delegate: Delegate): Promise<Decoder> {
  const imports = {
    emitNewline: delegate.emitNewline.bind(delegate),
    emitMapping1: delegate.emitMapping1.bind(delegate),
    emitMapping4: delegate.emitMapping4.bind(delegate),
    emitMapping5: delegate.emitMapping5.bind(delegate),
  };
  return decoderFactory.create(imports);
}

async function createDecoderFactory(host: Host, type: "wasm" | "js"): Promise<DecoderFactory> {
  if (type === "wasm") {
    let buffer = await host.readbuffer("out/decode.wasm");
    return createWasmDecoderFactory(buffer);
  }
  if (type === "js") {
    return createJsDecoderFactory();
  }
  throw new Error("unknown decoder type " + type);
}

function createDelegate(type: "mapping" | "count"): Delegate {
  if (type === "mapping") {
    return new MappingDelegate();
  }
  if (type === "count") {
    return new CountDelegate();
  }
  throw new Error("unknown delegate type " + type);
}

async function readMappings(host: Host): Promise<string> {
  return JSON.parse(await host.read('vendor/scala.js.map')).mappings;
}

export async function run(host: Host, decoderType: "wasm" | "js", delegateType: "mapping" | "count", iterations: number) {
  const factory = await createDecoderFactory(host, decoderType);
  const delegate = createDelegate(delegateType);
  const mappings = await readMappings(host);

  const decoder = await createDecoder(factory, delegate);

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
    await host.delay(10);
  }
}
