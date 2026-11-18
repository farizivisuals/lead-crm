import { projectPeople, staffSlug } from '@shared/graphics';

const people = [
  { profile_id: 'ayah', slugs: ['creatives'] },
  { profile_id: 'noor', slugs: ['graphics'] },
  { profile_id: 'sara', slugs: ['creatives', 'graphics'] },
];
const ids = (slugs: string[]) => projectPeople(people, slugs).people.map((p) => p.profile_id);

describe('Branding', () => {
  it('offers graphic designers on Branding, creatives elsewhere, both when mixed', () => {
    expect(ids(['branding'])).toEqual(['noor', 'sara']);
    expect(ids(['video'])).toEqual(['ayah', 'sara']);
    expect(ids([])).toEqual(['ayah', 'sara']);
    expect(ids(['branding', 'photo'])).toEqual(['ayah', 'noor', 'sara']);
    expect(projectPeople(people, ['branding']).label).toBe('Graphic designers');
    expect(projectPeople(people, ['video']).label).toBe('Creatives');
  });

  it('sends Branding tasks to graphic designers', () => {
    expect(staffSlug('branding')).toBe('graphics');
    expect(staffSlug('video')).toBe('video');
  });
});
