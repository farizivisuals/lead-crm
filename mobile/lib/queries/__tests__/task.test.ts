// `../task` imports the real Supabase client, which touches expo-sqlite at
// module load and blows up under jest. isShootStage itself has no I/O, so a
// bare mock is enough to let the import resolve.
jest.mock('../../supabase', () => ({ supabase: {} }));

import { isShootStage } from '../task';

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
