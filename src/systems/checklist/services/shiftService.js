import supabase from '../SupabaseClient';

// In-memory cache for shifts across the checklist system
let cachedShifts = null;
let inFlightPromise = null;

/**
 * Returns currently cached shifts synchronously (if any).
 * Useful for initializing React state without delay.
 */
export const getShiftsSync = () => {
  return cachedShifts || [];
};

/**
 * Fetches shifts from Supabase with in-memory caching and request deduplication.
 * If forceRefresh is false and cache exists, returns cached data immediately (0ms).
 */
export const getShifts = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && cachedShifts && Array.isArray(cachedShifts) && cachedShifts.length > 0) {
    return cachedShifts;
  }

  // Deduplicate concurrent calls into the same in-flight Promise
  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('shift_name', { ascending: true });

      if (error) {
        console.error('Error fetching shifts from Supabase:', error);
        return cachedShifts || [];
      }

      cachedShifts = data || [];
      return cachedShifts;
    } catch (err) {
      console.error('Unexpected error fetching shifts:', err);
      return cachedShifts || [];
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
};

/**
 * Invalidate the in-memory cache
 */
export const invalidateShiftsCache = () => {
  cachedShifts = null;
};

/**
 * Saves a shift directly to Supabase and updates the cache.
 */
export const saveShiftApi = async ({ id, shift_name, start_time, end_time }) => {
  const trimmedName = (shift_name || '').trim();
  if (id) {
    const { data, error } = await supabase
      .from('shifts')
      .update({
        shift_name: trimmedName,
        start_time,
        end_time,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    // Refresh cache in background
    await getShifts({ forceRefresh: true });
    return data;
  } else {
    const { data, error } = await supabase
      .from('shifts')
      .insert([{
        shift_name: trimmedName,
        start_time,
        end_time
      }])
      .select();

    if (error) throw error;
    // Refresh cache in background
    await getShifts({ forceRefresh: true });
    return data;
  }
};

/**
 * Deletes a shift directly from Supabase and updates the cache.
 */
export const deleteShiftApi = async (id) => {
  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('id', id);

  if (error) throw error;
  await getShifts({ forceRefresh: true });
};

