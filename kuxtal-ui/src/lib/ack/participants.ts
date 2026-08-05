/**
 * Who made Kuxtal possible, and how to give something back.
 *
 * This is the in-app half of the PermaSE "thank you" matrix: for every person
 * who shared knowledge, the matrix asks not just for a credit line but for a
 * concrete way to return value to them. The `support` field is that answer.
 *
 * Consent rules applied here (ICK-07, R10):
 *  - Nobody appears without having consented to be named.
 *  - One interview participant consented to the research but not to being
 *    named, so they appear by role only. That is deliberate, not an omission.
 *  - One accessibility tester took part anonymously and is credited that way.
 *  - We credit what people contributed, never any personal or health detail
 *    they disclosed in order to help us test.
 */

export type Bilingual = { es: string; en: string };

export type Contributor = {
  /** Display name, or a role description when the person withheld their name. */
  name: Bilingual | string;
  /** Their project or collective. Proper nouns stay as they are. */
  project?: Bilingual | string;
  country: Bilingual;
  /** How someone reading this can give something back. */
  support?: Bilingual;
  link?: string;
};

/** The seven Phase 1 interviews, plus the community member who joined Round 2. */
export const PRACTITIONERS: Contributor[] = [
  {
    name: {
      es: 'Investigador en agricultura regenerativa (nombre reservado)',
      en: 'Researcher in regenerative agriculture (name withheld)'
    },
    country: { es: 'Reino Unido', en: 'United Kingdom' }
  },
  {
    name: 'Nicolas Omonuk',
    project: 'Plant for the Future',
    country: { es: 'Uganda', en: 'Uganda' },
    support: {
      es: 'Apoya el trabajo que Plant for the Future hace en el territorio.',
      en: 'Support the work Plant for the Future does on the ground.'
    }
  },
  {
    name: 'Jaime Moreno',
    project: 'ECOnciencia Terrestre',
    country: { es: 'Bogotá, Colombia', en: 'Bogotá, Colombia' },
    support: {
      es: 'Conoce y comparte los cursos de ECOnciencia Terrestre.',
      en: 'Look up and share the courses ECOnciencia Terrestre runs.'
    }
  },
  {
    name: 'Neroy Cruz Rivera',
    project: { es: 'Bosque de alimentos tepehua', en: 'Tepehua food forest' },
    country: { es: 'México', en: 'Mexico' },
    support: {
      es: 'Dona a S’ejen, para quien lo necesite.',
      en: 'Donate to S’ejen, for whoever needs it.'
    }
  },
  {
    name: 'Rodrigo Lañado C.',
    project: 'Hombres de Maíz',
    country: { es: 'Guanajuato, México', en: 'Guanajuato, Mexico' },
    support: {
      es: 'Apoya a Hombres de Maíz.',
      en: 'Support Hombres de Maíz.'
    }
  },
  {
    name: 'Natalia Caridad Quintana López',
    project: 'Proyecto comunitario familiar Vida',
    country: { es: 'Cuba', en: 'Cuba' },
    support: {
      es: 'Habla de Cuba y difunde lo que hace el proyecto.',
      en: 'Talk about Cuba, and pass on what this project is doing.'
    },
    link: 'https://www.greenofficevu.nl/blog/proyecto-vida'
  },
  {
    name: 'Diego de Mauricio & Emiliano',
    project: 'Bosque de Alimentos',
    country: { es: 'Argentina', en: 'Argentina' },
    support: {
      es: 'Apoya sus consultorías y los proyectos de Diego.',
      en: 'Support their consultancy work and Diego’s projects.'
    }
  },
  {
    name: 'Xavier',
    project: 'Centro de Permacultura y Agroecología Los Volcanes',
    country: { es: 'México', en: 'Mexico' }
  }
];

/** Accessibility testers and the independent code auditor. */
export const TESTERS: Contributor[] = [
  {
    name: 'Jesús Rodríguez Mendoza',
    project: 'Accesibilidad TV',
    country: { es: 'México', en: 'Mexico' },
    support: {
      es: 'Probó el lienzo con lector de pantalla y encontró el fallo más importante de toda la evaluación.',
      en: 'Tested the canvas with a screen reader and found the single most important failure in the whole evaluation.'
    }
  },
  {
    name: 'Alexandra Blanco',
    country: { es: 'Venezuela', en: 'Venezuela' },
    support: {
      es: 'Escribió y reescribió el protocolo de pruebas de accesibilidad.',
      en: 'Wrote, and then rewrote, the accessibility testing protocol.'
    }
  },
  {
    name: 'Jefferson Pereira',
    country: { es: 'Argentina', en: 'Argentina' },
    support: {
      es: 'Pruebas de accesibilidad con lector de pantalla.',
      en: 'Accessibility testing with a screen reader.'
    }
  },
  {
    name: 'Paola Villanueva',
    country: { es: 'México', en: 'Mexico' },
    support: {
      es: 'Pruebas de formularios accesibles.',
      en: 'Testing of accessible forms.'
    }
  },
  {
    name: {
      es: 'Una probadora que participó de forma anónima',
      en: 'A tester who took part anonymously'
    },
    country: { es: 'Marruecos', en: 'Morocco' },
    support: {
      es: 'Pruebas presenciales de accesibilidad.',
      en: 'In-person accessibility testing.'
    }
  },
  {
    name: 'Jesse Drelick',
    project: 'LiveStacks',
    country: { es: 'Estados Unidos', en: 'United States' },
    support: {
      es: 'Auditoría independiente del código y de las decisiones de arquitectura.',
      en: 'Independent audit of the code and the architecture decisions.'
    }
  }
];

/** Pick the right language out of a possibly-bilingual field. */
export function pick(value: Bilingual | string | undefined, locale: string): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return locale.startsWith('en') ? value.en : value.es;
}
