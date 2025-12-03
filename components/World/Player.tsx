






/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH, GameStatus, GameMode } from '../../types';
import { audio } from '../System/Audio';

// Physics Constants
const GRAVITY = 50;
const JUMP_FORCE = 16; // Results in ~2.56 height (v^2 / 2g)

// Static Geometries
const TORSO_GEO = new THREE.CylinderGeometry(0.25, 0.15, 0.6, 4);
const JETPACK_GEO = new THREE.BoxGeometry(0.3, 0.4, 0.15);
const GLOW_STRIP_GEO = new THREE.PlaneGeometry(0.05, 0.2);
const HEAD_GEO = new THREE.BoxGeometry(0.25, 0.3, 0.3);
const ARM_GEO = new THREE.BoxGeometry(0.12, 0.6, 0.12);
const JOINT_SPHERE_GEO = new THREE.SphereGeometry(0.07);
const HIPS_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.2);
const LEG_GEO = new THREE.BoxGeometry(0.15, 0.7, 0.15);
const SHADOW_GEO = new THREE.CircleGeometry(0.5, 32);

// Drone Geometry
const DRONE_BODY_GEO = new THREE.BoxGeometry(0.2, 0.2, 0.3);
const DRONE_WING_GEO = new THREE.BoxGeometry(0.5, 0.05, 0.1);

// --- Jump Assist Visualization (Easy Mode) ---
const JumpTrajectory: React.FC<{ speed: number }> = ({ speed }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const landingRef = useRef<THREE.Group>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame((state) => {
        if (!meshRef.current || !landingRef.current) return;

        const activeSpeed = speed > 1 ? speed : 10;
        const totalTime = (2 * JUMP_FORCE) / GRAVITY;
        const count = 16; 
        
        for (let i = 0; i < count; i++) {
            const t = (i / (count - 1)) * totalTime;
            const y = JUMP_FORCE * t - 0.5 * GRAVITY * t * t;
            const z = -activeSpeed * t;
            
            dummy.position.set(0, y, z);
            const baseScale = 0.12;
            const scale = baseScale * Math.sin((i / (count - 1)) * Math.PI) + 0.05;
            dummy.scale.setScalar(scale);
            
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        
        const landZ = -activeSpeed * totalTime;
        landingRef.current.position.set(0, 0.05, landZ);
        landingRef.current.rotation.y -= 0.05; 
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 15) * 0.2;
        landingRef.current.scale.setScalar(pulse);
    });

    if (speed < 1) return null;

    return (
        <group position={[0, 0, 0]}>
             <instancedMesh ref={meshRef} args={[undefined, undefined, 16]}>
                 <sphereGeometry args={[1, 8, 8]} />
                 <meshBasicMaterial color="#00ff00" transparent opacity={0.8} />
             </instancedMesh>
             
             <group ref={landingRef}>
                 <mesh rotation={[-Math.PI/2, 0, 0]}>
                     <ringGeometry args={[0.5, 0.6, 32]} />
                     <meshBasicMaterial color="#00ff00" side={THREE.DoubleSide} transparent opacity={0.8} />
                 </mesh>
                 <mesh rotation={[-Math.PI/2, 0, 0]}>
                     <ringGeometry args={[0.15, 0.25, 4]} />
                     <meshBasicMaterial color="#ccffcc" side={THREE.DoubleSide} />
                 </mesh>
                 <mesh rotation={[-Math.PI/2, 0, 0]} position={[0,-0.01,0]}>
                     <circleGeometry args={[0.9, 32]} />
                     <meshBasicMaterial color="#00ff00" transparent opacity={0.15} />
                 </mesh>
             </group>
        </group>
    );
};

