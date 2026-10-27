/**
 * Bộ giải mã cú pháp (Parser) cho dữ liệu nhân viên bóc tách từ báo cáo
 */

export interface ParsedEmployeeRevenue {
    employee_id: string;
    full_name: string;
    quantity: number;
    revenue_qd: number;       // Doanh thu quy đổi (Triệu đồng)
    revenue_actual: number;   // Doanh thu thực (Triệu đồng)
    installment_revenue: number; // DT trả góp
    installment_rate: number;    // % trả góp
    revenue_return_qd?: number;  // DTQĐ Nhập trả (Triệu đồng)
    revenue_loan_qd?: number;    // DTQĐ Khoản vay (Triệu đồng)
}

export interface ParsedCampaignBlock {
    campaign_name: string;
    unit_type: 'DOANH THU' | 'SỐ LƯỢNG';
    employee_values: Record<string, number>; // { [empId]: number }
}

export interface WorkShiftLog {
    date: string;
    store_name: string;
    employee_id: string;
    full_name: string;
    department?: string;
    job_title?: string;
    shift_name: string;
    hours: number;
}

export interface ParsedWorkHoursResult {
    total_hours_by_emp: Record<string, number>; // { [empId]: number }
    shift_logs: WorkShiftLog[];
    unique_shift_count: number;
}

/**
 * Bóc tách tên Siêu thị từ chuỗi văn bản thô (nếu người dùng copy toàn bộ màn hình Dashboard)
 */
export function detectStoreFromRawText(rawText: string): string | null {
    if (!rawText || !rawText.trim()) return null;
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
        // Cách 1: Nằm sau chữ "Siêu thị"
        if (lines[i].toLowerCase() === 'siêu thị' && i + 1 < lines.length) {
            const nextL = lines[i + 1].replace(/[×x]/g, '').trim();
            if (nextL.includes(' - ') && !nextL.toLowerCase().includes('quỹ thời gian')) {
                return nextL;
            }
        }
        // Cách 2: Dòng trực tiếp có dạng mã siêu thị [10335 - AAR_BRV_VTA - 290 Trương Công Định]
        const l = lines[i];
        if (/^\d{3,6}\s*-\s*[A-Z0-9_]{3,}/i.test(l)) {
            const parts = l.split(' - ');
            if (parts.length >= 2) {
                const brandPart = parts[1].trim().toUpperCase();
                if (
                    brandPart.startsWith('AAR_') ||
                    brandPart.startsWith('TGD_') ||
                    brandPart.startsWith('DMX_') ||
                    brandPart.startsWith('BHX_') ||
                    brandPart.startsWith('AVA_') ||
                    brandPart.startsWith('TOP_') ||
                    brandPart.startsWith('ĐMX') ||
                    brandPart.startsWith('TGDĐ') ||
                    parts.length >= 3
                ) {
                    return l;
                }
            }
        }
    }
    return null;
}

/**
 * 1. BÓC TÁCH DOANH THU NHÂN VIÊN (Raw Data Parsing & Extraction)
 * Hỗ trợ:
 * 1. Định dạng mới tách rời 2 bảng độc lập: "Bảng Doanh thu quy đổi (DTQĐ)" và "Bảng Doanh thu thực".
 * 2. Định dạng cũ gộp chung 8 cột hoặc 10 cột trong cùng 1 bảng.
 * 3. Tự động tính toán % Trả góp = (DT Trả góp thực / DT Thực) * 100 khi có bảng Doanh thu thực.
 */

