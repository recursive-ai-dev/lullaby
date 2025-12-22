import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * NIGHT SKY - Living Wilderness Edition
 * Creates an immersive 3am Jasper experience with:
 * - Twinkling stars with realistic distribution
 * - Rare shooting stars (dopamine triggers)
 * - Dancing aurora borealis
 * - Floating embers from campfire
 * - Gentle moonrise
 */

// Seeded random for consistent but natural-looking distributions
const seededRandom = (seed) => {
    const x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
};

// Generate constellation-like star clusters
const generateStars = () => {
    const stars = [];

    // Background scattered stars (dimmer, smaller)
    for (let i = 0; i < 80; i++) {
        const r1 = seededRandom(i * 3 + 1);
        const r2 = seededRandom(i * 7 + 2);
        const r3 = seededRandom(i * 11 + 3);
        const r4 = seededRandom(i * 13 + 4);
        const r5 = seededRandom(i * 17 + 5);

        stars.push({
            id: `bg-${i}`,
            left: r1 * 100,
            top: r2 * 50,
            size: 0.8 + r3 * 1.2,
            delay: r4 * 6,
            duration: 2 + r5 * 4,
            baseOpacity: 0.2 + r3 * 0.4,
            color: r5 > 0.85 ? '#fef3c7' : r5 > 0.7 ? '#e0f2fe' : '#ffffff',
            layer: 'back'
        });
    }

    // Mid-layer stars (medium brightness)
    for (let i = 0; i < 50; i++) {
        const r1 = seededRandom(i * 5 + 100);
        const r2 = seededRandom(i * 9 + 101);
        const r3 = seededRandom(i * 13 + 102);
        const r4 = seededRandom(i * 17 + 103);
        const r5 = seededRandom(i * 19 + 104);

        stars.push({
            id: `mid-${i}`,
            left: r1 * 98 + 1,
            top: r2 * 45 + 2,
            size: 1.2 + r3 * 1.8,
            delay: r4 * 5,
            duration: 1.5 + r5 * 3,
            baseOpacity: 0.4 + r3 * 0.5,
            color: r5 > 0.8 ? '#fbbf24' : r5 > 0.6 ? '#bfdbfe' : '#ffffff',
            layer: 'mid'
        });
    }

    // Bright feature stars (sparse, prominent)
    for (let i = 0; i < 15; i++) {
        const r1 = seededRandom(i * 7 + 200);
        const r2 = seededRandom(i * 11 + 201);
        const r3 = seededRandom(i * 13 + 202);
        const r4 = seededRandom(i * 17 + 203);
        const r5 = seededRandom(i * 23 + 204);

        stars.push({
            id: `bright-${i}`,
            left: r1 * 95 + 2.5,
            top: r2 * 35 + 3,
            size: 2 + r3 * 2,
            delay: r4 * 3,
            duration: 1 + r5 * 2,
            baseOpacity: 0.7 + r3 * 0.3,
            color: r5 > 0.7 ? '#fcd34d' : '#ffffff',
            layer: 'front',
            glow: true
        });
    }

    return stars;
};

const STARS = generateStars();

// Star component with CSS animation
const Star = ({ star }) => (
    <div
        style={{
            position: 'absolute',
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            borderRadius: '50%',
            backgroundColor: star.color,
            opacity: star.baseOpacity,
            boxShadow: star.glow
                ? `0 0 ${star.size * 6}px ${star.color}40, 0 0 ${star.size * 3}px ${star.color}60`
                : `0 0 ${star.size * 2}px ${star.color}30`,
            animation: `starTwinkle ${star.duration}s ease-in-out ${star.delay}s infinite alternate`,
            willChange: 'opacity'
        }}
    />
);

// Shooting star component
const ShootingStar = ({ onComplete }) => {
    const [visible, setVisible] = useState(true);
    const startX = useMemo(() => 10 + Math.random() * 60, []);
    const startY = useMemo(() => 5 + Math.random() * 25, []);
    const angle = useMemo(() => 15 + Math.random() * 30, []);
    const duration = useMemo(() => 0.8 + Math.random() * 0.6, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            onComplete?.();
        }, duration * 1000 + 200);
        return () => clearTimeout(timer);
    }, [duration, onComplete]);

    if (!visible) return null;

    return (
        <div
            style={{
                position: 'absolute',
                left: `${startX}%`,
                top: `${startY}%`,
                width: '120px',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, #ffffff 20%, #fef3c7 60%, #fbbf24)',
                borderRadius: '2px',
                transform: `rotate(${angle}deg)`,
                animation: `shootingStar ${duration}s ease-out forwards`,
                boxShadow: '0 0 6px #fbbf24, 0 0 12px #ffffff60',
                opacity: 0.9
            }}
        />
    );
};

