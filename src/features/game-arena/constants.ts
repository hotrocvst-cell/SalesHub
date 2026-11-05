import type { GameItem } from './types';

export const SYSTEM_GAMES_LIST: GameItem[] = [
    {
        id: 'game_2048',
        title: '2048 Doanh Số',
        subtitle: 'Ghép ô số & Chinh phục đỉnh cao',
        description: 'Vuốt màn hình để kết hợp các ô số cùng bậc, nâng hạng từ Tân Binh lên Chiến Thần 2048.',
        duration: '3 - 5 phút',
        difficulty: 'Thách thức',
        iconName: 'Sparkles',
        colorTheme: 'purple',
        tag: '🔥 HOT NHẤT',
        isReady: true
    },
    {
        id: 'game_reflex_deal',
        title: 'Bắt Deal Cấp Tốc',
        subtitle: 'Phản xạ chạm tay bắt ngàn deal hời',
        description: 'Chạm chớp nhoáng vào Đơn Hàng VIP, Voucher và KPI trong 60s. Né ngay Bom Hủy Đơn!',
        duration: '60 giây',
        difficulty: 'Dễ',
        iconName: 'Zap',
        colorTheme: 'emerald',
        tag: '⚡ XẢ STRESS',
        isReady: true
    },
    {
        id: 'game_speed_quiz',
        title: 'Đấu Trí Bán Hàng',
        subtitle: '10 câu hỏi trắc nghiệm & tình huống',
        description: 'Vừa chơi vừa giải đáp các câu đố mẹo, tình huống chăm sóc khách hàng và công nghệ thú vị.',
        duration: '3 - 5 phút',
        difficulty: 'Trung bình',
        iconName: 'Brain',
        colorTheme: 'blue',
        tag: 'ĐANG PHÁT TRIỂN',
        isReady: false
    },
    {
        id: 'game_memory_match',
        title: 'Trí Nhớ Bậc Thầy',
        subtitle: 'Lật thẻ tìm cặp phụ kiện công nghệ',
        description: 'Luyện trí nhớ ngắn hạn qua việc tìm các cặp hình ảnh phụ kiện tương đồng với lượt lật ít nhất.',
        duration: '2 - 3 phút',
        difficulty: 'Trung bình',
        iconName: 'Layers',
        colorTheme: 'amber',
        tag: 'SẮP RA MẮT',
        isReady: false
    }
];

export const TILE_RANKS: Record<number, { title: string; color: string; bg: string }> = {
    2: { title: 'Tân Binh', color: 'text-slate-700', bg: 'bg-slate-100' },
    4: { title: 'Học Việc', color: 'text-slate-800', bg: 'bg-amber-100' },
    8: { title: 'Tư Vấn', color: 'text-white', bg: 'bg-orange-400' },
    16: { title: 'Bán Hàng', color: 'text-white', bg: 'bg-orange-500' },
    32: { title: 'Chuyên Viên', color: 'text-white', bg: 'bg-red-500' },
    64: { title: 'Trưởng Ca', color: 'text-white', bg: 'bg-rose-600' },
    128: { title: 'Quản Lý', color: 'text-white', bg: 'bg-yellow-500' },
    256: { title: 'Bậc Thầy', color: 'text-white', bg: 'bg-yellow-600' },
    512: { title: 'Chiến Thần', color: 'text-white', bg: 'bg-emerald-600' },
    1024: { title: 'Tinh Hoa', color: 'text-white', bg: 'bg-indigo-600' },
    2048: { title: 'Huyền Thoại', color: 'text-white', bg: 'bg-purple-600' }
};

