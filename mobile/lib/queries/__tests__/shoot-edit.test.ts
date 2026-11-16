/**
 * Shared shoot + edit task creation (lib/shoot-edit.ts), used by both the web
 * dialog and the mobile screen. A hand-rolled recorder stands in for Supabase
 * and is passed in directly — no module mocking.
 */
import {
  createShootWithEdits,
  shootEditClashes,
  editStageAfterShoot,
  editTaskTitle,
  shootEditErrors,
  type ShootWithEditsInput,
  type StageLite,
} from '@shared/shoot-edit';

const VIDEO: StageLite[] = [
  { id: 'pre', name: 'Pre-production', position: 1, is_terminal: false },
  { id: 'shoot', name: 'Shoot', position: 2, is_terminal: false },
  { id: 'post', name: 'Post-production', position: 3, is_terminal: false },
  { id: 'done', name: 'Delivered', position: 4, is_terminal: true },
];
const CREATIVES: StageLite[] = [
  { id: 'c1', name: 'Concept', position: 1, is_terminal: false },
  { id: 'c2', name: 'Production', position: 2, is_terminal: false },
];

function input(over: Partial<ShootWithEditsInput> = {}): ShootWithEditsInput {
  return {
    projectId: 'proj',
    departmentId: 'video',
    stages: VIDEO,
    title: 'Brand Film',
    description: '',
    priority: 'medium',
    shootDate: '2026-11-20',
    shooterId: 'shooter',
    creativeIds: ['cr1'],
    edits: [
      { editorId: 'ali', editorName: 'Ali Hassan', startDate: '2026-11-21', dueDate: '2026-11-25', videos: ['Video 1', 'Video 2'] },
      { editorId: 'sara', editorName: 'Sara Noor', startDate: '2026-11-22', dueDate: '2026-11-28', videos: ['Video 3'] },
    ],
    userId: 'me',
    ...over,
  };
}

type Op = { table: string; op: string; payload?: any; ids?: string[] };

/**
 * `conflicts` maps an assignee id to the overlapping tasks the availability
 * query returns for them; `failTaskInsertAt` makes the Nth `tasks` insert fail.
 */
