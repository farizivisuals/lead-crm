// `../task` imports the real Supabase client, which touches expo-sqlite at
// module load and blows up under jest. isShootStage itself has no I/O, so a
// bare mock is enough to let the import resolve.
jest.mock('../../supabase', () => ({ supabase: {} }));

import { isShootStage, shootDueDate, diffCreatives } from '../task';
import { unassignedCreatives } from '../project-detail';

describe('isShootStage', () => {
  it('matches the stage named "Shoot" case-insensitively', () => {
    expect(isShootStage('Shoot')).toBe(true);
    expect(isShootStage('shoot')).toBe(true);
    expect(isShootStage('SHOOT')).toBe(true);
  });
  it('is false for any other stage name', () => {
    expect(isShootStage('Brief')).toBe(false);
    expect(isShootStage('Shooting')).toBe(false);
  });
  it('is false for null and undefined', () => {
    expect(isShootStage(null)).toBe(false);
    expect(isShootStage(undefined)).toBe(false);
  });
});

describe('shootDueDate', () => {
  it('collapses a shoot task onto its start date and otherwise keeps the due date', () => {
    expect(shootDueDate(true, '2026-08-11', '2026-08-20')).toBe('2026-08-11');
    expect(shootDueDate(false, '2026-08-11', '2026-08-20')).toBe('2026-08-20');
  });
});

describe('diffCreatives', () => {
  it('adds only the new ids and removes only the dropped ones', () => {
    // 'b' is unchanged: it must appear in neither list, or the save either
    // duplicates its task_creatives row or strips it.
    expect(diffCreatives(['b', 'c'], ['a', 'b'])).toEqual({ toAdd: ['c'], toRemove: ['a'] });
  });
});

describe('unassignedCreatives', () => {
  it('offers only creatives not already on the project', () => {
    const all = [{ profile_id: 'a' }, { profile_id: 'b' }];
    expect(unassignedCreatives(all, [{ profile_id: 'a' }])).toEqual([{ profile_id: 'b' }]);
  });
});
