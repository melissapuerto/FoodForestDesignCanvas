import RBush from 'rbush';
import { haversineMeters, metersToDegLat, metersToDegLng, type LngLat } from './geometry';

export type SpatialItem = {
  id: string;
  kind: 'plant' | 'animal';
  speciesId: string;
  lng: number;
  lat: number;
  radiusM: number;
};

type IndexedItem = SpatialItem & {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export class GeoSpatialIndex {
  private tree = new RBush<IndexedItem>();

  insert(item: SpatialItem): void {
    this.tree.insert(this.toIndexed(item));
  }

  removeById(id: string): void {
    const all = this.tree.all();
    this.tree.clear();
    for (const it of all) if (it.id !== id) this.tree.insert(it);
  }

  clear(): void {
    this.tree.clear();
  }

  rebuild(items: SpatialItem[]): void {
    this.tree.clear();
    this.tree.load(items.map((i) => this.toIndexed(i)));
  }

  searchNear(point: LngLat, distanceM: number): Array<SpatialItem & { distanceM: number }> {
    const dLat = metersToDegLat(distanceM);
    const dLng = metersToDegLng(distanceM, point.lat);
    const candidates = this.tree.search({
      minX: point.lng - dLng,
      minY: point.lat - dLat,
      maxX: point.lng + dLng,
      maxY: point.lat + dLat
    });
    const hits: Array<SpatialItem & { distanceM: number }> = [];
    for (const c of candidates) {
      const d = haversineMeters(point, { lng: c.lng, lat: c.lat });
      if (d <= distanceM) hits.push({ ...c, distanceM: d });
    }
    return hits.sort((a, b) => a.distanceM - b.distanceM);
  }

  /**
   * A plant collides with a neighbor if their centers are closer than the
   * smaller plant's full footprint diameter. This permits permaculture
   * stacking: a 0.3 m herb can sit under a 10 m canopy tree as long as
   * it's at least 0.3 m from the trunk; two same-sized plants must still
   * be one canopy diameter apart.
   *
   * `radiusM` is the candidate plant's half-canopy. We reconstruct the
   * smaller diameter via `min(2 * radiusM, 2 * c.radiusM)`.
   */
  collidesAt(point: LngLat, radiusM: number, ignoreId?: string): SpatialItem | null {
    const candidateDiameter = radiusM * 2;
    const candidates = this.searchNear(point, candidateDiameter + this.maxRadiusM() * 2);
    for (const c of candidates) {
      if (ignoreId && c.id === ignoreId) continue;
      const minDistance = Math.min(candidateDiameter, c.radiusM * 2);
      if (c.distanceM < minDistance) {
        return c;
      }
    }
    return null;
  }

  private maxRadiusM(): number {
    let max = 0;
    for (const it of this.tree.all()) if (it.radiusM > max) max = it.radiusM;
    return max;
  }

  private toIndexed(item: SpatialItem): IndexedItem {
    const dLat = metersToDegLat(item.radiusM);
    const dLng = metersToDegLng(item.radiusM, item.lat);
    return {
      ...item,
      minX: item.lng - dLng,
      minY: item.lat - dLat,
      maxX: item.lng + dLng,
      maxY: item.lat + dLat
    };
  }
}