// Hàm kiểm tra dòng tiêu đề siêu thị để không bị bóc nhầm thành nhân viên
function isStoreHeader(str: string): boolean {
    if (/^\d{3,6}\s*-\s*[A-Z0-9_]{3,}/i.test(str)) {
        const parts = str.split(' - ');
        if (parts.length >= 2) {
            const brandPart = parts[1].trim().toUpperCase();
            if (
                brandPart.startsWith('AAR_') ||
                brandPart.startsWith('TGD_') ||
                brandPart.startsWith('DMX_') ||
                brandPart.startsWith('BHX_') ||
                brandPart.startsWith('AVA_') ||
                brandPart.startsWith('TOP_') ||
                brandPart.startsWith('ĐMX') ||
                brandPart.startsWith('TGDĐ') ||
                parts.length >= 3
            ) {
                return true;
            }
        }
    }
    return false;
}

// Hàm nhận diện dòng nhân viên: "Mã NV - Họ và Tên"
function extractEmployeeInfo(str: string): { empId: string; fullName: string } | null {
    if (isStoreHeader(str)) return null;
    // Mã nhân viên không được bắt đầu bằng dấu trừ '-'
    const m = str.match(/^([a-zA-Z0-9_.]+)\s*-\s*([^\t\r\n]+)$/);
    if (m && m[1].toLowerCase() !== 'online' && !m[1].startsWith('-')) {
        const name = m[2].trim();
        // Tên nhân viên phải chứa ký tự chữ cái (tránh nhận nhầm biểu thức toán/số âm)
        if (/[a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9]/.test(name)) {
            return { empId: m[1].trim(), fullName: name };
        }
    }
    return null;
}

/**
 * Bóc tách dữ liệu từ 1 bảng đơn lẻ (QD hoặc REAL hoặc Legacy)
 */
