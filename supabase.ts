import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vpaizbtetwsnvbpmeuab.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dAHRrHfSQvNwm1LEpNw5Ww_EOTyejXT';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);