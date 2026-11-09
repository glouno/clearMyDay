import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarConfig, CalendarTokenRow } from './calendar-storage';
import { NextRequest } from 'next/server';

// A synthetic durable backend outlives module reloads; no Supabase client is loaded.
function backendFixture() {
  const rows = new Map<string, CalendarTokenRow>();
  let failure: 'error' | 'throw' | null = null;
  const upsert = vi.fn(async (row: Partial<CalendarTokenRow> & { token: string }) => {
    if (failure === 'throw') throw new Error('synthetic transport failure');
    if (failure === 'error') return { error: { message: 'synthetic write rejected' } };
    rows.set(row.token, {
      created_at: '2026-09-01T00:00:00.000Z', access_count: 0,
      ...rows.get(row.token), ...structuredClone(row)
    } as CalendarTokenRow);
    return { error: null };
  });
  const client = {
    from: vi.fn((table: string) => {
      expect(table).toBe('calendar_tokens');
      return {
        upsert,
        select: () => ({
          eq: (column: keyof CalendarTokenRow, value: string) => ({
            single: async () => {
              const data = [...rows.values()].find(row => row[column] === value);
              return { data: data ? structuredClone(data) : null, error: null };
            }
          })
        }),
        update: (patch: Partial<CalendarTokenRow>) => ({
          eq: async (_column: string, token: string) => {
            const row = rows.get(token);
            if (row) rows.set(token, { ...row, ...patch });
            return { error: null };
          }
        })
      };
    })
  };
  return { rows, client, upsert, fail: (value: typeof failure) => { failure = value; } };
}

function config(): CalendarConfig {
  return {
    name: 'Synthetic calendar',
    filter: {
      masters: ['DAC', 'IMA'], courses: ['MLBDA', 'DALAS'],
      courseGroups: { MLBDA: '1', DALAS: '2' },
      dateRangePolicy: 'academic-year', academicYearStart: 2026,
      dateRange: { start: '2026-09-01', end: '2027-09-01' }
    },
    createdAt: new Date('2026-09-01T00:00:00Z')
  };
}

async function loadStorage(backend: ReturnType<typeof backendFixture> | null) {
  vi.resetModules();
  vi.doMock('./supabase', () => ({ supabase: backend?.client ?? null }));
  return import('./calendar-storage');
}

async function loadGeneration(backend: ReturnType<typeof backendFixture> | null) {
  const storage = await loadStorage(backend);
  vi.doMock('@/lib/calendar-storage', () => storage);
  vi.doMock('@/lib/date-range-policy', () => import('./date-range-policy'));
  vi.doMock('@/lib/request-validation', () => import('./request-validation'));
  vi.doMock('uuid', () => ({ v4: () => 'synthetic-generated-token' }));
  return { storage, ...await import('../app/api/generate-calendar/route') };
}

