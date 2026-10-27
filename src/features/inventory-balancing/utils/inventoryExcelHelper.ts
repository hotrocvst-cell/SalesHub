import ExcelJS from 'exceljs';
import type { InventoryRawRecord, RebalanceMatchItem, StoreGroupedSupply, ProductSalesVelocity } from '../types';

/**
 * Chuẩn hóa chuỗi bỏ dấu tiếng Việt để tìm kiếm và so khớp header linh hoạt
 */
export function normalizeSearchStr(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .trim();
}

/**
 * Đọc giá trị ô Excel thành chuỗi an toàn
 */
function getCellValueAsString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        const obj = value as { text?: string; result?: string | number };
        if (obj.text !== undefined) return String(obj.text).trim();
        if (obj.result !== undefined) return String(obj.result).trim();
    }
    return String(value).trim();
}

/**
 * Đọc giá trị ô Excel thành số an toàn
 */
function getCellValueAsNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    if (typeof value === 'object') {
        const obj = value as { result?: number; text?: string };
        if (typeof obj.result === 'number') return isNaN(obj.result) ? 0 : obj.result;
        if (obj.text) {
            const parsed = parseFloat(String(obj.text).replace(/,/g, ''));
            return isNaN(parsed) ? 0 : parsed;
        }
    }
    const cleanStr = String(value).replace(/,/g, '').trim();
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Đọc file Excel dữ liệu tồn kho (.xlsx, .xls)
 * Tự động quét tìm hàng Header chính xác trong 10 dòng đầu tiên
 * Nhận diện chuẩn xác các cột:
 * - Tên siêu thị (không bị nhầm lẫn với SL tồn kho tối thiểu hay Số lượng không bao gồm...)
 * - Mã sản phẩm
 * - Tên sản phẩm
 * - Ngành hàng
 * - Nhóm hàng
 * - Trạng thái sản phẩm
 * - Số lượng có thể bán
 */
