






/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Zap, Trophy, MapPin, Diamond, Rocket, ArrowUpCircle, Shield, Activity, PlusCircle, Play, AlertTriangle, Crosshair, Skull, Magnet, Clock, Disc, Sparkles, Clover, Radio, Infinity as InfinityIcon, Flag, Bot, Cross, CreditCard, RefreshCw, ShoppingBag } from 'lucide-react';
import { useStore } from '../../store';
import { GameStatus, GEMINI_COLORS, ShopItem, RUN_SPEED_BASE, GameMode } from '../../types';
import { audio } from '../System/Audio';

// Available Shop Items with drastically reduced prices
const SHOP_ITEMS: ShopItem[] = [
    {
        id: 'DOUBLE_JUMP',
        name: 'ダブルジャンプ',
        description: '空中で2回目のジャンプが可能になる。',
        cost: 200,
        icon: ArrowUpCircle,
        oneTime: true
    },
    {
        id: 'MAX_LIFE',
        name: '最大ライフUP',
        description: 'ハートの最大値を1つ増やす (最大10)。',
        cost: 300,
        icon: Activity
    },
    {
        id: 'HEAL',
        name: '修理キット',
        description: 'ライフを1つ回復する。',
        cost: 100,
        icon: PlusCircle
    },
    {
        id: 'IMMORTAL',
        name: '無敵モード',
        description: 'スペース/タップで5秒間無敵 (解放スキル)。',
        cost: 600,
        icon: Shield,
        oneTime: true
    },
    {
        id: 'MAGNET',
        name: 'マグネット',
        description: 'LvUPで範囲と速度UP (最大Lv5)。',
        cost: 400,
        icon: Magnet,
        // Removed oneTime, handled by level check
    },
    {
        id: 'SHIELD',
        name: 'エネルギーシールド',
        description: 'ダメージを1回防ぐ (最大3つまで保持)。',
        cost: 150,
        icon: Disc
    },
    {
        id: 'TIME_WARP',
        name: 'タイムワープ',
        description: 'Shiftキーで5秒間時間を遅くする (解放スキル)。',
        cost: 500,
        icon: Clock,
        oneTime: true
    },
    {
        id: 'GEM_BOOSTER',
        name: 'ジェムブースター',
        description: '獲得するジェムの価値が2倍になる。',
        cost: 800,
        icon: Sparkles,
        oneTime: true
    },
    {
        id: 'LUCK_CHARM',
        name: 'ラックチャーム',
        description: '障害物が減り、ジェムが出やすくなる。',
        cost: 400,
        icon: Clover,
        oneTime: true
    },
    {
        id: 'SONIC_BLAST',
        name: 'ソニックブラスト',
        description: 'Zキーで前方の敵を一掃 (15秒毎)。',
        cost: 1000,
        icon: Radio,
        oneTime: true
    },
    {
        id: 'DRONE',
        name: 'アタックドローン',
        description: '前方の敵を自動攻撃するドローンを配備。',
        cost: 6000,
        icon: Bot,
        oneTime: true
    },
    {
        id: 'REVIVE',
        name: '蘇生アンク',
        description: '死亡時に一度だけ自動で復活する。',
        cost: 4000,
        icon: Cross,
        oneTime: true // Technically a consumable but handled as one-time purchase until used
    },
    {
        id: 'DISCOUNT',
        name: 'VIPカード',
        description: 'ショップ価格が永久に20%OFFになる。',
        cost: 8000,
        icon: CreditCard,
        oneTime: true
    }
];

