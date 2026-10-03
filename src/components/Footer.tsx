'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const lineAnchorRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{
    width: number;
    height: number;
    lineY: number;
  }>({
    width: 1707,
    height: 190,
    lineY: 145,
  });

  useEffect(() => {
    const updateDims = () => {
      if (!footerRef.current) return;
      const footerRect = footerRef.current.getBoundingClientRect();
      let lineY = footerRect.height - 38;
      if (lineAnchorRef.current) {
        const anchorRect = lineAnchorRef.current.getBoundingClientRect();
        lineY = anchorRect.top - footerRect.top + anchorRect.height / 2;
      }
      setDims({
        width: footerRect.width,
        height: footerRect.height,
        lineY,
      });
    };

    updateDims();
    const rafId = requestAnimationFrame(updateDims);

    const observer = new ResizeObserver(() => {
      updateDims();
    });

    if (footerRef.current) {
      observer.observe(footerRef.current);
    }

    window.addEventListener('resize', updateDims);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', updateDims);
    };
  }, []);

  // Track Geometry:
  // Runs from off-screen left (x = -60) across to curveStartX,
  // curves 90° downward to curveEndX,
  // and travels straight down past the footer bottom (dims.height + 30)
  // With footer overflow-hidden, the line touches and crosses the bottom edge with 0 gap.
  const R = 24;
  const rightInset = 48;
  const curveEndX = Math.max(dims.width - rightInset, 120);
  const curveStartX = Math.max(curveEndX - R, 60);
  const lineY = dims.lineY;
  const bottomY = dims.height + 30;

  const trackPath = `M -60 ${lineY} L ${curveStartX} ${lineY} A ${R} ${R} 0 0 1 ${curveEndX} ${lineY + R} L ${curveEndX} ${bottomY}`;

  return (
    <footer
      ref={footerRef}
      id="footer"
      className="relative z-20 w-full bg-[#fff5f0] border-t border-[#f5c4b5]/80 pt-6 pb-1 overflow-hidden font-mono select-none"
    >
      {/* Top-Right Decorative Shape */}
      <div className="absolute top-0 right-0 pointer-events-none z-0">
        <svg width="220" height="110" viewBox="0 0 220 110" fill="none">
          <path
            d="M 90 0 L 90 35 A 40 40 0 0 0 130 75 L 220 75 L 220 0 Z"
            fill="#faebe3"
            fillOpacity="0.8"
          />
          <path
            d="M 90 0 L 90 35 A 40 40 0 0 0 130 75 L 220 75"
            stroke="#efc0ad"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>

      {/* Bottom-Right Faded Circle Blob */}
      <div className="absolute -bottom-20 -right-14 w-60 h-60 sm:w-68 sm:h-68 rounded-full bg-[#faebe3] pointer-events-none z-0 opacity-80" />

      {/* Full-width Circuit Track SVG with Animated Continuous Ball */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10"
        width={dims.width}
        height={dims.height}
      >
        {/* Track Line */}
        <path
          d={trackPath}
          stroke="#efc0ad"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Animated Circuit Ball 1: Infinite Loop */}
        <g key={`ball-1-${trackPath}`}>
          <animateMotion
            path={trackPath}
            dur="8s"
            repeatCount="indefinite"
          />
          {/* Outer glowing pulsing halo */}
          <circle cx="0" cy="0" r="14" fill="#E86F47" opacity="0.25">
            <animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0.12;0.25" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* Core solid circle */}
          <circle cx="0" cy="0" r="9.5" fill="#E86F47" />
          {/* Inner specular highlight */}
          <circle cx="0" cy="0" r="3.5" fill="#ffffff" opacity="0.65" />
        </g>

        {/* Animated Circuit Ball 2: Staggered 4s for graceful continuous flow */}
        <g key={`ball-2-${trackPath}`}>
          <animateMotion
            path={trackPath}
            dur="8s"
            begin="-4s"
            repeatCount="indefinite"
          />
          {/* Outer glowing pulsing halo */}
          <circle cx="0" cy="0" r="14" fill="#E86F47" opacity="0.25">
            <animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0.12;0.25" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* Core solid circle */}
          <circle cx="0" cy="0" r="9.5" fill="#E86F47" />
          {/* Inner specular highlight */}
          <circle cx="0" cy="0" r="3.5" fill="#ffffff" opacity="0.65" />
        </g>
      </svg>

      {/* Main Content Layout */}
      <div className="w-full relative z-20">
        {/* Main Footer Row: Brand Logo | 3 Nav Columns | Divider | Stay Connected */}
        <div className="w-full flex flex-col xl:flex-row items-start xl:items-end justify-between gap-6 px-4 sm:px-8 lg:px-12 pb-3.5">
          {/* Left: quizeee Brand Logo (Q-U-I-Z-E-E-E) */}
          <div className="shrink-0 flex items-end -mb-2 sm:-mb-2.5">
            <Link href="/">
              <img
                src="/quizeee-footer.png"
                alt="quizeee"
                className="h-20 sm:h-24 md:h-28 w-auto object-contain object-left-bottom select-none hover:opacity-95 transition-opacity"
              />
            </Link>
          </div>

          {/* Right Group: 3 Columns + Straight Divider + Stay Connected */}
          <div className="flex flex-wrap lg:flex-nowrap items-start lg:items-end gap-6 sm:gap-10 lg:gap-14 pr-4 sm:pr-10 lg:pr-14">
            {/* Middle: 3 Nav Link Columns */}
            <div className="flex flex-wrap sm:flex-nowrap gap-6 sm:gap-10 lg:gap-12">
              {/* Product */}
              <div className="flex flex-col gap-1.5 min-w-[90px]">
                <h4 className="text-xs sm:text-sm font-bold text-black tracking-tight mb-0.5">Product</h4>
                <ul className="space-y-1.5 text-xs text-[#6d5b52]">
                  <li><Link href="#features" className="hover:text-[#E86F47] transition-colors">Features</Link></li>
                  <li><Link href="/dashboard/teacher" className="hover:text-[#E86F47] transition-colors">Dashboard</Link></li>
                  <li><Link href="/dashboard/teacher" className="hover:text-[#E86F47] transition-colors">Analytics</Link></li>
                </ul>
              </div>

              {/* Resources */}
              <div className="flex flex-col gap-1.5 min-w-[90px]">
                <h4 className="text-xs sm:text-sm font-bold text-black tracking-tight mb-0.5">Resources</h4>
                <ul className="space-y-1.5 text-xs text-[#6d5b52]">
                  <li><Link href="#" className="hover:text-[#E86F47] transition-colors">Documentation</Link></li>
                  <li><Link href="#" className="hover:text-[#E86F47] transition-colors">Help Center</Link></li>
                  <li><Link href="#" className="hover:text-[#E86F47] transition-colors">Contact</Link></li>
                </ul>
              </div>

              {/* Company */}
              <div className="flex flex-col gap-1.5 min-w-[90px]">
                <h4 className="text-xs sm:text-sm font-bold text-black tracking-tight mb-0.5">Company</h4>
                <ul className="space-y-1.5 text-xs text-[#6d5b52]">
                  <li><Link href="#" className="hover:text-[#E86F47] transition-colors">About</Link></li>
                  <li><Link href="#" className="hover:text-[#E86F47] transition-colors">Privacy Policy</Link></li>
                  <li><Link href="#" className="hover:text-[#E86F47] transition-colors">Terms of Service</Link></li>
                </ul>
              </div>
            </div>

            {/* Straight Vertical Divider */}
            <div className="hidden lg:block w-[1.5px] h-20 bg-[#efc0ad] shrink-0 self-center"></div>

            {/* Right: Stay Connected */}
            <div className="flex flex-col gap-2 min-w-[190px]">
              <h4 className="text-xs sm:text-sm font-bold text-black tracking-tight">Stay Connected</h4>

              {/* Social Icon Pills */}
              <div className="flex items-center gap-2 pt-0.5">
                {/* GitHub */}
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-[#faebe3] border border-[#f5c4b5]/80 flex items-center justify-center text-[#d56b43] hover:bg-[#f5c4b5] hover:text-[#7a3014] transition-all"
                  aria-label="GitHub"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </a>

                {/* LinkedIn */}
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-[#faebe3] border border-[#f5c4b5]/80 flex items-center justify-center text-[#d56b43] hover:bg-[#f5c4b5] hover:text-[#7a3014] transition-all"
                  aria-label="LinkedIn"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </a>

                {/* Instagram */}
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-[#faebe3] border border-[#f5c4b5]/80 flex items-center justify-center text-[#d56b43] hover:bg-[#f5c4b5] hover:text-[#7a3014] transition-all"
                  aria-label="Instagram"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                  </svg>
                </a>

                {/* Email / Mail */}
                <a
                  href="mailto:contact@quizeee.com"
                  className="w-8 h-8 rounded-lg bg-[#faebe3] border border-[#f5c4b5]/80 flex items-center justify-center text-[#d56b43] hover:bg-[#f5c4b5] hover:text-[#7a3014] transition-all"
                  aria-label="Email"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </a>
              </div>

              {/* Tagline below divider */}
              <div className="pt-1.5 border-t border-[#efc0ad] flex items-center gap-2 text-xs text-[#8a7266]">
                <span className="w-2 h-2 rounded-full bg-[#E86F47]"></span>
                <span>Teachers. Quizzes. Progress.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Anchor: marks the exact vertical position of the circuit track */}
        <div ref={lineAnchorRef} className="w-full h-0 relative" />

        {/* Copyright notice below the line on the left */}
        <div className="pt-2 pb-1.5 text-[11px] sm:text-xs text-[#8a7266] pl-6 sm:pl-10 lg:pl-14">
          &copy; 2026 Quizeee. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
