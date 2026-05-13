// Maya Tzolkin (260 days) and Haab (365 days) calendar — proleptic Gregorian conversion via GMT correlation.

const TZOLKIN_DAYS = [
  'Imix', 'Ikʼ', 'Akʼbʼal', 'Kʼan', 'Chikchan', 'Kimi', 'Manikʼ', 'Lamat',
  'Muluk', 'Ok', 'Chuwen', 'Ebʼ', 'Bʼen', 'Ix', 'Men', 'Kibʼ', 'Kabʼan',
  'Etzʼnabʼ', 'Kawak', 'Ajaw'
];

const HAAB_MONTHS = [
  'Pop', 'Woʼ', 'Sip', 'Sotzʼ', 'Sek', 'Xul', 'Yaxkʼin', 'Mol', 'Chʼen',
  'Yax', 'Sakʼ', 'Keh', 'Mak', 'Kʼankʼin', 'Muwan', 'Pax', 'Kʼayabʼ', 'Kumkʼu', 'Wayebʼ'
];

const GMT_CORRELATION = 584283;

export type MayaDate = {
  tzolkin: { number: number; day: string };
  haab: { day: number; month: string };
};

export function mayaForDate(date: Date): MayaDate {
  const julian = Math.floor(date.getTime() / 86_400_000 + 2440587.5);
  const lc = julian - GMT_CORRELATION;
  const tzNum = ((lc + 3) % 13 + 13) % 13;
  const tzIdx = ((lc + 19) % 20 + 20) % 20;
  const haabIdx = ((lc + 348) % 365 + 365) % 365;
  return {
    tzolkin: { number: tzNum + 1, day: TZOLKIN_DAYS[tzIdx] },
    haab: { day: haabIdx % 20, month: HAAB_MONTHS[Math.floor(haabIdx / 20)] }
  };
}
