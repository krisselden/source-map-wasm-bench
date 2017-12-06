const fs = require('fs');
const bench = require('./out/bench');

const argsIndex = process.argv.indexOf('--');
const args = process.argv.slice(argsIndex + 1);

bench.run({
  read(file) {
    return Promise.resolve(fs.readFileSync(file, "utf8"));
  },
  readbuffer(file) {
    return Promise.resolve(fs.readFileSync(file));
  },
  print(msg) {
    console.log(msg);
  },
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  gc() {
    if (typeof gc === 'function') {
      gc();
    }
  },
}, args[0], args[1], +args[2]).catch(e => console.error(e));
