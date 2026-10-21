import { describe, expect, it } from 'vitest';
import { cleanSection, gradeSection, sectionNote } from './format';

describe('cleanSection', () => {
  it('keeps letters and digits', () => {
    expect(cleanSection('Infinity1')).toBe('Infinity1');
  });

  it('drops anything a section may not contain', () => {
    expect(cleanSection('St. Rizal')).toBe('StRizal');
    expect(cleanSection('!!!')).toBe('');
    expect(cleanSection(null)).toBe('');
  });
});

describe('gradeSection', () => {
  it('joins the grade and the cleaned section', () => {
    expect(gradeSection('6', 'Infinity1')).toBe('Grade 6 · Infinity1');
    expect(gradeSection('6', '!!!')).toBe('Grade 6');
    expect(gradeSection(null, 'Infinity1')).toBe('Infinity1');
    expect(gradeSection(null, null)).toBe('—');
  });
});

describe('sectionNote', () => {
  it('only speaks up when the stored value is not what is shown', () => {
    expect(sectionNote('Infinity1')).toBeUndefined();
    expect(sectionNote(null)).toBeUndefined();
    expect(sectionNote('St. Rizal')).toContain('St. Rizal');
  });
});
