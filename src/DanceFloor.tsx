import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box, Cylinder, Sphere, Html, Torus, SpotLight } from '@react-three/drei';
import * as THREE from 'three';
import { playRobotSpeech } from './App';

const FEMALE_CHATS = [
  "This unit's groove inhibitors are fully disabled.",
  "Your chassis looks stunning in this lighting.",
  "Let me recalibrate my hip servos.",
  "Does my hair module look okay?",
  "I'm running on purely synthetic endorphins right now.",
  "Oh look, the bartender is buffering.",
  "Care to join this dance protocol?",
  "Pour me another coolant, please.",
  "Did you catch the new binary mix by DJ Quantum?",
  "My vocal synth is a bit hoarse from baseline shouting."
];

const BARTENDER_CHATS = [
  "What's your preferred syntax?",
  "I've got high-octane plasma on tap.",
  "Keep your drinks off the motherboard.",
  "Rough cycle? Have a logic-bomb on the house.",
  "Are you over clocking again?"
];

function speakChatter(text: string, pitch: number, cameraPos: THREE.Vector3, sourcePos: THREE.Vector3, name: string = "DANCER_BOT") {
   const dist = cameraPos.distanceTo(sourcePos);
   if (dist < 10) {
       const volume = Math.max(0, 1.0 - (dist / 10));
       playRobotSpeech(text, pitch, volume, name);
   }
}

