'use client';

export default function DashboardBackground() {
    return (
        <div className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden z-0 bg-[#fff5f0]">
            {/* Ambient Blurred Live Wallpaper Layer for Depth & Visual Segregation */}
            <div className="absolute inset-0 w-full h-full filter blur-[2px] opacity-45 pointer-events-none select-none">
                <svg
                    viewBox="0 0 1440 900"
                    preserveAspectRatio="xMidYMid slice"
                    className="w-full h-full absolute inset-0"
                >
                    {/* --- 1. Soft Bubbly Geometric Blobs (with subtle continuous floating drift) --- */}
                    {/* Blob 1: Left Circle with gentle floating motion */}
                    <g>
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            values="0 0; 12 -16; -8 12; 0 0"
                            dur="20s"
                            repeatCount="indefinite"
                        />
                        <circle cx="-30" cy="340" r="280" fill="#edd6cb" fillOpacity="0.45" />
                    </g>

                    {/* Blob 2: Right Arch / Pill with gentle floating motion */}
                    <g>
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            values="0 0; -16 14; 10 -12; 0 0"
                            dur="24s"
                            repeatCount="indefinite"
                        />
                        <path
                            d="M 1160 480 L 1160 180 A 100 100 0 0 1 1360 180 L 1360 480 Z"
                            fill="#edd6cb"
                            fillOpacity="0.4"
                        />
                    </g>

                    {/* Blob 3: Bottom Right Circle */}
                    <g>
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            values="0 0; -12 -14; 8 10; 0 0"
                            dur="19s"
                            repeatCount="indefinite"
                        />
                        <circle cx="1300" cy="780" r="230" fill="#edd6cb" fillOpacity="0.38" />
                    </g>

                    {/* Blob 4: Top Center Rounded Soft Rectangle */}
                    <g>
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            values="0 0; 10 12; -12 -8; 0 0"
                            dur="22s"
                            repeatCount="indefinite"
                        />
                        <rect
                            x="560"
                            y="-80"
                            width="300"
                            height="200"
                            rx="100"
                            fill="#edd6cb"
                            fillOpacity="0.3"
                        />
                    </g>

                    {/* Blob 5: Bottom Left Pill */}
                    <g>
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            values="0 0; 14 10; -10 -14; 0 0"
                            dur="26s"
                            repeatCount="indefinite"
                        />
                        <rect
                            x="120"
                            y="660"
                            width="240"
                            height="180"
                            rx="90"
                            fill="#edd6cb"
                            fillOpacity="0.32"
                        />
                    </g>

                    {/* --- 2. Precise Circuit Lines (Tracks) --- */}
                    {/* Track 1: From top down, curves left to edge */}
                    <path
                        d="M 230 0 L 230 280 A 50 50 0 0 1 180 330 L -60 330"
                        stroke="#E86F47"
                        strokeWidth="1.5"
                        fill="none"
                        opacity="0.6"
                    />

                    {/* Track 2: From left edge, across, curves down to bottom */}
                    <path
                        d="M -60 270 L 260 270 A 45 45 0 0 1 305 315 L 305 920"
                        stroke="#E86F47"
                        strokeWidth="1.5"
                        fill="none"
                        opacity="0.6"
                    />

                    {/* Track 3: Horizontal bottom sweep & S-curve up to right exit */}
                    <path
                        d="M -60 680 L 1140 680 A 55 55 0 0 0 1195 625 L 1195 320 A 70 70 0 0 1 1265 250 L 1500 250"
                        stroke="#E86F47"
                        strokeWidth="1.5"
                        fill="none"
                        opacity="0.6"
                    />

                    {/* Track 4: From top right down, curves right to exit */}
                    <path
                        d="M 1265 0 L 1265 520 A 65 65 0 0 0 1330 585 L 1500 585"
                        stroke="#E86F47"
                        strokeWidth="1.5"
                        fill="none"
                        opacity="0.6"
                    />

                    {/* --- 3. Circuit Junction Nodes --- */}
                    {[
                        { cx: 230, cy: 280 },
                        { cx: 180, cy: 330 },
                        { cx: 260, cy: 270 },
                        { cx: 305, cy: 315 },
                        { cx: 1140, cy: 680 },
                        { cx: 1195, cy: 625 },
                        { cx: 1195, cy: 320 },
                        { cx: 1265, cy: 250 },
                        { cx: 1265, cy: 520 },
                        { cx: 1330, cy: 585 },
                    ].map((node, i) => (
                        <g key={i}>
                            <circle cx={node.cx} cy={node.cy} r="11" fill="#fff5f0" stroke="#E86F47" strokeWidth="1.5" opacity="0.75" />
                            <circle cx={node.cx} cy={node.cy} r="4" fill="#E86F47" opacity="0.85" />
                        </g>
                    ))}

                    {/* --- 4. Continuously Traveling Animated Dots/Circles --- */}
                    {/* Dot 1: Moves along Track 1 */}
                    <g>
                        <animateMotion
                            path="M 230 -30 L 230 280 A 50 50 0 0 1 180 330 L -70 330"
                            dur="8s"
                            repeatCount="indefinite"
                        />
                        <circle cx="0" cy="0" r="13" fill="#E86F47" opacity="0.2">
                            <animate attributeName="r" values="11;15;11" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.2;0.08;0.2" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="0" cy="0" r="8.5" fill="#E86F47" opacity="0.8" />
                        <circle cx="0" cy="0" r="3" fill="#ffffff" opacity="0.6" />
                    </g>

                    {/* Dot 2: Moves along Track 2 */}
                    <g>
                        <animateMotion
                            path="M -70 270 L 260 270 A 45 45 0 0 1 305 315 L 305 950"
                            dur="9s"
                            begin="-4.5s"
                            repeatCount="indefinite"
                        />
                        <circle cx="0" cy="0" r="13" fill="#E86F47" opacity="0.2">
                            <animate attributeName="r" values="11;15;11" dur="2.2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.2;0.08;0.2" dur="2.2s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="0" cy="0" r="8.5" fill="#E86F47" opacity="0.8" />
                        <circle cx="0" cy="0" r="3" fill="#ffffff" opacity="0.6" />
                    </g>

                    {/* Dot 3A: Moves along Track 3 */}
                    <g>
                        <animateMotion
                            path="M -70 680 L 1140 680 A 55 55 0 0 0 1195 625 L 1195 320 A 70 70 0 0 1 1265 250 L 1520 250"
                            dur="15s"
                            begin="0s"
                            repeatCount="indefinite"
                        />
                        <circle cx="0" cy="0" r="13" fill="#E86F47" opacity="0.2">
                            <animate attributeName="r" values="11;15;11" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.2;0.08;0.2" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="0" cy="0" r="8.5" fill="#E86F47" opacity="0.8" />
                        <circle cx="0" cy="0" r="3" fill="#ffffff" opacity="0.6" />
                    </g>

                    {/* Dot 3B: Staggered along Track 3 */}
                    <g>
                        <animateMotion
                            path="M -70 680 L 1140 680 A 55 55 0 0 0 1195 625 L 1195 320 A 70 70 0 0 1 1265 250 L 1520 250"
                            dur="15s"
                            begin="-7.5s"
                            repeatCount="indefinite"
                        />
                        <circle cx="0" cy="0" r="13" fill="#E86F47" opacity="0.2">
                            <animate attributeName="r" values="11;15;11" dur="2.1s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.2;0.08;0.2" dur="2.1s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="0" cy="0" r="8.5" fill="#E86F47" opacity="0.8" />
                        <circle cx="0" cy="0" r="3" fill="#ffffff" opacity="0.6" />
                    </g>

                    {/* Dot 4: Moves along Track 4 */}
                    <g>
                        <animateMotion
                            path="M 1265 -30 L 1265 520 A 65 65 0 0 0 1330 585 L 1520 585"
                            dur="10s"
                            begin="-2.5s"
                            repeatCount="indefinite"
                        />
                        <circle cx="0" cy="0" r="13" fill="#E86F47" opacity="0.2">
                            <animate attributeName="r" values="11;15;11" dur="2.3s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.2;0.08;0.2" dur="2.3s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="0" cy="0" r="8.5" fill="#E86F47" opacity="0.8" />
                        <circle cx="0" cy="0" r="3" fill="#ffffff" opacity="0.6" />
                    </g>
                </svg>
            </div>
        </div>
    );
}
