import { cleanEmployeeName } from '../../../core/lib/formatters';
import type { EmployeeItem } from '../../../core/lib/storage';

/**
 * Chuẩn hóa giá trị phần trăm từ OCR (vd: "60.48%", "0%", "- 5.2%")
 */
export function cleanBiPercent(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') {
        return isNaN(val) ? 0 : Number(val.toFixed(2));
    }
    const cleaned = String(val)
        .replace(/\s+/g, '')
        .replace(/%/g, '')
        .replace(/\+/g, '')
        .replace(/,/g, '')
        .trim();
    if (!cleaned || cleaned === '—' || cleaned === '-' || cleaned === '–') return 0;
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Number(num.toFixed(2));
}

/**
 * Chuẩn hóa số giờ công trích xuất từ OCR (ví dụ: "101.0" -> 101, "94.5" -> 94.5, "94,5" -> 94.5)
 */
export function cleanWorkHoursValue(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') {
        if (!Number.isFinite(val) || val < 0) return 0;
        return Math.round(val * 100) / 100;
    }

    let cleaned = String(val)
        .replace(/giờ|gio|h/gi, '')
        .replace(/\s+/g, '')
        .trim();
    if (!cleaned || cleaned === '—' || cleaned === '-' || cleaned === '–') return 0;

    if (cleaned.includes(',') && cleaned.includes('.')) {
        cleaned = cleaned.replace(/,/g, '');
    } else if (cleaned.includes(',')) {
        const commaParts = cleaned.split(',');
        if (commaParts.length === 2 && commaParts[1].length <= 2) {
            cleaned = `${commaParts[0]}.${commaParts[1]}`;
        } else {
            cleaned = cleaned.replace(/,/g, '');
        }
    }

    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 0) return 0;
    return Math.round(num * 100) / 100;
}

/**
 * Chuẩn hóa họ tên tiếng Việt để đối chiếu ảnh không có Mã NV ("Báo cáo trả chậm", "Thi đua")
 */
