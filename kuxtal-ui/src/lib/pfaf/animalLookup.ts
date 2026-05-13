import type { AnimalEntry } from './animals';

/**
 * GBIF Species API integration for searching animal registry online.
 * Focuses on Kingdom Animalia.
 */
export async function searchGbif(query: string): Promise<AnimalEntry[]> {
  if (!query || query.trim().length < 3) return [];

  // Use GBIF Species Match/Search API
  // https://api.gbif.org/v1/species/search?q=query&kingdom=Animalia
  const url = `https://api.gbif.org/v1/species/search?q=${encodeURIComponent(query)}&kingdom=Animalia&limit=10`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results
      .filter((r: any) => r.canonicalName && r.taxonomicStatus === 'ACCEPTED')
      .map((r: any) => {
        // Fallback names
        const commonName = r.vernacularName || r.canonicalName;
        // Construct the entry
        return {
          id: `gbif-${r.key}`,
          n: commonName,
          sci: r.canonicalName,
          emoji: '🐾', // Generic animal emoji fallback
          role: 'neutral', // default
          notes: `Orden: ${r.order || '?'}. Familia: ${r.family || '?'}. Importado desde GBIF.`
        } as AnimalEntry;
      });
  } catch (err) {
    console.error('GBIF search error:', err);
    return [];
  }
}
