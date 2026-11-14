import { useState, useEffect, useCallback } from 'react';
import { fetchAdminGeminiKeyCloud } from '../../data-update/services/geminiApiKeyService';
import { fetchStores, type StoreItem } from '../../../core/lib/storage';
import {
    MAX_CHAT_SESSIONS_PER_USER,
    MAX_USER_INPUT_CHARS,
    type AiChatSession,
    type ChatMessage,
    type KnowledgeDocument,
    type StorageHealthStatus
} from '../types/aiAssistantTypes';
import { checkKnowledgeStorageHealth } from '../services/knowledgeStorageService';
import { fetchKnowledgeDocuments } from '../services/knowledgeService';
import {
    clearAllUserChatSessions,
    deleteUserChatSession,
    fetchUserChatSessions,
    hydrateSessionImageUrls,
    saveUserChatSession
} from '../services/chatHistoryService';
import { askAiAssistant } from '../services/aiChatEngine';

export function useAiAssistant(params: {
    effectiveUserId: string;
    effectiveRole: string;
    userStores: string[];
    isAdmin: boolean;
    onToast: (msg: string) => void;
}) {
    const { effectiveUserId, effectiveRole, userStores, isAdmin, onToast } = params;

    const [activeTab, setActiveTab] = useState<'chat' | 'knowledge'>('chat');
    const [health, setHealth] = useState<StorageHealthStatus>({ tablesReady: true, bucketReady: true });
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [availableStores, setAvailableStores] = useState<StoreItem[]>([]);
    const [isSyncingDocs, setIsSyncingDocs] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

    const [sessions, setSessions] = useState<AiChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    // Mặc định ưu tiên chế độ Tìm Tài Liệu Gốc (0 token, tức thì)
    const [queryMode, setQueryMode] = useState<'AI' | 'SEARCH'>('SEARCH');
    const [isThinking, setIsThinking] = useState(false);

    const userStoresKey = userStores.join('|');

    const loadInitialData = useCallback(async () => {
        setIsSyncingDocs(true);
        const [healthRes, docsRes, sessRes, storesRes] = await Promise.all([
            checkKnowledgeStorageHealth(),
            fetchKnowledgeDocuments({
                userRole: effectiveRole,
                userStores,
                isAdminManageView: isAdmin && effectiveRole === 'ADMIN'
            }),
            fetchUserChatSessions(effectiveUserId),
            fetchStores(),
            fetchAdminGeminiKeyCloud()
        ]);

        setHealth(healthRes);
        if (docsRes.success) setDocuments(docsRes.data);
        setSessions(sessRes.sessions);
        if (storesRes.success && storesRes.data) setAvailableStores(storesRes.data);
        setLastSyncedAt(new Date());
        setIsSyncingDocs(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveRole, effectiveUserId, isAdmin, userStoresKey]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    const handleNewChat = () => {
        setActiveSessionId(null);
        setMessages([]);
        setInputText('');
    };

    const handleSelectSession = async (sess: AiChatSession) => {
        setActiveSessionId(sess.id);
        setActiveTab('chat');
        const hydrated = await hydrateSessionImageUrls(sess.messages || []);
        setMessages(hydrated);
    };

    const handleDeleteSession = async (sessionId: string) => {
        const ok = await deleteUserChatSession(sessionId, effectiveUserId);
        if (ok) {
            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
            if (activeSessionId === sessionId) handleNewChat();
            onToast('Đã xóa phiên trò chuyện');
        }
    };

    const handleClearAllHistory = async () => {
        if (!window.confirm('Xóa toàn bộ lịch sử trò chuyện của bạn trên Cloud?')) return;
        const ok = await clearAllUserChatSessions(effectiveUserId);
        if (ok) {
            setSessions([]);
            handleNewChat();
            onToast('Đã xóa sạch lịch sử chat');
        }
    };

    const handleSendMessage = async (overrideQuestion?: string, overrideMode?: 'AI' | 'SEARCH') => {
        const q = (overrideQuestion ?? inputText).trim().slice(0, MAX_USER_INPUT_CHARS);
        if (!q || isThinking) return;

        const usedMode = overrideMode || queryMode;
        if (!overrideQuestion) setInputText('');

        const userMsg: ChatMessage = {
            id: `u_${Date.now()}`,
            role: 'user',
            content: q,
            createdAt: new Date().toISOString(),
            mode: usedMode
        };

        const updatedWithUser = [...messages, userMsg];
        setMessages(updatedWithUser);
        setActiveTab('chat');
        setIsThinking(true);

        const botReply = await askAiAssistant({
            question: q,
            mode: usedMode,
            userRole: effectiveRole,
            userStores,
            recentMessages: messages
        });

        const finalMessages = [...updatedWithUser, botReply];
        setMessages(finalMessages);
        setIsThinking(false);

        if (health.tablesReady) {
            const firstUserTitle = finalMessages.find((m) => m.role === 'user')?.content || q;
            const saveRes = await saveUserChatSession({
                sessionId: activeSessionId,
                employeeId: effectiveUserId,
                title: firstUserTitle,
                messages: finalMessages
            });
            if (saveRes.success && saveRes.session) {
                setActiveSessionId(saveRes.session.id);
                setSessions((prev) => {
                    const filtered = prev.filter((s) => s.id !== saveRes.session!.id);
                    return [saveRes.session!, ...filtered].slice(0, MAX_CHAT_SESSIONS_PER_USER);
                });
            }
        }
    };

    const quickPrompts = documents
        .filter((d) => d.is_active)
        .slice(0, 4)
        .map((d) => `Tra cứu "${d.title}"`);

    return {
        activeTab,
        setActiveTab,
        health,
        documents,
        availableStores,
        isSyncingDocs,
        lastSyncedAt,
        sessions,
        activeSessionId,
        messages,
        inputText,
        setInputText,
        queryMode,
        setQueryMode,
        isThinking,
        quickPrompts,
        loadInitialData,
        handleNewChat,
        handleSelectSession,
        handleDeleteSession,
        handleClearAllHistory,
        handleSendMessage
    };
}

