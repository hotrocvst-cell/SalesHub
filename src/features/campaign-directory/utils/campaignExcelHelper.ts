import ExcelJS from 'exceljs';
import type {
    CampaignProgramItem,
    CampaignOrientation,
    CampaignCalculationMethod,
    ProductStatusType,
    CampaignGroup
} from '../types';
import {
    parseProductStatusToCheckboxes,
    formatSelectedProductStatuses
} from '../types';
import type { CampaignDictItem } from '../../../core/lib/storage';

/**
 * Chuẩn hóa chuỗi tiếng Việt không dấu để so khớp linh hoạt
 */
export function normalizeSearchStr(text: string): string {
    return (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Tự động tìm kiếm khớp giữa tên chương trình và từ điển thi đua của admin
 */
export function matchCampaignDictionary(
    programName: string,
    campaignDict: CampaignDictItem[]
): { short_name: string; mapped_key: string } | null {
    if (!programName || !campaignDict || campaignDict.length === 0) return null;

    const normName = normalizeSearchStr(programName);

    // 1. Khớp chính xác hoàn toàn với display_name hoặc raw_key
    for (const dict of campaignDict) {
        const normDisplay = normalizeSearchStr(dict.display_name);
        const normRaw = normalizeSearchStr(dict.raw_key);

        if (normDisplay && (normName === normDisplay || normName === `${normDisplay}`)) {
            return { short_name: dict.display_name, mapped_key: dict.raw_key };
        }
        if (normRaw && normName === normRaw) {
            return { short_name: dict.display_name, mapped_key: dict.raw_key };
        }
    }

    // 2. Khớp chuỗi con: Tên viết tắt hoặc raw_key nằm trong tên chương trình
    let bestMatch: { short_name: string; mapped_key: string; score: number } | null = null;

    for (const dict of campaignDict) {
        const normDisplay = normalizeSearchStr(dict.display_name);
        const normRaw = normalizeSearchStr(dict.raw_key);

        // Khớp từ khóa cụm từ
        if (normDisplay && normDisplay.length >= 2 && normName.includes(normDisplay)) {
            const score = normDisplay.length;
            if (!bestMatch || score > bestMatch.score) {
                bestMatch = { short_name: dict.display_name, mapped_key: dict.raw_key, score };
            }
        } else if (normRaw && normRaw.length >= 3 && normName.includes(normRaw)) {
            const score = normRaw.length;
            if (!bestMatch || score > bestMatch.score) {
                bestMatch = { short_name: dict.display_name, mapped_key: dict.raw_key, score };
            }
        }
    }

    // 3. Khớp một số từ khóa đặc thù quen thuộc
    if (!bestMatch) {
        for (const dict of campaignDict) {
            const normRaw = normalizeSearchStr(dict.raw_key);
            const normDisp = normalizeSearchStr(dict.display_name);

            if (normName.includes('iphone') || normName.includes('apple')) {
                if (normRaw.includes('apple') || normDisp.includes('apple') || normDisp.includes('iphone')) {
                    return { short_name: dict.display_name, mapped_key: dict.raw_key };
                }
            }
            if (normName.includes('phu kien') || normName.includes('combo')) {
                if (normRaw.includes('pk') || normDisp.includes('phu kien')) {
                    return { short_name: dict.display_name, mapped_key: dict.raw_key };
                }
            }
            if (normName.includes('sim') || normName.includes('thue bao')) {
                if (normRaw.includes('sim') || normDisp.includes('sim')) {
                    return { short_name: dict.display_name, mapped_key: dict.raw_key };
                }
            }
            if (normName.includes('tivi') || normName.includes('soundbar') || normName.includes('dien may')) {
                if (normRaw.includes('ce') || normDisp.includes('ce') || normDisp.includes('tivi')) {
                    return { short_name: dict.display_name, mapped_key: dict.raw_key };
                }
            }
            if (normName.includes('gia dung') || normName.includes('may lanh')) {
                if (normRaw.includes('gia dung') || normDisp.includes('gia dung')) {
                    return { short_name: dict.display_name, mapped_key: dict.raw_key };
                }
            }
            if (normName.includes('bao hanh') || normName.includes('roi vo')) {
                if (normRaw.includes('bhmr') || normDisp.includes('bao hanh')) {
                    return { short_name: dict.display_name, mapped_key: dict.raw_key };
                }
            }
        }
    }

    return bestMatch ? { short_name: bestMatch.short_name, mapped_key: bestMatch.mapped_key } : null;
}

/**
 * 1. XUẤT FILE EXCEL MẪU CHUẨN CÓ SẴN CÁC DÒNG MẪU VÀ BẢNG TỪ ĐIỂN MAPPING
 */
export async function exportCampaignProgramTemplate(
    campaignDict: CampaignDictItem[] = []
): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SalesHub Analytics';
    workbook.created = new Date();

    // SHEET 1: DANH SÁCH CHƯƠNG TRÌNH THI ĐUA
    const sheet1 = workbook.addWorksheet('Chuong_Trinh_Thi_Dua', {
        views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
    });

    const columns: Partial<ExcelJS.Column>[] = [
        { header: 'Nhóm thi đua (*)', key: 'group_name', width: 16 },
        { header: 'Tên chương trình thi đua (*)', key: 'program_name', width: 34 },
        { header: 'Tên viết tắt / Mapping', key: 'short_name', width: 22 },
        { header: 'Định hướng (*)', key: 'orientation', width: 16 },
        { header: 'Cách tính (*)', key: 'calculation_method', width: 16 },
        { header: 'Trạng thái SP', key: 'product_status', width: 16 },
        { header: 'Kỳ áp dụng', key: 'target_period', width: 18 },
        { header: 'Thể lệ & Thưởng (*)', key: 'rules', width: 42 },
        { header: 'Cơ hội (CTKM)', key: 'opportunity', width: 42 }
    ];

    sheet1.columns = columns;

    // Header styling
    const headerRow = sheet1.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        if (colNumber === 3) {
            // Cột mapping viết tắt nổi bật màu tím navy
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C1D95' } };
        } else if (colNumber >= 8) {
            // Cột thể lệ & CTKM màu xanh đậm
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        } else {
            // Các cột thông số chính màu xám đen sang trọng
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        }
    });

    // Thêm các dòng dữ liệu mẫu sinh động (kèm ví dụ xuống hàng và cú pháp định dạng text)
    const sampleRows = [
        {
            group_name: 'ICT',
            program_name: 'Thi Đua iPhone 16 Series Vượt Trội',
            short_name: 'iPhone',
            orientation: 'Chính',
            calculation_method: 'DTQĐ',
            product_status: 'Mới',
            target_period: 'Tháng 10/2026',
            rules: `**Thưởng 150.000đ/máy** khi đạt 100% target.\n- Áp dụng toàn bộ iPhone 16 Series.\n- [red]Nhân đôi điểm thi đua[/red] cho ca bán ra trên 3 máy/ngày.`,
            opportunity: `Giảm 2.500.000đ qua [blue]VNPAY/MoMo[/blue].\nTrợ giá thu cũ đổi mới [green]lên đến 2.000.000đ[/green].`
        },
        {
            group_name: 'Phụ kiện',
            program_name: 'Thi Đua Combo Phụ Kiện Kèm SmartPhone',
            short_name: 'Phụ kiện',
            orientation: 'Bán kèm',
            calculation_method: 'Số lượng',
            product_status: 'Mới',
            target_period: 'Tháng 10/2026',
            rules: `Tỷ lệ đính kèm combo >= 45%.\n- [amber]Thưởng nóng 30.000đ/combo[/amber] thành công.\n- Đạt mốc 100 combo thưởng thêm [hl]500.000đ[/hl].`,
            opportunity: `Mua kèm điện thoại giảm 35%.\nBảo hành 1 đổi 1 trong 12 tháng.`
        },
        {
            group_name: 'CE',
            program_name: 'Thi Đua Tivi Sony Bravia XR & Màn Hình Lớn',
            short_name: 'CE',
            orientation: 'Chính',
            calculation_method: 'Doanh thu',
            product_status: 'Mới',
            target_period: 'Tháng 10/2026',
            rules: `Tính trên doanh thu thực tế model Tivi Sony từ 55 inch trở lên.\n**Vượt mốc 150tr/tháng** thưởng 3% doanh số vượt.`,
            opportunity: `Tặng Loa Soundbar Sony 3.5tr.\nTrả góp 0% lãi suất duyệt 5 phút.`
        },
        {
            group_name: 'Dịch vụ',
            program_name: 'Bảo Hành Mở Rộng & Rơi Vỡ (AIG/MIC)',
            short_name: 'Bảo hành',
            orientation: 'Bán kèm',
            calculation_method: 'SLQĐ',
            product_status: 'Tất cả (All)',
            target_period: 'Tháng 10/2026',
            rules: `Tỷ lệ đính kèm tối thiểu 25% trên tổng máy ICT.\nQuy đổi 1 hợp đồng = 1.5 đơn vị.`,
            opportunity: `Ưu đãi giảm 20% khi mua gói 2 năm.`
        }
    ];

    sampleRows.forEach(row => {
        const added = sheet1.addRow(row);
        added.height = 42;
        added.eachCell((cell, colNumber) => {
            cell.font = { name: 'Arial', size: 10 };
            cell.alignment = {
                vertical: 'middle',
                horizontal: colNumber === 1 || colNumber === 4 || colNumber === 5 || colNumber === 6 ? 'center' : 'left',
                wrapText: true
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });
    });

    // SHEET 2: BẢNG TỔNG HỢP CÁC THẺ & CÚ PHÁP ĐỊNH DẠNG TEXT (SALESHUB ANALYTICS)
    buildFormatGuideSheet(workbook);

    // SHEET 3: DANH MỤC TỪ ĐIỂN THI ĐUA CỦA ADMIN ĐỂ TRA CỨU MAPPING
    if (campaignDict && campaignDict.length > 0) {
        const sheet3 = workbook.addWorksheet('Tu_Dien_Mapping', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        sheet3.columns = [
            { header: 'Tên viết tắt (display_name)', key: 'display_name', width: 28 },
            { header: 'Tên theo dữ liệu nhập (raw_key)', key: 'raw_key', width: 32 },
            { header: 'Đơn vị tính', key: 'unit', width: 16 },
            { header: 'Trạng thái', key: 'is_active', width: 16 }
        ];

        const s3Header = sheet3.getRow(1);
        s3Header.height = 28;
        s3Header.eachCell(c => {
            c.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
            c.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        campaignDict.forEach(dict => {
            const r = sheet3.addRow({
                display_name: dict.display_name,
                raw_key: dict.raw_key,
                unit: dict.unit || 'Cái',
                is_active: dict.is_active !== false ? 'Đang kích hoạt' : 'Tạm dừng'
            });
            r.height = 22;
            r.eachCell(c => {
                c.font = { name: 'Arial', size: 10 };
                c.alignment = { vertical: 'middle' };
            });
        });
    }

    // Xuất file tải xuống
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SalesHub_Mau_Chuong_Trinh_Thi_Dua_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * 2. ĐỌC VÀ BÓC TÁCH FILE EXCEL (.XLSX) DO NGƯỜI DÙNG TẢI LÊN
 */
export async function parseCampaignExcelFile(
    file: File,
    campaignDict: CampaignDictItem[] = []
): Promise<CampaignProgramItem[]> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    // Ưu tiên sheet đầu tiên hoặc sheet có tên Chuong_Trinh
    let worksheet = workbook.getWorksheet('Chuong_Trinh_Thi_Dua') || workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) {
        throw new Error('File Excel rỗng hoặc không có dòng dữ liệu nào!');
    }

    // 1. Quét hàng Header để nhận diện vị trí các cột
    const headerRow = worksheet.getRow(1);
    const colMap: Record<string, number> = {
        group_name: -1,
        program_name: -1,
        short_name: -1,
        orientation: -1,
        calculation_method: -1,
        product_status: -1,
        target_period: -1,
        rules: -1,
        opportunity: -1
    };

    headerRow.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').trim();
        const norm = normalizeSearchStr(val);

        if (norm.includes('nhom')) colMap.group_name = colNumber;
        else if (norm.includes('viet tat') || norm.includes('short') || norm.includes('mapping')) colMap.short_name = colNumber;
        else if (norm.includes('chuong trinh') || norm.includes('ten ct') || norm.includes('program')) colMap.program_name = colNumber;
        else if (norm.includes('dinh huong') || norm.includes('orientation')) colMap.orientation = colNumber;
        else if (norm.includes('cach tinh') || norm.includes('tinh') || norm.includes('calc')) colMap.calculation_method = colNumber;
        else if (norm.includes('trang thai') || norm.includes('status')) colMap.product_status = colNumber;
        else if (norm.includes('ky') || norm.includes('period') || norm.includes('thang')) colMap.target_period = colNumber;
        else if (norm.includes('the le') || norm.includes('thuong') || norm.includes('rules') || norm.includes('dieu kien')) colMap.rules = colNumber;
        else if (norm.includes('co hoi') || norm.includes('ctkm') || norm.includes('khuyen mai') || norm.includes('opportunity')) colMap.opportunity = colNumber;
    });

    // Fallback nếu không khớp theo tên header: Sử dụng thứ tự cột mặc định
    if (colMap.group_name === -1) colMap.group_name = 1;
    if (colMap.program_name === -1) colMap.program_name = 2;
    if (colMap.short_name === -1) colMap.short_name = 3;
    if (colMap.orientation === -1) colMap.orientation = 4;
    if (colMap.calculation_method === -1) colMap.calculation_method = 5;
    if (colMap.product_status === -1) colMap.product_status = 6;
    if (colMap.target_period === -1) colMap.target_period = 7;
    if (colMap.rules === -1) colMap.rules = 8;
    if (colMap.opportunity === -1) colMap.opportunity = 9;

    const items: CampaignProgramItem[] = [];

    for (let r = 2; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const pNameVal = getCellValueAsString(row.getCell(colMap.program_name).value);
        if (!pNameVal) continue; // Bỏ qua dòng trống

        const group_name = (getCellValueAsString(row.getCell(colMap.group_name).value) || 'ICT') as CampaignGroup;
        const program_name = pNameVal;
        let short_name = getCellValueAsString(row.getCell(colMap.short_name).value);
        const rawOrient = getCellValueAsString(row.getCell(colMap.orientation).value);
        const rawCalc = getCellValueAsString(row.getCell(colMap.calculation_method).value);
        const rawStatus = getCellValueAsString(row.getCell(colMap.product_status).value);
        const target_period = getCellValueAsString(row.getCell(colMap.target_period).value) || 'Tháng 10/2026';
        const rules = getCellValueAsString(row.getCell(colMap.rules).value);
        const opportunity = getCellValueAsString(row.getCell(colMap.opportunity).value);

        // Chuẩn hóa định hướng
        let orientation: CampaignOrientation = 'Chính';
        const normOrient = normalizeSearchStr(rawOrient);
        if (normOrient.includes('kem')) orientation = 'Bán kèm';
        else if (normOrient.includes('phu')) orientation = 'Phụ';
        else if (normOrient.includes('trong tam')) orientation = 'Trọng tâm';

        // Chuẩn hóa cách tính
        let calculation_method: CampaignCalculationMethod = 'Doanh thu';
        const normCalc = normalizeSearchStr(rawCalc);
        if (normCalc.includes('dtqd')) calculation_method = 'DTQĐ';
        else if (normCalc.includes('slqd')) calculation_method = 'SLQĐ';
        else if (normCalc.includes('so luong') || normCalc.includes('sl')) calculation_method = 'Số lượng';

        // Chuẩn hóa trạng thái sản phẩm
        const product_status: ProductStatusType = parseProductStatus(rawStatus);

        // Tự động mapping với từ điển thi đua nếu chưa có short_name
        let mapped_key = '';
        if (!short_name && campaignDict && campaignDict.length > 0) {
            const matched = matchCampaignDictionary(program_name, campaignDict);
            if (matched) {
                short_name = matched.short_name;
                mapped_key = matched.mapped_key;
            }
        } else if (short_name && campaignDict && campaignDict.length > 0) {
            // Khớp xem short_name đã nhập có raw_key nào tương ứng
            const exact = campaignDict.find(
                d => normalizeSearchStr(d.display_name) === normalizeSearchStr(short_name) ||
                     normalizeSearchStr(d.raw_key) === normalizeSearchStr(short_name)
            );
            if (exact) {
                mapped_key = exact.raw_key;
                short_name = exact.display_name;
            }
        }

        items.push({
            id: `cp-excel-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
            group_name,
            program_name,
            short_name: short_name || undefined,
            mapped_key: mapped_key || undefined,
            orientation,
            calculation_method,
            rules,
            product_status,
            opportunity,
            target_period,
            order_index: r - 1,
            is_active: true
        });
    }

    return items;
}

/**
 * 3. BÓC TÁCH DỮ LIỆU DÁN (CTRL + V) VỚI CƠ CHẾ STATE-MACHINE PARSER
 * XỬ LÝ AN TOÀN Ô EXCEL CÓ NHIỀU DÒNG (XUỐNG HÀNG TRONG Ô / QUOTED NEWLINES)
 */
export function parseCampaignTsvOrCsv(
    rawText: string,
    campaignDict: CampaignDictItem[] = []
): CampaignProgramItem[] {
    if (!rawText || !rawText.trim()) return [];

    // 1. Phân tích văn bản thành mảng các hàng và cột theo chuẩn CSV/TSV
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    let i = 0;

    while (i < rawText.length) {
        const char = rawText[i];
        const nextChar = rawText[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i += 2;
                continue;
            } else {
                inQuotes = !inQuotes;
                i++;
                continue;
            }
        }

        if (!inQuotes) {
            // Tách cột theo phím Tab (\t), hoặc dấu chấm phẩy/phẩy nếu cả văn bản không hề có Tab
            if (char === '\t' || (!rawText.includes('\t') && (char === ';' || char === ','))) {
                currentRow.push(currentCell.trim());
                currentCell = '';
                i++;
                continue;
            }

            if (char === '\r') {
                if (nextChar === '\n') i++;
                currentRow.push(currentCell.trim());
                if (currentRow.some(c => c.length > 0)) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentCell = '';
                i++;
                continue;
            }

            if (char === '\n') {
                currentRow.push(currentCell.trim());
                if (currentRow.some(c => c.length > 0)) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentCell = '';
                i++;
                continue;
            }
        }

        currentCell += char;
        i++;
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
            rows.push(currentRow);
        }
    }

    if (rows.length === 0) return [];

    // 2. Nhận diện nếu hàng đầu tiên là Tiêu Đề Header
    let startIndex = 0;
    const firstRowStr = rows[0].join(' ').toLowerCase();
    const hasHeader =
        firstRowStr.includes('nhóm') ||
        firstRowStr.includes('chương trình') ||
        firstRowStr.includes('thể lệ') ||
        firstRowStr.includes('định hướng') ||
        firstRowStr.includes('cách tính');

    // Nhận diện cột theo header nếu có
    const colIndexMap: Record<string, number> = {
        group_name: -1,
        program_name: -1,
        short_name: -1,
        orientation: -1,
        calculation_method: -1,
        product_status: -1,
        target_period: -1,
        rules: -1,
        opportunity: -1
    };

    if (hasHeader) {
        startIndex = 1;
        rows[0].forEach((colVal, idx) => {
            const norm = normalizeSearchStr(colVal);
            if (norm.includes('nhom')) colIndexMap.group_name = idx;
            else if (norm.includes('viet tat') || norm.includes('short') || norm.includes('mapping')) colIndexMap.short_name = idx;
            else if (norm.includes('chuong trinh') || norm.includes('ten ct')) colIndexMap.program_name = idx;
            else if (norm.includes('dinh huong')) colIndexMap.orientation = idx;
            else if (norm.includes('cach tinh')) colIndexMap.calculation_method = idx;
            else if (norm.includes('trang thai')) colIndexMap.product_status = idx;
            else if (norm.includes('ky') || norm.includes('thang')) colIndexMap.target_period = idx;
            else if (norm.includes('the le') || norm.includes('thuong') || norm.includes('dieu kien')) colIndexMap.rules = idx;
            else if (norm.includes('co hoi') || norm.includes('ctkm')) colIndexMap.opportunity = idx;
        });
    }

    // 3. Chuyển đổi từng hàng thành đối tượng CampaignProgramItem
    const result: CampaignProgramItem[] = [];

    for (let r = startIndex; r < rows.length; r++) {
        const parts = rows[r];
        if (parts.length < 2) continue;

        let group_name = 'ICT';
        let program_name = '';
        let short_name = '';
        let orientation: CampaignOrientation = 'Chính';
        let calculation_method: CampaignCalculationMethod = 'Doanh thu';
        let rules = '';
        let product_status: ProductStatusType = 'Tất cả (All)';
        let opportunity = '';
        let target_period = 'Tháng 10/2026';

        if (hasHeader && colIndexMap.program_name !== -1) {
            // Bóc tách theo vị trí cột đã nhận diện từ Header
            if (colIndexMap.group_name !== -1) group_name = parts[colIndexMap.group_name] || 'ICT';
            program_name = parts[colIndexMap.program_name] || `Chương trình ${r}`;
            if (colIndexMap.short_name !== -1) short_name = parts[colIndexMap.short_name] || '';
            const rawOrient = colIndexMap.orientation !== -1 ? parts[colIndexMap.orientation] : 'Chính';
            const rawCalc = colIndexMap.calculation_method !== -1 ? parts[colIndexMap.calculation_method] : 'Doanh thu';
            const rawStatus = colIndexMap.product_status !== -1 ? parts[colIndexMap.product_status] : 'Tất cả (All)';
            if (colIndexMap.target_period !== -1 && parts[colIndexMap.target_period]) target_period = parts[colIndexMap.target_period];
            if (colIndexMap.rules !== -1) rules = parts[colIndexMap.rules] || '';
            if (colIndexMap.opportunity !== -1) opportunity = parts[colIndexMap.opportunity] || '';

            orientation = parseOrientation(rawOrient);
            calculation_method = parseCalculationMethod(rawCalc);
            product_status = parseProductStatus(rawStatus);
        } else {
            // Không có Header: Kiểm tra format 7 cột cũ hay 9 cột mới
            // Cột 0: Nhóm
            // Cột 1: Tên chương trình
            // Kiểm tra Cột 2 có phải là Định hướng (Chính, Bán kèm...) không:
            const col2Norm = normalizeSearchStr(parts[2] || '');
            const isCol2Orient = col2Norm.includes('chinh') || col2Norm.includes('ban kem') || col2Norm.includes('phu') || col2Norm.includes('trong tam');

            if (isCol2Orient) {
                // FORMAT 7 CỘT CŨ (Không có cột short_name):
                // 0: Nhóm, 1: Tên CT, 2: Định hướng, 3: Cách tính, 4: Thể lệ, 5: Trạng thái SP, 6: Cơ hội
                group_name = parts[0] || 'ICT';
                program_name = parts[1] || `Chương trình ${r}`;
                orientation = parseOrientation(parts[2]);
                calculation_method = parseCalculationMethod(parts[3]);
                rules = parts[4] || '';
                product_status = parseProductStatus(parts[5]);
                opportunity = parts[6] || '';
            } else {
                // FORMAT 9 CỘT MẪU (Có cột short_name):
                // 0: Nhóm, 1: Tên CT, 2: Viết tắt/Mapping, 3: Định hướng, 4: Cách tính, 5: Trạng thái SP, 6: Kỳ, 7: Thể lệ, 8: Cơ hội
                group_name = parts[0] || 'ICT';
                program_name = parts[1] || `Chương trình ${r}`;
                short_name = parts[2] || '';
                orientation = parseOrientation(parts[3]);
                calculation_method = parseCalculationMethod(parts[4]);
                product_status = parseProductStatus(parts[5]);
                target_period = parts[6] || 'Tháng 10/2026';
                rules = parts[7] || '';
                opportunity = parts[8] || '';
            }
        }

        // Tự động mapping với từ điển thi đua nếu chưa có
        let mapped_key = '';
        if (!short_name && campaignDict && campaignDict.length > 0) {
            const matched = matchCampaignDictionary(program_name, campaignDict);
            if (matched) {
                short_name = matched.short_name;
                mapped_key = matched.mapped_key;
            }
        } else if (short_name && campaignDict && campaignDict.length > 0) {
            const exact = campaignDict.find(
                d => normalizeSearchStr(d.display_name) === normalizeSearchStr(short_name) ||
                     normalizeSearchStr(d.raw_key) === normalizeSearchStr(short_name)
            );
            if (exact) {
                mapped_key = exact.raw_key;
                short_name = exact.display_name;
            }
        }

        result.push({
            id: `cp-paste-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
            group_name: group_name as CampaignGroup,
            program_name,
            short_name: short_name || undefined,
            mapped_key: mapped_key || undefined,
            orientation,
            calculation_method,
            rules,
            product_status,
            opportunity,
            target_period,
            order_index: r,
            is_active: true
        });
    }

    return result;
}

