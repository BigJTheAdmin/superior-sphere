// src/lib/fetchQueue.js
const MAX = 8;                 // was 4 — allow more parallelism
const q = [];
let active = 0;

// in-flight de-dup keyed by request function identity string
const INFLIGHT = new Map();

export function enqueue(fn, key = null) {
  return new Promise((resolve, reject) => {
    const k = key || fn.toString();
    const existing = INFLIGHT.get(k);
    if (existing) {
      existing.then(resolve, reject);
      return;
    }
    const wrapped = () =>
      Promise.resolve()
        .then(fn)
        .finally(() => INFLIGHT.delete(k));

    INFLIGHT.set(k, new Promise((r, j) => q.push({ run: wrapped, resolve: r, reject: j })));
    pump();
    INFLIGHT.get(k).then(resolve, reject);
  });
}

function pump() {
  while (active < MAX && q.length) {
    const job = q.shift();
    active++;
    job
      .run()
      .then(job.resolve, job.reject)
      .finally(() => {
        active--;
        pump();
      });
  }
}