function recorder(opts: { conflicts?: Record<string, { id: string; title: string }[]>; failTaskInsertAt?: number } = {}) {
  const ops: Op[] = [];
  let taskInserts = 0;
  const db = {
    from(table: string) {
      return {
        select() {
          let assignee = '';
          const q: any = {
            eq(col: string, val: string) {
              if (col === 'assigned_to') assignee = val;
              return q;
            },
            not: () => q,
            lte: () => q,
            gte: () => q,
            then: (res: any, rej: any) =>
              Promise.resolve({ data: opts.conflicts?.[assignee] ?? [], error: null }).then(res, rej),
          };
          return q;
        },
        insert(payload: any) {
          ops.push({ table, op: 'insert', payload });
          if (table === 'tasks') {
            taskInserts++;
            const n = taskInserts;
            const res =
              n === opts.failTaskInsertAt
                ? { data: null, error: new Error('insert failed') }
                : { data: { id: `task-${n}` }, error: null };
            return { select: () => ({ single: async () => res }) };
          }
          return Promise.resolve({ error: null });
        },
        delete() {
          return {
            in(_col: string, ids: string[]) {
              ops.push({ table, op: 'delete', ids });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { db, ops };
}

describe('editStageAfterShoot', () => {
  it('is the stage right after Shoot', () => {
    expect(editStageAfterShoot(VIDEO)?.id).toBe('post');
  });
  it('is null for a department without a Shoot stage', () => {
    expect(editStageAfterShoot(CREATIVES)).toBeNull();
  });
});

describe('editTaskTitle', () => {
  it('uses the editor first name', () => {
    expect(editTaskTitle('Brand Film', 'Ali Hassan')).toBe('Brand Film — Edit (Ali)');
  });
});

describe('shootEditErrors', () => {
  const block = input().edits[0];
  it('accepts a valid booking', () => {
    expect(shootEditErrors(input())).toBeNull();
  });
  it('needs a shoot date', () => {
    expect(shootEditErrors(input({ shootDate: '' }))).toBe('Pick a shoot date');
  });
  it('needs at least one edit block', () => {
    expect(shootEditErrors(input({ edits: [] }))).toBe('Add at least one edit block');
  });
  it('needs an editor per block', () => {
    expect(shootEditErrors(input({ edits: [{ ...block, editorId: '', editorName: '' }] }))).toBe('Pick an editor');
  });
  it('needs both edit dates', () => {
    expect(shootEditErrors(input({ edits: [{ ...block, dueDate: '' }] }))).toBe('Add edit start and due dates');
  });
  it('rejects a due date before the start', () => {
    expect(shootEditErrors(input({ edits: [{ ...block, startDate: '2026-11-25', dueDate: '2026-11-21' }] }))).toBe(
      'Edit due date is before its start date'
    );
  });
  it('needs at least one video per block', () => {
    expect(shootEditErrors(input({ edits: [{ ...block, videos: [] }] }))).toBe('Add at least one video for Ali');
  });
  it('wants both shoot times or neither, end after start', () => {
    expect(shootEditErrors(input({ shootStart: '09:00', shootEnd: null }))).toBe('Add an end time');
    expect(shootEditErrors(input({ shootStart: '12:00', shootEnd: '09:00' }))).toBe('End time must be after start time');
    expect(shootEditErrors(input({ shootStart: '09:00', shootEnd: '12:00' }))).toBeNull();
  });
  it('rejects the same editor in two blocks', () => {
    expect(shootEditErrors(input({ edits: [block, { ...block, videos: ['Video 9'] }] }))).toBe(
      'Ali is in two edit blocks'
    );
  });
});

const busy = (id: string, title: string, date: string, start_time: string | null = null, end_time: string | null = null) => ({
  id,
  title,
  start_date: date,
  due_date: date,
  start_time,
  end_time,
});

describe('shootEditClashes', () => {
  it('names everyone who already has 2 tasks then', async () => {
    const { db, ops } = recorder({
      conflicts: {
        shooter: [
          busy('y', 'Other shoot', '2026-11-20', '10:00:00', '11:00:00'),
          busy('z', 'Photo shoot', '2026-11-20', '09:30:00', '10:30:00'),
        ],
        ali: [busy('x', 'Other edit', '2026-11-22'), busy('w', 'Reel edit', '2026-11-22')],
      },
    });
    await expect(shootEditClashes(db, input({ shootStart: '09:00', shootEnd: '12:00' }))).resolves.toEqual([
      'The shooter already has 2 tasks then: Other shoot (10:00–11:00), Photo shoot (09:30–10:30)',
      'Ali already has 2 tasks then: Other edit, Reel edit',
    ]);
    expect(ops).toEqual([]);
  });

  it('lets a second task at the same time through without a warning', async () => {
    const { db } = recorder({ conflicts: { shooter: [busy('y', 'Video shoot', '2026-11-20', '09:00', '12:00')] } });
    await expect(shootEditClashes(db, input({ shootStart: '09:00', shootEnd: '12:00' }))).resolves.toEqual([]);
  });

  it('ignores a same-day shoot at another time', async () => {
    const { db } = recorder({ conflicts: { shooter: [busy('y', 'Morning shoot', '2026-11-20', '09:00', '12:00')] } });
    await expect(shootEditClashes(db, input({ shootStart: '13:00', shootEnd: '16:00' }))).resolves.toEqual([]);
  });
});

describe('createShootWithEdits', () => {
  it('creates the shoot task and one linked edit task per editor', async () => {
    const { db, ops } = recorder();
    const res = await createShootWithEdits(db, input());

    expect(res).toEqual({ shootId: 'task-1', editIds: ['task-2', 'task-3'] });
    const tasks = ops.filter((o) => o.table === 'tasks').map((o) => o.payload);
    expect(tasks[0]).toMatchObject({
      current_stage_id: 'pre',
      start_date: '2026-11-20',
      due_date: '2026-11-20',
      assigned_to: 'shooter',
      title: 'Brand Film',
    });
    expect(tasks[0].follows_task_id).toBeUndefined();
    expect(tasks[0]).toMatchObject({ start_time: null, end_time: null });
    expect(tasks[1]).toMatchObject({
      current_stage_id: 'post',
      assigned_to: 'ali',
      start_date: '2026-11-21',
      due_date: '2026-11-25',
      title: 'Brand Film — Edit (Ali)',
      follows_task_id: 'task-1',
    });
    expect(tasks[2]).toMatchObject({ assigned_to: 'sara', title: 'Brand Film — Edit (Sara)', follows_task_id: 'task-1' });

    const deliverables = ops.filter((o) => o.table === 'task_deliverables').map((o) => o.payload);
    expect(deliverables).toEqual([
      [
        { task_id: 'task-2', title: 'Video 1', position: 0, current_stage_id: 'post' },
        { task_id: 'task-2', title: 'Video 2', position: 1, current_stage_id: 'post' },
      ],
      [{ task_id: 'task-3', title: 'Video 3', position: 0, current_stage_id: 'post' }],
    ]);

    const creativeTasks = ops
      .filter((o) => o.table === 'task_creatives')
      .flatMap((o) => o.payload.map((r: any) => r.task_id));
    expect(creativeTasks.sort()).toEqual(['task-1', 'task-2', 'task-3']);
  });

  it('writes the shoot time slot on the shoot task only', async () => {
    const { db, ops } = recorder();
    await createShootWithEdits(db, input({ shootStart: '09:00', shootEnd: '12:00' }));
    const tasks = ops.filter((o) => o.table === 'tasks').map((o) => o.payload);
    expect(tasks[0]).toMatchObject({ start_time: '09:00', end_time: '12:00' });
    expect(tasks[1].start_time).toBeUndefined();
  });

  it('still creates everything when someone is busy — clashes only warn', async () => {
    const { db } = recorder({ conflicts: { ali: [busy('x', 'Other edit', '2026-11-22')] } });
    await expect(createShootWithEdits(db, input())).resolves.toEqual({ shootId: 'task-1', editIds: ['task-2', 'task-3'] });
  });

  it('rejects an invalid booking before touching the database', async () => {
    const { db, ops } = recorder();
    await expect(createShootWithEdits(db, input({ shootDate: '' }))).rejects.toThrow('Pick a shoot date');
    expect(ops).toEqual([]);
  });

  it('deletes everything it created when a later insert fails', async () => {
    const { db, ops } = recorder({ failTaskInsertAt: 3 });
    await expect(createShootWithEdits(db, input())).rejects.toThrow('insert failed');
    expect(ops.at(-1)).toEqual({ table: 'tasks', op: 'delete', ids: ['task-1', 'task-2'] });
  });
});
