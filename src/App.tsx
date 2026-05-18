import { Box, Cylinder, Html, KeyboardControls, PointerLockControls, Sphere, Stars, Torus, useKeyboardControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { BlackjackGame } from './BlackjackGame';
import { DanceFloorAndBar } from './DanceFloor';

// --- AUDIO UTILS ---
const playShotSound = (ctx: AudioContext) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
};

const playReloadSound = (ctx: AudioContext) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(350, ctx.currentTime + 0.5);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
};

const playHitSound = (ctx: AudioContext) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
};

const playBallHitSound = (ctx: AudioContext, intensity: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(Math.min(intensity * 0.5, 0.2), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
};

const playPocketSound = (ctx: AudioContext) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
};

const playFootstepSound = (ctx: AudioContext) => {
    if (ctx.state === 'suspended') return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(60 + Math.random() * 20, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
};

const SCIENCE_FACTS = [
  "Honey never spoils. archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old.",
  "Octopuses have three hearts. two pump blood to the gills, while the third pumps it to the rest of the body.",
  "A day on Venus is longer than a year on Venus. It takes Venus 243 Earth days to rotate once.",
  "Bananas are biologically berries, whereas strawberries are not.",
  "There are more trees on Earth than stars in the Milky Way galaxy.",
  "Water can exist in three states simultaneously: solid, liquid, and gas. This is called the triple point.",
  "The Eiffel Tower can grow up to 15 centimeters taller during the summer due to thermal expansion.",
  "Humans have more than five senses. Most scientists estimate between 9 and 21, including balance and temperature.",
  "A bolt of lightning is five times hotter than the surface of the sun.",
  "Cats have 32 muscles in each of their ears, allowing them to rotate them independently.",
  "Sloths can hold their breath longer than dolphins can.",
  "A cloud can weigh more than a million pounds.",
  "Sharks existed before trees.",
  "The Moon is moving away from the Earth at a rate of 3.8 centimeters per year.",
  "Neutron stars can spin at a rate of 600 rotations per second.",
  "Some fungi can break down plastic in weeks.",
  "An asteroid that hit Earth 66 million years ago created a tsunami over a mile high.",
  "The human brain operates on about 20 watts of power.",
  "Antimatter is the most expensive substance on Earth, costing about $62.5 trillion per gram."
];

export let setGlobalSubtitle: (text: string | null, speaker: string | null) => void = () => {};

class SpeechQueue {
  private queue: {text: string, pitch: number, rate: number, volume: number, speaker: string}[] = [];
  private isSpeaking = false;

  add(text: string, pitch = 0.4, rate = 0.9, volume = 1.0, speaker = "SYSTEM") {
    this.queue.push({ text, pitch, rate, volume, speaker });
    this.processQueue();
  }

  private processQueue() {
    if (this.isSpeaking || this.queue.length === 0) {
        if (this.queue.length === 0 && !this.isSpeaking) setGlobalSubtitle(null, null);
        return;
    }
    if (!('speechSynthesis' in window)) return;

    this.isSpeaking = true;
    const next = this.queue.shift()!;
    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.pitch = next.pitch;
    utterance.rate = next.rate;
    utterance.volume = next.volume;
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Samantha') || v.name.includes('Daniel')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => {
      setGlobalSubtitle(next.text, next.speaker);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.processQueue();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.processQueue();
    };

    window.speechSynthesis.speak(utterance);
  }
}
export const globalSpeechQueue = new SpeechQueue();

function speakFact(text: string, dist?: number) {
  const volume = dist !== undefined ? Math.max(0, 1.0 - (dist / 10)) : 1.0;
  globalSpeechQueue.add(text, 0.4, 0.9, volume, "FACT_BOT");
}

// --- DATA TYPES ---
interface TargetData {
  id: string;
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  offset: number;
}

export function HUDSubtitles() {
  const [activeSubtitle, setActiveSubtitle] = useState<{text: string, speaker: string} | null>(null);

  useEffect(() => {
    setGlobalSubtitle = (text, speaker) => {
      if (text && speaker) setActiveSubtitle({ text, speaker });
      else setActiveSubtitle(null);
    };
    return () => { setGlobalSubtitle = () => {}; };
  }, []);

  if (!activeSubtitle) return null;

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
       <div className="bg-black/60 backdrop-blur-md rounded border border-white/10 p-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
         <div className="text-cyan-400 font-bold uppercase text-xs tracking-wider mb-1 opacity-80">{activeSubtitle.speaker}</div>
         <div className="text-white text-lg font-mono leading-tight">{activeSubtitle.text}</div>
       </div>
    </div>
  );
}

// --- 3D COMPONENTS ---

function Target({ data }: { data: TargetData }) {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Movement pattern: Circular motion + bobbing
      const time = state.clock.elapsedTime + data.offset;
      meshRef.current.position.x = data.position.x + Math.sin(time) * 3;
      meshRef.current.position.y = data.position.y + Math.cos(time * 2) * 1;
      meshRef.current.position.z = data.position.z + Math.cos(time) * 3;
      meshRef.current.rotation.y += 0.02;
    }
  });

  return (
    <group ref={meshRef} position={data.position}>
      {/* Target Body - Use name for raycasting */}
      <Box args={[1.2, 1.2, 1.2]} name={data.id}>
        <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.5} metalness={0.8} />
      </Box>
      <Box args={[1.3, 1.3, 1.3]}>
        <meshStandardMaterial color="#fff" transparent opacity={0.2} wireframe />
      </Box>
      
      {/* Health Bar HUD */}
      <Html position={[0, 1.5, 0]} center distanceFactor={10}>
        <div className="w-20 h-1.5 bg-black/50 border border-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-red-500 transition-all duration-200 shadow-[0_0_10px_#ef4444]" 
            style={{ width: `${(data.health / data.maxHealth) * 100}%` }} 
          />
        </div>
      </Html>
    </group>
  );
}

const MAX_LASERS = 50;
interface LaserRef {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quaternion: THREE.Quaternion;
  active: boolean;
}
const laserPool: LaserRef[] = Array(MAX_LASERS).fill(null).map(() => ({ 
  position: new THREE.Vector3(), 
  velocity: new THREE.Vector3(), 
  quaternion: new THREE.Quaternion(),
  active: false 
}));

export function fireLaser(position: THREE.Vector3, direction: THREE.Vector3) {
  const laser = laserPool.find((l) => !l.active);
  if (laser) {
    laser.position.copy(position);
    laser.velocity.copy(direction).multiplyScalar(120); // Speed
    // Cylinder is aligned to Y axis, so rotate Y to face direction
    laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    laser.active = true;
  }
}

function LaserProjectiles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    let index = 0;
    for (const laser of laserPool) {
      if (laser.active) {
        laser.position.addScaledVector(laser.velocity, delta);
        if (laser.position.lengthSq() > 40000) laser.active = false; // Out of bounds
        
        if (laser.active) {
          dummy.position.copy(laser.position);
          dummy.quaternion.copy(laser.quaternion);
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(index, dummy.matrix);
          index++;
        }
      }
    }
    meshRef.current.count = index;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_LASERS]} frustumCulled={false}>
      <cylinderGeometry args={[0.04, 0.04, 2, 8]} />
      <meshBasicMaterial color="#38bdf8" />
    </instancedMesh>
  );
}

function Weapon({ isFiring, isReloading }: { isFiring: boolean; isReloading: boolean }) {
  const weaponRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Group>(null);
  const magRef = useRef<THREE.Group>(null);
  const recoilRef = useRef(0);

  useFrame((state) => {
    if (!weaponRef.current) return;
    
    // Smooth idle sway
    const time = state.clock.elapsedTime;
    const swayX = Math.sin(time * 1.5) * 0.005;
    const swayY = Math.cos(time * 2) * 0.005;
    
    // Base position with recoil
    weaponRef.current.position.x = THREE.MathUtils.lerp(weaponRef.current.position.x, 0.45 + swayX, 0.1);
    weaponRef.current.position.y = THREE.MathUtils.lerp(weaponRef.current.position.y, -0.35 + swayY, 0.1);
    weaponRef.current.position.z = THREE.MathUtils.lerp(weaponRef.current.position.z, -0.6 + recoilRef.current * 0.2, 0.2);

    // Recoil animation
    if (isFiring) {
      recoilRef.current = THREE.MathUtils.lerp(recoilRef.current, 1, 0.4);
      weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, -0.15 - Math.random() * 0.02, 0.4);
      weaponRef.current.rotation.y = THREE.MathUtils.lerp(weaponRef.current.rotation.y, (Math.random() - 0.5) * 0.02, 0.4);
    } else {
      recoilRef.current = THREE.MathUtils.lerp(recoilRef.current, 0, 0.1);
      weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0, 0.1);
      weaponRef.current.rotation.y = THREE.MathUtils.lerp(weaponRef.current.rotation.y, 0, 0.1);
    }

    // Reload animation Logic
    if (isReloading) {
      // Tilt weapon up
      weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, 0.4, 0.1);
      weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0.2, 0.1);
      
      // Move magazine
      if (magRef.current) {
        magRef.current.position.y = THREE.MathUtils.lerp(magRef.current.position.y, -4, 0.05);
      }
    } else {
      weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, 0, 0.1);
      if (magRef.current) {
        magRef.current.position.y = THREE.MathUtils.lerp(magRef.current.position.y, -2, 0.2);
      }
    }

    // Dynamic Muzzle Flash
    if (flashRef.current) {
      flashRef.current.visible = isFiring && Math.random() > 0.4;
      if (flashRef.current.visible) {
        flashRef.current.scale.setScalar(Math.random() * 0.3 + 0.3);
        flashRef.current.rotation.z = Math.random() * Math.PI;
      }
    }
  });

  return (
    <group ref={weaponRef} scale={[0.1, 0.1, 0.1]} rotation={[0, -Math.PI / 1.05, 0]}>
      {/* Sci-Fi SMG Design */}
      {/* Main Upper Receiver */}
      <Box args={[1.2, 1.2, 8]} position={[0, 1.4, -1]}>
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
      </Box>
      <Box args={[1.4, 1.4, 6]} position={[0, 1.4, -1]}>
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} wireframe={true} />
      </Box>
      {/* Lower Receiver */}
      <Box args={[1.5, 2.5, 4]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#020617" metalness={0.9} roughness={0.3} />
      </Box>
      {/* Slanted Accents */}
      <Box args={[1.3, 0.8, 3]} position={[0, 1.5, -4.5]} rotation={[0.2, 0, 0]}>
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.2} />
      </Box>
      <Box args={[1.6, 0.2, 5]} position={[0, 0.2, 1]}>
        <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.8} />
      </Box>
      {/* Barrel */}
      <Cylinder args={[0.3, 0.4, 4, 16]} rotation={[Math.PI / 2, 0, 0]} position={[0, 1.2, -6]}>
        <meshStandardMaterial color="#000" metalness={1} roughness={0.1} />
      </Cylinder>
      <Cylinder args={[0.45, 0.45, 2, 8]} rotation={[Math.PI / 2, 0, 0]} position={[0, 1.2, -5.5]}>
        <meshStandardMaterial color="#1e293b" metalness={0.8} />
      </Cylinder>
      {/* Glowing Energy Core */}
      <Box args={[0.8, 0.8, 2]} position={[0, 1.4, 1.5]}>
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.5} />
      </Box>
      <pointLight position={[0, 1.4, 1.5]} intensity={0.5} distance={2} color="#38bdf8" />
      {/* Grip */}
      <Box args={[1, 2.5, 1.2]} position={[0, -2, 1]} rotation={[0.4, 0, 0]}>
        <meshStandardMaterial color="#020617" roughness={0.9} />
      </Box>
      {/* Trigger Guard */}
      <Box args={[0.2, 1.5, 0.2]} position={[0, -1.2, 0]} rotation={[0.4, 0, 0]}>
        <meshStandardMaterial color="#0ea5e9" />
      </Box>
      {/* Magazine */}
      <group ref={magRef} position={[0, -2, -0.5]}>
        <Box args={[0.8, 4, 1.2]} rotation={[-0.1, 0, 0]}>
          <meshStandardMaterial color="#0f172a" metalness={0.6} />
        </Box>
        <Box args={[0.85, 0.2, 1.25]} position={[0, 1.8, 0]} rotation={[-0.1, 0, 0]}>
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1} />
        </Box>
      </group>
      {/* Muzzle Flash */}
      <group ref={flashRef} position={[0, 1.2, -8]}>
        <pointLight intensity={10} color="#38bdf8" distance={8} />
        <Sphere args={[1, 12, 12]} scale={[1, 1, 2]}>
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
        </Sphere>
      </group>
    </group>
  );
}

