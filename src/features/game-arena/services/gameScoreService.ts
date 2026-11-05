import { supabase } from '../../../core/lib/supabase';
import { getStartOfWeek } from '../../../core/lib/formatters';
import type { GameScoreRecord, LeaderboardFilter, UserGameStat } from '../types';

const LOCAL_STORAGE_SCORES_KEY = 'saleshub_game_scores_v1';

export const GAME_SCORES_SQL_DDL = `-- TẠO BẢNG LƯU TRỮ ĐIỂM SỐ GAME ĐẤU TRƯỜNG GIẢI TRÍ
CREATE TABLE IF NOT EXISTS public.game_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    store_name TEXT NOT NULL,
    score NUMERIC NOT NULL DEFAULT 0,
    duration_seconds INT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    played_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TẠO CHỈ MỤC INDEX TỐI ƯU CHO BẢNG XẾP HẠNG
CREATE INDEX IF NOT EXISTS idx_game_scores_lookup 
ON public.game_scores (game_id, score DESC, played_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_scores_store 
ON public.game_scores (store_name, game_id, score DESC);

-- KÍCH HOẠT BẢO MẬT RLS
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- CHÍNH SÁCH TRUY CẬP: CHO PHÉP XEM TOÀN BỘ BẢNG ĐIỂM
CREATE POLICY "Allow public read game_scores" 
ON public.game_scores FOR SELECT 
USING (true);

-- CHÍNH SÁCH GHI: CHO PHÉP TẤT CẢ TÀI KHOẢN ĐÃ ĐĂNG NHẬP GỬI ĐIỂM SỐ
CREATE POLICY "Allow insert game_scores" 
ON public.game_scores FOR INSERT 
WITH CHECK (true);
`;

// Helper: Đọc cache local
function getLocalScores(): GameScoreRecord[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_SCORES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

// Helper: Lưu cache local
function saveLocalScore(record: GameScoreRecord): void {
    try {
        const list = getLocalScores();
        list.unshift(record);
        // Giữ tối đa 500 bản ghi mới nhất ở client
        localStorage.setItem(LOCAL_STORAGE_SCORES_KEY, JSON.stringify(list.slice(0, 500)));
    } catch {
        // bỏ qua lỗi storage
    }
}

/**
 * Kiểm tra tính sẵn sàng của bảng game_scores trên Supabase Cloud
 */
export async function checkSupabaseGameScoresTable(): Promise<{ exists: boolean; count: number; error?: string }> {
    try {
        const { count, error } = await supabase
            .from('game_scores')
            .select('*', { count: 'exact', head: true });

        if (error) {
            if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
                return { exists: false, count: 0, error: 'Bảng game_scores chưa được khởi tạo trên Supabase.' };
            }
            return { exists: false, count: 0, error: error.message };
        }

        return { exists: true, count: count ?? 0 };
    } catch (err: any) {
        return { exists: false, count: 0, error: err.message || 'Lỗi kết nối Cloud' };
    }
}

/**
 * Gửi và lưu điểm số ván đấu lên Supabase Cloud (đồng thời cập nhật Local cache)
 */
export async function submitGameScore(scoreData: Omit<GameScoreRecord, 'id' | 'created_at'>): Promise<{ success: boolean; id?: string; error?: string }> {
    const record: GameScoreRecord = {
        ...scoreData,
        played_at: scoreData.played_at || new Date().toISOString()
    };

    // Luôn lưu cache local trước để đảm bảo mượt mà
    saveLocalScore(record);

    try {
        const { data, error } = await supabase
            .from('game_scores')
            .insert([{
                game_id: record.game_id,
                employee_id: record.employee_id,
                employee_name: record.employee_name,
                store_name: record.store_name,
                score: record.score,
                duration_seconds: record.duration_seconds || 0,
                metadata: record.metadata || {},
                played_at: record.played_at
            }])
            .select('id')
            .single();

        if (error) {
            console.warn('[GameScore] Supabase insert warning:', error.message);
            return { success: true, error: error.message };
        }

        return { success: true, id: data?.id };
    } catch (err: any) {
        console.warn('[GameScore] Cloud sync error:', err.message);
        return { success: true, error: err.message };
    }
}

/**
 * Lấy bảng xếp hạng theo bộ lọc: Game, ST, Chu kỳ thời gian
 */
export async function fetchLeaderboardScores(filter: LeaderboardFilter): Promise<{ scores: GameScoreRecord[]; source: 'cloud' | 'local' }> {
    const { game_id, store_name, time_range } = filter;

    // Tính mốc thời gian bắt đầu
    let startIso: string | null = null;
    const now = new Date();

    if (time_range === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startIso = today.toISOString();
    } else if (time_range === 'week') {
        // Tuần tính từ Thứ Hai (Monday-first) theo Quy chuẩn 7
        const mondayStr = getStartOfWeek(now);
        startIso = new Date(mondayStr + 'T00:00:00').toISOString();
    } else if (time_range === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startIso = startOfMonth.toISOString();
    }

    try {
        let query = supabase
            .from('game_scores')
            .select('*')
            .order('score', { ascending: false })
            .order('played_at', { ascending: false })
            .limit(100);

        if (game_id && game_id !== 'all') {
            query = query.eq('game_id', game_id);
        }

        if (store_name && store_name !== 'ALL' && store_name !== 'Tất cả ST') {
            query = query.eq('store_name', store_name);
        }

        if (startIso) {
            query = query.gte('played_at', startIso);
        }

        const { data, error } = await query;

        if (!error && data) {
            return { scores: data as GameScoreRecord[], source: 'cloud' };
        }
    } catch {
        // Fallback sang local cache
    }

    // Fallback: Lọc từ local cache
    const local = getLocalScores();
    const filtered = local.filter(item => {
        if (game_id && game_id !== 'all' && item.game_id !== game_id) return false;
        if (store_name && store_name !== 'ALL' && store_name !== 'Tất cả ST' && item.store_name !== store_name) return false;
        if (startIso && item.played_at && item.played_at < startIso) return false;
        return true;
    }).sort((a, b) => b.score - a.score);

    return { scores: filtered.slice(0, 100), source: 'local' };
}

/**
 * Lấy kỷ lục cao nhất của một nhân viên theo từng game
 */
export async function fetchUserGameStats(employeeId: string): Promise<Record<string, UserGameStat>> {
    const stats: Record<string, UserGameStat> = {};
    if (!employeeId) return stats;

    try {
        const { data, error } = await supabase
            .from('game_scores')
            .select('*')
            .eq('employee_id', employeeId);

        if (!error && data) {
            data.forEach((r: any) => {
                if (!stats[r.game_id]) {
                    stats[r.game_id] = { game_id: r.game_id, high_score: r.score, plays_count: 1, last_played: r.played_at };
                } else {
                    stats[r.game_id].plays_count += 1;
                    if (r.score > stats[r.game_id].high_score) {
                        stats[r.game_id].high_score = r.score;
                    }
                }
            });
            return stats;
        }
    } catch {
        // Fallback local
    }

    const local = getLocalScores().filter(item => item.employee_id === employeeId);
    local.forEach(r => {
        if (!stats[r.game_id]) {
            stats[r.game_id] = { game_id: r.game_id, high_score: r.score, plays_count: 1, last_played: r.played_at };
        } else {
            stats[r.game_id].plays_count += 1;
            if (r.score > stats[r.game_id].high_score) {
                stats[r.game_id].high_score = r.score;
            }
        }
    });

    return stats;
}