export function parseSingleEmployeeRevenueTable(
    text: string,
    forceType?: 'QD' | 'REAL'
): ParsedEmployeeRevenue[] {
    if (!text || !text.trim()) return [];

    let isQdTable = forceType === 'QD';
    let isRealTable = forceType === 'REAL';

    if (!forceType) {
        isQdTable = /(doanh thu qđ|dt trả góp qđ|dt trả thẳng qđ|dt qđ khoản vay|khoản vay)/i.test(text);
        isRealTable = /(dt trả góp|dt trả thẳng)/i.test(text) && !isQdTable;
    }

    const IGNORE_KEYWORDS = [
        'nhân viên',
        'số lượng',
        'doanh thu qđ',
        'dt qđ khoản vay',
        'khoản vay',
        'khoan vay',
        'dt trả thẳng qđ',
        'dt trả thẳng',
        'dt trả góp qđ',
        '% tỉ trọng',
        'doanh thu',
        'target',
        '% ht target',
        'tb 3 tháng',
        '% tt',
        'dt trả góp',
        '% trả góp',
        'dt nhập trả qđ',
        'dt nhập trả',
        'dt nhập trả quy đổi',
        'doanh thu nhập trả',
        'nhập trả',
        'tổng',
        'đơn vị:',
        'tỉ trọng tính',
        'tỉ trọng',
        'tăng trưởng',
        'dự kiến',
        'off / onl',
        'tổng hợp',
        'ngành hàng bi',
        'chi tiết chi phí',
        'thi đua',
        'doanh thu theo cấp'
    ];

    // 1. Quét tìm dòng tiêu đề bảng để xác định chính xác vị trí các cột
    let headerColMap: {
        qtyColIdx: number;
        revQdColIdx: number;
        revRealColIdx: number;
        revGenericColIdx: number;
        loanColIdx: number;
        directColIdx: number;
        installmentColIdx: number;
        installmentRateColIdx: number;
        returnColIdx: number;
        pctShareColIdx: number;
    } | null = null;

    let detectedReturnColIdx = -1;

    for (const rawL of text.split(/\r?\n/)) {
        const trimmedL = rawL.trim();
        if (!trimmedL) continue;
        const lowerL = trimmedL.toLowerCase();

        // Kiểm tra dòng tiêu đề chứa Nhân Viên và các trường số liệu
        if (
            (lowerL.includes('nhân viên') || lowerL.includes('nhan vien')) &&
            (lowerL.includes('doanh thu') || lowerL.includes('số lượng') || lowerL.includes('tỉ trọng') || lowerL.includes('ti trong'))
        ) {
            const parts = trimmedL.split(/\t+|\s{2,}/).map(p => p.trim());
            const empIdx = parts.findIndex(p => /nhân viên|nhan vien/i.test(p));
            if (empIdx >= 0 && parts.length >= 4) {
                const hCols = parts.slice(empIdx + 1);
                headerColMap = {
                    qtyColIdx: hCols.findIndex(p => /số lượng|so luong|qty/i.test(p)),
                    revQdColIdx: hCols.findIndex(p => /doanh thu qđ|dt qđ|doanh thu quy đổi|dt quy đổi/i.test(p)),
                    revRealColIdx: hCols.findIndex(p => /doanh thu thực|dt thực/i.test(p)),
                    revGenericColIdx: hCols.findIndex(p => /^doanh thu$/i.test(p.trim()) || (/doanh thu/i.test(p) && !/qđ|quy đổi|thực|khoản vay|trả thẳng|trả góp|nhập trả/i.test(p))),
                    loanColIdx: hCols.findIndex(p => /khoản vay|khoan vay/i.test(p)),
                    directColIdx: hCols.findIndex(p => /trả thẳng|tra thang/i.test(p)),
                    installmentColIdx: hCols.findIndex(p => /trả góp|tra gop/i.test(p) && !/tỷ lệ|tỉ lệ|%/i.test(p)),
                    installmentRateColIdx: hCols.findIndex(p => (/trả góp|tra gop/i.test(p) && /tỷ lệ|tỉ lệ|%/i.test(p)) || /% tg|%tg/i.test(p)),
                    returnColIdx: hCols.findIndex(p => /nhập trả|nhap tra/i.test(p)),
                    pctShareColIdx: hCols.findIndex(p => /tỉ trọng|ti trong/i.test(p))
                };
                if (headerColMap.returnColIdx >= 0) {
                    detectedReturnColIdx = headerColMap.returnColIdx;
                }
                // Nếu tiêu đề có DTQĐ hoặc Khoản vay thì xác định rõ bảng QD
                if (!forceType) {
                    if (headerColMap.revQdColIdx >= 0 || headerColMap.loanColIdx >= 0) {
                        isQdTable = true;
                        isRealTable = false;
                    } else if (headerColMap.revRealColIdx >= 0 || (headerColMap.installmentColIdx >= 0 && headerColMap.revQdColIdx < 0)) {
                        isRealTable = true;
                        isQdTable = false;
                    }
                }
                break;
            }
        }
    }

    const cleanLines = text.split(/\r?\n/)
        .map(l => l.trim())
        .filter(line => {
            const lower = line.toLowerCase();
            if (
                lower.startsWith('tổng') ||
                lower.startsWith('đơn vị:') ||
                lower.startsWith('tỉ trọng tính') ||
                lower.includes('/ trang') ||
                /^\d+-\d+\s*\/\s*tổng/.test(lower) ||
                isStoreHeader(line)
            ) {
                return false;
            }
            if (lower.includes('nhân viên') && (lower.includes('số lượng') || lower.includes('doanh thu'))) {
                return false;
            }
            return !IGNORE_KEYWORDS.some(kw => lower === kw);
        });

    const results: ParsedEmployeeRevenue[] = [];

    const addOrUpdateResult = (
        empInfo: { empId: string; fullName: string },
        metrics: {
            quantity: number;
            revenue_qd: number;
            revenue_actual: number;
            installment_revenue: number;
            installment_rate: number;
            revenue_return_qd?: number;
            revenue_loan_qd?: number;
        }
    ) => {
        const existingIdx = results.findIndex(r => r.employee_id === empInfo.empId);
        if (existingIdx >= 0) {
            results[existingIdx].quantity += metrics.quantity;
            results[existingIdx].revenue_qd = Number((results[existingIdx].revenue_qd + metrics.revenue_qd).toFixed(2));
            results[existingIdx].revenue_actual = Number((results[existingIdx].revenue_actual + metrics.revenue_actual).toFixed(2));
            results[existingIdx].installment_revenue = Number((results[existingIdx].installment_revenue + metrics.installment_revenue).toFixed(2));
            if (metrics.revenue_return_qd !== undefined) {
                results[existingIdx].revenue_return_qd = Number(((results[existingIdx].revenue_return_qd || 0) + metrics.revenue_return_qd).toFixed(2));
            }
            if (metrics.revenue_loan_qd !== undefined) {
                results[existingIdx].revenue_loan_qd = Number(((results[existingIdx].revenue_loan_qd || 0) + metrics.revenue_loan_qd).toFixed(2));
            }
            if (results[existingIdx].revenue_actual > 0 && isRealTable) {
                results[existingIdx].installment_rate = Number(((results[existingIdx].installment_revenue / results[existingIdx].revenue_actual) * 100).toFixed(1));
            }
        } else {
            results.push({
                employee_id: empInfo.empId,
                full_name: empInfo.fullName,
                ...metrics,
                revenue_return_qd: metrics.revenue_return_qd || 0,
                revenue_loan_qd: metrics.revenue_loan_qd || 0
            });
        }
    };

    for (let i = 0; i < cleanLines.length; i++) {
        const line = cleanLines[i];
        let empInfo: { empId: string; fullName: string } | null = null;
        let cols: string[] = [];

        // TRƯỜNG HỢP 1: Tất cả nằm trên 1 dòng phân cách bằng Tab
        if (line.includes('\t')) {
            const parts = line.split('\t').map(p => p.trim());
            empInfo = extractEmployeeInfo(parts[0]);
            if (empInfo && parts.length >= 5) {
                cols = parts.slice(1);
            }
        }

        // TRƯỜNG HỢP 2: Dòng 1 là Tên NV, Dòng 2 là các cột số liệu
        if (!empInfo) {
            empInfo = extractEmployeeInfo(line);
            if (empInfo && i + 1 < cleanLines.length) {
                const nextCols = cleanLines[i + 1].split(/\t+|\s{2,}/).map(c => c.trim()).filter(Boolean);
                if (nextCols.length >= 4) {
                    cols = nextCols;
                    i++;
                }
            }
        }

        // TRƯỜNG HỢP 3: Khi người dùng copy bảng web mà mỗi ô dữ liệu thành 1 dòng riêng lẻ
        if (empInfo && cols.length === 0) {
            const collectedCols: string[] = [];
            let j = i + 1;
            while (j < cleanLines.length && collectedCols.length < 12) {
                const checkLine = cleanLines[j];
                if (extractEmployeeInfo(checkLine) || isStoreHeader(checkLine)) break;
                collectedCols.push(checkLine);
                j++;
            }
            if (collectedCols.length >= 4) {
                cols = collectedCols;
                i = j - 1;
            }
        }

        if (empInfo && cols.length >= 4) {
            let quantity = 0;
            let revenue_qd = 0;
            let revenue_actual = 0;
            let installment_revenue = 0;
            let installment_rate = 0;
            let revenue_return_qd = 0;
            let revenue_loan_qd = 0;

            if (headerColMap && headerColMap.qtyColIdx >= 0) {
                // Nhánh 1: Bóc tách chính xác dựa trên Header dòng tiêu đề đã phát hiện
                const qIdx = headerColMap.qtyColIdx;
                quantity = qIdx < cols.length ? parseNumber(cols[qIdx]) : 0;

                if (isRealTable) {
                    const rIdx = headerColMap.revRealColIdx >= 0
                        ? headerColMap.revRealColIdx
                        : (headerColMap.revGenericColIdx >= 0 ? headerColMap.revGenericColIdx : 1);
                    revenue_actual = rIdx < cols.length ? parseNumber(cols[rIdx]) : 0;
                    revenue_qd = revenue_actual;

                    const instIdx = headerColMap.installmentColIdx;
                    installment_revenue = (instIdx >= 0 && instIdx < cols.length) ? parseNumber(cols[instIdx]) : 0;
                    installment_rate = revenue_actual > 0
                        ? Number(((installment_revenue / revenue_actual) * 100).toFixed(1))
                        : 0;

                    revenue_return_qd = 0;
                    revenue_loan_qd = 0;
                } else {
                    const qdIdx = headerColMap.revQdColIdx >= 0
                        ? headerColMap.revQdColIdx
                        : (headerColMap.revGenericColIdx >= 0 ? headerColMap.revGenericColIdx : 1);
                    revenue_qd = qdIdx < cols.length ? parseNumber(cols[qdIdx]) : 0;
                    revenue_actual = revenue_qd;

                    // Quy chuẩn: CHỈ lấy DT Trả góp từ bảng Doanh thu thực, KHÔNG lấy từ bảng Doanh thu quy đổi
                    installment_revenue = 0;
                    installment_rate = 0;

                    const loanIdx = headerColMap.loanColIdx;
                    revenue_loan_qd = (loanIdx >= 0 && loanIdx < cols.length) ? parseNumber(cols[loanIdx]) : 0;

                    const retIdx = headerColMap.returnColIdx;
                    revenue_return_qd = (retIdx >= 0 && retIdx < cols.length) ? parseNumber(cols[retIdx]) : 0;
                }
            } else {
                // Nhánh 2: Không có dòng tiêu đề -> Phân tích cấu trúc cột theo quy luật bảng BI
                const pctIdx = cols.findIndex(c => typeof c === 'string' && c.includes('%'));
                const is10ColFormat = pctIdx === 3 || (cols.length >= 9 && !cols[cols.length - 1].includes('%'));
                const is9ColFormat = pctIdx === 2 || (cols.length === 8 && !cols[cols.length - 1].includes('%'));

                if (is10ColFormat) {
                    // Cấu trúc 10 cột mới (có cột "DT QĐ KHOẢN VAY"):
                    // [SL, DT, KHOAN_VAY, %TI_TRONG, TB3T, %TT, DT_TRA_THANG, DT_TRA_GOP, DT_NHAP_TRA]
                    quantity = parseNumber(cols[0]);
                    const rev = parseNumber(cols[1]);
                    const loan = parseNumber(cols[2]);
                    const inst = parseNumber(cols[7]);
                    const ret = cols.length > 8 ? parseNumber(cols[8]) : 0;

                    if (isRealTable) {
                        revenue_actual = rev;
                        revenue_qd = rev;
                        installment_revenue = inst;
                        installment_rate = revenue_actual > 0
                            ? Number(((installment_revenue / revenue_actual) * 100).toFixed(1))
                            : 0;
                        revenue_loan_qd = 0;
                        revenue_return_qd = 0;
                    } else {
                        revenue_qd = rev;
                        revenue_actual = rev;
                        revenue_loan_qd = loan;
                        installment_revenue = 0;
                        installment_rate = 0;
                        revenue_return_qd = ret;
                    }
                } else if (is9ColFormat) {
                    // Cấu trúc 9 cột (không có cột Khoản vay):
                    // [SL, DT, %TI_TRONG, TB3T, %TT, DT_TRA_THANG, DT_TRA_GOP, DT_NHAP_TRA]
                    quantity = parseNumber(cols[0]);
                    const rev = parseNumber(cols[1]);
                    const inst = parseNumber(cols[6]);
                    const ret = cols.length > 7 ? parseNumber(cols[7]) : 0;

                    if (isRealTable) {
                        revenue_actual = rev;
                        revenue_qd = rev;
                        installment_revenue = inst;
                        installment_rate = revenue_actual > 0
                            ? Number(((installment_revenue / revenue_actual) * 100).toFixed(1))
                            : 0;
                        revenue_loan_qd = 0;
                        revenue_return_qd = 0;
                    } else {
                        revenue_qd = rev;
                        revenue_actual = rev;
                        revenue_loan_qd = 0;
                        installment_revenue = 0;
                        installment_rate = 0;
                        revenue_return_qd = ret;
                    }
                } else {
                    // Tương thích ngược: Bảng cũ 8 cột hoặc 10 cột legacy
                    quantity = parseNumber(cols[0]);
                    revenue_qd = parseNumber(cols[1]);
                    revenue_actual = cols.length > 3 ? parseNumber(cols[3]) : revenue_qd;
                    if (cols.length >= 10) {
                        installment_revenue = parseNumber(cols[8]);
                        installment_rate = parseNumber(cols[9]);
                    } else if (cols.length >= 7) {
                        installment_revenue = parseNumber(cols[6]);
                        installment_rate = cols.length > 7
                            ? parseNumber(cols[7])
                            : (revenue_actual > 0 ? Number(((installment_revenue / revenue_actual) * 100).toFixed(1)) : 0);
                    }

                    if (!isRealTable) {
                        if (detectedReturnColIdx >= 0 && cols[detectedReturnColIdx] !== undefined) {
                            revenue_return_qd = parseNumber(cols[detectedReturnColIdx]);
                        } else if (cols.length >= 3 && !cols[cols.length - 1].includes('%')) {
                            revenue_return_qd = parseNumber(cols[cols.length - 1]);
                        }
                    }
                }
            }

            // Fallback nếu chưa lấy được nhưng phát hiện được cột
            if (!isRealTable && revenue_return_qd === 0) {
                if (detectedReturnColIdx >= 0 && cols[detectedReturnColIdx] !== undefined) {
                    revenue_return_qd = parseNumber(cols[detectedReturnColIdx]);
                }
            }

            addOrUpdateResult(empInfo, {
                quantity,
                revenue_qd,
                revenue_actual,
                installment_revenue,
                installment_rate,
                revenue_return_qd,
                revenue_loan_qd
            });
        }
    }

    return results;
}

