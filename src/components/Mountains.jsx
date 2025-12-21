import React from 'react';

/**
 * MOUNTAIN SILHOUETTES - Parallax Depth Edition
 * Multi-layer mountain ranges with atmospheric perspective
 * Creates authentic Rocky Mountain depth at 3am
 */

export default function Mountains() {
    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '45%',
            pointerEvents: 'none',
            zIndex: 2
        }}>
            {/* Far distant range - barely visible, blue atmospheric */}
            <svg
                viewBox="0 0 1440 320"
                style={{
                    position: 'absolute',
                    bottom: '15%',
                    width: '120%',
                    left: '-10%',
                    height: '60%',
                    opacity: 0.3
                }}
                preserveAspectRatio="none"
            >
                <defs>
                    <linearGradient id="farMountainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#334155" />
                        <stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>
                </defs>
                <path
                    fill="url(#farMountainGrad)"
                    d="M0,160L80,150C160,140,320,120,480,125C640,130,800,160,960,170C1120,180,1280,170,1360,165L1440,160L1440,320L0,320Z"
                />
            </svg>

            {/* Mid-distant range - subtle depth */}
            <svg
                viewBox="0 0 1440 320"
                style={{
                    position: 'absolute',
                    bottom: '8%',
                    width: '115%',
                    left: '-7.5%',
                    height: '55%',
                    opacity: 0.5
                }}
                preserveAspectRatio="none"
            >
                <defs>
                    <linearGradient id="midMountainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#1e293b" />
                        <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                </defs>
                <path
                    fill="url(#midMountainGrad)"
                    d="M0,200L60,180C120,160,240,120,360,130C480,140,600,200,720,210C840,220,960,180,1080,160C1200,140,1320,140,1380,140L1440,140L1440,320L0,320Z"
                />
            </svg>

            {/* Near range - prominent silhouette */}
            <svg
                viewBox="0 0 1440 320"
                style={{
                    position: 'absolute',
                    bottom: 0,
                    width: '110%',
                    left: '-5%',
                    height: '50%'
                }}
                preserveAspectRatio="none"
            >
                <defs>
                    <linearGradient id="nearMountainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#0f172a" />
                        <stop offset="60%" stopColor="#0a0f1a" />
                        <stop offset="100%" stopColor="#050810" />
                    </linearGradient>
                </defs>
                <path
                    fill="url(#nearMountainGrad)"
                    d="M0,260L48,245C96,230,192,200,288,195C384,190,480,210,576,220C672,230,768,230,864,240C960,250,1056,270,1152,275C1248,280,1344,270,1392,265L1440,260L1440,320L0,320Z"
                />
            </svg>

            {/* Foreground treeline silhouette */}
            <svg
                viewBox="0 0 1440 100"
                style={{
                    position: 'absolute',
                    bottom: 0,
                    width: '105%',
                    left: '-2.5%',
                    height: '12%'
                }}
                preserveAspectRatio="none"
            >
                <path
                    fill="#030508"
                    d="M0,100L0,85L20,85L25,70L30,85L50,85L53,65L56,85L80,85L85,60L90,85L120,85L125,55L130,85L160,85L165,68L170,85L200,85L205,50L210,85L240,85L248,62L256,85L280,85L285,72L290,85L320,85L328,58L336,85L360,85L365,65L370,85L400,85L408,48L416,85L440,85L445,70L450,85L480,85L488,55L496,85L520,85L525,68L530,85L560,85L568,52L576,85L600,85L605,75L610,85L640,85L648,60L656,85L680,85L688,45L696,85L720,85L725,72L730,85L760,85L768,58L776,85L800,85L808,65L816,85L840,85L848,50L856,85L880,85L888,68L896,85L920,85L928,55L936,85L960,85L968,62L976,85L1000,85L1008,48L1016,85L1040,85L1048,70L1056,85L1080,85L1088,58L1096,85L1120,85L1128,65L1136,85L1160,85L1168,52L1176,85L1200,85L1208,72L1216,85L1240,85L1248,60L1256,85L1280,85L1288,45L1296,85L1320,85L1328,68L1336,85L1360,85L1368,55L1376,85L1400,85L1408,62L1416,85L1440,85L1440,100L0,100Z"
                />
            </svg>
        </div>
    );
}