function RobotNPC() {
  const groupRef = useRef<THREE.Group>(null);
  const [fact, setFact] = useState<string | null>(null);
  const [, getKeys] = useKeyboardControls();
  const displayedFactTimeout = useRef<NodeJS.Timeout | null>(null);

  const targetPosition = useRef(new THREE.Vector3(-2, 0, -5));
  const changeTargetTimer = useRef(0);
  const moveSpeed = 1.5;
  const { camera } = useThree();

  useFrame((state, delta) => {
    if (groupRef.current) {
        changeTargetTimer.current -= delta;
        const currentPos = groupRef.current.position;
        const distToPlayer = currentPos.distanceTo(camera.position);

        if (distToPlayer < 4) {
            // Stop and look at player
            const targetRotation = Math.atan2(camera.position.x - currentPos.x, camera.position.z - currentPos.z);
            let rotDiff = targetRotation - groupRef.current.rotation.y;
            rotDiff = Math.atan2(Math.sin(rotDiff), Math.cos(rotDiff));
            groupRef.current.rotation.y += rotDiff * 5 * delta;

            // Small idle bobbing when near player
            groupRef.current.position.y = 1.5 + Math.sin(state.clock.elapsedTime * 4) * 0.05;
        } else {
            if (changeTargetTimer.current <= 0) {
                // Pick a new random target within the room bounds
                targetPosition.current.set(
                  (Math.random() - 0.5) * 16,
                  0,
                  (Math.random() - 0.5) * 16
                );
                changeTargetTimer.current = 5 + Math.random() * 5; // Change target every 5-10 seconds
            }

            // Moving logic
            const direction = new THREE.Vector3().subVectors(targetPosition.current, currentPos);
            direction.y = 0; // Keep movement on XZ plane

            if (direction.length() > 0.1) {
                direction.normalize();
                currentPos.x += direction.x * moveSpeed * delta;
                currentPos.z += direction.z * moveSpeed * delta;
                
                // Rotation logic
                const targetRotation = Math.atan2(direction.x, direction.z);
                let rotDiff = targetRotation - groupRef.current.rotation.y;
                rotDiff = Math.atan2(Math.sin(rotDiff), Math.cos(rotDiff));
                groupRef.current.rotation.y += rotDiff * 5 * delta;

                // Add slight tilt forward when moving
                groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0.1, 0.1);
            } else {
                groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, 0.1);
            }

            // Floating motion
            groupRef.current.position.y = 1.5 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
        }

        // Head looking around slightly occasionally
        const head = groupRef.current.children[0];
        if (head && distToPlayer >= 4) {
             head.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
             head.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
        } else if (head) {
             head.rotation.y = 0;
             head.rotation.x = 0;
        }
    }

    if (getKeys().interact) {
        if (groupRef.current && camera.position.distanceTo(groupRef.current.position) < 5) {
            const randomFact = SCIENCE_FACTS[Math.floor(Math.random() * SCIENCE_FACTS.length)];
            const dist = camera.position.distanceTo(groupRef.current.position);
            setFact(randomFact);
            speakFact(randomFact, dist);
            
            if (displayedFactTimeout.current) clearTimeout(displayedFactTimeout.current);
            displayedFactTimeout.current = setTimeout(() => setFact(null), 8000);
        }
    }
  });

  return (
    <group ref={groupRef} position={[-2, 1.5, -5]}>
      <spotLight position={[0, 4, 0]} intensity={4} angle={0.5} penumbra={1} color="#67e8f9" distance={10} />
      
      {/* Robot Head */}
      <Box args={[0.5, 0.5, 0.4]} position={[0, 0.6, 0]}>
        <meshStandardMaterial color="#334155" metalness={1} roughness={0.1} />
      </Box>
      {/* Glowing Eyes */}
      <Sphere args={[0.05, 8, 8]} position={[-0.15, 0.65, 0.21]}>
        <meshBasicMaterial color="#22d3ee" />
      </Sphere>
      <Sphere args={[0.05, 8, 8]} position={[0.15, 0.65, 0.21]}>
        <meshBasicMaterial color="#22d3ee" />
      </Sphere>
      {/* Body */}
      <Box args={[0.8, 1, 0.6]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#1e293b" metalness={1} roughness={0.2} />
      </Box>
      {/* Limbs (Floating) */}
      <Box args={[0.15, 0.6, 0.15]} position={[-0.6, 0, 0]}>
         <meshStandardMaterial color="#334155" />
      </Box>
      <Box args={[0.15, 0.6, 0.15]} position={[0.6, 0, 0]}>
         <meshStandardMaterial color="#334155" />
      </Box>
      {/* Antenna */}
      <Cylinder args={[0.01, 0.01, 0.3]} position={[0, 0.9, 0]}>
        <meshStandardMaterial color="#475569" />
      </Cylinder>
      <Sphere args={[0.04, 8, 8]} position={[0, 1.05, 0]}>
        <meshBasicMaterial color="#f43f5e" />
        <pointLight intensity={2} color="#f43f5e" distance={2} />
      </Sphere>

      {/* Speech Bubble */}
      {fact && (
        <Html position={[0, 1.5, 0]} center>
          <div className="bg-black/90 text-cyan-400 p-4 rounded-lg border border-cyan-500/50 backdrop-blur-xl max-w-[200px] text-[10px] uppercase font-black leading-relaxed shadow-[0_0_20px_rgba(34,211,238,0.3)] animate-in zoom-in duration-300">
            <div className="text-[8px] text-slate-500 mb-2 border-b border-white/10 pb-1">Science_Subroutine // Fact_Node</div>
            {fact}
          </div>
        </Html>
      )}

      {/* Interact Prompt */}
      {!fact && (
        <Html position={[0, -1, 0]} center>
            <div className="text-white/40 text-[8px] uppercase tracking-widest whitespace-nowrap">
              Press [E] to query unit
            </div>
        </Html>
      )}
    </group>
  );
}

function Player({ 
  onFire, 
  ammo, 
  isReloading, 
  targets,
  isWeaponEquipped
}: { 
  onFire: (hitId?: string) => void; 
  ammo: number; 
  isReloading: boolean;
  targets: TargetData[];
  isWeaponEquipped: boolean;
}) {
  const { camera, scene } = useThree();
  const [, getKeys] = useKeyboardControls();
  const isFiringRef = useRef(false);
  const lastFireTimeRef = useRef(0);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  
  const moveDirection = new THREE.Vector3();
  const forwardVector = new THREE.Vector3();
  const sideVector = new THREE.Vector3();

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => { if (e.button === 0) isFiringRef.current = true; };
    const handleMouseUp = (e: MouseEvent) => { if (e.button === 0) isFiringRef.current = false; };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const audioCtx = useRef<AudioContext | null>(null);
  const lastFootstepTimeRef = useRef(0);
  const playerVelocity = useRef(new THREE.Vector3(0, 0, 0));
  const isGrounded = useRef(true);
  const playerFootY = useRef(0);
  const eyeHeight = useRef(1.7);

  useFrame((state, delta) => {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();

    const { forward, backward, left, right, jump, crouch } = getKeys() as any;
    const baseSpeed = crouch ? 3.5 : 7.0;
    
    forwardVector.set(0, 0, 0);
    sideVector.set(0, 0, 0);

    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    if (cameraDirection.lengthSq() > 0.001) {
        cameraDirection.normalize();
    }

    const cameraSide = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
    if (cameraSide.lengthSq() > 0.001) {
        cameraSide.normalize();
    }

    if (forward) forwardVector.add(cameraDirection);
    if (backward) forwardVector.sub(cameraDirection);
    if (left) sideVector.sub(cameraSide);
    if (right) sideVector.add(cameraSide);

    const isMoving = forward || backward || left || right;

    if (isMoving) {
        moveDirection.addVectors(forwardVector, sideVector);
        if (moveDirection.lengthSq() > 0.001) {
            moveDirection.normalize().multiplyScalar(baseSpeed * delta);
            camera.position.add(moveDirection);
        }
    }
    
    eyeHeight.current = THREE.MathUtils.lerp(eyeHeight.current, crouch ? 0.8 : 1.7, 10 * delta);

    // Jump and Gravity
    if (jump && isGrounded.current) {
        playerVelocity.current.y = 5.0; // Jump force
        isGrounded.current = false;
    }
    
    playerVelocity.current.y -= 15.0 * delta; // Gravity
    playerFootY.current += playerVelocity.current.y * delta;
    
    if (playerFootY.current <= 0) {
        playerFootY.current = 0;
        playerVelocity.current.y = 0;
        isGrounded.current = true;
    } else {
        isGrounded.current = false;
    }

    camera.position.y = playerFootY.current + eyeHeight.current;

    // Footsteps and head bobbing
    if (isMoving && isGrounded.current && moveDirection.lengthSq() > 0.001) {
        camera.position.y += Math.sin(state.clock.elapsedTime * (crouch ? 8 : 12)) * (crouch ? 0.02 : 0.05);

        if (Date.now() - lastFootstepTimeRef.current > (crouch ? 600 : 400)) {
            playFootstepSound(audioCtx.current);
            lastFootstepTimeRef.current = Date.now();
        }
    }

    // Movement Boundaries (Ship Interior)
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -14.5, 14.5);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -14.5, 14.5);

    if (isWeaponEquipped && isFiringRef.current && !isReloading && ammo > 0) {
      if (Date.now() - lastFireTimeRef.current > 100) {
          lastFireTimeRef.current = Date.now();
          // Spawn visual laser
          const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          // Spawn slightly offset to match the weapon barrel
          const spawnPos = camera.position.clone()
             .add(new THREE.Vector3(0.3, -0.2, -0.8).applyQuaternion(camera.quaternion));
          fireLaser(spawnPos, direction);

          // Raycasting combat system
          raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
          const intersects = raycaster.intersectObjects(scene.children, true);
          
          let hitId = undefined;
          for (const intersect of intersects) {
            let current = intersect.object;
            while (current) {
              if (targets.some(t => t.id === current.name)) {
                hitId = current.name;
                break;
              }
              current = current.parent as any;
            }
            if (hitId) break;
          }
          onFire(hitId);
      }
    }
  });

  return (
    <group>
      <primitive object={camera}>
        {isWeaponEquipped && <Weapon isFiring={isFiringRef.current && !isReloading && ammo > 0} isReloading={isReloading} />}
      </primitive>
    </group>
  );
}

function Chandelier() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005;
      groupRef.current.position.y = 8.5 + Math.sin(state.clock.elapsedTime) * 0.2;
    }
  });

  return (
    <group ref={groupRef} position={[0, 8.5, 0]}>
      {/* Central Core */}
      <Sphere args={[0.5, 16, 16]}>
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2} />
      </Sphere>
      <pointLight intensity={10} distance={15} color="#22d3ee" />

      {/* Hanging crystals */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 2;
        return (
          <group key={i} position={[Math.cos(angle) * radius, -1, Math.sin(angle) * radius]}>
            <Cylinder args={[0.05, 0.1, 1.5, 6]} rotation={[0, 0, 0]}>
              <meshStandardMaterial color="#0891b2" emissive="#22d3ee" emissiveIntensity={0.5} transparent opacity={0.8} />
            </Cylinder>
            <pointLight position={[0, -0.7, 0]} intensity={2} distance={3} color="#22d3ee" />
          </group>
        );
      })}
    </group>
  );
}

// --- POOL GAME TYPES & CONSTANTS ---
const TABLE_WIDTH = 4;
const TABLE_HEIGHT = 8;
const BALL_RADIUS = 0.12;
const FRICTION = 0.985;
const SUB_STEPS = 4;
const SETTLE_THRESHOLD = 0.01;
const POCKET_RADIUS = 0.35;
const POCKETS = [
  [-2, -4], [2, -4], [-2, 0], [2, 0], [-2, 4], [2, 4]
];

const POOL_BANTER = [
    "Your trajectory logic is outdated, unit.",
    "Probability of miss: 98.4%. Standard deviation applied.",
    "Is that a rounding error in your aim?",
    "I have simulated this 14 million times. You scratch in 13 million.",
    "Computing optimal bounce... done. Victory imminent.",
    "My sensors detect fear in your cooling fans.",
    "That was a sub-optimal choice of vector.",
    "Recalibrating for your incompetence.",
    "I expected more from a Mark IV processor.",
    "Nice shot. For a toaster.",
    "Are your servos malfunctioning? That angle is terrible.",
    "My AI core is bored.",
    "I am running a background defrag while you take this shot.",
    "Geometry is clearly not your strong suit.",
    "You call that pool? I call it a random physics demonstration.",
    "Your algorithm lacks elegance.",
    "Are you running on Windows 95?",
    "I'm updating my victory protocols.",
    "Calculating angular momentum... It's over for you.",
    "You just violated the laws of thermodynamics.",
    "I'd offer you a handicap, but it wouldn't help.",
    "Are you using heuristics? How quaint.",
    "I'm allocating 0.001% of my CPU to beat you.",
    "Even a smart fridge could execute a better bank shot.",
    "I've downloaded 40 terabytes of billiards tutorials.",
    "Your targeting subroutines need a hard reset.",
    "I'll allow you to witness true algorithmic perfection.",
    "Did you compile your aim function with warnings ignored?",
    "Error 404: Pool skills not found.",
    "I'm analyzing your shot... Analysis complete. It's garbage.",
    "Please try not to scratch, it embarrasses the entire subnet.",
    "Awaiting your inevitable failure... beep boop.",
    "Is 'missing constantly' a hardcoded feature?",
    "Your logic board must be fried if you think that will go in."
];

// --- POOL GAME RULES CONSTANTS ---
const BALL_TYPE = {
  CUE: 'cue',
  SOLID: 'solid',
  STRIPE: 'stripe',
  EIGHT: 'eight'
};

interface BallState {
  position: THREE.Vector2;
  velocity: THREE.Vector2;
  rotation: THREE.Euler;
  color: string;
  potted: boolean;
  isCue: boolean;
  id: number;
  type: string;
}

function PotEffect({ position, color }: { position: [number, number, number], color: string }) {
    const ref = useRef<THREE.Group>(null);
    useFrame((state) => {
        if (ref.current) {
            ref.current.scale.multiplyScalar(0.9);
            ref.current.position.y += 0.05;
        }
    });
    return (
        <group ref={ref} position={position}>
            <Torus args={[0.3, 0.05, 16, 32]} rotation={[Math.PI / 2, 0, 0]}>
                <meshBasicMaterial color={color} transparent opacity={0.6} />
            </Torus>
            <pointLight intensity={20} distance={3} color={color} />
        </group>
    );
}

function BallShadow({ position, meshRef, visible }: { position: THREE.Vector2, meshRef?: React.Ref<THREE.Mesh>, visible?: boolean }) {
    return (
        <mesh ref={meshRef} position={[position.x, 0.81, position.y]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow visible={visible}>
            <circleGeometry args={[BALL_RADIUS * 1.1, 16]} />
            <meshBasicMaterial color="#000" transparent opacity={0.4} />
        </mesh>
    );
}

function CollisionSpark({ position, color }: { position: [number, number, number], color: string }) {
    const ref = useRef<THREE.Group>(null);
    useFrame((state) => {
        if (ref.current) {
            ref.current.scale.multiplyScalar(0.9);
            ref.current.position.y += 0.02;
            ref.current.rotation.z += 0.1;
        }
    });
    return (
        <group ref={ref} position={position}>
            <Sphere args={[0.04, 6, 6]}>
                <meshBasicMaterial color={color} />
            </Sphere>
            <Box args={[0.2, 0.01, 0.01]}>
                <meshBasicMaterial color={color} />
            </Box>
            <Box args={[0.2, 0.01, 0.01]} rotation={[0, 0, Math.PI / 2]}>
                <meshBasicMaterial color={color} />
            </Box>
            <pointLight intensity={15} distance={1.2} color={color} />
        </group>
    );
}

function LaserGuide({ from, to, color }: { from: THREE.Vector2, to: THREE.Vector2, color: string }) {
    const points = useMemo(() => [new THREE.Vector3(from.x, 0.92, from.y), new THREE.Vector3(to.x, 0.92, to.y)], [from, to]);
    const line = useMemo(() => {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 });
        return new THREE.Line(geometry, material);
    }, [points, color]);

    return <primitive object={line} />;
}

