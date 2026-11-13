import crypto from "crypto";
import fs from "fs";
import path from "path";

/** Dónde se guardan las fotos y videos que sube el equipo. */
export interface Uploader {
  save(buffer: Buffer, meta: { kind: "image" | "video"; ext: string; contentType: string }): Promise<string>;
}

const fileName = (kind: string, ext: string) => `${kind}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${ext}`;

/** Desarrollo local: guarda en public/assets. */
export class DiskUploader implements Uploader {
  constructor(private root: string = process.cwd()) {}
  async save(buffer: Buffer, meta: { kind: "image" | "video"; ext: string }) {
    const folder = meta.kind === "video" ? "videos" : "images";
    const dir = path.join(this.root, "public", "assets", folder);
    fs.mkdirSync(dir, { recursive: true });
    const name = fileName(meta.kind, meta.ext);
    fs.writeFileSync(path.join(dir, name), buffer);
    return `/assets/${folder}/${name}`;
  }
}

/** Producción: Firebase Storage. Devuelve un enlace público con token (no requiere hacer público el bucket). */
export class StorageUploader implements Uploader {
  constructor(private bucket: { name: string; file(name: string): any }) {}
  async save(buffer: Buffer, meta: { kind: "image" | "video"; ext: string; contentType: string }) {
    const folder = meta.kind === "video" ? "videos" : "images";
    const objectPath = `uploads/${folder}/${fileName(meta.kind, meta.ext)}`;
    const token = crypto.randomUUID();
    await this.bucket.file(objectPath).save(buffer, {
      resumable: false,
      metadata: { contentType: meta.contentType, metadata: { firebaseStorageDownloadTokens: token } },
    });
    return `https://firebasestorage.googleapis.com/v0/b/${this.bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
  }
}

/** Para pruebas: no escribe nada y devuelve una dirección falsa. */
export class FakeUploader implements Uploader {
  saved: { name: string; size: number }[] = [];
  async save(buffer: Buffer, meta: { kind: "image" | "video"; ext: string }) {
    const name = fileName(meta.kind, meta.ext);
    this.saved.push({ name, size: buffer.length });
    return `/assets/${meta.kind === "video" ? "videos" : "images"}/${name}`;
  }
}