export async function parseInventoryExcel(file: File): Promise<InventoryRawRecord[]> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    // Chọn worksheet có nhiều dòng dữ liệu nhất
    let worksheet = workbook.worksheets[0];
    for (const ws of workbook.worksheets) {
        if (ws.rowCount > (worksheet?.rowCount || 0)) {
            worksheet = ws;
        }
    }

    if (!worksheet || worksheet.rowCount < 2) {
        throw new Error('File Excel rỗng hoặc không có dữ liệu!');
    }

    // 1. Quét tìm dòng Header chuẩn xác nhất trong 10 dòng đầu tiên
    let headerRowIndex = 1;
    let bestScore = -1;
    let colMap = {
        store_name: -1,
        product_code: -1,
        product_name: -1,
        category: -1,
        sub_category: -1,
        product_status: -1,
        available_qty: -1,
        unit: -1,
        model_code: -1
    };

    const maxScanRows = Math.min(10, worksheet.rowCount);

    for (let r = 1; r <= maxScanRows; r++) {
        const row = worksheet.getRow(r);
        const currentMap = {
            store_name: -1,
            product_code: -1,
            product_name: -1,
            category: -1,
            sub_category: -1,
            product_status: -1,
            available_qty: -1,
            unit: -1,
            model_code: -1
        };
        let rowScore = 0;

        row.eachCell((cell, colNumber) => {
            const val = getCellValueAsString(cell.value);
            const norm = normalizeSearchStr(val);
            if (!norm) return;

            // Tên siêu thị: TUYỆT ĐỐI KHÔNG chứa 'ton kho', 'so luong', 'sl', 'toi thieu', 'khong bao gom'
            const isQtyOrInventory = norm.includes('so luong') || norm.includes('sl ') || norm.startsWith('sl') || norm.includes('ton kho') || norm.includes('khong bao gom') || norm.includes('toi thieu') || norm.includes('ton lo');
            if (!isQtyOrInventory) {
                if (norm.includes('ten sieu thi') || norm.includes('ten st')) {
                    currentMap.store_name = colNumber;
                    rowScore += 15;
                } else if (norm === 'sieu thi' || norm.startsWith('sieu thi') || norm.includes('ten kho')) {
                    if (currentMap.store_name === -1) {
                        currentMap.store_name = colNumber;
                        rowScore += 10;
                    }
                } else if ((norm === 'kho' || norm === 'st' || norm === 'cua hang' || norm === 'diem ban') && currentMap.store_name === -1) {
                    currentMap.store_name = colNumber;
                    rowScore += 5;
                }
            }

            // Mã sản phẩm
            if (norm.includes('ma san pham') || norm.includes('ma sp') || norm === 'barcode' || norm === 'ma hang') {
                currentMap.product_code = colNumber;
                rowScore += 10;
            }

            // Tên sản phẩm
            if (norm.includes('ten san pham') || norm.includes('ten sp') || norm.includes('ten hang')) {
                currentMap.product_name = colNumber;
                rowScore += 10;
            }

            // Ngành hàng
            if (norm.includes('nganh hang') || norm === 'nganh' || norm === 'category') {
                currentMap.category = colNumber;
                rowScore += 5;
            }

            // Nhóm hàng
            if (norm.includes('nhom hang') || norm === 'nhom' || norm.includes('sub category')) {
                currentMap.sub_category = colNumber;
                rowScore += 5;
            }

            // Trạng thái sản phẩm
            if (norm.includes('trang thai') || norm === 'status') {
                currentMap.product_status = colNumber;
                rowScore += 5;
            }

            // Số lượng có thể bán
            if (norm.includes('co the ban') || norm.includes('kha dung')) {
                currentMap.available_qty = colNumber;
                rowScore += 10;
            }

            // Đơn vị
            if (norm.includes('don vi') || norm === 'dvt' || norm === 'unit') {
                currentMap.unit = colNumber;
                rowScore += 2;
            }

            // Mã Model
            if (norm.includes('ma model') || norm === 'model') {
                currentMap.model_code = colNumber;
                rowScore += 2;
            }
        });

        if (rowScore > bestScore) {
            bestScore = rowScore;
            headerRowIndex = r;
            colMap = currentMap;
        }
    }

    // Fallback nếu không phát hiện được theo tên (áp dụng thứ tự cột chuẩn của file mẫu MWG):
    // Cột 1: Tên siêu thị | Cột 2: Mã Model | Cột 3: Mã sản phẩm | Cột 4: Tên sản phẩm | Cột 5: Đơn vị
    // Cột 6: Ngành hàng | Cột 7: Nhóm hàng | Cột 8: Trạng thái | Cột 16: Số lượng có thể bán
    if (colMap.store_name === -1) colMap.store_name = 1;
    if (colMap.model_code === -1) colMap.model_code = 2;
    if (colMap.product_code === -1) colMap.product_code = 3;
    if (colMap.product_name === -1) colMap.product_name = 4;
    if (colMap.unit === -1) colMap.unit = 5;
    if (colMap.category === -1) colMap.category = 6;
    if (colMap.sub_category === -1) colMap.sub_category = 7;
    if (colMap.product_status === -1) colMap.product_status = 8;
    if (colMap.available_qty === -1) colMap.available_qty = 16;

    console.log('[SalesHub Inventory] Dòng Header nhận diện:', headerRowIndex, 'colMap:', colMap);

    const records: InventoryRawRecord[] = [];

    for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const storeName = getCellValueAsString(row.getCell(colMap.store_name).value);
        const productCode = getCellValueAsString(row.getCell(colMap.product_code).value);

        // Bỏ qua dòng không có tên siêu thị hoặc mã sản phẩm, hoặc dòng tiêu đề lặp lại
        if (!storeName || !productCode) continue;
        if (storeName === '0' || storeName === 'Tên siêu thị' || productCode === 'Mã sản phẩm') continue;

        const productName = getCellValueAsString(row.getCell(colMap.product_name).value);
        const category = getCellValueAsString(row.getCell(colMap.category).value);
        const subCategory = getCellValueAsString(row.getCell(colMap.sub_category).value);
        const productStatus = getCellValueAsString(row.getCell(colMap.product_status).value) || 'Mới';
        const availableQty = getCellValueAsNumber(row.getCell(colMap.available_qty).value);
        const unit = colMap.unit !== -1 ? getCellValueAsString(row.getCell(colMap.unit).value) : '';
        const modelCode = colMap.model_code !== -1 ? getCellValueAsString(row.getCell(colMap.model_code).value) : '';

        records.push({
            store_name: storeName,
            product_code: productCode,
            product_name: productName,
            category,
            sub_category: subCategory,
            product_status: productStatus,
            available_qty: availableQty,
            unit,
            model_code: modelCode
        });
    }

    return records;
}

