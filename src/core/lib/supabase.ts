import { createClient } from '@supabase/supabase-js';

// Đọc từ biến môi trường (ưu tiên) hoặc fallback sang cấu hình public mặc định của dự án
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dpisuoimijyjfookxkrm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6YVwZDQ-mfL_EgUx-34lng_TE8MM3XY';

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Thiếu cấu hình VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong file .env hoặc Cloudflare Environment Variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);