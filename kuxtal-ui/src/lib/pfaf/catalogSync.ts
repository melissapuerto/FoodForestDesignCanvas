import { API_URL } from '../api';
import { setCatalogOverride, type PfafEntry } from './pfafPool';
import { PFAF_SCHEMA_VERSION, invalidateNormalized } from './pfafSchema';

export type CatalogRefreshResult =
  | { status: 'current'; version: number }
  | { status: 'updated'; version: number; count: number }
  | { status: 'offline' };

/**
 * Opt-in online refresh of the plant catalog. The bundled JSON is always the
 * floor — any failure leaves the offline dataset untouched. Never auto-invoked
 * on startup so the offline-first flow can't be broken by a flaky network.
 */
export async function refreshPlantCatalog(): Promise<CatalogRefreshResult> {
  try {
    const meta = await fetch(`${API_URL}/plants/version`).then((r) => (r.ok ? r.json() : null));
    const remoteVersion: number = meta?.version ?? 0;
    if (remoteVersion <= PFAF_SCHEMA_VERSION) {
      return { status: 'current', version: PFAF_SCHEMA_VERSION };
    }

    const payload = await fetch(`${API_URL}/plants?since=${PFAF_SCHEMA_VERSION}`).then((r) =>
      r.ok ? r.json() : null
    );
    const plants: PfafEntry[] | undefined = payload?.plants;
    if (!Array.isArray(plants) || plants.length === 0) {
      return { status: 'current', version: PFAF_SCHEMA_VERSION };
    }

    setCatalogOverride(plants);
    invalidateNormalized();
    return { status: 'updated', version: remoteVersion, count: plants.length };
  } catch {
    return { status: 'offline' };
  }
}
