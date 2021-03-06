LLVM_BIN=~/llvm/bin
BINARYEN_BIN=~/binaryen/bin
CC=$(LLVM_BIN)/clang
S2WASM=$(BINARYEN_BIN)/s2wasm
WASMOPT=$(BINARYEN_BIN)/wasm-opt

build: out/decode.wasm out/test_decode out/bench.js
clean:
	rm -rf obj
	rm -rf out

node_modules:
	yarn

out/bench.js: src/bench.ts src/decode.ts node_modules
	node_modules/.bin/tsc $< -t ES2015 --outDir obj
	node_modules/.bin/rollup obj/bench.js -o $@ -f umd --name bench

out:
	mkdir out

obj:
	mkdir obj

obj/decode.s: src/decode.c obj
	$(CC) -S --target=wasm32 -Os -o $@ $<

obj/decode.wat: obj/decode.s
	$(S2WASM) -o $@ $<

out/decode.wasm: obj/decode.wat out
	$(WASMOPT) -Oz -o $@ $<

out/test_decode: src/decode.c src/test_decode.c out
	$(CC) -o $@ src/decode.c src/test_decode.c

.PHONY: build clean
