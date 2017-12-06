window.onload = function () {
  /** @type {HTMLSelectElement} */
  const factoryTypeSelect = document.getElementById('factoryType');
  /** @type {HTMLSelectElement} */
  const delegateTypeSelect = document.getElementById('delegateType');
  const runButton = document.getElementById('runButton');
  const outEl = document.getElementById('out');
  runButton.onclick = () => {
    const factoryType = factoryTypeSelect.value;
    const delegateType = delegateTypeSelect.value;
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
    }, factoryType, delegateType, 10).catch(e => console.error(e));
  }
};
