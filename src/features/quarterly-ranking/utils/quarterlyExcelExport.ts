import ExcelJS from 'exceljs';
import type { QuarterlyEmployeeRow, QuarterlySummary } from '../types';
import { getShortStoreName } from '../../../core/lib/formatters';

export async function exportQuarterlyRankingToExcel({
    rows,
    summary,
    months,
    presetLabel,
    storeName
}: {
    rows: QuarterlyEmployeeRow[];
    summary: QuarterlySummary | null;
    months: number[];
    presetLabel: string;
    storeName: string;
}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SalesHub';
    workbook.created = new Date();

    // ==========================================
    // SHEET 1: DOANH THU QUÝ
    // ==========================================
    const revSheet = workbook.addWorksheet('Xếp Hạng Doanh Thu');

    // Title rows
    revSheet.addRow([`BẢNG XẾP HẠNG DOANH THU NHÂN SỰ - ${presetLabel.toUpperCase()}`]);
    revSheet.addRow([`Phạm vi ST: ${getShortStoreName(storeName)} | Tổng nhân sự: ${rows.length} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`]);
    revSheet.addRow([]); // Blank

    // Header row
    const monthHeaders = months.map(m => `T${m} DTQĐ (tr)`);
    const revHeaderRow = revSheet.addRow([
        'Hạng',
        'Mã NV',
        'Họ và Tên',
        'ST',
        'Tổng DTQĐ (tr)',
        'Target Quý (tr)',
        '% Hoàn thành',
        'Phong độ',
        ...monthHeaders
    ]);

    revHeaderRow.eachCell(cell => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEBF3FB' }
        };
        cell.font = { bold: true, color: { argb: 'FF1E40AF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Data rows (sorted by revenue_rank)
    const revRows = [...rows].sort((a, b) => a.revenue_rank - b.revenue_rank);
    revRows.forEach(r => {
        const monthVals = r.month_details.map(m => m.revenueQd);
        revSheet.addRow([
            r.revenue_rank,
            r.employee_id,
            r.full_name,
            getShortStoreName(r.store_name),
            r.total_revenue_qd,
            r.total_target_revenue,
            `${r.completion_rate}%`,
            r.consistency_label,
            ...monthVals
        ]);
    });

    revSheet.columns.forEach(col => {
        let maxLen = 12;
        col.eachCell?.({ includeEmpty: false }, cell => {
            const len = cell.value ? String(cell.value).length : 0;
            if (len > maxLen) maxLen = len;
        });
        col.width = Math.min(30, maxLen + 3);
    });

    // ==========================================
    // SHEET 2: THI ĐUA QUÝ (TỔNG ĐÃ ĐẠT / TỔNG MỤC TIÊU)
    // ==========================================
    const emuSheet = workbook.addWorksheet('Xếp Hạng Thi Đua');

    emuSheet.addRow([`BẢNG XẾP HẠNG THI ĐUA NHÂN SỰ - ${presetLabel.toUpperCase()}`]);
    emuSheet.addRow([`Phạm vi ST: ${getShortStoreName(storeName)} | Cách tính: Tổng Đã Đạt / Tổng Mục Tiêu • Chuẩn phong độ ≥ 60% | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`]);
    emuSheet.addRow([]); // Blank

    const emuMonthHeaders = months.map(m => `T${m} (Đạt/Giao)`);
    const emuHeaderRow = emuSheet.addRow([
        'Hạng Thi Đua',
        'Mã NV',
        'Họ và Tên',
        'ST',
        'Tổng Đã Đạt',
        'Tổng Mục Tiêu',
        '% Hoàn thành',
        'Phong độ (≥60%)',
        ...emuMonthHeaders
    ]);

    emuHeaderRow.eachCell(cell => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEF3C7' }
        };
        cell.font = { bold: true, color: { argb: 'FF92400E' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Data rows (sorted by emulation_rank)
    const emuRows = [...rows].sort((a, b) => a.emulation_rank - b.emulation_rank);
    emuRows.forEach(r => {
        const monthEmuVals = r.emulation_month_details.map(m => `${m.achievedCount}/${m.targetCount} (${m.completionRate}%)`);
        emuSheet.addRow([
            r.emulation_rank,
            r.employee_id,
            r.full_name,
            getShortStoreName(r.store_name),
            r.total_emulation_achieved,
            r.total_emulation_target,
            `${r.emulation_rate}%`,
            r.emulation_consistency_label,
            ...monthEmuVals
        ]);
    });

    emuSheet.columns.forEach(col => {
        let maxLen = 12;
        col.eachCell?.({ includeEmpty: false }, cell => {
            const len = cell.value ? String(cell.value).length : 0;
            if (len > maxLen) maxLen = len;
        });
        col.width = Math.min(30, maxLen + 3);
    });

    // Generate buffer & download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Xep_Hang_Quy_NV_${presetLabel.replace(/[\/\s()]/g, '_')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
