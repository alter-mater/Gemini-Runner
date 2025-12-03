


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text3D, Center } from '@react-three/drei';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import { GameObject, ObjectType, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE, GameStatus, GEMINI_COLORS, GameMode } from '../../types';
import { audio } from '../System/Audio';

// Geometry Constants
const OBSTACLE_HEIGHT = 1.6;
const OBSTACLE_GEOMETRY = new THREE.ConeGeometry(0.9, OBSTACLE_HEIGHT, 6);
const OBSTACLE_GLOW_GEO = new THREE.ConeGeometry(0.9, OBSTACLE_HEIGHT, 6);
const OBSTACLE_RING_GEO = new THREE.RingGeometry(0.6, 0.9, 6);

const GEM_GEOMETRY = new THREE.IcosahedronGeometry(0.3, 0);

// Alien Geometries
const ALIEN_BODY_GEO = new THREE.CylinderGeometry(0.6, 0.3, 0.3, 8);
const ALIEN_DOME_GEO = new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI/2);
const ALIEN_EYE_GEO = new THREE.SphereGeometry(0.1);

// Missile Geometries
const MISSILE_CORE_GEO = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 8);
const MISSILE_RING_GEO = new THREE.TorusGeometry(0.15, 0.02, 16, 32);

// Shadow Geometries
const SHADOW_LETTER_GEO = new THREE.PlaneGeometry(2, 0.6);
const SHADOW_GEM_GEO = new THREE.CircleGeometry(0.6, 32);
const SHADOW_ALIEN_GEO = new THREE.CircleGeometry(0.8, 32);
const SHADOW_MISSILE_GEO = new THREE.PlaneGeometry(0.15, 3);
const SHADOW_DEFAULT_GEO = new THREE.CircleGeometry(0.8, 6);

// Shop Geometries
const SHOP_FRAME_GEO = new THREE.BoxGeometry(1, 7, 1);
const SHOP_BACK_GEO = new THREE.BoxGeometry(1, 5, 1.2);
const SHOP_OUTLINE_GEO = new THREE.BoxGeometry(1, 7.2, 0.8);
const SHOP_FLOOR_GEO = new THREE.PlaneGeometry(1, 4);

const PARTICLE_COUNT = 600;
const BASE_LETTER_INTERVAL = 150; 

// Revised Scaling: Gentler increase (1.15x instead of 1.5x) to support 10 levels
const getLetterInterval = (level: number) => {
    return BASE_LETTER_INTERVAL * Math.pow(1.15, Math.max(0, level - 1));
};

const MISSILE_SPEED = 30; // Extra speed added to world speed

// Font for 3D Text
const FONT_URL = "https://cdn.jsdelivr.net/npm/three/examples/fonts/helvetiker_bold.typeface.json";

// --- Particle System ---
const ParticleSystem: React.FC = () => {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    const particles = useMemo(() => new Array(PARTICLE_COUNT).fill(0).map(() => ({
        life: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        color: new THREE.Color()
    })), []);

    useEffect(() => {
        const handleExplosion = (e: CustomEvent) => {
            const { position, color, burstScale } = e.detail;
            let spawned = 0;
            const burstAmount = burstScale ? 100 : 40; 

            for(let i = 0; i < PARTICLE_COUNT; i++) {
                const p = particles[i];
                if (p.life <= 0) {
                    p.life = 1.0 + Math.random() * 0.5; 
                    p.pos.set(position[0], position[1], position[2]);
                    
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const speed = (2 + Math.random() * 10) * (burstScale || 1);
                    
                    p.vel.set(
                        Math.sin(phi) * Math.cos(theta),
                        Math.sin(phi) * Math.sin(theta),
                        Math.cos(phi)
                    ).multiplyScalar(speed);

                    p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    p.rotVel.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(5);
                    
                    p.color.set(color);
                    
                    spawned++;
                    if (spawned >= burstAmount) break;
                }
            }
        };
        
        window.addEventListener('particle-burst', handleExplosion as any);
        return () => window.removeEventListener('particle-burst', handleExplosion as any);
    }, [particles]);

    useFrame((state, delta) => {
        if (!mesh.current) return;
        const safeDelta = Math.min(delta, 0.1);

        particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= safeDelta * 1.5;
                p.pos.addScaledVector(p.vel, safeDelta);
                p.vel.y -= safeDelta * 5; 
                p.vel.multiplyScalar(0.98);

                p.rot.x += p.rotVel.x * safeDelta;
                p.rot.y += p.rotVel.y * safeDelta;
                
                dummy.position.copy(p.pos);
                const scale = Math.max(0, p.life * 0.25);
                dummy.scale.set(scale, scale, scale);
                
                dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
                dummy.updateMatrix();
                
                mesh.current!.setMatrixAt(i, dummy.matrix);
                mesh.current!.setColorAt(i, p.color);
            } else {
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
            }
        });
        
        mesh.current.instanceMatrix.needsUpdate = true;
        if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
        </instancedMesh>
    );
};


