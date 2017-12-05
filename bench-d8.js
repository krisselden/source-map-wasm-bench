load('out/decode.js');

SM.run({
  read(file) {
    return Promise.resolve(read(file));
  },
  readbuffer(file) {
    return Promise.resolve(readbuffer(file));
  },
  print: print,
  delay(ms) {
    return Promise.resolve();
  },
  gc() {
    if (typeof gc === 'function') {
      gc();
    }
  },
}, arguments[0], arguments[1], +arguments[2]).catch(e => print(e));
