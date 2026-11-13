// Firestore falso en memoria con las reglas que más importan del real:
//  - las transacciones se ejecutan de a una,
//  - dentro de una transacción todas las lecturas van antes de las escrituras,
//  - update() sobre un documento que no existe falla,
//  - no se aceptan valores undefined.
// Sirve para probar FirestoreStore sin credenciales.

type Data = Record<string, any>;

class DocRef {
  constructor(private fs: FakeFirestore, public col: string, public id: string) {}
  get path() { return `${this.col}/${this.id}`; }
  async get() { return this.fs.snap(this); }
  async set(data: Data, opts?: { merge?: boolean }) { this.fs.write("set", this, data, opts); }
  async update(data: Data) { this.fs.write("update", this, data); }
  async delete() { this.fs.write("delete", this); }
}

class Query {
  constructor(protected fs: FakeFirestore, protected col: string, private filters: { op: string; field: string; value: any }[] = [],
    private order?: { field: string; dir: string }, private max?: number) {}
  where(field: string, op: string, value: any) { return new Query(this.fs, this.col, [...this.filters, { op, field, value }], this.order, this.max); }
  orderBy(field: string, dir = "asc") { return new Query(this.fs, this.col, this.filters, { field, dir }, this.max); }
  limit(n: number) { return new Query(this.fs, this.col, this.filters, this.order, n); }
  async get() { return this.run(); }
  run() {
    if (this.order && this.filters.length) throw new Error("FAKE: orderBy con filtros requiere un índice compuesto");
    if (this.filters.some((f) => f.op !== "==") && this.filters.length > 1) throw new Error("FAKE: un filtro de rango no se combina con otros sin índice compuesto");
    let docs = this.fs.docsOf(this.col);
    for (const f of this.filters) {
      docs = docs.filter(([, d]) => (f.op === "==" ? d[f.field] === f.value : f.op === ">" ? d[f.field] > f.value : false));
    }
    if (this.order) {
      const { field, dir } = this.order;
      docs = [...docs].sort(([ia, a], [ib, b]) => ((a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) || ia.localeCompare(ib)) * (dir === "desc" ? -1 : 1));
    } else {
      docs = [...docs].sort(([a], [b]) => a.localeCompare(b)); // Firestore ordena por id (texto)
    }
    if (this.max) docs = docs.slice(0, this.max);
    return { docs: docs.map(([id, d]) => ({ id, data: () => structuredClone(d), exists: true })) };
  }
}

class CollectionRef extends Query {
  constructor(fs: FakeFirestore, private name: string) { super(fs, name); }
  doc(id: string) { return new DocRef(this.fs, this.name, id); }
}

export class FakeFirestore {
  private data = new Map<string, Data>();
  private lock: Promise<unknown> = Promise.resolve();
  private activeTx: { wrote: boolean } | null = null;
  reads = 0;
  writes = 0;

  collection(name: string) { return new CollectionRef(this, name); }
  docsOf(col: string): [string, Data][] {
    const out: [string, Data][] = [];
    for (const [path, d] of this.data) if (path.startsWith(col + "/") && !path.slice(col.length + 1).includes("/")) out.push([path.slice(col.length + 1), d]);
    return out;
  }
  snap(ref: DocRef) {
    this.reads++;
    const d = this.data.get(ref.path);
    return { id: ref.id, exists: !!d, data: () => (d ? structuredClone(d) : undefined) };
  }
  write(kind: "set" | "update" | "delete", ref: DocRef, data?: Data, opts?: { merge?: boolean }) {
    if (data) for (const [k, v] of Object.entries(data)) if (v === undefined) throw new Error(`FAKE: valor undefined en ${ref.path}.${k}`);
    this.writes++;
    const cur = this.data.get(ref.path);
    if (kind === "delete") this.data.delete(ref.path);
    else if (kind === "update") {
      if (!cur) throw Object.assign(new Error(`NOT_FOUND: ${ref.path}`), { code: 5 });
      Object.assign(cur, structuredClone(data));
    } else if (opts?.merge && cur) Object.assign(cur, structuredClone(data));
    else this.data.set(ref.path, structuredClone(data!));
  }
  settings() { /* no-op */ }

  async runTransaction<T>(fn: (t: any) => Promise<T>): Promise<T> {
    const run = async () => {
      const state = { wrote: false };
      const guard = () => { if (state.wrote) throw new Error("FAKE: Firestore exige hacer todas las lecturas antes de las escrituras en una transacción"); };
      const pending: (() => void)[] = [];
      const t = {
        get: async (target: any) => { guard(); return target instanceof DocRef ? this.snap(target) : (this.reads++, target.run()); },
        set: (ref: DocRef, data: Data, opts?: any) => { state.wrote = true; pending.push(() => this.write("set", ref, data, opts)); },
        update: (ref: DocRef, data: Data) => { state.wrote = true; pending.push(() => this.write("update", ref, data)); },
        delete: (ref: DocRef) => { state.wrote = true; pending.push(() => this.write("delete", ref)); },
      };
      const result = await fn(t);
      for (const w of pending) w();
      return result;
    };
    const next = this.lock.then(run, run);
    this.lock = next.catch(() => undefined);
    return next;
  }
}
