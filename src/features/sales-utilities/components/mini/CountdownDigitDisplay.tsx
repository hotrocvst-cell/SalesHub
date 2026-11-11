import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface Props {
    remainingSec: number;
    timerFinished: boolean;
    isFullscreen: boolean;
}

export default function CountdownDigitDisplay({ remainingSec, timerFinished, isFullscreen }: Props) {
    const s = Math.max(0, Math.floor(remainingSec));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = (n: number) => String(n).padStart(2, '0');

    if (timerFinished) {
        return (
            <div className={`yn-reveal-pop rounded-2xl text-center bg-emerald-600 border border-emerald-700 text-white flex flex-col items-center justify-center gap-1 ${isFullscreen ? 'py-14 px-8' : 'py-6 px-4'}`}>
                <CheckCircle2 className={isFullscreen ? 'w-12 h-12 text-emerald-100' : 'w-7 h-7 text-emerald-100'} aria-hidden="true" />
                <span className={isFullscreen ? 'text-4xl font-black' : 'text-lg font-black'}>Đã đến giờ!</span>
            </div>
        );
    }

    const digitBoxClass = isFullscreen
        ? 'min-w-[116px] sm:min-w-[140px] rounded-2xl bg-gradient-to-br from-[#0066ab] to-[#0369a1] text-white px-5 py-4 text-center shadow-lg'
        : 'min-w-[66px] rounded-xl bg-gradient-to-br from-[#0066ab] to-[#0369a1] text-white px-3 py-2 text-center shadow-sm';
    const digitTextClass = isFullscreen
        ? 'text-5xl sm:text-6xl font-black font-mono leading-tight'
        : 'text-2xl font-black font-mono leading-tight';

    return (
        <div className={`rounded-2xl bg-[#f4f9fd] border border-sky-100 flex items-center justify-center gap-2 sm:gap-3 tabular-nums ${isFullscreen ? 'py-10 px-6 gap-4' : 'py-4 px-3'}`}>
            {hrs > 0 && (
                <>
                    <div className={digitBoxClass}>
                        <div className={digitTextClass}>{pad(hrs)}</div>
                        <div className="text-[9.5px] font-bold uppercase tracking-wider text-sky-100">Giờ</div>
                    </div>
                    <span className="text-xl font-black text-slate-400" aria-hidden="true">:</span>
                </>
            )}
            <div className={digitBoxClass}>
                <div className={digitTextClass}>{pad(mins)}</div>
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-sky-100">Phút</div>
            </div>
            <span className="text-xl font-black text-slate-400" aria-hidden="true">:</span>
            <div className={digitBoxClass}>
                <div className={digitTextClass}>{pad(secs)}</div>
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-sky-100">Giây</div>
            </div>
        </div>
    );
}