const getRandomLane = (laneCount: number) => {
    const max = Math.floor(laneCount / 2);
    return Math.floor(Math.random() * (max * 2 + 1)) - max;
};

// Generate a random Gem with properties based on rarity
const createRandomGem = (x: number, z: number, id: string, y: number = 1.2): GameObject => {
    const rand = Math.random();
    let color = '#00ffff'; // Cyan (Common)
    let points = 10;
    
    // 60% Cyan, 30% Gold, 9% Purple, 1% Green
    if (rand > 0.99) {
        // Emerald (Heal)
        color = '#00ff00';
        points = 50; 
        // Note: Special healing logic handled in collection
    } else if (rand > 0.90) {
        // Amethyst (Rare)
        color = '#9900ff';
        points = 150;
    } else if (rand > 0.60) {
        // Gold (Uncommon)
        color = '#ffd700';
        points = 50;
    }

    return {
        id,
        type: ObjectType.GEM,
        position: [x, y, z],
        active: true,
        color: color,
        points: points
    };
};

export const LevelManager: React.FC = () => {
  const { 
    status, 
    speed, 
    collectGem, 
    collectLetter, 
    collectedLetters,
    laneCount,
    setDistance,
    openShop,
    level,
    playerLane,
    setShowJumpAlert,
    gameMode,
    magnetLevel,
    isTimeWarpActive,
    hasLuckCharm,
    hasDrone
  } = useStore();
  
  const objectsRef = useRef<GameObject[]>([]);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const prevStatus = useRef(status);
  const prevLevel = useRef(level);
  const lastDroneFireRef = useRef(0);

  const playerObjRef = useRef<THREE.Object3D | null>(null);
  const distanceTraveled = useRef(0);
  const nextLetterDistance = useRef(BASE_LETTER_INTERVAL);

  // Handle resets and transitions
  useEffect(() => {
    const isRestart = status === GameStatus.PLAYING && prevStatus.current === GameStatus.GAME_OVER;
    const isMenuReset = status === GameStatus.MENU;
    const isLevelUp = level !== prevLevel.current && status === GameStatus.PLAYING;
    const isVictoryReset = status === GameStatus.PLAYING && prevStatus.current === GameStatus.VICTORY;

    if (isMenuReset || isRestart || isVictoryReset) {
        objectsRef.current = [];
        setRenderTrigger(t => t + 1);
        distanceTraveled.current = 0;
        nextLetterDistance.current = getLetterInterval(1);
        setShowJumpAlert(false);

    } else if (isLevelUp && level > 1) {
        objectsRef.current = objectsRef.current.filter(obj => obj.position[2] > -80);
        objectsRef.current.push({
            id: uuidv4(),
            type: ObjectType.SHOP_PORTAL,
            position: [0, 0, -100], 
            active: true,
        });
        nextLetterDistance.current = distanceTraveled.current - SPAWN_DISTANCE + getLetterInterval(level);
        setRenderTrigger(t => t + 1);
        
    } else if (status === GameStatus.GAME_OVER || status === GameStatus.VICTORY) {
        setDistance(Math.floor(distanceTraveled.current));
        setShowJumpAlert(false);
    }
    
    prevStatus.current = status;
    prevLevel.current = level;
  }, [status, level, setDistance, setShowJumpAlert]);

  // Sonic Blast Event Listener
  useEffect(() => {
      const handleSonicBlast = () => {
          let blasted = false;
          objectsRef.current.forEach(obj => {
              // Destroy all hazards in front of player
              if (obj.active && (obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.ALIEN || obj.type === ObjectType.MISSILE)) {
                  // Check if in range (z < -5 (player is at 0) and z > -150)
                  if (obj.position[2] < 5 && obj.position[2] > -150) {
                      obj.active = false;
                      blasted = true;
                      window.dispatchEvent(new CustomEvent('particle-burst', { 
                          detail: { position: obj.position, color: '#ff8800', burstScale: 2 } 
                      }));
                  }
              }
          });
          if (blasted) setRenderTrigger(t => t + 1);
      };
      
      window.addEventListener('trigger-sonic-blast', handleSonicBlast);
      return () => window.removeEventListener('trigger-sonic-blast', handleSonicBlast);
  }, []);

  useFrame((state) => {
      if (!playerObjRef.current) {
          const group = state.scene.getObjectByName('PlayerGroup');
          if (group && group.children.length > 0) {
              playerObjRef.current = group.children[0];
          }
      }
  });

  useFrame((state, delta) => {
    if (status !== GameStatus.PLAYING) return;

    // Apply Time Warp factor
    const speedFactor = isTimeWarpActive ? 0.5 : 1.0;
    const effectiveSpeed = speed * speedFactor;

    const safeDelta = Math.min(delta, 0.05); 
    const dist = effectiveSpeed * safeDelta;
    
    distanceTraveled.current += dist;

    let hasChanges = false;
    let playerPos = new THREE.Vector3(0, 0, 0);
    
    if (playerObjRef.current) {
        playerObjRef.current.getWorldPosition(playerPos);
    }
    
    // --- DRONE AUTO-ATTACK LOGIC ---
    if (hasDrone) {
        const now = Date.now();
        if (now - lastDroneFireRef.current > 2000) { // Fires every 2 seconds
            let targetObj: GameObject | null = null;
            let minDist = 999;
            
            // Find closest hazard in front of player
            for (const obj of objectsRef.current) {
                 if (obj.active && (obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.ALIEN || obj.type === ObjectType.MISSILE)) {
                      if (obj.position[2] < playerPos.z && obj.position[2] > playerPos.z - 40) {
                           const d = Math.abs(obj.position[2] - playerPos.z);
                           if (d < minDist) {
                               minDist = d;
                               targetObj = obj;
                           }
                      }
                 }
            }

            if (targetObj) {
                targetObj.active = false;
                lastDroneFireRef.current = now;
                hasChanges = true;
                
                // Visual Effect for Drone Shot
                window.dispatchEvent(new CustomEvent('particle-burst', { 
                    detail: { position: targetObj.position, color: '#00ccff', burstScale: 0.5 } 
                }));
            }
        }
    }
    // -------------------------------

    // 1. Move & Update
    const currentObjects = objectsRef.current;
    const keptObjects: GameObject[] = [];
    const newSpawns: GameObject[] = [];
    
    // Jump Assist Scanner Logic
    let threatInCurrentLane = false;
    const lookAheadMin = -(effectiveSpeed * 0.7);
    const lookAheadMax = -(effectiveSpeed * 0.25);
    const playerX = playerLane * LANE_WIDTH;

    for (const obj of currentObjects) {
        // Standard Movement
        let moveAmount = dist;
        
        if (obj.type === ObjectType.MISSILE) {
            moveAmount += (MISSILE_SPEED * speedFactor) * safeDelta;
        }

        const prevZ = obj.position[2];
        obj.position[2] += moveAmount;
        
        // --- MAGNET LOGIC (Tiered) ---
        if (magnetLevel > 0 && obj.active && obj.type === ObjectType.GEM) {
            const zDist = Math.abs(obj.position[2] - playerPos.z);
            
            // Range scales from 10 to 35 based on level (1-5)
            // Lv1=10, Lv2=15, Lv3=20 (base), Lv4=25, Lv5=35
            const attractionRange = 5 + (magnetLevel * 5) + (magnetLevel === 5 ? 5 : 0);
            
            if (zDist < attractionRange) {
                 // Speed scales from 4 to 12 based on level
                 const attractionSpeed = 2 + (magnetLevel * 2); 
                 const lerpSpeed = safeDelta * attractionSpeed;
                 
                 obj.position[0] += (playerPos.x - obj.position[0]) * lerpSpeed;
                 obj.position[1] += (playerPos.y + 1.0 - obj.position[1]) * lerpSpeed; 
            }
        }
        // --------------------

        // --- JUMP ASSIST SCANNER ---
        if (gameMode === GameMode.ASSIST && obj.active) {
            const isHazard = obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.ALIEN || obj.type === ObjectType.MISSILE;
            if (isHazard) {
                const inLane = Math.abs(obj.position[0] - playerX) < (LANE_WIDTH * 0.4);
                if (inLane && obj.position[2] > lookAheadMin && obj.position[2] < lookAheadMax) {
                    threatInCurrentLane = true;
                }
            }
        }
        // ---------------------------

        // Alien AI Logic
        if (obj.type === ObjectType.ALIEN && obj.active && !obj.hasFired) {
             if (obj.position[2] > -90) {
                 obj.hasFired = true;
                 newSpawns.push({
                     id: uuidv4(),
                     type: ObjectType.MISSILE,
                     position: [obj.position[0], 1.0, obj.position[2] + 2], 
                     active: true,
                     color: '#ff0000'
                 });
                 hasChanges = true;
                 window.dispatchEvent(new CustomEvent('particle-burst', { 
                    detail: { position: obj.position, color: '#ff00ff' } 
                 }));
             }
        }

        let keep = true;
        if (obj.active) {
            const zThreshold = 2.0; 
            const inZZone = (prevZ < playerPos.z + zThreshold) && (obj.position[2] > playerPos.z - zThreshold);
            
            if (obj.type === ObjectType.SHOP_PORTAL) {
                const dz = Math.abs(obj.position[2] - playerPos.z);
                if (dz < 2) { 
                     openShop();
                     obj.active = false;
                     hasChanges = true;
                     keep = false; 
                }
            } else if (inZZone) {
                const dx = Math.abs(obj.position[0] - playerPos.x);
                if (dx < 0.9) { 
                     const isDamageSource = obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.ALIEN || obj.type === ObjectType.MISSILE;
                     
                     if (isDamageSource) {
                         const playerBottom = playerPos.y;
                         const playerTop = playerPos.y + 1.8; 

                         let objBottom = obj.position[1] - 0.5;
                         let objTop = obj.position[1] + 0.5;

                         if (obj.type === ObjectType.OBSTACLE) {
                             objBottom = 0;
                             objTop = OBSTACLE_HEIGHT;
                         } else if (obj.type === ObjectType.MISSILE) {
                             objBottom = 0.5;
                             objTop = 1.5;
                         }

                         const isHit = (playerBottom < objTop) && (playerTop > objBottom);

                         if (isHit) { 
                             window.dispatchEvent(new Event('player-hit'));
                             obj.active = false; 
                             hasChanges = true;
                             if (obj.type === ObjectType.MISSILE) {
                                window.dispatchEvent(new CustomEvent('particle-burst', { 
                                    detail: { position: obj.position, color: '#ff4400' } 
                                }));
                             }
                         }
                     } else {
                         const dy = Math.abs(obj.position[1] - playerPos.y);
                         // Relaxed Y check slightly for magnet collection
                         if (dy < 2.5) { 
                            if (obj.type === ObjectType.GEM) {
                                // Check if healing gem (Green)
                                const isHealing = obj.color === '#00ff00';
                                collectGem(obj.points || 10, isHealing);
                                audio.playGemCollect();
                            }
                            if (obj.type === ObjectType.LETTER && obj.targetIndex !== undefined) {
                                collectLetter(obj.targetIndex);
                                audio.playLetterCollect();
                            }
                            
                            window.dispatchEvent(new CustomEvent('particle-burst', { 
                                detail: { 
                                    position: obj.position, 
                                    color: obj.color || '#ffffff' 
                                } 
                            }));

                            obj.active = false;
                            hasChanges = true;
                         }
                     }
                }
            }
        }

        if (obj.position[2] > REMOVE_DISTANCE) {
            keep = false;
            hasChanges = true;
        }

        if (keep) {
            keptObjects.push(obj);
        }
    }
    
    // Update Global Jump Alert
    if (gameMode === GameMode.ASSIST) {
        setShowJumpAlert(threatInCurrentLane);
    } else {
        setShowJumpAlert(false);
    }

    // Add any newly spawned entities
    if (newSpawns.length > 0) {
        keptObjects.push(...newSpawns);
    }

    // 2. Spawning Logic
    let furthestZ = 0;
    const staticObjects = keptObjects.filter(o => o.type !== ObjectType.MISSILE);
    
    if (staticObjects.length > 0) {
        furthestZ = Math.min(...staticObjects.map(o => o.position[2]));
    } else {
        furthestZ = -20;
    }

    if (furthestZ > -SPAWN_DISTANCE) {
         const minGap = 12 + (speed * 0.4); 
         const spawnZ = Math.min(furthestZ - minGap, -SPAWN_DISTANCE);
         
         const isLetterDue = distanceTraveled.current >= nextLetterDistance.current;

         // Level Scaling for Spawn Rate
         // Increase empty space probability less as level increases
         // Base threshold 0.1 (90% chance to attempt spawn)
         // We can make it cleaner: Always spawn unless luck/random factor says no?
         // Let's scale obstacle density.
         
         // Chance to spawn *something* (vs empty space)
         // Level 1: 90% chance to check. Level 10: 95% chance.
         const baseSpawnCheck = 0.9;
         
         if (isLetterDue) {
             const lane = getRandomLane(laneCount);
             const target = ['G','E','M','I','N','I'];
             
             const availableIndices = target.map((_, i) => i).filter(i => !collectedLetters.includes(i));

             if (availableIndices.length > 0) {
                 const chosenIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                 const val = target[chosenIndex];
                 const color = GEMINI_COLORS[chosenIndex];

                 keptObjects.push({
                    id: uuidv4(),
                    type: ObjectType.LETTER,
                    position: [lane * LANE_WIDTH, 1.0, spawnZ], 
                    active: true,
                    color: color,
                    value: val,
                    targetIndex: chosenIndex
                 });
                 nextLetterDistance.current += getLetterInterval(level);
                 hasChanges = true;
             } else {
                keptObjects.push(createRandomGem(lane * LANE_WIDTH, spawnZ, uuidv4()));
                hasChanges = true;
             }

         } else if (Math.random() < baseSpawnCheck) { 
            // Scaling Obstacle Probability:
            // Base 20%, increases by 2% per level (capped at 60%)
            const baseObstacleProb = 0.20 + (level * 0.02);
            let obstacleProb = Math.min(0.6, baseObstacleProb);
            
            // Luck Charm reduces obstacle probability by 20% relative
            if (hasLuckCharm) obstacleProb *= 0.8;

            const isObstacle = Math.random() < obstacleProb;

            if (isObstacle) {
                // Alien Spawn Rate also scales with level
                // Level 2 start: 20%. Level 10: 40%.
                const alienBase = 0.2 + (level * 0.02);
                const spawnAlien = level >= 2 && Math.random() < Math.min(0.5, alienBase); 

                if (spawnAlien) {
                    const availableLanes = [];
                    const maxLane = Math.floor(laneCount / 2);
                    for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                    availableLanes.sort(() => Math.random() - 0.5);

                    let alienCount = 1;
                    const pAlien = Math.random();
                    if (pAlien > 0.7) alienCount = Math.min(2, availableLanes.length);
                    if (pAlien > 0.9 && availableLanes.length >= 3) alienCount = 3;

                    for (let k = 0; k < alienCount; k++) {
                        const lane = availableLanes[k];
                        keptObjects.push({
                            id: uuidv4(),
                            type: ObjectType.ALIEN,
                            position: [lane * LANE_WIDTH, 1.5, spawnZ],
                            active: true,
                            color: '#00ff00',
                            hasFired: false
                        });
                    }
                    
                    // Spawn Gems in the remaining empty lanes
                    for (let k = alienCount; k < availableLanes.length; k++) {
                         if (Math.random() < 0.4) {
                             const lane = availableLanes[k];
                             keptObjects.push(createRandomGem(lane * LANE_WIDTH, spawnZ, uuidv4()));
                         }
                    }

                } else {
                    const availableLanes = [];
                    const maxLane = Math.floor(laneCount / 2);
                    for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                    availableLanes.sort(() => Math.random() - 0.5);
                    
                    let countToSpawn = 1;
                    const p = Math.random();

                    if (p > 0.80) countToSpawn = Math.min(3, availableLanes.length);
                    else if (p > 0.50) countToSpawn = Math.min(2, availableLanes.length);
                    else countToSpawn = 1;

                    // Spawn obstacles in selected lanes
                    for (let i = 0; i < countToSpawn; i++) {
                        const lane = availableLanes[i];
                        const laneX = lane * LANE_WIDTH;
                        
                        keptObjects.push({
                            id: uuidv4(),
                            type: ObjectType.OBSTACLE,
                            position: [laneX, OBSTACLE_HEIGHT / 2, spawnZ],
                            active: true,
                            color: '#ff0054'
                        });

                        // HIGH RISK / HIGH REWARD GEM
                        // 40% chance to spawn a gem ABOVE the obstacle
                        if (Math.random() < 0.4) {
                             // Height 2.5 requires a jump/double jump
                             keptObjects.push(createRandomGem(laneX, spawnZ, uuidv4(), 2.5));
                        }
                    }

                    // Spawn Gems in EMPTY lanes (Safe Gems)
                    for (let i = countToSpawn; i < availableLanes.length; i++) {
                        if (Math.random() < 0.4) {
                             const lane = availableLanes[i];
                             const laneX = lane * LANE_WIDTH;
                             keptObjects.push(createRandomGem(laneX, spawnZ, uuidv4()));
                        }
                    }
                }

            } else {
                const lane = getRandomLane(laneCount);
                keptObjects.push(createRandomGem(lane * LANE_WIDTH, spawnZ, uuidv4()));
            }
            hasChanges = true;
         }
    }

    if (hasChanges) {
        objectsRef.current = keptObjects;
        setRenderTrigger(t => t + 1);
    }
  });

  return (
    <group>
      <ParticleSystem />
      {objectsRef.current.map(obj => {
        if (!obj.active) return null;
        return <GameEntity key={obj.id} data={obj} />;
      })}
    </group>
  );
};

