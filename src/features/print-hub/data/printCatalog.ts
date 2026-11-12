import stickerTemplates from './exact/stickerTemplates.json';
import popupTemplates from './exact/popupTemplates.json';
import salesTemplates from './exact/salesTemplates.json';
import workTemplates from './exact/workTemplates.json';
import type { ExactTemplateEntry, PrintCategoryKey, PrintToolMeta } from '../types';

export interface PrintCategoryMeta {
  key: PrintCategoryKey;
  label: string;
  description: string;
}

export const PRINT_CATEGORIES: PrintCategoryMeta[] = [
  {
    key: 'sticker',
    label: 'Sticker Giá & KM',
    description: 'Giữ nguyên 100% kích thước tem gốc & bộ font mt2 (6s / 2s / 1s)',
  },
  {
    key: 'popup',
    label: 'Pop-up Bảng Giá',
    description: 'Giữ nguyên khổ BTN, LED, A6, A5, Trả chậm 0% và Pop-up Dịch vụ',
  },
  {
    key: 'sales',
    label: 'Phiếu Bán Hàng',
    description: 'Phiếu tư vấn trả chậm, bảo hiểm, thanh toán, tài khoản & tổng đài ST',
  },
  {
    key: 'work',
    label: 'Công Việc ST',
    description: 'Bảng tên NV, Code QR/Barcode túi chuẩn POS, Biên bản nhận hàng & Dán máy',
  },
  {
    key: 'decor',
    label: 'Trang Trí ST',
    description: 'Dây treo trần (01–04) và 24 mẫu họa tiết cắt dán',
  },
];