// Aurora Borealis component - More visible dancing lights
const Aurora = () => {
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '50%',
            overflow: 'hidden',
            pointerEvents: 'none',
            opacity: 0.55
        }}>
            {/* Primary aurora wave - bright green */}
            <div style={{
                position: 'absolute',
                top: '3%',
                left: '-25%',
                right: '-25%',
                height: '160px',
                background: 'linear-gradient(180deg, transparent, rgba(74, 222, 128, 0.25) 25%, rgba(52, 211, 153, 0.35) 50%, rgba(45, 212, 191, 0.25) 75%, transparent)',
                filter: 'blur(25px)',
                animation: 'auroraWave1 12s ease-in-out infinite',
                transformOrigin: 'center'
            }} />

            {/* Secondary aurora wave - purple accent */}
            <div style={{
                position: 'absolute',
                top: '8%',
                left: '-15%',
                right: '-15%',
                height: '130px',
                background: 'linear-gradient(180deg, transparent, rgba(139, 92, 246, 0.2) 25%, rgba(167, 139, 250, 0.28) 50%, rgba(192, 132, 252, 0.2) 75%, transparent)',
                filter: 'blur(35px)',
                animation: 'auroraWave2 15s ease-in-out infinite',
                animationDelay: '-3s',
                transformOrigin: 'center'
            }} />

            {/* Tertiary wave - cyan shimmer */}
            <div style={{
                position: 'absolute',
                top: '1%',
                left: '-20%',
                right: '-20%',
                height: '100px',
                background: 'linear-gradient(180deg, transparent, rgba(34, 211, 238, 0.15) 35%, rgba(56, 189, 248, 0.22) 55%, transparent)',
                filter: 'blur(40px)',
                animation: 'auroraWave3 18s ease-in-out infinite',
                animationDelay: '-7s'
            }} />
        </div>
    );
};

// Floating embers from campfire
const Embers = ({ count = 12 }) => {
    const embers = useMemo(() => {
        return Array.from({ length: count }, (_, i) => ({
            id: i,
            left: 45 + Math.random() * 10,
            delay: Math.random() * 8,
            duration: 4 + Math.random() * 4,
            size: 2 + Math.random() * 3,
            drift: -20 + Math.random() * 40
        }));
    }, [count]);

    return (
        <div style={{ position: 'absolute', bottom: '10%', left: 0, right: 0, height: '50%', pointerEvents: 'none', overflow: 'hidden' }}>
            {embers.map(ember => (
                <div
                    key={ember.id}
                    style={{
                        position: 'absolute',
                        left: `${ember.left}%`,
                        bottom: '-5%',
                        width: `${ember.size}px`,
                        height: `${ember.size}px`,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #fbbf24 0%, #f97316 50%, #dc2626 100%)',
                        boxShadow: `0 0 ${ember.size * 2}px #f9731680, 0 0 ${ember.size * 4}px #fbbf2440`,
                        animation: `emberFloat ${ember.duration}s ease-out infinite`,
                        animationDelay: `${ember.delay}s`,
                        '--drift': `${ember.drift}px`,
                        opacity: 0
                    }}
                />
            ))}
        </div>
    );
};

// Moon component with gentle glow
const Moon = () => (
    <div style={{
        position: 'absolute',
        top: '8%',
        right: '12%',
        width: '45px',
        height: '45px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, #fef9c3 0%, #fef3c7 40%, #fde68a 100%)',
        boxShadow: '0 0 40px rgba(254, 243, 199, 0.4), 0 0 80px rgba(254, 243, 199, 0.2), 0 0 120px rgba(254, 243, 199, 0.1)',
        animation: 'moonGlow 8s ease-in-out infinite alternate'
    }}>
        {/* Moon craters/texture */}
        <div style={{
            position: 'absolute',
            top: '25%',
            left: '20%',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.05)'
        }} />
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '55%',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.04)'
        }} />
    </div>
);

// Distant mountain mist
const MountainMist = () => (
    <div style={{
        position: 'absolute',
        bottom: '25%',
        left: '-10%',
        right: '-10%',
        height: '15%',
        background: 'linear-gradient(180deg, transparent 0%, rgba(30, 41, 59, 0.3) 40%, rgba(30, 41, 59, 0.5) 70%, transparent 100%)',
        filter: 'blur(20px)',
        animation: 'mistDrift 25s ease-in-out infinite alternate',
        pointerEvents: 'none'
    }} />
);