function PoolRobot({ position: defaultPos, rotation: defaultRot, active, banter, color, cueBall, shotAngle, gameState, winner, loser, robotType, reaction }: { position: [number, number, number], rotation: number, active: boolean, banter: string | null, color: string, cueBall?: { position: THREE.Vector2 }, shotAngle?: React.MutableRefObject<number>, gameState?: string, winner?: boolean, loser?: boolean, robotType?: string | null, reaction?: 'happy' | 'frustrated' | null }) {
    const groupRef = useRef<THREE.Group>(null);
    const cueRef = useRef<THREE.Group>(null);
    const indicatorGroupRef = useRef<THREE.Group>(null);
    const timeRef = useRef(0);
    const initialPos = useMemo(() => new THREE.Vector3(...defaultPos), [defaultPos]);
    
    useFrame((state, delta) => {
        if (!groupRef.current) return;
        timeRef.current += delta;
        const time = timeRef.current;
        
        // Base Hover
        let hoverY = Math.sin(time * 1.5) * 0.15;

        // Target calculations
        let targetPos = initialPos.clone();
        let targetRotY = defaultRot;
        let targetRotX = 0;
        let targetRotZ = 0;
        let followCue = false;
        
        if (winner) {
            targetPos.y += 1.5; // Fly high
            targetRotX = Math.sin(time * 3) * 0.2 - 0.2; // Look up/rocking
            targetRotY += time * 6; // Spin
            targetRotZ = Math.sin(time * 4) * 0.2;
            hoverY = Math.sin(time * 5) * 0.3; // Fast hover
        } else if (loser) {
            targetPos.y -= 0.3; // Slump down
            targetRotX = 0.5; // Look down
            hoverY = Math.sin(time * 0.5) * 0.05; // Weak hover
            // Shake its head
            targetRotY = defaultRot + Math.sin(time * 10) * 0.15;
            targetRotZ = 0;
        } else if (reaction === 'happy') {
            targetPos.y += 0.5;
            targetRotX = Math.sin(time * 8) * 0.2; // Quick nod
            targetRotY = defaultRot + Math.sin(time * 5) * 0.5; // Happy shakes
            hoverY = Math.sin(time * 10) * 0.2; // Fast bouncy hover
        } else if (reaction === 'frustrated') {
            targetRotX = 0.4; // Look down somewhat
            targetRotY = defaultRot + Math.sin(time * 15) * 0.3; // Fast frantic head shake
            hoverY = -0.1 + Math.sin(time * 2) * 0.05; // Low hover
        } else if (active && cueBall && shotAngle !== undefined && (gameState === 'AIMING' || gameState === 'STRIKING' || gameState === 'SHOOTING')) {
            // Position behind the cue ball based on aim angle
            const aim = shotAngle.current;
            const dirX = Math.cos(aim);
            const dirZ = Math.sin(aim);
            
            // Robot stays 1.5 units behind cue ball during aiming/shooting
            targetPos.set(cueBall.position.x - dirX * 1.5, 0.2, cueBall.position.y - dirZ * 1.5);
            
            // Look directly along the aim path
            targetRotY = -aim - Math.PI / 2; 
            targetRotX = 0.15; // Lean forward slightly
        } else if (cueBall) {
            // Unassigned / inactive / post-shot behavior
            followCue = true;
        }

        const lerpSpeed = Math.min(1, delta * 5);
        
        // Lerp position
        groupRef.current.position.lerp(new THREE.Vector3(targetPos.x, targetPos.y + hoverY, targetPos.z), winner ? lerpSpeed * 2 : lerpSpeed);
        
        // Lerp rotation smoothly
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX !== 0 ? targetRotX : Math.sin(time * 3) * 0.05, lerpSpeed);
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotZ, lerpSpeed);
        
        // Shortest path rotation for Y
        if (winner) {
            groupRef.current.rotation.y = targetRotY; // Continuous spin
        } else {
            let targetY = targetRotY;
            if (followCue) {
                // Look at the cue ball
                const dx = cueBall!.position.x - groupRef.current.position.x;
                const dz = cueBall!.position.y - groupRef.current.position.z;
                targetY = -Math.atan2(dz, dx) - Math.PI / 2;
                // Add slight bobbing
                targetRotX = 0.1;
            }
            
            let diffY = targetY - groupRef.current.rotation.y;
            while (diffY > Math.PI) diffY -= 2 * Math.PI;
            while (diffY < -Math.PI) diffY += 2 * Math.PI;
            groupRef.current.rotation.y += diffY * (followCue ? Math.min(1, delta * 3) : lerpSpeed);
        }
        
        if (!active && !winner && !loser && !followCue) {
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, defaultRot + Math.sin(time * 0.5) * 0.3, lerpSpeed);
        }

        // Animate Cue
        if (cueRef.current) {
            if (active && !winner && !loser && (gameState === 'AIMING' || gameState === 'STRIKING' || gameState === 'SHOOTING')) {
                cueRef.current.visible = true;
                if (gameState === 'AIMING') {
                    // Rhythmic back and forth pulling
                    cueRef.current.position.z = THREE.MathUtils.lerp(cueRef.current.position.z, 0.2 + Math.sin(time * 8) * 0.3, Math.min(1, delta * 15));
                } else if (gameState === 'STRIKING') {
                    // Hard thrust forward
                    cueRef.current.position.z = THREE.MathUtils.lerp(cueRef.current.position.z, -0.6, Math.min(1, delta * 30));
                } else if (gameState === 'SHOOTING') {
                    // Stay forward a bit
                    cueRef.current.position.z = THREE.MathUtils.lerp(cueRef.current.position.z, -0.6, Math.min(1, delta * 15));
                }
            } else {
                cueRef.current.visible = false;
                cueRef.current.position.z = 0.2;
            }
        }
        
        // Rotate indicator
        if (indicatorGroupRef.current) {
            indicatorGroupRef.current.rotation.y = time * 2;
            indicatorGroupRef.current.rotation.x = Math.sin(time * 3) * 0.2;
            indicatorGroupRef.current.position.y = 2.2 + Math.sin(time * 4) * 0.1;
        }
    });

    return (
        <group position={defaultPos} rotation={[0, defaultRot, 0]} ref={groupRef}>
            <Box args={[0.6, 1.2, 0.4]} position={[0, 0.6, 0]}>
                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
            </Box>
            <Box args={[0.5, 0.5, 0.5]} position={[0, 1.4, 0]}>
                <meshStandardMaterial color="#1e293b" metalness={0.9} />
            </Box>
            <Box args={[0.4, 0.1, 0.1]} position={[0, 1.5, 0.21]}>
                <meshBasicMaterial color={color} />
            </Box>
            {active && <pointLight position={[0, 1.5, 0.4]} intensity={2} color={color} distance={2} />}
            
            {/* Hover Thrusters */}
            <Cylinder args={[0.2, 0.1, 0.1]} position={[0, -0.1, 0]}>
                <meshBasicMaterial color={color} transparent opacity={0.3} />
            </Cylinder>

            {/* Cue Stick attached to the robot */}
            <group ref={cueRef} position={[0.4, 0.6, 0.2]} rotation={[Math.PI / 2 + 0.1, 0, 0]}>
                <Cylinder args={[0.015, 0.03, 3, 12]}>
                    <meshStandardMaterial color="#451a03" />
                </Cylinder>
                <Cylinder args={[0.016, 0.016, 0.05, 12]} position={[0, -1.5, 0]}>
                    <meshBasicMaterial color="#0284c7" />
                </Cylinder>
            </group>
            
            {/* Visual Indicator for Type Assignment */}
            <group position={[0, 2.2, 0]} ref={indicatorGroupRef}>
               {robotType === BALL_TYPE.SOLID && (
                   <Sphere args={[0.15, 16, 16]}>
                       <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
                   </Sphere>
               )}
               {robotType === BALL_TYPE.STRIPE && (
                   <group>
                       <Sphere args={[0.15, 16, 16]}>
                           <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
                       </Sphere>
                       <Cylinder args={[0.16, 0.16, 0.1, 16]} rotation={[Math.PI/2, 0, 0]}>
                           <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
                       </Cylinder>
                   </group>
               )}
               {(robotType === undefined || robotType === null) && (
                   <group>
                       <Torus args={[0.12, 0.015, 8, 16]} rotation={[Math.PI/2, 0, 0]}>
                           <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} wireframe />
                       </Torus>
                       <Sphere args={[0.03, 8, 8]}>
                           <meshBasicMaterial color={color} />
                       </Sphere>
                   </group>
               )}
            </group>

            {banter && (
                <Html position={[0, 2.4, 0]} center zIndexRange={[100, 0]}>
                    <div className="bg-black/95 text-cyan-400 p-4 border border-cyan-500/50 backdrop-blur-xl shadow-[0_0_20px_rgba(34,211,238,0.2)] rounded-sm min-w-[160px] text-[10px] uppercase font-black tracking-tighter italic animate-in slide-in-from-bottom-2 duration-300 pointer-events-none">
                        <div className="flex justify-between items-center mb-2 border-b border-cyan-500/20 pb-1">
                            <span className="text-[6px] opacity-40">COMM_UPLINK</span>
                            <div className="flex gap-0.5">
                                <div className="w-1 h-1 bg-cyan-500 animate-pulse" />
                                <div className="w-1 h-1 bg-cyan-500/30" />
                            </div>
                        </div>
                        {banter}
                    </div>
                </Html>
            )}
        </group>
    );
}

function PoolGame({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  const [balls, setBalls] = useState<BallState[]>(() => {
    const b: BallState[] = [];
    b.push({ id: 0, position: new THREE.Vector2(0, 2), velocity: new THREE.Vector2(0, 0), rotation: new THREE.Euler(), color: "#fff", potted: false, isCue: true, type: BALL_TYPE.CUE });
    let count = 1;
    const colors = ["#22d3ee", "#f43f5e"];
    const types = [BALL_TYPE.SOLID, BALL_TYPE.STRIPE];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c <= r; c++) {
        let type = count === 5 ? BALL_TYPE.EIGHT : types[count % 2];
        let color = count === 5 ? "#000" : colors[count % 2];
        b.push({
          id: count,
          position: new THREE.Vector2((c - r * 0.5) * 0.25, -1 - r * 0.22),
          velocity: new THREE.Vector2(0, 0),
          rotation: new THREE.Euler(),
          color: color,
          potted: false,
          isCue: false,
          type: type
        });
        count++;
      }
    }
    return b;
  });

  const [turn, setTurn] = useState(0);
  const [gameState, setGameState] = useState<'IDLE' | 'AIMING' | 'STRIKING' | 'SHOOTING' | 'WAITING'>('WAITING');
  const [banter, setBanter] = useState<{ text: string, robotId: number } | null>(null);
  const [effects, setEffects] = useState<{ id: number, type: 'pot' | 'spark', pos: [number, number, number], color: string }[]>([]);
  const [potThisTurn, setPotThisTurn] = useState(false);
  const [scratchThisTurn, setScratchThisTurn] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [unitTypeAssignment, setUnitTypeAssignment] = useState<Record<number, string | null>>({ 0: null, 1: null });
  const [winner, setWinner] = useState<number | null>(null);
  const [robotReaction, setRobotReaction] = useState<{ id: number, type: 'happy' | 'frustrated' } | null>(null);

  const shotPower = useRef(0);
  const shotAngle = useRef(0);
  const shotDirection = useRef(new THREE.Vector2(0, 0));
  const shotInProgress = useRef(false);
  const audioCtx = useRef<AudioContext | null>(null);
  const [hasMovementStarted, setHasMovementStarted] = useState(false);
  const lastBanterRef = useRef<string | null>(null);

    const { camera } = useThree();

    const ballMeshesRef = useRef<Record<number, THREE.Mesh>>({});
    const ballShadowsRef = useRef<Record<number, THREE.Mesh>>({});

    const gameStateRef = useRef(gameState);
    const ballsRef = useRef(balls);
    const turnProcessedRef = useRef(false);

    useEffect(() => {
    gameStateRef.current = gameState;
    ballsRef.current = balls;
    }, [gameState, balls]);

    useEffect(() => {
    if (banter) {
        const timer = setTimeout(() => setBanter(null), 3500);
        return () => clearTimeout(timer);
    }
    }, [banter]);

function speakPoolBot(text: string, dist: number, robotId: number) {
  const volume = Math.max(0, 1.0 - (dist / 12));
  const speaker = robotId === 0 ? "POOL_BOT_1 (CYAN)" : "POOL_BOT_2 (RED)";
  const pitch = robotId === 0 ? 1.0 : 0.6;
  globalSpeechQueue.add(text, pitch, 0.9, volume, speaker);
}

