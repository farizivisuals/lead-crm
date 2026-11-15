import { checkForAppUpdate, type UpdatesApi } from '../app-updates';

function api(over: Partial<UpdatesApi> = {}) {
  const calls: string[] = [];
  const u: UpdatesApi = {
    isEnabled: true,
    checkForUpdateAsync: async () => (calls.push('check'), { isAvailable: true }),
    fetchUpdateAsync: async () => (calls.push('fetch'), { isNew: true }),
    reloadAsync: async () => void calls.push('reload'),
    ...over,
  };
  return { u, calls };
}

describe('checkForAppUpdate', () => {
  it('downloads a new update and offers a restart', async () => {
    const { u, calls } = api();
    const offer = jest.fn();
    await checkForAppUpdate(u, offer);
    expect(calls).toEqual(['check', 'fetch']);
    expect(offer).toHaveBeenCalledTimes(1);
    await offer.mock.calls[0][0]();
    expect(calls).toContain('reload');
  });

  it('does nothing when there is no update', async () => {
    const { u, calls } = api({ checkForUpdateAsync: async () => ({ isAvailable: false }) });
    const offer = jest.fn();
    await checkForAppUpdate(u, offer);
    expect(calls).not.toContain('fetch');
    expect(offer).not.toHaveBeenCalled();
  });

  it('does nothing in development builds', async () => {
    const { u, calls } = api({ isEnabled: false });
    await checkForAppUpdate(u, jest.fn());
    expect(calls).toEqual([]);
  });

  it('never throws when offline', async () => {
    const { u } = api({ checkForUpdateAsync: async () => { throw new Error('offline'); } });
    await expect(checkForAppUpdate(u, jest.fn())).resolves.toBeUndefined();
  });
});
