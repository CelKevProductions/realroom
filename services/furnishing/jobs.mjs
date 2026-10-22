import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const terminal = new Set(['succeeded', 'failed', 'cancelled']);
const digest = value => createHash('sha256').update(value).digest('hex');
export class DesignJobs {
  constructor({ run, directory, maxPending = 4, timeoutMs = 20 * 60_000, ttlMs = 24 * 3600_000 }) {
    Object.assign(this, { run, directory, maxPending, timeoutMs, ttlMs });
    this.jobs = new Map(); this.queue = []; this.active = null; this.closed = false;
  }
  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    for (const name of await readdir(this.directory)) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      try {
        const job = JSON.parse(await readFile(join(this.directory, name), 'utf8'));
        if (Date.now() - job.updatedAt > this.ttlMs) { await unlink(join(this.directory, name)); continue; }
        if (!terminal.has(job.status)) {
          job.status = 'failed'; job.error = 'Le service a redémarré pendant ce calcul. Relancez la composition.';
          job.updatedAt = Date.now(); await this.save(job);
        }
        this.jobs.set(job.id, job);
      } catch { /* A corrupt snapshot cannot become a successful generation. */ }
    }
    return this;
  }
  async save(job) {
    const file = join(this.directory, job.id + '.json');
    await writeFile(file + '.tmp', JSON.stringify(this.snapshot(job, true)), { mode: 0o600 });
    await rename(file + '.tmp', file);
  }
  snapshot(job, internal = false) {
    const value = Object.fromEntries(['id', 'status', 'createdAt', 'updatedAt', 'progress', 'result', 'error'].filter(k => job[k] !== undefined).map(k => [k, job[k]]));
    if (internal) Object.assign(value, { requestHash: job.requestHash, idempotencyHash: job.idempotencyHash });
    return value;
  }
  get(id) { const job = this.jobs.get(id); return job ? this.snapshot(job) : null; }
  async submit(input, idempotencyKey) {
    if (this.closed) throw Object.assign(Error('Le service s’arrête.'), { status: 503 });
    if (idempotencyKey && !/^[\w-]{8,128}$/.test(idempotencyKey)) throw Object.assign(Error('Identifiant de requête invalide.'), { status: 400 });
    const requestHash = digest(JSON.stringify(input)), idempotencyHash = idempotencyKey ? digest(idempotencyKey) : undefined;
    if (idempotencyHash) {
      const old = [...this.jobs.values()].find(j => j.idempotencyHash === idempotencyHash);
      if (old) {
        if (old.requestHash !== requestHash) throw Object.assign(Error('Cet identifiant correspond à une autre demande.'), { status: 409 });
        return this.snapshot(old);
      }
    }
    if (this.queue.length + Number(!!this.active) >= this.maxPending + 1) throw Object.assign(Error('La file de calcul est pleine. Réessayez après les calculs en cours.'), { status: 429 });
    const job = { id: randomUUID(), status: 'queued', createdAt: Date.now(), updatedAt: Date.now(), requestHash, idempotencyHash, input };
    this.jobs.set(job.id, job); // Reserve the idempotency key before the first await.
    try { await this.save(job); } catch (e) { this.jobs.delete(job.id); throw e; }
    this.queue.push(job); this.drain();
    return this.snapshot(job);
  }
  async drain() {
    if (this.active || this.closed) return;
    const job = this.queue.shift(); if (!job) return;
    if (terminal.has(job.status)) return this.drain();
    this.active = job; job.status = 'running'; job.updatedAt = Date.now();
    job.controller = new AbortController();
    const timer = setTimeout(() => job.controller.abort(new Error('Le calcul a dépassé sa durée maximale.')), this.timeoutMs);
    timer.unref?.();
    try {
      await this.save(job);
      const result = await this.run(job.input, {
        signal: job.controller.signal,
        emit: event => { if (event.type === 'progress') { job.progress = String(event.stage).slice(0, 500); job.updatedAt = Date.now(); } },
      });
      job.controller.signal.throwIfAborted();
      job.result = result; job.status = 'succeeded';
    } catch (e) {
      job.status = job.cancelRequested ? 'cancelled' : 'failed';
      job.error = job.cancelRequested ? 'Calcul annulé.' : e.message || 'Le calcul a échoué.';
    } finally {
      clearTimeout(timer); delete job.input; delete job.controller;
      job.updatedAt = Date.now();
      try { await this.save(job); } catch { job.status = 'failed'; delete job.result; job.error = 'Impossible de conserver le résultat du calcul.'; }
      this.active = null; this.drain();
    }
  }
  async cancel(id) {
    const job = this.jobs.get(id); if (!job) return null;
    if (terminal.has(job.status)) return this.snapshot(job);
    job.cancelRequested = true;
    if (job.controller) job.controller.abort();
    else {
      this.queue = this.queue.filter(j => j.id !== id); job.status = 'cancelled'; job.error = 'Calcul annulé.';
      delete job.input; job.updatedAt = Date.now(); await this.save(job);
    }
    return this.snapshot(job);
  }
  async prune() {
    for (const [id, job] of this.jobs) if (terminal.has(job.status) && Date.now() - job.updatedAt > this.ttlMs) {
      this.jobs.delete(id); await unlink(join(this.directory, id + '.json')).catch(() => {});
    }
  }
  async close() { this.closed = true; for (const job of this.jobs.values()) if (!terminal.has(job.status)) await this.cancel(job.id); }
}
