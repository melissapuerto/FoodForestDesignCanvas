/**
 * Curated animal registry for the Kuxtal seed.
 * Each entry: id, common name (es), scientific name (taxon-level), notes,
 * role: 'ayuda' | 'riesgo' | 'neutral', and optional aliases.
 */

export type AnimalEntry = {
  id: string;
  emoji: string;
  n: string;
  sci: string;
  aliases?: string[];
  role: 'ayuda' | 'riesgo' | 'neutral';
  notes: string;
};

export const ANIMAL_SEED: AnimalEntry[] = [
  { id: 'abeja',       emoji: '🐝', n: 'Abeja',         sci: 'Apis mellifera',     role: 'ayuda',   notes: 'Polinizador clave; favorece floración del cafetal y huerto.' },
  { id: 'abejaNativa', emoji: '🐝', n: 'Abeja nativa',  sci: 'Meliponini',         aliases: ['meliponas', 'angelitas'], role: 'ayuda',   notes: 'Sin aguijón. Polinizadora especializada de plantas nativas.' },
  { id: 'mariposa',    emoji: '🦋', n: 'Mariposa',      sci: 'Lepidoptera',        role: 'ayuda',   notes: 'Polinizador. Su presencia indica diversidad de néctar.' },
  { id: 'lombriz',     emoji: '🪱', n: 'Lombriz',       sci: 'Lumbricina',         role: 'ayuda',   notes: 'Mejora estructura y aireación del suelo. Señal de suelo sano.' },
  { id: 'hormiga',     emoji: '🐜', n: 'Hormiga',       sci: 'Formicidae',         role: 'neutral', notes: 'Algunas especies cortan hojas; otras controlan plagas.' },
  { id: 'arriera',     emoji: '🐜', n: 'Hormiga arriera', sci: 'Atta spp.',        aliases: ['cortadoras'], role: 'riesgo',  notes: 'Cortan hojas en cantidad. Manejo con barreras y preservación de depredadores.' },
  { id: 'pajaro',      emoji: '🐦', n: 'Pájaro',        sci: 'Aves',               role: 'ayuda',   notes: 'Dispersor de semillas y control de insectos.' },
  { id: 'colibri',     emoji: '🐦', n: 'Colibrí',       sci: 'Trochilidae',        role: 'ayuda',   notes: 'Polinizador especializado. Atraído por flores tubulares rojas.' },
  { id: 'lagartija',   emoji: '🦎', n: 'Lagartija',     sci: 'Lacertilia',         role: 'ayuda',   notes: 'Control biológico de insectos pequeños.' },
  { id: 'rana',        emoji: '🐸', n: 'Rana',          sci: 'Anura',              role: 'ayuda',   notes: 'Indicador de humedad y agua limpia. Come insectos.' },
  { id: 'cienpies',    emoji: '🐛', n: 'Ciempiés',      sci: 'Chilopoda',          role: 'neutral', notes: 'Depredador del suelo. Beneficioso aunque puede picar.' },
  { id: 'milpies',     emoji: '🐛', n: 'Milpiés',       sci: 'Diplopoda',          role: 'ayuda',   notes: 'Descomponedor. Aporta a la formación de humus.' },
  { id: 'arana',       emoji: '🕷️', n: 'Araña',         sci: 'Araneae',           role: 'ayuda',   notes: 'Depredador clave de mosquitos y plagas voladoras.' },
  { id: 'mariquita',   emoji: '🐞', n: 'Mariquita',     sci: 'Coccinellidae',      aliases: ['catarina', 'chinita'], role: 'ayuda',   notes: 'Devora pulgones y cochinillas. Aliada de la huerta.' },
  { id: 'aveAvispa',   emoji: '🐝', n: 'Avispa',        sci: 'Vespidae',           role: 'ayuda',   notes: 'Algunas son depredadoras de orugas. Cuidado con nidos cercanos.' },
  { id: 'caracol',     emoji: '🐌', n: 'Caracol',       sci: 'Gastropoda',         role: 'riesgo',  notes: 'Devora plántulas tiernas. Manejo con trampas de cerveza o bordes secos.' },
  { id: 'babosa',      emoji: '🐌', n: 'Babosa',        sci: 'Limacidae',          role: 'riesgo',  notes: 'Como el caracol; ataca hojas tiernas en zona húmeda.' },
  { id: 'pulgon',      emoji: '🦟', n: 'Pulgón',        sci: 'Aphidoidea',         role: 'riesgo',  notes: 'Chupa savia de brotes tiernos. Mariquitas y avispas lo controlan.' },
  { id: 'mosquito',    emoji: '🦟', n: 'Mosquito',      sci: 'Culicidae',          role: 'riesgo',  notes: 'Vector de enfermedades en zona tropical. Controla agua estancada.' },
  { id: 'gallina',     emoji: '🐔', n: 'Gallina',       sci: 'Gallus gallus',      role: 'neutral', notes: 'Aporta abono y control de insectos en zona controlada. Daña cultivos jóvenes.' },
  { id: 'pato',        emoji: '🦆', n: 'Pato',          sci: 'Anas spp.',          role: 'ayuda',   notes: 'Excelente control de babosas y mosquitos en zonas húmedas.' },
  { id: 'cerdo',       emoji: '🐖', n: 'Cerdo',         sci: 'Sus scrofa domesticus', role: 'neutral', notes: 'Removedor de suelo en zona forestal manejada. Daño si entra a la huerta.' },
  { id: 'cabra',       emoji: '🐐', n: 'Cabra',         sci: 'Capra hircus',       role: 'neutral', notes: 'Útil para desbrozar matorrales. Consume árboles jóvenes si no hay cerca.' },
  { id: 'oveja',       emoji: '🐑', n: 'Oveja',         sci: 'Ovis aries',         role: 'neutral', notes: 'Pasta el suelo y aporta abono. Compatible con frutales adultos.' },
  { id: 'serpiente',   emoji: '🐍', n: 'Serpiente',     sci: 'Serpentes',          role: 'neutral', notes: 'Control de roedores. Identifica si la especie local es venenosa.' },
  { id: 'roedor',      emoji: '🐀', n: 'Roedor',        sci: 'Rodentia',           aliases: ['ratón', 'rata'], role: 'riesgo',  notes: 'Daña tubérculos y semillas. Atrae depredadores naturales: serpientes, lechuzas.' },
  { id: 'murcielago',  emoji: '🦇', n: 'Murciélago',    sci: 'Chiroptera',         role: 'ayuda',   notes: 'Polinizador nocturno y control de insectos. Conserva refugios.' },

  // ---- Más fauna habitual de fincas en Latinoamérica ----
  { id: 'lechuza',     emoji: '🦉', n: 'Lechuza',        sci: 'Tytonidae',          role: 'ayuda',   notes: 'Cazadora nocturna de roedores. Una pareja controla varias hectáreas.' },
  { id: 'gavilan',     emoji: '🦅', n: 'Gavilán',        sci: 'Accipitridae',       role: 'ayuda',   notes: 'Rapaz diurna; control de roedores y palomas.' },
  { id: 'tucan',       emoji: '🐦', n: 'Tucán',          sci: 'Ramphastidae',       role: 'ayuda',   notes: 'Dispersor de semillas grandes. Indicador de bosque sano.' },
  { id: 'capibara',    emoji: '🦫', n: 'Capibara',       sci: 'Hydrochoerus hydrochaeris', aliases: ['chigüiro'], role: 'neutral', notes: 'Roedor grande de humedales. Pasta vegetación blanda.' },
  { id: 'zorro',       emoji: '🦊', n: 'Zorro',          sci: 'Vulpini',            role: 'neutral', notes: 'Control de roedores y pequeñas plagas. Ocasionalmente daña aves de corral.' },
  { id: 'comadreja',   emoji: '🐭', n: 'Comadreja',      sci: 'Mustela spp.',       role: 'neutral', notes: 'Excelente control de ratones; cuidado con aves de corral.' },
  { id: 'colmena',     emoji: '🍯', n: 'Colmena de abejas', sci: 'Apis mellifera',  role: 'ayuda',   notes: 'Polinización y miel. Mantén a 30 m de zonas de paso.' },
  { id: 'avispa_hada', emoji: '🐝', n: 'Avispa hada',    sci: 'Mymaridae',          role: 'ayuda',   notes: 'Microavispas parasitoides. Control biológico de plagas de huevo.' },
  { id: 'sapito',      emoji: '🐸', n: 'Sapo común',     sci: 'Bufonidae',          role: 'ayuda',   notes: 'Devora babosas e insectos nocturnos. Da refugios húmedos.' },
  { id: 'chinche_dep', emoji: '🐞', n: 'Chinche depredadora', sci: 'Reduviidae',    role: 'ayuda',   notes: 'Caza orugas y otros chinches plaga.' }
];
