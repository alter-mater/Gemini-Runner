

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { create } from 'zustand';
import { GameStatus, RUN_SPEED_BASE, GameMode } from './types';

interface GameState {
  status: GameStatus;
  gameMode: GameMode;
  targetLevels: number; // The goal level count (Infinity for endless)
  
  score: number;
  currency: number; // Spendable money
  lives: number;
  maxLives: number;
  speed: number;
  collectedLetters: number[]; 
  level: number;
  laneCount: number;
  gemsCollected: number;
  distance: number;
  
  // Inventory / Abilities
  hasDoubleJump: boolean;
  hasImmortality: boolean;
  isImmortalityActive: boolean;
  isShopInvincible: boolean; // Invincibility after shop close
  
  // Existing Items
  magnetLevel: number; // Changed from hasMagnet boolean to level (0-5)
  shieldCount: number;
  hasTimeWarp: boolean;
  isTimeWarpActive: boolean;

  // New Items
  hasGemBooster: boolean;
  hasLuckCharm: boolean;
  hasSonicBlast: boolean;
  lastSonicBlastTime: number;
  
  // Even Newer Items
  hasDrone: boolean;
  hasRevive: boolean; // "Ankh"
  hasDiscount: boolean; // "VIP Card"

  // Jump Assist State
  playerLane: number;
  showJumpAlert: boolean;

  // Actions
  selectMode: (mode: GameMode) => void;
  startGame: (targetLevels: number) => void;
  restartGame: () => void;
  takeDamage: () => void;
  addScore: (amount: number) => void;
  collectGem: (value: number, isHealing?: boolean) => void;
  collectLetter: (index: number) => void;
  setStatus: (status: GameStatus) => void;
  setDistance: (dist: number) => void;
  
  // Shop / Abilities
  buyItem: (type: string, cost: number) => boolean;
  spendCurrency: (amount: number) => boolean;
  advanceLevel: () => void;
  openShop: () => void;
  closeShop: () => void;
  activateImmortality: () => void;
  activateTimeWarp: () => void;
  triggerSonicBlast: () => boolean;
  
  // Assist Actions
  setPlayerLane: (lane: number) => void;
  setShowJumpAlert: (show: boolean) => void;
}

const GEMINI_TARGET = ['G', 'E', 'M', 'I', 'N', 'I'];
const SONIC_BLAST_COOLDOWN = 15000; // 15 seconds

