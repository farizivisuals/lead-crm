import { markDoneAction } from '@shared/task-steps';

const VIDEO = [
  { id: 'pre', name: 'Pre-production', position: 1, is_terminal: false },
  { id: 'shoot', name: 'Shoot', position: 2, is_terminal: false },
  { id: 'post', name: 'Post-production', position: 3, is_terminal: false },
  { id: 'done', name: 'Delivered', position: 4, is_terminal: true },
];
const GRAPHICS = [
  { id: 'a', name: 'Assigned', position: 1, is_terminal: false },
  { id: 'c', name: 'Consultation', position: 2, is_terminal: false },
  { id: 's', name: 'Submission', position: 3, is_terminal: true },
];

describe('markDoneAction', () => {
  it('names the step and where it goes', () => {
    expect(markDoneAction(VIDEO, 'shoot')).toEqual({ label: 'Shoot done → Post-production', nextName: 'Post-production' });
  });
  it('says Mark done on the last step', () => {
    expect(markDoneAction(VIDEO, 'post')).toEqual({ label: 'Mark done', nextName: 'Delivered' });
  });
  it('starts the next stage from Assigned', () => {
    expect(markDoneAction(GRAPHICS, 'a')!.label).toBe('Start Consultation');
  });
  it('offers nothing once done or for an unknown stage', () => {
    expect(markDoneAction(VIDEO, 'done')).toBeNull();
    expect(markDoneAction(VIDEO, 'nope')).toBeNull();
  });
  it('ignores the order stages arrive in', () => {
    expect(markDoneAction([...VIDEO].reverse(), 'pre')!.nextName).toBe('Shoot');
  });
});
