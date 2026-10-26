import { supabase } from '../../../lib/supabase';

const isConfigured = Boolean(supabase);

export { supabase, isConfigured };
export default supabase;