// Helper to generate items based on current state
const generateShopItems = (state: ReturnType<typeof useStore.getState>): ShopItem[] => {
    const { hasDoubleJump, hasImmortality, magnetLevel, hasTimeWarp, shieldCount, hasGemBooster, hasLuckCharm, hasSonicBlast, hasDrone, hasRevive, hasDiscount, maxLives, lives } = state;
    
    // Filter out items that are already owned OR not applicable
    let pool = SHOP_ITEMS.filter(item => {
        if (item.id === 'DOUBLE_JUMP' && hasDoubleJump) return false;
        if (item.id === 'IMMORTAL' && hasImmortality) return false;
        if (item.id === 'MAGNET' && magnetLevel >= 5) return false;
        if (item.id === 'TIME_WARP' && hasTimeWarp) return false;
        if (item.id === 'GEM_BOOSTER' && hasGemBooster) return false;
        if (item.id === 'LUCK_CHARM' && hasLuckCharm) return false;
        if (item.id === 'SONIC_BLAST' && hasSonicBlast) return false;
        if (item.id === 'DRONE' && hasDrone) return false;
        if (item.id === 'REVIVE' && hasRevive) return false;
        if (item.id === 'DISCOUNT' && hasDiscount) return false;
        
        // Limit shields to 3 max
        if (item.id === 'SHIELD' && shieldCount >= 3) return false;

        // Limit max lives to 10
        if (item.id === 'MAX_LIFE' && maxLives >= 10) return false;

        // Block HEAL if life is full
        if (item.id === 'HEAL' && lives >= maxLives) return false;
        
        return true;
    });

    // Shuffle
    pool = pool.sort(() => 0.5 - Math.random());
    
    // Pick top 3
    let selected = pool.slice(0, 3);
    
    // If slots are empty, fill with Score Exchange
    if (selected.length < 3) {
        const needed = 3 - selected.length;
        for(let i=0; i<needed; i++) {
            selected.push({
                id: 'EXCHANGE',
                name: 'スコア換金',
                description: '全ジェムをスコアに変換 (1ジェム=100点)',
                cost: 0, // dynamic
                icon: Trophy
            });
        }
    }
    
    return selected;
};

