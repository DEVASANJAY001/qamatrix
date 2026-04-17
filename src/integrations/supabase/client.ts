// This client is now deprecated as the application has migrated to MongoDB.
// All database operations are now handled via the /api Express backend.

export const supabase = {
  from: () => ({
    select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
    insert: () => Promise.resolve({ data: [], error: null }),
    update: () => Promise.resolve({ data: [], error: null }),
    upsert: () => Promise.resolve({ data: [], error: null }),
    delete: () => ({ eq: () => Promise.resolve({ data: [], error: null }), neq: () => Promise.resolve({ data: [], error: null }) }),
  }),
  functions: {
    invoke: () => Promise.resolve({ data: null, error: new Error("Supabase Functions are deprecated. Use Express /api instead.") }),
  },
  channel: () => ({
    on: () => ({ subscribe: () => ({ unsubscribe: () => { } }) }),
  }),
  removeChannel: () => { },
};

export default supabase;