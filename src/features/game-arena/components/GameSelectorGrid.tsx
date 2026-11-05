import React from 'react';
import { Sparkles, Zap, Brain, Layers, Play, Clock, Trophy, Lock } from 'lucide-react';
import { SYSTEM_GAMES_LIST } from '../constants';
import type { GameItem, UserGameStat } from '../types';

interface GameSelectorGridProps {
    onSelectGame: (game: GameItem) => void;
    userStats: Record<string, UserGameStat>;
}

export default function GameSelectorGrid({ onSelectGame, userStats }: GameSelectorGridProps) {
    const getGameIcon = (iconName: string) => {
        switch (iconName) {
            case 'Sparkles': return <Sparkles className="w-5 h-5" />;
            case 'Zap': return <Zap className="w-5 h-5" />;
            case 'Brain': return <Brain className="w-5 h-5" />;
            case 'Layers': return <Layers className="w-5 h-5" />;
            default: return <Sparkles className="w-5 h-5" />;
        }
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {SYSTEM_GAMES_LIST.map(game => {
                const stat = userStats[game.id];
                const isReady = game.isReady;

                return (
                    <div
                        key={game.id}
                        className={`relative rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between p-4 shadow-sm ${
                            isReady
                                ? 'bg-white hover:border-purple-300 hover:shadow-md'
                                : 'bg-slate-50/70 border-slate-200 opacity-75'
                        }`}
                    >
                        <div>
                            {/* Header Thẻ: Icon + Badge */}
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                                <div className={`p-2.5 rounded-xl ${
                                    game.colorTheme === 'purple' ? 'bg-purple-100 text-purple-700' :
                                    game.colorTheme === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                                    game.colorTheme === 'blue' ? 'bg-blue-100 text-blue-700' :
                                    'bg-amber-100 text-amber-700'
                                }`}>
                                    {getGameIcon(game.iconName)}
                                </div>

                                {game.tag && (
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                        isReady
                                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                            : 'bg-slate-200 text-slate-600'
                                    }`}>
                                        {game.tag}
                                    </span>
                                )}
                            </div>

                            {/* Tiêu đề & Mô tả */}
                            <h3 className="text-base font-black text-slate-800 leading-tight">
                                {game.title}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5 mb-2">
                                {game.subtitle}
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed mb-3">
                                {game.description}
                            </p>

                            {/* Chips thông tin: Thời gian, độ khó */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                    <Clock className="w-3 h-3 text-slate-400" /> {game.duration}
                                </span>
                                <span className="inline-flex items-center text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                    {game.difficulty}
                                </span>

                                {stat && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                        <Trophy className="w-3 h-3 text-amber-500" /> Kỷ lục: {stat.high_score}đ
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Nút hành động */}
                        {isReady ? (
                            <button
                                onClick={() => onSelectGame(game)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow transition-transform active:scale-95"
                            >
                                <Play className="w-3.5 h-3.5 fill-current" /> Chơi Ngay
                            </button>
                        ) : (
                            <button
                                disabled
                                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-200 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed"
                            >
                                <Lock className="w-3.5 h-3.5" /> Sắp Ra Mắt
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

