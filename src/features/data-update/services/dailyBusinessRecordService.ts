import { supabase } from '../../../core/lib/supabase';
import type { CampaignDictItem } from '../../../core/lib/storage';
import { getCampaignLabel, cleanBiNumber } from '../../../core/lib/formatters';
import type { StoreMobileEmulationCardItem } from '../types/ocrTypes';

/**
 * Lưu chỉ tiêu thi đua từ Thẻ Mobile cho 1 siêu thị vào bảng daily_business_records trên Supabase Cloud
 * BẢO LƯU TOÀN VẸN số liệu Doanh thu (DTQĐ, DT Thực, Trả góp, Forecast) đã có của siêu thị trong ngày chốt này.
 */
export async function saveSingleStoreEmulationDailyRecord(
    storeName: string,
    reportDate: string,
    passedDays: number,
    totalDays: number,
    cards: StoreMobileEmulationCardItem[],
    campaignDict: CampaignDictItem[] = []
): Promise<{ success: boolean; error?: string }> {
    if (!storeName || !reportDate) {
        return { success: false, error: 'Thiếu thông tin siêu thị hoặc ngày chốt phiên.' };
    }

    try {
        const cleanStore = storeName.trim();
        const cleanDate = reportDate.trim();
        const [yStr, mStr] = cleanDate.split('-');
        const month = parseInt(mStr, 10) || (new Date().getMonth() + 1);
        const year = parseInt(yStr, 10) || new Date().getFullYear();

        // 1. Tìm bản ghi hiện có của siêu thị này trong ngày chốt để bảo lưu doanh thu
        const { data: existing, error: fetchErr } = await supabase
            .from('daily_business_records')
            .select('*')
            .eq('store_name', cleanStore)
            .eq('report_date', cleanDate)
            .maybeSingle();

        if (fetchErr) {
            console.warn('Lỗi kiểm tra bản ghi cũ daily_business_records:', fetchErr);
        }

        // 2. Chuyển đổi cards thành emulation_summary
        const emulationSummary: Record<string, any> = {
            ...(existing?.emulation_summary || {})
        };

        cards.forEach(c => {
            const rawName = c.programName.trim();
            const label = getCampaignLabel(rawName, campaignDict);
            const act = cleanBiNumber(c.actual);
            const tg = cleanBiNumber(c.target);
            const pctHT = c.completionRate !== undefined && c.completionRate !== null
                ? cleanBiNumber(c.completionRate)
                : (tg > 0 ? Number(((act / tg) * 100).toFixed(1)) : 0);
            const pctDK = (tg > 0 && passedDays > 0)
                ? Number((((act / passedDays * totalDays) / tg) * 100).toFixed(1))
                : (c.forecastRate || 0);

            emulationSummary[label] = {
                target: tg,
                actual: act,
                pctDK,
                pctHT,
                unit: c.unit,
                rawHeader: rawName
            };
        });

        // 3. Chuẩn bị payload upsert
        const safeForecastRate = Math.min(9999.99, Math.max(0, Number(existing?.forecast_completion_rate) || 0));
        const safeInstallmentRate = Math.min(999.99, Math.max(0, Number(existing?.installment_rate) || 0));

        const payload = {
            store_name: cleanStore,
            report_date: cleanDate,
            month,
            year,
            passed_days: passedDays,
            total_days: totalDays,
            revenue_actual: Number(existing?.revenue_actual) || 0,
            revenue_target: Number(existing?.revenue_target) || 0,
            revenue_installment: Number(existing?.revenue_installment) || 0,
            installment_rate: safeInstallmentRate,
            forecast_completion_rate: safeForecastRate,
            emulation_summary: emulationSummary,
            raw_emulation: JSON.stringify(emulationSummary),
            raw_revenue: existing?.raw_revenue || '',
            raw_real_revenue: existing?.raw_real_revenue || '',
            data_type: existing?.data_type || 'Lũy kế tháng',
            updated_at: new Date().toISOString()
        };

        const { error: upsertErr } = await supabase
            .from('daily_business_records')
            .upsert([payload], { onConflict: 'store_name,report_date' });

        if (upsertErr) {
            return { success: false, error: upsertErr.message };
        }

        return { success: true };
    } catch (err: any) {
        console.error('Lỗi khi lưu thi đua vào daily_business_records:', err);
        return { success: false, error: err?.message || 'Lỗi khi lưu Supabase Cloud' };
    }
}

