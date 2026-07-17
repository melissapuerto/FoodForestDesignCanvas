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
  { id: 'chinche_dep', emoji: '🐞', n: 'Chinche depredadora', sci: 'Reduviidae',    role: 'ayuda',   notes: 'Caza orugas y otros chinches plaga.' },

  // ---- Polinizadores y enemigos naturales (control biológico) ----
  { id: 'abejorro',     emoji: '🐝', n: 'Abejorro',          sci: 'Bombus spp.',          role: 'ayuda',   notes: 'Polinizador robusto; vibra las flores (tomate, arándano).' },
  { id: 'sirfido',      emoji: '🪰', n: 'Mosca de las flores', sci: 'Syrphidae',          aliases: ['sírfido'], role: 'ayuda',   notes: 'Adulto poliniza; sus larvas devoran pulgones.' },
  { id: 'crisopa',      emoji: '🦟', n: 'Crisopa',            sci: 'Chrysopidae',          aliases: ['león de áfidos'], role: 'ayuda',   notes: 'Larvas voraces de pulgones, trips y huevos de plaga.' },
  { id: 'mantis',       emoji: '🦗', n: 'Mantis religiosa',   sci: 'Mantodea',             role: 'ayuda',   notes: 'Depredador generalista de insectos. Indicador de equilibrio.' },
  { id: 'libelula',     emoji: '🦗', n: 'Libélula',           sci: 'Odonata',              role: 'ayuda',   notes: 'Caza mosquitos al vuelo. Necesita agua cercana.' },
  { id: 'avispa_brac',  emoji: '🐝', n: 'Avispa bracónida',   sci: 'Braconidae',           role: 'ayuda',   notes: 'Parasitoide de orugas; mantiene plagas a raya.' },
  { id: 'mosca_taq',    emoji: '🪰', n: 'Mosca taquínida',    sci: 'Tachinidae',           role: 'ayuda',   notes: 'Parasitoide de orugas y chinches. Atraída por umbelíferas.' },
  { id: 'carabido',     emoji: '🪲', n: 'Escarabajo de tierra', sci: 'Carabidae',          role: 'ayuda',   notes: 'Depredador nocturno de babosas, larvas y huevos.' },
  { id: 'escarabajo_estiercol', emoji: '🪲', n: 'Escarabajo estercolero', sci: 'Scarabaeinae', aliases: ['mayate'], role: 'ayuda', notes: 'Entierra estiércol; mejora suelo y reduce parásitos del ganado.' },
  { id: 'cantarida',    emoji: '🪲', n: 'Escarabajo soldado',  sci: 'Cantharidae',          role: 'ayuda',   notes: 'Adultos y larvas comen pulgones y huevos de plaga.' },
  { id: 'acaro_dep',    emoji: '🕷️', n: 'Ácaro depredador',   sci: 'Phytoseiidae',         role: 'ayuda',   notes: 'Control biológico de la araña roja y otros ácaros plaga.' },
  { id: 'nematodo_ben', emoji: '🪱', n: 'Nematodo benéfico',   sci: 'Steinernema spp.',     role: 'ayuda',   notes: 'Parasita larvas de suelo (gorgojos, gallina ciega).' },

  // ---- Fauna del suelo y descomponedores ----
  { id: 'cochinilla_hum', emoji: '🐛', n: 'Cochinilla de humedad', sci: 'Oniscidea',       aliases: ['bicho bola'], role: 'ayuda',   notes: 'Descompone hojarasca y madera. Señal de mantillo activo.' },
  { id: 'colembolo',    emoji: '🐛', n: 'Colémbolo',          sci: 'Collembola',           role: 'ayuda',   notes: 'Micro-fauna que recicla materia orgánica del suelo.' },
  { id: 'escarabajo_rino', emoji: '🪲', n: 'Escarabajo rinoceronte', sci: 'Dynastinae',    role: 'neutral', notes: 'Larvas en compost; adultos a veces dañan palmas.' },
  { id: 'topo',         emoji: '🐾', n: 'Topo',                sci: 'Talpidae',             role: 'neutral', notes: 'Airea el suelo y come lombrices; sus túneles molestan en huerta.' },
  { id: 'armadillo',    emoji: '🐾', n: 'Armadillo',           sci: 'Dasypodidae',          role: 'neutral', notes: 'Remueve suelo buscando larvas; puede levantar cultivos jóvenes.' },

  // ---- Aves útiles y de corral ----
  { id: 'golondrina',   emoji: '🐦', n: 'Golondrina',          sci: 'Hirundinidae',         role: 'ayuda',   notes: 'Caza insectos voladores en pleno vuelo todo el día.' },
  { id: 'carpintero',   emoji: '🐦', n: 'Pájaro carpintero',   sci: 'Picidae',              role: 'ayuda',   notes: 'Extrae larvas barrenadoras de troncos.' },
  { id: 'garrapatero',  emoji: '🐦', n: 'Garrapatero',         sci: 'Crotophaga spp.',      aliases: ['cuervillo'], role: 'ayuda',   notes: 'Sigue al ganado comiendo garrapatas y moscas.' },
  { id: 'gallineta',    emoji: '🐦', n: 'Gallina de Guinea',   sci: 'Numida meleagris',     aliases: ['pintada'], role: 'ayuda',   notes: 'Devora garrapatas e insectos sin escarbar tanto como la gallina.' },
  { id: 'pato_real',    emoji: '🦆', n: 'Pato criollo',        sci: 'Cairina moschata',     role: 'ayuda',   notes: 'Excelente contra babosas y caracoles; daña menos que el ánade.' },
  { id: 'pavo',         emoji: '🦃', n: 'Pavo',                sci: 'Meleagris gallopavo',  role: 'neutral', notes: 'Come insectos grandes y maleza; abono abundante.' },
  { id: 'codorniz',     emoji: '🐦', n: 'Codorniz',            sci: 'Coturnix coturnix',    role: 'neutral', notes: 'Come semillas de maleza e insectos; huevos y abono.' },
  { id: 'garza',        emoji: '🐦', n: 'Garza',               sci: 'Ardeidae',             role: 'neutral', notes: 'En humedales come peces, ranas e insectos.' },
  { id: 'paloma',       emoji: '🕊️', n: 'Paloma',             sci: 'Columbidae',           role: 'riesgo',  notes: 'Desentierra y come semillas recién sembradas.' },
  { id: 'gorrion',      emoji: '🐦', n: 'Gorrión',             sci: 'Passer domesticus',    role: 'neutral', notes: 'Come semillas e insectos; en bandada daña granos.' },

  // ---- Mamíferos: ganado, mascotas y silvestres ----
  { id: 'vaca',         emoji: '🐄', n: 'Vaca',                sci: 'Bos taurus',           role: 'neutral', notes: 'Pastoreo rotacional y abono; compactación si hay sobrecarga.' },
  { id: 'caballo',      emoji: '🐎', n: 'Caballo',             sci: 'Equus caballus',       role: 'neutral', notes: 'Tracción y abono. Pasta selectivamente.' },
  { id: 'burro',        emoji: '🫏', n: 'Burro',               sci: 'Equus asinus',         role: 'neutral', notes: 'Carga y desbroce; guardián frente a perros y zorros.' },
  { id: 'conejo',       emoji: '🐇', n: 'Conejo',              sci: 'Oryctolagus cuniculus', role: 'neutral', notes: 'Carne y estiércol rico; daña huerta si escapa.' },
  { id: 'cuy',          emoji: '🐹', n: 'Cuy / Cobayo',        sci: 'Cavia porcellus',      aliases: ['cobaya'], role: 'neutral', notes: 'Andino: proteína y abono; se cría con forraje y restos.' },
  { id: 'llama',        emoji: '🦙', n: 'Llama',               sci: 'Lama glama',           role: 'neutral', notes: 'Andina: fibra, carga y abono. Pasta suave en altura.' },
  { id: 'alpaca',       emoji: '🦙', n: 'Alpaca',              sci: 'Vicugna pacos',        role: 'neutral', notes: 'Andina: fibra fina; pastoreo de baja huella.' },
  { id: 'perro',        emoji: '🐕', n: 'Perro guardián',      sci: 'Canis familiaris',     role: 'ayuda',   notes: 'Protege el corral de zorros y roedores grandes.' },
  { id: 'gato',         emoji: '🐈', n: 'Gato',                sci: 'Felis catus',          role: 'ayuda',   notes: 'Control de roedores; mantener lejos de nidos de aves.' },
  { id: 'erizo',        emoji: '🦔', n: 'Erizo',               sci: 'Erinaceus europaeus',  role: 'ayuda',   notes: 'Devora babosas, orugas y escarabajos por la noche.' },
  { id: 'zarigueya',    emoji: '🐾', n: 'Zarigüeya / Tlacuache', sci: 'Didelphis spp.',     role: 'ayuda',   notes: 'Come insectos, caracoles y garrapatas; limpia carroña.' },
  { id: 'venado',       emoji: '🦌', n: 'Venado',              sci: 'Cervidae',             role: 'riesgo',  notes: 'Ramonea brotes y frutales jóvenes; requiere cercas altas.' },
  { id: 'mapache',      emoji: '🦝', n: 'Mapache',             sci: 'Procyon lotor',        role: 'riesgo',  notes: 'Saquea maíz maduro y gallineros de noche.' },

  // ---- Reptiles, anfibios y fauna acuática ----
  { id: 'salamandra',   emoji: '🦎', n: 'Salamandra',          sci: 'Caudata',              role: 'ayuda',   notes: 'En zonas húmedas come babosas e insectos del suelo.' },
  { id: 'iguana',       emoji: '🦎', n: 'Iguana',              sci: 'Iguanidae',            role: 'neutral', notes: 'Herbívora; puede ramonear hojas tiernas en el trópico.' },
  { id: 'tortuga',      emoji: '🐢', n: 'Tortuga',             sci: 'Testudines',           role: 'neutral', notes: 'Come maleza, babosas y caracoles a ras de suelo.' },
  { id: 'pez_acuapon',  emoji: '🐟', n: 'Pez (acuaponía)',     sci: 'Cyprinidae',           role: 'ayuda',   notes: 'En estanque aporta nutrientes y come larvas de mosquito.' },
  { id: 'tilapia',      emoji: '🐟', n: 'Tilapia',             sci: 'Oreochromis spp.',     role: 'ayuda',   notes: 'Acuaponía y proteína; su agua fertiliza cultivos.' },

  // ---- Plagas comunes (a monitorear) ----
  { id: 'mosca_blanca', emoji: '🦟', n: 'Mosca blanca',        sci: 'Aleyrodidae',          role: 'riesgo',  notes: 'Chupa savia y transmite virus; control con sírfidos y jabón potásico.' },
  { id: 'cochinilla_har', emoji: '🐛', n: 'Cochinilla harinosa', sci: 'Pseudococcidae',     role: 'riesgo',  notes: 'Algodonosa en tallos y raíces; atrae hormigas.' },
  { id: 'trips',        emoji: '🦟', n: 'Trips',               sci: 'Thysanoptera',         role: 'riesgo',  notes: 'Raspa hojas y flores; vector de virus. Ácaros y crisopas ayudan.' },
  { id: 'mosca_fruta',  emoji: '🪰', n: 'Mosca de la fruta',   sci: 'Tephritidae',          role: 'riesgo',  notes: 'Pone huevos en frutos; usa trampas cebo y recoge caídos.' },
  { id: 'cogollero',    emoji: '🐛', n: 'Gusano cogollero',    sci: 'Spodoptera frugiperda', role: 'riesgo',  notes: 'Devora cogollo del maíz; control con Bt y enemigos naturales.' },
  { id: 'chinche_apest', emoji: '🐛', n: 'Chinche apestosa',   sci: 'Pentatomidae',         role: 'riesgo',  notes: 'Pica frutos y vainas; manéjala con taquínidas y aves.' },
  { id: 'saltamontes',  emoji: '🦗', n: 'Saltamontes',         sci: 'Caelifera',            role: 'riesgo',  notes: 'Defolia en brotes; aves y mantis lo controlan.' },
  { id: 'gorgojo',      emoji: '🪲', n: 'Gorgojo',             sci: 'Curculionidae',        role: 'riesgo',  notes: 'Daña granos almacenados y raíces; nematodos benéficos ayudan.' },
  { id: 'nematodo_agalla', emoji: '🪱', n: 'Nematodo agallador', sci: 'Meloidogyne spp.',   role: 'riesgo',  notes: 'Forma nudos en raíces; rota con tagetes y materia orgánica.' },
  { id: 'termita',      emoji: '🐛', n: 'Termita',             sci: 'Isoptera',             role: 'neutral', notes: 'Recicla madera muerta; riesgo para estructuras y árboles débiles.' },
  { id: 'grillo_topo',  emoji: '🦗', n: 'Grillo topo',         sci: 'Gryllotalpidae',       role: 'riesgo',  notes: 'Corta raíces y plántulas bajo tierra en suelo húmedo.' },

  // ---- Abejas nativas sin aguijón (meliponinas — clave en Mesoamérica) ----
  { id: 'melipona',     emoji: '🐝', n: 'Abeja melipona',      sci: 'Melipona beecheii',    aliases: ['xunan kab', 'abeja maya'], role: 'ayuda',   notes: 'Abeja sagrada maya. Polinizadora especializada; miel medicinal. Requiere meliponario.' },
  { id: 'trigona',      emoji: '🐝', n: 'Abeja trigona',       sci: 'Trigona spp.',          aliases: ['angelita', 'jicote'], role: 'ayuda',   notes: 'Sin aguijón. Polinizadora de cultivos en sotobosque; fácil manejo en cajas o huecos.' },
  { id: 'scaptotrigona', emoji: '🐝', n: 'Abeja de tierra',    sci: 'Scaptotrigona spp.',   aliases: ['abeja de palo'], role: 'ayuda',   notes: 'Nidifica en troncos o tierra. Poliniza aguacate y cacao eficientemente.' },
  { id: 'abeja_orquidea', emoji: '🐝', n: 'Abeja de las orquídeas', sci: 'Eulaema spp.',   role: 'ayuda',   notes: 'Polinizadora de plantas de sotobosque tropical. Indicadora de bosque sano.' },

  // ---- Fauna mesoamericana y tropical ----
  { id: 'coati',        emoji: '🦝', n: 'Coatí / Tejón',       sci: 'Nasua narica',         aliases: ['pisote', 'tejón'], role: 'neutral', notes: 'Omnívoro; controla larvas e insectos del suelo pero puede desenterrar cultivos.' },
  { id: 'tapir',        emoji: '🐾', n: 'Tapir',                sci: 'Tapirus bairdii',      role: 'neutral', notes: 'Dispersor de semillas grandes. Señal de bosque primario. Mantén corredor.' },
  { id: 'pajaro_rey',   emoji: '🐦', n: 'Guardabarranco / Momoto', sci: 'Momotus momota',  role: 'ayuda',   notes: 'Come insectos y lagartijas. Indicador de bosque tropical sano.' },
  { id: 'zenzontle',    emoji: '🐦', n: 'Cenzontle',            sci: 'Mimus polyglottos',   aliases: ['sinsonte'], role: 'ayuda',   notes: 'Canta 200+ canciones. Come insectos y bayas. Atrae con arbustos frutales.' },
  { id: 'loro',         emoji: '🦜', n: 'Loro / Cotorra',       sci: 'Amazona spp.',        role: 'neutral', notes: 'Dispersor de semillas y frutas. Puede dañar cosecha de granos si hay bandadas.' },
  { id: 'tucancillo',   emoji: '🐦', n: 'Tucancillo / Arasarí', sci: 'Pteroglossus spp.',   role: 'ayuda',   notes: 'Dispersor de semillas de frutos grandes. Necesita árboles con cavidades.' },
  { id: 'quetzal',      emoji: '🐦', n: 'Quetzal',              sci: 'Pharomachrus mocinno', role: 'ayuda',   notes: 'Dispersor de aguacatillos. Solo en bosque nublado mesoamericano ≥1500m.' },
  { id: 'pijije',       emoji: '🦆', n: 'Pijije / Pato silbador', sci: 'Dendrocygna autumnalis', role: 'neutral', notes: 'Controla maleza acuática e insectos en arrozales. Puede dañar cultivos anegados.' },
  { id: 'zanate',       emoji: '🐦', n: 'Zanate / Grackle',     sci: 'Quiscalus mexicanus', role: 'neutral', notes: 'Come insectos y semillas. En bandadas puede dañar maíz maduro.' },
  { id: 'zopilote',     emoji: '🦅', n: 'Zopilote',             sci: 'Cathartes aura',      aliases: ['aura', 'gallinazo'], role: 'ayuda',   notes: 'Limpiador de carroña. Previene enfermedades en la finca. Nunca persigas.' },
  { id: 'boa',          emoji: '🐍', n: 'Boa / Mazacuata',      sci: 'Boa constrictor',     role: 'ayuda',   notes: 'Controla roedores eficientemente. No venenosa; conserva si aparece en la finca.' },
  { id: 'ranita_arborea', emoji: '🐸', n: 'Ranita de árbol',    sci: 'Smilisca baudinii',   role: 'ayuda',   notes: 'Come insectos nocturnos. Su canto indica buena humedad y agua limpia cercana.' },

  // ---- Aves de corral andinas y tropicales adicionales ----
  { id: 'pato_criollo_andino', emoji: '🦆', n: 'Pato de los andes', sci: 'Cairina moschata var.', aliases: ['pato andino'], role: 'ayuda', notes: 'Variedad local andina. Come larvas, caracoles y maleza; daña menos que el pato común.' },
  { id: 'gallina_criolla', emoji: '🐔', n: 'Gallina criolla',    sci: 'Gallus gallus domesticus', aliases: ['gallina de rancho'], role: 'neutral', notes: 'Raza rústica local. Resiste enfermedades; control de insectos en zonas manejadas.' },
  { id: 'guajolote_nativo', emoji: '🦃', n: 'Guajolote nativo', sci: 'Meleagris gallopavo mexicana', aliases: ['cócono', 'chompipe'], role: 'neutral', notes: 'Pavo mesoamericano domesticado. Come insectos grandes, lagartijas y semillas de maleza.' },

  // ---- Fauna acuática y de humedal ----
  { id: 'mojarra',      emoji: '🐟', n: 'Mojarra / Guapote',    sci: 'Parachromis managuensis', role: 'ayuda', notes: 'Cíclido mesoamericano para acuaponía. Aprovecha calor tropical; crece rápido.' },
  { id: 'trucha',       emoji: '🐟', n: 'Trucha arcoíris',      sci: 'Oncorhynchus mykiss',  role: 'ayuda',   notes: 'Para sistemas en altura o climas frescos. Acuaponía en zona de montaña.' },
  { id: 'bagre',        emoji: '🐟', n: 'Bagre',                sci: 'Ictalurus spp.',        role: 'ayuda',   notes: 'Pez de fondo para acuaponía. Tolera agua baja en oxígeno.' },
  { id: 'caiman',       emoji: '🐊', n: 'Caimán',               sci: 'Caiman crocodilus',    role: 'neutral', notes: 'En humedales regula poblaciones de carpas y nutrias. Mantener alejado de aves de corral.' },
  { id: 'rana_toro',    emoji: '🐸', n: 'Rana toro',            sci: 'Lithobates catesbeianus', role: 'neutral', notes: 'Proteína en ranarios. Puede ser invasora fuera de su rango; manejo cerrado.' },

  // ---- Insectos y artrópodos adicionales ----
  { id: 'escorpion',    emoji: '🦂', n: 'Escorpión',            sci: 'Centruroides spp.',    role: 'neutral', notes: 'Depredador de cucarachas e insectos. Peligroso; mantener refugios lejos de la vivienda.' },
  { id: 'mayate_verde', emoji: '🪲', n: 'Mayate verde',         sci: 'Cotinis mutabilis',    role: 'neutral', notes: 'Adultos visitan flores; larvas en compost aceleran descomposición.' },
  { id: 'pelotero',     emoji: '🪲', n: 'Escarabajo pelotero',  sci: 'Canthon pilularius',   role: 'ayuda',   notes: 'Entierra estiércol tropical; activa ciclo de nutrientes e indica suelo vivo.' },
  { id: 'hormiga_acacia', emoji: '🐜', n: 'Hormiga de acacia',  sci: 'Pseudomyrmex ferrugineus', role: 'ayuda', notes: 'Defiende a la acacia y en extensión protege plantas vecinas de herbívoros.' },
  { id: 'tijereta',     emoji: '🪲', n: 'Tijereta',             sci: 'Forficula auricularia', role: 'ayuda',  notes: 'Depredadora nocturna de pulgones, trips y huevos de plaga.' },
  { id: 'crisomela',    emoji: '🪲', n: 'Crisomelida benéfica', sci: 'Diabrotica spp.',      role: 'riesgo',  notes: 'Algunas especies dañan raíces de maíz; otras son polinizadoras de cucurbitáceas.' },
  { id: 'avispa_papel', emoji: '🐝', n: 'Avispa de papel',      sci: 'Polistes spp.',        role: 'ayuda',   notes: 'Caza orugas para alimentar su nido. Un nido cerca protege varias plantas.' },

  // ---- Mamíferos silvestres ──
  { id: 'paca',         emoji: '🐾', n: 'Paca / Tepezcuintle', sci: 'Cuniculus paca',        aliases: ['tepescuintle', 'guanta'], role: 'riesgo', notes: 'Roe tubérculos y raíces. Señal de bosque. Gestión con protección de raíces.' },
  { id: 'tejón_miel',   emoji: '🦡', n: 'Tejón de miel',        sci: 'Mellivora capensis',   role: 'neutral', notes: 'Rompe colmenas. Proteger meliponarios con aberturas pequeñas.' },
  { id: 'aguila_harpia', emoji: '🦅', n: 'Águila arpía',        sci: 'Harpia harpyja',       role: 'ayuda',   notes: 'Ápice de la cadena tropical. Su presencia indica ecosistema muy sano.' },
  { id: 'monarca',      emoji: '🦋', n: 'Mariposa monarca',     sci: 'Danaus plexippus',     role: 'ayuda',   notes: 'Migratoria. Planta asclepia para atraerla; indicadora de diversidad.' }
];