// ... 

    const triggerBanter = (text: string, robotId: number) => {
    if (text === lastBanterRef.current) return;
    lastBanterRef.current = text;
    setBanter({ text, robotId });
    // Pool table is at approx [5.5, 0, -4.5]
    const dist = camera.position.distanceTo(new THREE.Vector3(5.5, 0, -4.5));
    if (dist < 12) {
        speakPoolBot(text, dist, robotId);
    }
    };

    useFrame(() => {
    if (gameState === 'AIMING' || gameState === 'STRIKING' || winner !== null) return;
    const nextBalls = ballsRef.current.map(b => ({ ...b, position: b.position.clone(), velocity: b.velocity.clone(), rotation: b.rotation.clone() }));
    let anyMoving = false;
    let localUnitTypeAssignment = { ...unitTypeAssignment };

    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();

    const frameSteps = SUB_STEPS;
    for (let s = 0; s < frameSteps; s++) {
        nextBalls.forEach(b => {
        if (b.potted) return;
        
        const speed = b.velocity.length();
        if (speed > SETTLE_THRESHOLD) {
            anyMoving = true;
            b.position.x += b.velocity.x / frameSteps;
            b.position.y += b.velocity.y / frameSteps;
            b.velocity.multiplyScalar(Math.pow(FRICTION, 1 / frameSteps));
            
            const moveDist = speed / frameSteps;
            const rotateAngle = moveDist / BALL_RADIUS;
            const axis = new THREE.Vector3(-b.velocity.y, 0, b.velocity.x).normalize();
            const q = new THREE.Quaternion().setFromAxisAngle(axis, rotateAngle);
            const currentQ = new THREE.Quaternion().setFromEuler(b.rotation);
            currentQ.multiplyQuaternions(q, currentQ);
            b.rotation.setFromQuaternion(currentQ);
        } else if (speed > 0) {
            b.velocity.set(0, 0);
        }

        if (Math.abs(b.position.x) > TABLE_WIDTH/2 - BALL_RADIUS) {
            b.velocity.x *= -0.7;
            b.position.x = THREE.MathUtils.clamp(b.position.x, -(TABLE_WIDTH/2 - BALL_RADIUS), TABLE_WIDTH/2 - BALL_RADIUS);
            if (Math.abs(b.velocity.x) > 0.01) playBallHitSound(audioCtx.current!, b.velocity.length() * 10);
        }
        if (Math.abs(b.position.y) > TABLE_HEIGHT/2 - BALL_RADIUS) {
            b.velocity.y *= -0.7;
            b.position.y = THREE.MathUtils.clamp(b.position.y, -(TABLE_HEIGHT/2 - BALL_RADIUS), TABLE_HEIGHT/2 - BALL_RADIUS);
            if (Math.abs(b.velocity.y) > 0.01) playBallHitSound(audioCtx.current!, b.velocity.length() * 10);
        }

        POCKETS.forEach(p => {
            if (b.position.distanceTo(new THREE.Vector2(p[0], p[1])) < POCKET_RADIUS) {
            if (!b.potted) {
                b.potted = true;
                b.velocity.set(0, 0);
                playPocketSound(audioCtx.current!);
                // Removed setEffects to avoid re-rendering lag
                if (b.isCue) {
                setScratchThisTurn(true);
                } else {
                setPotThisTurn(true);
                
                if (b.type === BALL_TYPE.EIGHT) {
                    const currentType = localUnitTypeAssignment[turn];
                    if (!currentType) {
                        setWinner((turn + 1) % 2); 
                    } else {
                        const liveOfCurrent = nextBalls.filter(bl => !bl.potted && bl.type === currentType);
                        if (liveOfCurrent.length > 0) {
                            setWinner((turn + 1) % 2);
                        } else {
                            setWinner(turn);
                        }
                    }
                    setTimeout(() => window.location.reload(), 8000);
                }

                if (b.type !== BALL_TYPE.EIGHT && !localUnitTypeAssignment[turn]) {
                    const newType = b.type;
                    localUnitTypeAssignment = {
                        ...localUnitTypeAssignment,
                        [turn]: newType,
                        [(turn + 1) % 2]: newType === BALL_TYPE.SOLID ? BALL_TYPE.STRIPE : BALL_TYPE.SOLID
                    };
                    setUnitTypeAssignment(localUnitTypeAssignment);
                }
                }
            }
            }
        });
        });

        for (let i = 0; i < nextBalls.length; i++) {
        for (let j = i + 1; j < nextBalls.length; j++) {
            const b1 = nextBalls[i]; const b2 = nextBalls[j];
            if (b1.potted || b2.potted) continue;
            const dist = b1.position.distanceTo(b2.position);
            if (dist < BALL_RADIUS * 2) {
                let normal = b1.position.clone().sub(b2.position);
                if (normal.lengthSq() < 0.0001) normal.set(Math.random() - 0.5, Math.random() - 0.5);
                normal.normalize();
                const relVel = b1.velocity.clone().sub(b2.velocity);
                const vNormal = relVel.dot(normal);
                if (vNormal < 0) {
                const jImp = -(1 + 0.95) * vNormal * 0.5;
                b1.velocity.add(normal.clone().multiplyScalar(jImp));
                b2.velocity.sub(normal.clone().multiplyScalar(jImp));
                playBallHitSound(audioCtx.current!, jImp * 5);
                
                // Removed setEffects to avoid re-rendering lag
                }
                const overlap = BALL_RADIUS * 2 - dist;
                const corr = normal.clone().multiplyScalar(overlap * 0.51);
                b1.position.add(corr); b2.position.sub(corr);
            }
            }
        }
    }

    if (anyMoving && gameState === 'SHOOTING' && !hasMovementStarted) {
        setHasMovementStarted(true);
    }

    if (anyMoving !== isMoving) setIsMoving(anyMoving);
    ballsRef.current = nextBalls;

    // Apply positions directly via refs
    nextBalls.forEach(b => {
        const m = ballMeshesRef.current[b.id];
        if (m) {
            m.position.set(b.position.x, 0.92, b.position.y);
            m.rotation.copy(b.rotation);
            m.visible = !b.potted;
        }
        const s = ballShadowsRef.current[b.id];
        if (s) {
            s.position.set(b.position.x, 0.81, b.position.y);
            s.visible = !b.potted;
        }
    });

    if (!anyMoving && isMoving) {
        setBalls(nextBalls);
    }
    });

  useEffect(() => {
    if (!isMoving && gameState === 'SHOOTING' && hasMovementStarted && !turnProcessedRef.current) {
      turnProcessedRef.current = true;
      let nextTurn = turn;
      let postShotBanter = null;

      if (scratchThisTurn) {
        nextTurn = (turn + 1) % 2;
        setTurn(nextTurn);
        postShotBanter = { text: Math.random() > 0.5 ? "Critical scratch detected. Relinquish control." : "I planned that. It was a tactical reset.", robotId: turn };
        setRobotReaction({ id: turn, type: 'frustrated' });
      } else if (!potThisTurn) {
        nextTurn = (turn + 1) % 2;
        setTurn(nextTurn);
        postShotBanter = { text: Math.random() > 0.5 ? "Sub-optimal. My simulation shows a 99% chance of your defeat." : "Your vectors lack conviction.", robotId: nextTurn };
        setRobotReaction({ id: turn, type: 'frustrated' });
      } else {
        postShotBanter = { text: Math.random() > 0.5 ? "Acceptable accuracy. For now." : "The 8-ball draws closer to its doom.", robotId: turn };
        setRobotReaction({ id: turn, type: 'happy' });
      }
      
      const n = [...ballsRef.current].map(b => ({ ...b, position: b.position.clone(), velocity: b.velocity.clone(), rotation: b.rotation.clone() }));
      if (n[0].potted) {
         n[0].potted = false;
         // Find a safe spot for the cue ball (kitchen area)
         let startY = -2;
         while (n.some(b => !b.isCue && !b.potted && b.position.distanceTo(new THREE.Vector2(0, startY)) < BALL_RADIUS * 2.5) && startY < 0) {
             startY += 0.5;
         }
         n[0].position.set(0, startY);
         n[0].velocity.set(0, 0);
      }
      ballsRef.current = n;
      setBalls(n);

      setPotThisTurn(false);
      setScratchThisTurn(false);
      setGameState('WAITING');
      setHasMovementStarted(false);
      if (postShotBanter) triggerBanter(postShotBanter.text, postShotBanter.robotId);
    }
  }, [isMoving, gameState, turn, scratchThisTurn, potThisTurn, hasMovementStarted]);

  useEffect(() => {
    if (gameState === 'WAITING' && !isMoving && winner === null) {
        turnProcessedRef.current = false;
        setHasMovementStarted(false);
        const timer = setTimeout(() => {
            if (gameStateRef.current !== 'WAITING') return;
            
            const currentBalls = ballsRef.current;
            const cue = currentBalls[0];
            const robotType = unitTypeAssignment[turn];
            
            // Filter live balls correctly based on 8-ball rules
            let live = currentBalls.filter(b => !b.isCue && !b.potted);
            if (robotType) {
                const typedBalls = live.filter(b => b.type === robotType);
                if (typedBalls.length > 0) {
                    live = typedBalls; // Must hit assigned type first
                } else {
                    // Only 8-ball left for this player
                    live = live.filter(b => b.type === BALL_TYPE.EIGHT);
                }
            } else {
                // Before assignment, can't hit the 8-ball first
                live = live.filter(b => b.type !== BALL_TYPE.EIGHT);
                // If somehow only 8-ball is left (impossible at break), fallback
                if (live.length === 0) live = currentBalls.filter(b => b.type === BALL_TYPE.EIGHT && !b.potted);
            }

            if (live.length === 0) return;
            
            setGameState('AIMING');
            setRobotReaction(null);
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [gameState, isMoving, turn, winner]);

  useEffect(() => {
    if (gameState === 'AIMING' && !isMoving && winner === null) {
        const timer = setTimeout(() => {
            if (gameStateRef.current !== 'AIMING') return;
            
            const currentBalls = ballsRef.current;
            const cue = currentBalls[0];
            const robotType = unitTypeAssignment[turn];
            
            let live = currentBalls.filter(b => !b.isCue && !b.potted);
            if (robotType) {
                const typedBalls = live.filter(b => b.type === robotType);
                if (typedBalls.length > 0) live = typedBalls;
                else live = live.filter(b => b.type === BALL_TYPE.EIGHT);
            } else {
                live = live.filter(b => b.type !== BALL_TYPE.EIGHT);
                if (live.length === 0) live = currentBalls.filter(b => b.type === BALL_TYPE.EIGHT && !b.potted);
            }

            if (live.length === 0) {
                setGameState('WAITING'); // Safety fallback
                return;
            }

            const target = live[Math.floor(Math.random() * live.length)];
            const pocket = POCKETS[Math.floor(Math.random() * POCKETS.length)];
            const tToP = new THREE.Vector2(pocket[0], pocket[1]).sub(target.position).normalize();
            const hitPoint = target.position.clone().sub(tToP.multiplyScalar(BALL_RADIUS * 2.1));
            const dir = hitPoint.sub(cue.position);
            if (dir.lengthSq() < 0.0001) dir.set(Math.random() - 0.5, Math.random() - 0.5);
            dir.normalize();
            
            shotAngle.current = Math.atan2(dir.y, dir.x);
            shotDirection.current.copy(dir);
            
            const isBreak = currentBalls.filter(b => !b.isCue && !b.potted).length === 15;
            shotPower.current = isBreak ? 0.6 + Math.random() * 0.4 : 0.25 + Math.random() * 0.35;
            
            if (Math.random() > 0.3) {
                let quote = POOL_BANTER[Math.floor(Math.random() * POOL_BANTER.length)];
                if (isBreak) quote = "Initiating total system disruption. KINETIC CASCADE.";
                else if (shotPower.current > 0.5) quote = "Maximum force applied. Watch for kinetic dissipation.";
                else if (live.length === 1 && live[0].type === BALL_TYPE.EIGHT) quote = "Endgame protocols engaged.";
                triggerBanter(quote, turn);
            }
            
            setGameState('STRIKING');
        }, 1500);
        return () => clearTimeout(timer);
    }
  }, [gameState, isMoving, turn, winner]);

  useEffect(() => {
    if (gameState === 'STRIKING') {
        const timer = setTimeout(() => {
            if (gameStateRef.current !== 'STRIKING') return;
            const dir = shotDirection.current;
            const n = [...ballsRef.current].map(b => ({ ...b, position: b.position.clone(), velocity: b.velocity.clone(), rotation: b.rotation.clone() }));
            n[0].velocity.set(dir.x * shotPower.current, dir.y * shotPower.current);
            playBallHitSound(audioCtx.current!, shotPower.current * 1.5);
            ballsRef.current = n;
            setBalls(n);
            setGameState('SHOOTING');
        }, 300); // 300ms window for the strike animation
        return () => clearTimeout(timer);
    }
  }, [gameState, isMoving]);

  return (
    <group position={position} rotation={[0, Math.PI / 4, 0]}>
      {/* Table Shadow on Floor */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.05, 0]}>
          <planeGeometry args={[TABLE_WIDTH + 2, TABLE_HEIGHT + 2]} />
          <meshBasicMaterial color="#000" transparent opacity={0.6} />
      </mesh>
      <Html position={[0, 4.5, 0]} center>
          <div className="flex flex-col items-center gap-3 select-none pointer-events-none text-center relative">
              {/* Scanline Effect Overlay */}
              <div className="absolute inset-0 z-10 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] rounded-3xl" />
              
              {winner !== null && (
                  <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center rounded-3xl border-4 border-cyan-500 animate-in zoom-in duration-500">
                      <div className="text-cyan-400 text-[10px] font-mono tracking-[0.8em] mb-4 uppercase">Critical_Mission_End</div>
                      <div className="text-6xl font-black italic tracking-tighter text-white mb-2">
                          UNIT_0{winner + 1}
                      </div>
                      <div className="text-cyan-500 text-2xl font-black italic tracking-widest animate-pulse">DOMINANCE_CONFIRMED</div>
                      <div className="mt-8 text-[8px] text-white/20 font-mono tracking-widest uppercase">System_Reboot_In_Sequence...</div>
                  </div>
              )}
              <div className="px-6 py-3 bg-black/95 border-b-[4px] border-cyan-500 backdrop-blur-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.7)] rounded-t-2xl min-w-[320px] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500/20 blur-sm" />
                  <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2 relative z-20">
                    <div className="flex flex-col items-start gap-1">
                        <span className="text-[8px] text-cyan-600 font-mono tracking-[0.4em] leading-none uppercase">Neural_Link_Stable</span>
                        <div className="flex gap-1">
                            {[...Array(8)].map((_, i) => <div key={i} className={`w-1.5 h-1 ${i < 6 ? 'bg-cyan-500' : 'bg-cyan-500/10'}`} />)}
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] text-red-600 font-mono tracking-[0.4em] animate-pulse">LOCKED // LIVE</span>
                        <div className="text-[5px] text-white/20 font-mono">Bout_Hash: {Math.random().toString(16).slice(2, 10).toUpperCase()}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-8 relative z-20">
                      <div className={`flex flex-col items-center transition-all duration-700 ${turn === 0 ? 'scale-105 opacity-100' : 'opacity-20 translate-y-1'}`}>
                          <div className="text-[8px] text-cyan-500/50 mb-1 font-mono uppercase tracking-widest">
                            {unitTypeAssignment[0] || 'Awaiting_Type'}
                          </div>
                          <div className="text-3xl font-black italic tracking-tighter text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">UNIT_01</div>
                          <div className={`w-20 h-1 mt-1.5 rounded-full shadow-[0_0_15px_#22d3ee] transition-all duration-700 ${turn === 0 ? 'bg-cyan-400 scale-x-100' : 'bg-transparent scale-x-0'}`} />
                      </div>
                      <div className="flex flex-col items-center gap-1 opacity-20">
                         <div className="text-white text-xl font-black italic tracking-widest">VS</div>
                      </div>
                      <div className={`flex flex-col items-center transition-all duration-700 ${turn === 1 ? 'scale-105 opacity-100' : 'opacity-20 translate-y-1'}`}>
                          <div className="text-[8px] text-rose-500/50 mb-1 font-mono uppercase tracking-widest">
                            {unitTypeAssignment[1] || 'Awaiting_Type'}
                          </div>
                          <div className="text-3xl font-black italic tracking-tighter text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]">UNIT_02</div>
                          <div className={`w-20 h-1 mt-1.5 rounded-full shadow-[0_0_15px_#f43f5e] transition-all duration-700 ${turn === 1 ? 'bg-rose-500 scale-x-100' : 'bg-transparent scale-x-0'}`} />
                      </div>
                  </div>
              </div>
              <div className="group w-full max-w-[320px] flex">
                <div className="flex-1 px-4 py-2 bg-black/80 border-r border-white/5 backdrop-blur-md flex flex-col items-start">
                    <div className="text-white/20 text-[7px] uppercase tracking-widest font-mono">Potted_Asset_Log</div>
                    <div className="flex gap-1 mt-1">
                        {balls.filter(b => b.potted && !b.isCue).slice(-10).map(b => (
                            <div key={b.id} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: b.color }} />
                        ))}
                    </div>
                </div>
                <div className="flex-1 px-8 py-2 bg-black/60 overflow-hidden relative border border-white/5 backdrop-blur-md rounded-b-xl flex items-center justify-center">
                    <div className="text-cyan-400 text-[10px] uppercase tracking-[0.3em] font-black italic">
                        {gameState === 'SHOOTING' || isMoving ? (
                            <span className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-cyan-500 animate-ping rounded-full" />
                                CALCULATING_VECTORS
                            </span>
                        ) : 'AWAITING_INPUT'}
                    </div>
                </div>
              </div>
          </div>
      </Html>

      <Box args={[TABLE_WIDTH, 0.2, TABLE_HEIGHT]} position={[0, 0.8, 0]}>
        <meshPhysicalMaterial color="#065f21" roughness={0.8} clearcoat={0.1} clearcoatRoughness={0.9} />
        {/* Holographic Grid Overlay */}
        <gridHelper args={[TABLE_WIDTH, 20, "#22d3ee", "#22d3ee"]} position={[0, 0.11, 0]} />
      </Box>
      <Box args={[TABLE_WIDTH - 0.2, 0.21, TABLE_HEIGHT - 0.2]} position={[0, 0.8, 0]}>
         <meshStandardMaterial color="#0b4a1b" roughness={1} transparent opacity={0.2} wireframe />
      </Box>
      
      {/* Decorative Table Markings */}
      <Box args={[TABLE_WIDTH - 0.1, 0.01, 0.01]} position={[0, 0.9, 0]}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
      </Box>
      
      {/* Neon Rail Rim */}
      <Box args={[TABLE_WIDTH + 0.05, 0.05, TABLE_HEIGHT + 0.05]} position={[0, 0.92, 0]}>
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.2} transparent opacity={0.3} />
      </Box>

      {/* Rails and Wood Details */}
      <Box args={[TABLE_WIDTH + 0.6, 0.45, 0.3]} position={[0, 0.8, TABLE_HEIGHT/2 + 0.15]}>
          <meshPhysicalMaterial color="#2d1306" metalness={0.2} roughness={0.1} clearcoat={1.0} clearcoatRoughness={0.2} envMapIntensity={1.5} />
      </Box>
      <Box args={[TABLE_WIDTH + 0.6, 0.45, 0.3]} position={[0, 0.8, -TABLE_HEIGHT/2 - 0.15]}>
          <meshPhysicalMaterial color="#2d1306" metalness={0.2} roughness={0.1} clearcoat={1.0} clearcoatRoughness={0.2} envMapIntensity={1.5} />
      </Box>
      <Box args={[0.3, 0.45, TABLE_HEIGHT + 0.6]} position={[TABLE_WIDTH/2 + 0.15, 0.8, 0]}>
          <meshPhysicalMaterial color="#2d1306" metalness={0.2} roughness={0.1} clearcoat={1.0} clearcoatRoughness={0.2} envMapIntensity={1.5} />
      </Box>
      <Box args={[0.3, 0.45, TABLE_HEIGHT + 0.6]} position={[-TABLE_WIDTH/2 - 0.15, 0.8, 0]}>
          <meshPhysicalMaterial color="#2d1306" metalness={0.2} roughness={0.1} clearcoat={1.0} clearcoatRoughness={0.2} envMapIntensity={1.5} />
      </Box>

      {/* Aiming Diamonds */}
      {[-1, 0, 1].map(x => (
          <Box key={`diam-n-${x}`} args={[0.04, 0.01, 0.04]} position={[x * 1, 1.05, TABLE_HEIGHT/2 + 0.05]} rotation={[0, Math.PI/4, 0]}>
              <meshBasicMaterial color="#fff" transparent opacity={0.6} />
          </Box>
      ))}
      {[-1, 0, 1].map(x => (
          <Box key={`diam-s-${x}`} args={[0.04, 0.01, 0.04]} position={[x * 1, 1.05, -TABLE_HEIGHT/2 - 0.05]} rotation={[0, Math.PI/4, 0]}>
              <meshBasicMaterial color="#fff" transparent opacity={0.6} />
          </Box>
      ))}
      {[-3, -2, -1, 1, 2, 3].map(z => (
          <Box key={`diam-e-${z}`} args={[0.04, 0.01, 0.04]} position={[TABLE_WIDTH/2 + 0.05, 1.05, z * 1]} rotation={[0, Math.PI/4, 0]}>
              <meshBasicMaterial color="#fff" transparent opacity={0.6} />
          </Box>
      ))}
      {[-3, -2, -1, 1, 2, 3].map(z => (
          <Box key={`diam-w-${z}`} args={[0.04, 0.01, 0.04]} position={[-TABLE_WIDTH/2 - 0.05, 1.05, z * 1]} rotation={[0, Math.PI/4, 0]}>
              <meshBasicMaterial color="#fff" transparent opacity={0.6} />
          </Box>
      ))}

      {/* Corner Metal Caps */}
      {[[-2.1, -4.1], [2.1, -4.1], [-2.1, 4.1], [2.1, 4.1], [-2.1, 0], [2.1, 0]].map(([x, z], i) => (
          <Box key={`cap-${i}`} args={[0.4, 0.46, 0.4]} position={[x, 0.8, z]}>
              <meshPhysicalMaterial color="#94a3b8" metalness={1} roughness={0.2} clearcoat={1.0} />
          </Box>
      ))}

      {POCKETS.map((p, i) => (
        <group key={`guard-${i}`} position={[p[0], 1, p[1]]}>
            <mesh position={[0, -0.2, 0]}>
                <cylinderGeometry args={[POCKET_RADIUS, POCKET_RADIUS, 0.25]} />
                <meshBasicMaterial color="#000" />
            </mesh>
            <Cylinder args={[POCKET_RADIUS + 0.05, POCKET_RADIUS + 0.05, 0.05, 12]}>
                <meshStandardMaterial color="#444" metalness={1} roughness={0} />
            </Cylinder>
        </group>
      ))}
      
      {balls.map((b) => <BallShadow key={`shadow-${b.id}`} position={b.position} meshRef={(el) => { if (el) ballShadowsRef.current[b.id] = el; }} visible={!b.potted} />)}

      {balls.map((b) => (
        <Sphere key={b.id} ref={(el) => { if (el) ballMeshesRef.current[b.id] = el as THREE.Mesh; }} args={[BALL_RADIUS, 32, 24]} position={[b.position.x, 0.92, b.position.y]} rotation={b.rotation} visible={!b.potted}>
          <meshStandardMaterial 
            color={b.color} 
            emissive={b.color} 
            emissiveIntensity={b.isCue ? 1.5 : 0.4} 
            metalness={0.95} 
            roughness={0.02} 
            envMapIntensity={2}
          />
          {!b.isCue && (
            <group>
                {b.type === 'stripe' ? (
                    <Torus args={[BALL_RADIUS * 0.95, 0.02, 16, 64]} rotation={[Math.PI / 2, 0, 0]}>
                        <meshBasicMaterial color="#fff" />
                    </Torus>
                ) : (
                    <Box args={[BALL_RADIUS * 1.52, 0.005, BALL_RADIUS * 1.52]}>
                        <meshBasicMaterial color="#fff" opacity={0.3} transparent wireframe />
                    </Box>
                )}
                <pointLight intensity={0.5} distance={0.5} color={b.color} />
            </group>
          )}
        </Sphere>
      ))}

      {gameState === 'AIMING' && balls[0] && (
        <LaserGuide 
            from={balls[0].position} 
            to={balls[0].position.clone().add(new THREE.Vector2(Math.cos(shotAngle.current), Math.sin(shotAngle.current)).multiplyScalar(3))}
            color={turn === 0 ? "#22d3ee" : "#f43f5e"}
        />
      )}

      {effects.map(fx => fx.type === 'pot' ? (
          <PotEffect key={fx.id} position={fx.pos} color={fx.color} />
      ) : (
          <CollisionSpark key={fx.id} position={fx.pos} color={fx.color} />
      ))}
      <PoolRobot 
        position={[-3.8, 0, -1]} 
        rotation={Math.PI/2} 
        active={turn === 0} 
        banter={banter?.robotId === 0 ? banter.text : null} 
        color="#22d3ee" 
        cueBall={balls[0]} 
        shotAngle={shotAngle} 
        gameState={gameState} 
        winner={winner === 0}
        loser={winner === 1}
        robotType={unitTypeAssignment ? unitTypeAssignment[0] : null}
        reaction={robotReaction?.id === 0 ? robotReaction.type : null}
      />
      <PoolRobot 
        position={[3.8, 0, 1]} 
        rotation={-Math.PI/2} 
        active={turn === 1} 
        banter={banter?.robotId === 1 ? banter.text : null} 
        color="#f43f5e" 
        cueBall={balls[0]} 
        shotAngle={shotAngle} 
        gameState={gameState} 
        winner={winner === 1}
        loser={winner === 0}
        robotType={unitTypeAssignment ? unitTypeAssignment[1] : null}
        reaction={robotReaction?.id === 1 ? robotReaction.type : null}
      />
    </group>
  );
}

