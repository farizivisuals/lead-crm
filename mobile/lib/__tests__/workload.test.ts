import { computeWorkload, loadLevel, workingDays, type WorkloadInput } from '@shared/workload';

describe('workingDays', () => {
  it('lists the Sunday–Thursday dates of a month', () => {
    const nov = workingDays(2026, 10); // November 2026: 1st is a Sunday
    expect(nov[0]).toBe('2026-11-01');
    expect(nov).not.toContain('2026-11-06'); // Friday
    expect(nov).not.toContain('2026-11-07'); // Saturday
    expect(nov).toHaveLength(22); // 5 full weeks + Sun 29, Mon 30
    expect(nov[nov.length - 1]).toBe('2026-11-30');
  });
});

const base: WorkloadInput = {
  employees: [
    { id: 'dawood', name: 'Dawood', role: 'employee' },
    { id: 'quintin', name: 'Quintin', role: 'employee' },
    { id: 'ceo', name: 'Boss', role: 'ceo' },
  ],
  tasks: [],
  creatives: [],
  phases: [],
};
const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'];
const today = '2026-11-03';
const row = (rows: ReturnType<typeof computeWorkload>, id: string) => rows.find((r) => r.id === id)!;

describe('computeWorkload', () => {
  it('books every day a task spans, finished or not', () => {
    const rows = computeWorkload(
      {
        ...base,
        tasks: [
          { id: 't1', assigned_to: 'dawood', start_date: '2026-11-01', due_date: '2026-11-02', client_id: 'a', open: false },
          { id: 't2', assigned_to: 'dawood', start_date: null, due_date: '2026-11-04', client_id: 'b', open: true },
        ],
      },
      days,
      today
    );
    expect(row(rows, 'dawood').booked).toEqual([true, true, false, true]);
    expect(row(rows, 'dawood').bookedCount).toBe(3);
  });

  it('books the day a video phase is scheduled', () => {
    const rows = computeWorkload(
      { ...base, phases: [{ assigned_to: 'quintin', scheduled_date: '2026-11-03', client_id: 'a', current: false, open: true }] },
      days,
      today
    );
    expect(row(rows, 'quintin').booked).toEqual([false, false, true, false]);
  });

  it('counts open tasks, creative roles, videos waiting, clients and overdue', () => {
    const rows = computeWorkload(
      {
        ...base,
        tasks: [
          { id: 't1', assigned_to: 'dawood', start_date: '2026-10-01', due_date: '2026-10-02', client_id: 'a', open: true },
          { id: 't2', assigned_to: 'dawood', start_date: null, due_date: '2026-11-09', client_id: 'b', open: true },
          { id: 't3', assigned_to: 'dawood', start_date: null, due_date: '2026-10-01', client_id: 'z', open: false },
          { id: 't4', assigned_to: 'quintin', start_date: null, due_date: null, client_id: 'c', open: true },
        ],
        creatives: [{ task_id: 't4', profile_id: 'dawood' }],
        phases: [
          { assigned_to: 'dawood', scheduled_date: null, client_id: 'a', current: true, open: true },
          { assigned_to: 'dawood', scheduled_date: null, client_id: 'd', current: false, open: true },
        ],
      },
      days,
      today
    );
    const d = row(rows, 'dawood');
    expect(d.tasks).toBe(2); // t3 is finished
    expect(d.creativeTasks).toBe(1);
    expect(d.videos).toBe(1); // only the phase it's currently in
    expect(d.clients).toBe(3); // a, b (tasks), c (creative); z is finished, d isn't current
    expect(d.overdue).toBe(1); // t1
  });

  it('lists employees always, executives only with work, busiest first', () => {
    const rows = computeWorkload(
      { ...base, tasks: [{ id: 't', assigned_to: 'quintin', start_date: '2026-11-02', due_date: null, client_id: 'a', open: true }] },
      days,
      today
    );
    expect(rows.map((r) => r.id)).toEqual(['quintin', 'dawood']);
  });
});

describe('loadLevel', () => {
  it('is low under half, mid up to 79%, high from 80%', () => {
    expect(loadLevel(10, 21)).toBe('low');
    expect(loadLevel(11, 21)).toBe('mid');
    expect(loadLevel(17, 21)).toBe('high');
    expect(loadLevel(0, 0)).toBe('low');
  });
});