export const Player: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null); 
  const bodyRef = useRef<THREE.Group>(null); 
  const shadowRef = useRef<THREE.Mesh>(null);
  
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  
  const droneRef = useRef<THREE.Group>(null);

  const { status, laneCount, takeDamage, hasDoubleJump, activateImmortality, activateTimeWarp, triggerSonicBlast, isImmortalityActive, isTimeWarpActive, shieldCount, speed, setPlayerLane, gameMode, isShopInvincible, hasDrone } = useStore();
  
  const [lane, setLane] = React.useState(0);
  const targetX = useRef(0);
  
  const isJumping = useRef(false);
  const velocityY = useRef(0);
  const jumpsPerformed = useRef(0); 
  const spinRotation = useRef(0); 

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const isInvincible = useRef(false);
  const lastDamageTime = useRef(0);

  // Initialize Materials once
  const { armorMaterial, jointMaterial, glowMaterial, shadowMaterial, shieldMaterial } = useMemo(() => {
      return {
          armorMaterial: new THREE.MeshStandardMaterial({ 
              color: '#00aaff', 
              roughness: 0.3, 
              metalness: 0.8, 
              transparent: true, 
              opacity: 1.0,
              emissive: '#000000',
              emissiveIntensity: 0
          }),
          jointMaterial: new THREE.MeshStandardMaterial({ 
              color: '#111111', 
              roughness: 0.7, 
              metalness: 0.5, 
              transparent: true, 
              opacity: 1.0 
          }),
          glowMaterial: new THREE.MeshBasicMaterial({ 
              color: '#00ffff', 
              transparent: true, 
              opacity: 1.0 
          }),
          shadowMaterial: new THREE.MeshBasicMaterial({ color: '#000000', opacity: 0.3, transparent: true }),
          shieldMaterial: new THREE.MeshBasicMaterial({ color: '#00ffff', transparent: true, opacity: 0.3, wireframe: true })
      };
  }, []);

  useEffect(() => {
    setPlayerLane(lane);
  }, [lane, setPlayerLane]);

  useEffect(() => {
      if (status === GameStatus.PLAYING) {
          isJumping.current = false;
          jumpsPerformed.current = 0;
          velocityY.current = 0;
          spinRotation.current = 0;
          if (groupRef.current) groupRef.current.position.y = 0;
          if (bodyRef.current) bodyRef.current.rotation.x = 0;
          if (pivotRef.current) {
              pivotRef.current.rotation.x = 0;
              pivotRef.current.rotation.z = 0;
          }
      }
  }, [status]);
  
  useEffect(() => {
      const maxLane = Math.floor(laneCount / 2);
      if (Math.abs(lane) > maxLane) {
          setLane(l => Math.max(Math.min(l, maxLane), -maxLane));
      }
  }, [laneCount, lane]);

  const triggerJump = () => {
    const maxJumps = hasDoubleJump ? 2 : 1;

    if (!isJumping.current) {
        audio.playJump(false);
        isJumping.current = true;
        jumpsPerformed.current = 1;
        velocityY.current = JUMP_FORCE;
    } else if (jumpsPerformed.current < maxJumps) {
        audio.playJump(true);
        jumpsPerformed.current += 1;
        velocityY.current = JUMP_FORCE; 
        spinRotation.current = 0; 
    }
  };

  const attemptSonicBlast = () => {
      const fired = triggerSonicBlast();
      if (fired) {
          window.dispatchEvent(new CustomEvent('trigger-sonic-blast'));
      }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== GameStatus.PLAYING) return;
      const maxLane = Math.floor(laneCount / 2);

      if (e.key === 'ArrowLeft') setLane(l => Math.max(l - 1, -maxLane));
      else if (e.key === 'ArrowRight') setLane(l => Math.min(l + 1, maxLane));
      else if (e.key === 'ArrowUp' || e.key === 'w') triggerJump();
      else if (e.key === ' ' || e.key === 'Enter') activateImmortality();
      else if (e.key === 'Shift' || e.key === 'ArrowDown') activateTimeWarp();
      else if (e.key === 'z' || e.key === 'Z') attemptSonicBlast();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, laneCount, hasDoubleJump, activateImmortality, activateTimeWarp, triggerSonicBlast]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
        if (status !== GameStatus.PLAYING) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        const maxLane = Math.floor(laneCount / 2);

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
             if (deltaX > 0) setLane(l => Math.min(l + 1, maxLane));
             else setLane(l => Math.max(l - 1, -maxLane));
        } else if (Math.abs(deltaY) > Math.abs(deltaX)) {
             if (deltaY < -30) triggerJump();
             else if (deltaY > 30) activateTimeWarp(); 
        } else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
            activateImmortality();
        }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [status, laneCount, hasDoubleJump, activateImmortality, activateTimeWarp]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (status !== GameStatus.PLAYING && status !== GameStatus.SHOP) return;

    const timeFactor = isTimeWarpActive ? 0.5 : 1.0;
    const adjustedDelta = delta * timeFactor;
    
    targetX.current = lane * LANE_WIDTH;
    groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x, 
        targetX.current, 
        delta * 15 
    );

    if (isJumping.current) {
        groupRef.current.position.y += velocityY.current * adjustedDelta;
        velocityY.current -= GRAVITY * adjustedDelta;

        if (groupRef.current.position.y <= 0) {
            groupRef.current.position.y = 0;
            isJumping.current = false;
            jumpsPerformed.current = 0;
            velocityY.current = 0;
            if (bodyRef.current) bodyRef.current.rotation.x = 0;
        }

        if (jumpsPerformed.current === 2 && bodyRef.current) {
             spinRotation.current -= adjustedDelta * 15;
             if (spinRotation.current < -Math.PI * 2) spinRotation.current = -Math.PI * 2;
             bodyRef.current.rotation.x = spinRotation.current;
        }
    }

    if (pivotRef.current) {
        const xDiff = targetX.current - groupRef.current.position.x;
        pivotRef.current.rotation.z = -xDiff * 0.2; 
        pivotRef.current.rotation.x = isJumping.current ? 0.1 : 0.05; 
    }

    const time = state.clock.elapsedTime * (25 * timeFactor); 
    
    if (!isJumping.current) {
        if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time) * 0.7;
        if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(time + Math.PI) * 0.7;
        if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(time + Math.PI) * 1.0;
        if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(time) * 1.0;
        
        if (bodyRef.current) bodyRef.current.position.y = 1.1 + Math.abs(Math.sin(time)) * 0.1;
    } else {
        const jumpPoseSpeed = adjustedDelta * 10;
        if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -2.5, jumpPoseSpeed);
        if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -2.5, jumpPoseSpeed);
        if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0.5, jumpPoseSpeed);
        if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -0.5, jumpPoseSpeed);
        
        if (bodyRef.current && jumpsPerformed.current !== 2) bodyRef.current.position.y = 1.1; 
    }
    
    // Drone Animation
    if (droneRef.current && hasDrone) {
        droneRef.current.position.x = 0.8 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
        droneRef.current.position.y = 1.8 + Math.cos(state.clock.elapsedTime * 1.5) * 0.1;
        droneRef.current.rotation.y += adjustedDelta;
    }

    if (shadowRef.current) {
        const height = groupRef.current.position.y;
        const scale = Math.max(0.2, 1 - (height / 2.5) * 0.5); 
        const runStretch = isJumping.current ? 1 : 1 + Math.abs(Math.sin(time)) * 0.3;

        shadowRef.current.scale.set(scale, scale, scale * runStretch);
        const material = shadowRef.current.material as THREE.MeshBasicMaterial;
        if (material && !Array.isArray(material)) {
            material.opacity = Math.max(0.1, 0.3 - (height / 2.5) * 0.2);
        }
    }

    // --- VISUAL PULSE LOGIC ---
    const isGoldMode = isImmortalityActive || isShopInvincible || gameMode === GameMode.CHEAT;
    
    // Check damage invincibility timeout
    if (isInvincible.current && gameMode !== GameMode.CHEAT && !isShopInvincible && !isImmortalityActive) {
         if (Date.now() - lastDamageTime.current > 1500) {
            isInvincible.current = false;
         }
    }

    if (isGoldMode) {
        // GOLDEN AURA MODE - UPDATED (Less blinding)
        const pulse = (Math.sin(state.clock.elapsedTime * 6) + 1) * 0.5; // Smooth 0-1, slightly slower (6)
        const intensity = 0.2 + pulse * 0.8; // Reduced range: 0.2 to 1.0 (was 0.5 to 2.5)
        
        armorMaterial.color.setHex(0xffd700); // Gold
        armorMaterial.emissive.setHex(0xff9900); // Slightly darker orange/gold base for emission
        armorMaterial.emissiveIntensity = intensity;
        armorMaterial.opacity = 1.0; 
        
        glowMaterial.color.setHex(0xffdd44); // Softer gold, not pure white
        glowMaterial.opacity = 0.8; 
        
        jointMaterial.color.setHex(0x554422); // Bronze-ish

    } else {
        // NORMAL MODE
        armorMaterial.color.setHex(0x00aaff); // Blue
        armorMaterial.emissive.setHex(0x000000);
        armorMaterial.emissiveIntensity = 0;
        
        glowMaterial.color.setHex(0x00ffff); // Cyan
        jointMaterial.color.setHex(0x111111);

        if (isInvincible.current) {
            // Damage Flicker
            const flicker = Math.sin(state.clock.elapsedTime * 30) > 0;
            const opacity = flicker ? 0.2 : 0.8;
            armorMaterial.opacity = opacity;
            jointMaterial.opacity = opacity;
            glowMaterial.opacity = opacity;
        } else {
            armorMaterial.opacity = 1.0;
            jointMaterial.opacity = 1.0;
            glowMaterial.opacity = 1.0;
        }
    }
  });

  useEffect(() => {
     const checkHit = (e: any) => {
        if (isInvincible.current || isImmortalityActive || isShopInvincible || gameMode === GameMode.CHEAT || shieldCount > 0) {
            takeDamage();
            return;
        }
        
        audio.playDamage();
        takeDamage();
        isInvincible.current = true;
        lastDamageTime.current = Date.now();
     };
     window.addEventListener('player-hit', checkHit);
     return () => window.removeEventListener('player-hit', checkHit);
  }, [takeDamage, isImmortalityActive, gameMode, shieldCount, isShopInvincible]);

  const effectiveSpeed = speed * (isTimeWarpActive ? 0.5 : 1.0);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {!isJumping.current && gameMode === GameMode.ASSIST && <JumpTrajectory speed={effectiveSpeed} />}

      <group ref={pivotRef}>
          {shieldCount > 0 && (
             <mesh position={[0, 1.1, 0]}>
                 <sphereGeometry args={[1.2, 16, 16]} />
                 <primitive object={shieldMaterial} />
             </mesh>
          )}

          <group ref={bodyRef} position={[0, 1.1, 0]}> 
            <mesh castShadow position={[0, 0.2, 0]} geometry={TORSO_GEO} material={armorMaterial} />

            <mesh position={[0, 0.2, -0.2]} geometry={JETPACK_GEO} material={jointMaterial} />
            <mesh position={[-0.08, 0.1, -0.28]} geometry={GLOW_STRIP_GEO} material={glowMaterial} />
            <mesh position={[0.08, 0.1, -0.28]} geometry={GLOW_STRIP_GEO} material={glowMaterial} />
            
            {hasDrone && (
                <group ref={droneRef} position={[0.8, 1.8, 0]}>
                    <mesh geometry={DRONE_BODY_GEO} material={armorMaterial} />
                    <mesh position={[0, 0.15, 0]} geometry={DRONE_WING_GEO} material={glowMaterial} />
                    <mesh position={[0, -0.15, 0]} geometry={DRONE_WING_GEO} material={glowMaterial} />
                </group>
            )}

            <group ref={headRef} position={[0, 0.6, 0]}>
                <mesh castShadow geometry={HEAD_GEO} material={armorMaterial} />
            </group>

            <group position={[0.32, 0.4, 0]}>
                <group ref={rightArmRef}>
                    <mesh position={[0, -0.25, 0]} castShadow geometry={ARM_GEO} material={armorMaterial} />
                    <mesh position={[0, -0.55, 0]} geometry={JOINT_SPHERE_GEO} material={glowMaterial} />
                </group>
            </group>
            <group position={[-0.32, 0.4, 0]}>
                <group ref={leftArmRef}>
                     <mesh position={[0, -0.25, 0]} castShadow geometry={ARM_GEO} material={armorMaterial} />
                     <mesh position={[0, -0.55, 0]} geometry={JOINT_SPHERE_GEO} material={glowMaterial} />
                </group>
            </group>

            <mesh position={[0, -0.15, 0]} geometry={HIPS_GEO} material={jointMaterial} />

            <group position={[0.12, -0.25, 0]}>
                <group ref={rightLegRef}>
                     <mesh position={[0, -0.35, 0]} castShadow geometry={LEG_GEO} material={armorMaterial} />
                </group>
            </group>
            <group position={[-0.12, -0.25, 0]}>
                <group ref={leftLegRef}>
                     <mesh position={[0, -0.35, 0]} castShadow geometry={LEG_GEO} material={armorMaterial} />
                </group>
            </group>
          </group>
      </group>
      
      <mesh ref={shadowRef} position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]} geometry={SHADOW_GEO} material={shadowMaterial} />
    </group>
  );
};