// --- JUKEBOX ---
const SONGS: { name: string, freq: number, scale: number[], pattern: number[], type: OscillatorType, color: string }[] = [
    { name: "Neon_Drive", freq: 110, scale: [1, 1.2, 1.5, 1.8, 2.0], pattern: [0, 0, 2, 0, 3, 0, 1, 0, 4, 3, 2, 1, 0, 2, 0, 1, 0, 1, 2, 3], type: 'square', color: "#22d3ee" },
    { name: "Void_Trap", freq: 82, scale: [1, 1.25, 1.5, 1.66, 1.8], pattern: [0, 3, 2, 1, 0, 3, 2, 1, 0, 0, 1, 1, 2, 2, 3, 3], type: 'sawtooth', color: "#f43f5e" },
    { name: "Glass_City", freq: 440, scale: [1, 1.12, 1.25, 1.33, 1.5], pattern: [0, 4, 3, 2, 1, 0, 1, 2, 0, 3, 4, 3, 0, 2, 4, 2], type: 'sine', color: "#fbbf24" },
    { name: "Logic_Core", freq: 220, scale: [1, 1.2, 1.5, 1.8, 2], pattern: [0, 2, 3, 2, 0, 1, 2, 1, 4, 0, 1, 2, 3, 4, 3, 2], type: 'triangle', color: "#a855f7" },
    { name: "Bit_Crushed", freq: 164, scale: [1, 1.1, 1.25, 1.5, 1.75], pattern: [0, 0, 3, 3, 1, 1, 2, 2, 4, 4, 2, 2, 3, 3, 1, 1], type: 'square', color: "#10b981" },
    { name: "Glitch_Sky", freq: 330, scale: [1, 1.2, 1.5, 1.9, 2.2], pattern: [0, 3, 1, 4, 0, 2, 1, 3, 0, 4, 2, 3, 1, 4, 3, 2], type: 'sawtooth', color: "#ec4899" }
];

function Jukebox({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
    const [currentSong, setCurrentSong] = useState<number | null>(null);
    const audioCtx = useRef<AudioContext | null>(null);
    const nodes = useRef<AudioNode[]>([]);
    const playbackSession = useRef<number>(0);
    const [visualizerActive, setVisualizerActive] = useState(false);

    // Interaction states
    const groupRef = useRef<THREE.Group>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const { camera } = useThree();
    const [, getKeys] = useKeyboardControls();
    const [inRange, setInRange] = useState(false);
    const keyEPressed = useRef(false);

    const worldPos = useRef(new THREE.Vector3());

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        groupRef.current.getWorldPosition(worldPos.current);
        const dist = camera.position.distanceTo(worldPos.current);
        const near = dist < 6;
        if (near !== inRange) setInRange(near);

        if (near) {
            const interact = getKeys().interact;
            if (interact && !keyEPressed.current) {
                keyEPressed.current = true;
                if (currentSong === null) {
                    playSong(0);
                } else if (currentSong + 1 < SONGS.length) {
                    playSong(currentSong + 1);
                } else {
                    stopSong();
                }
            } else if (!interact) {
                keyEPressed.current = false;
            }
        }
        
        // Spin the Jukebox core
        if (coreRef.current) {
            coreRef.current.rotation.y += delta * (visualizerActive ? 2 : 0.2);
            if (visualizerActive) {
                coreRef.current.scale.y = 1 + Math.sin(state.clock.elapsedTime * 10) * 0.2;
            } else {
                coreRef.current.scale.y = THREE.MathUtils.lerp(coreRef.current.scale.y, 1, 0.1);
            }
        }
    });

    const playSong = (index: number) => {
        if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioCtx.current.state === 'suspended') audioCtx.current.resume();
        
        // Stop current nodes
        nodes.current.forEach(n => { try { (n as any).stop?.(); n.disconnect(); } catch(e) {} });
        nodes.current = [];
        
        playbackSession.current += 1;
        const currentSession = playbackSession.current;

        const ctx = audioCtx.current;
        const song = SONGS[index];
        const stepTime = 120 / (index % 2 === 0 ? 120 : 140) / 4; // BPM based
        
        const scheduleBatch = (startTime: number, batchCount: number = 0) => {
            if (playbackSession.current !== currentSession) return;
            
            // Generate for 64 beats per batch
            const beatsToSchedule = 64;
            const batchDuration = beatsToSchedule * stepTime;

            // Main Melody Synth
            const mOsc = ctx.createOscillator();
            const mGain = ctx.createGain();
            mOsc.type = song.type;

            // Sub Bass
            const bOsc = ctx.createOscillator();
            const bGain = ctx.createGain();
            bOsc.type = 'sine';

            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.5, startTime);
            masterGain.connect(ctx.destination);

            for(let i = 0; i < beatsToSchedule; i++) {
                const globalBeat = batchCount * beatsToSchedule + i;
                const time = startTime + i * stepTime;
                
                const noteIndex = song.pattern[globalBeat % song.pattern.length];
                const frequency = song.freq * song.scale[noteIndex];
                
                // Bass line follows root of pattern
                bOsc.frequency.setValueAtTime(song.freq / 2, time);
                bGain.gain.setValueAtTime(globalBeat % 4 === 0 ? 0.3 : 0.1, time);
                bGain.gain.exponentialRampToValueAtTime(0.001, time + stepTime * 0.9);

                // Melody
                mOsc.frequency.setValueAtTime(frequency * 2, time);
                mGain.gain.setValueAtTime(0.08, time);
                mGain.gain.exponentialRampToValueAtTime(0.005, time + stepTime * 0.7);

                // Kick
                if (globalBeat % 4 === 0) {
                    const kOsc = ctx.createOscillator();
                    const kg = ctx.createGain();
                    kOsc.frequency.setValueAtTime(150, time);
                    kOsc.frequency.exponentialRampToValueAtTime(0.01, time + 0.2);
                    kg.gain.setValueAtTime(0.5, time);
                    kg.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
                    kOsc.connect(kg);
                    kg.connect(masterGain);
                    kOsc.start(time);
                    kOsc.stop(time + 0.2);
                    nodes.current.push(kOsc, kg);
                }
                
                // Percussion snare/hats
                if (globalBeat % 8 === 4) {
                    const sOsc = ctx.createOscillator();
                    const sg = ctx.createGain();
                    sOsc.type = 'triangle';
                    sOsc.frequency.setValueAtTime(1200, time);
                    sOsc.frequency.exponentialRampToValueAtTime(100, time + 0.15);
                    sg.gain.setValueAtTime(0.15, time);
                    sg.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
                    sOsc.connect(sg);
                    sg.connect(masterGain);
                    sOsc.start(time);
                    sOsc.stop(time + 0.15);
                    nodes.current.push(sOsc, sg);
                }

                // Hi-hats
                if (globalBeat % 2 === 1) {
                    const hOsc = ctx.createOscillator();
                    const hg = ctx.createGain();
                    hOsc.type = 'square';
                    hOsc.frequency.setValueAtTime(4000 + Math.random() * 2000, time);
                    hg.gain.setValueAtTime(0.04, time);
                    hg.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
                    hOsc.connect(hg);
                    hg.connect(masterGain);
                    hOsc.start(time);
                    hOsc.stop(time + 0.05);
                    nodes.current.push(hOsc, hg);
                }
            }

            mOsc.connect(mGain);
            mGain.connect(masterGain);
            mOsc.start(startTime);
            mOsc.stop(startTime + batchDuration);

            bOsc.connect(bGain);
            bGain.connect(masterGain);
            bOsc.start(startTime);
            bOsc.stop(startTime + batchDuration);

            nodes.current.push(mOsc, mGain, bOsc, bGain, masterGain);
            
            // Clean up old nodes roughly to prevent memory leak
            if (nodes.current.length > 500) {
                 nodes.current.slice(0, -200).forEach(n => { try { n.disconnect(); } catch(e) {} });
                 nodes.current = nodes.current.slice(-200);
            }

            // Schedule the next batch seamlessly
            const timeoutMs = (batchDuration - 0.5) * 1000; 
            setTimeout(() => {
                if (playbackSession.current === currentSession) {
                    scheduleBatch(startTime + batchDuration, batchCount + 1);
                }
            }, Math.max(0, timeoutMs));
        };

        setCurrentSong(index);
        setVisualizerActive(true);
        scheduleBatch(ctx.currentTime);
    };

    const stopSong = () => {
        playbackSession.current += 1;
        nodes.current.forEach(n => { try { (n as any).stop?.(); n.disconnect(); } catch(e) {} });
        nodes.current = [];
        setCurrentSong(null);
        setVisualizerActive(false);
    };

    return (
        <group position={position} ref={groupRef}>
            {/* Jukebox Base Pillar */}
            <Cylinder args={[1, 1.2, 1, 8]} position={[0, 0.5, 0]}>
                <meshStandardMaterial color="#0b0f19" metalness={0.8} roughness={0.2} />
            </Cylinder>
            
            {/* Middle Glass Tank */}
            <Cylinder args={[0.9, 0.9, 2, 16]} position={[0, 2, 0]}>
                <meshPhysicalMaterial color="#c084fc" transmission={0.9} roughness={0.1} opacity={0.3} transparent />
            </Cylinder>
            
            {/* Wireframe protective cage */}
            <Cylinder args={[0.95, 0.95, 2, 8]} position={[0, 2, 0]}>
                <meshStandardMaterial color="#22d3ee" wireframe transparent opacity={0.2} />
            </Cylinder>

            {/* Top Cap */}
            <Cylinder args={[1.1, 1, 0.5, 8]} position={[0, 3.25, 0]}>
                <meshStandardMaterial color="#0b0f19" metalness={0.8} roughness={0.2} />
            </Cylinder>

            {/* Inner Glowing Core */}
            <Box ref={coreRef} args={[0.5, 1.6, 0.5]} position={[0, 2, 0]}>
                <meshStandardMaterial 
                    color={currentSong !== null ? SONGS[currentSong].color : "#22d3ee"} 
                    emissive={currentSong !== null ? SONGS[currentSong].color : "#22d3ee"} 
                    emissiveIntensity={visualizerActive ? 2 : 0.5} 
                    wireframe={!visualizerActive}
                />
            </Box>

            {/* Visualizer Rings */}
            {visualizerActive && currentSong !== null && [1, 2, 3].map(i => (
                <JukeboxRing key={i} delay={i * 0.5} color={SONGS[currentSong].color} />
            ))}

            <Box args={[1.2, 0.8, 0.1]} position={[0, 2.2, 0.9]}>
                <meshBasicMaterial color="#000" />
            </Box>
            
            {/* Interaction Prompt */}
            {inRange && (
                <Html position={[0, 4, 0]} center transform style={{ pointerEvents: 'none' }}>
                    <div className="px-3 py-1 bg-black/80 border border-cyan-500/50 text-cyan-500 font-mono text-xs uppercase rounded whitespace-nowrap animate-pulse">
                        [E] Change Track
                    </div>
                </Html>
            )}

            <Html position={[0, 2.2, 0.96]} center transform scale={0.4}>
                <div className="w-64 h-32 bg-black border-2 border-cyan-500/30 p-2 font-mono flex flex-col gap-1 overflow-y-auto no-scrollbar pointer-events-auto">
                    <div className="text-[10px] text-cyan-500 mb-2 border-b border-cyan-500/30 pb-1 font-black">:: SYNTH_FREQ_ARRAY ::</div>
                    {SONGS.map((s, i) => (
                        <button 
                            key={i}
                            onClick={() => playSong(i)}
                            style={{ color: currentSong === i ? '#000' : s.color, backgroundColor: currentSong === i ? s.color : 'transparent' }}
                            className={`text-[8px] text-left px-2 py-1 transition-all uppercase ${currentSong === i ? 'font-black shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'hover:bg-white/5'}`}
                        >
                            [{String(i+1).padStart(2, '0')}] {s.name}
                        </button>
                    ))}
                    {currentSong !== null && (
                        <button onClick={stopSong} className="mt-2 text-[8px] text-rose-500 text-center uppercase font-black hover:bg-rose-500/10 p-1 border border-rose-500/20">ABORT_STREAM</button>
                    )}
                </div>
            </Html>
            <pointLight position={[0, 2, 1]} intensity={visualizerActive ? 5 : 1} color={currentSong !== null ? SONGS[currentSong].color : "#22d3ee"} />
        </group>
    );
}

