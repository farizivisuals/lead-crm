// `../task-deliverables` imports the real Supabase client, which touches
// expo-sqlite at module load and blows up under jest. The helpers under test
// are pure, so a bare mock is enough to let the import resolve.
jest.mock('../../supabase', () => ({ supabase: {} }));

import {
  adjacentStage,
  deliverableStageId,
  leastAdvancedStageId,
  stageRow,
  type StageLite,
  type TaskDeliverable,
} from '../task-deliverables';

const STAGES: StageLite[] = [
  { id: 'pre', name: 'Pre-production', position: 1, is_terminal: false, color: null },
  { id: 'shoot', name: 'Shoot', position: 2, is_terminal: false, color: null },
  { id: 'post', name: 'Post-production', position: 3, is_terminal: false, color: null },
  { id: 'done', name: 'Delivered', position: 4, is_terminal: true, color: null },
];

function deliverable(id: string, stageId: string | null): TaskDeliverable {
  return {
    id,
    task_id: 't1',
    title: id,
    position: 0,
    current_stage_id: stageId,
    task_deliverable_assignments: null,
  };
}

describe('deliverableStageId', () => {
  it('falls back to the task stage when the deliverable has none', () => {
    expect(deliverableStageId(deliverable('v1', null), 'shoot')).toBe('shoot');
    expect(deliverableStageId(deliverable('v1', 'post'), 'shoot')).toBe('post');
  });
});

describe('adjacentStage', () => {
  it('steps forward and back through the ordered stages', () => {
    expect(adjacentStage(STAGES, 'shoot', 1)?.id).toBe('post');
    expect(adjacentStage(STAGES, 'shoot', -1)?.id).toBe('pre');
  });
  it('returns null at either end, so the buttons disable instead of wrapping', () => {
    expect(adjacentStage(STAGES, 'pre', -1)).toBeNull();
    expect(adjacentStage(STAGES, 'done', 1)).toBeNull();
  });
  it('orders by position, not by array order', () => {
    const shuffled = [...STAGES].reverse();
    expect(adjacentStage(shuffled, 'shoot', 1)?.id).toBe('post');
  });
  it('returns null for a stage that is not in the list', () => {
    expect(adjacentStage(STAGES, 'nope', 1)).toBeNull();
  });
});

describe('leastAdvancedStageId', () => {
  it('holds the task at its furthest-behind deliverable', () => {
    // Video 1 delivered, Videos 2-3 still shooting -> the task is still "Shoot".
    const rows = [deliverable('v1', 'done'), deliverable('v2', 'shoot'), deliverable('v3', 'shoot')];
    expect(leastAdvancedStageId(rows, STAGES, 'pre')).toBe('shoot');
  });
  it('only reports the terminal stage once every deliverable is there', () => {
    const rows = [deliverable('v1', 'done'), deliverable('v2', 'done')];
    expect(leastAdvancedStageId(rows, STAGES, 'pre')).toBe('done');
  });
  it('keeps the task stage when there are no deliverables', () => {
    expect(leastAdvancedStageId([], STAGES, 'post')).toBe('post');
  });
  it('treats a deliverable with no stage of its own as sitting at the task stage', () => {
    const rows = [deliverable('v1', 'done'), deliverable('v2', null)];
    expect(leastAdvancedStageId(rows, STAGES, 'pre')).toBe('pre');
  });
});

describe('stageRow', () => {
  it('picks the scheduling row for one phase and ignores the others', () => {
    const d: TaskDeliverable = {
      ...deliverable('v1', 'post'),
      task_deliverable_assignments: [
        {
          deliverable_id: 'v1',
          stage_id: 'shoot',
          assigned_to: 'quintin',
          scheduled_date: '2026-08-14',
          employees: null,
        },
        {
          deliverable_id: 'v1',
          stage_id: 'post',
          assigned_to: 'hisham',
          scheduled_date: null,
          employees: null,
        },
      ],
    };
    expect(stageRow(d, 'post')?.assigned_to).toBe('hisham');
    expect(stageRow(d, 'shoot')?.scheduled_date).toBe('2026-08-14');
    expect(stageRow(d, 'done')).toBeNull();
  });
});
