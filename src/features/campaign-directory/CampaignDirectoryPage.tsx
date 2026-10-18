import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { calculate8KScale } from '../../shared/utils/exportImage';
import {
    fetchCampaignPrograms,
    saveCampaignProgram,
    batchUpsertCampaignPrograms,
    deleteCampaignProgram,
    checkCampaignProgramTableReady
} from './services/campaignProgramService';
import type { CampaignProgramItem, ViewMode } from './types';
import CampaignDirectoryHeader from './components/CampaignDirectoryHeader';
import CampaignDirectoryFilterBar from './components/CampaignDirectoryFilterBar';
import CampaignProgramCard from './components/CampaignProgramCard';
import CampaignProgramTable from './components/CampaignProgramTable';
import CampaignProgramEditModal from './components/CampaignProgramEditModal';
import CampaignProgramPasteModal from './components/CampaignProgramPasteModal';
import CampaignProgramSqlModal from './components/CampaignProgramSqlModal';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useUserStoreCampaignFilter } from './hooks/useUserStoreCampaignFilter';
import { fetchCampaignDictionary, type CampaignDictItem } from '../../core/lib/storage';
import { matchCampaignDictionary } from './utils/campaignExcelHelper';
import { CheckCircle2, Sparkles, AlertCircle, Copy, Download, Camera } from 'lucide-react';

