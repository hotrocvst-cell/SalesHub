import ExcelJS from 'exceljs';
import type { VoucherItem } from '../types';
import { formatDateTime } from '../../../core/lib/formatters';

/**
 * Xuất toàn bộ dữ liệu tồn kho voucher của cụm siêu thị ra file Excel (.xlsx)
 * Gồm 2 Sheet:
 * 1. Chi Tiết Mã Voucher: Toàn bộ danh sách mã chi tiết kèm thông tin cấp phát, đơn hàng, HSD
 * 2. Tổng Hợp Tồn Kho: Thống kê số lượng, giá trị theo từng chương trình và mệnh giá
 */
export async function exportVoucherInventoryToExcel(params: {
    vouchers: VoucherItem[];
    clusterName?: string;
    exportedBy?: string;
}): Promise<void> {
    const { vouchers, clusterName = 'Cụm Siêu Thị', exportedBy = 'Quản lý' } = params;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SalesHub Analytics';
    workbook.created = new Date();

    const todayStr = new Date().toISOString().slice(0, 10);
    const exportTimeStr = formatDateTime(new Date().toISOString());

    // =========================================================================
    // SHEET 1: CHI TIẾT MÃ VOUCHER
    // =========================================================================
    const wsDetail = workbook.addWorksheet('Chi Tiết Mã Voucher', {
        views: [{ state: 'frozen', ySplit: 4 }]
    });

    // 1. Tiêu đề báo cáo
    wsDetail.mergeCells('A1:Q1');
    const titleCell = wsDetail.getCell('A1');
    titleCell.value = `BÁO CÁO TOÀN BỘ TỒN KHO MÃ VOUCHER - ${clusterName.toUpperCase()}`;
    titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsDetail.getRow(1).height = 30;

    // 2. Thông tin xuất báo cáo
    wsDetail.mergeCells('A2:Q2');
    const subTitleCell = wsDetail.getCell('A2');
    subTitleCell.value = `Thời điểm xuất: ${exportTimeStr}  |  Người xuất: ${exportedBy}  |  Tổng số lượng mã: ${vouchers.length.toLocaleString('vi-VN')} mã`;
    subTitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsDetail.getRow(2).height = 20;

    // Row 3: Dòng trống
    wsDetail.getRow(3).height = 8;

    // 3. Khai báo các cột dữ liệu
    const columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Mã Voucher', key: 'code', width: 20 },
        { header: 'Chương Trình', key: 'campaign_name', width: 28 },
        { header: 'Mệnh Giá (VNĐ)', key: 'denomination', width: 16 },
        { header: 'Trạng Thái', key: 'status', width: 18 },
        { header: 'Hạn Sử Dụng', key: 'expires_at', width: 14 },
        { header: 'Kho / Cụm Lưu Trữ', key: 'store_name', width: 26 },
        { header: 'Mã NV Nhận', key: 'claimed_by_id', width: 14 },
        { header: 'Tên NV Nhận', key: 'claimed_by_name', width: 22 },
        { header: 'Siêu Thị Của NV', key: 'claimed_by_store', width: 26 },
        { header: 'Mã Đơn Hàng', key: 'order_id', width: 18 },
        { header: 'Thời Điểm Cấp', key: 'claimed_at', width: 20 },
        { header: 'Thời Điểm Dùng', key: 'used_at', width: 20 },
        { header: 'Ngày Nạp Kho', key: 'created_at', width: 20 },
        { header: 'Người Nạp Kho', key: 'created_by', width: 20 },
        { header: 'Điều Kiện Sử Dụng', key: 'description', width: 32 },
        { header: 'Ghi Chú', key: 'note', width: 30 }
    ];

    wsDetail.getRow(4).values = columns.map(c => c.header);
    wsDetail.getRow(4).height = 28;
    wsDetail.getRow(4).eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0F172A' } // Dark Slate
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
    });

    columns.forEach((col, idx) => {
        wsDetail.getColumn(idx + 1).width = col.width;
    });

    // 4. Đổ dữ liệu chi tiết
    vouchers.forEach((v, index) => {
        const isExpired = Boolean(v.expires_at && v.expires_at < todayStr && v.status !== 'USED');
        let statusText = 'Khả dụng';
        if (v.status === 'USED') {
            statusText = 'Đã sử dụng';
        } else if (isExpired || v.status === 'EXPIRED') {
            statusText = 'Đã quá hạn';
        } else if (v.status === 'CLAIMED') {
            statusText = 'Đang giữ (Chưa dùng)';
        }

        const row = wsDetail.addRow({
            stt: index + 1,
            code: v.code,
            campaign_name: v.campaign_name,
            denomination: Number(v.denomination) || 0,
            status: statusText,
            expires_at: v.expires_at || '',
            store_name: v.store_name || '',
            claimed_by_id: v.claimed_by_id || '',
            claimed_by_name: v.claimed_by_name || '',
            claimed_by_store: v.claimed_by_store || '',
            order_id: v.order_id || '',
            claimed_at: v.claimed_at ? formatDateTime(v.claimed_at) : '',
            used_at: v.used_at ? formatDateTime(v.used_at) : '',
            created_at: v.created_at ? formatDateTime(v.created_at) : '',
            created_by: v.created_by || '',
            description: v.description || '',
            note: v.note || ''
        });

        row.height = 22;

        // Định dạng từng ô
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).font = { name: 'Consolas', size: 10, bold: true };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(4).numFmt = '#,##0';
        row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };

        // Tô màu nhẹ theo trạng thái
        const statusCell = row.getCell(5);
        statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (v.status === 'USED') {
            statusCell.font = { color: { argb: 'FF15803D' }, bold: true };
        } else if (isExpired || v.status === 'EXPIRED') {
            statusCell.font = { color: { argb: 'FFBE123C' }, bold: true };
        } else if (v.status === 'CLAIMED') {
            statusCell.font = { color: { argb: 'FFB45309' }, bold: true };
        } else {
            statusCell.font = { color: { argb: 'FF0369A1' }, bold: true };
        }

        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(12).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(14).alignment = { horizontal: 'center', vertical: 'middle' };

        // Viền các ô
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });

        // Xen kẽ màu dòng (zebra striping)
        if (index % 2 === 1) {
            row.eachCell((cell) => {
                if (!cell.fill || cell.fill.type !== 'pattern') {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF8FAFC' }
                    };
                }
            });
        }
    });

    // =========================================================================
    // SHEET 2: TỔNG HỢP THEO CHƯƠNG TRÌNH & MỆNH GIÁ
    // =========================================================================
    const wsSummary = workbook.addWorksheet('Tổng Hợp Theo Chương Trình', {
        views: [{ state: 'frozen', ySplit: 4 }]
    });

    wsSummary.mergeCells('A1:K1');
    const sumTitle = wsSummary.getCell('A1');
    sumTitle.value = `BẢNG TỔNG HỢP TỒN KHO VOUCHER THEO CHƯƠNG TRÌNH - ${clusterName.toUpperCase()}`;
    sumTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F766E' } };
    sumTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getRow(1).height = 30;

    wsSummary.mergeCells('A2:K2');
    const sumSub = wsSummary.getCell('A2');
    sumSub.value = `Thời điểm chốt: ${exportTimeStr}  |  Phạm vi: Toàn bộ kho mã thuộc Cụm quản lý`;
    sumSub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    sumSub.alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getRow(2).height = 20;

    wsSummary.getRow(3).height = 8;

    const summaryColumns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Tên Chương Trình', key: 'campaign', width: 30 },
        { header: 'Mệnh Giá (VNĐ)', key: 'denom', width: 16 },
        { header: 'Tổng Mã Nhập', key: 'total', width: 14 },
        { header: 'Khả Dụng (Sẵn Sàng)', key: 'available', width: 18 },
        { header: 'Đang Giữ (Chưa Dùng)', key: 'claimed', width: 18 },
        { header: 'Đã Sử Dụng', key: 'used', width: 14 },
        { header: 'Đã Quá Hạn', key: 'expired', width: 14 },
        { header: 'Giá Trị Khả Dụng (VNĐ)', key: 'val_avail', width: 22 },
        { header: 'Tổng Giá Trị Kho (VNĐ)', key: 'val_total', width: 22 },
        { header: 'Tỷ Lệ Tiêu Thụ', key: 'burn_pct', width: 16 }
    ];

    wsSummary.getRow(4).values = summaryColumns.map(c => c.header);
    wsSummary.getRow(4).height = 28;
    wsSummary.getRow(4).eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0F766E' } // Deep Teal
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'medium', color: { argb: 'FF0F766E' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
    });

    summaryColumns.forEach((col, idx) => {
        wsSummary.getColumn(idx + 1).width = col.width;
    });

    // Gom nhóm dữ liệu theo Campaign & Mệnh giá
    interface SummaryRow {
        campaign: string;
        denom: number;
        total: number;
        available: number;
        claimed: number;
        used: number;
        expired: number;
    }
    const summaryMap = new Map<string, SummaryRow>();

    vouchers.forEach(v => {
        const cName = v.campaign_name.trim();
        const denom = Number(v.denomination) || 0;
        const key = `${cName}:::${denom}`;

        if (!summaryMap.has(key)) {
            summaryMap.set(key, {
                campaign: cName,
                denom,
                total: 0,
                available: 0,
                claimed: 0,
                used: 0,
                expired: 0
            });
        }

        const item = summaryMap.get(key)!;
        item.total++;

        const isExpired = Boolean(v.expires_at && v.expires_at < todayStr && v.status !== 'USED');
        if (v.status === 'USED') {
            item.used++;
        } else if (isExpired || v.status === 'EXPIRED') {
            item.expired++;
        } else if (v.status === 'CLAIMED') {
            item.claimed++;
        } else if (v.status === 'AVAILABLE') {
            item.available++;
        }
    });

    const summaryList = Array.from(summaryMap.values()).sort((a, b) => {
        const cDiff = a.campaign.localeCompare(b.campaign);
        if (cDiff !== 0) return cDiff;
        return b.denom - a.denom;
    });

    let sumTotalM = 0;
    let sumAvailM = 0;
    let sumClaimedM = 0;
    let sumUsedM = 0;
    let sumExpiredM = 0;
    let sumValAvailM = 0;
    let sumValTotalM = 0;

    summaryList.forEach((s, idx) => {
        const valAvail = s.available * s.denom;
        const valTotal = s.total * s.denom;
        const burnRate = s.total > 0 ? Math.round((s.used / s.total) * 100) : 0;

        sumTotalM += s.total;
        sumAvailM += s.available;
        sumClaimedM += s.claimed;
        sumUsedM += s.used;
        sumExpiredM += s.expired;
        sumValAvailM += valAvail;
        sumValTotalM += valTotal;

        const row = wsSummary.addRow({
            stt: idx + 1,
            campaign: s.campaign,
            denom: s.denom,
            total: s.total,
            available: s.available,
            claimed: s.claimed,
            used: s.used,
            expired: s.expired,
            val_avail: valAvail,
            val_total: valTotal,
            burn_pct: `${burnRate}%`
        });

        row.height = 22;
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).numFmt = '#,##0';
        row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(4).numFmt = '#,##0';
        row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(5).numFmt = '#,##0';
        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(6).numFmt = '#,##0';
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(7).numFmt = '#,##0';
        row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(8).numFmt = '#,##0';
        row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(9).numFmt = '#,##0';
        row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(10).numFmt = '#,##0';
        row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };

        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });

        if (idx % 2 === 1) {
            row.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF0FDFA' } // Light mint/teal
                };
            });
        }
    });

    // Dòng TỔNG CỘNG
    const totalRow = wsSummary.addRow({
        stt: '',
        campaign: 'TỔNG CỘNG TOÀN CỤM',
        denom: '',
        total: sumTotalM,
        available: sumAvailM,
        claimed: sumClaimedM,
        used: sumUsedM,
        expired: sumExpiredM,
        val_avail: sumValAvailM,
        val_total: sumValTotalM,
        burn_pct: sumTotalM > 0 ? `${Math.round((sumUsedM / sumTotalM) * 100)}%` : '0%'
    });

    totalRow.height = 26;
    totalRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFCCFBF1' } // Teal-100
        };
        cell.border = {
            top: { style: 'medium', color: { argb: 'FF0F766E' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'double', color: { argb: 'FF0F766E' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
    });
    totalRow.getCell(4).numFmt = '#,##0';
    totalRow.getCell(5).numFmt = '#,##0';
    totalRow.getCell(6).numFmt = '#,##0';
    totalRow.getCell(7).numFmt = '#,##0';
    totalRow.getCell(8).numFmt = '#,##0';
    totalRow.getCell(9).numFmt = '#,##0';
    totalRow.getCell(10).numFmt = '#,##0';
    totalRow.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };

    // =========================================================================
    // XUẤT FILE EXCEL
    // =========================================================================
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;

    const safeClusterName = clusterName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    anchor.download = `TonKho_Voucher_${safeClusterName || 'CumSieuThi'}_${todayStr}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
}