// Main Night Sky component
// Optimized with React.memo to prevent re-renders on every keystroke/state update in parent
const NightSky = React.memo(function NightSky({ isActive = false }) {
    const [shootingStars, setShootingStars] = useState([]);
    const shootingStarIdRef = useRef(0);

    // Rare shooting star spawner (dopamine trigger)
    useEffect(() => {
        const spawnShootingStar = () => {
            // 15% chance every 8-15 seconds
            if (Math.random() < 0.15) {
                const id = shootingStarIdRef.current++;
                setShootingStars(prev => [...prev, id]);
            }
        };

        const interval = setInterval(spawnShootingStar, 8000 + Math.random() * 7000);
        return () => clearInterval(interval);
    }, []);

    const removeShootingStar = (id) => {
        setShootingStars(prev => prev.filter(s => s !== id));
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 1,
            overflow: 'hidden'
        }}>
            {/* Aurora Borealis */}
            <Aurora />

            {/* Moon */}
            <Moon />

            {/* Stars */}
            {STARS.map(star => (
                <Star key={star.id} star={star} />
            ))}

            {/* Shooting stars */}
            {shootingStars.map(id => (
                <ShootingStar key={id} onComplete={() => removeShootingStar(id)} />
            ))}

            {/* Mountain mist */}
            <MountainMist />

            {/* Floating embers */}
            <Embers count={isActive ? 18 : 10} />

            {/* CSS Animations */}
            <style>{`
                @keyframes starTwinkle {
                    0% { opacity: 0.2; transform: scale(0.9); }
                    100% { opacity: 1; transform: scale(1.1); }
                }
                
                @keyframes shootingStar {
                    0% { 
                        transform: rotate(var(--angle, 25deg)) translateX(0) scaleX(0.3);
                        opacity: 0;
                    }
                    5% {
                        opacity: 1;
                        transform: rotate(var(--angle, 25deg)) translateX(20px) scaleX(1);
                    }
                    100% { 
                        transform: rotate(var(--angle, 25deg)) translateX(300px) scaleX(0.2);
                        opacity: 0;
                    }
                }
                
                @keyframes auroraWave1 {
                    0%, 100% { 
                        transform: translateX(-5%) scaleY(1) skewX(-5deg);
                        opacity: 0.3;
                    }
                    25% {
                        transform: translateX(3%) scaleY(1.3) skewX(3deg);
                        opacity: 0.5;
                    }
                    50% { 
                        transform: translateX(8%) scaleY(0.8) skewX(8deg);
                        opacity: 0.35;
                    }
                    75% {
                        transform: translateX(-2%) scaleY(1.2) skewX(-3deg);
                        opacity: 0.45;
                    }
                }
                
                @keyframes auroraWave2 {
                    0%, 100% { 
                        transform: translateX(5%) scaleY(0.9) skewX(5deg);
                        opacity: 0.25;
                    }
                    33% {
                        transform: translateX(-8%) scaleY(1.4) skewX(-8deg);
                        opacity: 0.4;
                    }
                    66% { 
                        transform: translateX(3%) scaleY(1.1) skewX(2deg);
                        opacity: 0.3;
                    }
                }
                
                @keyframes auroraWave3 {
                    0%, 100% { 
                        transform: translateX(0) scaleY(1);
                        opacity: 0.2;
                    }
                    50% { 
                        transform: translateX(-10%) scaleY(1.5);
                        opacity: 0.35;
                    }
                }
                
                @keyframes emberFloat {
                    0% {
                        transform: translateY(0) translateX(0) scale(1);
                        opacity: 0;
                    }
                    10% {
                        opacity: 0.9;
                    }
                    50% {
                        transform: translateY(-150px) translateX(var(--drift, 0px)) scale(0.8);
                        opacity: 0.7;
                    }
                    100% {
                        transform: translateY(-300px) translateX(calc(var(--drift, 0px) * 1.5)) scale(0.3);
                        opacity: 0;
                    }
                }
                
                @keyframes moonGlow {
                    0% {
                        box-shadow: 0 0 40px rgba(254, 243, 199, 0.4), 0 0 80px rgba(254, 243, 199, 0.2);
                    }
                    100% {
                        box-shadow: 0 0 50px rgba(254, 243, 199, 0.5), 0 0 100px rgba(254, 243, 199, 0.3);
                    }
                }
                
                @keyframes mistDrift {
                    0% { transform: translateX(-3%); opacity: 0.4; }
                    100% { transform: translateX(3%); opacity: 0.6; }
                }
            `}</style>
        </div>
    );
});

export default NightSky;
