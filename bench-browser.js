window.onload = function () {
  /** @type {HTMLSelectElement} */
  const factoryTypeSelect = document.getElementById('factoryType');
  /** @type {HTMLSelectElement} */
  const delegateTypeSelect = document.getElementById('delegateType');
  const runButton = document.getElementById('runButton');
  /** @type {HTMLInputElement} */
  const iterationsText = document.getElementById('iterations');
  const outEl = document.getElementById('out');
  runButton.onclick = () => {
    const factoryType = factoryTypeSelect.value;
    const delegateType = delegateTypeSelect.value;
    const interations = iterationsText.value | 0;
    bench.run({
      read(file) {
        return fetch(file).then(res => res.text());
      },
      readbuffer(file) {
        return fetch(file).then(res => res.arrayBuffer());
      },
      print(msg) {
        outEl.textContent += msg + '\n';
      },
      delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      },
      gc() {
        if (typeof gc === 'function') {
          gc();
        }
      },
    }, factoryType, delegateType, interations).catch(e => console.error(e));
  }
};