/**
 * Tạo nội dung tin nhắn Zalo gửi chung cho nhóm khu vực hoặc Quản lý
 */
export function generateZaloOverallMessage(
    targetStore: string,
    matches: RebalanceMatchItem[]
): string {
    const validMatches = matches.filter(m => m.hasSource);
    if (validMatches.length === 0) {
        return `[SALESHUB - XIN HÀNG TỒN KHO]\nSiêu thị: ${targetStore}\nHiện tại chưa tìm thấy mã hàng thiếu nào có siêu thị đối tác hỗ trợ.`;
    }

    let msg = `📦 [ĐỀ XUẤT XIN ĐIỀU CHUYỂN TỒN KHO]\n`;
    msg += `🏢 Siêu thị xin hàng: ${targetStore}\n`;
    msg += `📅 Ngày đề xuất: ${new Date().toLocaleDateString('vi-VN')}\n`;
    msg += `📊 Tổng số mã thiếu có nguồn: ${validMatches.length} mã\n`;
    msg += `------------------------------------\n`;

    validMatches.forEach((item, index) => {
        msg += `${index + 1}. [${item.product_code}] ${item.product_name}\n`;
        msg += `   - Cần xin: ${item.needed_qty} máy (Hiện tồn: ${item.current_qty})\n`;
        const topSources = item.source_stores.slice(0, 3).map(s => `${s.store_name} (tồn ${s.available_qty})`).join(', ');
        msg += `   - Gợi ý ST có dư: ${topSources}\n`;
    });

    msg += `------------------------------------\n`;
    msg += `Kính nhờ Quản lý khu vực & Các Siêu thị đối tác hỗ trợ điều chuyển! Trân trọng cảm ơn.`;
    return msg;
}

/**
 * Tạo nội dung tin nhắn Zalo gửi riêng cho 1 siêu thị đối tác cụ thể
 */
export function generateZaloStoreSpecificMessage(
    targetStore: string,
    sourceSupply: StoreGroupedSupply
): string {
    let msg = `📦 [XIN CHUYỂN HÀNG TỒN KHO - NỘI BỘ]\n`;
    msg += `Kính gửi: Anh/Chị Quản lý ST ${sourceSupply.store_name}\n`;
    msg += `Từ: Siêu thị ${targetStore}\n`;
    msg += `Ngày: ${new Date().toLocaleDateString('vi-VN')}\n`;
    msg += `\nDạ siêu thị em hiện đang hết hàng các mặt hàng sau và thấy siêu thị mình đang có số lượng tồn khả dụng (>= 2). Em xin phép được đề xuất xin chia sẻ điều phối ${sourceSupply.items.length} mã sau ạ:\n`;
    msg += `------------------------------------\n`;

    sourceSupply.items.forEach((item, index) => {
        msg += `${index + 1}. Mã: ${item.product_code}\n`;
        msg += `   ${item.product_name}\n`;
        msg += `   - ST mình đang có: ${item.available_qty} máy\n`;
        msg += `   - ST em xin: ${item.needed_qty} máy\n`;
    });

    msg += `------------------------------------\n`;
    msg += `Nhờ Anh/Chị xem xét hỗ trợ xuất điều chuyển giúp siêu thị em với ạ. Em xin chân thành cảm ơn!`;
    return msg;
}

/**
 * Xuất danh sách gợi ý cân tồn kho ra file Excel
 */
