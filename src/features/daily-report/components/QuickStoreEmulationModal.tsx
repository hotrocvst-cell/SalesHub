import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    X,
    Camera,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Save,
    Trash2,
    Plus,
    Store,
    Clock,
    UploadCloud,
    Clipboard,
    KeyRound,
    AlertTriangle,
    RotateCcw
} from 'lucide-react';
import {
    fetchStores,
    type StoreItem,
    type CampaignDictItem
} from '../../../core/lib/storage';
import {
    getShortStoreName,
    formatStoreDisplayName,
    isStoreMatch,
    deduplicateStoreNames,
    formatValue,
    cleanBiNumber,
    formatDate
} from '../../../core/lib/formatters';
import { useAuth } from '../../../shared/contexts/AuthContext';
import type { StoreMobileEmulationCardItem } from '../../data-update/types/ocrTypes';
import {
    extractStoreMobileEmulationCardsBatch
} from '../../data-update/services/geminiVisionOcrService';
import {
    resolveActiveGeminiKey,
    fetchAdminGeminiKeyCloud,
    GeminiQuotaExceededError,
    type ActiveKeyInfo
} from '../../data-update/services/geminiApiKeyService';
import GeminiApiKeyModal from '../../data-update/components/GeminiApiKeyModal';
import {
    convertMobileCardsToCampaignItems,
    saveSingleStoreEmulationSession,
    type RealtimeStoreSessionRecord
} from '../services/realtimeSessionService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    availableStores: StoreItem[];
    existingSessions?: RealtimeStoreSessionRecord[];
    campaignDict: CampaignDictItem[];
    defaultSelectedStore?: string;
    currentUserName?: string;
    isAdmin: boolean;
    onSavedSuccessfully?: (updatedSessions: RealtimeStoreSessionRecord[]) => void;

    // Chế độ mở rộng cho trang Cập Nhật Lũy Kế (/cap-nhat-ocr)
    mode?: 'REALTIME_SESSION' | 'DAILY_BUSINESS_RECORD';
    reportDate?: string;
    passedDays?: number;
    totalDays?: number;
    onApplyDailyRecord?: (storeName: string, cards: StoreMobileEmulationCardItem[], saveCloud: boolean) => Promise<void> | void;
}

