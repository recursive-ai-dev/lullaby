import React from 'react';

/**
 * EVERGREEN TREES - Forest Depth Edition
 * Multiple pine tree silhouettes at varying depths
 * Creates natural wilderness framing
 */

// Single tree component
const PineTree = ({ style, size = 1, variant = 0 }) => {
    const height = 200 * size;
    const width = 100 * size;

    // Different tree shapes for variety
    const treePaths = [
        // Classic symmetric pine
        `M50 10 L28 50 L38 50 L20 85 L32 85 L12 120 L30 120 L8 155 L42 155 L38 175 L62 175 L58 155 L92 155 L70 120 L88 120 L68 85 L80 85 L62 50 L72 50 Z`,
        // Slightly asymmetric pine
        `M48 8 L25 48 L36 48 L18 82 L30 82 L10 118 L28 118 L5 155 L40 155 L36 178 L60 178 L56 155 L90 155 L68 118 L86 118 L66 82 L78 82 L60 48 L70 48 Z`,
        // Wider pine
        `M50 12 L22 55 L35 55 L15 95 L30 95 L5 135 L28 135 L2 165 L44 165 L40 185 L60 185 L56 165 L98 165 L72 135 L95 135 L70 95 L85 95 L65 55 L78 55 Z`
    ];

    const path = treePaths[variant % treePaths.length];

    return (
        <div style={{ ...style, width: `${width}px`, height: `${height}px` }}>
            <svg viewBox="0 0 100 190" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
                {/* Trunk */}
                <path
                    d="M46 165 C45 175 44 182 42 190 L58 190 C56 182 55 175 54 165 Z"
                    fill="#0a0e14"
                />
                {/* Tree body */}
                <path d={path} fill="#0c1018" />
            </svg>
        </div>
    );
};

// Optimized with React.memo to prevent re-renders on every keystroke/state update in parent
const Evergreen = React.memo(function Evergreen() {
    return (
        <>
            {/* Left side trees - varying depths */}
            <PineTree
                variant={1}
                size={0.7}
                style={{
                    position: 'fixed',
                    left: '2%',
                    bottom: '4%',
                    opacity: 0.85,
                    zIndex: 2,
                    pointerEvents: 'none'
                }}
            />
            <PineTree
                variant={2}
                size={0.5}
                style={{
                    position: 'fixed',
                    left: '8%',
                    bottom: '5%',
                    opacity: 0.6,
                    zIndex: 2,
                    pointerEvents: 'none'
                }}
            />

            {/* Right side trees - main feature tree */}
            <PineTree
                variant={0}
                size={1.1}
                style={{
                    position: 'fixed',
                    right: '3%',
                    bottom: '5%',
                    opacity: 0.92,
                    zIndex: 2,
                    pointerEvents: 'none'
                }}
            />
            <PineTree
                variant={1}
                size={0.6}
                style={{
                    position: 'fixed',
                    right: '12%',
                    bottom: '4%',
                    opacity: 0.5,
                    zIndex: 2,
                    pointerEvents: 'none'
                }}
            />
            <PineTree
                variant={2}
                size={0.4}
                style={{
                    position: 'fixed',
                    right: '18%',
                    bottom: '6%',
                    opacity: 0.35,
                    zIndex: 2,
                    pointerEvents: 'none'
                }}
            />
        </>
    );
});

export default Evergreen;