export default function CampaignDirectoryPage() {
    const reportCaptureRef = useRef<HTMLDivElement>(null);
    const { currentUser, isAdmin } = useAuth();

    // =========================================================================
    // YÊU CẦU 1: CHỈ ADMIN MỚI CÓ QUYỀN CHỈNH SỬA DỮ LIỆU CÁC CHƯƠNG TRÌNH THI ĐUA
    // (QUẢN LÝ, TRƯỞNG CA, NHÂN VIÊN CHỈ ĐƯỢC XEM, TRA CỨU, CHỌN VÀ XUẤT BÁO CÁO)
    // =========================================================================
    const canManage = isAdmin || currentUser?.role === 'ADMIN';

    // 1. Dữ liệu chương trình thi đua
    const [programs, setPrograms] = useState<CampaignProgramItem[]>([]);
    const [campaignDict, setCampaignDict] = useState<CampaignDictItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [cloudSource, setCloudSource] = useState<'cloud' | 'local'>('local');
    const [isCloudReady, setIsCloudReady] = useState<boolean>(false);
    const [isCheckingCloud, setIsCheckingCloud] = useState<boolean>(false);

    // 2. Bộ lọc & Tìm kiếm
    const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [orientationFilter, setOrientationFilter] = useState<string>('ALL');
    const [calcFilter, setCalcFilter] = useState<string>('ALL');

    // Số chương trình chưa mapping viết tắt
    const unmappedCount = useMemo(() => {
        return programs.filter(p => !p.short_name).length;
    }, [programs]);

    // 2b. Tùy chọn ẩn/hiển thị Cơ hội & CTKM (Lưu bộ nhớ trình duyệt)
    const [showOpportunity, setShowOpportunity] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('campaign_directory_show_opportunity');
            return saved !== null ? saved === 'true' : true;
        } catch {
            return true;
        }
    });

    const handleToggleShowOpportunity = (val: boolean) => {
        setShowOpportunity(val);
        try {
            localStorage.setItem('campaign_directory_show_opportunity', String(val));
        } catch (e) {
            console.error('Không thể lưu tùy chọn CTKM:', e);
        }
        showToast(val ? '👁️ Đã bật hiển thị thông tin Cơ hội & CTKM' : '🙈 Đã ẩn thông tin Cơ hội & CTKM');
    };

    // 3. Danh sách ID đang được checkbox chọn
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 4. Chế độ xem
    const [viewMode, setViewMode] = useState<ViewMode>('CARD');

    // 5. Trạng thái Modals
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
    const [editingItem, setEditingItem] = useState<CampaignProgramItem | null>(null);
    const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
    const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);

    // 6. Trạng thái xuất ảnh & Toast
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // =========================================================================
    // YÊU CẦU 2: TỰ ĐỘNG CHỌN CÁC CHƯƠNG TRÌNH THI ĐUA THEO SIÊU THỊ CỦA USER
    // LẤY THEO DANH SÁCH CÁC CHƯƠNG TRÌNH CÓ KHAI BÁO MỤC TIÊU TỪ BÁO CÁO LŨY KẾ THÁNG
    // =========================================================================
    const {
        selectedStore,
        setSelectedStore,
        storeOptions,
        isStoreSelectable,
        storeTargetsCount,
        matchedProgramIds,
        onlyShowStoreTargets,
        setOnlyShowStoreTargets,
        handleAutoSelectStoreTargets,
        loadingTargets,
        reportMonthDisplay,
        userStoreLabel
    } = useUserStoreCampaignFilter(
        programs,
        (newSelectedIds) => setSelectedIds(newSelectedIds),
        showToast
    );

    // Nạp dữ liệu
    const loadPrograms = async () => {
        setLoading(true);
        try {
            const [res, dictRes] = await Promise.all([
                fetchCampaignPrograms(),
                fetchCampaignDictionary()
            ]);
            setPrograms(res.data);
            setCloudSource(res.source);
            setIsCloudReady(res.cloudReady);
            if (dictRes.success && dictRes.data) {
                setCampaignDict(dictRes.data);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPrograms();
    }, []);

    // Tự động mapping toàn bộ chương trình chưa có short_name với Từ điển thi đua
    const handleAutoMapAllWithDict = async () => {
        if (!canManage) {
            showToast('⛔ Chỉ Admin mới có quyền mapping Từ điển thi đua!');
            return;
        }
        let count = 0;
        const updated = programs.map(p => {
            if (!p.short_name) {
                const m = matchCampaignDictionary(p.program_name, campaignDict);
                if (m) {
                    count++;
                    return { ...p, short_name: m.short_name, mapped_key: m.mapped_key };
                }
            }
            return p;
        });

        if (count > 0) {
            await batchUpsertCampaignPrograms(updated);
            setPrograms(updated);
            showToast(`⚡ Đã tự động mapping thành công ${count} chương trình với Từ điển thi đua!`);
        } else {
            showToast('ℹ️ Toàn bộ chương trình đã được mapping hoặc không tìm thấy mục tương ứng.');
        }
    };

    // Danh sách các nhóm thi đua hiện có
    const groups = useMemo(() => {
        const set = new Set<string>();
        programs.forEach(p => {
            if (p.group_name && p.group_name.trim()) set.add(p.group_name.trim());
        });
        return Array.from(set);
    }, [programs]);

    // Danh sách đã lọc theo các tiêu chí (kèm lọc chỉ xem chương trình có mục tiêu nếu bật toggle)
    const filteredPrograms = useMemo(() => {
        return programs.filter(item => {
            // Lọc theo mục tiêu siêu thị nếu đang bật checkbox
            if (onlyShowStoreTargets && !matchedProgramIds.includes(item.id)) {
                return false;
            }
            // Lọc theo nhóm
            if (selectedGroup !== 'ALL' && item.group_name !== selectedGroup) {
                return false;
            }
            // Lọc theo định hướng
            if (orientationFilter !== 'ALL' && item.orientation !== orientationFilter) {
                return false;
            }
            // Lọc theo cách tính
            if (calcFilter !== 'ALL' && item.calculation_method !== calcFilter) {
                return false;
            }
            // Lọc theo tìm kiếm từ khóa
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = item.program_name.toLowerCase().includes(q);
                const matchShort = (item.short_name || '').toLowerCase().includes(q);
                const matchMapped = (item.mapped_key || '').toLowerCase().includes(q);
                const matchRules = item.rules.toLowerCase().includes(q);
                const matchOpp = (item.opportunity || '').toLowerCase().includes(q);
                const matchGroup = item.group_name.toLowerCase().includes(q);
                const matchStatus = item.product_status.toLowerCase().includes(q);
                if (!matchName && !matchShort && !matchMapped && !matchRules && !matchOpp && !matchGroup && !matchStatus) {
                    return false;
                }
            }
            return true;
        });
    }, [programs, onlyShowStoreTargets, matchedProgramIds, selectedGroup, orientationFilter, calcFilter, searchQuery]);

    // Checkbox toggle
    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const isAllSelected = useMemo(() => {
        if (filteredPrograms.length === 0) return false;
        return filteredPrograms.every(p => selectedIds.has(p.id));
    }, [filteredPrograms, selectedIds]);

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredPrograms.map(p => p.id)));
        }
    };

    const handleSelectAllFiltered = () => {
        setSelectedIds(new Set(filteredPrograms.map(p => p.id)));
        showToast(`Đã chọn toàn bộ ${filteredPrograms.length} chương trình thi đua!`);
    };

    const handleClearSelection = () => {
        setSelectedIds(new Set());
    };

    // Thao tác CRUD (Bảo vệ: Chỉ Admin mới có quyền)
    const handleOpenAddModal = () => {
        if (!canManage) {
            showToast('⛔ Chỉ Admin mới có quyền thêm mới chương trình thi đua!');
            return;
        }
        setEditingItem(null);
        setIsEditModalOpen(true);
    };

    const handleOpenEditModal = (item: CampaignProgramItem) => {
        if (!canManage) {
            showToast('⛔ Chỉ Admin mới có quyền chỉnh sửa chương trình thi đua!');
            return;
        }
        setEditingItem(item);
        setIsEditModalOpen(true);
    };

    const handleSaveProgram = async (item: Partial<CampaignProgramItem>): Promise<boolean> => {
        if (!canManage) {
            showToast('⛔ Chỉ Admin mới có quyền lưu chỉnh sửa chương trình thi đua!');
            return false;
        }
        const res = await saveCampaignProgram(item);
        if (res.success && res.data) {
            setPrograms(prev => {
                const idx = prev.findIndex(x => x.id === res.data!.id);
                if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = res.data!;
                    return copy;
                }
                return [res.data!, ...prev];
            });
            showToast(`✅ Đã lưu chương trình "${res.data.program_name}" thành công!`);
            return true;
        } else {
            showToast(`❌ Lỗi: ${res.error || 'Không thể lưu'}`);
            return false;
        }
    };

    const handleBatchSave = async (items: CampaignProgramItem[], replaceAll: boolean): Promise<boolean> => {
        if (!canManage) {
            showToast('⛔ Chỉ Admin mới có quyền dán và lưu hàng loạt chương trình thi đua!');
            return false;
        }
        const res = await batchUpsertCampaignPrograms(items);
        if (res.success) {
            setPrograms(items);
            showToast(`🎉 Đã áp dụng thành công ${items.length} chương trình thi đua!`);
            return true;
        }
        showToast(`❌ Lỗi lưu dữ liệu: ${res.error}`);
        return false;
    };

    const handleDeleteProgram = async (id: string, name: string) => {
        if (!canManage) {
            showToast('⛔ Chỉ Admin mới có quyền xóa chương trình thi đua!');
            return;
        }
        if (!window.confirm(`Bạn có chắc chắn muốn xóa chương trình "${name}" không?`)) {
            return;
        }
        await deleteCampaignProgram(id);
        setPrograms(prev => prev.filter(x => x.id !== id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        showToast(`🗑️ Đã xóa chương trình "${name}"`);
    };

    // Kiểm tra lại Supabase
    const handleRecheckCloud = async () => {
        setIsCheckingCloud(true);
        try {
            const res = await checkCampaignProgramTableReady();
            setIsCloudReady(res.exists);
            if (res.exists) {
                showToast('🟢 Đã kết nối Supabase Cloud thành công!');
                loadPrograms();
            } else {
                showToast('🟡 Chưa tìm thấy bảng campaign_programs trên Supabase');
            }
        } finally {
            setIsCheckingCloud(false);
        }
    };

    // Danh sách các chương trình sẽ được xuất ảnh tổng hợp:
    // Nếu có tick chọn -> xuất các mục được tick; nếu chưa tick mục nào -> xuất toàn bộ danh sách đang hiển thị
    const programsToExport = useMemo(() => {
        if (selectedIds.size > 0) {
            return programs.filter(p => selectedIds.has(p.id));
        }
        return filteredPrograms;
    }, [programs, selectedIds, filteredPrograms]);

    // XUẤT ẢNH BÁO CÁO TỔNG HỢP (Tuân thủ Rule 2: Portrait 780px, Unlimited Height, NO Watermark)
    const [isCopyingImage, setIsCopyingImage] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);

    // TẠO CANVAS BÁO CÁO TỔNG HỢP (Tuân thủ Rule 2: Portrait 780px, Unlimited Height, NO Watermark)
    const generateDirectoryCanvas = async (): Promise<HTMLCanvasElement | null> => {
        const targetEl = reportCaptureRef.current;
        if (!targetEl) throw new Error('Không tìm thấy vùng báo cáo để chụp');

        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        const targetWidth = 780;
        const scale = calculate8KScale(targetEl, targetWidth);
        return await html2canvas(targetEl, {
            scale: scale,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: targetWidth,
            windowWidth: targetWidth + 40,
            scrollX: 0,
            scrollY: 0,
            ignoreElements: (el) =>
                el.getAttribute('data-export-ignore') === 'true' ||
                el.getAttribute('data-html2canvas-ignore') === 'true',
            onclone: (clonedDoc) => {
                const fontStyle = clonedDoc.createElement('style');
                fontStyle.innerHTML = `
                    @font-face {
                        font-family: 'UTM Avo';
                        src: url('/fonts/UTM-Avo.ttf') format('truetype');
                        font-weight: 400;
                        font-style: normal;
                    }
                    @font-face {
                        font-family: 'UTM Avo';
                        src: url('/fonts/UTM-AvoBold.ttf') format('truetype');
                        font-weight: 700;
                        font-style: normal;
                    }
                    * { -webkit-font-smoothing: antialiased; box-sizing: border-box; }
                `;
                clonedDoc.head.appendChild(fontStyle);

                clonedDoc.documentElement.style.height = 'auto';
                clonedDoc.documentElement.style.maxHeight = 'none';
                clonedDoc.documentElement.style.overflow = 'visible';
                clonedDoc.body.style.height = 'auto';
                clonedDoc.body.style.maxHeight = 'none';
                clonedDoc.body.style.overflow = 'visible';

                const clonedContainer = clonedDoc.querySelector('[data-export-container="true"]') as HTMLElement;
                if (clonedContainer) {
                    clonedContainer.style.width = `${targetWidth}px`;
                    clonedContainer.style.maxWidth = `${targetWidth}px`;
                    clonedContainer.style.minWidth = `${targetWidth}px`;
                    clonedContainer.style.height = 'auto';
                    clonedContainer.style.maxHeight = 'none';
                    clonedContainer.style.overflow = 'visible';
                    clonedContainer.style.margin = '0 auto';
                    clonedContainer.style.padding = '20px';
                    clonedContainer.style.paddingBottom = '30px';
                    clonedContainer.style.backgroundColor = '#ffffff';
                }
            }
        });
    };

    // XUẤT ẢNH BÁO CÁO TỔNG HỢP (Tải file PNG)
    const handleExportSelectedImage = async () => {
        if (programsToExport.length === 0) {
            showToast('⚠️ Không có chương trình nào để xuất ảnh!');
            return;
        }

        setIsExporting(true);
        showToast('⏳ Đang chuẩn bị xuất ảnh báo cáo tổng hợp chất lượng cao...');

        try {
            const canvas = await generateDirectoryCanvas();
            if (!canvas) throw new Error('Không thể tạo canvas');

            const link = document.createElement('a');
            const nowStr = new Date().toISOString().slice(0, 10);
            link.download = `Tong_Hop_Thi_Dua_${nowStr}_8K.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            showToast('🎉 Đã tải file ảnh 8K báo cáo thành công!');
        } catch (e: any) {
            console.error('Lỗi xuất ảnh tổng hợp:', e);
            showToast(`⚠️ Không thể xuất ảnh: ${e?.message || 'Lỗi không xác định'}`);
        } finally {
            setIsExporting(false);
        }
    };

    // SAO CHÉP ẢNH BÁO CÁO VÀO CLIPBOARD (Dán ngay vào Messaging App)
    const handleCopySelectedImage = async () => {
        if (programsToExport.length === 0) {
            showToast('⚠️ Không có chương trình nào để sao chép ảnh!');
            return;
        }

        setIsCopyingImage(true);
        showToast('⏳ Đang tạo ảnh để sao chép vào Clipboard...');

        try {
            const canvas = await generateDirectoryCanvas();
            if (!canvas) throw new Error('Không thể tạo canvas');

            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (blob && navigator.clipboard?.write) {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                setCopySuccess(true);
                showToast('📋 Đã sao chép ảnh 8K vào Clipboard! Nhấn Ctrl + V để dán ngay.');
                setTimeout(() => setCopySuccess(false), 3000);
            } else {
                throw new Error('Trình duyệt chưa hỗ trợ ghi ảnh trực tiếp');
            }
        } catch (e: any) {
            console.error('Lỗi copy ảnh:', e);
            showToast('⚠️ Không thể copy ảnh trực tiếp, tự động chuyển sang tải file');
            handleExportSelectedImage();
        } finally {
            setIsCopyingImage(false);
        }
    };

    // 3 MẪU NHẬN XÉT TIÊU CHUẨN CHO TRA CỨU THI ĐUA
    const assessmentTemplates = useMemo(() => {
        const storeLabel = selectedStore === 'all' ? 'Toàn Cụm' : selectedStore;
        const total = programsToExport.length;

        // Mẫu 1: Tổng quan thể lệ & mục tiêu
        const t1Lines = [
            `📢 [TỔNG QUAN CHƯƠNG TRÌNH THI ĐUA - ${storeLabel.toUpperCase()}]`,
            `📅 Thời gian áp dụng: ${reportMonthDisplay || 'Kỳ thi đua hiện tại'}`,
            `🎯 Tổng số chương trình áp dụng: ${total} chương trình`,
            `----------------------------------------`,
            `📌 ĐỊNH HƯỚNG CỐT LÕI:`,
            `• Quản lý & Nhân viên chủ động bám sát thể lệ tính thưởng từng ngành hàng.`,
            `• Ưu tiên nhóm hàng chủ lực có hệ số điểm cao để tối ưu thu nhập.`,
            `----------------------------------------`,
            `💪 Toàn đội nắm chắc thể lệ để tư vấn tự tin và đạt thành tích cao nhất!`
        ];

        // Mẫu 2: Trọng tâm & Cơ hội CTKM
        const programsWithOpp = programsToExport.filter(p => p.opportunity && p.opportunity.trim());
        const t2Lines = [
            `🔥 [TRỌNG TÂM CTKM & CƠ HỘI ĐỘT PHÁ DOANH SỐ - ${storeLabel.toUpperCase()}]`,
            `🎯 Có ${programsWithOpp.length}/${total} chương trình đang có cơ hội & CTKM cực tốt!`,
            `----------------------------------------`
        ];
        if (programsWithOpp.length > 0) {
            t2Lines.push(`🌟 CÁC CƠ HỘI ĐẶC BIỆT CẦN TẬN DỤNG:`);
            programsWithOpp.slice(0, 5).forEach((p, i) => {
                t2Lines.push(`${i + 1}. ${p.program_name}: ${p.opportunity}`);
            });
            t2Lines.push(`----------------------------------------`);
        }
        t2Lines.push(`⚡ Mọi người tận dụng triệt để CTKM để chốt deal nhanh cho khách hàng!`);

        // Mẫu 3: Kế hoạch hành động cụ thể
        const t3Lines = [
            `⚡ [KẾ HOẠCH HÀNH ĐỘNG TRIỂN KHAI THI ĐUA - ${storeLabel.toUpperCase()}]`,
            `🎯 Mục tiêu: 100% nhân sự hoàn thành vượt mức chỉ tiêu được giao.`,
            `----------------------------------------`,
            `📋 CHECKLIST HÀNH ĐỘNG BẮT BUỘC MỖI CA:`,
            `1. Đầu ca: Kiểm tra lại các chương trình thi đua đang chạy trong ngày.`,
            `2. Giữa ca: Chủ động giới thiệu CTKM và quà tặng kèm cho khách hàng.`,
            `3. Cuối ca: Đối soát sản lượng đạt được, ghi nhận số liệu về đích.`,
            `----------------------------------------`,
            `🚀 Quyết tâm bứt phá mục tiêu thi đua tháng này!`
        ];

        return [
            {
                id: 'template_overview',
                label: 'Mẫu 1: Tổng quan thể lệ',
                description: 'Tóm tắt danh mục chương trình thi đua đang áp dụng',
                content: t1Lines.join('\n')
            },
            {
                id: 'template_promotion',
                label: 'Mẫu 2: Trọng tâm & CTKM',
                description: 'Nêu bật cơ hội CTKM và điểm thưởng hấp dẫn',
                content: t2Lines.join('\n')
            },
            {
                id: 'template_action',
                label: 'Mẫu 3: Kế hoạch hành động',
                description: 'Hướng dẫn cụ thể các bước thực thi cho từng ca làm việc',
                content: t3Lines.join('\n')
            }
        ];
    }, [programsToExport, selectedStore, reportMonthDisplay]);

    // Sao chép Text Zalo tổng hợp
    const handleCopyAllZaloText = async () => {
        if (programsToExport.length === 0) {
            showToast('⚠️ Không có chương trình nào để sao chép!');
            return;
        }

        const dateStr = new Date().toLocaleDateString('vi-VN');
        const header = `📢 [TỔNG HỢP CÁC CHƯƠNG TRÌNH THI ĐUA - CẬP NHẬT ${dateStr}]
Số lượng: ${programsToExport.length} chương trình
========================================\n`;

        const body = programsToExport.map((p, idx) => {
            const oppText = showOpportunity && p.opportunity ? `\n• Cơ hội & CTKM: ${p.opportunity}` : '';
            return `🔥 #${idx + 1}. ${p.program_name.toUpperCase()}
• Nhóm: ${p.group_name} | Định hướng: ${p.orientation} | Tính: ${p.calculation_method}
• Thể lệ: ${p.rules}${oppText}
----------------------------------------`;
        }).join('\n\n');

        try {
            await navigator.clipboard.writeText(`${header}\n${body}`);
            showToast('📋 Đã sao chép toàn bộ nội dung Zalo vào Clipboard!');
        } catch {
            showToast('⚠️ Không thể copy text vào bộ nhớ tạm');
        }
    };

    return (
        <div className="max-w-[1720px] mx-auto space-y-4 pb-20 font-avo antialiased">
            {/* Toast Thông Báo */}
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="font-semibold">{toastMessage}</span>
                </div>
            )}

            {/* 1. Header Trang & Các Nút Hành Động */}
            <CampaignDirectoryHeader
                totalPrograms={programs.length}
                activeCount={programs.filter(p => p.is_active).length}
                groupCount={groups.length}
                selectedCount={selectedIds.size}
                viewMode={viewMode}
                onToggleViewMode={setViewMode}
                onOpenAddModal={handleOpenAddModal}
                onOpenPasteModal={() => setIsPasteModalOpen(true)}
                onExportSelectedImage={handleExportSelectedImage}
                onCopySelectedImage={handleCopySelectedImage}
                onCopyAllZaloText={handleCopyAllZaloText}
                onOpenSqlModal={() => setIsSqlModalOpen(true)}
                isCloudReady={isCloudReady}
                cloudSource={cloudSource}
                canManage={canManage}
                isExporting={isExporting}
                isCopyingImage={isCopyingImage}
                copySuccess={copySuccess}
                assessmentTemplates={assessmentTemplates}
                periodLabel={reportMonthDisplay}
                storeName={selectedStore === 'all' ? 'Toàn Cụm' : selectedStore}
                onAutoMapDictionary={handleAutoMapAllWithDict}
                unmappedCount={unmappedCount}
            />

            {/* 2. Thanh Bộ Lọc & Lựa Chọn Checkbox (Tuân thủ Mục 10 - Store-first on dedicated row) */}
            <CampaignDirectoryFilterBar
                selectedStore={selectedStore}
                onSelectStore={setSelectedStore}
                storeOptions={storeOptions}
                isStoreSelectable={isStoreSelectable}
                storeTargetsCount={storeTargetsCount}
                matchedTargetsCount={matchedProgramIds.length}
                onlyShowStoreTargets={onlyShowStoreTargets}
                onToggleOnlyShowStoreTargets={setOnlyShowStoreTargets}
                onAutoSelectStoreTargets={handleAutoSelectStoreTargets}
                loadingTargets={loadingTargets}
                reportMonthDisplay={reportMonthDisplay}
                userStoreLabel={userStoreLabel}
                groups={groups}
                selectedGroup={selectedGroup}
                onSelectGroup={setSelectedGroup}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                orientationFilter={orientationFilter}
                onOrientationChange={setOrientationFilter}
                calcFilter={calcFilter}
                onCalcChange={setCalcFilter}
                showOpportunity={showOpportunity}
                onToggleShowOpportunity={handleToggleShowOpportunity}
                selectedCount={selectedIds.size}
                totalCount={programs.length}
                filteredCount={filteredPrograms.length}
                isAllSelected={isAllSelected}
                onToggleSelectAll={handleToggleSelectAll}
                onSelectAllFiltered={handleSelectAllFiltered}
                onClearSelection={handleClearSelection}
            />

            {/* 3. VÙNG HIỂN THỊ DỮ LIỆU CHÍNH & VÙNG CHỤP ẢNH XUẤT BÁO CÁO */}
            <div
                ref={reportCaptureRef}
                data-export-container="true"
                className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4"
            >
                {/* Banner Tiêu Đề Xuất Ảnh (Chỉ hiện khi xuất ảnh hoặc trên poster) */}
                <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white rounded-2xl p-4 text-center shadow-xs space-y-1">
                    <div className="flex items-center justify-center gap-1.5 text-amber-300 text-xs font-black uppercase tracking-widest">
                        <Sparkles className="w-4 h-4 fill-amber-300 text-amber-300" />
                        <span>HỆ THỐNG SALES HUB • BẢNG TRA CỨU THI ĐUA</span>
                    </div>
                    <h2 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-white">
                        Cẩm Nang Chương Trình Thi Đua Kinh Doanh
                    </h2>
                    <p className="text-[11px] sm:text-xs text-blue-100 font-medium">
                        {selectedStore !== 'all' ? `🏪 Siêu thị: ${userStoreLabel} • ` : ''}
                        Tổng hợp {programsToExport.length} chương trình thi đua trọng tâm • Cập nhật ngày {new Date().toLocaleDateString('vi-VN')}
                    </p>
                </div>

                {/* Danh Sách Thẻ hoặc Bảng */}
                {viewMode === 'CARD' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
                        {programsToExport.map(item => (
                            <CampaignProgramCard
                                key={item.id}
                                item={item}
                                isSelected={selectedIds.has(item.id)}
                                showOpportunity={showOpportunity}
                                onToggleSelect={handleToggleSelect}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteProgram}
                                canManage={canManage}
                            />
                        ))}
                    </div>
                ) : (
                    <CampaignProgramTable
                        items={programsToExport}
                        selectedIds={selectedIds}
                        showOpportunity={showOpportunity}
                        onToggleSelect={handleToggleSelect}
                        onToggleSelectAll={handleToggleSelectAll}
                        isAllSelected={isAllSelected}
                        onEdit={handleOpenEditModal}
                        onDelete={handleDeleteProgram}
                        canManage={canManage}
                    />
                )}
            </div>

            {/* 4. Các Modals Nghiệp Vụ */}
            <CampaignProgramEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSaveProgram}
                editingItem={editingItem}
                existingGroups={groups}
                campaignDict={campaignDict}
            />

            <CampaignProgramPasteModal
                isOpen={isPasteModalOpen}
                onClose={() => setIsPasteModalOpen(false)}
                onBatchSave={handleBatchSave}
                currentPrograms={programs}
                campaignDict={campaignDict}
            />

            <CampaignProgramSqlModal
                isOpen={isSqlModalOpen}
                onClose={() => setIsSqlModalOpen(false)}
                isCloudReady={isCloudReady}
                cloudSource={cloudSource}
                onRecheck={handleRecheckCloud}
                isChecking={isCheckingCloud}
            />
        </div>
    );
}
