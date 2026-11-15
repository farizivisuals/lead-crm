// Both modules import the real Supabase client, which touches expo-sqlite at
// module load and blows up under jest. The helpers under test have no I/O, so
// a bare mock is enough to let the imports resolve.
jest.mock('../../supabase', () => ({ supabase: {} }));

import { describeStageChange } from '../activity';
import { latestRevision } from '../deliverables';

describe('describeStageChange', () => {
  it('drops the "from" clause for the first move into a stage', () => {
    // from_stage_id is null on a task's first move — the sentence must not
    // claim it came from somewhere.
    const flat = describeStageChange({
      id: 'h1',
      moved_at: '2026-08-11T10:00:00Z',
      tasks: { title: 'Luca Shoot' },
      from_stage: null,
      to_stage: { name: 'Shoot' },
      profiles: { full_name: 'Salman Farizi' },
    });
    expect(flat.fromStage).toBeNull();
    expect(flat.toStage).toBe('Shoot');
    expect(flat.actor).toBe('Salman Farizi');
    expect(flat.taskTitle).toBe('Luca Shoot');
  });

  it('unwraps single-element arrays, which is how Supabase returns these embeds', () => {
    const flat = describeStageChange({
      id: 'h2',
      moved_at: '2026-08-11T11:00:00Z',
      tasks: [{ title: 'Luca Video Edits' }],
      from_stage: [{ name: 'Shoot' }],
      to_stage: [{ name: 'Post-production' }],
      profiles: [{ full_name: 'Quintin' }],
    });
    expect(flat.fromStage).toBe('Shoot');
    expect(flat.toStage).toBe('Post-production');
    expect(flat.taskTitle).toBe('Luca Video Edits');
  });
});

describe('latestRevision', () => {
  it('picks by created_at, not by array position', () => {
    // The web takes revisions[0] from an unordered select. If this ever
    // reduces to "first element", the screen shows stale feedback.
    const older = {
      action: 'request_revision' as const,
      note: 'Needs work',
      created_at: '2026-08-01T00:00:00Z',
      profiles: { full_name: 'Dina' },
    };
    const newer = {
      action: 'approve' as const,
      note: null,
      created_at: '2026-08-09T00:00:00Z',
      profiles: { full_name: 'Anwar' },
    };
    expect(latestRevision([older, newer])).toBe(newer);
    expect(latestRevision([newer, older])).toBe(newer);
  });

  it('is null for no revisions', () => {
    expect(latestRevision(null)).toBeNull();
    expect(latestRevision([])).toBeNull();
  });
});
