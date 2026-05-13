// Andean / chakana solar-agricultural calendar (simplified). Highlights solstices, equinoxes,
// and the Inti Raymi / Pawkar Raymi / Inti Watana / Killa Raymi cycle.

export type AndinoMarker = {
  approxDate: { month: number; day: number };
  name: string;
  description: string;
};

export const ANDINO_MARKERS: AndinoMarker[] = [
  { approxDate: { month: 6, day: 21 }, name: 'Inti Raymi', description: 'Solsticio (Hemisferio Sur). Fiesta del sol y la cosecha.' },
  { approxDate: { month: 9, day: 22 }, name: 'Killa Raymi', description: 'Equinoccio. Fiesta de la luna y la siembra.' },
  { approxDate: { month: 12, day: 21 }, name: 'Qhapaq Raymi', description: 'Solsticio. Maduración y rituales de iniciación.' },
  { approxDate: { month: 3, day: 21 }, name: 'Pawkar Raymi', description: 'Equinoccio. Fiesta del florecimiento.' }
];

export function nextAndinoMarker(date: Date): { marker: AndinoMarker; daysUntil: number } {
  const year = date.getFullYear();
  let best: { marker: AndinoMarker; date: Date } | null = null;
  for (const m of ANDINO_MARKERS) {
    for (const y of [year, year + 1]) {
      const d = new Date(y, m.approxDate.month - 1, m.approxDate.day);
      if (d.getTime() >= date.getTime() && (!best || d < best.date)) {
        best = { marker: m, date: d };
      }
    }
  }
  if (!best) return { marker: ANDINO_MARKERS[0], daysUntil: 0 };
  const daysUntil = Math.ceil((best.date.getTime() - date.getTime()) / 86_400_000);
  return { marker: best.marker, daysUntil };
}
