import ExcelJS from 'exceljs';
import type { EmployeeItem, CampaignDictItem } from '../../../core/lib/storage';
import { getShortStoreName } from '../../../core/lib/formatters';

export interface ParsedTargetRow {
    employee_id: string;
    full_name?: string;
    store_name?: string;
    target_revenue?: number;
    campaign_targets: Record<string, number>;
}

/**
 * 1. XUẤT FILE EXCEL MẪU DỰA THEO CÁC CỘT ĐANG HIỂN THỊ
 */
export async function exportUnifiedTargetTemplate(
    employees: EmployeeItem[],
    campaigns: CampaignDictItem[],
    revenueTargets: Record<string, number>,
    campaignTargets: Record<string, Record<string, number>>,
    month: number,
    year: number
) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SalesHub';
    workbook.created = new Date();

    const sheetName = `Target_T${month}_${year}`;
    const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }]
    });

    // 1. Định nghĩa các cột
    const columns: Partial<ExcelJS.Column>[] = [
        { header: 'Mã NV', key: 'employee_id', width: 14 },
        { header: 'Họ và tên', key: 'full_name', width: 26 },
        { header: 'Siêu thị', key: 'store_name', width: 26 },
        { header: 'Target Doanh Thu (VNĐ)', key: 'target_revenue', width: 24 }
    ];

    // Thêm các cột thi đua đang active
    campaigns.forEach(c => {
        columns.push({
            header: `${c.display_name} (${c.unit || 'cái'}) [${c.raw_key}]`,
            key: `camp_${c.raw_key}`,
            width: 22
        });
    });

    worksheet.columns = columns;

    // 2. Định dạng hàng Header
    const headerRow = worksheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        // Màu nền phân biệt: Cột thông tin (Xanh navy), Cột doanh thu (Xanh dương đậm), Cột thi đua (Cam đậm)
        if (colNumber <= 3) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // slate-800
        } else if (colNumber === 4) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }; // blue-700
        } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }; // amber-600
        }

        cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
    });

    // 3. Đổ dữ liệu nhân sự và mục tiêu hiện có vào các hàng
    employees.forEach((emp, index) => {
        const empRev = revenueTargets[emp.employee_id] ?? 0;
        const empCamps = campaignTargets[emp.employee_id] || {};

        const rowData: Record<string, any> = {
            employee_id: emp.employee_id,
            full_name: emp.full_name,
            store_name: getShortStoreName(emp.store_name),
            target_revenue: empRev
        };

        campaigns.forEach(c => {
            rowData[`camp_${c.raw_key}`] = empCamps[c.raw_key] ?? 0;
        });

        const row = worksheet.addRow(rowData);
        row.height = 24;

        // Căn chỉnh và định dạng số
        row.eachCell((cell, colNumber) => {
            cell.font = { name: 'Arial', size: 10 };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            if (colNumber === 1) {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
            } else if (colNumber === 2 || colNumber === 3) {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
            } else {
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
                cell.numFmt = '#,##0';
            }

            // Xen kẽ màu nền dòng chẵn/lẻ
            if (index % 2 === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
        });
    });

    // 4. Xuất file và kích hoạt tải xuống trình duyệt
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mau_Chi_Tieu_Nhan_Vien_Thang_${month}_${year}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * 2. ĐỌC VÀ PHÂN TÍCH FILE EXCEL UPLOAD
 */
export async function parseExcelFile(
    file: File,
    campaigns: CampaignDictItem[]
): Promise<ParsedTargetRow[]> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) {
        throw new Error('File Excel rỗng hoặc không có dữ liệu nhân sự!');
    }

    // 1. Quét hàng Header để nhận diện cột
    const headerRow = worksheet.getRow(1);
    let empIdCol = -1;
    let revCol = -1;
    const campCols: { raw_key: string; colIndex: number }[] = [];

    headerRow.eachCell((cell, colNumber) => {
        const text = String(cell.value || '').trim();
        const lower = text.toLowerCase();

        if (lower.includes('mã nv') || lower.includes('employee_id') || lower === 'manv') {
            empIdCol = colNumber;
        } else if (lower.includes('doanh thu') || lower.includes('revenue') || lower.includes('target dt')) {
            revCol = colNumber;
        }

        // Tìm khớp cột thi đua dựa trên [RAW_KEY] hoặc tên hiển thị
        campaigns.forEach(c => {
            if (
                text.includes(`[${c.raw_key}]`) ||
                lower.includes(c.display_name.toLowerCase()) ||
                lower.includes(c.raw_key.toLowerCase())
            ) {
                campCols.push({ raw_key: c.raw_key, colIndex: colNumber });
            }
        });
    });

    // Nếu không tìm thấy cột Mã NV ở header, mặc định lấy cột 1
    if (empIdCol === -1) empIdCol = 1;

    // 2. Trích xuất dữ liệu từ các hàng
    const results: ParsedTargetRow[] = [];

    for (let r = 2; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const empIdVal = row.getCell(empIdCol).value;
        if (!empIdVal) continue;

        const employee_id = String(empIdVal).trim();
        if (!employee_id || employee_id.toLowerCase().includes('tổng')) continue;

        let target_revenue: number | undefined = undefined;
        if (revCol !== -1) {
            const rawRev = row.getCell(revCol).value;
            target_revenue = parseNumericCellValue(rawRev);
        }

        const campaign_targets: Record<string, number> = {};
        campCols.forEach(({ raw_key, colIndex }) => {
            const rawVal = row.getCell(colIndex).value;
            campaign_targets[raw_key] = parseNumericCellValue(rawVal);
        });

        results.push({
            employee_id,
            target_revenue,
            campaign_targets
        });
    }

    return results;
}

function parseNumericCellValue(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && 'result' in val) {
        return Number(val.result) || 0; // Công thức formula trong Excel
    }
    const cleanStr = String(val).replace(/[,.\sđĐ]/g, '').trim();
    const num = Number(cleanStr);
    return isNaN(num) ? 0 : num;
}
