import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nfrsxyutpuyfprzyvvol.supabase.co';
const supabaseKey = 'sb_publishable_XTdZhum4xrC_ARCn5-Xoyw_1K1ZUET4';

export const supabase = createClient(supabaseUrl, supabaseKey);
