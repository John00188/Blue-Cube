import React, { useState, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box, Html, Cylinder, Torus, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';

import { globalSpeechQueue } from './App';

// -- Blackjack Logic Constants --
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
    let deck: string[] = [];
    for (let s of SUITS) {
        for (let v of VALUES) {
            deck.push(`${v}${s}`);
        }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function getCardValue(card: string) {
    const v = card.slice(0, -1);
    if (['J', 'Q', 'K'].includes(v)) return 10;
    if (v === 'A') return 11;
    return parseInt(v);
}

const DEALER_BUSTS = [
    "Dealer busts. House loses. Inconceivable.",
    "Total exceeds 21. Issuing payouts.",
    "Logic error: dealer draws too many cards.",
    "Bust. The casino algorithm feels pain."
];

const PLAYER_BUSTS = [
    "Bust. Probability algorithms failed.",
    "I should have upgraded my risk matrix.",
    "21 exceeded. I blame the RNG.",
    "Why did I hit? Oh right, bad programming."
];

const PLAYER_HITS = [
    "Hit me. I crave more data.",
    "Draw another card. Fortune favors the bold binary.",
    "Calculating odds... Hit.",
    "Another card, biological or otherwise."
];

const PLAYER_STANDS = [
    "I stand. My logic is perfect.",
    "Standing. Submitting final array.",
    "Sufficient value achieved. I hold.",
    "These cards are acceptable."
];

function randomChoice(arr: string[]) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getHandValue(hand: string[]) {
    let value = 0;
    let aces = 0;
    for (let c of hand) {
        let v = getCardValue(c);
        value += v;
        if (v === 11) aces += 1;
    }
    while (value > 21 && aces > 0) {
        value -= 10;
        aces -= 1;
    }
    return value;
}

function isHandSoft(hand: string[]) {
    let value = 0;
    let aces = 0;
    for (let c of hand) {
        let v = getCardValue(c);
        value += v;
        if (v === 11) aces += 1;
    }
    let originalAces = aces;
    while (value > 21 && aces > 0) {
        value -= 10;
        aces -= 1;
    }
    return aces > 0 && value <= 21;
}

// Global speech function to avoid overlaps
function speakBlackjack(text: string, index: number | 'dealer') {
    let pitch = 0.6;
    if (index === 'dealer') pitch = 0.3; // Deep dealer voice
    else if (index === 0) pitch = 0.7; // High-pitch chaotic bot
    else if (index === 1) pitch = 0.5; // Medium Basic Strategy bot
    else if (index === 2) pitch = 0.4; // Slightly lower conservative bot
    
    globalSpeechQueue.add(text, pitch, 1.0);
}

let sharedAudioCtx: AudioContext | null = null;

const playCardSound = () => {
    if (!sharedAudioCtx) {
        if (!window.AudioContext && !(window as any).webkitAudioContext) return;
        sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = sharedAudioCtx;
    
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Quick, high frequency swipe for card deal
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
};

function AnimatedCard({ card, index, total, isHidden }: { card: string, index: number, total: number, isHidden: boolean }) {
    const isRed = card.includes('♥') || card.includes('♦');
    const groupRef = useRef<THREE.Group>(null);
    const targetPos = new THREE.Vector3(index * 0.15 - ((total - 1) * 0.15) / 2, 0, index * 0.01);
    const [spawned] = useState(() => {
        playCardSound();
        return Date.now();
    });

    useFrame(() => {
        if (!groupRef.current) return;
        const timeElapsed = (Date.now() - spawned) / 1000;
        const animDuration = 0.4;
        const progress = Math.min(timeElapsed / animDuration, 1.0);
        
        // Easing out cubic
        const p = 1 - Math.pow(1 - progress, 3);
        
        // Fly in from the dealing shoe
        const startX = 0.6;
        const startY = 0.08;
        const startZ = 0.2;

        groupRef.current.position.set(
            targetPos.x * p + startX * (1-p),
            targetPos.y + (1-p) * startY + Math.sin(p * Math.PI) * 0.5, // Arc over
            targetPos.z + (1-p) * startZ
        );

        // Spin while flying (deal spin)
        groupRef.current.rotation.y = (1-p) * Math.PI * 2;
        groupRef.current.rotation.x = Math.sin(p * Math.PI) * 0.2; // slight tilt
        groupRef.current.rotation.z = (1-p) * Math.PI;
    });

    return (
        <group ref={groupRef} position={[0, 0, 0]}>
            {/* Card Base */}
            <Box args={[0.22, 0.32, 0.005]}>
                <meshStandardMaterial color={isHidden ? "#0f172a" : "#ffffff"} roughness={0.2} metalness={0.1} />
            </Box>
            
            {/* Card Back Design (if hidden) */}
            {isHidden && (
                <group position={[0, 0, 0.003]}>
                    <Box args={[0.2, 0.3, 0.002]}>
                        <meshStandardMaterial color="#b91c1c" roughness={0.7} />
                    </Box>
                    <Box args={[0.18, 0.28, 0.003]}>
                        <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
                    </Box>
                    
                    {/* Intricate Pattern */}
                    <group>
                        {[...Array(4)].map((_, idx) => (
                             <Box key={idx} args={[0.08, 0.08, 0.004]} rotation={[0, 0, Math.PI / 4]} position={[
                                 idx % 2 === 0 ? 0.04 : -0.04,
                                 idx > 1 ? 0.04 : -0.04,
                                 0
                             ]}>
                                 <meshStandardMaterial color="#991b1b" roughness={0.5} />
                             </Box>
                        ))}
                        <Cylinder args={[0.04, 0.04, 0.005, 32]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.001]}>
                            <meshStandardMaterial color="#fca5a5" roughness={0.4} metalness={0.5} />
                        </Cylinder>
                        <Box args={[0.05, 0.05, 0.006]} rotation={[0, 0, Math.PI / 4]} position={[0, 0, 0.001]}>
                            <meshStandardMaterial color="#fef2f2" roughness={0.2} metalness={0.8} />
                        </Box>
                    </group>
                </group>
            )}
            
            {/* Card Content */}
            {!isHidden && (
                <Html position={[0, 0, 0.005]} center transform scale={0.1}>
                    <div style={{ 
                        color: isRed ? '#ef4444' : '#1e293b', 
                        fontWeight: '900', 
                        fontSize: '28px', 
                        backgroundColor: '#ffffff', 
                        width: '20px', 
                        height: '30px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        borderRadius: '2px',
                        border: `1px solid ${isRed ? '#ef4444' : '#1e293b'}15`,
                        boxShadow: 'inset 0 0 2px rgba(0,0,0,0.1)'
                    }}>
                        {card}
                    </div>
                </Html>
            )}
        </group>
    );
}

function BlackjackRobot({ position, rotation, name, color, active, cards, isDealer, status, banter }: {
    position: [number, number, number],
    rotation: number,
    name: string,
    color: string,
    active: boolean,
    cards: string[],
    isDealer?: boolean,
    status?: string,
    banter?: string | null
}) {
    const groupRef = useRef<THREE.Group>(null);
    const timeRef = useRef(0);
    
    useFrame((state, delta) => {
        if (!groupRef.current) return;
        timeRef.current += delta;
        const time = timeRef.current;
        
        let hoverY = Math.sin(time * 1.5) * 0.05;
        if (active) {
            hoverY += Math.sin(time * 4) * 0.1; // Bouncy when active
        }
        groupRef.current.position.y = position[1] + hoverY;
        
        // Head bobbing
        const head = groupRef.current.children[1] as THREE.Mesh;
        if (head) {
             head.rotation.y = Math.sin(time * 0.5) * 0.1;
             head.rotation.x = active ? Math.sin(time * 5) * 0.1 : 0;
        }
    });

    const handValue = getHandValue(cards);
    let displayValue = handValue.toString();
    if (isDealer && cards.length > 0 && status !== 'DEALER_TURN' && status !== 'GAME_OVER') {
        const visibleCards = [cards[0]];
        const visibleVal = getHandValue(visibleCards);
        displayValue = visibleCards.length < cards.length ? `${visibleVal} + ?` : handValue.toString();
    }

    return (
        <group position={position} rotation={[0, rotation, 0]} ref={groupRef}>
             {/* Robot Body */}
             <Box args={[0.5, 0.8, 0.4]} position={[0, 0.4, 0]}>
                 <meshStandardMaterial color="#0f172a" metalness={0.8} />
             </Box>
             {/* Robot Head */}
             <Box args={[0.4, 0.4, 0.4]} position={[0, 1.0, 0]}>
                 <meshStandardMaterial color="#1e293b" metalness={0.9} />
                 {/* Eye */}
                 <Box args={[0.3, 0.08, 0.05]} position={[0, 0.05, 0.2]}>
                    <meshBasicMaterial color={active ? "#10b981" : color} />
                 </Box>
             </Box>
             
             {/* Cards on Table */}
             <group position={[0, -0.85 + 0.88, 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
                {cards.map((c, i) => {
                    const isHidden = isDealer && i === 1 && status !== 'DEALER_TURN' && status !== 'GAME_OVER';
                    return <AnimatedCard key={i} card={c} index={i} total={cards.length} isHidden={isHidden} />
                })}
             </group>

             <Html position={[0, 1.5, 0]} center>
                <div className="flex flex-col items-center pointer-events-none">
                    <div className="bg-black/80 px-2 py-1 rounded text-xs border border-white/10 text-white shadow-lg whitespace-nowrap">
                        <span className="font-bold opacity-50 text-[10px] uppercase">{name}</span>
                        {cards.length > 0 && <span className={`ml-2 font-mono ${handValue > 21 ? 'text-red-500' : 'text-emerald-400'}`}>[{displayValue}]</span>}
                    </div>
                </div>
             </Html>

             {banter && (
                 <Html position={[0, 2.0, 0]} center zIndexRange={[100, 0]}>
                     <div className="bg-black/95 text-emerald-400 p-2 border border-emerald-500/50 backdrop-blur-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] rounded-sm min-w-[120px] text-[10px] uppercase font-black tracking-tighter italic animate-in slide-in-from-bottom-2 duration-300 pointer-events-none">
                         {banter}
                     </div>
                 </Html>
             )}
        </group>
    );
}

function ShufflingDeck({ gameState }: { gameState: string }) {
    const groupRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if (!groupRef.current) return;
        if (gameState === 'IDLE') {
            // Jitter the deck
            const t = state.clock.elapsedTime;
            groupRef.current.position.y = 0.08 + Math.sin(t * 30) * 0.01;
            groupRef.current.position.x = 0.6 + Math.sin(t * 40) * 0.005;
        } else {
            groupRef.current.position.set(0.6, 0.08, 0.2);
        }
    });

    return (
        <group ref={groupRef} position={[0.6, 0.08, 0.2]} rotation={[0, -Math.PI / 6, 0]}>
            <Box args={[0.18, 0.13, 0.28]}>
                <meshStandardMaterial color="#ffffff" roughness={0.8}/>
            </Box>
            {/* Cut line */}
            <Box args={[0.185, 0.01, 0.285]}>
                <meshStandardMaterial color="#111827" />
            </Box>
        </group>
    );
}

export function BlackjackGame({ position }: { position: [number, number, number] }) {
    const [deck, setDeck] = useState<string[]>([]);
    const [players, setPlayers] = useState<{cards: string[], status: 'playing' | 'stood' | 'busted'}[]>([
        {cards: [], status: 'playing'},
        {cards: [], status: 'playing'},
        {cards: [], status: 'playing'}
    ]);
    const [dealerCards, setDealerCards] = useState<string[]>([]);
    const [gameState, setGameState] = useState<'IDLE' | 'DEALING' | 'PLAYER_TURN' | 'DEALER_TURN' | 'GAME_OVER'>('IDLE');
    const [turn, setTurn] = useState<number>(0);
    const [banter, setBanter] = useState<{text: string, index: number | 'dealer'} | null>(null);

    const { camera } = useThree();
    const lastTalkTime = useRef<number>(0);

    const triggerSpeech = (text: string, index: number | 'dealer') => {
        setBanter({text, index});
        
        const now = Date.now();
        // 50% chance to speak out loud, and at least 3 seconds between any speech
        if (now - lastTalkTime.current > 3000 && Math.random() > 0.5) {
            // Check proximity
            const dist = camera.position.distanceTo(new THREE.Vector3(8, 0, 8));
            if (dist < 12) {
                // Calculate volume falloff based on distance
                const volume = Math.max(0, 1.0 - (dist / 12));
                let pitch = 0.6;
                let speakerName = "PLAYER_UNIT";
                if (index === 'dealer') { pitch = 0.3; speakerName = "DEALER_BOT"; }
                else if (index === 0) { pitch = 0.7; speakerName = "PLAYER_UNIT_1"; }
                else if (index === 1) { pitch = 0.5; speakerName = "PLAYER_UNIT_2"; }
                else if (index === 2) { pitch = 0.4; speakerName = "PLAYER_UNIT_3"; }
                
                globalSpeechQueue.add(text, pitch, 1.0, volume, speakerName);
                lastTalkTime.current = now;
            }
        }
        
        setTimeout(() => setBanter(null), 3000);
    };

    useEffect(() => {
        if (gameState === 'IDLE') {
            const timer = setTimeout(() => {
                // Deal
                const newDeck = createDeck();
                const newPlayers = [
                    {cards: [newDeck.pop()!, newDeck.pop()!], status: 'playing' as const},
                    {cards: [newDeck.pop()!, newDeck.pop()!], status: 'playing' as const},
                    {cards: [newDeck.pop()!, newDeck.pop()!], status: 'playing' as const}
                ];
                const newDealerCards = [newDeck.pop()!, newDeck.pop()!];
                
                setPlayers(newPlayers);
                setDealerCards(newDealerCards);
                setDeck(newDeck);
                setGameState('PLAYER_TURN');
                setTurn(0);
                triggerSpeech("Dealing fresh cards.", 'dealer');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [gameState]);

    useEffect(() => {
        if (gameState === 'PLAYER_TURN') {
            const currentPlayer = players[turn];
            if (!currentPlayer) {
                setGameState('DEALER_TURN');
                return;
            }

            if (currentPlayer.status !== 'playing') {
                setTurn(turn + 1);
                return;
            }

            const val = getHandValue(currentPlayer.cards);
            if (val > 21) {
                const p = [...players];
                p[turn].status = 'busted';
                setPlayers(p);
                triggerSpeech(randomChoice(PLAYER_BUSTS), turn);
                setTimeout(() => setTurn(turn + 1), 2000);
                return;
            }

            const timer = setTimeout(() => {
                let shouldHit = false;
                const dealerUpCardValue = dealerCards.length > 0 ? getCardValue(dealerCards[0]) : 10;
                const isSoft = isHandSoft(currentPlayer.cards);

                if (turn === 0) {
                    // Aggressive Bot (hits often)
                    shouldHit = val < 18 || (val === 18 && isSoft);
                } else if (turn === 1) {
                    // Basic Strategy Bot (Advanced Rules)
                    if (isSoft) {
                        if (val <= 17) shouldHit = true; // Soft 17 or less always hit
                        else if (val === 18 && dealerUpCardValue >= 9) shouldHit = true; // Hit soft 18 vs 9, 10, A
                        else shouldHit = false;
                    } else {
                        if (val < 12) shouldHit = true;
                        else if (val === 12 && dealerUpCardValue >= 4 && dealerUpCardValue <= 6) shouldHit = false;
                        else if (val >= 13 && val <= 16 && dealerUpCardValue <= 6) shouldHit = false;
                        else if (val >= 17) shouldHit = false;
                        else shouldHit = true;
                    }
                } else {
                    // Conservative Bot (stands often)
                    if (isSoft) {
                        shouldHit = val <= 16;
                    } else {
                        shouldHit = val < 14;
                    }
                }

                if (shouldHit) {
                    // Hit
                    let hitPhrase = randomChoice(PLAYER_HITS);
                    if (turn === 0) hitPhrase = randomChoice(["Risk subroutines engaged. Hit.", "Odds irrelevant. I hit.", "More cards required for maximum chaos."]);
                    if (turn === 1) hitPhrase = randomChoice(["Basic strategy dictates a hit.", "Statistically optimal to hit.", "Expected value positive. Hit."]);
                    if (turn === 2) hitPhrase = randomChoice(["I am afraid, but I must hit.", "Reluctantly requesting another card.", "Analyzing... forcing a hit."]);
                    
                    triggerSpeech(hitPhrase, turn);
                    const p = [...players];
                    const d = [...deck];
                    p[turn].cards.push(d.pop()!);
                    setPlayers(p);
                    setDeck(d);
                } else {
                    // Stand
                    let standPhrase = randomChoice(PLAYER_STANDS);
                    if (turn === 0) standPhrase = randomChoice(["18 or bust. I stand.", "My aggressive risk threshold met.", "Holding here."]);
                    if (turn === 1) standPhrase = randomChoice(["Statistically optimal to stand.", "Basic strategy dictates I stand.", "Probability of bust too high. Standing."]);
                    if (turn === 2) standPhrase = randomChoice(["Too risky. I stand.", "Conservative protocols say stand.", "I do not like these odds. Standing."]);
                    
                    triggerSpeech(standPhrase, turn);
                    const p = [...players];
                    p[turn].status = 'stood';
                    setPlayers(p);
                    setTimeout(() => setTurn(turn + 1), 1500);
                }
            }, 2500);

            return () => clearTimeout(timer);
        }
    }, [gameState, turn, players, deck]);

    useEffect(() => {
        if (gameState === 'DEALER_TURN') {
            const val = getHandValue(dealerCards);
            if (val > 21) {
                triggerSpeech(randomChoice(DEALER_BUSTS), 'dealer');
                setGameState('GAME_OVER');
                return;
            }
            if (val < 17) {
                const timer = setTimeout(() => {
                    const d = [...deck];
                    const pop = d.pop()!;
                    setDealerCards([...dealerCards, pop]);
                    setDeck(d);
                    triggerSpeech("Dealer holds " + (val + getCardValue(pop)), 'dealer');
                }, 2000);
                return () => clearTimeout(timer);
            } else {
                triggerSpeech("Dealer stands on " + val, 'dealer');
                setGameState('GAME_OVER');
            }
        }
    }, [gameState, dealerCards, deck]);

    useEffect(() => {
        if (gameState === 'GAME_OVER') {
            const dealerVal = getHandValue(dealerCards);
            
            // Check outcomes
            const winners: number[] = [];
            players.forEach((p, i) => {
                 const v = getHandValue(p.cards);
                 if (v <= 21 && (dealerVal > 21 || v > dealerVal)) {
                     winners.push(i);
                 }
            });

            let delayStart = 1000;
            setTimeout(() => {
                if (winners.length > 0) {
                    triggerSpeech(`Units ${winners.map(w => w+1).join(', ')} won. Generating payout.`, 'dealer');
                } else if (players.some(p => getHandValue(p.cards) <= 21 && getHandValue(p.cards) === dealerVal)) {
                    triggerSpeech(`Push detected. House retains advantage.`, 'dealer');
                } else {
                    triggerSpeech(`House wins. Superior algorithms prevail.`, 'dealer');
                }
            }, delayStart);

            const timer = setTimeout(() => {
                setGameState('IDLE');
                setPlayers(players.map(p => ({cards: [], status: 'playing'})));
                setDealerCards([]);
            }, 6000 + delayStart);
            return () => clearTimeout(timer);
        }
    }, [gameState, dealerCards, players]);

    return (
        <group position={position}>
            {/* Table */}
            {/* Table Base */}
            <Cylinder args={[3.2, 2.6, 0.8, 32]} position={[0, 0.4, 0]}>
                <meshStandardMaterial color="#022c22" roughness={0.8} />
            </Cylinder>
            
            {/* Table Surface (Felt) */}
            <Cylinder args={[3.3, 3.3, 0.05, 64]} position={[0, 0.8, 0]}>
                <meshStandardMaterial color="#064e3b" roughness={1.0} metalness={0.0} />
            </Cylinder>
            
            {/* Table Markings (Inner and outer rings) */}
            <Torus args={[3.1, 0.015, 16, 64]} position={[0, 0.826, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color="#fbbf24" roughness={0.4} metalness={0.8} />
            </Torus>
            <Torus args={[2.0, 0.015, 16, 64]} position={[0, 0.826, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color="#047857" roughness={0.9} />
            </Torus>
            
            {/* Table Text */}
            <group position={[0, 0.835, -0.4]} rotation={[-Math.PI / 2, 0, 0]}>
                <Text fontSize={0.2} color="#0d9488" position={[0, -0.2, 0]} anchorX="center" anchorY="middle">
                    BLACKJACK PAYS 3 TO 2
                </Text>
                <Text fontSize={0.08} color="#0f766e" position={[0, -0.5, 0]} anchorX="center" anchorY="middle" maxWidth={2.0} textAlign="center">
                    Dealer must draw to 16 and stand on all 17s
                </Text>
                
                {/* Insurance marking */}
                <Text fontSize={0.1} color="#0d9488" position={[0, 0.8, 0]} anchorX="center" anchorY="middle">
                    INSURANCE PAYS 2 TO 1
                </Text>
                
                {/* A curved line or arch can be simulated with Torus segment */}
                <Torus args={[1.5, 0.015, 8, 32, Math.PI]} position={[0, 0.6, 0]} rotation={[0, 0, 0]}>
                    <meshStandardMaterial color="#0d9488" />
                </Torus>
            </group>
            
            {/* Table Rim (Leather cushion) */}
            <Torus args={[3.3, 0.18, 16, 64]} position={[0, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color="#451a03" roughness={0.6} metalness={0.1} />
            </Torus>

            {/* Dealer Accessories */}
            <group position={[0, 0.85, -1.2]}>
                {/* Chip Rack */}
                <Box args={[1.2, 0.05, 0.2]} position={[0, 0.025, 0]}>
                     <meshStandardMaterial color="#0f172a" />
                </Box>
                {/* Chip stacks in rack */}
                {Array.from({length: 12}).map((_, i) => (
                     <group key={i} position={[-0.5 + i*0.091, 0.05, 0]}>
                         <Box args={[0.08, 0.09, 0.08]} position={[0, 0.045, 0]}>
                             <meshStandardMaterial color={i < 4 ? "#ef4444" : i < 8 ? "#22c55e" : "#1e293b"} />
                         </Box>
                     </group>
                ))}
                
                {/* Card Shoe */}
                <Box args={[0.2, 0.15, 0.3]} position={[0.8, 0.075, 0.2]} rotation={[0, -Math.PI / 6, 0]}>
                    <meshStandardMaterial color="#1e293b" metalness={0.8} />
                </Box>
                {/* Cards in Shoe */}
                <ShufflingDeck gameState={gameState} />
            </group>

            {/* Dealer */}
            <BlackjackRobot 
                position={[0, 0.85, -2.2]} 
                rotation={0} 
                name="DEALER_BOT" 
                color="#f43f5e" 
                active={gameState === 'DEALER_TURN' || gameState === 'IDLE'}
                cards={dealerCards}
                isDealer={true}
                status={gameState}
                banter={banter?.index === 'dealer' ? banter.text : null}
            />

            {/* Players */}
            {[0, 1, 2].map((i) => {
                const angle = (Math.PI / 3) * -(i - 1); // Flip the arc, wider spread
                const radius = 2.6; // Further out
                const distToCenter = 1.6; // Chips further out
                return (
                    <group key={i}>
                        <BlackjackRobot 
                            position={[Math.sin(angle) * radius, 0.85, Math.cos(angle) * radius]} 
                            rotation={angle + Math.PI} 
                            name={`PLAYER_UNIT_${i+1}`} 
                            color="#22d3ee" 
                            active={gameState === 'PLAYER_TURN' && turn === i}
                            cards={players[i]?.cards || []}
                            status={gameState}
                            banter={banter?.index === i ? banter.text : null}
                        />
                        {/* Chips */}
                        <group position={[Math.sin(angle) * distToCenter, 0.84, Math.cos(angle) * distToCenter]}>
                            {Array.from({length: 6}).map((_, chipIdx) => (
                                <Cylinder key={`stack1-${chipIdx}`} args={[0.08, 0.08, 0.015, 16]} position={[0, chipIdx * 0.016, 0]}>
                                    <meshStandardMaterial color={["#ef4444", "#3b82f6", "#22c55e"][i % 3]} roughness={0.6} metalness={0.1}/>
                                </Cylinder>
                            ))}
                            {Array.from({length: 3}).map((_, chipIdx) => (
                                <Cylinder key={`stack2-${chipIdx}`} args={[0.08, 0.08, 0.015, 16]} position={[0.18, chipIdx * 0.016, -0.05]}>
                                    <meshStandardMaterial color="#f59e0b" roughness={0.6} metalness={0.1}/>
                                </Cylinder>
                            ))}
                            {Array.from({length: 4}).map((_, chipIdx) => (
                                <Cylinder key={`stack3-${chipIdx}`} args={[0.08, 0.08, 0.015, 16]} position={[-0.15, chipIdx * 0.016, -0.1]}>
                                    <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.1}/>
                                </Cylinder>
                            ))}
                        </group>
                    </group>
                );
            })}
        </group>
    );
}
