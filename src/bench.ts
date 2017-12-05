import JsModule, { Imports, Reader } from "./decode";

export interface IHost {
  read(file: string): Promise<string>;
  readbuffer(file: string): Promise<Uint8Array>;
  print(msg: string): void;
  delay(ms: number): Promise<void>;
  gc(): void;
}

interface IDecoder {
  decode(mappings: string): void;
}

interface IDecoderFactory {
  create(imports: Imports): Promise<IDecoder>;
}

class JsDecoder implements IDecoder {
  private _decode: (reader: Reader) => void;

  constructor(imports: Imports) {
    this._decode = JsModule(imports).decode;
  }

  public decode(mappings: string) {
    const bytes = new Uint8Array(mappings.length + 1);
    for (let i = 0; i < mappings.length; i++) {
      bytes[i] = mappings.charCodeAt(i);
    }
    this._decode({ bytes, pos: 0 });
  }
}

// tslint:disable-next-line:max-classes-per-file
class WasmDecoder implements IDecoder {
  private _memory: IWasmMemory;
  private _decode: (ptr: number) => void;

  constructor(mod: IWasmModule) {
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

  private _ensureMem(needed: number) {
    if (needed > 0) {
      const pages = Math.ceil(needed / 65536);
      this._memory.grow(pages);
    }
  }

  private _writeString(ptr: number, str: string) {
    const bytes = new Uint8Array(this._memory.buffer);
    for (let i = 0; i < str.length; i++) {
      bytes[ptr + i] = str.charCodeAt(i);
    }
  }
}

function createJsDecoderFactory(): IDecoderFactory {
  return {
    create(imports: Imports) {
      const decoder: IDecoder = new JsDecoder(imports);
      return Promise.resolve(decoder);
    },
  };
}

function createWasmDecoderFactory(buffer: Uint8Array): IDecoderFactory {
  return {
    create(imports: Imports) {
      return WebAssembly.compile(buffer).then((mod) => {
        const wasmModule = new WebAssembly.Instance(mod, imports);
        const decoder: IDecoder = new WasmDecoder(wasmModule);
        return decoder;
      });
    },
  };
}

interface IWasmMemory {
  buffer: ArrayBuffer;
  grow(pages: number): void;
}

interface IWasmModule {
  exports: {
    memory: IWasmMemory;
    decode(ptr: number): void;
  };
}

declare const WebAssembly: {
  Instance: {
    new (mod: any, imports: Imports ): IWasmModule;
  };

  compile(buffer: Uint8Array): Promise<any>;
};

class CountDelegate implements IDelegate {
  public lines: number;

  constructor() {
    this.lines = 1;
  }

  public reset() {
    this.lines = 1;
  }

  public validate() {
    if (this.lines !== 379201) {
      throw new Error("mappings incorect");
    }
  }

  public emitNewline() {
    this.lines++;
  }

  public emitMapping1(_col: number) {
    // noop
  }

  public emitMapping4(_col: number, _src: number, _srcLine: number, _srcCol: number) {
    // noop
  }

  public emitMapping5(_col: number, _src: number, _srcLine: number, _srcCol: number, _name: number) {
    // noop
  }
}

interface IMapping {
  fieldCount: number;
  col: number;
  name: number;
  src: number;
  srcCol: number;
  srcLine: number;
}

class MappingDelegate implements IDelegate {
  public currentLine: IMapping[];
  public mappings: IMapping[][];

  constructor() {
    this.currentLine = [];
    this.mappings = [this.currentLine];
  }

  public reset() {
    this.currentLine.length = 0;
    this.mappings.length = 1;
  }

  public validate() {
    if (this.mappings.length !== 379201) {
      throw new Error("mappings incorect");
    }
  }

  public emitNewline() {
    this.mappings.push(this.currentLine = []);
  }

  public emitMapping1(col: number) {
    this.currentLine.push({
      col,
      fieldCount: 1,
      name: 0,
      src: 0,
      srcCol: 0,
      srcLine: 0,
    });
  }

  public emitMapping4(col: number, src: number, srcLine: number, srcCol: number) {
    this.currentLine.push({
      col,
      fieldCount: 4,
      name: 0,
      src,
      srcCol,
      srcLine,
    });
  }

  public emitMapping5(col: number, src: number, srcLine: number, srcCol: number, name: number) {
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

interface IDelegate {
  reset(): void;
  validate(): void;

  emitMapping1(column: number): void;
  emitMapping4(column: number, source: number, sourceLine: number, sourceColumn: number): void;
  emitMapping5(column: number, source: number, sourceLine: number, sourceColumn: number, name: number): void;
  emitNewline(): void;
}

function createDecoder(decoderFactory: IDecoderFactory, delegate: IDelegate): Promise<IDecoder> {
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

async function createDecoderFactory(host: IHost, type: "wasm" | "js"): Promise<IDecoderFactory> {
  if (type === "wasm") {
    const buffer = await host.readbuffer("out/decode.wasm");
    return createWasmDecoderFactory(buffer);
  }
  if (type === "js") {
    return createJsDecoderFactory();
  }
  throw new Error("unknown decoder type " + type);
}

function createDelegate(type: "mapping" | "count"): IDelegate {
  if (type === "mapping") {
    return new MappingDelegate();
  }
  if (type === "count") {
    return new CountDelegate();
  }
  throw new Error("unknown delegate type " + type);
}

async function readMappings(host: IHost): Promise<string> {
  return JSON.parse(await host.read("vendor/scala.js.map")).mappings;
}

export async function run(host: IHost, decoderType: "wasm" | "js",
                          delegateType: "mapping" | "count",
                          iterations: number) {
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
