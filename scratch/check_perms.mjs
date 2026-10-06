import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dpisuoimijyjfookxkrm.supabase.co';
const supabaseAnonKey = 'sb_publishable_6YVwZDQ-mfL_EgUx-34lng_TE8MM3XY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    const { data, error } = await supabase.from('system_page_permissions').select('*');
    if (error) {
        console.log('Error:', error.message);
    } else {
        console.log('Rows count:', data?.length);
        console.log('Pages:', data?.map(d => ({ page_key: d.page_key, path: d.path, allowed_roles: d.allowed_roles, is_enabled: d.is_enabled })));
    }
}
check();
