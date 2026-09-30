/** Share concurrent reads and keep a small cache for instant tab switches. */
export class ProjectCache<T> {
  private values = new Map<string, T>();
  private pending = new Map<string, Promise<T>>();
  constructor(private readonly limit = 8) {}
  get(id: string) {
    return this.values.get(id);
  }
  invalidate(id: string) {
    this.values.delete(id);
    this.pending.delete(id);
  }
  load(id: string, read: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(id);
    if (existing) return existing;
    const promise = read()
      .then((value) => {
        if (this.pending.get(id) !== promise) return value;
        this.values.delete(id);
        this.values.set(id, value);
        if (this.values.size > this.limit)
          this.values.delete(this.values.keys().next().value!);
        return value;
      })
      .finally(() => {
        if (this.pending.get(id) === promise) this.pending.delete(id);
      });
    this.pending.set(id, promise);
    return promise;
  }
}
