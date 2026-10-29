import React, { useState } from 'react';
import { Copy, ClipboardPaste, Trash2, Check, FileText, Info } from 'lucide-react';
import type { SampleDataItem } from '../types';

interface SampleDataItemInputProps {
    item: SampleDataItem;
    index: number;
    onChange: (updatedItem: SampleDataItem) => void;
    onDelete: (itemId: string) => void;
}

export default function SampleDataItemInput({
    item,
    index,
    onChange,
    onDelete
}: SampleDataItemInputProps) {
    const [copied, setCopied] = useState(false);
    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [labelInput, setLabelInput] = useState(item.label);
    const [noteInput, setNoteInput] = useState(item.note || '');

    const linesCount = (item.sample_text || '').split('\n').filter(l => l.trim().length > 0).length;
    const charsCount = (item.sample_text || '').length;

    const handleCopy = async () => {
        if (!item.sample_text) return;
        try {
            await navigator.clipboard.writeText(item.sample_text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback
            const el = document.createElement('textarea');
            el.value = item.sample_text;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                onChange({
                    ...item,
                    sample_text: text,
                    updated_at: new Date().toISOString()
                });
            }
        } catch {
            alert('Không thể đọc từ Clipboard. Hãy cấp quyền truy cập clipboard cho trình duyệt hoặc dán trực tiếp bằng Ctrl+V.');
        }
    };

    const handleClear = () => {
        if (confirm(`Bạn có chắc muốn xóa trắng nội dung của "${item.label}"?`)) {
            onChange({
                ...item,
                sample_text: '',
                updated_at: new Date().toISOString()
            });
        }
    };

    const handleSaveInfo = () => {
        onChange({
            ...item,
            label: labelInput.trim() || item.label,
            note: noteInput.trim(),
            updated_at: new Date().toISOString()
        });
        setIsEditingLabel(false);
    };

    return (
        <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs space-y-2.5 transition-all">
            {/* Header của ô dữ liệu */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-black flex items-center justify-center shrink-0">
                        {index + 1}
                    </span>

                    {isEditingLabel ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <input
                                type="text"
                                value={labelInput}
                                onChange={e => setLabelInput(e.target.value)}
                                className="px-2 py-0.5 text-xs font-bold bg-white border border-blue-400 rounded-md focus:outline-hidden"
                                placeholder="Tên ô dữ liệu..."
                            />
                            <input
                                type="text"
                                value={noteInput}
                                onChange={e => setNoteInput(e.target.value)}
                                className="px-2 py-0.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-hidden text-slate-600"
                                placeholder="Ghi chú hướng dẫn..."
                            />
                            <button
                                type="button"
                                onClick={handleSaveInfo}
                                className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700"
                            >
                                Lưu
                            </button>
                        </div>
                    ) : (
                        <div
                            onClick={() => setIsEditingLabel(true)}
                            className="cursor-pointer group flex items-center gap-1.5"
                            title="Bấm để đổi tên hoặc ghi chú"
                        >
                            <span className="font-black text-xs text-slate-800 group-hover:text-blue-700">
                                {item.label}
                            </span>
                            <span className="text-[10px] text-slate-400 group-hover:text-blue-500">✏️</span>
                        </div>
                    )}

                    {item.note && !isEditingLabel && (
                        <span className="text-[10.5px] text-slate-500 italic bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                            <Info className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[200px] sm:max-w-xs">{item.note}</span>
                        </span>
                    )}
                </div>

                {/* Các nút thao tác nhanh */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!item.sample_text}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            copied
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                        title="Sao chép toàn bộ dữ liệu vào Clipboard"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
                        <span>{copied ? 'Đã sao chép!' : 'Sao chép'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handlePaste}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer transition-all"
                        title="Dán nhanh nội dung mới từ Clipboard vào ô này"
                    >
                        <ClipboardPaste className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Dán</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={!item.sample_text}
                        className="p-1 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Xóa trắng nội dung ô này"
                    >
                        <FileText className="w-3.5 h-3.5" />
                    </button>

                    <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Xóa hẳn ô dữ liệu này"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Vùng Textarea nhập dữ liệu mẫu */}
            <div className="relative">
                <textarea
                    value={item.sample_text || ''}
                    onChange={e => onChange({
                        ...item,
                        sample_text: e.target.value,
                        updated_at: new Date().toISOString()
                    })}
                    placeholder="Dán dữ liệu mẫu từ Excel / Zalo / Báo cáo vào đây..."
                    rows={Math.min(10, Math.max(3, linesCount + 1))}
                    className="w-full p-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 leading-relaxed transition-all resize-y"
                    spellCheck={false}
                />
            </div>

            {/* Footer ô: Số dòng & Số ký tự */}
            <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-medium px-1">
                <span>
                    {linesCount > 0 ? (
                        <span className="font-bold text-slate-700">{linesCount} dòng</span>
                    ) : (
                        <span className="italic text-slate-400">Chưa có dữ liệu</span>
                    )}
                    {charsCount > 0 && ` • ${charsCount.toLocaleString('en-US')} ký tự`}
                </span>
                <span className="text-[10px] text-slate-400">
                    Cập nhật: {new Date(item.updated_at).toLocaleTimeString('vi-VN')}
                </span>
            </div>
        </div>
    );
}

