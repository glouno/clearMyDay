import { describe, expect, it } from 'vitest';
import { extractCourseFromSummary } from './course-extractor';

describe('course extraction', () => {
  it.each([
    ['UM4IN814-DALAS-Cours', 'DALAS'],
    ['UM5INQ01-QAlg-Cours', 'QALG'],
    ['UM5INQ02-QCrypt-Examen Session2', 'QCRYPT'],
    ['UM5PYQ03-QIT', 'QIT'],
    ['UM5PYQ04-PhQC', 'PHQC'],
    ['UM5INQ12-AQCrypt-Cours', 'AQCRYPT'],
    ['UM4LVAN2-Anglais', 'ANGLAIS']
  ])('extracts %s', (summary, expected) => {
    expect(extractCourseFromSummary(summary)).toBe(expected);
  });
});
