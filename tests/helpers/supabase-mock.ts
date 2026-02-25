import { vi } from 'vitest';

/**
 * Chainable Supabase mock builder.
 * Mimics the `supabase.from('table').select().eq().single()` pattern.
 */
export function createSupabaseMock(overrides: {
  data?: any;
  error?: any;
} = {}) {
  const result = { data: overrides.data ?? null, error: overrides.error ?? null };

  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: vi.fn((resolve: any) => resolve(result)),
  };

  // Make chain thenable (for awaiting without .single())
  chain[Symbol.for('nodejs.util.inspect.custom')] = () => 'SupabaseMockChain';

  // Override .then to make it awaitable
  const thenableChain = new Proxy(chain, {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve: any, reject: any) => {
          try {
            resolve(result);
          } catch (e) {
            reject(e);
          }
        };
      }
      return target[prop];
    },
  });

  return thenableChain;
}

/**
 * Creates a mock supabase client with a `.from()` that returns chainable queries.
 * Use `setMockResult()` to configure what a specific table returns.
 */
export function createSupabaseClientMock() {
  const tableResults = new Map<string, { data: any; error: any }>();

  function setMockResult(table: string, data: any, error: any = null) {
    tableResults.set(table, { data, error });
  }

  const from = vi.fn((table: string) => {
    const result = tableResults.get(table) || { data: null, error: null };
    return createSupabaseMock(result);
  });

  return {
    from,
    setMockResult,
  };
}
