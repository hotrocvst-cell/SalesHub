import { useState, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { useCampaignProgressData } from './hooks/useCampaignProgressData';
import { useAuth } from '../../shared/contexts/AuthContext';
import CampaignProgressHeader from './components/CampaignProgressHeader';
import CampaignMultiSelectDropdown from './components/CampaignMultiSelectDropdown';
import CampaignProgressCard from './components/CampaignProgressCard';
import { AlertTriangle, CheckCircle2, ListFilter } from 'lucide-react';

export default function CampaignProgressPage() {
    const reportRef = useRef<HTMLDivElement>(null);
    const { currentUser, isAdmin, canConfigure } = useAuth();
    const canExportAllTables = isAdmin || canConfigure || ['ADMIN', 'QUAN_LY', 'TRUONG_CA'].includes(currentUser?.role);
    const [isExporting, setIsExporting] = useState<boolean>(false);

    const {
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        selectedStore,
        setSelectedStore,
        stores,
        sessions,
        selectedSessionId,
        setSelectedSessionId,
        activeSession,
        operatingConfig,
        loading,
        loadData,
        allCampaignProgressItems,
        displayedCampaigns,
        metrics,
        selectedCampaignKeys,
        toggleCampaignKey,
        selectAllCampaigns,
        deselectAllCampaigns,
        quickFilter,
        setQuickFilter
    } = useCampaignProgressData();

    // Định dạng ngày theo chuẩn DD-MM-YYYY hiển thị trong tiêu đề banner
    const reportDateDisplay = useMemo(() => {
        if (activeSession?.report_date) {
            const parts = activeSession.report_date.split('-');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        const day = String(operatingConfig.passedDays).padStart(2, '0');
        const month = String(selectedMonth).padStart(2, '0');
        return `${day}-${month}-${selectedYear}`;
    }, [activeSession?.report_date, operatingConfig.passedDays, selectedMonth, selectedYear]);

    // Xuất ảnh báo cáo gửi Zalo (Tuân thủ triệt để GEMINI.md: Unlimited height, No footer watermark)
    const handleExportImage = async () => {
        if (!canExportAllTables) return;
        if (!reportRef.current) return;
        setIsExporting(true);

        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                ignoreElements: (el) => el.getAttribute('data-html2canvas-ignore') === 'true',
                onclone: (clonedDoc) => {
                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.body.style.height = 'auto';
                    const el = clonedDoc.querySelector('#campaign-progress-capture-area') as HTMLElement;
                    if (el) {
                        el.style.height = 'auto';
                        el.style.maxHeight = 'none';
                        el.style.overflow = 'visible';
                        el.style.width = '850px'; // Tối ưu chiều dọc màn hình smartphone
                        el.style.padding = '12px';
                    }
                }
            });

            const link = document.createElement('a');
            const storeLabel = selectedStore === 'all' ? 'Toan_Cum' : selectedStore.replace(/\s+/g, '_');
            link.download = `Tien_Do_Thi_Dua_${storeLabel}_${reportDateDisplay}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Lỗi xuất ảnh báo cáo:', err);
            alert('Có lỗi xảy ra khi xuất ảnh báo cáo. Vui lòng thử lại.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-3 pb-12 max-w-5xl mx-auto px-2 sm:px-4 pt-2">
            {/* 1. Header Điều Khiển Tinh Gọn */}
            <CampaignProgressHeader
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                selectedStore={selectedStore}
                setSelectedStore={setSelectedStore}
                stores={stores}
                sessions={sessions}
                selectedSessionId={selectedSessionId}
                setSelectedSessionId={setSelectedSessionId}
                activeSession={activeSession}
                operatingConfig={operatingConfig}
                loading={loading}
                onRefresh={loadData}
                onExportImage={handleExportImage}
                isExporting={isExporting}
                totalTablesCount={displayedCampaigns.length}
            />

            {/* 2. Thanh Tác Vụ Bộ Lọc & Lọc Nhanh Tinh Gọn */}
            <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
                {/* Dropdown Multi-Select chọn nhiều chương trình */}
                <div className="flex items-center gap-2">
                    <CampaignMultiSelectDropdown
                        allCampaigns={allCampaignProgressItems}
                        selectedKeys={selectedCampaignKeys}
                        onToggle={toggleCampaignKey}
                        onSelectAll={selectAllCampaigns}
                        onDeselectAll={deselectAllCampaigns}
                    />
                </div>

                {/* Bộ nút Lọc Nhanh */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Nút lọc: DỰ KIẾN KHÔNG ĐẠT (Đặc biệt nổi bật) */}
                    <button
                        type="button"
                        onClick={() => setQuickFilter(quickFilter === 'NOT_ACHIEVED' ? 'ALL' : 'NOT_ACHIEVED')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                            quickFilter === 'NOT_ACHIEVED'
                                ? 'bg-rose-600 text-white ring-2 ring-rose-500/30'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        }`}
                    >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Dự kiến KHÔNG đạt</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                            quickFilter === 'NOT_ACHIEVED' ? 'bg-white/20 text-white font-black' : 'bg-rose-200 text-rose-900 font-extrabold'
                        }`}>
                            {metrics.notAchievedCampaigns}
                        </span>
                    </button>

                    {/* Nút lọc: DỰ KIẾN ĐẠT */}
                    <button
                        type="button"
                        onClick={() => setQuickFilter(quickFilter === 'ACHIEVED' ? 'ALL' : 'ACHIEVED')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-2xs ${
                            quickFilter === 'ACHIEVED'
                                ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/30'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Dự kiến Đạt</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                            quickFilter === 'ACHIEVED' ? 'bg-white/20 text-white font-black' : 'bg-emerald-200 text-emerald-900 font-extrabold'
                        }`}>
                            {metrics.achievedCampaigns}
                        </span>
                    </button>

                    {/* Nút lọc: TẤT CẢ */}
                    <button
                        type="button"
                        onClick={() => setQuickFilter('ALL')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-2xs ${
                            quickFilter === 'ALL'
                                ? 'bg-slate-800 text-white font-bold'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <ListFilter className="w-3.5 h-3.5 shrink-0" />
                        <span>Tất cả ({metrics.totalCampaigns})</span>
                    </button>
                </div>
            </div>

            {/* 3. Vùng Nội Dung Báo Cáo - Danh Sách Thẻ Thi Đua Theo Chuẩn Ảnh Mẫu */}
            <div id="campaign-progress-capture-area" ref={reportRef} className="space-y-4 pt-1">
                {loading ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
                        Đang đồng bộ dữ liệu chỉ tiêu và tiến độ thi đua...
                    </div>
                ) : displayedCampaigns.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
                        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                        <p className="text-sm font-bold text-slate-700">
                            Không tìm thấy chương trình thi đua phù hợp
                        </p>
                        <p className="text-xs text-slate-500">
                            Vui lòng điều chỉnh lại bộ lọc hoặc chọn thêm chương trình thi đua trong dropdown.
                        </p>
                    </div>
                ) : (
                    displayedCampaigns.map((item) => (
                        <CampaignProgressCard
                            key={item.campaignKey}
                            item={item}
                            reportDateDisplay={reportDateDisplay}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