/**
 * Gộp dữ liệu từ Bảng Doanh Thu Quy Đổi (QD) và Bảng Doanh Thu Thực (REAL)
 */
export function mergeEmployeeRevenues(
    table1: ParsedEmployeeRevenue[],
    table2: ParsedEmployeeRevenue[]
): ParsedEmployeeRevenue[] {
    if (!table2 || table2.length === 0) return table1;
    if (!table1 || table1.length === 0) return table2;

    let qdList = table1;
    let realList = table2;

    // Tự động phân định xem bảng nào là REAL
    const t1HasReal = table1.some(r => r.installment_rate > 0 || r.revenue_actual !== r.revenue_qd);
    const t2HasReal = table2.some(r => r.installment_rate > 0 || r.revenue_actual !== r.revenue_qd);

    if (t1HasReal && !t2HasReal) {
        realList = table1;
        qdList = table2;
    }

    const realMap = new Map<string, ParsedEmployeeRevenue>();
    realList.forEach(r => realMap.set(r.employee_id, r));

    const merged: ParsedEmployeeRevenue[] = qdList.map(item => {
        const real = realMap.get(item.employee_id);
        if (real) {
            // Khi có bảng Real, lấy chính xác DT thực (kể cả 0 hoặc số âm)
            const revActual = typeof real.revenue_actual === 'number' ? real.revenue_actual : item.revenue_qd;
            // CHỈ lấy DT Trả góp từ bảng Doanh thu thực (real)
            const instRev = real.installment_revenue > 0 ? real.installment_revenue : 0;
            const instRate = revActual > 0 && instRev > 0
                ? Number(((instRev / revActual) * 100).toFixed(1))
                : 0;

            return {
                ...item,
                revenue_actual: revActual,
                installment_revenue: instRev,
                installment_rate: instRate,
                revenue_return_qd: item.revenue_return_qd || 0,
                revenue_loan_qd: item.revenue_loan_qd || 0
            };
        }
        return item;
    });

    // Bổ sung nhân sự có trong Real nhưng chưa có trong QD (nếu có)
    realList.forEach(real => {
        if (!qdList.some(q => q.employee_id === real.employee_id)) {
            merged.push({
                ...real,
                revenue_qd: real.revenue_actual,
                revenue_return_qd: real.revenue_return_qd || 0,
                revenue_loan_qd: 0
            });
        }
    });

    return merged;
}

