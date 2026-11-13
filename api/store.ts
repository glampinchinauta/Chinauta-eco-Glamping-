/**
 * Capa de datos de Eco Glamping Chinauta.
 *
 * Los datos se guardan como "tablas" de documentos con la misma forma que tenían en SQLite
 * (así el sitio recibe exactamente las mismas respuestas). Hay dos implementaciones:
 *  - FirestoreStore: la base real (Firestore, con el SDK de administración).
 *  - MemoryStore: en memoria, para pruebas y para desarrollar sin credenciales.
 *
 * Reglas para que funcione con Firestore sin índices especiales:
 *  - Los filtros son de igualdad (`where`) o un solo filtro de rango (`gt`) usado solo.
 *  - Los resultados se ordenan en el código; `orderBy` solo se usa sin filtros.
 */

export type Row = Record<string, any> & { id: number | string };

export interface ListOptions {
  /** Igualdad de uno o varios campos. */
  where?: Record<string, string | number | boolean>;
  /** Un solo filtro "mayor que" (no se combina con `where`). */
  gt?: { field: string; value: string | number };
  /** Orden por un campo (no se combina con `where` ni `gt`). */
  orderBy?: { field: string; dir?: "asc" | "desc" };
  limit?: number;
}

export interface Reader {
  get(table: string, id: string | number): Promise<Row | null>;
  list(table: string, opts?: ListOptions): Promise<Row[]>;
  nextId(table: string): Promise<number>;
}

export interface Tx extends Reader {
  /** Las escrituras se aplican al terminar la función (Firestore exige leer antes de escribir). */
  insert(table: string, data: Record<string, any>): Promise<Row>;
  set(table: string, id: string | number, data: Record<string, any>): void;
  update(table: string, id: string | number, patch: Record<string, any>): void;
  remove(table: string, id: string | number): void;
}

export interface Store extends Reader {
  insert(table: string, data: Record<string, any>, opts?: { id?: string | number }): Promise<Row>;
  set(table: string, id: string | number, data: Record<string, any>): Promise<void>;
  /** Mezcla los campos con el documento existente. Devuelve false si no existe. */
  update(table: string, id: string | number, patch: Record<string, any>): Promise<boolean>;
  remove(table: string, id: string | number): Promise<void>;
  setCounter(table: string, value: number): Promise<void>;
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

/** Fecha en el mismo formato que usaba SQLite (CURRENT_TIMESTAMP): "AAAA-MM-DD HH:MM:SS" en UTC. */
export const sqlTime = (d: Date = new Date()): string => d.toISOString().slice(0, 19).replace("T", " ");

const docId = (id: string | number) => String(id);

/** Si el documento no trae `id`, lo toma del nombre del documento (número cuando se puede). */
function withId(id: string, data: Record<string, any>): Row {
  if (data.id !== undefined && data.id !== null) return data as Row;
  return { ...data, id: /^\d+$/.test(id) ? Number(id) : id };
}

const compareIds = (a: Row, b: Row) => {
  const x = a.id, y = b.id;
  if (typeof x === "number" && typeof y === "number") return x - y;
  return String(x).localeCompare(String(y), undefined, { numeric: true });
};

// ---------------------------------------------------------------------------------------------
// Memoria
// ---------------------------------------------------------------------------------------------
export class MemoryStore implements Store {
  private tables = new Map<string, Map<string, Row>>();
  private counters = new Map<string, number>();
  private lock: Promise<unknown> = Promise.resolve();

  private table(name: string) {
    let t = this.tables.get(name);
    if (!t) { t = new Map(); this.tables.set(name, t); }
    return t;
  }

  async get(table: string, id: string | number) {
    const row = this.table(table).get(docId(id));
    return row ? structuredClone(row) : null;
  }

  async list(table: string, opts: ListOptions = {}) {
    let rows = [...this.table(table).values()];
    if (opts.where) {
      for (const [k, v] of Object.entries(opts.where)) rows = rows.filter((r) => r[k] === v);
    }
    if (opts.gt) rows = rows.filter((r) => r[opts.gt!.field] > opts.gt!.value);
    if (opts.orderBy) {
      const { field, dir = "asc" } = opts.orderBy;
      rows.sort((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * (dir === "desc" ? -1 : 1));
    } else {
      rows.sort(compareIds);
    }
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return rows.map((r) => structuredClone(r));
  }

  async nextId(table: string) {
    const next = (this.counters.get(table) || 0) + 1;
    this.counters.set(table, next);
    return next;
  }

  async setCounter(table: string, value: number) {
    this.counters.set(table, Math.max(value, this.counters.get(table) || 0));
  }

  async set(table: string, id: string | number, data: Record<string, any>) {
    this.table(table).set(docId(id), withId(docId(id), structuredClone(data)));
  }

  async insert(table: string, data: Record<string, any>, opts: { id?: string | number } = {}) {
    const id = opts.id ?? (await this.nextId(table));
    const row = { ...structuredClone(data), id } as Row;
    this.table(table).set(docId(id), row);
    return structuredClone(row);
  }

  async update(table: string, id: string | number, patch: Record<string, any>) {
    const cur = this.table(table).get(docId(id));
    if (!cur) return false;
    Object.assign(cur, structuredClone(patch));
    return true;
  }

  async remove(table: string, id: string | number) {
    this.table(table).delete(docId(id));
  }

  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    // Una transacción a la vez: equivale al aislamiento serializable de Firestore.
    const run = async () => {
      const writes: (() => void)[] = [];
      const counters = new Map<string, number>();
      const self = this;
      const tx: Tx = {
        get: (t, id) => self.get(t, id),
        list: (t, o) => self.list(t, o),
        async nextId(t) {
          const cur = counters.get(t) ?? self.counters.get(t) ?? 0;
          counters.set(t, cur + 1);
          return cur + 1;
        },
        async insert(t, data) {
          const id = await tx.nextId(t);
          const row = { ...structuredClone(data), id } as Row;
          writes.push(() => self.table(t).set(docId(id), row));
          return structuredClone(row);
        },
        set(t, id, data) { writes.push(() => self.table(t).set(docId(id), withId(docId(id), structuredClone(data)))); },
        update(t, id, patch) {
          writes.push(() => {
            const cur = self.table(t).get(docId(id));
            if (cur) Object.assign(cur, structuredClone(patch));
          });
        },
        remove(t, id) { writes.push(() => self.table(t).delete(docId(id))); },
      };
      const result = await fn(tx);
      for (const w of writes) w();
      for (const [t, v] of counters) this.counters.set(t, v);
      return result;
    };
    const next = this.lock.then(run, run);
    this.lock = next.catch(() => undefined);
    return next;
  }
}

// ---------------------------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------------------------
const COL_PREFIX = "egc_";
const COUNTERS = "egc__counters";

export class FirestoreStore implements Store {
  constructor(private db: FirebaseFirestore.Firestore) {}

