export type LunarPhase = 'nueva' | 'creciente' | 'llena' | 'menguante';

const SYNODIC = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

export function lunarPhaseForDate(date: Date): {
  phase: LunarPhase;
  illumination: number;
  ageDays: number;
  emoji: string;
} {
  const diffDays = (date.getTime() - KNOWN_NEW_MOON) / 86_400_000;
  const ageDays = ((diffDays % SYNODIC) + SYNODIC) % SYNODIC;
  const illumination = (1 - Math.cos((2 * Math.PI * ageDays) / SYNODIC)) / 2;
  let phase: LunarPhase;
  if (ageDays < 1.85 || ageDays > SYNODIC - 1.85) phase = 'nueva';
  else if (ageDays < SYNODIC / 2 - 1.85) phase = 'creciente';
  else if (ageDays < SYNODIC / 2 + 1.85) phase = 'llena';
  else phase = 'menguante';
  return { phase, illumination, ageDays, emoji: PHASE_EMOJI[phase] };
}

const PHASE_EMOJI: Record<LunarPhase, string> = {
  nueva: '🌑',
  creciente: '🌒',
  llena: '🌕',
  menguante: '🌘'
};

export const PHASE_LABELS: Record<LunarPhase, string> = {
  nueva: 'Luna nueva',
  creciente: 'Luna creciente',
  llena: 'Luna llena',
  menguante: 'Luna menguante'
};
