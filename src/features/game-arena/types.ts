export interface GameItem {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    duration: string; // ví dụ: '3-5 phút', '60 giây'
    difficulty: 'Dễ' | 'Trung bình' | 'Thách thức';
    iconName: string;
    colorTheme: 'blue' | 'amber' | 'emerald' | 'purple' | 'rose';
    tag?: string;
    isReady: boolean;
}

export interface GameScoreRecord {
    id?: string;
    game_id: string;
    employee_id: string;
    employee_name: string;
    store_name: string;
    score: number;
    duration_seconds?: number;
    metadata?: Record<string, any>;
    played_at: string;
    created_at?: string;
}

export type LeaderboardTimeRange = 'today' | 'week' | 'month' | 'all';

export interface LeaderboardFilter {
    game_id: string;
    store_name: string;
    time_range: LeaderboardTimeRange;
}

export interface UserGameStat {
    game_id: string;
    high_score: number;
    plays_count: number;
    last_played?: string;
}