/**
 * Hàm phân tích cú pháp chính hỗ trợ cả 2 bảng độc lập hoặc 1 bảng gộp
 */
export function parseEmployeeRevenueText(rawText: string, realRawText?: string): ParsedEmployeeRevenue[] {
    if (!rawText || !rawText.trim()) return [];

    const SPLIT_TOKENS = [
        '=== BẢNG DOANH THU THỰC ===',
        '=== DOANH THU THỰC ===',
        '--- DOANH THU THỰC ---'
    ];

    for (const token of SPLIT_TOKENS) {
        if (!realRawText && rawText.includes(token)) {
            const [p1, p2] = rawText.split(token);
            return mergeEmployeeRevenues(
                parseSingleEmployeeRevenueTable(p1, 'QD'),
                parseSingleEmployeeRevenueTable(p2, 'REAL')
            );
        }
    }

    if (realRawText && realRawText.trim()) {
        return mergeEmployeeRevenues(
            parseSingleEmployeeRevenueTable(rawText, 'QD'),
            parseSingleEmployeeRevenueTable(realRawText, 'REAL')
        );
    }

    return parseSingleEmployeeRevenueTable(rawText);
}

/**
 * 2. BÓC TÁCH THI ĐUA NHÂN VIÊN (từ nv-thidua.txt)
 */
