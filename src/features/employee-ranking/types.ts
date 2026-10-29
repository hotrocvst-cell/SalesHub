import type { TopBotConfig } from '../employee-performance/utils/performanceConfig';
import type { CampaignScoringMode } from '../../core/lib/storeCampaignScoreService';

export interface EmployeeRankingRow {
    employee_id: string;
    full_name: string;
    short_name: string;
    store_name: string;
    job_title: string;

    // Doanh thu
    revenue_actual: number;      // DT Thực (triệu đồng)
    revenue_qd: number;          // DTQĐ (triệu đồng)
    revenue_target: number;      // Target DTQĐ (triệu đồng)
    completion_rate: number;     // %HT thực tế
    forecast_completion_rate: number; // %DKHT
    revenue_rank: number;        // Thứ hạng DT (#1, #2...)
    revenue_top_bot_status: 'TOP' | 'BOT' | 'MID';
    revenue_top_bot_label: string;

    // Thi đua
    scoring_mode: CampaignScoringMode; // 'POINTS' | 'COUNT'
    points_achieved: number;
    points_total: number;
    campaigns_achieved: number;
    campaigns_total: number;
    emulation_rate: number;      // % Hoàn thành thi đua (theo điểm hoặc theo số nhóm)
    emulation_display: string;   // Chuỗi hiển thị: "8.5 / 10.0 đ" hoặc "4 / 5 nhóm"
    emulation_rank: number;      // Thứ hạng Thi đua (#1, #2...)
    emulation_top_bot_status: 'TOP' | 'BOT' | 'MID';
    emulation_top_bot_label: string;

    // Đánh giá sức khỏe & Xét cứu BOT
    rescue_status?: 'SAFE' | 'RESCUED' | 'BOT_WARNING';
    rescue_label?: string;
    rescue_detail?: string;
    rescue_reason?: string;
    badge_variant?: 'safe' | 'rescued_rev' | 'rescued_emu' | 'thai_san' | 'warning';
}

export interface EmployeeRankingSummary {
    totalEmployees: number;
    totalRevenueQd: number;
    totalRevenueActual: number;
    totalRevenueTarget: number;
    avgForecastRate: number;
    avgEmulationRate: number;
    topRevenueCount: number;
    botRevenueCount: number;
    topEmulationCount: number;
    botEmulationCount: number;
    scoringModeLabel: string;

    // Chỉ số sức khỏe & xét cứu
    safeCount?: number;
    rescuedCount?: number;
    botWarningCount?: number;
}
