WebAssembly Source Map Decoder Bench
====================================

Benchmark comparable WASM vs JS code stressing import calling into JS from WASM.

Runs in d8, node, and the browser.

## Building

Requires yarn, binaryen and llvm with the expiremental web assembly target.

```
make
```

### Env variables
| ENV variable | default        | description                                                                   |
|--------------|----------------|-------------------------------------------------------------------------------|
| LLVM_BIN     | ~/llvm/bin     | path to bin of llvm built with LLVM_EXPERIMENTAL_TARGETS_TO_BUILD=WebAssembly |
| BINARYEN_BIN | ~/binaryen/bin | path to binaryen tools                                                        |

## Running Command Line Bench

### Running in d8

`d8 bench-d8.js -- [factory] [delegate] [iterations]`

### Running in node

`node bench-node.js -- [factory] [delegate] [iterations]`

### Options

| option     | value     | description                                         |
|------------|-----------|-----------------------------------------------------|
| factory    | "js"      | use the JS Decoder                                  |
| factory    | "wasm"    | use the WASM Decoder                                |
| delegate   | "count"   | delegate that counts lines                          |
| delegate   | "mapping" | delegate that pushes decoded mappings into an array |
| iterations | number    | the number of samples to take                       |

Adding `--expose_gc` will run gc between each sample.

### Examples

```
~/v8/v8/out.gn/x64.release/d8 --expose_gc --trace_deopt bench-d8.js -- wasm mapping 20
~/v8/v8/out.gn/x64.release/d8 --runtime_call_stats bench-d8.js -- js count 10
~/Downloads/node-v9.0.0-v8-canary20170609cd40078f1f-darwin-x64/bin/node --prof bench-node.js -- js mapping 15
```

## Running in browser

Run a server in the root.

```
python -m SimpleHTTPServer 8000
```

Browse to http://localhost:8000/