export async function exportRebalanceToExcel(
    targetStore: string,
    matches: RebalanceMatchItem[],
    groupedByStore: StoreGroupedSupply[],
    salesVelocityMap?: Record<string, ProductSalesVelocity>
): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SalesHub Inventory Balancing';
    workbook.created = new Date();

    const hasSales = Boolean(salesVelocityMap && Object.keys(salesVelocityMap).length > 0);

    // =========================================================================
    // SHEET 1: DANH SÁCH GỢI Ý XIN HÀNG (THEO SẢN PHẨM)
    // =========================================================================
    const ws1 = workbook.addWorksheet('Gợi Ý Xin Hàng', {
        views: [{ state: 'frozen', ySplit: 3 }]
    });

    const mergeCol1 = hasSales ? 'I1' : 'H1';
    const mergeCol2 = hasSales ? 'I2' : 'H2';

    ws1.mergeCells(`A1:${mergeCol1}`);
    const titleCell1 = ws1.getCell('A1');
    titleCell1.value = `BẢNG GỢI Ý XIN CHUYỂN TỒN KHO - ${targetStore.toUpperCase()}`;
    titleCell1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
    titleCell1.alignment = { horizontal: 'center', vertical: 'middle' };
    ws1.getRow(1).height = 28;

    ws1.mergeCells(`A2:${mergeCol2}`);
    const subCell1 = ws1.getCell('A2');
    subCell1.value = `Thời điểm xuất: ${new Date().toLocaleString('vi-VN')} | Tổng mã thiếu: ${matches.length} | Có nguồn xin: ${matches.filter(m => m.hasSource).length}${hasSales ? ' | Kèm dữ liệu sức bán' : ''}`;
    subCell1.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    subCell1.alignment = { horizontal: 'center', vertical: 'middle' };
    ws1.getRow(2).height = 18;

    const headers1 = hasSales ? [
        'STT',
        'Mã Sản Phẩm',
        'Tên Sản Phẩm',
        'Sức Bán (Máy)',
        'Ngành Hàng',
        'Nhóm Hàng',
        'Tồn Hiện Tại',
        'SL Cần Xin',
        'Các Siêu Thị Có Tồn Dư (>= 2)'
    ] : [
        'STT',
        'Mã Sản Phẩm',
        'Tên Sản Phẩm',
        'Ngành Hàng',
        'Nhóm Hàng',
        'Tồn Hiện Tại',
        'SL Cần Xin',
        'Các Siêu Thị Có Tồn Dư (>= 2)'
    ];

    const hRow1 = ws1.getRow(3);
    hRow1.values = headers1;
    hRow1.height = 24;
    hRow1.eachCell(cell => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    let rowIndex1 = 4;
    matches.forEach((m, idx) => {
        const sourcesText = m.source_stores.length > 0
            ? m.source_stores.map(s => `${s.store_name} (${s.available_qty})`).join('; ')
            : 'Chưa tìm thấy nguồn có tồn >= 2';

        const vel = hasSales ? getProductSalesVelocity(salesVelocityMap!, m.product_code) : null;
        const row = ws1.getRow(rowIndex1++);

        if (hasSales) {
            row.values = [
                idx + 1,
                m.product_code,
                m.product_name,
                vel ? vel.sales_qty : 0,
                m.category,
                m.sub_category,
                m.current_qty,
                m.needed_qty,
                sourcesText
            ];
            row.getCell(1).alignment = { horizontal: 'center' };
            row.getCell(2).alignment = { horizontal: 'center' };
            row.getCell(4).alignment = { horizontal: 'right' };
            row.getCell(4).numFmt = '#,##0';
            row.getCell(7).alignment = { horizontal: 'right' };
            row.getCell(8).alignment = { horizontal: 'right' };
        } else {
            row.values = [
                idx + 1,
                m.product_code,
                m.product_name,
                m.category,
                m.sub_category,
                m.current_qty,
                m.needed_qty,
                sourcesText
            ];
            row.getCell(1).alignment = { horizontal: 'center' };
            row.getCell(2).alignment = { horizontal: 'center' };
            row.getCell(6).alignment = { horizontal: 'right' };
            row.getCell(7).alignment = { horizontal: 'right' };
        }
    });

    ws1.columns = hasSales ? [
        { width: 6 },
        { width: 18 },
        { width: 38 },
        { width: 16 },
        { width: 18 },
        { width: 22 },
        { width: 14 },
        { width: 14 },
        { width: 50 }
    ] : [
        { width: 6 },
        { width: 18 },
        { width: 38 },
        { width: 18 },
        { width: 22 },
        { width: 14 },
        { width: 14 },
        { width: 50 }
    ];

    // =========================================================================
    // SHEET 2: THEO SIÊU THỊ ĐỐI TÁC
    // =========================================================================
    const ws2 = workbook.addWorksheet('Theo Siêu Thị Đối Tác', {
        views: [{ state: 'frozen', ySplit: 3 }]
    });

    const mergeCol2A = hasSales ? 'H1' : 'G1';
    const mergeCol2B = hasSales ? 'H2' : 'G2';

    ws2.mergeCells(`A1:${mergeCol2A}`);
    const titleCell2 = ws2.getCell('A1');
    titleCell2.value = `DANH SÁCH MÃ HÀNG CÓ THỂ XIN THEO TỪNG SIÊU THỊ ĐỐI TÁC`;
    titleCell2.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF065F46' } };
    titleCell2.alignment = { horizontal: 'center', vertical: 'middle' };
    ws2.getRow(1).height = 28;

    ws2.mergeCells(`A2:${mergeCol2B}`);
    const subCell2 = ws2.getCell('A2');
    subCell2.value = `Siêu thị nhận: ${targetStore} | Số siêu thị có thể chia sẻ: ${groupedByStore.length}${hasSales ? ' | Kèm dữ liệu sức bán' : ''}`;
    subCell2.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    subCell2.alignment = { horizontal: 'center', vertical: 'middle' };
    ws2.getRow(2).height = 18;

    const headers2 = hasSales ? [
        'STT',
        'Siêu Thị Đối Tác (Nguồn)',
        'Mã Sản Phẩm',
        'Tên Sản Phẩm',
        'Sức Bán (Máy)',
        'Ngành Hàng',
        'Tồn Khả Dụng',
        'SL Đề Xuất Xin'
    ] : [
        'STT',
        'Siêu Thị Đối Tác (Nguồn)',
        'Mã Sản Phẩm',
        'Tên Sản Phẩm',
        'Ngành Hàng',
        'Tồn Khả Dụng',
        'SL Đề Xuất Xin'
    ];

    const hRow2 = ws2.getRow(3);
    hRow2.values = headers2;
    hRow2.height = 24;
    hRow2.eachCell(cell => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    let rowIndex2 = 4;
    let stt = 1;
    groupedByStore.forEach(g => {
        g.items.forEach(item => {
            const vel = hasSales ? getProductSalesVelocity(salesVelocityMap!, item.product_code) : null;
            const row = ws2.getRow(rowIndex2++);
            if (hasSales) {
                row.values = [
                    stt++,
                    g.store_name,
                    item.product_code,
                    item.product_name,
                    vel ? vel.sales_qty : 0,
                    item.category,
                    item.available_qty,
                    item.needed_qty
                ];
                row.getCell(1).alignment = { horizontal: 'center' };
                row.getCell(3).alignment = { horizontal: 'center' };
                row.getCell(5).alignment = { horizontal: 'right' };
                row.getCell(5).numFmt = '#,##0';
                row.getCell(7).alignment = { horizontal: 'right' };
                row.getCell(8).alignment = { horizontal: 'right' };
            } else {
                row.values = [
                    stt++,
                    g.store_name,
                    item.product_code,
                    item.product_name,
                    item.category,
                    item.available_qty,
                    item.needed_qty
                ];
                row.getCell(1).alignment = { horizontal: 'center' };
                row.getCell(3).alignment = { horizontal: 'center' };
                row.getCell(6).alignment = { horizontal: 'right' };
                row.getCell(7).alignment = { horizontal: 'right' };
            }
        });
    });

    ws2.columns = hasSales ? [
        { width: 6 },
        { width: 38 },
        { width: 18 },
        { width: 38 },
        { width: 16 },
        { width: 18 },
        { width: 16 },
        { width: 16 }
    ] : [
        { width: 6 },
        { width: 38 },
        { width: 18 },
        { width: 38 },
        { width: 18 },
        { width: 16 },
        { width: 16 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Can_Ton_Kho_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Xuất file Excel danh sách xin hàng theo từng siêu thị đối tác (chuẩn 4 cột import ERP):
 * Cột 1: Mã sản phẩm
 * Cột 2: Tên sản phẩm (để trống)
 * Cột 3: IMEI (để trống)
 * Cột 4: Số lượng yêu cầu
 *
 * Tên file: "[từ khóa/all]_[tên siêu thị]_[thời gian xuất file].xlsx"
 */
export async function exportStoreTransferRequestExcel(
    sourceStoreName: string,
    items: Array<{
        product_code: string;
        product_name?: string;
        needed_qty?: number;
        suggested_qty?: number;
    }>,
    searchKeyword?: string
): Promise<string> {
    if (!items || items.length === 0) {
        throw new Error('Không có sản phẩm nào để xuất Excel!');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SalesHub Inventory Balancing';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Danh Sách Xin Hàng', {
        views: [{ state: 'frozen', ySplit: 1 }]
    });

    // 4 Cột chuẩn theo yêu cầu: Mã sản phẩm, Tên sản phẩm, IMEI, Số lượng yêu cầu
    worksheet.columns = [
        { header: 'Mã sản phẩm', key: 'product_code', width: 20 },
        { header: 'Tên sản phẩm', key: 'product_name', width: 35 },
        { header: 'IMEI', key: 'imei', width: 22 },
        { header: 'Số lượng yêu cầu', key: 'request_qty', width: 20 }
    ];

    // Định dạng Header
    const headerRow = worksheet.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell(cell => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }; // Blue 800
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF94A3B8' } },
            left: { style: 'thin', color: { argb: 'FF94A3B8' } },
            bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
            right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
    });

    // Ghi dữ liệu: Cột 1 (Mã sản phẩm), Cột 2 (Tên sản phẩm), Cột 3 (IMEI - ĐỂ TRỐNG), Cột 4 (Số lượng yêu cầu)
    items.forEach(item => {
        const qty = item.suggested_qty ?? item.needed_qty ?? 1;
        const row = worksheet.addRow({
            product_code: String(item.product_code || '').trim(),
            product_name: String(item.product_name || '').trim(),
            imei: '', // ĐỂ TRỐNG CỘT 3 THEO QUY ĐỊNH
            request_qty: Number(qty) || 1
        });

        row.height = 20;

        // Căn lề & định dạng
        const cellCode = row.getCell(1);
        cellCode.alignment = { horizontal: 'center', vertical: 'middle' };
        cellCode.numFmt = '@';

        const cellName = row.getCell(2);
        cellName.alignment = { horizontal: 'left', vertical: 'middle' };

        const cellImei = row.getCell(3);
        cellImei.alignment = { horizontal: 'center', vertical: 'middle' };

        const cellQty = row.getCell(4);
        cellQty.alignment = { horizontal: 'right', vertical: 'middle' };
        cellQty.numFmt = '#,##0';
        cellQty.font = { name: 'Calibri', size: 11, bold: true };

        row.eachCell(cell => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });
    });

    // Tạo tên file: "[từ khóa/all]_[tên siêu thị]_[thời gian xuất file].xlsx"
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

    // Khử ký tự không hợp lệ trong tên file
    const sanitize = (str: string) => str.replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();

    const prefix = searchKeyword && searchKeyword.trim() ? sanitize(searchKeyword.trim()) : 'all';
    const storePart = sanitize(sourceStoreName || 'sieu_thi');
    const fileName = `${prefix}_${storePart}_${timeStr}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return fileName;
}

export interface ParseSalesVelocityResult {
    salesMap: Record<string, ProductSalesVelocity>;
    totalRecords: number;
    matchedRecords: number;
    uniqueProductsCount: number;
    totalSalesQty: number;
    fileName?: string;
}

/**
 * Tìm kiếm thông tin sức bán của sản phẩm theo mã sản phẩm (hỗ trợ mã chuẩn và mã không/có số 0 đầu chuỗi)
 */
export function getProductSalesVelocity(
    salesMap: Record<string, ProductSalesVelocity> | undefined,
    productCode: string
): ProductSalesVelocity | null {
    if (!salesMap || !productCode) return null;
    const clean = String(productCode).trim();
    if (salesMap[clean]) return salesMap[clean];

    // Đối chiếu không có số 0 ở đầu
    const noLeadingZeros = clean.replace(/^0+/, '');
    if (noLeadingZeros && salesMap[noLeadingZeros]) return salesMap[noLeadingZeros];

    // Đối chiếu có 1 số 0 ở đầu
    const withZero = '0' + noLeadingZeros;
    if (salesMap[withZero]) return salesMap[withZero];

    return null;
}

/**
 * Đọc file Excel phân tích sức bán sản phẩm
 * Quy tắc tính sức bán:
 * - Cột AF (col 32): Mã sản phẩm
 * - Cột AG (col 33): Tên sản phẩm
 * - Cột AJ (col 36): Số lượng (tính số tổng theo cột AJ)
 * - Cột N (col 14): 'Đã xuất'
 * - Cột AS (col 45): 'Chưa trả'
 */
export async function parseSalesVelocityExcel(file: File): Promise<ParseSalesVelocityResult> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    let worksheet = workbook.worksheets[0];
    for (const ws of workbook.worksheets) {
        if (ws.rowCount > (worksheet?.rowCount || 0)) {
            worksheet = ws;
        }
    }

    if (!worksheet || worksheet.rowCount < 2) {
        throw new Error('File Excel rỗng hoặc không có dữ liệu!');
    }

    // Tự động kiểm tra vị trí cột trong header (mặc định theo thứ tự chuẩn AF=32, AG=33, AJ=36, N=14, AS=45)
    let colExport = 14;   // Cột N: Trạng thái xuất
    let colCode = 32;     // Cột AF: Mã sản phẩm
    let colName = 33;     // Cột AG: Tên sản phẩm
    let colQty = 36;      // Cột AJ: Số lượng
    let colReturn = 45;   // Cột AS: Tình trạng nhập trả

    let headerRow = 1;
    // Quét 5 dòng đầu để xác định chính xác dòng tiêu đề nếu file có header lùi
    for (let r = 1; r <= Math.min(5, worksheet.rowCount); r++) {
        const row = worksheet.getRow(r);
        let foundCode = false;
        let foundExport = false;
        row.eachCell((cell, colNumber) => {
            const val = normalizeSearchStr(getCellValueAsString(cell.value));
            if (val.includes('ma san pham') || val.includes('ma sp')) {
                colCode = colNumber;
                foundCode = true;
            } else if (val.includes('ten san pham') || val.includes('ten sp')) {
                colName = colNumber;
            } else if (val === 'so luong' || val.includes('so luong')) {
                colQty = colNumber;
            } else if (val.includes('trang thai xuat')) {
                colExport = colNumber;
                foundExport = true;
            } else if (val.includes('nhap tra') || val.includes('tinh trang nhap tra')) {
                colReturn = colNumber;
            }
        });
        if (foundCode || foundExport) {
            headerRow = r;
            break;
        }
    }

    const salesMap: Record<string, ProductSalesVelocity> = {};
    let totalRecords = 0;
    let matchedRecords = 0;
    let totalSalesQty = 0;

    for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        totalRecords++;

        const statusExport = getCellValueAsString(row.getCell(colExport).value);
        const productCodeRaw = getCellValueAsString(row.getCell(colCode).value);
        const productName = getCellValueAsString(row.getCell(colName).value);
        const qtyRaw = getCellValueAsNumber(row.getCell(colQty).value);
        const statusReturn = getCellValueAsString(row.getCell(colReturn).value);

        if (!productCodeRaw) continue;

        // Điều kiện: Cột N='Đã xuất' & Cột AS='Chưa trả'
        const normExport = normalizeSearchStr(statusExport);
        const isExported = normExport === 'da xuat' || normExport.includes('da xuat');

        const normReturn = normalizeSearchStr(statusReturn);
        const isNotReturned = normReturn === 'chua tra' || normReturn.includes('chua tra');

        if (isExported && isNotReturned) {
            matchedRecords++;
            const qty = Math.max(0, qtyRaw);
            totalSalesQty += qty;

            const cleanCode = productCodeRaw.trim();
            if (!salesMap[cleanCode]) {
                salesMap[cleanCode] = {
                    product_code: cleanCode,
                    product_name: productName || '',
                    sales_qty: qty,
                    order_count: 1
                };
            } else {
                salesMap[cleanCode].sales_qty += qty;
                salesMap[cleanCode].order_count = (salesMap[cleanCode].order_count || 1) + 1;
                if (!salesMap[cleanCode].product_name && productName) {
                    salesMap[cleanCode].product_name = productName;
                }
            }
        }
    }

    const uniqueProductsCount = Object.keys(salesMap).length;

    return {
        salesMap,
        totalRecords,
        matchedRecords,
        uniqueProductsCount,
        totalSalesQty,
        fileName: file.name
    };
}
