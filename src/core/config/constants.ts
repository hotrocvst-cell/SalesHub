// Danh sách siêu thị được cấp quyền vận hành hệ thống
export const ALLOWED_STORES = [
    'TGD_BRV_VTA - 290 Trương Công Định',
    'AAR_BRV_VTA - 290 Trương Công Định'
];

// Cấu hình nhận diện từ khóa thi đua ngành hàng
export const CAMPAIGN_CONFIG = [
    { key: /Bảo hiểm tổng/i, label: 'BẢO_HIỂM_TỔNG', score: 1 },
    { key: /Bảo hiểm Thợ ĐMX/i, label: 'BẢO_HIỂM_ĐMX', score: 1 },
    { key: /Bảo hiểm/i, label: 'BẢO_HIỂM', score: 1 },
    { key: /SIM MOBIFONE\/VINAPHONE\/SIM DMX/i, label: 'SIM_MOBI_VINA_ĐMX', score: 1 },
    { key: /Sim Vinaphone & Sim ĐMX/i, label: 'SIM_VINA_ĐMX', score: 1 },
    { key: /Sim Tổng/i, label: 'SIM_TỔNG', score: 1 },
    { key: /OTT MANGO\+, ICALLME/i, label: 'MANGO_iCALLME', score: 1 },
    { key: /VAS/i, label: 'VAS', score: 1 },
    { key: /ĐIỆN THOẠI & TABLET ANDROID/i, label: 'ICT_ANDROID', score: 1 },
    { key: /TABLET ANDROID/i, label: 'TABLET_ANDROID', score: 1 },
    { key: /Điện thoại realme/i, label: 'REALME', score: 1 },
    { key: /Điện thoại Vivo/i, label: 'VIVO', score: 1 },
    { key: /Điện thoại Flagship Samsung Galaxy S/i, label: 'GALAXY_S.Z', score: 1 },
    { key: /TRẢ CHẬM FECREDIT, SHINHAN, SAMSUNG FINANCE\+/i, label: 'FE_SH_SSF', score: 1 },
    { key: /TRẢ CHẬM HOMECREDIT/i, label: 'HOMECREDIT', score: 1 },
    { key: /Vay tiền mặt/i, label: 'VTM_CAKE_FE', score: 1 },
    { key: /Ví trả sau/i, label: 'VÍ_TRẢ_SAU', score: 1 },
    { key: /Camera/i, label: 'CAMERA', score: 1 },
    { key: /Cáp - Sạc/i, label: 'CÁP_SẠC', score: 1 },
    { key: /Đồng hồ/i, label: 'ĐỒNG_HỒ', score: 1 },
    { key: /Phụ kiện IT và nhóm khác/i, label: 'PK_IT_KHÁC', score: 1 },
    { key: /PHỤ KIỆN CÔNG NGHỆ/i, label: 'PK_CÔNG_NGHỆ', score: 1 },
    { key: /SẠC DỰ PHÒNG/i, label: 'PIN_SDP', score: 1 },
    { key: /TAI NGHE/i, label: 'TAI_NGHE', score: 1 },
    { key: /QUẠT GIÓ/i, label: 'QUẠT_GIÓ', score: 1 },
    { key: /Laptop \(trừ Apple\)/i, label: 'LAPTOP', score: 1 },
    { key: /Laptop/i, label: 'LAPTOP', score: 1 },
    { key: /NẠP RÚT TIỀN TÀI KHOẢN NGÂN HÀNG/i, label: 'NẠP_RÚT', score: 1 },
    { key: /MỞ THẺ TÍN DỤNG TPBANK EVO VÀ VPBANK MWG/i, label: 'THẺ_TP_VPBANK', score: 1 },
    { key: /T09 - T10 IPHONE 18 series, iPhone Duo/i, label: 'iPHONE_2026', score: 1 },
    { key: /MOTOROLA/i, label: 'MOTOROLA', score: 1 }
];