const ShopScreen: React.FC = () => {
    const store = useStore();
    const { currency, buyItem, closeShop, spendCurrency, hasDoubleJump, hasImmortality, magnetLevel, hasTimeWarp, shieldCount, hasGemBooster, hasLuckCharm, hasSonicBlast, hasDrone, hasRevive, hasDiscount, maxLives, lives } = store;
    const [items, setItems] = useState<ShopItem[]>([]);

    useEffect(() => {
        setItems(generateShopItems(store));
    }, []); // Run once on open

    const handleRefresh = () => {
        if (spendCurrency(100)) {
            setItems(generateShopItems(useStore.getState()));
        }
    };

    const handleBuyAll = () => {
        // We iterate through current items and try to buy them
        // We re-check affordablity for each in case money runs out mid-loop
        items.forEach(item => {
            // Check if item is still valid to buy (e.g. didn't hit max shield mid-loop)
            const currentStore = useStore.getState();
            let isValid = true;

            // Re-check specific blocks that might change during the loop
            if (item.id === 'HEAL' && currentStore.lives >= currentStore.maxLives) isValid = false;
            if (item.id === 'SHIELD' && currentStore.shieldCount >= 3) isValid = false;
            
            // Re-calculate cost
            let finalCost = currentStore.hasDiscount ? Math.floor(item.cost * 0.8) : item.cost;
            if (item.id === 'EXCHANGE') finalCost = currentStore.currency;

            if (isValid && currentStore.currency >= finalCost) {
                 buyItem(item.id, finalCost);
            }
        });
        // Force re-render of button states is handled by store update, 
        // but we might want to refresh the logic if needed. 
        // Actually, the component will re-render because store values changed.
    };

    return (
        <div className="absolute inset-0 bg-black/90 z-[100] text-white pointer-events-auto backdrop-blur-md overflow-y-auto">
             <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
                 <h2 className="text-3xl md:text-4xl font-black text-cyan-400 mb-2 font-cyber tracking-widest text-center">CYBER SHOP</h2>
                 {hasDiscount && <p className="text-yellow-400 font-bold mb-2">VIP会員様: 全品20% OFF</p>}
                 
                 {/* Wallet Display */}
                 <div className="flex items-center justify-between gap-4 mb-8">
                     <div className="flex items-center bg-gray-800 px-6 py-2 rounded-full border border-yellow-500/50 shadow-[0_0_15px_rgba(255,215,0,0.3)]">
                         <Diamond className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" />
                         <span className="text-xl md:text-2xl font-bold font-mono text-yellow-100">{currency.toLocaleString()}</span>
                     </div>
                     
                     <div className="flex gap-2">
                        <button 
                             onClick={handleRefresh}
                             disabled={currency < 100}
                             className={`flex items-center px-4 py-2 rounded-lg border font-bold text-sm transition-all ${
                                 currency >= 100 
                                 ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 hover:border-cyan-400 text-cyan-400' 
                                 : 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
                             }`}
                         >
                             <RefreshCw className="w-4 h-4 mr-2" />
                             商品入替 (100)
                         </button>
                         <button 
                             onClick={handleBuyAll}
                             className="flex items-center px-4 py-2 rounded-lg border font-bold text-sm transition-all bg-gradient-to-r from-yellow-600 to-orange-600 border-yellow-500 hover:brightness-110 text-white shadow-lg"
                         >
                             <ShoppingBag className="w-4 h-4 mr-2" />
                             大人買い
                         </button>
                     </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl w-full mb-8">
                     {items.length > 0 ? items.map((item, idx) => {
                         const Icon = item.icon;
                         
                         // Determine visual status
                         let finalCost = hasDiscount ? Math.floor(item.cost * 0.8) : item.cost;
                         let canAfford = currency >= finalCost;
                         
                         // Special logic for Exchange
                         if (item.id === 'EXCHANGE') {
                             finalCost = currency; // Show current wallet as 'cost'
                             canAfford = currency > 0;
                         }

                         // Re-check conditions for disabling buttons after purchase
                         let isDisabled = !canAfford;
                         let disabledReason = '';

                         // Check blocking conditions again (dynamic) for consumables/levels
                         if (item.id === 'HEAL' && lives >= maxLives) { isDisabled = true; disabledReason = 'MAX LIFE'; }
                         if (item.id === 'SHIELD' && shieldCount >= 3) { isDisabled = true; disabledReason = 'MAX'; }
                         if (item.id === 'MAX_LIFE' && maxLives >= 10) { isDisabled = true; disabledReason = 'MAX'; }
                         if (item.id === 'MAGNET' && magnetLevel >= 5) { isDisabled = true; disabledReason = 'MAX'; }

                         // Check blocking conditions for one-time skills
                         if (item.id === 'DOUBLE_JUMP' && hasDoubleJump) { isDisabled = true; disabledReason = 'SOLD'; }
                         if (item.id === 'IMMORTAL' && hasImmortality) { isDisabled = true; disabledReason = 'SOLD'; }
                         if (item.id === 'TIME_WARP' && hasTimeWarp) { isDisabled = true; disabledReason = 'SOLD'; }
                         if (item.id === 'GEM_BOOSTER' && hasGemBooster) { isDisabled = true; disabledReason = 'SOLD'; }
                         if (item.id === 'LUCK_CHARM' && hasLuckCharm) { isDisabled = true; disabledReason = 'SOLD'; }
                         if (item.id === 'SONIC_BLAST' && hasSonicBlast) { isDisabled = true; disabledReason = 'SOLD'; }
                         if (item.id === 'DRONE' && hasDrone) { isDisabled = true; disabledReason = 'SOLD'; }
                         if (item.id === 'REVIVE' && hasRevive) { isDisabled = true; disabledReason = 'SOLD'; }
                         if (item.id === 'DISCOUNT' && hasDiscount) { isDisabled = true; disabledReason = 'SOLD'; }
                         
                         let name = item.name;
                         if (item.id === 'MAGNET' && magnetLevel < 5) {
                             name = `マグネット (Lv.${magnetLevel + 1})`;
                         }

                         return (
                             <div key={`${item.id}-${idx}`} className="bg-gray-900/80 border border-gray-700 p-4 md:p-6 rounded-xl flex flex-col items-center text-center hover:border-cyan-500 transition-colors relative group">
                                 <div className="bg-gray-800 p-3 md:p-4 rounded-full mb-3 md:mb-4 group-hover:bg-cyan-900/50 transition-colors">
                                     <Icon className="w-6 h-6 md:w-8 md:h-8 text-cyan-400" />
                                 </div>
                                 <h3 className="text-lg md:text-xl font-bold mb-2">{name}</h3>
                                 <p className="text-gray-400 text-xs md:text-sm mb-4 h-10 md:h-12 flex items-center justify-center">{item.description}</p>
                                 
                                 <button 
                                    onClick={() => {
                                        if (buyItem(item.id, finalCost)) {
                                            // Store update triggers re-render
                                        }
                                    }}
                                    disabled={isDisabled}
                                    className={`px-4 md:px-6 py-2 rounded font-bold w-full text-sm md:text-base flex items-center justify-center transition-all ${
                                        isDisabled 
                                        ? 'bg-gray-700 cursor-not-allowed opacity-50' 
                                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 shadow-lg hover:scale-105'
                                    }`}
                                 >
                                     {disabledReason ? (
                                         <span>{disabledReason}</span>
                                     ) : (
                                         <>
                                             {item.id === 'EXCHANGE' ? <Trophy className="w-4 h-4 mr-1"/> : <Diamond className="w-4 h-4 mr-1" />}
                                             {hasDiscount && item.id !== 'EXCHANGE' && <span className="line-through text-gray-400 mr-2 text-xs">{item.cost}</span>}
                                             {item.id === 'EXCHANGE' ? '変換' : finalCost}
                                         </>
                                     )}
                                 </button>
                             </div>
                         );
                     }) : (
                         <div className="col-span-3 text-center text-gray-500 py-10">
                             <p>在庫切れ</p>
                         </div>
                     )}
                 </div>

                 <button 
                    onClick={closeShop}
                    className="flex items-center px-8 md:px-10 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg md:text-xl rounded hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,0,255,0.4)]"
                 >
                     ミッション再開 <Play className="ml-2 w-5 h-5" fill="white" />
                 </button>
             </div>
        </div>
    );
};

