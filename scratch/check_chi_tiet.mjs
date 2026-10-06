import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dpisuoimijyjfookxkrm.supabase.co';
const supabaseAnonKey = 'sb_publishable_6YVwZDQ-mfL_EgUx-34lng_TE8MM3XY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    const { data } = await supabase.from('system_page_permissions').select('*').eq('page_key', 'chi_tiet_nv');
    console.log('chi_tiet_nv in Supabase:', data);
}
check();
