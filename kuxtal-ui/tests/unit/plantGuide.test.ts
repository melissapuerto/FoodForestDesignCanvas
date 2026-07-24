import { describe, it, expect } from 'vitest';
import { parseList, sunFromPfaf, functionsFromPfaf } from '../../src/lib/plants/guide';

describe('parseList', () => {
  it('parses a JSON array, else returns []', () => {
    expect(parseList('["a","b"]')).toEqual(['a', 'b']);
    expect(parseList(null)).toEqual([]);
    expect(parseList('not json')).toEqual([]);
    expect(parseList('{"x":1}')).toEqual([]); // object, not array
  });
});

describe('sunFromPfaf', () => {
  it('maps PFAF sun text to the app enum', () => {
    expect(sunFromPfaf('Pleno sol')).toBe('completo');
    expect(sunFromPfaf('Sombra parcial')).toBe('sombra');
    expect(sunFromPfaf('semi')).toBe('parcial');
  });
});

describe('functionsFromPfaf', () => {
  it('derives function tags from PFAF scores + habit', () => {
    expect(functionsFromPfaf({ edible: 4, med: 1, other: 0 })).toEqual(['Comestible']);
    expect(functionsFromPfaf({ edible: 4, med: 4, other: 4, hab: 'Fijador' }))
      .toEqual(['Comestible', 'Medicinal', 'Soporte/Otros', 'Fijador']);
    expect(functionsFromPfaf({ edible: 0, med: 0, other: 0 })).toEqual([]);
  });
});
