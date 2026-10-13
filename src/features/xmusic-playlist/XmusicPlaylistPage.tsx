import React, { useState } from 'react';
import {
    XMUSIC_USER_SCRIPT_CODE,
    XMUSIC_USER_SCRIPT_FILENAME
} from './data/userScriptCode';
import type { XMusicTabType } from './types';
import XmusicHeroHeader from './components/XmusicHeroHeader';
import InstallationGuideTab from './components/InstallationGuideTab';
import PlaylistManagerTab from './components/PlaylistManagerTab';
import CodeViewerTab from './components/CodeViewerTab';
import AccountConfigTab from './components/AccountConfigTab';
import { Check, Info } from 'lucide-react';

export default function XmusicPlaylistPage() {
    const [activeTab, setActiveTab] = useState<XMusicTabType>('guide');
    const [hasCopied, setHasCopied] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage('');
        }, 3200);
    };

    const handleCopyCode = () => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(XMUSIC_USER_SCRIPT_CODE).then(() => {
                setHasCopied(true);
                showToast('Đã sao chép toàn bộ mã Userscript vào Clipboard!');
                setTimeout(() => setHasCopied(false), 2500);
            }).catch(() => {
                fallbackCopy();
            });
        } else {
            fallbackCopy();
        }
    };

    const fallbackCopy = () => {
        const textArea = document.createElement('textarea');
        textArea.value = XMUSIC_USER_SCRIPT_CODE;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            setHasCopied(true);
            showToast('Đã sao chép toàn bộ mã Userscript thành công!');
            setTimeout(() => setHasCopied(false), 2500);
        } catch {
            showToast('Không thể sao chép tự động, vui lòng chọn thủ công trong tab Mã Nguồn.');
        }
        document.body.removeChild(textArea);
    };

    const handleDownloadCode = () => {
        const blob = new Blob([XMUSIC_USER_SCRIPT_CODE], { type: 'text/javascript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = XMUSIC_USER_SCRIPT_FILENAME;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Đã tải xuống file ${XMUSIC_USER_SCRIPT_FILENAME}!`);
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-2.5 sm:p-5 md:p-6 space-y-4 sm:space-y-6">
            {/* Hero Header with Brand, Quick Actions and Tabs */}
            <XmusicHeroHeader
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onCopyCode={handleCopyCode}
                onDownloadCode={handleDownloadCode}
                hasCopied={hasCopied}
            />

            {/* Active Tab Content */}
            {activeTab === 'guide' && (
                <InstallationGuideTab
                    onCopyCode={handleCopyCode}
                    onDownloadCode={handleDownloadCode}
                    hasCopied={hasCopied}
                    onViewCodeTab={() => setActiveTab('code')}
                />
            )}

            {activeTab === 'playlists' && (
                <PlaylistManagerTab onShowToast={showToast} />
            )}

            {activeTab === 'code' && (
                <CodeViewerTab
                    onCopyCode={handleCopyCode}
                    onDownloadCode={handleDownloadCode}
                    hasCopied={hasCopied}
                />
            )}

            {activeTab === 'account' && (
                <AccountConfigTab onShowToast={showToast} />
            )}

            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 text-white text-xs font-bold shadow-xl border border-slate-700 backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}
        </div>
    );
}