export const PRINT_TOOLS_CATALOG: PrintToolMeta[] = [
  // 1. STICKER (9 công cụ, 37 mẫu gốc)
  {
    id: 'stk_ptg',
    category: 'sticker',
    name: 'Sticker Phần Trăm Giảm',
    shortDesc: 'Tem bát giác giảm % (chọn 6 / 2 / 1 tem trên tờ A4)',
    variants: [
      { label: '6 tem nhỏ (335px)', rel: 'in-sticker/in-ptg-6s.html' },
      { label: '2 tem vừa', rel: 'in-sticker/in-ptg-2s.html' },
      { label: '1 tem lớn (750px)', rel: 'in-sticker/in-ptg-1s.html' },
    ],
  },
  {
    id: 'stk_gg1',
    category: 'sticker',
    name: 'Sticker Gạch Giá (< 1 triệu)',
    shortDesc: 'Tem bát giác giá gạch dưới 1 triệu (6 / 2 / 1 tem)',
    variants: [
      { label: '6 tem nhỏ', rel: 'in-sticker/in-gg-6s.html' },
      { label: '2 tem vừa', rel: 'in-sticker/in-gg-2s.html' },
      { label: '1 tem lớn', rel: 'in-sticker/in-gg-1s.html' },
    ],
  },
  {
    id: 'stk_gg2',
    category: 'sticker',
    name: 'Sticker Gạch Giá (> 1 triệu)',
    shortDesc: 'Tem bát giác giá gạch trên 1 triệu (6 / 2 / 1 tem)',
    variants: [
      { label: '6 tem nhỏ', rel: 'in-sticker/in-gg2-6s.html' },
      { label: '2 tem vừa', rel: 'in-sticker/in-gg2-2s.html' },
      { label: '1 tem lớn', rel: 'in-sticker/in-gg2-1s.html' },
    ],
  },
  {
    id: 'stk_grq',
    category: 'sticker',
    name: 'Sticker Giá Rẻ Quá',
    shortDesc: 'Khung bát giác Giá Rẻ Quá (6 / 2 / 1 tem)',
    variants: [
      { label: '6 tem nhỏ', rel: 'in-sticker/in-grq-6s.html' },
      { label: '2 tem vừa', rel: 'in-sticker/in-grq-2s.html' },
      { label: '1 tem lớn', rel: 'in-sticker/in-grq-1s.html' },
    ],
  },
  {
    id: 'stk_pmh',
    category: 'sticker',
    name: 'Sticker Phiếu Mua Hàng',
    shortDesc: 'Tem tặng PMH / Voucher ưu đãi (6 / 2 / 1 tem)',
    variants: [
      { label: '6 tem nhỏ', rel: 'in-sticker/in-pmh-6s.html' },
      { label: '2 tem vừa', rel: 'in-sticker/in-pmh-2s.html' },
      { label: '1 tem lớn', rel: 'in-sticker/in-pmh-1s.html' },
    ],
  },
  {
    id: 'stk_giacheo',
    category: 'sticker',
    name: 'Sticker Giá Chéo (01–05)',
    shortDesc: '5 mẫu khung viền ngang gạch giá gốc & nổi bật giá mới',
    variants: [1, 2, 3, 4, 5].map((n) => ({
      label: `Mẫu 0${n}`,
      rel: `in-sticker/in-giacheo-0${n}.html`,
    })),
  },
  {
    id: 'stk_baohiem',
    category: 'sticker',
    name: 'Sticker Bảo Hiểm & Bảo Hành',
    shortDesc: 'Rơi vỡ (16t), BH Mở rộng (16t/4t), Tặng 1N / 2N, 1 Đổi 1',
    variants: [
      { label: 'BH Rơi vỡ (16 tem)', rel: 'in-sticker/in-baohiem-01.html' },
      { label: 'BH Mở rộng (16 tem)', rel: 'in-sticker/in-baohiem-02.html' },
      { label: 'BH Mở rộng (4 tem lớn)', rel: 'in-sticker/in-baohiem-03.html' },
      { label: 'Tặng thêm 1 Năm (4 tem)', rel: 'in-sticker/in-baohiem-04.html' },
      { label: 'Tặng thêm 2 Năm (4 tem)', rel: 'in-sticker/in-baohiem-05.html' },
      { label: '1 Đổi 1 trong 1N (4 tem)', rel: 'in-sticker/in-baohiem-06.html' },
    ],
  },
  {
    id: 'stk_tracham',
    category: 'sticker',
    name: 'Sticker Trả Chậm 0%',
    shortDesc: 'Các mật độ tem tròn/khiên Trả chậm 0% (30 / 24 / 15 / 6 tem)',
    variants: [
      { label: 'Mẫu 01 (30 tem khiên)', rel: 'in-sticker/in-tracham-01.html' },
      { label: 'Mẫu 02 (24 tem tròn)', rel: 'in-sticker/in-tracham-02.html' },
      { label: 'Mẫu 03 (15 tem tròn)', rel: 'in-sticker/in-tracham-03.html' },
      { label: 'Mẫu 04 (6 tem lớn)', rel: 'in-sticker/in-tracham-04.html' },
    ],
  },
  {
    id: 'stk_khac',
    category: 'sticker',
    name: 'Sticker Triển Khai Khác (01–07)',
    shortDesc: 'Đặc quyền, Đặc biệt, Trợ giá lên đời & Hoàn tiền',
    variants: [
      { label: 'Mẫu 01 (Đặc quyền 6 tem)', rel: 'in-sticker/in-khac-01.html' },
      { label: 'Mẫu 02 (SP Độc quyền tròn)', rel: 'in-sticker/in-khac-02.html' },
      { label: 'Mẫu 03 (Khiên ĐQ 210px)', rel: 'in-sticker/in-khac-03.html' },
      { label: 'Mẫu 04 (Khiên ĐQ 335px)', rel: 'in-sticker/in-khac-04.html' },
      { label: 'Mẫu 05 (Đặc biệt đứng 30t)', rel: 'in-sticker/in-khac-05.html' },
      { label: 'Mẫu 06 (Trợ giá lên đời)', rel: 'in-sticker/in-khac-06.html' },
      { label: 'Mẫu 07 (Hoàn tiền)', rel: 'in-sticker/in-khac-07.html' },
    ],
  },

  // 2. POP-UP (4 công cụ, 31 mẫu gốc)
  {
    id: 'pop_nho',
    category: 'popup',
    name: 'Pop-up BTN / LED / Phụ Kiện',
    shortDesc: 'Khổ Bàn trải nghiệm, LED Điện thoại & Phụ kiện nguyên bản',
    variants: [
      { label: 'BTN Giá giảm', rel: 'in-popup/giamgia/dm-nho/in-btn-giam.html' },
      { label: 'BTN Giá gạch', rel: 'in-popup/giamgia/dm-nho/in-btn-gach.html' },
      { label: 'BTN Giảm sốc', rel: 'in-popup/giamgia/dm-nho/in-btn-giamsoc.html' },
      { label: 'LED Giá giảm', rel: 'in-popup/giamgia/dm-nho/in-led-giam.html' },
      { label: 'LED Giảm sốc', rel: 'in-popup/giamgia/dm-nho/in-led-giamsoc.html' },
      { label: 'Phụ kiện giảm giá', rel: 'in-popup/giamgia/dm-nho/in-pk-giam.html' },
    ],
  },
  {
    id: 'pop_lon',
    category: 'popup',
    name: 'Pop-up Gia Dụng / ML / MG / MLN / TV-TL / Quạt',
    shortDesc: 'Đầy đủ 16 mẫu Pop-up ngành hàng lớn theo đúng khổ kệ A6 / A5 / A4',
    variants: [
      { label: 'Gia dụng: Giảm', rel: 'in-popup/giamgia/dm-lon/in-gd-giam.html' },
      { label: 'Gia dụng: Gạch', rel: 'in-popup/giamgia/dm-lon/in-gd-gach.html' },
      { label: 'Gia dụng: Giảm còn', rel: 'in-popup/giamgia/dm-lon/in-gd-giamcon.html' },
      { label: 'Máy giặt: Giảm', rel: 'in-popup/giamgia/dm-lon/in-mg-giam.html' },
      { label: 'Máy giặt: Gạch', rel: 'in-popup/giamgia/dm-lon/in-mg-gach.html' },
      { label: 'Máy lạnh: Giảm', rel: 'in-popup/giamgia/dm-lon/in-ml-giam.html' },
      { label: 'Máy lạnh: Gạch', rel: 'in-popup/giamgia/dm-lon/in-ml-gach.html' },
      { label: 'Máy lạnh: Ưu đãi', rel: 'in-popup/giamgia/dm-lon/in-ml-uudai.html' },
      { label: 'Máy lọc nước: Giảm', rel: 'in-popup/giamgia/dm-lon/in-mln-giam.html' },
      { label: 'MLN: Giảm Full A4', rel: 'in-popup/giamgia/dm-lon/in-mln-giamfull.html' },
      { label: 'MLN: Gạch Full A4', rel: 'in-popup/giamgia/dm-lon/in-mln-gachfull.html' },
      { label: 'TV-TL: Giảm', rel: 'in-popup/giamgia/dm-lon/in-tvtl-giam.html' },
      { label: 'TV-TL: Gạch', rel: 'in-popup/giamgia/dm-lon/in-tvtl-gach.html' },
      { label: 'TV-TL A5 Full: Giảm', rel: 'in-popup/giamgia/dm-lon/in-tvtl-giama5.html', paperSize: 'A5' },
      { label: 'TV-TL A5 Full: Gạch', rel: 'in-popup/giamgia/dm-lon/in-tvtl-gacha5.html', paperSize: 'A5' },
      { label: 'Quạt theo mùa', rel: 'in-popup/trienkhai/in-tk-quat.html' },
    ],
  },
  {
    id: 'pop_tracham',
    category: 'popup',
    name: 'Pop-up Trả Chậm 0%',
    shortDesc: 'Bảng nổi trả góp 0% cho BTN (A7), LED, Máy giặt, Máy lạnh & TV-TL',
    variants: [
      { label: 'Bàn trải nghiệm (6 ô)', rel: 'in-popup/tracham/in-tracham-btn.html' },
      { label: 'LED Điện thoại (6 ô)', rel: 'in-popup/tracham/in-tracham-led.html' },
      { label: 'Máy giặt (A5)', rel: 'in-popup/tracham/in-tracham-mg.html' },
      { label: 'Máy lạnh (A5)', rel: 'in-popup/tracham/in-tracham-ml.html' },
      { label: 'TV - Tủ lạnh (A5)', rel: 'in-popup/tracham/in-tracham-tvtl.html' },
    ],
  },
  {
    id: 'pop_dichvu',
    category: 'popup',
    name: 'Pop-up Vượt Trội Dịch Vụ',
    shortDesc: 'Bảng niêm yết bảo hành & vệ sinh định kỳ (Máy lạnh / MG / MLN / TV-TL)',
    variants: [
      { label: 'Máy lạnh', rel: 'in-popup/dichvu/in-dv-ml.html' },
      { label: 'Máy giặt', rel: 'in-popup/dichvu/in-dv-mg.html' },
      { label: 'Máy lọc nước', rel: 'in-popup/dichvu/in-dv-mln.html' },
      { label: 'TV - Tủ lạnh', rel: 'in-popup/dichvu/in-dv-tvtl.html' },
    ],
  },

  // 3. PHIẾU BÁN HÀNG (5 công cụ)
  {
    id: 'sls_tracham',
    category: 'sales',
    name: 'Phiếu Tư Vấn Trả Chậm',
    shortDesc: '5 phiếu/A4 xoay tối ưu đúng kích thước 270x422px gốc',
    variants: [{ label: 'Bản chuẩn 5 phiếu/A4', rel: 'in-ban-hang/in-phieu-tra-cham.html' }],
  },
  {
    id: 'sls_baohiem',
    category: 'sales',
    name: 'Phiếu Tư Vấn Bảo Hiểm',
    shortDesc: '6 phiếu/A4 (250x395px) tư vấn gói Rơi vỡ & Mở rộng',
    variants: [{ label: 'Bản chuẩn 6 phiếu/A4', rel: 'in-ban-hang/in-phieu-bao-hiem.html' }],
  },
  {
    id: 'sls_thanhtoan',
    category: 'sales',
    name: 'Phiếu Thẻ Thanh Toán',
    shortDesc: 'Thẻ theo dõi đóng trả chậm 2 cột (340px) có đường cắt nét đứt',
    variants: [{ label: 'Bản chuẩn 10 thẻ/A4', rel: 'in-ban-hang/in-phieu-thanh-toan.html' }],
  },
  {
    id: 'sls_taikhoan',
    category: 'sales',
    name: 'Phiếu Tài Khoản Khách Hàng',
    shortDesc: 'Phiếu ghi tài khoản Email / FB / Zalo cho khách nhận máy',
    variants: [{ label: 'Bản chuẩn 10 phiếu/A4', rel: 'in-ban-hang/in-phieu-tai-khoan.html' }],
  },
  {
    id: 'sls_tdbh',
    category: 'sales',
    name: 'Phiếu Tổng Đài Hỗ Trợ',
    shortDesc: 'Thẻ 240px tổng đài bảo hành — tự động điền tên ST & sửa số Hotline',
    variants: [{ label: 'Bản chuẩn 21 thẻ/A4', rel: 'in-ban-hang/in-phieu-tdbh.html' }],
  },

  // 4. CÔNG VIỆC ST (4 công cụ, 6 mẫu gốc)
  {
    id: 'wrk_bangten',
    category: 'work',
    name: 'Bảng Tên Nhân Viên ST',
    shortDesc: 'Kích thước chuẩn 270x75 / 280x80 — bấm Nạp NV để điền từ danh bạ ST',
    variants: [
      { label: 'Mẫu mới (270x75px)', rel: 'in-cong-viec/in-bang-ten-new.html' },
      { label: 'Mẫu lớn (280x80px)', rel: 'in-cong-viec/in-bang-ten.html' },
    ],
  },
  {
    id: 'wrk_codetui',
    category: 'work',
    name: 'Code QR & Barcode Túi',
    shortDesc: 'Chuẩn 3 cột A4 với mã SKU POS thật (QR + CODE128 offline)',
    variants: [{ label: 'Chuẩn POS 3 cột A4', rel: 'in-cong-viec/in-code-tui.html' }],
  },
  {
    id: 'wrk_bienban',
    category: 'work',
    name: 'Biên Bản Sự Cố Nhận Hàng',
    shortDesc: 'Tự động điền giờ/ngày hiện tại, ST nhận (Bên B) & đồng bộ chữ ký',
    variants: [{ label: 'Bản chuẩn A4', rel: 'in-cong-viec/in-bb-nhan-hang.html' }],
  },
  {
    id: 'wrk_stickermay',
    category: 'work',
    name: 'Sticker Dán Máy Quầy Trải Nghiệm',
    shortDesc: 'Khung 650x320px dán máy quầy (Máy trưng bày / Liên hệ NV)',
    variants: [
      { label: 'Mẫu 01 (Máy trưng bày)', rel: 'in-cong-viec/in-sticker-may-01.html' },
      { label: 'Mẫu 02 (Liên hệ NV)', rel: 'in-cong-viec/in-sticker-may-02.html' },
    ],
  },

  // 5. TRANG TRÍ ST (2 công cụ, 28 mẫu decor)
  {
    id: 'dec_ceiling',
    category: 'decor',
    name: 'Dây Treo Trần (01–04)',
    shortDesc: '4 mẫu dây treo đen trắng nét đậm, cắt dán trang trí quầy kệ',
    variants: [{ label: 'Chọn mẫu 01–04', rel: 'decor/ceiling' }],
  },
  {
    id: 'dec_cutouts',
    category: 'decor',
    name: 'Họa Tiết Cắt Dán (24 mẫu)',
    shortDesc: 'Hoa (01–05), Ngôi sao (01–04), Ong (01–07), Bướm (01–08)',
    variants: [{ label: 'Chọn bộ 24 họa tiết', rel: 'decor/cutouts' }],
  },
];

const ALL_EXACT_TEMPLATES: ExactTemplateEntry[] = [
  ...(stickerTemplates as ExactTemplateEntry[]),
  ...(popupTemplates as ExactTemplateEntry[]),
  ...(salesTemplates as ExactTemplateEntry[]),
  ...(workTemplates as ExactTemplateEntry[]),
];

export function getExactTemplateByRel(rel: string): ExactTemplateEntry | undefined {
  return ALL_EXACT_TEMPLATES.find((item) => item.rel === rel);
}