export const useStore = create<GameState>((set, get) => ({
  status: GameStatus.MENU,
  gameMode: GameMode.NORMAL,
  targetLevels: 5,
  score: 0,
  currency: 0,
  lives: 3,
  maxLives: 3,
  speed: 0,
  collectedLetters: [],
  level: 1,
  laneCount: 3,
  gemsCollected: 0,
  distance: 0,
  
  hasDoubleJump: false,
  hasImmortality: false,
  isImmortalityActive: false,
  isShopInvincible: false,
  
  magnetLevel: 0,
  shieldCount: 0,
  hasTimeWarp: false,
  isTimeWarpActive: false,

  hasGemBooster: false,
  hasLuckCharm: false,
  hasSonicBlast: false,
  lastSonicBlastTime: 0,
  
  hasDrone: false,
  hasRevive: false,
  hasDiscount: false,

  playerLane: 0,
  showJumpAlert: false,

  selectMode: (mode: GameMode) => {
    set({
        gameMode: mode,
        status: GameStatus.LEVEL_SELECT
    });
  },

  startGame: (targetLevels: number) => {
    const { gameMode } = get();
    const isCheat = gameMode === GameMode.CHEAT;
    
    set({ 
      status: GameStatus.PLAYING, 
      targetLevels: targetLevels,
      score: 0, 
      currency: isCheat ? 9999999 : 0,
      lives: 3, 
      maxLives: 3,
      speed: RUN_SPEED_BASE,
      collectedLetters: [],
      level: 1,
      laneCount: 3,
      gemsCollected: 0,
      distance: 0,
      
      hasDoubleJump: isCheat, 
      hasImmortality: isCheat, 
      isImmortalityActive: false,
      isShopInvincible: false,
      
      magnetLevel: isCheat ? 5 : 0,
      shieldCount: isCheat ? 3 : 0,
      hasTimeWarp: isCheat,
      isTimeWarpActive: false,

      hasGemBooster: isCheat,
      hasLuckCharm: isCheat,
      hasSonicBlast: isCheat,
      lastSonicBlastTime: 0,
      
      hasDrone: isCheat,
      hasRevive: isCheat,
      hasDiscount: isCheat,

      playerLane: 0,
      showJumpAlert: false
    });
  },

  restartGame: () => {
    const { targetLevels } = get();
    get().startGame(targetLevels);
  },

  takeDamage: () => {
    const { lives, maxLives, isImmortalityActive, gameMode, shieldCount, isShopInvincible, hasRevive, targetLevels } = get();
    
    if (gameMode === GameMode.CHEAT || isImmortalityActive || isShopInvincible) return; 

    // Use Shield
    if (shieldCount > 0) {
        set({ shieldCount: shieldCount - 1 });
        return;
    }

    if (lives > 1) {
      set({ lives: lives - 1 });
    } else {
        // Revive Logic
        if (hasRevive) {
             set({ 
                 lives: maxLives, 
                 hasRevive: false,
                 isImmortalityActive: true // Give temporary invincibility after revive
             });
             // Trigger blast effect via window event
             window.dispatchEvent(new CustomEvent('trigger-sonic-blast'));
             setTimeout(() => {
                 set({ isImmortalityActive: false });
             }, 3000);
        } else {
            // Check if Endless Mode
            if (targetLevels === Infinity) {
                // In Endless Mode, death is a "Victory" (Run Complete)
                set({ lives: 0, status: GameStatus.VICTORY, speed: 0 });
            } else {
                set({ lives: 0, status: GameStatus.GAME_OVER, speed: 0 });
            }
        }
    }
  },

  addScore: (amount) => set((state) => ({ score: state.score + amount })),
  
  collectGem: (value, isHealing = false) => {
      const { hasGemBooster, score, gemsCollected, currency, lives, maxLives, level } = get();
      
      // Scaling: Currency value increases by 20% per level
      // Level 1: 100%, Level 2: 120%, Level 6: 200%
      const levelMultiplier = 1 + (level - 1) * 0.2;
      const boostMultiplier = hasGemBooster ? 2 : 1;
      
      const finalValue = Math.floor(value * levelMultiplier * boostMultiplier);
      
      const updates: Partial<GameState> = { 
        score: score + (finalValue * 10), 
        currency: currency + finalValue,
        gemsCollected: gemsCollected + 1 
      };

      if (isHealing && lives < maxLives) {
          updates.lives = lives + 1;
      }

      set(updates);
  },

  setDistance: (dist) => set({ distance: dist }),

  collectLetter: (index) => {
    const { collectedLetters, level, speed, targetLevels } = get();
    
    if (!collectedLetters.includes(index)) {
      const newLetters = [...collectedLetters, index];
      
      // More gradual speed increase (2.5% instead of 10%)
      const speedIncrease = RUN_SPEED_BASE * 0.025;
      const nextSpeed = speed + speedIncrease;

      set({ 
        collectedLetters: newLetters,
        speed: nextSpeed
      });

      if (newLetters.length === GEMINI_TARGET.length) {
        const isEndless = targetLevels === Infinity;
        
        if (isEndless || level < targetLevels) {
            get().advanceLevel();
        } else {
            set({
                status: GameStatus.VICTORY,
                score: get().score + 10000 // Bonus for finishing
            });
        }
      }
    }
  },

  advanceLevel: () => {
      const { level, laneCount, speed } = get();
      const nextLevel = level + 1;
      
      // Gentle speed bump on level up (10% instead of 40%)
      const speedIncrease = RUN_SPEED_BASE * 0.10;
      const newSpeed = speed + speedIncrease;

      set({
          level: nextLevel,
          laneCount: Math.min(laneCount + 2, 9), 
          status: GameStatus.PLAYING, 
          speed: newSpeed,
          collectedLetters: [] 
      });
  },

  openShop: () => set({ status: GameStatus.SHOP, isShopInvincible: true }),
  
  closeShop: () => {
      set({ status: GameStatus.PLAYING, isShopInvincible: true });
      // 3 seconds of invincibility after leaving shop
      setTimeout(() => {
          set({ isShopInvincible: false });
      }, 3000);
  },

  spendCurrency: (amount: number) => {
      const { currency } = get();
      if (currency >= amount) {
          set({ currency: currency - amount });
          return true;
      }
      return false;
  },

  buyItem: (type, cost) => {
      const { 
          currency, maxLives, lives, shieldCount, magnetLevel, score,
          hasDoubleJump, hasImmortality, hasTimeWarp, hasGemBooster, 
          hasLuckCharm, hasSonicBlast, hasDrone, hasRevive, hasDiscount 
      } = get();

      // --- Purchase Blocking Logic ---
      
      // 1. Score Exchange (Special Case)
      if (type === 'EXCHANGE') {
          if (currency > 0) {
              set({ 
                  score: score + (currency * 100), 
                  currency: 0 
              });
              return true;
          }
          return false;
      }

      // 2. Already Owned / Maxed Out blocking
      if (type === 'HEAL' && lives >= maxLives) return false;
      if (type === 'MAX_LIFE' && maxLives >= 10) return false;
      if (type === 'SHIELD' && shieldCount >= 3) return false;
      if (type === 'MAGNET' && magnetLevel >= 5) return false;
      
      if (type === 'DOUBLE_JUMP' && hasDoubleJump) return false;
      if (type === 'IMMORTAL' && hasImmortality) return false;
      if (type === 'TIME_WARP' && hasTimeWarp) return false;
      if (type === 'GEM_BOOSTER' && hasGemBooster) return false;
      if (type === 'LUCK_CHARM' && hasLuckCharm) return false;
      if (type === 'SONIC_BLAST' && hasSonicBlast) return false;
      if (type === 'DRONE' && hasDrone) return false;
      if (type === 'REVIVE' && hasRevive) return false;
      if (type === 'DISCOUNT' && hasDiscount) return false;

      // 3. Regular Purchase Logic
      if (currency >= cost) {
          set({ currency: currency - cost });
          
          switch (type) {
              case 'DOUBLE_JUMP':
                  set({ hasDoubleJump: true });
                  break;
              case 'MAX_LIFE':
                  if (maxLives < 10) {
                      set({ maxLives: maxLives + 1, lives: lives + 1 });
                  }
                  break;
              case 'HEAL':
                  set({ lives: Math.min(lives + 1, maxLives) });
                  break;
              case 'IMMORTAL':
                  set({ hasImmortality: true });
                  break;
              case 'MAGNET':
                  set({ magnetLevel: Math.min(magnetLevel + 1, 5) });
                  break;
              case 'SHIELD':
                  set({ shieldCount: Math.min(shieldCount + 1, 3) });
                  break;
              case 'TIME_WARP':
                  set({ hasTimeWarp: true });
                  break;
              case 'GEM_BOOSTER':
                  set({ hasGemBooster: true });
                  break;
              case 'LUCK_CHARM':
                  set({ hasLuckCharm: true });
                  break;
              case 'SONIC_BLAST':
                  set({ hasSonicBlast: true, lastSonicBlastTime: 0 }); 
                  break;
              case 'DRONE':
                  set({ hasDrone: true });
                  break;
              case 'REVIVE':
                  set({ hasRevive: true });
                  break;
              case 'DISCOUNT':
                  set({ hasDiscount: true });
                  break;
          }
          return true;
      }
      return false;
  },

  activateImmortality: () => {
      const { hasImmortality, isImmortalityActive } = get();
      if (hasImmortality && !isImmortalityActive) {
          set({ isImmortalityActive: true });
          setTimeout(() => {
              set({ isImmortalityActive: false });
          }, 5000);
      }
  },

  activateTimeWarp: () => {
      const { hasTimeWarp, isTimeWarpActive } = get();
      if (hasTimeWarp && !isTimeWarpActive) {
          set({ isTimeWarpActive: true });
          setTimeout(() => {
              set({ isTimeWarpActive: false });
          }, 5000);
      }
  },

  triggerSonicBlast: () => {
      const { hasSonicBlast, lastSonicBlastTime } = get();
      const now = Date.now();
      if (hasSonicBlast && now - lastSonicBlastTime > SONIC_BLAST_COOLDOWN) {
          set({ lastSonicBlastTime: now });
          // Event dispatch is handled in component, or we can just return true here
          return true;
      }
      return false;
  },

  setStatus: (status) => set({ status }),
  
  setPlayerLane: (lane) => set({ playerLane: lane }),
  
  setShowJumpAlert: (show) => {
      if (get().showJumpAlert !== show) {
          set({ showJumpAlert: show });
      }
  }
}));