function parseOrientation(raw: string): CampaignOrientation {
    const norm = normalizeSearchStr(raw);
    if (norm.includes('kem')) return 'Bán kèm';
    if (norm.includes('phu')) return 'Phụ';
    if (norm.includes('trong tam')) return 'Trọng tâm';
    return 'Chính';
}

function parseCalculationMethod(raw: string): CampaignCalculationMethod {
    const norm = normalizeSearchStr(raw);
    if (norm.includes('dtqd')) return 'DTQĐ';
    if (norm.includes('slqd')) return 'SLQĐ';
    if (norm.includes('so luong') || norm.includes('sl')) return 'Số lượng';
    return 'Doanh thu';
}

function parseProductStatus(raw: string): ProductStatusType {
    const statuses = parseProductStatusToCheckboxes(raw);
    return formatSelectedProductStatuses(statuses);
}

function getCellValueAsString(val: any): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object' && 'richText' in val && Array.isArray(val.richText)) {
        return val.richText.map((t: any) => t.text || '').join('');
    }
    if (typeof val === 'object' && 'text' in val) {
        return String(val.text || '');
    }
    return String(val).trim();
}

/**
 * TẠO SHEET HƯỚNG DẪN CÁC THẺ & CÁCH DÙNG ĐỂ ĐỊNH DẠNG TEXT (SALESHUB ANALYTICS)
 */