export function parseEmployeeCampaignText(rawText: string): {
    campaigns: ParsedCampaignBlock[];
    employee_campaign_matrix: Record<string, Record<string, number>>; // { [empId]: { [campaignName]: val } }
} {
    if (!rawText.trim()) return { campaigns: [], employee_campaign_matrix: {} };

    const lines = rawText.split(/\r?\n/).map(l => l.trim());
    const campaigns: ParsedCampaignBlock[] = [];
    let currentCampaign: ParsedCampaignBlock | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Dòng header thi đua: "Bảo hiểm tổng \t DOANH THU \t HẠNG TRONG ST..."
        if (line.includes('\tDOANH THU\t') || line.includes('\tSỐ LƯỢNG\t')) {
            const parts = line.split('\t').map(p => p.trim());
            const campName = parts[0];
            const unitType = parts[1].toUpperCase().includes('SỐ LƯỢNG') ? 'SỐ LƯỢNG' : 'DOANH THU';

            currentCampaign = {
                campaign_name: campName,
                unit_type: unitType,
                employee_values: {}
            };
            campaigns.push(currentCampaign);
            continue;
        }

        if (!currentCampaign) continue;

        // Bỏ qua dòng TỔNG hoặc online
        if (line.startsWith('TỔNG\t') || line.toLowerCase().includes('online - 18001060')) {
            continue;
        }

        // Dòng nhân viên: "27560 - Bùi Minh Lãm \t 93.53 \t 1 \t TOP"
        const parts = line.split('\t').map(p => p.trim());
        if (parts.length >= 2) {
            const empRaw = parts[0];
            const match = empRaw.match(/^(\w+)\s*-\s*(.+)$/);
            if (match) {
                const empId = match[1].trim();
                const value = parseNumber(parts[1]);
                currentCampaign.employee_values[empId] = value;
            }
        }
    }

    // Xây dựng ma trận [empId][campaignName]
    const matrix: Record<string, Record<string, number>> = {};
    campaigns.forEach(camp => {
        Object.entries(camp.employee_values).forEach(([empId, val]) => {
            if (!matrix[empId]) matrix[empId] = {};
            matrix[empId][camp.campaign_name] = val;
        });
    });

    return { campaigns, employee_campaign_matrix: matrix };
}