export function normalizeViName(name: string, stripDiacritics = false): string {
    let s = (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (stripDiacritics) {
        s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    }
    return s;
}

/**
 * Prompt bóc tách DOANH THU QĐ & DT TRẢ GÓP QĐ theo nhân viên (chế độ Lưới trên BI Mobile).
 * Khi `includeDailyColumns` = true (báo cáo ngày), đọc thêm `SỐ LƯỢNG`, `DT QĐ KHOẢN VAY`, `DT NHẬP TRẢ QĐ` nếu xuất hiện trên ảnh.
 */
export function buildRevenueQdOcrPrompt(options?: { includeDailyColumns?: boolean }): string {
    const includeDaily = Boolean(options?.includeDailyColumns);

    const metricsInstructions = includeDaily
        ? `3. CHỈ trích xuất từng chỉ số dưới đây khi CỘT CỦA NÓ HIỂN THỊ ĐẦY ĐỦ SỐ LIỆU trong ảnh (dấu phẩy ',' là phân cách hàng nghìn, giữ nguyên số âm nếu có như -9):
   - revenueQd: Giá trị thuộc đúng cột "DOANH THU QĐ" (hoặc tiêu đề bị che 1 phần như "...ANH THU QĐ"). Nếu cột không có hoặc bị che mất số, trả về null.
   - installmentQd: Giá trị thuộc đúng cột "DT TRẢ GÓP QĐ". TUYỆT ĐỐI KHÔNG lấy nhầm cột "DT TRẢ THẲNG QĐ", "DT QĐ KHOẢN VAY", hay "DT NHẬP TRẢ QĐ". Nếu cột không có hoặc bị cắt mất chữ số ở mép phải, trả về null.
   - quantity: Giá trị thuộc đúng cột "SỐ LƯỢNG" (nếu cột hiển thị trong ảnh, ngược lại trả về null).
   - loanQd: Giá trị thuộc đúng cột "DT QĐ KHOẢN VAY" (nếu cột hiển thị đầy đủ trong ảnh, ngược lại trả về null).
   - returnQd: Giá trị thuộc đúng cột "DT NHẬP TRẢ QĐ" (nếu cột hiển thị đầy đủ trong ảnh, ngược lại trả về null).`
        : `3. CHỈ trích xuất 2 chỉ số sau khi cột của nó HIỂN THỊ ĐẦY ĐỦ SỐ LIỆU trong ảnh (dấu phẩy ',' là phân cách hàng nghìn, giữ nguyên đơn vị triệu đồng):
   - revenueQd: Giá trị thuộc đúng cột "DOANH THU QĐ" (hoặc tiêu đề bị che 1 phần như "...ANH THU QĐ"). TUYỆT ĐỐI KHÔNG lấy nhầm cột "SỐ LƯỢNG", "DT QĐ KHOẢN VAY", "DT TRẢ THẲNG QĐ", hay "DT NHẬP TRẢ QĐ". Nếu cột "DOANH THU QĐ" không có trong ảnh hoặc bị che mất số, trả về null.
   - installmentQd: Giá trị thuộc đúng cột "DT TRẢ GÓP QĐ". TUYỆT ĐỐI KHÔNG lấy nhầm cột "DT TRẢ THẲNG QĐ", "DT QĐ KHOẢN VAY", hay "DT NHẬP TRẢ QĐ". Nếu cột "DT TRẢ GÓP QĐ" không có trong ảnh hoặc bị cắt mất chữ số ở mép phải (chỉ thấy 1 phần mép trái của cột), trả về null.`;

    const jsonSchemaFields = includeDaily
        ? `      "employeeId": string,
      "fullName": string,
      "quantity": number | null,
      "revenueQd": number | null,
      "installmentQd": number | null,
      "loanQd": number | null,
      "returnQd": number | null`
        : `      "employeeId": string,
      "fullName": string,
      "revenueQd": number | null,
      "installmentQd": number | null`;

    return `
Bạn là chuyên gia phân tích dữ liệu kinh doanh bán lẻ từ ảnh chụp màn hình ứng dụng BI ("Doanh thu hợp nhất" - chế độ Lưới theo nhân viên).

CẤU TRÚC BẢNG TRÊN ẢNH:
- Cột cố định bên trái: "NHÂN VIÊN / NGÀNH HÀNG BI / NHÓM HÀNG BI" chứa Họ tên nhân viên và dòng mã nhân viên bên dưới (ví dụ: "Vương Trà Mi" / "id: 245449", "Phan Đình Đức" / "id: 187590").
- Các cột số liệu bên phải có thể xuất hiện tùy vị trí cuộn ngang:
  "SỐ LƯỢNG" | "DOANH THU QĐ" (hoặc bị che một phần chữ đầu thành "...ANH THU QĐ") | "DT QĐ KHOẢN VAY" | "DT TRẢ THẲNG QĐ" | "DT TRẢ GÓP QĐ" | "DT NHẬP TRẢ QĐ".

YÊU CẦU TRÍCH XUẤT BẮT BUỘC:
1. BỎ QUA HOÀN TOÀN các chữ mờ watermark in chéo trên ảnh ("26479 - Đào Bá Linh",...), dòng "Tổng", và dòng "online - Online - 18001060".
2. Nhận diện TẤT CẢ nhân viên xuất hiện trong ảnh qua:
   - employeeId: Mã số sau chữ "id:" (ví dụ: "id: 245449" -> "245449").
   - fullName: Họ và tên đầy đủ phía trên "id:" (ghép lại nếu tên xuống 2 dòng, ví dụ "Nguyễn Thị Diệu Trâm").
${metricsInstructions}
4. THỜI GIAN CHỤP: Nếu thấy dòng "Cập nhật lúc: HH:mm:ss DD/MM/YYYY" ở phía trên ảnh, trích xuất vào "screenshotTimestamp".

Trả về DUY NHẤT một khối JSON thuần:
{
  "screenshotTimestamp": string | null,
  "employees": [
    {
${jsonSchemaFields}
    }
  ]
}
Chỉ trả về JSON thuần, không bọc markdown \`\`\`json.
`;
}

/**
 * Prompt chuyên biệt cho trích xuất ẢNH "% TỶ TRỌNG TRẢ GÓP" ("Báo cáo trả chậm")
 */
export function buildInstallmentRateOcrPrompt(): string {
    return `
Bạn là chuyên gia phân tích dữ liệu kinh doanh bán lẻ từ ảnh chụp màn hình ứng dụng BI ("Báo cáo trả chậm").

CẤU TRÚC ẢNH MẪU:
- Tiêu đề: "Báo cáo trả chậm", có dòng "Cập nhật lúc: HH:mm:ss DD/MM/YYYY" ở góc trên bên phải.
- Bảng dữ liệu gồm cột "Nhân viên" (chỉ hiển thị họ tên đầy đủ như "Trần Thị Tuyết Nga", "Nguyễn Thị Hồng Phúc", "Lâm Mỹ Huệ",..., "Nguyễn Thị Kim Anh"; không có Mã NV) và cột "Tỷ trọng trả chậm %" (ví dụ: "60.48%", "50.98%", "48.2%", "0%").

YÊU CẦU TRÍCH XUẤT BẮT BUỘC:
1. BỎ QUA HOÀN TOÀN các chữ mờ watermark in chéo trên ảnh ("26479 - Đào Bá Linh",...), dòng "Tổng", dòng phân trang ("1-15 / Tổng 15 dòng").
2. Trích xuất TẤT CẢ các dòng nhân viên trong bảng:
   - employeeId: null (hoặc mã NV nếu ảnh có hiển thị)
   - fullName: Họ và tên chính xác ở cột "Nhân viên"
   - installmentRate: Số phần trăm ở cột "Tỷ trọng trả chậm %" (bỏ dấu %, giữ nguyên thập phân, ví dụ "60.48%" -> 60.48, "48.2%" -> 48.2, "0%" -> 0).
3. THỜI GIAN CHỤP: Trích xuất dòng "Cập nhật lúc: HH:mm:ss DD/MM/YYYY" vào "screenshotTimestamp" nếu có.

Trả về DUY NHẤT một khối JSON thuần:
{
  "screenshotTimestamp": string | null,
  "employees": [
    {
      "employeeId": string | null,
      "fullName": string,
      "installmentRate": number
    }
  ]
}
Chỉ trả về JSON thuần, không bọc markdown \`\`\`json.
`;
}

/**
 * Tìm nhân viên khớp duy nhất theo họ tên trong một danh sách ứng viên đã trích xuất trước đó
 */
export function findMatchedCandidateByName<T extends { fullName: string; isUnmappedName?: boolean }>(
    rawName: string,
    candidates: T[]
): { item: T; mode: 'NAME_EXACT' | 'NAME_FUZZY' } | null {
    const name = String(rawName || '').trim();
    if (!name) return null;

    const normExact = normalizeViName(name, false);
    const normNoAccent = normalizeViName(name, true);
    const eligible = candidates.filter(c => !c.isUnmappedName);

    const exact = eligible.find(item => normalizeViName(item.fullName, false) === normExact);
    if (exact) {
        return { item: exact, mode: 'NAME_EXACT' };
    }

    const noAccentMatches = eligible.filter(item => normalizeViName(item.fullName, true) === normNoAccent);
    if (noAccentMatches.length === 1) {
        return { item: noAccentMatches[0], mode: 'NAME_FUZZY' };
    }

    if (name.endsWith('...') || name.endsWith('…')) {
        const prefixNoAccent = normalizeViName(name.replace(/(\.\.\.|…)+$/g, ''), true);
        if (prefixNoAccent.length >= 6) {
            const prefixMatches = eligible.filter(item =>
                normalizeViName(item.fullName, true).startsWith(prefixNoAccent)
            );
            if (prefixMatches.length === 1) {
                return { item: prefixMatches[0], mode: 'NAME_FUZZY' };
            }
        }
    }

    return null;
}

/**
 * Tìm nhân viên khớp duy nhất theo họ tên trong danh bạ nhân sự ST (`EmployeeItem[]`)
 */
export function findDirectoryEmployeeByName(
    rawName: string,
    directory: EmployeeItem[]
): { emp: EmployeeItem; mode: 'NAME_EXACT' | 'NAME_FUZZY' } | null {
    const name = String(rawName || '').trim();
    if (!name || directory.length === 0) return null;

    const normExact = normalizeViName(name, false);
    const normNoAccent = normalizeViName(name, true);

    const exactMatches = directory.filter(se => {
        const full = normalizeViName(se.full_name || '', false);
        const cleaned = normalizeViName(cleanEmployeeName(se.full_name || ''), false);
        return full === normExact || cleaned === normExact;
    });
    if (exactMatches.length === 1) {
        return { emp: exactMatches[0], mode: 'NAME_EXACT' };
    }

    const noAccentMatches = directory.filter(se => {
        const full = normalizeViName(se.full_name || '', true);
        const cleaned = normalizeViName(cleanEmployeeName(se.full_name || ''), true);
        return full === normNoAccent || cleaned === normNoAccent;
    });
    if (noAccentMatches.length === 1) {
        return { emp: noAccentMatches[0], mode: 'NAME_FUZZY' };
    }

    if (name.endsWith('...') || name.endsWith('…')) {
        const prefixNoAccent = normalizeViName(name.replace(/(\.\.\.|…)+$/g, ''), true);
        if (prefixNoAccent.length >= 6) {
            const prefixMatches = directory.filter(se => {
                const cleaned = normalizeViName(cleanEmployeeName(se.full_name || ''), true);
                return cleaned.startsWith(prefixNoAccent);
            });
            if (prefixMatches.length === 1) {
                return { emp: prefixMatches[0], mode: 'NAME_FUZZY' };
            }
        }
    }

    return null;
}

/**
 * Prompt chuyên biệt cho trích xuất ẢNH "GIỜ CÔNG NHÂN VIÊN"
 * (Ứng dụng BI -> "Doanh thu hợp nhất" -> chế độ Lưới -> tab "Theo giờ công")
 */
export function buildWorkHoursOcrPrompt(): string {
    return `
Bạn là chuyên gia phân tích dữ liệu nhân sự bán lẻ từ ảnh chụp màn hình ứng dụng BI ("Doanh thu hợp nhất" - chế độ "Lưới" + "Theo giờ công").

CẤU TRÚC BẢNG TRÊN ẢNH:
- Tiêu đề bảng gồm đúng 3 cột:
  1) "NHÂN VIÊN": Gồm 3 dòng trên mỗi ô:
     - Dòng 1 (chữ xanh dương): Họ và tên nhân viên (ví dụ: "Nguyễn Thị Diễm Mi", "Vũ Trọng Khiêm", "Đào Bá Linh").
     - Dòng 2 (chữ xám): "id: <mã nhân viên>" (ví dụ: "id: 44213", "id: 105851", "id: 26479").
     - Dòng 3 (chữ xám): "ST làm việc: <mã ST>" (ví dụ: "ST làm việc: 111"). KHÔNG lấy mã ST làm employeeId hay giờ công.
  2) "GIỜ CÔNG TẠI ST LÀM VIỆC": Số thập phân (ví dụ: 101.0, 99.9, 94.5, 86.0, 3.0). ĐÂY LÀ GIÁ TRỊ CẦN LẤY VÀO "workHours".
  3) "GIỜ CÔNG HỖ TRỢ ST KHÁC": Số thập phân (ví dụ: 0.0, 12.9, 10.0, 12.5, 9.5). TUYỆT ĐỐI KHÔNG lấy cột này và KHÔNG cộng dồn vào "workHours".

QUY TẮC TRÍCH XUẤT BẮT BUỘC:
1. BỎ QUA HOÀN TOÀN các chữ mờ watermark in chéo trên ảnh (ví dụ: "26479 Đào Bá Linh"), dòng "Tổng", thanh phân trang ("1-16 / Tổng 16 dòng"), và dòng "Đơn vị: giờ". Lưu ý không nhầm watermark với dữ liệu thật, nhưng vẫn phải trích xuất bình thường nếu nhân viên đó xuất hiện trong một dòng bảng chính thức có "id:" và cột số liệu rõ ràng.
2. XỬ LÝ DÒNG BỊ CẮT Ở MÉP TRÊN / MÉP DƯỚI KHI CUỘN MÀN HÌNH:
   - Nếu một dòng ở mép trên hoặc mép dưới bị cắt mất số ở cột "GIỜ CÔNG TẠI ST LÀM VIỆC" hoặc mất cả "id:" lẫn tên -> BỎ QUA DÒNG ĐÓ (hoặc trả về "workHours": null), tuyệt đối không tự điền 0.
   - Nếu dòng ở mép trên bị che mất tên nhưng vẫn đọc rõ ràng cả "id: <mã NV>" VÀ số ở cột "GIỜ CÔNG TẠI ST LÀM VIỆC" -> giữ nguyên "employeeId" và "workHours" tương ứng.
3. Với mỗi dòng hợp lệ:
   - employeeId: Chỉ lấy phần số sau chữ "id:" (ví dụ: "id: 265379" -> "265379"). Trả null nếu không thấy "id:".
   - fullName: Họ và tên đầy đủ ở dòng 1 cột "NHÂN VIÊN" (hoặc "" nếu phần tên bị cắt ở mép trên nhưng có "id:").
   - workHours: ĐÚNG giá trị ở cột "GIỜ CÔNG TẠI ST LÀM VIỆC" (giữ đúng dấu thập phân, ví dụ 94.5 -> 94.5, 101.0 -> 101.0).
4. THỜI GIAN CHỤP: Nếu thấy "Cập nhật lúc: HH:mm:ss DD/MM/YYYY" ở phía trên ảnh, trích xuất vào "screenshotTimestamp".

Trả về DUY NHẤT một khối JSON thuần:
{
  "screenshotTimestamp": string | null,
  "employees": [
    {
      "employeeId": string | null,
      "fullName": string,
      "workHours": number | null
    }
  ]
}
Chỉ trả về JSON thuần, không bọc markdown \`\`\`json.
`;
}

