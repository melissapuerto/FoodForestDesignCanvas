import Dexie, { type Table } from 'dexie';

export type BlobRecord = {
  key: string;
  kind: 'photo' | 'voice' | 'doc' | 'video' | 'audio';
  mime: string;
  size: number;
  data: Blob;
  createdAt: string;
};

class KuxtalBlobsDb extends Dexie {
  blobs!: Table<BlobRecord, string>;

  constructor() {
    super('kuxtal-blobs');
    this.version(1).stores({
      blobs: 'key, kind, createdAt'
    });
  }
}

export const blobsDb = new KuxtalBlobsDb();

export async function putBlob(rec: Omit<BlobRecord, 'createdAt'> & { createdAt?: string }): Promise<string> {
  const final: BlobRecord = { ...rec, createdAt: rec.createdAt ?? new Date().toISOString() };
  await blobsDb.blobs.put(final);
  return final.key;
}

export async function getBlob(key: string): Promise<BlobRecord | undefined> {
  return blobsDb.blobs.get(key);
}

export async function deleteBlob(key: string): Promise<void> {
  await blobsDb.blobs.delete(key);
}

export async function listBlobsByKind(kind: BlobRecord['kind']): Promise<BlobRecord[]> {
  return blobsDb.blobs.where('kind').equals(kind).toArray();
}