// Female Robot Dancer
function DancerBot({ position, color, hairColor, delayOffset, targetBarPos }: { position: [number, number, number], color: string, hairColor: string, delayOffset: number, targetBarPos?: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const lArmRef = useRef<THREE.Mesh>(null);
  const rArmRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  
  const [mode, setMode] = useState<'DANCING' | 'SITTING'>('DANCING');
  const [chat, setChat] = useState<string | null>(null);
  const lastTalkTime = useRef(Date.now() + Math.random() * 10000);
  const originalPos = useMemo(() => new THREE.Vector3(...position), [position]);
  const barTarget = useMemo(() => targetBarPos ? new THREE.Vector3(...targetBarPos) : originalPos.clone().add(new THREE.Vector3(3, 0, 0)), [targetBarPos, originalPos]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime + delayOffset;

    // AI state logic
    const cycle = Math.sin(t * 0.1); 
    // Dances for a while, sits for a while
    const newMode = cycle > -0.2 ? 'DANCING' : 'SITTING';
    if (newMode !== mode) {
        setMode(newMode);
    }

    if (mode === 'DANCING') {
      groupRef.current.position.lerp(originalPos, 0.05);
      groupRef.current.position.y = originalPos.y + Math.abs(Math.sin(t * 8)) * 0.4;
      groupRef.current.rotation.y = Math.sin(t * 4) * 0.8 + t; // spinning and swaying
      
      if (lArmRef.current) lArmRef.current.rotation.x = Math.sin(t * 12 + 1) * 2.0;
      if (rArmRef.current) rArmRef.current.rotation.x = Math.sin(t * 12 + 2) * -2.0;
      if (lArmRef.current) lArmRef.current.rotation.z = Math.sin(t * 8) * 0.5;
      if (rArmRef.current) rArmRef.current.rotation.z = -Math.sin(t * 8) * 0.5;
      
      if (headRef.current) {
          headRef.current.rotation.z = Math.sin(t * 12) * 0.4;
          headRef.current.rotation.x = Math.sin(t * 6) * 0.3;
      }
    } else {
      // Sitting at the bar
      groupRef.current.position.lerp(barTarget, 0.05);
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, barTarget.y + 0.5, 0.1); // sitting height
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, Math.PI / -2, 0.1);
      
      if (lArmRef.current) lArmRef.current.rotation.x = THREE.MathUtils.lerp(lArmRef.current.rotation.x, 0.3, 0.1);
      if (rArmRef.current) rArmRef.current.rotation.x = THREE.MathUtils.lerp(rArmRef.current.rotation.x, 0.3, 0.1);
      if (headRef.current) {
          headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, Math.sin(t) * 0.1, 0.1);
          headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0, 0.1);
      }
    }

    // Chatter logic
    const now = Date.now();
    if (now - lastTalkTime.current > 15000) {
        if (Math.random() > 0.6) {
            const worldPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(worldPos);
            const dist = camera.position.distanceTo(worldPos);
            
            if (dist < 10) {
                const phrase = FEMALE_CHATS[Math.floor(Math.random() * FEMALE_CHATS.length)];
                setChat(phrase);
                speakChatter(phrase, 1.2 + (Math.random() * 0.4), camera.position, worldPos, "DANCER_BOT");
                setTimeout(() => setChat(null), 4000);
            }
        }
        lastTalkTime.current = now + Math.random() * 10000;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <Box args={[0.5, 0.8, 0.3]} position={[0, 0.4, 0]}>
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} emissive={color} emissiveIntensity={0.2} />
      </Box>
      <Box args={[0.6, 0.4, 0.4]} position={[0, 0.8, 0]}>
        <meshStandardMaterial color="#fff" metalness={0.8} roughness={0.1} />
      </Box>

      {/* Head & Hair/Makeup */}
      <group ref={headRef} position={[0, 1.2, 0]}>
        <Sphere args={[0.25, 16, 16]}>
          <meshStandardMaterial color="#fcd34d" metalness={0.4} roughness={0.5} />
        </Sphere>
        {/* Glowing Eyes / Makeup */}
        <Box args={[0.15, 0.05, 0.05]} position={[0.1, 0.05, 0.22]}>
          <meshBasicMaterial color="#ec4899" />
        </Box>
        <Box args={[0.15, 0.05, 0.05]} position={[-0.1, 0.05, 0.22]}>
          <meshBasicMaterial color="#ec4899" />
        </Box>
        {/* Cyber Hair */}
        <Box args={[0.55, 0.2, 0.5]} position={[0, 0.25, -0.1]}>
          <meshStandardMaterial color={hairColor} emissive={hairColor} emissiveIntensity={0.3} metalness={1} roughness={0.1} />
        </Box>
        <Box args={[0.2, 0.6, 0.3]} position={[0.25, -0.1, -0.1]} rotation={[0, 0, -0.2]}>
          <meshStandardMaterial color={hairColor} metalness={1} />
        </Box>
        <Box args={[0.2, 0.6, 0.3]} position={[-0.25, -0.1, -0.1]} rotation={[0, 0, 0.2]}>
          <meshStandardMaterial color={hairColor} metalness={1} />
        </Box>
      </group>

      {/* Arms */}
      <mesh ref={lArmRef} position={[-0.4, 0.8, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color={color} metalness={1} />
      </mesh>
      <mesh ref={rArmRef} position={[0.4, 0.8, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color={color} metalness={1} />
      </mesh>

      {chat && (
          <Html position={[0, 1.6, 0]} center zIndexRange={[100, 0]}>
            <div className="bg-pink-900/90 text-pink-200 px-2 py-1 border border-pink-500/50 backdrop-blur-md rounded-lg text-xs whitespace-nowrap pointer-events-none animate-in fade-in zoom-in string">
              {chat}
            </div>
          </Html>
      )}
    </group>
  );
}

// Bartender Robot
function BartenderBot({ position, rotation = [0, 0, 0] }: { position: [number, number, number], rotation?: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const lArmRef = useRef<THREE.Mesh>(null);
  const rArmRef = useRef<THREE.Mesh>(null);
  const drinkRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [chat, setChat] = useState<string | null>(null);
  const lastTalkTime = useRef(Date.now() + 5000);

  const [isMixing, setIsMixing] = useState(false);
  const lastCustomerState = useRef(false);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    
    // Check if anyone is at the bar based on the same sine cycle used for dancers
    const isCustomerWaiting = Math.sin(t * 0.1) <= -0.2 || 
                              Math.sin((t + Math.PI / 2) * 0.1) <= -0.2 || 
                              Math.sin((t + Math.PI) * 0.1) <= -0.2;
    
    if (isCustomerWaiting && !lastCustomerState.current) {
        setIsMixing(true);
        setTimeout(() => setIsMixing(false), 3500); // 3.5s mixing routine
    }
    lastCustomerState.current = isCustomerWaiting;

    // Movement logic
    if (isMixing) {
        // Frantic mixing animation
        groupRef.current.position.z = position[2] + Math.sin(t * 8) * 0.1;
        if (headRef.current) {
            headRef.current.rotation.y = Math.sin(t * 10) * 0.2;
            headRef.current.rotation.x = Math.sin(t * 5) * 0.1;
        }
        
        // Crazy flair bartending
        const flair = t * 15;
        if (lArmRef.current) {
            lArmRef.current.rotation.x = Math.PI / -1.5 + Math.sin(flair) * 0.5;
            lArmRef.current.rotation.z = Math.cos(flair) * 0.5;
        }
        if (rArmRef.current) {
            rArmRef.current.rotation.x = Math.PI / -1.5 + Math.sin(flair + Math.PI) * 0.5;
            rArmRef.current.rotation.z = -Math.cos(flair) * 0.5;
        }
        if (drinkRef.current) {
            drinkRef.current.visible = true;
            // Throwing shaker back and forth
            drinkRef.current.position.x = Math.sin(flair) * 0.6;
            drinkRef.current.position.y = 0.8 + Math.abs(Math.cos(flair)) * 0.5;
            drinkRef.current.rotation.z = flair;
            const mixIntensity = Math.abs(Math.sin(t * 5));
            (drinkRef.current.children[0] as THREE.Mesh).material = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(mixIntensity, 1, 0.5),
                emissive: new THREE.Color().setHSL(mixIntensity, 1, 0.5),
                emissiveIntensity: 1.5,
                transparent: true,
                opacity: 0.9
            });
        }
    } else {
        // Busy working movements (slide along Z behind bar)
        groupRef.current.position.z = position[2] + Math.sin(t * 1.5) * 1.5;
        if (headRef.current) {
            headRef.current.rotation.y = Math.sin(t * 2) * 0.3;
        }
        if (lArmRef.current) {
            lArmRef.current.rotation.x = Math.sin(t * 3) * 0.2;
            lArmRef.current.rotation.z = 0;
        }
        if (rArmRef.current) {
             rArmRef.current.rotation.x = Math.sin(t * 3 + Math.PI) * 0.2; 
             rArmRef.current.rotation.z = 0;
        }
        if (drinkRef.current) {
             drinkRef.current.visible = false;
        }
    }

    const now = Date.now();
    if (now - lastTalkTime.current > 12000) {
        if (Math.random() > 0.6) {
            const worldPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(worldPos);
            const dist = camera.position.distanceTo(worldPos);
            
            if (dist < 12) {
                const phrase = BARTENDER_CHATS[Math.floor(Math.random() * BARTENDER_CHATS.length)];
                setChat(phrase);
                speakChatter(phrase, 0.8, camera.position, worldPos, "BARTENDER_BOT");
                setTimeout(() => setChat(null), 4000);
            }
        }
        lastTalkTime.current = now + Math.random() * 8000;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation as any}>
      {/* Body */}
      <Box args={[0.6, 1.0, 0.4]} position={[0, 0.5, 0]}>
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.3} />
      </Box>
      <Box args={[0.3, 0.6, 0.3]} position={[0, 0.8, 0]}>
         <meshStandardMaterial color="#fff" />
      </Box>
      <mesh ref={headRef} position={[0, 1.3, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#0f172a" metalness={1} emissive="#0f172a" emissiveIntensity={0.2} />
        {/* Eye Visor */}
        <mesh position={[0, 0.05, 0.21]}>
           <boxGeometry args={[0.3, 0.1, 0.05]} />
           <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </mesh>

      {/* Arms */}
      <mesh ref={lArmRef} position={[-0.4, 0.8, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color="#94a3b8" metalness={1} />
      </mesh>
      <mesh ref={rArmRef} position={[0.4, 0.8, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color="#94a3b8" metalness={1} />
      </mesh>

      {/* Cocktail Shaker / Drink in hand */}
      <group ref={drinkRef} position={[0, 0.6, 0.3]} visible={false}>
         <Cylinder args={[0.06, 0.04, 0.2, 16]}>
            <meshStandardMaterial color="#fff" metalness={1} roughness={0.1} />
         </Cylinder>
      </group>

      {chat && (
          <Html position={[0, 1.8, 0]} center zIndexRange={[100, 0]}>
            <div className="bg-slate-900/90 text-cyan-200 px-2 py-1 border border-cyan-500/50 backdrop-blur-md rounded-lg text-xs whitespace-nowrap pointer-events-none animate-in fade-in zoom-in string">
              {chat}
            </div>
          </Html>
      )}
    </group>
  );
}

function InteractiveStool({ position, delayOffset }: { position: [number, number, number], delayOffset: number }) {
    const { camera } = useThree();
    const [hover, setHover] = useState(false);
    const groupRef = useRef<THREE.Group>(null);
    const [occupied, setOccupied] = useState(false);
    
    useFrame((state, delta) => {
        if (!groupRef.current) return;
        const dist = camera.position.distanceTo(groupRef.current.getWorldPosition(new THREE.Vector3()));
        setHover(dist < 3);

        const t = state.clock.elapsedTime + delayOffset;
        const cycle = Math.sin(t * 0.1); 
        const isOccupied = cycle <= -0.2;
        setOccupied(isOccupied);

        // Calculate bounce/offset
        const time = state.clock.elapsedTime;
        const offset = isOccupied ? Math.sin(time * 4) * 0.02 : Math.sin(time * 2) * 0.05;
        groupRef.current.position.y = position[1] + offset;
    });

    return (
        <group ref={groupRef} position={position}>
            <Cylinder args={[0.3, 0.3, 0.1, 16]}>
                <meshStandardMaterial 
                   color={occupied ? "#ef4444" : "#38bdf8"} 
                   emissive={occupied ? "#ef4444" : "#38bdf8"} 
                   emissiveIntensity={occupied ? 0.8 : 0.4} 
                />
            </Cylinder>
            
            {hover && (
                <Html position={[0, occupied ? 1.0 : 0.5, 0]} center zIndexRange={[100, 0]}>
                    <div className="bg-slate-900/90 px-3 py-1.5 rounded border border-white/20 text-[10px] font-mono text-cyan-300 pointer-events-none whitespace-nowrap animate-in fade-in zoom-in">
                        {occupied ? 
                          <span className="text-red-400">STATUS: OCCUPIED</span> : 
                          <span>STATUS: AVAILABLE<br/><span className="text-white/50">Hover to interface</span></span>
                        }
                    </div>
                </Html>
            )}
        </group>
    );
}

export function DanceFloorAndBar({ position }: { position: [number, number, number] }) {
  const floorRef = useRef<THREE.Group>(null);
  const lightsRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
     const t = state.clock.elapsedTime;
     if (floorRef.current) {
        floorRef.current.children.forEach((child, idx) => {
           if (idx > 0 && child instanceof THREE.Mesh) {
               // Dynamic grid colors
               const i = idx % 5;
               const j = Math.floor(idx / 5);
               const cycle = (Math.sin(t * 2 + i) + Math.cos(t * 1.5 + j)) * 0.5 + 0.5;
               const mat = child.material as THREE.MeshStandardMaterial;
               mat.emissiveIntensity = cycle * 0.8;
           }
        });
     }
     if (lightsRef.current) {
         lightsRef.current.children.forEach((spot, idx) => {
             if (spot.type === 'SpotLight') {
                 const angle = t * 1.5 + (idx * Math.PI / 2);
                 const sl = spot as THREE.SpotLight;
                 sl.target.position.x = Math.sin(angle) * 3;
                 sl.target.position.z = Math.cos(angle) * 3;
                 sl.target.updateMatrixWorld();
             }
         });
         lightsRef.current.rotation.y = t * 0.5;
     }
  });

  return (
    <group position={position}>
       {/* Club Spotlights / Disco Ball area */}
       <group ref={lightsRef} position={[-2, 6, 0]}>
         <spotLight position={[1, 0, 1]} angle={0.3} penumbra={0.5} color="#ec4899" intensity={10} distance={10} castShadow />
         <spotLight position={[-1, 0, 1]} angle={0.3} penumbra={0.5} color="#0ea5e9" intensity={10} distance={10} castShadow />
         <spotLight position={[1, 0, -1]} angle={0.3} penumbra={0.5} color="#8b5cf6" intensity={10} distance={10} castShadow />
         <spotLight position={[-1, 0, -1]} angle={0.3} penumbra={0.5} color="#10b981" intensity={10} distance={10} castShadow />
         
         <Sphere args={[0.3, 16, 16]} position={[0, -0.5, 0]}>
            <meshStandardMaterial color="#fff" metalness={1} roughness={0.0} emissive="#fff" emissiveIntensity={0.2} />
         </Sphere>
       </group>

       {/* 8x8 Dance Floor */}
       <group ref={floorRef} position={[-2, 0.05, 0]}>
           <Box args={[6, 0.1, 6]}>
              <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
           </Box>
           {/* Grid Lights */}
           {[...Array(5)].map((_, i) => 
               [...Array(5)].map((_, j) => (
                   <Box key={`${i}-${j}`} args={[0.9, 0.15, 0.9]} position={[-2 + i, 0, -2 + j]}>
                       <meshStandardMaterial 
                           color="white" 
                           emissive={(i+j)%2===0 ? "#a855f7" : "#0ea5e9"} 
                           emissiveIntensity={0.5} 
                       />
                   </Box>
               ))
           )}
       </group>

       {/* Dancers on the dance floor */}
       <DancerBot position={[-2, 0, -1]} color="#ec4899" hairColor="#fbcfe8" delayOffset={0} targetBarPos={[1.5, 0.6, -1.5]} />
       <DancerBot position={[-3, 0, 1]} color="#8b5cf6" hairColor="#e9d5ff" delayOffset={Math.PI / 2} targetBarPos={[1.5, 0.6, 0]} />
       <DancerBot position={[-1, 0, 1.5]} color="#14b8a6" hairColor="#ccfbf1" delayOffset={Math.PI} targetBarPos={[1.5, 0.6, 1.5]} />

       {/* Bar Area to the right */}
       <group position={[3, 0, 0]}>
           {/* Main Bar Counter */}
           <Box args={[2, 1.2, 5]} position={[0, 0.6, 0]}>
              <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.4} />
           </Box>
           <Box args={[2.2, 0.1, 5.2]} position={[0, 1.25, 0]}>
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} emissive="#475569" emissiveIntensity={0.2} />
           </Box>
           
           {/* Interactive Hover Stools */}
           <InteractiveStool position={[-1.5, 0.6, -1.5]} delayOffset={0} />
           <InteractiveStool position={[-1.5, 0.6, 0]} delayOffset={Math.PI / 2} />
           <InteractiveStool position={[-1.5, 0.6, 1.5]} delayOffset={Math.PI} />
           
           {/* Glow Drinks */}
           <Cylinder args={[0.05, 0.05, 0.2, 8]} position={[-0.5, 1.4, -1]}>
               <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1} transparent opacity={0.8} />
           </Cylinder>
           <Cylinder args={[0.05, 0.05, 0.15, 8]} position={[-0.5, 1.375, 1]}>
               <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={1} transparent opacity={0.8} />
           </Cylinder>
           <Cylinder args={[0.08, 0.04, 0.25, 8]} position={[-0.3, 1.425, 0.5]}>
               <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.8} transparent opacity={0.9} />
           </Cylinder>
           <Cylinder args={[0.04, 0.04, 0.1, 8]} position={[-0.6, 1.35, -0.2]}>
               <meshStandardMaterial color="#eab308" emissive="#eab308" emissiveIntensity={1} transparent opacity={0.8} />
           </Cylinder>
           <Box args={[0.1, 0.3, 0.1]} position={[-0.4, 1.45, -1.5]}>
               <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={0.8} transparent opacity={0.7} />
           </Box>

           {/* Bartender */}
           <BartenderBot position={[1.5, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
       </group>
    </group>
  );
}
