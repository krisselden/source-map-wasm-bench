const fs = require('fs');
const SM = require('./out/decode');

console.log(process.argv);

let argsIndex = process.argv.indexOf('--');
let args = process.argv.slice(argsIndex + 1);

SM.run({
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
