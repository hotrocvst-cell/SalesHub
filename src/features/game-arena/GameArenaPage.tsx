import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Gamepad2, Trophy, ArrowLeft, Sparkles, User, Award } from 'lucide-react';
import { useAuth } from '../../shared/contexts/AuthContext';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import GameSelectorGrid from './components/GameSelectorGrid';
import LeaderboardView from './components/LeaderboardView';
import Game2048 from './components/games/Game2048';
import GameDealReflex from './components/games/GameDealReflex';
import {
    checkSupabaseGameScoresTable,
    fetchLeaderboardScores,
    fetchUserGameStats,
    submitGameScore,
    GAME_SCORES_SQL_DDL
} from './services/gameScoreService';
import { fetchStores } from '../../core/lib/storage';
import { cleanEmployeeName, getShortenedEmployeeName } from '../../core/lib/formatters';
import type { GameItem, GameScoreRecord, LeaderboardFilter, UserGameStat } from './types';

export default function GameArenaPage() {
    const { currentUser } = useAuth();

    // Trạng thái Cloud sync & sẵn sàng bảng
    const [tableReady, setTableReady] = useState(true);
    const [storageType, setStorageType] = useState<'cloud' | 'local'>('cloud');
    const [syncStatus, setSyncStatus] = useState<'synced' | 'unsynced' | 'syncing' | 'error'>('synced');
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());

    // Tabs & Điều hướng
    const [activeTab, setActiveTab] = useState<'games' | 'leaderboard'>('games');
    const [activePlayingGame, setActivePlayingGame] = useState<GameItem | null>(null);

    // Dữ liệu người chơi
    const [userStats, setUserStats] = useState<Record<string, UserGameStat>>({});
    const [availableStores, setAvailableStores] = useState<string[]>([]);

    // Bảng xếp hạng
    const [scores, setScores] = useState<GameScoreRecord[]>([]);
    const [isLoadingScores, setIsLoadingScores] = useState(false);
    const [filter, setFilter] = useState<LeaderboardFilter>({
        game_id: 'all',
        store_name: 'ALL',
        time_range: 'week'
    });

    // 1. Kiểm tra trạng thái Cloud & danh sách ST
    const checkCloudStatus = useCallback(async () => {
        const { exists } = await checkSupabaseGameScoresTable();
        setTableReady(exists);
        setStorageType(exists ? 'cloud' : 'local');
        setLastSyncTime(new Date());

        try {
            const res = await fetchStores();
            if (res && res.data && res.data.length > 0) {
                setAvailableStores(res.data.map(s => s.name));
            }
        } catch {
            // fallback
        }
    }, []);

    useEffect(() => {
        checkCloudStatus();
    }, [checkCloudStatus]);

    // 2. Tải kỷ lục của người chơi hiện tại
    const loadUserStats = useCallback(async () => {
        if (!currentUser?.employee_id) return;
        const stats = await fetchUserGameStats(currentUser.employee_id);
        setUserStats(stats);
    }, [currentUser?.employee_id]);

    useEffect(() => {
        loadUserStats();
    }, [loadUserStats]);

    // 3. Tải danh sách điểm bảng xếp hạng
    const loadScores = useCallback(async () => {
        setIsLoadingScores(true);
        try {
            const { scores: data, source } = await fetchLeaderboardScores(filter);
            setScores(data);
            setStorageType(source);
            setSyncStatus('synced');
            setLastSyncTime(new Date());
        } catch {
            setSyncStatus('error');
        } finally {
            setIsLoadingScores(false);
        }
    }, [filter]);

    useEffect(() => {
        if (activeTab === 'leaderboard') {
            loadScores();
        }
    }, [activeTab, loadScores]);

    // Xử lý khi kết thúc 1 ván game
    const handleFinishGame = async (score: number, metadata: Record<string, any>) => {
        if (!activePlayingGame) return;

        setSyncStatus('syncing');
        await submitGameScore({
            game_id: activePlayingGame.id,
            employee_id: currentUser?.employee_id || 'DEMO01',
            employee_name: currentUser?.full_name || 'Nhân Viên Khách',
            store_name: currentUser?.store_name || 'ST Thử Nghiệm',
            score,
            duration_seconds: metadata.duration_seconds || 0,
            metadata,
            played_at: new Date().toISOString()
        });

        await loadUserStats();
        setActivePlayingGame(null);
        setFilter(prev => ({ ...prev, game_id: activePlayingGame.id }));
        setActiveTab('leaderboard');
    };

    return (
        <div className="min-h-screen bg-slate-50/50 pb-16 pt-3 px-3 sm:px-6 max-w-5xl mx-auto">
            {/* 1. BANNER TRẠNG THÁI LƯU TRỮ CLOUD (BẮT BUỘC THEO QUY CHUẨN 8) */}
            <CloudDataSyncStatusBanner
                storageType={storageType}
                syncStatus={syncStatus}
                tableReady={tableReady}
                tableName="game_scores"
                sqlDdl={GAME_SCORES_SQL_DDL}
                lastSyncTime={lastSyncTime}
                onSyncNow={loadScores}
                className="mb-4"
            />

            {/* ĐANG TRONG PHIÊN CHƠI GAME */}
            {activePlayingGame ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">
                    {activePlayingGame.id === 'game_2048' && (
                        <Game2048
                            onFinishGame={handleFinishGame}
                            onBack={() => setActivePlayingGame(null)}
                            personalBest={userStats['game_2048']?.high_score || 0}
                        />
                    )}
                    {activePlayingGame.id === 'game_reflex_deal' && (
                        <GameDealReflex
                            onFinishGame={handleFinishGame}
                            onBack={() => setActivePlayingGame(null)}
                            personalBest={userStats['game_reflex_deal']?.high_score || 0}
                        />
                    )}
                </div>
            ) : (
                /* GIAO DIỆN CHÍNH: HUB GIẢI TRÍ VÀ BẢNG XẾP HẠNG */
                <div className="space-y-4">
                    {/* Thẻ Chào Mừng & Thành Tích Cá Nhân */}
                    <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 rounded-3xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                                <Gamepad2 className="w-8 h-8 text-amber-300" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg sm:text-xl font-black tracking-tight">ĐẤU TRƯỜNG GIẢI TRÍ</h1>
                                    <span className="bg-amber-400 text-amber-950 font-black text-[10px] px-2 py-0.5 rounded-full">HOT</span>
                                </div>
                                <p className="text-xs text-purple-100 mt-0.5">
                                    {currentUser ? (
                                        <>Xin chào, <strong className="text-white">{getShortenedEmployeeName(currentUser.full_name)}</strong> ({currentUser.employee_id}) • {currentUser.store_name}</>
                                    ) : (
                                        'Giải trí 1-5 phút & Vinh danh bảng vàng toàn hệ thống'
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Thống kê thành tích nhanh */}
                        {currentUser && (
                            <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm p-2 rounded-2xl self-start sm:self-auto border border-white/10">
                                <div className="text-center px-3 border-r border-white/10">
                                    <div className="text-[10px] text-purple-200 font-bold uppercase">Game 2048</div>
                                    <div className="text-sm font-black font-mono text-amber-300">
                                        {userStats['game_2048']?.high_score || 0}đ
                                    </div>
                                </div>
                                <div className="text-center px-3">
                                    <div className="text-[10px] text-purple-200 font-bold uppercase">Bắt Deal</div>
                                    <div className="text-sm font-black font-mono text-emerald-300">
                                        {userStats['game_reflex_deal']?.high_score || 0}đ
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tabs Chuyển Đổi: Kho Game / Bảng Xếp Hạng */}
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                        <button
                            onClick={() => setActiveTab('games')}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all ${
                                activeTab === 'games'
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                                    : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
                            }`}
                        >
                            <Gamepad2 className="w-4 h-4" />
                            <span>Kho Mini Game</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('leaderboard')}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all ${
                                activeTab === 'leaderboard'
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                                    : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
                            }`}
                        >
                            <Trophy className="w-4 h-4 text-amber-400" />
                            <span>Bảng Xếp Hạng Toàn Hệ Thống</span>
                        </button>
                    </div>

                    {/* Nội Dung Từng Tab */}
                    {activeTab === 'games' ? (
                        <GameSelectorGrid
                            onSelectGame={game => setActivePlayingGame(game)}
                            userStats={userStats}
                        />
                    ) : (
                        <LeaderboardView
                            scores={scores}
                            filter={filter}
                            onFilterChange={newF => setFilter(prev => ({ ...prev, ...newF }))}
                            onRefresh={loadScores}
                            availableStores={availableStores}
                            isLoading={isLoadingScores}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
