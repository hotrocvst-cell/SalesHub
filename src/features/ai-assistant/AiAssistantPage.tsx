import React, { useState, useRef, useEffect } from 'react';
import {
    Bot,
    History,
    Plus,
    BookOpen,
    MessageSquare,
    KeyRound,
    ShieldCheck,
    CheckCircle2,
    AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../shared/contexts/AuthContext';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import GeminiApiKeyModal from '../data-update/components/GeminiApiKeyModal';
import { MAX_CHAT_SESSIONS_PER_USER, type ChatAttachmentImage } from './types/aiAssistantTypes';
import { AI_ASSISTANT_DDL_SQL } from './services/knowledgeSql';
import { useAiAssistant } from './hooks/useAiAssistant';
import ChatWindowPanel from './components/ChatWindowPanel';
import ChatHistoryDrawer from './components/ChatHistoryDrawer';
import KnowledgeManagerTab from './components/KnowledgeManagerTab';
import ImageLightboxModal from './components/ImageLightboxModal';

export default function AiAssistantPage() {
    const { currentUser, isAdmin, accessibleStores } = useAuth();
    const effectiveUserId = currentUser.employee_id || currentUser.id || currentUser.email || 'anonymous';
    const effectiveRole = currentUser.role || 'NHAN_VIEN';
    const userStores = accessibleStores.length > 0 ? accessibleStores : (currentUser.store_name ? [currentUser.store_name] : []);

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<ChatAttachmentImage | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    const showToast = (msg: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastMessage(msg);
        toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
    };

    const isErrorToast = Boolean(toastMessage && /^(⚠️|Lỗi|Không thể)/i.test(toastMessage.trim()));
    const cleanToastText = toastMessage ? toastMessage.replace(/^(✅|⚠️|🗑️|🎉|🖼️)\s*/u, '') : '';

    const assistant = useAiAssistant({
        effectiveUserId,
        effectiveRole,
        userStores,
        isAdmin,
        onToast: showToast
    });

    const isCloudReady = assistant.health.tablesReady && assistant.health.bucketReady;

    return (
        <>
            <div className="max-w-5xl mx-auto space-y-2.5 sm:space-y-3 font-sans text-slate-800 pb-2 sm:pb-4">
                <CloudDataSyncStatusBanner
                    storageType="cloud"
                    syncStatus={isCloudReady ? 'synced' : 'error'}
                    tableReady={isCloudReady}
                    tableName="knowledge_documents • knowledge-assets"
                    sqlDdl={AI_ASSISTANT_DDL_SQL}
                    lastSyncTime={assistant.lastSyncedAt}
                    onSyncNow={assistant.loadInitialData}
                    customMessage={
                        isCloudReady
                            ? `Kho Cloud: ${assistant.documents.length} tài liệu • Tối đa ${MAX_CHAT_SESSIONS_PER_USER} phiên`
                            : assistant.health.missingReason
                    }
                    compact
                />

                <div className="bg-white rounded-3xl border border-slate-200 p-3.5 sm:p-4 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
                            <Bot className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                    Trợ Lý AI &amp; Kho Kiến Thức
                                </h1>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                    <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    Quyền: {effectiveRole}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                                Giải đáp quy trình ST, tra cứu tài liệu chuẩn &amp; hiển thị ảnh gốc theo phân quyền
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setIsHistoryOpen(true)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            <History className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                            <span className="tabular-nums">Lịch sử ({assistant.sessions.length}/{MAX_CHAT_SESSIONS_PER_USER})</span>
                        </button>

                        <button
                            type="button"
                            onClick={assistant.handleNewChat}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                        >
                            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Chat mới</span>
                        </button>

                        {isAdmin && (
                            <button
                                type="button"
                                onClick={() => setIsKeyModalOpen(true)}
                                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-amber-600 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                title="Cài đặt Gemini API Key"
                                aria-label="Cài đặt Gemini API Key"
                            >
                                <KeyRound className="w-4 h-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </div>

                <div
                    role="tablist"
                    aria-label="Chế độ Trợ lý AI"
                    className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl w-full sm:w-fit"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={assistant.activeTab === 'chat'}
                        onClick={() => assistant.setActiveTab('chat')}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            assistant.activeTab === 'chat' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Hỏi Đáp Trợ Lý</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={assistant.activeTab === 'knowledge'}
                        onClick={() => assistant.setActiveTab('knowledge')}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            assistant.activeTab === 'knowledge' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span className="tabular-nums">Kho Tài Liệu ({assistant.documents.length})</span>
                    </button>
                </div>
            </div>

                {assistant.activeTab === 'knowledge' ? (
                    <KnowledgeManagerTab
                        documents={assistant.documents}
                        isLoading={assistant.isSyncingDocs}
                        isAdmin={isAdmin}
                        availableStores={assistant.availableStores}
                        currentUserName={currentUser.full_name || currentUser.employee_id || 'ADMIN'}
                        onRefresh={assistant.loadInitialData}
                        onAskFromDoc={(docTitle) => assistant.handleSendMessage(`Tóm tắt nội dung và quy định chính trong "${docTitle}"`, 'AI')}
                        onToast={showToast}
                    />
                ) : (
                    <ChatWindowPanel
                        userName={currentUser.full_name}
                        effectiveRole={effectiveRole}
                        messages={assistant.messages}
                        quickPrompts={assistant.quickPrompts}
                        inputText={assistant.inputText}
                        queryMode={assistant.queryMode}
                        isThinking={assistant.isThinking}
                        isSyncingDocs={assistant.isSyncingDocs}
                        onChangeInput={assistant.setInputText}
                        onChangeMode={assistant.setQueryMode}
                        onSend={(q) => assistant.handleSendMessage(q)}
                        onOpenImage={setLightboxImage}
                    />
                )}
            </div>

            {toastMessage && (
                <div
                    role="status"
                    aria-live="polite"
                    className={`fixed top-16 right-3 sm:right-5 z-50 max-w-[calc(100vw-1.5rem)] px-3.5 py-2.5 rounded-2xl text-xs font-bold shadow-xl border flex items-center gap-2 ${
                        isErrorToast
                            ? 'bg-rose-950 text-rose-50 border-rose-800'
                            : 'bg-slate-900 text-white border-slate-800'
                    }`}
                >
                    {isErrorToast ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                    )}
                    <span className="break-words">{cleanToastText}</span>
                </div>
            )}

            <ChatHistoryDrawer
                sessions={assistant.sessions}
                activeSessionId={assistant.activeSessionId}
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                onSelectSession={assistant.handleSelectSession}
                onNewChat={assistant.handleNewChat}
                onDeleteSession={assistant.handleDeleteSession}
                onClearAll={assistant.handleClearAllHistory}
            />

            <ImageLightboxModal image={lightboxImage} onClose={() => setLightboxImage(null)} />

            {isAdmin && (
                <GeminiApiKeyModal
                    isOpen={isKeyModalOpen}
                    onClose={() => setIsKeyModalOpen(false)}
                    isAdmin={isAdmin}
                    onKeySaved={() => showToast('Đã cập nhật Gemini API Key!')}
                />
            )}
        </>
    );
}