function request(body = config()) {
  return new NextRequest('https://calendar.example.test/api/generate-calendar', {
    method: 'POST', headers: { host: 'calendar.example.test', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in synthetic tests'); }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('calendar persistence boundary', () => {
  it('reports durable only after a confirmed write, readable in an isolated module', async () => {
    const backend = backendFixture();
    const first = await loadStorage(backend);
    expect(await first.CalendarStorage.set('synthetic-token', config())).toBe('durable');
    const fresh = await loadStorage(backend);
    expect(fresh.calendarConfigs).not.toBe(first.calendarConfigs);
    expect(fresh.calendarConfigs.size).toBe(0);
    expect(await fresh.CalendarStorage.get('synthetic-token')).toEqual(config());
  });

  it('fails without installing a production memory token when storage is absent', async () => {
    const { CalendarStorage, calendarConfigs } = await loadStorage(null);
    expect(await CalendarStorage.set('synthetic-token', config())).toBe('failed');
    expect(calendarConfigs.size).toBe(0);
    expect(await CalendarStorage.get('synthetic-token')).toBeNull();
  });

  it.each(['error', 'throw'] as const)('fails on a configured production %s without a memory token', async failure => {
    const backend = backendFixture();
    backend.fail(failure);
    const { CalendarStorage, calendarConfigs } = await loadStorage(backend);
    expect(await CalendarStorage.set('synthetic-token', config())).toBe('failed');
    expect(calendarConfigs.size).toBe(0);
    expect(await CalendarStorage.get('synthetic-token')).toBeNull();
  });

  it.each(['absent', 'error', 'throw'] as const)('labels development fallback memory-only for %s storage', async failure => {
    vi.stubEnv('NODE_ENV', 'development');
    const backend = failure === 'absent' ? null : backendFixture();
    if (backend && failure !== 'absent') backend.fail(failure);
    const first = await loadStorage(backend);
    expect(await first.CalendarStorage.set('synthetic-token', config())).toBe('memory-only');
    expect(await first.CalendarStorage.get('synthetic-token')).toEqual(config());
    const fresh = await loadStorage(backend);
    expect(await fresh.CalendarStorage.get('synthetic-token')).toBeNull();
  });

  it('leaves the old persistent config readable after a failed existing-token update', async () => {
    const backend = backendFixture();
    const { CalendarStorage, calendarConfigs } = await loadStorage(backend);
    const old = config();
    await CalendarStorage.set('synthetic-existing-token', old);
    backend.fail('error');
    const changed = config();
    changed.filter.courseGroups!.MLBDA = '3';
    expect(await CalendarStorage.set('synthetic-existing-token', changed)).toBe('failed');
    expect(calendarConfigs.size).toBe(0);
    expect(await CalendarStorage.get('synthetic-existing-token')).toEqual(old);
    const fresh = await loadStorage(backend);
    expect(await fresh.CalendarStorage.get('synthetic-existing-token')).toEqual(old);
  });

  it('retires a temporary config after a successful durable retry', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const backend = backendFixture();
    const { CalendarStorage, calendarConfigs } = await loadStorage(backend);
    backend.fail('error');
    await CalendarStorage.set('synthetic-token', config());
    backend.fail(null);
    expect(await CalendarStorage.set('synthetic-token', config())).toBe('durable');
    expect(calendarConfigs.has('synthetic-token')).toBe(false);
  });

  it('preserves normalized name/order and stable policy/year identity across isolated modules', async () => {
    const backend = backendFixture();
    const first = await loadStorage(backend);
    await first.CalendarStorage.set('synthetic-existing-token', config());
    const { CalendarStorage } = await loadStorage(backend);
    const reordered = config();
    reordered.name = '  Synthetic calendar  ';
    reordered.filter.masters.reverse();
    reordered.filter.courses.reverse();
    reordered.filter.courseGroups = { DALAS: '2', MLBDA: '1' };
    reordered.filter.dateRange = { start: '2026-10-01', end: '2027-07-01' };
    expect(await CalendarStorage.findExisting(reordered)).toBe('synthetic-existing-token');
    reordered.filter.dateRangePolicy = 'semester-1';
    expect(await CalendarStorage.findExisting(reordered)).toBeNull();
    reordered.filter.dateRangePolicy = 'academic-year';
    reordered.filter.academicYearStart = 2027;
    expect(await CalendarStorage.findExisting(reordered)).toBeNull();
  });
});

describe('subscription acknowledgement', () => {
  it.each(['absent', 'error', 'throw'] as const)('returns a retryable production failure for %s storage', async failure => {
    const backend = failure === 'absent' ? null : backendFixture();
    if (backend && failure !== 'absent') backend.fail(failure);
    const { POST } = await loadGeneration(backend);
    const response = await POST(request());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, persistence: 'failed', retryable: true });
    expect(body.data).toBeUndefined();
  });

  it('does not acknowledge a failed refresh of a reused durable token', async () => {
    const backend = backendFixture();
    const { storage, POST } = await loadGeneration(backend);
    await storage.CalendarStorage.set('synthetic-existing-token', config());
    backend.fail('error');
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ success: false, persistence: 'failed' });
    expect(await storage.CalendarStorage.get('synthetic-existing-token')).toEqual(config());
    expect(backend.rows.size).toBe(1);
  });

  it('can retry the same selections after a rejected write', async () => {
    const backend = backendFixture();
    backend.fail('error');
    const { POST } = await loadGeneration(backend);
    expect((await POST(request())).status).toBe(503);
    expect(backend.rows.size).toBe(0);
    backend.fail(null);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, persistence: 'durable' });
    const fresh = await loadStorage(backend);
    expect(await fresh.CalendarStorage.get('synthetic-generated-token')).not.toBeNull();
  });

  it('acknowledges a durable save and reuses its token after module reload and normalized replay', async () => {
    const backend = backendFixture();
    const first = await loadGeneration(backend);
    const response = await first.POST(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, persistence: 'durable' });
    const fresh = await loadGeneration(backend);
    expect(fresh.storage.calendarConfigs.size).toBe(0);
    expect(await fresh.storage.CalendarStorage.get(body.data.token)).not.toBeNull();
    const reordered = config();
    reordered.filter.masters.reverse();
    reordered.filter.courses.reverse();
    const replay = await fresh.POST(request(reordered));
    expect((await replay.json()).data.token).toBe(body.data.token);
    expect(backend.rows.size).toBe(1);
  });

  it('explicitly warns that the development URL is temporary', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { POST } = await loadGeneration(null);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true, persistence: 'memory-only', warning: expect.stringMatching(/temporary/i),
      data: { token: 'synthetic-generated-token' }
    });
  });

  it('keeps preview isolated from subscription storage and token creation', async () => {
    const backend = backendFixture();
    await loadGeneration(backend);
    const events = [{ uid: 'synthetic-event' }];
    vi.doMock('@/lib/caldav-client', () => ({
      caldavClient: { fetchAllCalendars: vi.fn(async () => ({ DAC: { success: true, events } })) }
    }));
    vi.doMock('@/lib/calendar-parser', () => ({
      CalendarParser: class { filterEvents() { return events; } }
    }));
    vi.doMock('@/lib/ics-generator', () => ({
      ICSGenerator: class { generateICS() { return 'synthetic ICS preview'; } }
    }));
    const { POST } = await import('../app/api/preview-calendar/route');
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, preview: true });
    expect(backend.client.from).not.toHaveBeenCalled();
    expect(backend.upsert).not.toHaveBeenCalled();
    expect(backend.rows.size).toBe(0);
  });
});