/**
 * 3. BÓC TÁCH GIỜ CÔNG NHÂN VIÊN (từ nv-giocong.txt)
 * Hỗ trợ khử trùng lặp (Deduplicate) theo Ngày + Ca + Mã NV
 */
export function parseWorkHoursLogs(
    rawText: string,
    existingShiftKeys: Set<string> = new Set<string>()
): {
    newShiftLogs: WorkShiftLog[];
    totalHoursByEmp: Record<string, number>;
    duplicateCount: number;
} {
    if (!rawText.trim()) return { newShiftLogs: [], totalHoursByEmp: {}, duplicateCount: 0 };

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const newShiftLogs: WorkShiftLog[] = [];
    const totalHoursByEmp: Record<string, number> = {};
    let duplicateCount = 0;

    for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.startsWith('ngày') || lower.includes('tổng giờ công') || lower.startsWith('tổng:')) {
            continue;
        }

        const parts = line.split('\t').map(p => p.trim());
        if (parts.length < 9) continue;

        const date = parts[0];        // 2026/09/26
        const storeName = parts[2];   // 10335 - AAR_BRV_VTA - 290 Trương Công Định
        const empRaw = parts[3];      // 22838 - Trần Thị Sáu
        const shiftName = parts[7];   // Ca 1, Ca 2...
        const hours = parseNumber(parts[8]); // 0.97, 3, 1...

        const match = empRaw.match(/^(\w+)\s*-\s*(.+)$/);
        if (!match) continue;

        const empId = match[1].trim();
        const fullName = match[2].trim();

        // Khóa định danh chống trùng lặp ca
        const uniqueShiftKey = `${date}_${empId}_${shiftName}`;
        if (existingShiftKeys.has(uniqueShiftKey)) {
            duplicateCount++;
            continue;
        }

        existingShiftKeys.add(uniqueShiftKey);

        const log: WorkShiftLog = {
            date,
            store_name: storeName,
            employee_id: empId,
            full_name: fullName,
            department: parts[5] || '',
            job_title: parts[6] || '',
            shift_name: shiftName,
            hours
        };

        newShiftLogs.push(log);
        totalHoursByEmp[empId] = Number(((totalHoursByEmp[empId] || 0) + hours).toFixed(2));
    }

    return { newShiftLogs, totalHoursByEmp, duplicateCount };
}

function parseNumber(val: any): number {
    if (val === null || val === undefined) return 0;
    let str = String(val).trim();
    if (!str || str === '—' || str === '-' || str === 'N/A' || str === 'null') return 0;
    // Bỏ ký tự %, tiền tệ và khoảng trắng
    str = str.replace(/[%đĐ]/g, '').trim();

    // Xử lý số âm trong ngoặc đơn (1,500) -> -1,500
    if (/^\(.*\)$/.test(str)) {
        str = '-' + str.slice(1, -1).trim();
    }
    // Xử lý khoảng trắng giữa dấu trừ và số (- 1,500 -> -1,500)
    str = str.replace(/^-\s+/, '-');

    // Nếu dạng "30,5" hoặc "12,5" (1 dấu phẩy và theo sau là 1 hoặc 2 chữ số): chuyển thành dấu chấm thập phân
    if (/^-?\d+,\d{1,2}$/.test(str)) {
        str = str.replace(',', '.');
    } else {
        // Xóa dấu phẩy phân cách hàng nghìn (ví dụ "1,255.25" -> "1255.25", "2,141" -> "2141")
        str = str.replace(/,/g, '');
    }

    const num = Number(str);
    return isNaN(num) ? 0 : Number(num.toFixed(2));
}