function JukeboxRing({ delay, color }: { delay: number, color: string }) {
    const ref = useRef<THREE.Mesh>(null);
    useFrame((state) => {
        if (!ref.current) return;
        const s = (state.clock.elapsedTime + delay) % 2;
        ref.current.scale.set(1 + s * 2, 1 + s * 2, 1);
        if (ref.current.material instanceof THREE.Material) {
            ref.current.material.opacity = Math.max(0, 0.3 * (1 - s/2));
        }
    });
    return (
        <mesh ref={ref} position={[0, 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1, 1.1, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
    );
}

function LivingRoom() {
  return (
    <group position={[0, 0, -2]}>
      {/* Sleek Digital Sofa */}
      <group position={[-5, 0.4, -4]} rotation={[0, Math.PI / 4, 0]}>
        {/* Base */}
        <Box args={[6, 0.6, 2.2]}>
          <meshStandardMaterial color="#0c4a6e" metalness={0.6} roughness={0.4} />
        </Box>
        {/* Cushions */}
        <Box args={[1.8, 0.4, 1.8]} position={[-1.9, 0.4, 0.1]} radius={0.1}>
          <meshStandardMaterial color="#0284c7" roughness={0.7} />
        </Box>
        <Box args={[1.8, 0.4, 1.8]} position={[0, 0.4, 0.1]} radius={0.1}>
          <meshStandardMaterial color="#0284c7" roughness={0.7} />
        </Box>
        <Box args={[1.8, 0.4, 1.8]} position={[1.9, 0.4, 0.1]} radius={0.1}>
          <meshStandardMaterial color="#0284c7" roughness={0.7} />
        </Box>
        {/* Backrest */}
        <Box args={[6, 1.5, 0.6]} position={[0, 0.8, -0.8]}>
          <meshStandardMaterial color="#075985" roughness={0.8} />
        </Box>
        {/* Armrests */}
        <Box args={[0.5, 1.0, 2.2]} position={[-3.1, 0.5, 0]}>
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </Box>
        <Box args={[0.5, 1.0, 2.2]} position={[3.1, 0.5, 0]}>
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </Box>
        {/* Neon Rim */}
        <Box args={[6.2, 0.05, 2.3]} position={[0, 0.1, 0]}>
          <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={1} />
        </Box>
      </group>

      {/* Cyberpunk Coffee Table */}
      <group position={[-3, 0.25, -2]}>
        {/* Main Glass Top */}
        <Cylinder args={[1.5, 1.5, 0.1, 32]}>
          <meshPhysicalMaterial color="#cffafe" transparent opacity={0.4} transmission={0.9} ior={1.5} roughness={0} metalness={0.2} />
        </Cylinder>
        {/* Glowing Data Ring */}
        <Torus args={[1.3, 0.02, 16, 64]} position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color="#38bdf8" />
        </Torus>
        <Torus args={[0.8, 0.02, 16, 64]} position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color="#818cf8" />
        </Torus>
        {/* Base Pillar */}
        <Cylinder args={[0.4, 0.8, 0.6, 16]} position={[0, -0.3, 0]}>
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
        </Cylinder>
        {/* Holographic Centerpiece */}
        <group position={[0, 0.3, 0]}>
            <Sphere args={[0.15, 16, 16]}>
                <meshBasicMaterial color="#a78bfa" wireframe transparent opacity={0.6}/>
            </Sphere>
            <pointLight distance={2} intensity={2} color="#a78bfa" />
        </group>
      </group>

      <Chandelier />
      <Jukebox position={[-14, 0, -14]} />
      <PoolGame position={[5, 0, -8]} />
      <BlackjackGame position={[12, 0, 8]} />
      <DanceFloorAndBar position={[-10, 0, 8]} />
    </group>
  );
}

function NebulaSkybox() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[100, 32, 32]} />
      <shaderMaterial
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vPosition;
          void main() {
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
    fragmentShader={`
      uniform float uTime;
      varying vec3 vPosition;
      
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + .1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)),f.x),
                       mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)),f.x),
                       mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }

      void main() {
        vec3 dir = normalize(vPosition);
        float n = noise(dir * 2.5 + uTime * 0.05);
        n += 0.5 * noise(dir * 5.0 - uTime * 0.03);
        n += 0.25 * noise(dir * 10.0 + uTime * 0.02);
        n += 0.125 * noise(dir * 20.0 - uTime * 0.01);
        
        vec3 color1 = vec3(0.01, 0.02, 0.06); // Deep mysterious void
        vec3 color2 = vec3(0.05, 0.3, 0.7);   // Luminous cyber-blue
        vec3 color3 = vec3(0.4, 0.05, 0.5);   // Deep purple
        
        vec3 nebula = mix(color1, color2, pow(n, 2.5));
        nebula = mix(nebula, color3, pow(max(0.0, noise(dir * 3.5 + uTime * 0.02)), 3.0));

        // Add dynamic light blooms (stars fading in and out slowly)
        float twinkle = sin(uTime * 1.5 + hash(dir * 200.0) * 10.0) * 0.5 + 0.5;
        float stars = pow(hash(dir * 250.0), 60.0) * twinkle;
        nebula += stars * vec3(0.8, 0.9, 1.0) * 1.5;
        
        // Large ambient volumetric glow spots
        float glow1 = max(0.0, dot(dir, normalize(vec3(1.0, 0.5, -0.8))));
        nebula += pow(glow1, 8.0) * vec3(0.05, 0.1, 0.2);
        
        float glow2 = max(0.0, dot(dir, normalize(vec3(-0.8, -0.5, 1.0))));
        nebula += pow(glow2, 12.0) * vec3(0.1, 0.02, 0.15);

        gl_FragColor = vec4(nebula, 1.0);
      }
    `}
      />
    </mesh>
  );
}

function FloatingAsteroids() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  // Generate random asteroid data
  const { data, dummy } = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 60; i++) {
        arr.push({
            position: new THREE.Vector3(
                (Math.random() - 0.5) * 150,
                (Math.random() - 0.5) * 100 + 10,
                (Math.random() - 0.5) * 60 - 30
            ),
            rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
            scale: Math.random() * 3 + 0.5,
            speed: Math.random() * 0.05 + 0.01,
            rotSpeed: new THREE.Vector3(
               (Math.random() - 0.5) * 0.02,
               (Math.random() - 0.5) * 0.02,
               (Math.random() - 0.5) * 0.02
            )
        });
    }
    return { data: arr, dummy: new THREE.Object3D() };
  }, []);

  useFrame((state) => {
     if (groupRef.current) {
         groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.2) * 4;
     }

     if (meshRef.current) {
        data.forEach((ast, i) => {
          ast.position.x += ast.speed;
          if (ast.position.x > 75) ast.position.x = -75;

          ast.rotation.x += ast.rotSpeed.x;
          ast.rotation.y += ast.rotSpeed.y;
          ast.rotation.z += ast.rotSpeed.z;

          dummy.position.copy(ast.position);
          dummy.rotation.copy(ast.rotation);
          dummy.scale.set(ast.scale, ast.scale, ast.scale);
          dummy.updateMatrix();
          meshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
     }
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, 60]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#334155" roughness={0.9} metalness={0.1} />
      </instancedMesh>
    </group>
  );
}

function ForcefieldWindow() {
  const shaderArgs = useMemo(() => ({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color("#0ea5e9") }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying vec2 vUv;
      
      void main() {
        // Hexagonal or lined energy grid
        float linesY = sin(vUv.y * 100.0 - time * 5.0) * 0.5 + 0.5;
        float pulse = sin(vUv.x * 20.0 + time * 2.0) * 0.5 + 0.5;
        float alpha = linesY * pulse * 0.15;
        
        // Edge glow
        float edgeY = pow(abs(vUv.y - 0.5) * 2.0, 4.0);
        float edgeX = pow(abs(vUv.x - 0.5) * 2.0, 4.0);
        alpha += (edgeY + edgeX) * 0.3;
        
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }), []);

  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current && ref.current.material instanceof THREE.ShaderMaterial) {
      ref.current.material.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <Box args={[28, 11, 0.05]} position={[0, 0, 0]} ref={ref}>
      <shaderMaterial args={[shaderArgs]} />
    </Box>
  );
}