export const HUD: React.FC = () => {
  const { score, currency, lives, maxLives, collectedLetters, status, level, restartGame, startGame, selectMode, gemsCollected, distance, isImmortalityActive, speed, showJumpAlert, gameMode, magnetLevel, shieldCount, isTimeWarpActive, hasGemBooster, hasLuckCharm, hasSonicBlast, lastSonicBlastTime, triggerSonicBlast, targetLevels, hasDrone, hasRevive } = useStore();
  const [sonicCooldown, setSonicCooldown] = useState(0);
  const target = ['G', 'E', 'M', 'I', 'N', 'I'];

  // Sonic Blast Cooldown Timer
  useEffect(() => {
    if (!hasSonicBlast) return;
    const interval = setInterval(() => {
        const diff = Date.now() - lastSonicBlastTime;
        const remaining = Math.max(0, 15000 - diff);
        setSonicCooldown(remaining);
    }, 100);
    return () => clearInterval(interval);
  }, [hasSonicBlast, lastSonicBlastTime]);

  const handleSonicBlast = () => {
      const fired = triggerSonicBlast();
      if (fired) {
          window.dispatchEvent(new CustomEvent('trigger-sonic-blast'));
      }
  };

  // Common container style
  const containerClass = "absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-8 z-50";

  if (status === GameStatus.SHOP) {
      return <ShopScreen />;
  }

  // Level Selection Screen
  if (status === GameStatus.LEVEL_SELECT) {
      return (
          <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
              <div className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,255,255,0.2)] border border-white/10 animate-in zoom-in-95 duration-500">
                  <div className="relative w-full bg-gray-900 p-6 flex flex-col items-center">
                     <h2 className="text-2xl md:text-3xl font-black text-white mb-6 font-cyber text-center">
                        コースを選択
                     </h2>
                     
                     <div className="grid grid-cols-2 gap-3 w-full mb-4">
                        <button onClick={() => { audio.init(); startGame(3); }} className="p-4 bg-gray-800 hover:bg-cyan-900/50 border border-gray-600 hover:border-cyan-400 rounded-xl transition-all flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-cyan-400">3</span>
                            <span className="text-xs text-gray-400 mt-1">SHORT</span>
                        </button>
                        <button onClick={() => { audio.init(); startGame(5); }} className="p-4 bg-gray-800 hover:bg-cyan-900/50 border border-gray-600 hover:border-cyan-400 rounded-xl transition-all flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-cyan-400">5</span>
                            <span className="text-xs text-gray-400 mt-1">NORMAL</span>
                        </button>
                        <button onClick={() => { audio.init(); startGame(10); }} className="p-4 bg-gray-800 hover:bg-cyan-900/50 border border-gray-600 hover:border-cyan-400 rounded-xl transition-all flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-cyan-400">10</span>
                            <span className="text-xs text-gray-400 mt-1">LONG</span>
                        </button>
                        <button onClick={() => { audio.init(); startGame(15); }} className="p-4 bg-gray-800 hover:bg-cyan-900/50 border border-gray-600 hover:border-cyan-400 rounded-xl transition-all flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-cyan-400">15</span>
                            <span className="text-xs text-gray-400 mt-1">MARATHON</span>
                        </button>
                     </div>

                     <button 
                        onClick={() => { audio.init(); startGame(Infinity); }}
                        className="w-full p-4 bg-purple-900/50 hover:bg-purple-800/80 border border-purple-500 hover:border-purple-300 rounded-xl transition-all flex items-center justify-center group mb-4"
                     >
                         <InfinityIcon className="w-8 h-8 text-purple-400 mr-2 group-hover:scale-110 transition-transform" />
                         <div>
                             <div className="text-lg font-bold text-white group-hover:text-purple-200">ENDLESS RUN</div>
                             <div className="text-xs text-purple-300/70">限界に挑戦 (スコアアタック)</div>
                         </div>
                     </button>
                  </div>
              </div>
          </div>
      );
  }

  if (status === GameStatus.MENU) {
      return (
          <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
              <div className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,255,255,0.2)] border border-white/10 animate-in zoom-in-95 duration-500">
                <div className="relative w-full bg-gray-900 p-6 flex flex-col items-center">
                     <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-8 font-cyber tracking-tighter drop-shadow-lg">
                        GEMINI RUNNER
                     </h1>
                     
                     <div className="w-full grid gap-4">
                        <button 
                          onClick={() => selectMode(GameMode.NORMAL)}
                          className="group relative w-full p-4 bg-gray-800/50 hover:bg-cyan-900/30 border border-gray-600 hover:border-cyan-400 rounded-xl transition-all text-left flex items-center"
                        >
                            <div className="bg-cyan-500/20 p-3 rounded-full mr-4 group-hover:bg-cyan-500/40">
                                <Play className="w-6 h-6 text-cyan-400" />
                            </div>
                            <div>
                                <div className="text-xl font-bold text-white group-hover:text-cyan-300">ノーマルモード</div>
                                <div className="text-xs text-gray-400">標準的な難易度でプレイします。</div>
                            </div>
                        </button>

                        <button 
                          onClick={() => selectMode(GameMode.ASSIST)}
                          className="group relative w-full p-4 bg-gray-800/50 hover:bg-green-900/30 border border-gray-600 hover:border-green-400 rounded-xl transition-all text-left flex items-center"
                        >
                            <div className="bg-green-500/20 p-3 rounded-full mr-4 group-hover:bg-green-500/40">
                                <Crosshair className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                                <div className="text-xl font-bold text-white group-hover:text-green-300">アシストモード</div>
                                <div className="text-xs text-gray-400">ジャンプ軌道とタイミングガイドを表示します。</div>
                            </div>
                        </button>

                        <button 
                          onClick={() => selectMode(GameMode.CHEAT)}
                          className="group relative w-full p-4 bg-gray-800/50 hover:bg-red-900/30 border border-gray-600 hover:border-red-500 rounded-xl transition-all text-left flex items-center"
                        >
                            <div className="bg-red-500/20 p-3 rounded-full mr-4 group-hover:bg-red-500/40">
                                <Skull className="w-6 h-6 text-red-500" />
                            </div>
                            <div>
                                <div className="text-xl font-bold text-white group-hover:text-red-400">チートモード</div>
                                <div className="text-xs text-gray-400">無敵 ＆ 全アイテム所持で開始します。</div>
                            </div>
                        </button>
                     </div>

                     <p className="text-cyan-400/60 text-[10px] md:text-xs font-mono mt-8 tracking-wider">
                        [ 矢印キー / スワイプで移動・ジャンプ ]
                     </p>
                </div>
              </div>
          </div>
      );
  }

  if (status === GameStatus.GAME_OVER) {
      return (
          <div className="absolute inset-0 bg-black/90 z-[100] text-white pointer-events-auto backdrop-blur-sm overflow-y-auto">
              <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
                <h1 className="text-4xl md:text-6xl font-black text-white mb-6 drop-shadow-[0_0_10px_rgba(255,0,0,0.8)] font-cyber text-center">GAME OVER</h1>
                
                <div className="grid grid-cols-1 gap-3 md:gap-4 text-center mb-8 w-full max-w-md">
                    <div className="bg-gray-900/80 p-3 md:p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                        <div className="flex items-center text-yellow-400 text-sm md:text-base"><Trophy className="mr-2 w-4 h-4 md:w-5 md:h-5"/> レベル</div>
                        <div className="text-xl md:text-2xl font-bold font-mono">
                            {level} <span className="text-sm text-gray-500 ml-1">/ {targetLevels === Infinity ? '∞' : targetLevels}</span>
                        </div>
                    </div>
                    <div className="bg-gray-900/80 p-3 md:p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                        <div className="flex items-center text-cyan-400 text-sm md:text-base"><Diamond className="mr-2 w-4 h-4 md:w-5 md:h-5"/> 獲得ジェム</div>
                        <div className="text-xl md:text-2xl font-bold font-mono">{gemsCollected}</div>
                    </div>
                    <div className="bg-gray-900/80 p-3 md:p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                        <div className="flex items-center text-purple-400 text-sm md:text-base"><MapPin className="mr-2 w-4 h-4 md:w-5 md:h-5"/> 到達距離</div>
                        <div className="text-xl md:text-2xl font-bold font-mono">{Math.floor(distance)} LY</div>
                    </div>
                     <div className="bg-gray-800/50 p-3 md:p-4 rounded-lg flex items-center justify-between mt-2">
                        <div className="flex items-center text-white text-sm md:text-base">トータルスコア</div>
                        <div className="text-2xl md:text-3xl font-bold font-cyber text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">{score.toLocaleString()}</div>
                    </div>
                </div>

                <button 
                  onClick={() => { audio.init(); restartGame(); }}
                  className="px-8 md:px-10 py-3 md:py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg md:text-xl rounded hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)]"
                >
                    リトライ
                </button>
              </div>
          </div>
      );
  }

  if (status === GameStatus.VICTORY) {
    const isEndless = targetLevels === Infinity;
    return (
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/90 to-black/95 z-[100] text-white pointer-events-auto backdrop-blur-md overflow-y-auto">
            <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
                <Rocket className="w-16 h-16 md:w-24 md:h-24 text-yellow-400 mb-4 animate-bounce drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]" />
                <h1 className="text-3xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-500 to-pink-500 mb-2 drop-shadow-[0_0_20px_rgba(255,165,0,0.6)] font-cyber text-center leading-tight">
                    {isEndless ? 'ENDLESS RUN RESULT' : 'MISSION COMPLETE'}
                </h1>
                <p className="text-cyan-300 text-sm md:text-lg font-mono mb-8 tracking-widest text-center">
                    {isEndless 
                      ? '限界への挑戦が終了しました' 
                      : `全${targetLevels}ステージ踏破！宇宙の真理に到達しました`
                    }
                </p>
                
                <div className="grid grid-cols-1 gap-4 text-center mb-8 w-full max-w-md">
                    <div className="bg-black/60 p-6 rounded-xl border border-yellow-500/30 shadow-[0_0_15px_rgba(255,215,0,0.1)]">
                        <div className="text-xs md:text-sm text-gray-400 mb-1 tracking-wider">最終スコア</div>
                        <div className="text-3xl md:text-4xl font-bold font-cyber text-yellow-400">{score.toLocaleString()}</div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/60 p-4 rounded-lg border border-white/10">
                            <div className="text-xs text-gray-400">獲得ジェム</div>
                            <div className="text-xl md:text-2xl font-bold text-cyan-400">{gemsCollected}</div>
                        </div>
                        <div className="bg-black/60 p-4 rounded-lg border border-white/10">
                             <div className="text-xs text-gray-400">到達距離</div>
                            <div className="text-xl md:text-2xl font-bold text-purple-400">{Math.floor(distance)} LY</div>
                        </div>
                     </div>
                </div>

                <button 
                  onClick={() => { audio.init(); restartGame(); }}
                  className="px-8 md:px-12 py-4 md:py-5 bg-white text-black font-black text-lg md:text-xl rounded hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] tracking-widest"
                >
                    最初から遊ぶ
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className={containerClass}>
        {/* Real-time Jump Alert Overlay */}
        {showJumpAlert && (
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-bounce pointer-events-none">
                 <div className="flex flex-col items-center justify-center">
                     <AlertTriangle className="w-12 h-12 md:w-20 md:h-20 text-red-500 fill-red-500 mb-2 drop-shadow-[0_0_15px_rgba(255,0,0,0.8)]" />
                     <h2 className="text-4xl md:text-6xl font-black text-red-500 tracking-tighter drop-shadow-[0_0_10px_rgba(255,0,0,1)] stroke-white stroke-2">
                         ジャンプ！
                     </h2>
                 </div>
             </div>
        )}

        {/* Top Bar */}
        <div className="flex justify-between items-start w-full">
            <div className="flex flex-col space-y-2">
                {/* Score */}
                <div className="flex items-center">
                    <span className="text-xs text-gray-400 mr-2 font-mono uppercase tracking-widest">SCORE</span>
                    <div className="text-2xl md:text-4xl font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] font-cyber">
                        {score.toLocaleString()}
                    </div>
                </div>
                {/* Currency */}
                <div className="flex items-center">
                    <Diamond className="w-4 h-4 text-yellow-400 mr-2" fill="currentColor" />
                    <div className="text-xl md:text-2xl font-bold text-yellow-300 font-mono drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]">
                        {currency.toLocaleString()}
                    </div>
                </div>
            </div>
            
            <div className="flex space-x-1 md:space-x-2">
                {gameMode === GameMode.CHEAT ? (
                   <div className="flex items-center bg-red-900/80 px-3 py-1 rounded-full border border-red-500">
                        <Skull className="w-5 h-5 text-red-400 mr-2" />
                        <span className="text-red-400 font-bold text-sm">CHEAT MODE</span>
                   </div>
                ) : (
                    <div className="flex items-center">
                         {lives > 5 ? (
                             <div className="flex items-center space-x-1">
                                 {[...Array(5)].map((_, i) => (
                                    <Heart key={i} className="w-6 h-6 md:w-8 md:h-8 text-pink-500 fill-pink-500 drop-shadow-[0_0_5px_#ff0054]" />
                                 ))}
                                 <span className="text-xl font-bold text-pink-400 ml-1">+{lives - 5}</span>
                             </div>
                         ) : (
                             [...Array(maxLives)].map((_, i) => (
                                <Heart 
                                    key={i} 
                                    className={`w-6 h-6 md:w-8 md:h-8 ${i < lives ? 'text-pink-500 fill-pink-500' : 'text-gray-800 fill-gray-800'} drop-shadow-[0_0_5px_#ff0054]`} 
                                />
                             ))
                         )}
                    </div>
                )}
            </div>
        </div>
        
        {/* Level Indicator */}
        <div className="absolute top-5 left-1/2 transform -translate-x-1/2 text-sm md:text-lg text-purple-300 font-bold tracking-wider font-mono bg-black/50 px-3 py-1 rounded-full border border-purple-500/30 backdrop-blur-sm z-50 flex items-center">
            {targetLevels === Infinity ? (
                <>
                    <InfinityIcon className="w-4 h-4 mr-2" /> ENDLESS RUN <span className="text-gray-400 ml-2">LVL {level}</span>
                </>
            ) : (
                <>
                    レベル {level} <span className="text-gray-500 text-xs md:text-sm ml-1">/ {targetLevels}</span>
                </>
            )}
        </div>

        {/* Active Skill Indicators */}
        <div className="absolute top-32 left-1/2 transform -translate-x-1/2 flex flex-col items-center space-y-2 w-full pointer-events-none">
            {isImmortalityActive && (
                <div className="text-yellow-400 font-bold text-xl md:text-2xl animate-pulse flex items-center drop-shadow-[0_0_10px_gold]">
                    <Shield className="mr-2 fill-yellow-400" /> 無敵
                </div>
            )}
            {isTimeWarpActive && (
                <div className="text-blue-400 font-bold text-xl md:text-2xl animate-pulse flex items-center drop-shadow-[0_0_10px_blue]">
                    <Clock className="mr-2 fill-blue-400" /> タイムワープ
                </div>
            )}
        </div>
        
        {/* Passive Items Indicator (Left side) */}
        <div className="absolute top-32 left-4 md:left-8 flex flex-col space-y-2 items-start">
             {shieldCount > 0 && (
                 <div className="flex items-center text-cyan-400 bg-cyan-900/30 px-2 py-1 rounded border border-cyan-500/50">
                     <Disc className="w-4 h-4 mr-2 animate-spin-slow" />
                     <span className="text-sm font-mono">シールド x{shieldCount}</span>
                 </div>
             )}
             {magnetLevel > 0 && (
                 <div className="flex items-center text-pink-400 bg-pink-900/30 px-2 py-1 rounded border border-pink-500/50">
                     <Magnet className="w-4 h-4 mr-2" />
                     <span className="text-sm font-mono">マグネット Lv.{magnetLevel}</span>
                 </div>
             )}
             {hasGemBooster && (
                 <div className="flex items-center text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded border border-yellow-500/50">
                     <Sparkles className="w-4 h-4 mr-2" />
                     <span className="text-sm font-mono">ブースター</span>
                 </div>
             )}
             {hasLuckCharm && (
                 <div className="flex items-center text-green-400 bg-green-900/30 px-2 py-1 rounded border border-green-500/50">
                     <Clover className="w-4 h-4 mr-2" />
                     <span className="text-sm font-mono">お守り</span>
                 </div>
             )}
             {hasDrone && (
                 <div className="flex items-center text-red-400 bg-red-900/30 px-2 py-1 rounded border border-red-500/50">
                     <Bot className="w-4 h-4 mr-2" />
                     <span className="text-sm font-mono">ドローン</span>
                 </div>
             )}
             {hasRevive && (
                 <div className="flex items-center text-purple-400 bg-purple-900/30 px-2 py-1 rounded border border-purple-500/50">
                     <Cross className="w-4 h-4 mr-2" />
                     <span className="text-sm font-mono">蘇生アンク</span>
                 </div>
             )}
        </div>

        {/* Sonic Blast Button (Bottom Right) */}
        {hasSonicBlast && (
            <div className="absolute bottom-8 right-8 pointer-events-auto">
                <button
                    onClick={handleSonicBlast}
                    disabled={sonicCooldown > 0}
                    className={`relative w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${
                        sonicCooldown > 0 
                        ? 'border-gray-600 bg-gray-800 cursor-not-allowed' 
                        : 'border-orange-500 bg-orange-900/50 hover:scale-110 hover:bg-orange-600/50 shadow-[0_0_20px_orange]'
                    }`}
                >
                    <Radio className={`w-10 h-10 ${sonicCooldown > 0 ? 'text-gray-500' : 'text-orange-400 animate-pulse'}`} />
                    {sonicCooldown > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full font-mono text-white text-lg font-bold">
                            {Math.ceil(sonicCooldown / 1000)}
                        </div>
                    )}
                    <div className="absolute -bottom-6 text-xs text-orange-400 font-bold tracking-widest">[ Z ]</div>
                </button>
            </div>
        )}

        {/* Gemini Collection Status */}
        <div className="absolute top-16 md:top-24 left-1/2 transform -translate-x-1/2 flex space-x-2 md:space-x-3 mt-8">
            {target.map((char, idx) => {
                const isCollected = collectedLetters.includes(idx);
                const color = GEMINI_COLORS[idx];

                return (
                    <div 
                        key={idx}
                        style={{
                            borderColor: isCollected ? color : 'rgba(55, 65, 81, 1)',
                            color: isCollected ? 'rgba(0, 0, 0, 0.8)' : 'rgba(55, 65, 81, 1)',
                            boxShadow: isCollected ? `0 0 20px ${color}` : 'none',
                            backgroundColor: isCollected ? color : 'rgba(0, 0, 0, 0.9)'
                        }}
                        className={`w-8 h-10 md:w-10 md:h-12 flex items-center justify-center border-2 font-black text-lg md:text-xl font-cyber rounded-lg transform transition-all duration-300`}
                    >
                        {char}
                    </div>
                );
            })}
        </div>

        {/* Bottom Overlay Info */}
        <div className="absolute bottom-4 left-4 flex items-center space-x-2 text-cyan-500 opacity-70">
             <Zap className="w-4 h-4 md:w-6 md:h-6 animate-pulse" />
             <span className="font-mono text-base md:text-xl">速度 {Math.round(((speed * (isTimeWarpActive ? 0.5 : 1.0)) / RUN_SPEED_BASE) * 100)}%</span>
        </div>
    </div>
  );
};