const GameEntity: React.FC<{ data: GameObject }> = React.memo(({ data }) => {
    const groupRef = useRef<THREE.Group>(null);
    const visualRef = useRef<THREE.Group>(null);
    const shadowRef = useRef<THREE.Mesh>(null);
    const { laneCount, isTimeWarpActive } = useStore();
    
    useFrame((state, delta) => {
        const timeFactor = isTimeWarpActive ? 0.5 : 1.0;
        const adjustedDelta = delta * timeFactor;
        const elapsedTime = state.clock.elapsedTime * timeFactor; // Approximate for simple anims

        if (groupRef.current) {
            groupRef.current.position.set(data.position[0], 0, data.position[2]);
        }

        if (visualRef.current) {
            const baseHeight = data.position[1];
            
            if (data.type === ObjectType.SHOP_PORTAL) {
                 visualRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.02);
            } else if (data.type === ObjectType.MISSILE) {
                 visualRef.current.rotation.z += adjustedDelta * 20; 
                 visualRef.current.position.y = baseHeight;
            } else if (data.type === ObjectType.ALIEN) {
                 visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 3) * 0.2;
                 visualRef.current.rotation.y += adjustedDelta;
            } else if (data.type !== ObjectType.OBSTACLE) {
                visualRef.current.rotation.y += adjustedDelta * 3;
                const bobOffset = Math.sin(state.clock.elapsedTime * 4 + data.position[0]) * 0.1;
                visualRef.current.position.y = baseHeight + bobOffset;
                
                if (shadowRef.current) {
                    const shadowScale = 1 - bobOffset; 
                    shadowRef.current.scale.setScalar(shadowScale);
                }
            } else {
                visualRef.current.position.y = baseHeight;
            }
        }
    });

    const shadowGeo = useMemo(() => {
        if (data.type === ObjectType.LETTER) return SHADOW_LETTER_GEO;
        if (data.type === ObjectType.GEM) return SHADOW_GEM_GEO;
        if (data.type === ObjectType.SHOP_PORTAL) return null;
        if (data.type === ObjectType.ALIEN) return SHADOW_ALIEN_GEO;
        if (data.type === ObjectType.MISSILE) return SHADOW_MISSILE_GEO;
        return SHADOW_DEFAULT_GEO; 
    }, [data.type]);

    return (
        <group ref={groupRef} position={[data.position[0], 0, data.position[2]]}>
            {data.type !== ObjectType.SHOP_PORTAL && shadowGeo && (
                <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} geometry={shadowGeo}>
                    <meshBasicMaterial color="#000000" opacity={0.3} transparent />
                </mesh>
            )}

            <group ref={visualRef} position={[0, data.position[1], 0]}>
                {data.type === ObjectType.SHOP_PORTAL && (
                    <group>
                         <mesh position={[0, 3, 0]} geometry={SHOP_FRAME_GEO} scale={[laneCount * LANE_WIDTH + 2, 1, 1]}>
                             <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
                         </mesh>
                         <mesh position={[0, 2, 0]} geometry={SHOP_BACK_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}>
                              <meshBasicMaterial color="#000000" />
                         </mesh>
                         <mesh position={[0, 3, 0]} geometry={SHOP_OUTLINE_GEO} scale={[laneCount * LANE_WIDTH + 2.2, 1, 1]}>
                             <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.3} />
                         </mesh>
                         <Center position={[0, 5, 0.6]}>
                             <Text3D font={FONT_URL} size={1.2} height={0.2}>
                                 CYBER SHOP
                                 <meshBasicMaterial color="#ffff00" />
                             </Text3D>
                         </Center>
                         <mesh position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]} geometry={SHOP_FLOOR_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}>
                             <meshBasicMaterial color="#00ffff" transparent opacity={0.3} />
                         </mesh>
                    </group>
                )}

                {data.type === ObjectType.OBSTACLE && (
                    <group>
                        <mesh geometry={OBSTACLE_GEOMETRY} castShadow receiveShadow>
                             <meshStandardMaterial 
                                 color="#330011"
                                 roughness={0.3} 
                                 metalness={0.8} 
                                 flatShading={true}
                             />
                        </mesh>
                        <mesh scale={[1.02, 1.02, 1.02]} geometry={OBSTACLE_GLOW_GEO}>
                             <meshBasicMaterial 
                                 color={data.color} 
                                 wireframe 
                                 transparent 
                                 opacity={0.3} 
                             />
                        </mesh>
                         <mesh position={[0, -OBSTACLE_HEIGHT/2 + 0.05, 0]} rotation={[-Math.PI/2,0,0]} geometry={OBSTACLE_RING_GEO}>
                             <meshBasicMaterial color={data.color} transparent opacity={0.4} side={THREE.DoubleSide} />
                         </mesh>
                    </group>
                )}

                {data.type === ObjectType.ALIEN && (
                    <group>
                        <mesh castShadow geometry={ALIEN_BODY_GEO}>
                            <meshStandardMaterial color="#4400cc" metalness={0.8} roughness={0.2} />
                        </mesh>
                        <mesh position={[0, 0.2, 0]} geometry={ALIEN_DOME_GEO}>
                            <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} transparent opacity={0.8} />
                        </mesh>
                        <mesh position={[0.3, 0, 0.3]} geometry={ALIEN_EYE_GEO}>
                             <meshBasicMaterial color="#ff00ff" />
                        </mesh>
                        <mesh position={[-0.3, 0, 0.3]} geometry={ALIEN_EYE_GEO}>
                             <meshBasicMaterial color="#ff00ff" />
                        </mesh>
                    </group>
                )}

                {data.type === ObjectType.MISSILE && (
                    <group rotation={[Math.PI / 2, 0, 0]}>
                        <mesh geometry={MISSILE_CORE_GEO}>
                            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={4} />
                        </mesh>
                        <mesh position={[0, 1.0, 0]} geometry={MISSILE_RING_GEO}>
                            <meshBasicMaterial color="#ffff00" />
                        </mesh>
                        <mesh position={[0, 0, 0]} geometry={MISSILE_RING_GEO}>
                            <meshBasicMaterial color="#ffff00" />
                        </mesh>
                        <mesh position={[0, -1.0, 0]} geometry={MISSILE_RING_GEO}>
                            <meshBasicMaterial color="#ffff00" />
                        </mesh>
                    </group>
                )}

                {data.type === ObjectType.GEM && (
                    <mesh castShadow geometry={GEM_GEOMETRY}>
                        <meshStandardMaterial 
                            color={data.color} 
                            roughness={0} 
                            metalness={1} 
                            emissive={data.color} 
                            emissiveIntensity={2} 
                        />
                    </mesh>
                )}

                {data.type === ObjectType.LETTER && (
                    <group scale={[1.5, 1.5, 1.5]}>
                         <Center>
                             <Text3D 
                                font={FONT_URL} 
                                size={0.8} 
                                height={0.5} 
                                bevelEnabled
                                bevelThickness={0.02}
                                bevelSize={0.02}
                                bevelSegments={5}
                             >
                                {data.value}
                                <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1.5} />
                             </Text3D>
                         </Center>
                    </group>
                )}
            </group>
        </group>
    );
});