import React from 'react';
import CoinFlipCard from './mini/CoinFlipCard';
import DiceRollerCard from './mini/DiceRollerCard';
import YesNoOracleCard from './mini/YesNoOracleCard';
import CountdownTimerCard from './mini/CountdownTimerCard';

interface Props {
    soundEnabled: boolean;
}

export default function MiniUtilitiesTool({ soundEnabled }: Props) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CoinFlipCard soundEnabled={soundEnabled} />
            <DiceRollerCard soundEnabled={soundEnabled} />
            <YesNoOracleCard soundEnabled={soundEnabled} />
            <CountdownTimerCard soundEnabled={soundEnabled} />
        </div>
    );
}
