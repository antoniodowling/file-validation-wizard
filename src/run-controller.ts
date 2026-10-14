import type { ValidationRun } from "./types";
/** Owns every run resource. Uncancellable reads release their result on generation mismatch. */
export class RunController {
  generation = 0;
  acceptedRun: ValidationRun | null = null;
  acceptedSnapshotId: number | null = null;
  private phaseStart = 0;
  readonly diagnostics: Record<string, number | string> = {};
  mark(phase: string): void { this.diagnostics[phase] = Math.round(performance.now() - this.phaseStart); }
  worker: Worker | null = null;
  private timers = new Map<string, number>();
  start(): number { this.dispose(); this.phaseStart = performance.now(); return this.generation; }
  current(generation: number, worker?: Worker): boolean { return generation === this.generation && (!worker || worker === this.worker); }
  attach(worker: Worker): void { this.worker?.terminate(); this.worker = worker; }
  schedule(key: string, callback: () => void, delay: number): void {
    this.clearTimer(key);
    const generation = this.generation;
    this.timers.set(key, window.setTimeout(() => {
      this.timers.delete(key);
      if (this.current(generation)) callback();
    }, delay));
  }
  clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer !== undefined) window.clearTimeout(timer);
    this.timers.delete(key);
  }
  stopWorker(): void {
    this.clearTimer("core"); this.clearTimer("enrichment");
    this.worker?.terminate(); this.worker = null;
  }
  dispose(): void {
    this.generation++;
    this.acceptedRun = null; this.acceptedSnapshotId = null;
    for (const key of Object.keys(this.diagnostics)) delete this.diagnostics[key];
    this.stopWorker();
    for (const timer of this.timers.values()) window.clearTimeout(timer);
    this.timers.clear();
  }
}