export default function QuickStoreEmulationModal({
    isOpen,
    onClose,
    availableStores,
    existingSessions = [],
    campaignDict,
    defaultSelectedStore = 'Tổng',
    currentUserName = 'ADMIN',
    isAdmin,
    onSavedSuccessfully,
    mode = 'REALTIME_SESSION',
    reportDate,
    passedDays,
    totalDays,
    onApplyDailyRecord
}: Props) {
    if (!isOpen) return null;

    const { currentUser, isAdmin: authIsAdmin, canAccessStore } = useAuth();
    const effectiveIsAdmin = Boolean(isAdmin || authIsAdmin || currentUser?.role === 'ADMIN');

    // Tự động tải availableStores nếu component cha chưa tải kịp
    const [localStores, setLocalStores] = useState<StoreItem[]>(availableStores);
    useEffect(() => {
        if (availableStores && availableStores.length > 0) {
            setLocalStores(availableStores);
        } else {
            fetchStores().then(res => {
                if (res.success && res.data && res.data.length > 0) {
                    setLocalStores(res.data);
                }
            });
        }
    }, [availableStores]);

    const activeAvailableStores = useMemo(() => {
        return (localStores && localStores.length > 0) ? localStores : availableStores;
    }, [localStores, availableStores]);

    // 1. Tập hợp danh sách các siêu thị được phân quyền
    const permittedStores = useMemo<StoreItem[]>(() => {
        // Hợp nhất danh sách siêu thị từ activeAvailableStores và user profile
        const masterList: StoreItem[] = [...activeAvailableStores];
        const userStores = [
            currentUser?.store_name,
            ...(currentUser?.accessible_stores || [])
        ].filter(Boolean) as string[];

        userStores.forEach(ust => {
            if (!masterList.some(s => isStoreMatch(s.name, ust, masterList))) {
                masterList.push({ name: ust, code: '' });
            }
        });

        if (effectiveIsAdmin) {
            return masterList;
        }

        const isGuest = Boolean(currentUser?.is_guest);
        if (isGuest) {
            const guestTarget = currentUser?.store_name || '838679';
            return masterList.filter(s => isStoreMatch(s.name, guestTarget, masterList));
        }

        if (currentUser?.role === 'NHAN_VIEN') {
            if (!currentUser?.store_name) return [];
            return masterList.filter(s => isStoreMatch(s.name, currentUser.store_name, masterList));
        }

        // Quản lý hoặc Trưởng ca
        const accessible = currentUser?.accessible_stores && currentUser.accessible_stores.length > 0
            ? currentUser.accessible_stores
            : (currentUser?.store_name ? [currentUser.store_name] : []);

        return masterList.filter(s =>
            canAccessStore(s.name) ||
            canAccessStore(getShortStoreName(s.name)) ||
            accessible.some(acc => isStoreMatch(s.name, acc, masterList))
        );
    }, [activeAvailableStores, effectiveIsAdmin, currentUser, canAccessStore]);

    // 2. Chuẩn hóa tên chuẩn (ưu tiên mã số) và khử trùng lặp triệt để
    const storeOptions = useMemo<string[]>(() => {
        // Rút trích danh sách tên từ permittedStores
        const rawNames: string[] = permittedStores.map(s => {
            if (s.code && !s.name.startsWith(s.code)) {
                return `${s.code} - ${s.name.replace(/^\d+\s*[-–—._]\s*/, '')}`;
            }
            return s.name;
        });

        // Khử trùng lặp
        return deduplicateStoreNames(rawNames, activeAvailableStores);
    }, [permittedStores, activeAvailableStores]);

    // Khởi tạo siêu thị mặc định (nếu defaultSelectedStore hợp lệ và user có quyền)
    const [selectedStore, setSelectedStore] = useState<string>(() => {
        if (defaultSelectedStore && !/^(tổng|tong|all|toàn cụm)/i.test(defaultSelectedStore)) {
            const match = storeOptions.find(s => isStoreMatch(s, defaultSelectedStore, activeAvailableStores) || s === defaultSelectedStore);
            if (match) return match;
        }
        if (currentUser?.store_name) {
            const userStoreMatch = storeOptions.find(s => isStoreMatch(s, currentUser.store_name, activeAvailableStores));
            if (userStoreMatch) return userStoreMatch;
        }
        return storeOptions[0] || '';
    });

    // Đồng bộ lại selectedStore khi mở modal hoặc danh sách options thay đổi
    useEffect(() => {
        if (!isOpen || storeOptions.length === 0) return;
        const isCurrentValid = storeOptions.some(s => isStoreMatch(s, selectedStore, activeAvailableStores) || s === selectedStore);
        if (!isCurrentValid || (defaultSelectedStore && !/^(tổng|tong|all|toàn cụm)/i.test(defaultSelectedStore))) {
            let nextStore = '';
            if (defaultSelectedStore && !/^(tổng|tong|all|toàn cụm)/i.test(defaultSelectedStore)) {
                const match = storeOptions.find(s => isStoreMatch(s, defaultSelectedStore, activeAvailableStores) || s === defaultSelectedStore);
                if (match) nextStore = match;
            }
            if (!nextStore && currentUser?.store_name) {
                const userStoreMatch = storeOptions.find(s => isStoreMatch(s, currentUser.store_name, activeAvailableStores));
                if (userStoreMatch) nextStore = userStoreMatch;
            }
            if (!nextStore) {
                nextStore = storeOptions[0] || '';
            }
            if (nextStore && nextStore !== selectedStore) {
                setSelectedStore(nextStore);
            }
        }
    }, [isOpen, defaultSelectedStore, storeOptions, activeAvailableStores]);

    // 1. Quản lý danh sách file ảnh (upload hoặc Ctrl+V)
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 2. Gemini API Key
    const [keyInfo, setKeyInfo] = useState<ActiveKeyInfo>(() => resolveActiveGeminiKey());
    const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
    const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);

    // 3. Tiến trình trích xuất OCR
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [progressText, setProgressText] = useState<string>('');
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const [ocrError, setOcrError] = useState<string>('');
    const [screenshotTimeStr, setScreenshotTimeStr] = useState<string>('');

    // 4. Danh sách thẻ thi đua đã bóc tách
    const [cards, setCards] = useState<StoreMobileEmulationCardItem[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    // Đọc key từ Cloud khi mở modal
    useEffect(() => {
        fetchAdminGeminiKeyCloud().then(() => {
            setKeyInfo(resolveActiveGeminiKey());
        });
    }, []);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3000);
    };

    // Hỗ trợ dán ảnh trực tiếp từ Clipboard (Ctrl + V) trên toàn Modal
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            const pastedFiles: File[] = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        const renamedFile = new File([file], `clipboard_${Date.now()}_${i + 1}.png`, { type: file.type });
                        pastedFiles.push(renamedFile);
                    }
                }
            }

            if (pastedFiles.length > 0) {
                e.preventDefault();
                setFiles(prev => [...prev, ...pastedFiles]);
                showToast(`📋 Đã nhận ${pastedFiles.length} ảnh dán từ Clipboard (Ctrl+V)!`);
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, []);

    // Kéo thả file
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (dropped.length > 0) {
                setFiles(prev => [...prev, ...dropped]);
                showToast(`📁 Đã thêm ${dropped.length} ảnh kéo thả!`);
            }
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const selected = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        if (selected.length > 0) {
            setFiles(prev => [...prev, ...selected]);
            showToast(`📁 Đã thêm ${selected.length} ảnh từ thiết bị!`);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleClearAll = () => {
        setFiles([]);
        setCards([]);
        setOcrError('');
    };

    // Chạy OCR bóc tách thẻ thi đua
    const handleRunOcr = async () => {
        const activeKey = keyInfo.key;
        if (!activeKey) {
            setIsKeyModalOpen(true);
            return;
        }

        if (files.length === 0) {
            showToast('⚠️ Vui lòng chọn hoặc dán ít nhất 1 ảnh chụp thẻ!');
            return;
        }

        setIsExtracting(true);
        setOcrError('');
        setProgressText('Đang khởi tạo Gemini Vision...');
        setProgressPercent(10);

        try {
            const result = await extractStoreMobileEmulationCardsBatch(
                activeKey,
                files,
                (msg, pct) => {
                    setProgressText(msg);
                    setProgressPercent(pct);
                },
                keyInfo.source
            );

            if (!result.cards || result.cards.length === 0) {
                setOcrError(result.errors?.join('; ') || 'Không tìm thấy thẻ thi đua nào trong ảnh. Hãy kiểm tra ảnh có rõ nét không.');
                setIsExtracting(false);
                return;
            }

            // Ghi nhận giờ chụp hoặc tự sinh
            if (result.reportTime || result.reportDate) {
                const timeInfo = [result.reportTime, result.reportDate ? formatDate(result.reportDate) : ''].filter(Boolean).join(' ');
                setScreenshotTimeStr(timeInfo);
            } else {
                setScreenshotTimeStr(`${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${formatDate(new Date())}`);
            }

            // Tự động nhận diện siêu thị nếu có trên ảnh
            if (result.storeName) {
                const matched = storeOptions.find(s =>
                    isStoreMatch(s, result.storeName, activeAvailableStores) ||
                    s.toLowerCase().includes(result.storeName!.toLowerCase()) ||
                    result.storeName!.toLowerCase().includes(getShortStoreName(s).toLowerCase())
                );
                if (matched) {
                    setSelectedStore(matched);
                } else if (!effectiveIsAdmin) {
                    setOcrError(`⚠️ Ảnh chụp thuộc siêu thị "${result.storeName}", không thuộc danh sách siêu thị bạn được phân quyền phụ trách! Vui lòng kiểm tra lại ảnh.`);
                }
            }

            setCards(result.cards);
            setIsQuotaExceeded(false);
            setProgressPercent(100);
            setProgressText('Trích xuất hoàn tất!');
            showToast(`🎉 Đã bóc tách thành công ${result.cards.length} thẻ thi đua!`);
        } catch (err: any) {
            console.error('Lỗi khi bóc tách thẻ mobile:', err);
            if (err instanceof GeminiQuotaExceededError) {
                setIsQuotaExceeded(true);
                setIsKeyModalOpen(true);
                setOcrError('Hạn mức API Key hệ thống đã hết. Hãy nhập Key cá nhân của bạn.');
            } else {
                setOcrError(err?.message || 'Có lỗi xảy ra khi bóc tách ảnh.');
            }
        } finally {
            setIsExtracting(false);
        }
    };

    // Sửa trực tiếp số liệu trên từng thẻ
    const handleUpdateCard = (index: number, field: keyof StoreMobileEmulationCardItem, value: any) => {
        setCards(prev => {
            const updated = [...prev];
            const current = { ...updated[index], [field]: value };

            // Tự tính lại tỷ lệ hoàn thành
            if (field === 'actual' || field === 'target') {
                const act = field === 'actual' ? cleanBiNumber(value) : current.actual;
                const tg = field === 'target' ? cleanBiNumber(value) : current.target;
                current.completionRate = tg > 0 ? Number(((act / tg) * 100).toFixed(1)) : (act > 0 ? 100 : 0);
            }

            updated[index] = current;
            return updated;
        });
    };

    const handleDeleteCard = (index: number) => {
        setCards(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddCard = () => {
        setCards(prev => [
            ...prev,
            {
                programName: 'Chỉ tiêu mới',
                unit: 'DT',
                actual: 0,
                target: 0,
                completionRate: 0
            }
        ]);
    };

    // Lưu thi đua cho siêu thị đang chọn lên Cloud hoặc Áp dụng vào bảng số liệu
    const handleSave = async (saveDirectlyToCloud: boolean = true) => {
        if (!selectedStore) {
            showToast('⚠️ Vui lòng chọn siêu thị cần lưu thi đua!');
            return;
        }

        // Kiểm tra phân quyền nạp và lưu siêu thị
        const isPermitted = effectiveIsAdmin ||
            canAccessStore(selectedStore) ||
            canAccessStore(getShortStoreName(selectedStore)) ||
            permittedStores.some(p => isStoreMatch(p.name, selectedStore, activeAvailableStores));

        if (!isPermitted) {
            showToast(`❌ Bạn không có quyền nạp/lưu dữ liệu cho siêu thị "${formatStoreDisplayName(selectedStore)}". Vui lòng chỉ chọn siêu thị bạn được phân quyền phụ trách!`);
            return;
        }

        if (cards.length === 0) {
            showToast('⚠️ Chưa có dữ liệu thẻ thi đua để lưu!');
            return;
        }

        setIsSaving(true);
        try {
            if (mode === 'DAILY_BUSINESS_RECORD') {
                if (onApplyDailyRecord) {
                    await onApplyDailyRecord(selectedStore, cards, saveDirectlyToCloud);
                }
                setTimeout(() => {
                    setIsSaving(false);
                    onClose();
                }, 400);
                return;
            }

            // Chế độ mặc định: REALTIME_SESSION (/bc-ngay/tong-quan)
            const campaignItems = convertMobileCardsToCampaignItems(cards, selectedStore, campaignDict);
            const res = await saveSingleStoreEmulationSession(
                selectedStore,
                campaignItems,
                currentUserName,
                screenshotTimeStr
            );

            if (!res.success) {
                showToast(`❌ Lỗi: ${res.error || 'Không thể lưu lên Cloud'}`);
                setIsSaving(false);
                return;
            }

            showToast(`✅ Đã lưu thành công ${campaignItems.length} chỉ tiêu thi đua cho ${formatStoreDisplayName(selectedStore)}!`);
            if (res.updatedSessions && onSavedSuccessfully) {
                onSavedSuccessfully(res.updatedSessions);
            }

            setTimeout(() => {
                setIsSaving(false);
                onClose();
            }, 600);
        } catch (err: any) {
            console.error('Lỗi khi lưu thi đua:', err);
            showToast('❌ Có lỗi xảy ra khi lưu lên Cloud.');
            setIsSaving(false);
        }
    };

    // Thống kê nhanh thẻ đã bóc tách
    const stats = useMemo(() => {
        const passed = cards.filter(c => (c.completionRate || 0) >= 100);
        const fails = cards.filter(c => (c.completionRate || 0) < 100);
        return {
            total: cards.length,
            passed: passed.length,
            fails: fails.length,
            passRate: cards.length > 0 ? Math.round((passed.length / cards.length) * 100) : 0
        };
    }, [cards]);

    return (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* 1. HEADER */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner shrink-0">
                            <Sparkles className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                                    Nhập Thi Đua Từng Siêu Thị
                                </h2>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                                    {mode === 'DAILY_BUSINESS_RECORD' && reportDate
                                        ? `Lũy Kế • Chốt ${formatDate(reportDate)}`
                                        : 'OCR Thẻ Mobile'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* TOAST THÔNG BÁO NỘI BỘ */}
                {toastMessage && (
                    <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 text-center animate-fade-in shrink-0">
                        {toastMessage}
                    </div>
                )}

                {/* 2. BODY CUỘN */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                    {/* KHỐI CHỌN SIÊU THỊ & KEY API */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-3">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div className="flex-1">
                                <label className="block text-[11px] font-black uppercase text-slate-600 mb-1 flex items-center gap-1.5">
                                    <Store className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Chọn Siêu Thị Cần Cập Nhật Thi Đua</span>
                                    <span className="text-rose-500">*</span>
                                    {!effectiveIsAdmin && storeOptions.length > 0 && (
                                        <span className="ml-auto text-[10px] font-normal normal-case text-slate-500">
                                            (Được phân quyền: <strong className="text-blue-700 font-bold">{storeOptions.length}</strong> siêu thị)
                                        </span>
                                    )}
                                </label>
                                {storeOptions.length === 0 ? (
                                    <div className="text-xs text-rose-600 font-bold p-2 bg-rose-50 border border-rose-200 rounded-xl">
                                        ⚠️ Tài khoản của bạn chưa được phân quyền siêu thị nào để nhập liệu. Vui lòng liên hệ Quản trị viên.
                                    </div>
                                ) : (
                                    <select
                                        value={selectedStore}
                                        onChange={(e) => setSelectedStore(e.target.value)}
                                        className="w-full bg-white border border-slate-300 text-slate-800 py-2 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                                    >
                                        {storeOptions.map(st => (
                                            <option key={st} value={st}>
                                                {formatStoreDisplayName(st)}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="self-end sm:self-center pt-1 sm:pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsKeyModalOpen(true)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition shadow-2xs cursor-pointer ${isQuotaExceeded
                                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                                        : keyInfo.source === 'USER'
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                            : 'bg-blue-50 text-blue-800 border-blue-300'
                                        }`}
                                >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    <span>{Boolean(keyInfo.key) ? (keyInfo.source === 'USER' ? 'Key Cá Nhân' : 'Key Hệ Thống') : 'Nhập API Key'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>
                                {mode === 'DAILY_BUSINESS_RECORD' && reportDate
                                    ? `Cập nhật thi đua cho siêu thị này sẽ bảo lưu 100% doanh thu đã có của chốt ngày ${formatDate(reportDate)}.`
                                    : 'Lưu thi đua cho siêu thị này sẽ bảo lưu 100% doanh thu (DTQĐ, DT Thực) đã có từ trước của siêu thị.'}
                            </span>
                        </div>
                    </div>

                    {/* VÙNG KÉO THẢ & DÁN ẢNH (CTRL + V) */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition-all ${isDragging
                            ? 'border-blue-500 bg-blue-50/70 scale-[0.99]'
                            : files.length > 0
                                ? 'border-emerald-300 bg-emerald-50/30'
                                : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400'
                            }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleFileInputChange}
                            className="hidden"
                        />

                        <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-xs text-blue-600">
                                <Clipboard className="w-6 h-6" />
                            </div>

                            <div className="space-y-1">
                                <p className="text-xs sm:text-sm font-extrabold text-slate-800">
                                    Nhấn <kbd className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 font-bold">Ctrl + V</kbd> để nhập ảnh ngay, hoặc kéo thả ảnh vào đây
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer"
                            >
                                📁 Chọn ảnh từ thiết bị
                            </button>
                        </div>

                        {/* Danh sách ảnh đã nạp */}
                        {files.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center gap-2 flex-wrap justify-center">
                                {files.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs"
                                    >
                                        <Camera className="w-3.5 h-3.5 text-blue-600" />
                                        <span className="max-w-[120px] truncate">{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(idx)}
                                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleClearAll}
                                    className="text-[11px] text-rose-600 hover:underline font-bold px-1 cursor-pointer"
                                >
                                    Xóa hết
                                </button>
                            </div>
                        )}
                    </div>

                    {/* TIẾN TRÌNH OCR HOẶC NÚT TRÍCH XUẤT */}
                    {isExtracting ? (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-2 text-center animate-pulse">
                            <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                                <span>{progressText}</span>
                                <span>{progressPercent}%</span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-3">
                            {files.length > 0 && cards.length === 0 && (
                                <button
                                    type="button"
                                    onClick={handleRunOcr}
                                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                                >
                                    <Sparkles className="w-4 h-4 text-amber-300" />
                                    <span>✨ Bắt Đầu Bóc Tách {files.length} Ảnh Bằng Gemini AI</span>
                                </button>
                            )}

                            {cards.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleRunOcr}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Bóc tách lại từ ảnh</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* BÁO LỖI NẾU CÓ */}
                    {ocrError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-xs text-rose-800 font-medium">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <span>{ocrError}</span>
                        </div>
                    )}

                    {/* BẢNG RÀ SOÁT & CHỈNH SỬA THẺ THI ĐUA */}
                    {cards.length > 0 && (
                        <div className="space-y-3 pt-2">
                            {/* Thanh thống kê nhanh */}
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100/90 p-2.5 rounded-2xl border border-slate-200 text-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-700">Kết quả bóc tách:</span>
                                    <span className="px-2 py-0.5 rounded-full bg-white text-slate-800 font-black border border-slate-200">
                                        {stats.total} thẻ
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                                        ✅ {stats.passed} đạt
                                    </span>
                                    {stats.fails > 0 && (
                                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200">
                                            ⚠️ {stats.fails} chưa đạt
                                        </span>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAddCard}
                                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-[11px] font-bold rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer"
                                >
                                    <Plus className="w-3 h-3 text-blue-600" />
                                    <span>Thêm thẻ</span>
                                </button>
                            </div>

                            {/* Bảng dữ liệu thẻ */}
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                                <div className="max-h-72 overflow-y-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-slate-100 text-slate-700 font-black text-[10.5px] uppercase sticky top-0 border-b border-slate-200 z-10">
                                            <tr>
                                                <th className="px-2.5 py-2 w-8 text-center">#</th>
                                                <th className="px-2.5 py-2">Tên Chỉ Tiêu Thi Đua</th>
                                                <th className="px-2 py-2 w-14 text-center">ĐV</th>
                                                <th className="px-2 py-2 w-20 text-right">Thực Hiện</th>
                                                <th className="px-2 py-2 w-20 text-right">Target</th>
                                                <th className="px-2 py-2 w-16 text-right">% HT</th>
                                                <th className="px-2 py-2 w-8 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {cards.map((c, idx) => {
                                                const isPassed = (c.completionRate || 0) >= 100;
                                                return (
                                                    <tr key={idx} className="hover:bg-blue-50/40 transition">
                                                        <td className="px-2.5 py-1.5 text-center text-slate-400 font-bold text-[11px]">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="px-2.5 py-1.5">
                                                            <input
                                                                type="text"
                                                                value={c.programName}
                                                                onChange={(e) => handleUpdateCard(idx, 'programName', e.target.value)}
                                                                className="w-full bg-transparent border-0 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateCard(idx, 'unit', c.unit === 'DT' ? 'SL' : 'DT')}
                                                                className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer border ${c.unit === 'DT'
                                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                                                    }`}
                                                                title="Bấm để đổi Đơn vị: DT (Doanh thu triệu) hoặc SL (Số lượng)"
                                                            >
                                                                {c.unit}
                                                            </button>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                value={c.actual}
                                                                onChange={(e) => handleUpdateCard(idx, 'actual', e.target.value)}
                                                                className="w-full text-right font-mono font-bold text-slate-800 text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                value={c.target}
                                                                onChange={(e) => handleUpdateCard(idx, 'target', e.target.value)}
                                                                className="w-full text-right font-mono text-slate-600 text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right font-mono font-black">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10.5px] ${isPassed
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : 'bg-rose-100 text-rose-800'
                                                                }`}>
                                                                {c.completionRate}%
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteCard(idx)}
                                                                className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                                                                title="Xóa chỉ tiêu này"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. FOOTER HÀNH ĐỘNG */}
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <div className="text-xs text-slate-500 font-medium">
                        Đang lưu cho: <strong className="text-blue-700">{formatStoreDisplayName(selectedStore)}</strong>
                        {mode === 'DAILY_BUSINESS_RECORD' && reportDate && (
                            <span className="ml-1 text-slate-400">({formatDate(reportDate)})</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                        >
                            Đóng
                        </button>

                        {mode === 'DAILY_BUSINESS_RECORD' ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleSave(false)}
                                    disabled={isSaving || cards.length === 0}
                                    className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 disabled:opacity-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                                    title="Chỉ cập nhật vào bảng rà soát trên trang để xem lại trước khi lưu"
                                >
                                    <span>Áp Dụng Vào Bảng Rà Soát</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSave(true)}
                                    disabled={isSaving || cards.length === 0}
                                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition cursor-pointer"
                                    title="Cập nhật vào bảng và đồng bộ ngay lên Supabase Cloud"
                                >
                                    <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                                    <span>{isSaving ? 'Đang lưu Cloud...' : 'Lưu Ngay Lên Cloud'}</span>
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handleSave(true)}
                                disabled={isSaving || cards.length === 0}
                                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition cursor-pointer"
                            >
                                <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                                <span>{isSaving ? 'Đang lưu Cloud...' : 'Lưu Thi Đua Siêu Thị'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL CÀI ĐẶT GEMINI API KEY */}
            <GeminiApiKeyModal
                isOpen={isKeyModalOpen}
                onClose={() => setIsKeyModalOpen(false)}
                isAdmin={isAdmin}
                onKeySaved={() => {
                    setKeyInfo(resolveActiveGeminiKey());
                    setIsQuotaExceeded(false);
                }}
            />
        </div>
    );
}