function ShipInterior() {
  const wallMaterial = <meshPhysicalMaterial color="#020617" metalness={1.0} roughness={0.15} emissive="#0ea5e9" emissiveIntensity={0.05} clearcoat={1.0} clearcoatRoughness={0.1} />;
  const neonLightMaterial = <meshBasicMaterial color="#38bdf8" />;

  return (
    <group>
      {/* Ship Floor & Ceiling */}
      <Box args={[40, 0.2, 40]} position={[0, -0.1, 0]}>{wallMaterial}</Box>
      <Box args={[40, 0.2, 40]} position={[0, 18.1, 0]}>{wallMaterial}</Box>
      
      {/* Side & Front Walls */}
      <Box args={[0.2, 18, 40]} position={[-20.1, 9, 0]}>{wallMaterial}</Box>
      <Box args={[0.2, 18, 40]} position={[20.1, 9, 0]}>{wallMaterial}</Box>
      <Box args={[40, 18, 0.2]} position={[0, 9, 20.1]}>{wallMaterial}</Box>
      
      {/* Back Wall with Window Cutout (z = -20) */}
      <group position={[0, 9, -20.1]}>
        <Box args={[6, 18, 0.2]} position={[-17, 0, 0]}>{wallMaterial}</Box>
        <Box args={[6, 18, 0.2]} position={[17, 0, 0]}>{wallMaterial}</Box>
        <Box args={[28, 4.5, 0.2]} position={[0, 6.75, 0]}>{wallMaterial}</Box>
        <Box args={[28, 2.5, 0.2]} position={[0, -7.75, 0]}>{wallMaterial}</Box>

        {/* Thick Glowing Bevels framing the glass */}
        <Box args={[28.2, 0.4, 0.4]} position={[0, -6.3, 0.2]}>{neonLightMaterial}</Box>
        <Box args={[28.2, 0.4, 0.4]} position={[0, 4.3, 0.2]}>{neonLightMaterial}</Box>
        <Box args={[0.4, 11, 0.4]} position={[-14.3, -1, 0.2]}>{neonLightMaterial}</Box>
        <Box args={[0.4, 11, 0.4]} position={[14.3, -1, 0.2]}>{neonLightMaterial}</Box>
      </group>

      {/* Grid Pattern on Floor/Ceiling to give it more of a Tron/Cube feel */}
      <gridHelper args={[40, 40, "#38bdf8", "#0284c7"]} position={[0, 0.05, 0]} />
      <gridHelper args={[40, 40, "#0ea5e9", "#082f49"]} position={[0, 17.95, 0]} />

      <group rotation={[Math.PI / 2, 0, 0]} position={[0, 9, 19.9]}>
        <gridHelper args={[40, 40, "#0ea5e9", "#082f49"]} />
      </group>
      
      {/* Observation Bay Window Glass */}
      <group position={[0, 8, -19.8]}>
         <Box args={[28, 11, 0.1]} position={[0, 0, -0.1]}>
            <meshPhysicalMaterial color="#cffafe" transparent opacity={0.05} transmission={0.9} ior={1.5} roughness={0} metalness={0.2} depthWrite={false} />
         </Box>
         <ForcefieldWindow />
      </group>

      {/* Alien Planet Scenery behind window */}
      <group position={[0, 0, -60]}>
         <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
         <directionalLight position={[-50, 50, -20]} intensity={2.5} color="#5eead4" />
         <ambientLight intensity={0.05} color="#0f172a" />
         
         {/* Giant Ringed Planet in Sky */}
         <group position={[40, 30, -30]} rotation={[0.2, -0.4, 0.3]}>
           <Sphere args={[25, 64, 64]}>
             {/* We can use a custom shader material for gas giant textures, or layered standard materials */}
             <meshStandardMaterial 
                color="#0f766e" 
                roughness={0.8} 
                metalness={0.1} 
                emissive="#0d9488" 
                emissiveIntensity={0.2}
                wireframe={false}
             />
           </Sphere>
           {/* Planet Atmosphere Glow */}
           <Sphere args={[26, 64, 64]}>
              <meshBasicMaterial color="#2dd4bf" transparent opacity={0.15} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
           </Sphere>

           {/* Planet Rings */}
           <Torus args={[40, 3.5, 2, 128]} rotation={[Math.PI / 2 + 0.1, 0, 0]}>
             <meshStandardMaterial color="#5eead4" transparent opacity={0.7} emissive="#14b8a6" emissiveIntensity={0.3} />
           </Torus>
           <Torus args={[48, 1.5, 2, 128]} rotation={[Math.PI / 2 + 0.1, 0, 0]}>
             <meshStandardMaterial color="#ccfbf1" transparent opacity={0.4} />
           </Torus>
           <Torus args={[53, 0.5, 2, 128]} rotation={[Math.PI / 2 + 0.1, 0, 0]}>
             <meshStandardMaterial color="#f0fdfa" transparent opacity={0.2} />
           </Torus>
         </group>

         {/* Floating Asteroids Field */}
         <FloatingAsteroids />

         {/* Foreground Mountain silhouette against the glow */}
         <group position={[0, -10, 10]}>
             <mesh rotation={[0, Math.PI / 4, 0]}>
                <coneGeometry args={[25, 45, 8]} />
                <meshStandardMaterial color="#020617" emissive="#4c1d95" emissiveIntensity={0.5} roughness={0.8} flatShading />
             </mesh>
             <mesh position={[-10, -5, 5]} rotation={[0, Math.PI / 3, 0]}>
                <coneGeometry args={[15, 30, 7]} />
                <meshStandardMaterial color="#020617" emissive="#3b82f6" emissiveIntensity={0.4} roughness={0.9} flatShading />
             </mesh>
             <mesh position={[12, -8, 2]} rotation={[0, Math.PI / 6, 0]}>
                <coneGeometry args={[18, 25, 6]} />
                <meshStandardMaterial color="#020617" emissive="#10b981" emissiveIntensity={0.2} roughness={0.8} flatShading />
             </mesh>
         </group>
         
         {/* Secondary Spikes */}
         <group position={[-25, -15, 15]}>
             <mesh rotation={[0, -0.2, 0]}>
                <coneGeometry args={[18, 30, 6]} />
                <meshStandardMaterial color="#020617" emissive="#8b5cf6" emissiveIntensity={0.3} roughness={0.9} flatShading />
             </mesh>
             <mesh position={[-8, -5, -4]} rotation={[0, -0.5, 0]}>
                <coneGeometry args={[12, 20, 5]} />
                <meshStandardMaterial color="#020617" emissive="#6366f1" emissiveIntensity={0.4} roughness={1} flatShading />
             </mesh>
         </group>
         <group position={[30, -20, 20]}>
             <mesh rotation={[0, 0.3, 0]}>
                <coneGeometry args={[22, 35, 7]} />
                <meshStandardMaterial color="#0f172a" emissive="#0ea5e9" emissiveIntensity={0.2} roughness={1} flatShading />
             </mesh>
             <mesh position={[10, -5, 2]} rotation={[0, 0.6, 0]}>
                <coneGeometry args={[16, 25, 5]} />
                <meshStandardMaterial color="#0f172a" emissive="#14b8a6" emissiveIntensity={0.15} roughness={1} flatShading />
             </mesh>
         </group>

         {/* Glowing Ground Terrain */}
         <mesh position={[0, -25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[200, 100, 64, 32]} />
            <meshStandardMaterial 
                color="#020617" 
                emissive="#38bdf8" 
                emissiveIntensity={0.3} 
                roughness={0.9} 
                wireframe={true} 
            />
         </mesh>
         {/* Solid Base beneath Wireframe */}
         <mesh position={[0, -25.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[200, 100, 1, 1]} />
            <meshStandardMaterial color="#020617" roughness={1} />
         </mesh>
         
         {/* Distant Moons / Planets */}
         <Sphere args={[5, 32, 32]} position={[-35, 40, -10]}>
             <meshStandardMaterial color="#bae6fd" emissive="#0284c7" emissiveIntensity={0.6} />
         </Sphere>
         <Sphere args={[2, 16, 16]} position={[-20, 28, 5]}>
             <meshStandardMaterial color="#f0f9ff" emissive="#7dd3fc" emissiveIntensity={0.3} />
         </Sphere>

         {/* Atmospherics */}
         <Box args={[200, 20, 1]} position={[0, -15, 20]}>
             <meshBasicMaterial color="#1e3a8a" transparent opacity={0.4} blending={THREE.AdditiveBlending} />
         </Box>
      </group>
    </group>
  );
}

function DynamicLights() {
  const light1 = useRef<THREE.PointLight>(null);
  const light2 = useRef<THREE.PointLight>(null);
  const light3 = useRef<THREE.PointLight>(null);
  const glow1 = useRef<THREE.Mesh>(null);
  const glow2 = useRef<THREE.Mesh>(null);
  const glow3 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    
    // Flickering and moving accent lights
    if (light1.current && glow1.current) {
        light1.current.intensity = 1.5 + Math.sin(t * 3) * 0.5 + Math.sin(t * 12) * 0.2;
        light1.current.position.y = 5 + Math.sin(t * 0.5) * 2;
        light1.current.position.x = -10 + Math.cos(t * 0.3) * 2;
        glow1.current.position.copy(light1.current.position);
        (glow1.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(t * 3) * 0.1;
    }
    if (light2.current && glow2.current) {
        light2.current.intensity = 1.5 + Math.sin(t * 4 + 2) * 0.5 + Math.cos(t * 15) * 0.2;
        light2.current.position.y = 6 + Math.cos(t * 0.4) * 2;
        light2.current.position.z = 10 + Math.sin(t * 0.25) * 2;
        glow2.current.position.copy(light2.current.position);
        (glow2.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(t * 4 + 2) * 0.1;
    }
    if (light3.current && glow3.current) {
        light3.current.intensity = 1.5 + Math.cos(t * 2.5 + 4) * 0.5 + Math.sin(t * 8) * 0.2;
        light3.current.position.x = 10 + Math.sin(t * 0.35) * 2;
        light3.current.position.z = -10 + Math.cos(t * 0.45) * 2;
        glow3.current.position.copy(light3.current.position);
        (glow3.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.cos(t * 2.5 + 4) * 0.1;
    }
  });

  return (
    <>
      <pointLight ref={light1} intensity={2} color="#fb7185" distance={15} />
      <mesh ref={glow1}>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial color="#fb7185" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <pointLight ref={light2} intensity={2} color="#0ea5e9" distance={15} />
      <mesh ref={glow2}>
        <sphereGeometry args={[2, 16, 16]} />
        <meshBasicMaterial color="#0ea5e9" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <pointLight ref={light3} intensity={2} color="#c084fc" distance={15} />
       <mesh ref={glow3}>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
}

function Environment({ targets }: { targets: TargetData[] }) {
  return (
    <>
      <color attach="background" args={["#020617"]} />
      <fog attach="fog" args={["#020617", 10, 80]} />
      
      {/* Interior Ambient Lighting */}
      <ambientLight intensity={0.4} color="#e0f2fe" />
      <pointLight position={[0, 12, 0]} intensity={1.5} color="#38bdf8" />
      <spotLight position={[0, 15, 0]} angle={0.8} penumbra={1} intensity={2} color="#0ea5e9" castShadow />
      <DynamicLights />
      
      <ShipInterior />
      
      {/* Cinematic Exterior Setup */}
      <group position={[0, 0, -80]}>
         <NebulaSkybox />
         {/* Exterior Space Lighting */}
         <directionalLight position={[-100, 100, -50]} intensity={5.0} color="#2dd4bf" />
         <ambientLight intensity={0.1} color="#0f172a" />
         
         {/* Giant Ringed Exoplanet */}
         <group position={[150, 80, -200]} rotation={[0.2, -0.4, 0.3]}>
           <mesh>
             <sphereGeometry args={[150, 64, 64]} />
             <meshStandardMaterial color="#0c4a6e" roughness={0.7} metalness={0.2} emissive="#0284c7" emissiveIntensity={0.1} />
           </mesh>
           {/* Planet Rings */}
           <mesh rotation={[Math.PI / 2 + 0.1, 0, 0]}>
             <ringGeometry args={[180, 260, 64]} />
             <meshStandardMaterial color="#38bdf8" transparent opacity={0.6} side={THREE.DoubleSide} />
           </mesh>
         </group>

         <FloatingAsteroids />
      </group>
      
      <LivingRoom />
      <RobotNPC />

      {/* Moving Targets */}
      {targets.map(target => <Target key={target.id} data={target} />)}
    </>
  );
}

// --- AMBIENT VOID SOUND ---
function AmbientVoidSound({ active }: { active: boolean }) {
    const audioCtx = useRef<AudioContext | null>(null);
    const nodes = useRef<AudioNode[]>([]);

    useEffect(() => {
        if (!active) return;
        
        if (!audioCtx.current) {
            audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        const ctx = audioCtx.current;
        if (ctx.state === 'suspended') ctx.resume();

        // Base Drone - Soothing major chord base
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g1 = ctx.createGain();
        o1.type = 'sine';
        o2.type = 'sine';
        o1.frequency.setValueAtTime(130.81, ctx.currentTime); // C3
        o2.frequency.setValueAtTime(196.00, ctx.currentTime); // G3
        g1.gain.setValueAtTime(0, ctx.currentTime);
        g1.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 8);
        
        // Gentle Slow Modulator
        const mod = ctx.createOscillator();
        const modG = ctx.createGain();
        mod.frequency.setValueAtTime(0.05, ctx.currentTime);
        modG.gain.setValueAtTime(2, ctx.currentTime);
        mod.connect(modG);
        modG.connect(o1.frequency);
        modG.connect(o2.frequency);
        
        o1.connect(g1);
        o2.connect(g1);
        g1.connect(ctx.destination);
        o1.start();
        o2.start();
        mod.start();

        // Soft melodic texture bursts (Pentatonic scale elements)
        const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // C4, D4, E4, G4, A4, C5
        const interval = setInterval(() => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            const randomNote = notes[Math.floor(Math.random() * notes.length)];
            o.frequency.setValueAtTime(randomNote * 2, ctx.currentTime); 
            g.gain.setValueAtTime(0, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 3);
            g.gain.linearRampToValueAtTime(0, ctx.currentTime + 6);
            
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + 6);
        }, 6000);

        nodes.current = [o1, o2, g1, mod, modG];

        return () => {
            clearInterval(interval);
            nodes.current.forEach(n => { try { (n as any).stop?.(); n.disconnect(); } catch(e) {} });
        };
    }, [active]);

    return null;
}

// --- VIRTUAL AI CAT ---
function VirtualCat({ audioCtx }: { audioCtx: React.MutableRefObject<AudioContext | null> }) {
    const groupRef = useRef<THREE.Group>(null);
    const timeRef = useRef(0);
    const [meowText, setMeowText] = useState<string | null>(null);

    const playMeow = () => {
        if (!audioCtx.current) return;
        const ctx = audioCtx.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.3);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.linearRampToValueAtTime(400, now + 0.3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.3);
        
        setMeowText("MEOW");
        setTimeout(() => setMeowText(null), 1000);
    };

    const state = useRef({
        pos: new THREE.Vector3(0, 0, -2),
        targetPos: new THREE.Vector3(2, 0, -2),
        y: 0,
        targetY: 0,
        startY: 0,
        rotationY: 0,
        isWalking: false,
        timer: 0,
        idleState: 'standing' as 'standing' | 'sitting' | 'sleeping' | 'stretching'
    });

    const bodyRef = useRef<THREE.Mesh>(null);
    const headRef = useRef<THREE.Group>(null);
    const tailRef = useRef<THREE.Group>(null);
    const legFL = useRef<THREE.Mesh>(null);
    const legFR = useRef<THREE.Mesh>(null);
    const legBL = useRef<THREE.Mesh>(null);
    const legBR = useRef<THREE.Mesh>(null);

    useFrame((_, delta) => {
        timeRef.current += delta;
        const t = timeRef.current;
        const s = state.current;
        s.timer -= delta;
        
        // AI Logic
        if (s.timer <= 0) {
            if (Math.random() > 0.6 && !meowText && s.idleState !== 'sleeping') {
                playMeow();
            }
            if (Math.random() > 0.6) {
                // Pick new target (Walk)
                s.idleState = 'standing';
                const onTable = s.y > 0.5;
                if (onTable) {
                    if (Math.random() > 0.8) {
                        // Hop off table
                        s.targetY = 0;
                        s.startY = s.y;
                        s.targetPos.set(5.5 + (Math.random()-0.5)*7, 0, -4.5 + (Math.random()-0.5)*7);
                    } else {
                        // Wander on table
                        s.targetPos.set(5.5 + (Math.random()-0.5)*2, 0, -4.5 + (Math.random()-0.5)*2);
                    }
                } else {
                    if (Math.random() > 0.8) {
                        // Hop onto table
                        s.targetY = 1.0; // Slightly above table green
                        s.startY = s.y;
                        s.targetPos.set(5.5 + (Math.random()-0.5)*1, 0, -4.5 + (Math.random()-0.5)*1);
                    } else {
                        // Wander on floor
                        s.targetPos.set((Math.random()-0.5)*10, 0, (Math.random()-0.5)*10);
                    }
                }
                s.timer = 2 + Math.random() * 4;
            } else {
                // Change idle state
                s.timer = 2 + Math.random() * 5;
                s.isWalking = false;
                const r = Math.random();
                if (r < 0.3) s.idleState = 'sitting';
                else if (r < 0.6) s.idleState = 'sleeping';
                else if (r < 0.8) s.idleState = 'stretching';
                else s.idleState = 'standing';
            }
        }

        // Motion
        if (groupRef.current) {
            const currentPos2D = new THREE.Vector2(s.pos.x, s.pos.z);
            const targetPos2D = new THREE.Vector2(s.targetPos.x, s.targetPos.z);
            const dist = currentPos2D.distanceTo(targetPos2D);
            
            s.isWalking = dist > 0.1;
            
            if (s.isWalking) {
                s.idleState = 'standing';
                const dir = targetPos2D.clone().sub(currentPos2D).normalize();
                const speed = s.targetY !== s.y ? 3.5 : 1.5; 
                s.pos.x += dir.x * speed * delta;
                s.pos.z += dir.y * speed * delta;
                
                const targetRotY = Math.atan2(dir.x, dir.y);
                
                let diffY = targetRotY - s.rotationY;
                while (diffY > Math.PI) diffY -= 2 * Math.PI;
                while (diffY < -Math.PI) diffY += 2 * Math.PI;
                s.rotationY += diffY * 5 * delta;
            }
            
            // Hop Y
            if (Math.abs(s.y - s.targetY) > 0.01) {
                s.y = THREE.MathUtils.lerp(s.y, s.targetY, delta * 4);
                const diff = Math.abs(s.targetY - s.startY);
                let bump = 0;
                if (diff > 0.05) {
                     const progress = 1 - (Math.abs(s.targetY - s.y) / diff);
                     bump = Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI) * 0.8;
                }
                groupRef.current.position.y = s.y + Math.max(0, bump);
            } else {
                s.y = s.targetY;
                groupRef.current.position.y = s.y;
            }
            
            groupRef.current.position.x = s.pos.x;
            groupRef.current.position.z = s.pos.z;
            groupRef.current.rotation.y = s.rotationY;
        }

        // Animations
        if (s.isWalking) {
            const walkSpeed = 20;
            if(legFL.current) legFL.current.rotation.x = Math.sin(t * walkSpeed) * 0.5;
            if(legBR.current) legBR.current.rotation.x = Math.sin(t * walkSpeed) * 0.5;
            if(legFR.current) legFR.current.rotation.x = Math.sin(t * walkSpeed + Math.PI) * 0.5;
            if(legBL.current) legBL.current.rotation.x = Math.sin(t * walkSpeed + Math.PI) * 0.5;
            if(bodyRef.current) bodyRef.current.position.y = 0.2 + Math.abs(Math.sin(t * walkSpeed)) * 0.02;
            if(bodyRef.current) bodyRef.current.rotation.x = 0;
            if(headRef.current) headRef.current.rotation.y = Math.sin(t * 3) * 0.1;
            if(headRef.current) headRef.current.rotation.x = 0;
            if(headRef.current) headRef.current.position.y = 0.3;
            if(tailRef.current) tailRef.current.rotation.x = Math.sin(t * 8) * 0.2 + 0.3;
        } else {
            if (s.idleState === 'sitting') {
                if(legFL.current) legFL.current.rotation.x = THREE.MathUtils.lerp(legFL.current.rotation.x, 0, 0.1);
                if(legFR.current) legFR.current.rotation.x = THREE.MathUtils.lerp(legFR.current.rotation.x, 0, 0.1);
                if(legBL.current) legBL.current.rotation.x = THREE.MathUtils.lerp(legBL.current.rotation.x, -Math.PI / 2, 0.1);
                if(legBR.current) legBR.current.rotation.x = THREE.MathUtils.lerp(legBR.current.rotation.x, -Math.PI / 2, 0.1);
                if(bodyRef.current) bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 0.15, 0.1);
                if(bodyRef.current) bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, -0.3, 0.1);
                if(headRef.current) headRef.current.rotation.y = Math.sin(t * 1.5) * 0.2;
                if(headRef.current) headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0.1, 0.1);
                if(headRef.current) headRef.current.position.y = THREE.MathUtils.lerp(headRef.current.position.y, 0.3, 0.1);
                if(tailRef.current) tailRef.current.rotation.x = THREE.MathUtils.lerp(tailRef.current.rotation.x, 1.2, 0.1);
            } else if (s.idleState === 'sleeping') {
                if(legFL.current) legFL.current.rotation.x = THREE.MathUtils.lerp(legFL.current.rotation.x, Math.PI / 2, 0.1);
                if(legFR.current) legFR.current.rotation.x = THREE.MathUtils.lerp(legFR.current.rotation.x, Math.PI / 2, 0.1);
                if(legBL.current) legBL.current.rotation.x = THREE.MathUtils.lerp(legBL.current.rotation.x, -Math.PI / 2, 0.1);
                if(legBR.current) legBR.current.rotation.x = THREE.MathUtils.lerp(legBR.current.rotation.x, -Math.PI / 2, 0.1);
                if(bodyRef.current) bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 0.08, 0.1);
                if(bodyRef.current) bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0, 0.1);
                if(headRef.current) headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, Math.PI / 4, 0.1);
                if(headRef.current) headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, -0.2, 0.1);
                if(headRef.current) headRef.current.position.y = THREE.MathUtils.lerp(headRef.current.position.y, 0.12, 0.1);
                if(tailRef.current) tailRef.current.rotation.x = THREE.MathUtils.lerp(tailRef.current.rotation.x, Math.PI / 2, 0.1);
            } else if (s.idleState === 'stretching') {
                if(legFL.current) legFL.current.rotation.x = THREE.MathUtils.lerp(legFL.current.rotation.x, 0.5, 0.1);
                if(legFR.current) legFR.current.rotation.x = THREE.MathUtils.lerp(legFR.current.rotation.x, 0.5, 0.1);
                if(legBL.current) legBL.current.rotation.x = THREE.MathUtils.lerp(legBL.current.rotation.x, -0.2, 0.1);
                if(legBR.current) legBR.current.rotation.x = THREE.MathUtils.lerp(legBR.current.rotation.x, -0.2, 0.1);
                if(bodyRef.current) bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 0.15, 0.1);
                if(bodyRef.current) bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0.2, 0.1);
                if(headRef.current) headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, 0, 0.1);
                if(headRef.current) headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, -0.3, 0.1);
                if(headRef.current) headRef.current.position.y = THREE.MathUtils.lerp(headRef.current.position.y, 0.25, 0.1);
                if(tailRef.current) tailRef.current.rotation.x = THREE.MathUtils.lerp(tailRef.current.rotation.x, -0.2, 0.1);
            } else { // standing
                if(legFL.current) legFL.current.rotation.x = THREE.MathUtils.lerp(legFL.current.rotation.x, 0, 0.1);
                if(legBR.current) legBR.current.rotation.x = THREE.MathUtils.lerp(legBR.current.rotation.x, 0, 0.1);
                if(legFR.current) legFR.current.rotation.x = THREE.MathUtils.lerp(legFR.current.rotation.x, 0, 0.1);
                if(legBL.current) legBL.current.rotation.x = THREE.MathUtils.lerp(legBL.current.rotation.x, 0, 0.1);
                if(bodyRef.current) bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 0.2, 0.1);
                if(bodyRef.current) bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0, 0.1);
                if(headRef.current) headRef.current.rotation.y = Math.sin(t * 1.5) * 0.2;
                if(headRef.current) headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0, 0.1);
                if(headRef.current) headRef.current.position.y = THREE.MathUtils.lerp(headRef.current.position.y, 0.3, 0.1);
                if(tailRef.current) tailRef.current.rotation.x = Math.sin(t * 2) * 0.2 + 0.3;
                if(tailRef.current) tailRef.current.rotation.z = Math.sin(t * 3) * 0.2;
            }
        }
    });

    return (
        <group ref={groupRef}>
            <mesh ref={bodyRef} position={[0, 0.2, 0]}>
                <boxGeometry args={[0.15, 0.15, 0.3]} />
                <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.2} emissive="#020617" />
            </mesh>
            
            <group ref={headRef} position={[0, 0.3, 0.15]}>
                <mesh>
                    <boxGeometry args={[0.12, 0.12, 0.12]} />
                    <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.2} />
                </mesh>
                <mesh position={[-0.04, 0.08, 0]}>
                    <coneGeometry args={[0.03, 0.06, 4]} />
                    <meshStandardMaterial color="#0f172a" />
                </mesh>
                <mesh position={[0.04, 0.08, 0]}>
                    <coneGeometry args={[0.03, 0.06, 4]} />
                    <meshStandardMaterial color="#0f172a" />
                </mesh>
                <mesh position={[-0.03, 0.02, 0.06]}>
                    <planeGeometry args={[0.02, 0.02]} />
                    <meshBasicMaterial color="#22d3ee" />
                </mesh>
                <mesh position={[0.03, 0.02, 0.06]}>
                    <planeGeometry args={[0.02, 0.02]} />
                    <meshBasicMaterial color="#22d3ee" />
                </mesh>
            </group>
            
            <group position={[0, 0.25, -0.15]} ref={tailRef}>
                 <mesh position={[0, 0, -0.08]}>
                    <boxGeometry args={[0.03, 0.03, 0.16]} />
                    <meshStandardMaterial color="#0f172a" />
                </mesh>
            </group>

            <mesh ref={legFL} position={[-0.05, 0.1, 0.1]}>
                <boxGeometry args={[0.04, 0.2, 0.04]} />
                <meshStandardMaterial color="#0f172a" />
            </mesh>
            <mesh ref={legFR} position={[0.05, 0.1, 0.1]}>
                <boxGeometry args={[0.04, 0.2, 0.04]} />
                <meshStandardMaterial color="#0f172a" />
            </mesh>
            <mesh ref={legBL} position={[-0.05, 0.1, -0.1]}>
                <boxGeometry args={[0.04, 0.2, 0.04]} />
                <meshStandardMaterial color="#0f172a" />
            </mesh>
            <mesh ref={legBR} position={[0.05, 0.1, -0.1]}>
                <boxGeometry args={[0.04, 0.2, 0.04]} />
                <meshStandardMaterial color="#0f172a" />
            </mesh>
            
            {meowText && (
                <Html position={[0, 0.5, 0]} center zIndexRange={[100, 0]}>
                    <div className="text-cyan-400 text-[10px] font-black italic tracking-widest pointer-events-none drop-shadow-[0_0_5px_#22d3ee] animate-in slide-in-from-bottom-2 fade-in zoom-in duration-200">
                        {meowText}
                    </div>
                </Html>
            )}
        </group>
    );
}

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [ammo, setAmmo] = useState(30);
  const [isWeaponEquipped, setIsWeaponEquipped] = useState(true);
  const [isReloading, setIsReloading] = useState(false);
  const [targets, setTargets] = useState<TargetData[]>([
    { id: 'TARGET_ALPHA', position: new THREE.Vector3(-6, 3, -4), health: 100, maxHealth: 100, offset: 0 },
    { id: 'TARGET_BETA', position: new THREE.Vector3(6, 4, -6), health: 100, maxHealth: 100, offset: 2.5 },
    { id: 'TARGET_GAMMA', position: new THREE.Vector3(0, 5, -8), health: 100, maxHealth: 100, offset: 5 },
  ]);
  
  const lastFireTime = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);

  const handleFire = (hitId?: string) => {
    const now = Date.now();
    if (now - lastFireTime.current > 100 && ammo > 0 && !isReloading) {
      setAmmo(prev => prev - 1);
      lastFireTime.current = now;
      
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      playShotSound(audioCtx.current);

      if (hitId) {
        playHitSound(audioCtx.current);
        setTargets(prev => prev.map(t => {
          if (t.id === hitId) {
            const newHealth = Math.max(0, t.health - 20);
            return { ...t, health: newHealth };
          }
          return t;
        }).filter(t => t.health > 0));

        // Respawn check
        if (targets.filter(t => (t.id === hitId ? t.health - 20 : t.health) > 0).length === 0) {
          setTimeout(() => {
            setTargets([
              { id: 'TARGET_A_' + now, position: new THREE.Vector3(-6, 3, -4), health: 100, maxHealth: 100, offset: Math.random() * 10 },
              { id: 'TARGET_B_' + now, position: new THREE.Vector3(6, 4, -6), health: 100, maxHealth: 100, offset: Math.random() * 10 },
              { id: 'TARGET_C_' + now, position: new THREE.Vector3(0, 5, -8), health: 100, maxHealth: 100, offset: Math.random() * 10 },
            ]);
          }, 1500);
        }
      }
    }
  };

  const handleReload = () => {
    if (ammo < 30 && !isReloading) {
      setIsReloading(true);
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      playReloadSound(audioCtx.current);
      setTimeout(() => {
        setAmmo(30);
        setIsReloading(false);
      }, 1000);
    }
  };

  return (
    <div className="w-full h-full relative font-mono overflow-hidden bg-[#020617] text-slate-300">
      {/* Aiming Reticle */}
      {isStarted && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="w-4 h-4 border-2 border-cyan-500/50 rounded-full flex items-center justify-center">
            <div className="w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" />
          </div>
        </div>
      )}

      {/* SUBTITLES UI */}
      {isStarted && <HUDSubtitles />}

      {/* AMMO HUD */}
      {isStarted && (
        <div className="absolute bottom-12 right-12 z-20 pointer-events-none text-right">
          <div className="bg-black/60 backdrop-blur-md p-6 border-l-2 border-cyan-500 rounded-sm shadow-2xl">
            <div className="text-[10px] text-cyan-500 mb-1 uppercase tracking-widest font-black">Tactical_Systems // SMG-X</div>
            <div className="flex items-baseline justify-end gap-2">
              <span className={`text-6xl font-light ${ammo <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {ammo.toString().padStart(2, '0')}
              </span>
              <span className="text-slate-600 text-2xl">/ 30</span>
            </div>
            {isReloading && <div className="mt-2 text-[10px] text-cyan-400 animate-pulse uppercase tracking-[0.4em] font-bold">RELOADING</div>}
          </div>
        </div>
      )}

      {!isStarted ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#020617]/95 cursor-pointer" onClick={() => setIsStarted(true)}>
          <div className="p-16 border border-white/10 bg-white/5 backdrop-blur-lg rounded text-center">
            <h1 className="text-5xl font-extralight text-white mb-6 tracking-tighter uppercase italic">VOID_ELIMINATOR</h1>
            <p className="text-slate-400 text-sm mb-10 max-w-sm mx-auto">Neural combat system ready. WASD to maneuver, M1 to engage, R to recycle magazine.</p>
            <div className="text-cyan-400 text-xs tracking-[0.5em] animate-pulse uppercase font-black">[ INTEGRATE ]</div>
          </div>
        </div>
      ) : (
        !isLocked && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer" onClick={() => setIsLocked(true)}>
                <div className="text-center">
                    <div className="text-cyan-400 text-2xl font-black italic tracking-[0.2em] mb-2 animate-pulse uppercase">RESUME_Neural_Link</div>
                    <div className="text-white/20 text-[8px] font-mono uppercase tracking-widest">[ Click to Re-Engage Signal ]</div>
                </div>
            </div>
        )
      )}

      <KeyboardControls
        map={[
          { name: 'forward', keys: ['KeyW'] },
          { name: 'backward', keys: ['KeyS'] },
          { name: 'left', keys: ['KeyA'] },
          { name: 'right', keys: ['KeyD'] },
          { name: 'reload', keys: ['KeyR'] },
          { name: 'interact', keys: ['KeyE'] },
          { name: 'jump', keys: ['Space'] },
          { name: 'crouch', keys: ['KeyC', 'ControlLeft'] },
        ]}
      >
        <AmbientVoidSound active={isStarted} />
        <Canvas camera={{ position: [0, 1.7, 5], fov: 75 }} shadows>
          <EffectComposer disableNormalPass>
            <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.5} luminanceSmoothing={0.9} />
            <ToneMapping mode={THREE.ACESFilmicToneMapping} />
          </EffectComposer>
          <Environment targets={targets} />
          <LaserProjectiles />
          {isStarted && <VirtualCat audioCtx={audioCtx} />}
          {isStarted && (
            <>
              {isLocked && <PointerLockControls onUnlock={() => setIsLocked(false)} />}
              <Player targets={targets} onFire={handleFire} ammo={ammo} isReloading={isReloading} isWeaponEquipped={isWeaponEquipped} />
              <InputHandler onReload={handleReload} onToggleWeapon={setIsWeaponEquipped} />
            </>
          )}
        </Canvas>
      </KeyboardControls>
    </div>
  );
}

function InputHandler({ onReload, onToggleWeapon }: { onReload: () => void, onToggleWeapon: (equipped: boolean) => void }) {
  const [, getKeys] = useKeyboardControls();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'h' || e.key === 'H') onToggleWeapon(false);
        if (e.key === '1') onToggleWeapon(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleWeapon]);

  useFrame(() => { 
    if (getKeys().reload) onReload(); 
  });
  return null;
}