  private col(table: string) { return this.db.collection(COL_PREFIX + table); }
  private ref(table: string, id: string | number) { return this.col(table).doc(docId(id)); }

  private build(table: string, opts: ListOptions): FirebaseFirestore.Query {
    let q: FirebaseFirestore.Query = this.col(table);
    for (const [k, v] of Object.entries(opts.where || {})) q = q.where(k, "==", v);
    if (opts.gt) q = q.where(opts.gt.field, ">", opts.gt.value);
    if (opts.orderBy) q = q.orderBy(opts.orderBy.field, opts.orderBy.dir || "asc");
    if (opts.limit) q = q.limit(opts.limit);
    return q;
  }

  async get(table: string, id: string | number) {
    const snap = await this.ref(table, id).get();
    return snap.exists ? withId(snap.id, snap.data() as any) : null;
  }

  async list(table: string, opts: ListOptions = {}) {
    const snap = await this.build(table, opts).get();
    const rows = snap.docs.map((d) => withId(d.id, d.data() as any));
    if (!opts.orderBy) rows.sort(compareIds);
    return rows;
  }

  async nextId(table: string) {
    const ref = this.db.collection(COUNTERS).doc(table);
    return this.db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const next = ((snap.exists ? (snap.data() as any).value : 0) || 0) + 1;
      t.set(ref, { value: next });
      return next;
    });
  }

  async setCounter(table: string, value: number) {
    const ref = this.db.collection(COUNTERS).doc(table);
    await this.db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const cur = (snap.exists ? (snap.data() as any).value : 0) || 0;
      if (value > cur) t.set(ref, { value });
    });
  }

  async set(table: string, id: string | number, data: Record<string, any>) {
    await this.ref(table, id).set(clean(data));
  }

  async insert(table: string, data: Record<string, any>, opts: { id?: string | number } = {}) {
    const id = opts.id ?? (await this.nextId(table));
    const row = { ...data, id } as Row;
    await this.ref(table, id).set(clean(row));
    return row;
  }

  async update(table: string, id: string | number, patch: Record<string, any>) {
    try {
      await this.ref(table, id).update(clean(patch));
      return true;
    } catch (e: any) {
      if (e?.code === 5 || /NOT_FOUND/i.test(String(e?.message))) return false;
      throw e;
    }
  }

  async remove(table: string, id: string | number) {
    await this.ref(table, id).delete();
  }

  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.runTransaction(async (t) => {
      const writes: (() => void)[] = [];
      const counters = new Map<string, number>();
      const self = this;
      const tx: Tx = {
        async get(table, id) {
          const snap = await t.get(self.ref(table, id));
          return snap.exists ? withId(snap.id, snap.data() as any) : null;
        },
        async list(table, opts = {}) {
          const snap = await t.get(self.build(table, opts));
          const rows = snap.docs.map((d) => withId(d.id, d.data() as any));
          if (!opts.orderBy) rows.sort(compareIds);
          return rows;
        },
        async nextId(table) {
          if (!counters.has(table)) {
            const snap = await t.get(self.db.collection(COUNTERS).doc(table));
            counters.set(table, (snap.exists ? (snap.data() as any).value : 0) || 0);
          }
          const next = counters.get(table)! + 1;
          counters.set(table, next);
          return next;
        },
        async insert(table, data) {
          const id = await tx.nextId(table);
          const row = { ...data, id } as Row;
          writes.push(() => t.set(self.ref(table, id), clean(row)));
          return row;
        },
        set(table, id, data) { writes.push(() => t.set(self.ref(table, id), clean(data))); },
        update(table, id, patch) { writes.push(() => t.set(self.ref(table, id), clean(patch), { merge: true })); },
        remove(table, id) { writes.push(() => t.delete(self.ref(table, id))); },
      };
      const result = await fn(tx);
      for (const [table, value] of counters) t.set(self.db.collection(COUNTERS).doc(table), { value });
      for (const w of writes) w();
      return result;
    });
  }
}

/** Firestore no admite `undefined`: se quitan esos campos. */
function clean<T extends Record<string, any>>(data: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined) out[k] = v;
  return out as T;
}
