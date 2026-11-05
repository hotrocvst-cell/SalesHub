import type {
    FocusStoreCampaignMetric,
    FocusEmployeeRow,
    SmartRemarkAnalysis
} from '../types';

/**
 * Sinh nhận xét và đánh giá thông minh: X / total NH
 */
export function generateFocusSmartRemarks(
    storeName: string,
    periodDisplay: string,
    watchlistName: string,
    storeMetrics: FocusStoreCampaignMetric[],
    employeeRows: FocusEmployeeRow[]
): SmartRemarkAnalysis {
    const totalEmployees = employeeRows.length;
    const totalNH = storeMetrics.length;

    if (totalEmployees === 0 || totalNH === 0) {
        return {
            totalEmployees: 0,
            topPerformers: [],
            moderatePerformers: [],
            needSupportPerformers: [],
            zeroPerformers: [],
            bestCampaigns: [],
            weakCampaigns: [],
            recommendedSummaryText: ''
        };
    }

    const topPerformers = employeeRows
        .filter(r => r.forecastAchievedCount === totalNH || (totalNH >= 4 && r.forecastAchievedCount >= totalNH - 1))
        .map(r => ({
            name: `${r.shortName} (${r.employeeId})`,
            achievedText: `${r.forecastAchievedCount}/${totalNH} NH`,
            rate: r.achievementRate
        }));

    const moderatePerformers = employeeRows
        .filter(r => r.forecastAchievedCount > 0 && r.forecastAchievedCount >= Math.ceil(totalNH / 2) && !topPerformers.some(t => t.name.includes(r.employeeId)))
        .map(r => ({
            name: `${r.shortName} (${r.employeeId})`,
            achievedText: `${r.forecastAchievedCount}/${totalNH} NH`,
            rate: r.achievementRate
        }));

    const needSupportPerformers = employeeRows
        .filter(r => r.forecastAchievedCount > 0 && r.forecastAchievedCount < Math.ceil(totalNH / 2))
        .map(r => ({
            name: `${r.shortName} (${r.employeeId})`,
            achievedText: `${r.forecastAchievedCount}/${totalNH} NH`,
            rate: r.achievementRate
        }));

    const zeroPerformers = employeeRows
        .filter(r => r.forecastAchievedCount === 0)
        .map(r => ({
            name: `${r.shortName} (${r.employeeId})`,
            achievedText: `0/${totalNH} NH`,
            rate: 0
        }));

    const bestCampaigns = [...storeMetrics]
        .filter(m => m.storeTarget > 0)
        .sort((a, b) => b.forecastRate - a.forecastRate)
        .slice(0, 3)
        .map(m => ({
            name: m.displayName,
            passRate: m.forecastRate,
            passedCount: m.achievedEmployees
        }));

    const weakCampaigns = [...storeMetrics]
        .filter(m => m.storeTarget > 0 && m.forecastRate < 100)
        .sort((a, b) => a.forecastRate - b.forecastRate)
        .map(m => ({
            name: m.displayName,
            storePctDK: m.forecastRate
        }));

    // Tạo văn bản tóm tắt gửi Messaging App chuẩn nhận diện
    const lines: string[] = [
        `🎯 BÁO CÁO THI ĐUA TRỌNG TÂM - ${storeName.toUpperCase()}`,
        `📅 Kỳ: ${periodDisplay} • Nhóm: ${watchlistName}`,
        `📊 Quy mô: ${totalNH} Nhóm hàng trọng điểm | ${totalEmployees} Nhân sự`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `📌 KẾT QUẢ ĐẠT / DỰ KIẾN ĐẠT CỦA NHÂN SỰ:`
    ];

    if (topPerformers.length > 0) {
        lines.push(`🌟 TOP XUẤT SẮC (Đạt ${totalNH}/${totalNH} hoặc sát nút):`);
        topPerformers.forEach((p, idx) => {
            lines.push(`  ${idx + 1}. ${p.name}: Đạt ${p.achievedText} (${p.rate}%) 🏆`);
        });
    }

    if (moderatePerformers.length > 0) {
        lines.push(`⚡ NHÓM BÁM SÁT TỐT (≥ 50% số NH):`);
        moderatePerformers.forEach(p => {
            lines.push(`  • ${p.name}: Đạt ${p.achievedText}`);
        });
    }

    if (needSupportPerformers.length > 0) {
        lines.push(`⚠️ NHÓM CẦN BỨT PHÁ (< 50% số NH):`);
        needSupportPerformers.forEach(p => {
            lines.push(`  • ${p.name}: Mới đạt ${p.achievedText}`);
        });
    }

    if (zeroPerformers.length > 0) {
        lines.push(`🚨 CẢNH BÁO CHƯA ĐẠT NH NÀO (0/${totalNH} NH):`);
        const names = zeroPerformers.map(p => p.name).join(', ');
        lines.push(`  ${names}`);
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🏢 TIẾN ĐỘ LŨY KẾ CỦA ST:`);
    storeMetrics.forEach(m => {
        const icon = m.forecastRate >= 100 ? '✅' : m.forecastRate >= 80 ? '🟡' : '🔴';
        lines.push(`${icon} ${m.displayName}: Lũy kế ${m.storeActual.toLocaleString('vi-VN')} / Target ${m.storeTarget.toLocaleString('vi-VN')} ${m.unit} (%DK: ${m.forecastRate}%)`);
    });

    lines.push(`\n👉 Đề nghị cả ST tập trung tư vấn chốt các ngành hàng còn thiếu để hoàn thành toàn diện chỉ tiêu!`);

    return {
        totalEmployees,
        topPerformers,
        moderatePerformers,
        needSupportPerformers,
        zeroPerformers,
        bestCampaigns,
        weakCampaigns,
        recommendedSummaryText: lines.join('\n')
    };
}

