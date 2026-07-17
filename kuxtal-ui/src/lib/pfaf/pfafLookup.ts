export type { PfafEntry } from './pfafPool';
import { allPfafPlants, type PfafEntry } from './pfafPool';

export async function searchPfaf(query: string): Promise<PfafEntry[]> {
  if (!query || query.trim().length < 2) return [];

  const cachedDb = allPfafPlants();

  const q = query.toLowerCase().trim();
  let results = cachedDb.filter((p) =>
    p.n.toLowerCase().includes(q) ||
    p.sci.toLowerCase().includes(q)
  );

  // Always attempt GBIF search if online and query is sufficient
  if (query.length >= 3) {
    try {
      const gbifUrl = `https://api.gbif.org/v1/species/search?q=${encodeURIComponent(query)}&kingdom=Plantae&limit=10`;
      const gbifRes = await fetch(gbifUrl);
      if (gbifRes.ok) {
        const data = await gbifRes.json();
        if (data.results && Array.isArray(data.results)) {
          const gbifPlants = data.results
            .filter((r: any) => r.canonicalName && r.taxonomicStatus === 'ACCEPTED')
            .map((r: any) => ({
              id: `gbif-${r.key}`,
              n: r.vernacularName || r.canonicalName,
              sci: r.canonicalName,
              f: r.family || 'Desconocida',
              type: 'Desconocido',
              space: 1,
              sun: 'Media',
              water: 'Media',
              soil: 'Cualquiera',
              hard: 5,
              edible: 0,
              med: 0,
              other: 0,
              hab: ''
            }));
          // Avoid duplicates by scientific name
          for (const gp of gbifPlants) {
            if (!results.some(r => r.sci.toLowerCase() === gp.sci.toLowerCase())) {
              results.push(gp);
            }
          }
        }
      }
    } catch (e) {
      console.warn('GBIF plant search failed', e);
    }
  }

  return results;
}
