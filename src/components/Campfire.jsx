import React from 'react';

/**
 * CAMPFIRE - Living Fire Edition
 * Realistic campfire glow with dynamic flickering
 * Multiple light layers create depth and warmth
 */

export default function Campfire({ isActive = false, intensity = 1 }) {
    const baseIntensity = isActive ? 1.2 : 1;
    const glowScale = baseIntensity * intensity;

    return (
        <div style={{
            position: 'fixed',
            bottom: '-200px',
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 3
        }}>
            {/* Primary fire glow - warm orange */}
            <div
                style={{
                    position: 'absolute',
                    width: `${600 * glowScale}px`,
                    height: `${350 * glowScale}px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    borderRadius: '50%',
                    background: `radial-gradient(ellipse at center, 
                        rgba(255, 160, 60, ${0.7 * glowScale}) 0%, 
                        rgba(255, 120, 40, ${0.5 * glowScale}) 20%, 
                        rgba(220, 80, 20, ${0.3 * glowScale}) 40%, 
                        rgba(180, 50, 10, ${0.15 * glowScale}) 60%, 
                        transparent 75%)`,
                    filter: `blur(${45 * glowScale}px)`,
                    animation: 'fireGlowPulse 2s ease-in-out infinite'
                }}
            />

            {/* Secondary fire glow - yellow highlight */}
            <div
                style={{
                    position: 'absolute',
                    width: `${400 * glowScale}px`,
                    height: `${250 * glowScale}px`,
                    left: '50%',
                    top: '30px',
                    transform: 'translateX(-50%)',
                    borderRadius: '50%',
                    background: `radial-gradient(ellipse at center, 
                        rgba(255, 220, 100, ${0.4 * glowScale}) 0%, 
                        rgba(255, 180, 60, ${0.2 * glowScale}) 40%, 
                        transparent 70%)`,
                    filter: `blur(${30 * glowScale}px)`,
                    animation: 'fireGlowPulse2 1.5s ease-in-out infinite',
                    animationDelay: '-0.5s'
                }}
            />

            {/* Ambient warm light cast */}
            <div
                style={{
                    position: 'absolute',
                    width: `${900 * glowScale}px`,
                    height: `${500 * glowScale}px`,
                    left: '50%',
                    top: '-100px',
                    transform: 'translateX(-50%)',
                    borderRadius: '50%',
                    background: `radial-gradient(ellipse at center bottom, 
                        rgba(255, 140, 50, ${0.2 * glowScale}) 0%, 
                        rgba(200, 80, 30, ${0.1 * glowScale}) 30%, 
                        transparent 60%)`,
                    filter: `blur(${60 * glowScale}px)`,
                    animation: 'ambientGlow 4s ease-in-out infinite alternate'
                }}
            />

            {/* Ground reflection */}
            <div
                style={{
                    position: 'absolute',
                    width: `${500 * glowScale}px`,
                    height: '60px',
                    left: '50%',
                    top: '120px',
                    transform: 'translateX(-50%)',
                    background: `linear-gradient(90deg, 
                        transparent 0%, 
                        rgba(255, 140, 50, ${0.3 * glowScale}) 30%, 
                        rgba(255, 160, 70, ${0.4 * glowScale}) 50%, 
                        rgba(255, 140, 50, ${0.3 * glowScale}) 70%, 
                        transparent 100%)`,
                    filter: `blur(${20 * glowScale}px)`,
                    animation: 'groundGlow 3s ease-in-out infinite alternate'
                }}
            />

            <style>{`
                @keyframes fireGlowPulse {
                    0%, 100% { 
                        opacity: 0.9; 
                        transform: translateX(-50%) scale(1); 
                    }
                    25% { 
                        opacity: 1; 
                        transform: translateX(-50%) scale(1.03); 
                    }
                    50% { 
                        opacity: 0.85; 
                        transform: translateX(-50%) scale(0.97); 
                    }
                    75% { 
                        opacity: 1; 
                        transform: translateX(-50%) scale(1.02); 
                    }
                }

                @keyframes fireGlowPulse2 {
                    0%, 100% { 
                        opacity: 0.8; 
                        transform: translateX(-50%) scale(1) translateY(0); 
                    }
                    33% { 
                        opacity: 1; 
                        transform: translateX(-50%) scale(1.05) translateY(-5px); 
                    }
                    66% { 
                        opacity: 0.75; 
                        transform: translateX(-50%) scale(0.95) translateY(3px); 
                    }
                }

                @keyframes ambientGlow {
                    0% { opacity: 0.6; }
                    100% { opacity: 0.8; }
                }

                @keyframes groundGlow {
                    0% { opacity: 0.7; transform: translateX(-50%) scaleX(0.95); }
                    100% { opacity: 0.9; transform: translateX(-50%) scaleX(1.05); }
                }
            `}</style>
        </div>
    );
}