function buildFormatGuideSheet(workbook: ExcelJS.Workbook): void {
    const sheet = workbook.addWorksheet('Huong_Dan_Dinh_Dang', {
        views: [{ state: 'frozen', ySplit: 3 }]
    });

    sheet.columns = [
        { key: 'stt', width: 7 },
        { key: 'category', width: 22 },
        { key: 'syntax', width: 28 },
        { key: 'description', width: 36 },
        { key: 'example', width: 44 },
        { key: 'preview', width: 40 },
        { key: 'notes', width: 28 }
    ];

    // Dòng 1: Banner Tiêu Đề
    sheet.addRow(['BẢNG TỔNG HỢP CÁC THẺ & CÚ PHÁP ĐỊNH DẠNG TEXT (SALESHUB ANALYTICS)']);
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.font = { name: 'Arial', size: 12.5, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 36;

    // Dòng 2: Phụ đề & Hướng dẫn
    sheet.addRow([
        'Áp dụng cho cột [Thể lệ & Thưởng] và [Cơ hội (CTKM)]. Khi nhập vào Excel và tải lên SalesHub, hệ thống sẽ tự động hiển thị trực quan trên Web và hình ảnh báo cáo gửi Zalo.'
    ]);
    sheet.mergeCells('A2:G2');
    const subCell = sheet.getCell('A2');
    subCell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF1E293B' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    sheet.getRow(2).height = 24;

    // Dòng 3: Header của Bảng
    sheet.addRow([
        'STT',
        'Nhóm định dạng',
        'Thẻ / Cú pháp gõ',
        'Mô tả & Công dụng',
        'Ví dụ gõ vào ô Excel',
        'Hiển thị mẫu trên SalesHub',
        'Phím tắt / Ghi chú nhanh'
    ]);
    const headerRow = sheet.getRow(3);
    headerRow.height = 30;
    headerRow.eachCell(cell => {
        cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF94A3B8' } },
            bottom: { style: 'medium', color: { argb: 'FF334155' } },
            left: { style: 'thin', color: { argb: 'FF94A3B8' } },
            right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
    });

    // Danh sách các mục hướng dẫn định dạng chi tiết
    const guideItems = [
        {
            stt: 1,
            category: 'Xuống dòng trong ô',
            syntax: 'Alt + Enter (hoặc <br>)',
            description: 'Ngắt đoạn văn thành các dòng riêng biệt trong cùng 1 ô Excel.',
            example: 'Dòng 1: Thể lệ chính\nDòng 2: Điều kiện phụ',
            preview: {
                richText: [
                    { text: 'Dòng 1: Thể lệ chính\nDòng 2: Điều kiện phụ', font: { name: 'Arial', size: 10 } }
                ]
            },
            notes: 'Nhấn giữ phím Alt rồi bấm Enter'
        },
        {
            stt: 2,
            category: 'Chữ in đậm (Bold)',
            syntax: '**nội dung** hoặc <b>...</b>',
            description: 'Làm đậm chữ để nhấn mạnh số tiền thưởng, mốc target, model trọng tâm.',
            example: '**Thưởng 150.000đ/máy** khi đạt 100% target',
            preview: {
                richText: [
                    { text: 'Thưởng 150.000đ/máy', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } } },
                    { text: ' khi đạt 100% target', font: { name: 'Arial', size: 10 } }
                ]
            },
            notes: 'Kẹp 2 dấu sao ** ở đầu và cuối'
        },
        {
            stt: 3,
            category: 'Chữ in nghiêng (Italic)',
            syntax: '*nội dung* hoặc <i>...</i>',
            description: 'In nghiêng cho các chú thích phụ, thời gian áp dụng, điều kiện xét duyệt.',
            example: '*Áp dụng ca trực sáng từ 8h00 - 15h00*',
            preview: {
                richText: [
                    { text: 'Áp dụng ca trực sáng từ 8h00 - 15h00', font: { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } } }
                ]
            },
            notes: 'Kẹp 1 dấu sao * ở đầu và cuối'
        },
        {
            stt: 4,
            category: 'Đậm & Nghiêng kết hợp',
            syntax: '***nội dung***',
            description: 'Vừa in đậm vừa in nghiêng cho lưu ý hoặc cảnh báo đặc biệt.',
            example: '***Lưu ý: Chỉ áp dụng máy xuất kho trong ngày***',
            preview: {
                richText: [
                    { text: 'Lưu ý: Chỉ áp dụng máy xuất kho trong ngày', font: { name: 'Arial', size: 10, bold: true, italic: true, color: { argb: 'FF0F172A' } } }
                ]
            },
            notes: 'Kẹp 3 dấu sao *** ở hai đầu'
        },
        {
            stt: 5,
            category: 'Chữ màu Đỏ (Red)',
            syntax: '[red]nội dung[/red] hoặc [do]',
            description: 'Nổi bật cảnh báo, nhân đôi thưởng, điều kiện loại trừ.',
            example: '[red]Nhân đôi điểm thi đua[/red] cho ca bán trên 3 máy',
            preview: {
                richText: [
                    { text: 'Nhân đôi điểm thi đua', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFE11D48' } } },
                    { text: ' cho ca bán trên 3 máy', font: { name: 'Arial', size: 10 } }
                ]
            },
            notes: 'Có thể dùng [red] hoặc [do]'
        },
        {
            stt: 6,
            category: 'Chữ màu Xanh (Blue)',
            syntax: '[blue]nội dung[/blue] hoặc [xanh]',
            description: 'Cổng thanh toán, ngân hàng tài trợ, mã chương trình, tên hãng.',
            example: 'Giảm 2.500.000đ qua [blue]VNPAY / MoMo[/blue]',
            preview: {
                richText: [
                    { text: 'Giảm 2.500.000đ qua ', font: { name: 'Arial', size: 10 } },
                    { text: 'VNPAY / MoMo', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF2563EB' } } }
                ]
            },
            notes: 'Có thể dùng [blue] hoặc [xanh]'
        },
        {
            stt: 7,
            category: 'Chữ màu Xanh Lá (Green)',
            syntax: '[green]nội dung[/green] hoặc [luc]',
            description: 'Mức trợ giá, quà tặng kèm, các chỉ số đạt target xuất sắc.',
            example: 'Trợ giá thu cũ đổi mới [green]lên đến 2.000.000đ[/green]',
            preview: {
                richText: [
                    { text: 'Trợ giá thu cũ đổi mới ', font: { name: 'Arial', size: 10 } },
                    { text: 'lên đến 2.000.000đ', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF059669' } } }
                ]
            },
            notes: 'Có thể dùng [green] hoặc [luc]'
        },
        {
            stt: 8,
            category: 'Chữ màu Vàng Cam (Amber)',
            syntax: '[amber]nội dung[/amber] hoặc [gold]',
            description: 'Giải thưởng lớn, huy hiệu thi đua, quà tặng giá trị cao.',
            example: 'Thưởng nóng [amber]30.000đ/combo[/amber] thành công',
            preview: {
                richText: [
                    { text: 'Thưởng nóng ', font: { name: 'Arial', size: 10 } },
                    { text: '30.000đ/combo', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFD97706' } } },
                    { text: ' thành công', font: { name: 'Arial', size: 10 } }
                ]
            },
            notes: 'Có thể dùng [amber], [gold], [vang]'
        },
        {
            stt: 9,
            category: 'Chữ màu Cam (Orange)',
            syntax: '[orange]nội dung[/orange]',
            description: 'Ưu đãi sốc, phụ kiện kèm máy, quà tặng đắt giá.',
            example: 'Tặng Loa Soundbar Sony [orange]trị giá 3.500.000đ[/orange]',
            preview: {
                richText: [
                    { text: 'Tặng Loa Soundbar Sony ', font: { name: 'Arial', size: 10 } },
                    { text: 'trị giá 3.500.000đ', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEA580C' } } }
                ]
            },
            notes: 'Nhấn mạnh giá trị quà tặng'
        },
        {
            stt: 10,
            category: 'Chữ màu Tím (Purple)',
            syntax: '[purple]nội dung[/purple] hoặc [tim]',
            description: 'Dịch vụ bảo hành, rơi vỡ, SIM số đẹp, tiện ích bán lẻ.',
            example: 'Tặng gói Bảo hiểm rơi vỡ [purple]thời hạn 12 tháng[/purple]',
            preview: {
                richText: [
                    { text: 'Tặng gói Bảo hiểm rơi vỡ ', font: { name: 'Arial', size: 10 } },
                    { text: 'thời hạn 12 tháng', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF9333EA' } } }
                ]
            },
            notes: 'Có thể dùng [purple] hoặc [tim]'
        },
        {
            stt: 11,
            category: 'Chữ màu Xanh Ngọc (Cyan)',
            syntax: '[cyan]nội dung[/cyan]',
            description: 'Gói cước data 4G/5G, tài khoản VIP, tiện ích kỹ thuật số.',
            example: 'Gói cước SIM Data [cyan]6GB tốc độ cao/ngày[/cyan]',
            preview: {
                richText: [
                    { text: 'Gói cước SIM Data ', font: { name: 'Arial', size: 10 } },
                    { text: '6GB tốc độ cao/ngày', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0E7490' } } }
                ]
            },
            notes: 'Màu xanh ngọc dịu mắt'
        },
        {
            stt: 12,
            category: 'Màu tùy chỉnh theo mã HEX',
            syntax: '[color=#HEX]nội dung[/color]',
            description: 'Dùng mã màu thương hiệu theo chuẩn HEX bất kỳ.',
            example: 'Ưu đãi độc quyền [color=#E11D48]Galaxy AI Series[/color]',
            preview: {
                richText: [
                    { text: 'Ưu đãi độc quyền ', font: { name: 'Arial', size: 10 } },
                    { text: 'Galaxy AI Series', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFE11D48' } } }
                ]
            },
            notes: 'Định dạng: [color=#MÃ_HEX]...[/color]'
        },
        {
            stt: 13,
            category: 'Tô nền Highlight vàng',
            syntax: '[hl]nội dung[/hl] hoặc [highlight]',
            description: 'Đổ nền vàng bo tròn làm nổi bật số tiền thưởng hoặc danh hiệu.',
            example: 'Đạt mốc 100 máy thưởng thêm [hl]500.000đ[/hl]',
            preview: {
                richText: [
                    { text: 'Đạt mốc 100 máy thưởng thêm ', font: { name: 'Arial', size: 10 } },
                    { text: '500.000đ', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF78350F' } } }
                ]
            },
            notes: 'Nền vàng dạ quang nổi bật'
        },
        {
            stt: 14,
            category: 'Thẻ Huy Hiệu (Badge)',
            syntax: '[badge]nội dung[/badge]',
            description: 'Tạo thẻ chip nhỏ gọn nền xanh dương viền bo tròn chữ in hoa.',
            example: 'Chương trình [badge]HOT[/badge] - Ưu tiên tư vấn',
            preview: {
                richText: [
                    { text: 'Chương trình ', font: { name: 'Arial', size: 10 } },
                    { text: '[ HOT ]', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E40AF' } } },
                    { text: ' - Ưu tiên tư vấn', font: { name: 'Arial', size: 10 } }
                ]
            },
            notes: 'Dành cho nhãn HOT, VIP, MỚI'
        },
        {
            stt: 15,
            category: 'Gạch đầu dòng danh sách',
            syntax: '- nội dung hoặc • nội dung',
            description: 'Tự động thụt đầu dòng và chuyển thành dấu chấm tròn bullet xanh dương.',
            example: '- Đạt target tối thiểu 80%\n- Bán tối thiểu 2 combo/máy',
            preview: {
                richText: [
                    { text: '• Đạt target tối thiểu 80%\n• Bán tối thiểu 2 combo/máy', font: { name: 'Arial', size: 10 } }
                ]
            },
            notes: 'Gõ dấu gạch ngang (-) kèm dấu cách ở đầu dòng'
        },
        {
            stt: 16,
            category: 'Đánh số thứ tự tuần tự',
            syntax: '1. nội dung, 2. nội dung',
            description: 'Đánh số thứ tự các bước tư vấn hoặc các mốc bậc thang xét thưởng.',
            example: '1. Bước 1: Tư vấn model máy\n2. Bước 2: Đính kèm gói bảo hành',
            preview: {
                richText: [
                    { text: '1. Bước 1: Tư vấn model máy\n2. Bước 2: Đính kèm gói bảo hành', font: { name: 'Arial', size: 10 } }
                ]
            },
            notes: 'Gõ số kèm dấu chấm (.) và dấu cách'
        },
        {
            stt: 17,
            category: 'Phối hợp đa định dạng',
            syntax: '**[red]Nội dung[/red]**',
            description: 'Lồng ghép in đậm, màu sắc và highlight cùng lúc để tạo thẻ chuyên nghiệp.',
            example: '**Thưởng nóng [red]200.000đ[/red]** khi đạt [hl]Top 1 Siêu Thị[/hl]',
            preview: {
                richText: [
                    { text: 'Thưởng nóng ', font: { name: 'Arial', size: 10, bold: true } },
                    { text: '200.000đ', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFE11D48' } } },
                    { text: ' khi đạt ', font: { name: 'Arial', size: 10 } },
                    { text: 'Top 1 Siêu Thị', font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFD97706' } } }
                ]
            },
            notes: 'Đóng đúng cặp thẻ lồng nhau'
        }
    ];

    guideItems.forEach((item, index) => {
        const row = sheet.addRow({
            stt: item.stt,
            category: item.category,
            syntax: item.syntax,
            description: item.description,
            example: item.example,
            notes: item.notes
        });

        row.height = 34;

        // Gán richText cho cột 6 (Hiển thị mẫu)
        const cell6 = row.getCell(6);
        cell6.value = item.preview;

        const isEven = index % 2 === 0;
        const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        row.eachCell((cell, colNumber) => {
            cell.alignment = {
                vertical: 'middle',
                horizontal: colNumber === 1 ? 'center' : 'left',
                wrapText: true
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            if (colNumber === 1) {
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            } else if (colNumber === 2) {
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
            } else if (colNumber === 3) {
                cell.font = { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FF1D4ED8' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
            } else if (colNumber === 5) {
                cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF334155' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
            } else {
                cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
            }
        });
    });
}
