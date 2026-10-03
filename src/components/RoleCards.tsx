'use client';

import Link from 'next/link';

export default function RoleCards() {
  return (
    <section className="relative w-full py-16 lg:py-24 bg-[#fff5f0] overflow-hidden select-none font-mono">
      {/* Background Ambient Circuit Blobs matching reference geometry */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Top-left circular blob */}
        <div className="absolute -top-6 left-20 sm:left-36 w-44 h-44 rounded-full bg-[#edd6cb]/55" />
        {/* Left edge large circular blob */}
        <div className="absolute top-1/2 -left-36 -translate-y-1/2 w-96 h-96 rounded-full bg-[#edd6cb]/45" />
        {/* Right edge background blobs */}
        <div className="absolute top-2 -right-32 w-[420px] h-[420px] rounded-full bg-[#edd6cb]/45" />
        <div className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-[#edd6cb]/35" />
      </div>

      {/* Main Dual Cards Container */}
      <div className="relative z-20 max-w-[1380px] mx-auto px-4 sm:px-8 lg:px-12">
        <div className="relative w-full rounded-[28px] border border-[#efc0ad] bg-[#fff5f0] shadow-[0_8px_30px_rgba(232,111,71,0.05)] grid grid-cols-1 lg:grid-cols-2 overflow-visible">

          {/* ================= CIRCUIT TRACKS & CONNECTED NODES ================= */}

          {/* 1. Top-Left Circuit Line: comes from screen left edge, curves down to meet top-left corner */}
          <div className="hidden xl:block absolute -top-10 left-0 w-full h-10 pointer-events-none overflow-visible z-20">
            <svg className="w-full h-full overflow-visible" fill="none">
              {/* Circuit Path: Starts from off-screen left, curves down and lands at top border x = 60 */}
              <path
                d="M -600 0 L 32 0 A 28 28 0 0 1 60 28 L 60 40"
                stroke="#efc0ad"
                strokeWidth="1.5"
              />
              {/* Circuit node along this horizontal path */}
              <g transform="translate(-40, 0)">
                <circle cx="0" cy="0" r="11" fill="#E86F47" opacity="0.22" />
                <circle cx="0" cy="0" r="7" fill="#E86F47" />
                <circle cx="0" cy="0" r="2.5" fill="#ffffff" opacity="0.9" />
              </g>
            </svg>
          </div>

          {/* Node directly on Top-Left border (x = 60) */}
          <div className="hidden xl:flex absolute -top-2.5 left-[60px] -translate-x-1/2 items-center justify-center z-30 pointer-events-none">
            <span className="w-5 h-5 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
              <span className="w-3 h-3 rounded-full bg-[#E86F47] flex items-center justify-center">
                <span className="w-1 h-1 rounded-full bg-white opacity-95"></span>
              </span>
            </span>
          </div>

          {/* 2. Bottom-Left Circuit Line extending from bottom-left corner to left screen edge */}
          <div className="hidden xl:flex items-center absolute right-full bottom-0 h-[1.5px] bg-[#efc0ad] w-[50vw] pointer-events-none z-20">
            {/* Node along the left horizontal line */}
            <div className="absolute right-24 sm:right-32 top-1/2 -translate-y-1/2">
              <span className="w-5 h-5 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
                <span className="w-3 h-3 rounded-full bg-[#E86F47] flex items-center justify-center">
                  <span className="w-1 h-1 rounded-full bg-white opacity-95"></span>
                </span>
              </span>
            </div>
          </div>

          {/* Node directly on Bottom-Left corner */}
          <div className="hidden xl:flex absolute -bottom-2 -left-2 items-center justify-center z-30 pointer-events-none">
            <span className="w-5 h-5 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
              <span className="w-3 h-3 rounded-full bg-[#E86F47] flex items-center justify-center">
                <span className="w-1 h-1 rounded-full bg-white opacity-95"></span>
              </span>
            </span>
          </div>

          {/* 3. Center Divider Circuit Node (between Left and Right cards) */}
          <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 items-center justify-center pointer-events-none">
            <div className="absolute w-8 h-[1.5px] bg-[#efc0ad]"></div>
            <span className="relative w-6 h-6 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
              <span className="w-3.5 h-3.5 rounded-full bg-[#E86F47] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white opacity-95"></span>
              </span>
            </span>
          </div>

          {/* 4. Right Circuit Line extending from right border to right screen edge */}
          <div className="hidden xl:flex items-center absolute left-full top-1/2 -translate-y-1/2 h-[1.5px] bg-[#efc0ad] w-[50vw] pointer-events-none z-20">
            {/* Node along the right horizontal line */}
            <div className="absolute left-24 sm:left-32 top-1/2 -translate-y-1/2">
              <span className="w-5 h-5 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
                <span className="w-3 h-3 rounded-full bg-[#E86F47] flex items-center justify-center">
                  <span className="w-1 h-1 rounded-full bg-white opacity-95"></span>
                </span>
              </span>
            </div>
          </div>

          {/* Node directly on Right border */}
          <div className="hidden xl:flex absolute -right-2.5 top-1/2 -translate-y-1/2 items-center justify-center z-30 pointer-events-none">
            <span className="w-5 h-5 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
              <span className="w-3 h-3 rounded-full bg-[#E86F47] flex items-center justify-center">
                <span className="w-1 h-1 rounded-full bg-white opacity-95"></span>
              </span>
            </span>
          </div>

          {/* ================= LEFT CARD: FOR STUDENTS ================= */}
          <div className="relative p-8 sm:p-10 lg:p-12 flex flex-col md:flex-row items-center justify-between gap-8 lg:border-r border-[#efc0ad] group">
            {/* Left Content Column */}
            <div className="flex flex-col items-start gap-6 max-w-[280px] sm:max-w-[300px]">
              {/* Badge: For Students */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#faebe3] border border-[#f5c4b5]/80 text-[#2c221e] text-xs font-mono font-medium shadow-xs">
                <svg className="w-4 h-4 text-[#d56b43]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                <span>For Students</span>
              </div>

              {/* Title */}
              <h3 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold font-mono text-[#1f1a17] tracking-tight leading-[1.12]">
                Practice<br />
                and Learn<span className="text-[#E86F47]">.</span>
              </h3>

              {/* CTA Button */}
              <Link
                href="/auth?mode=signup&role=student"
                className="inline-flex items-center gap-3.5 pt-1 group/btn"
              >
                <span className="w-9 h-9 rounded-full bg-[#E86F47] text-white flex items-center justify-center shadow-xs transition-transform duration-300 group-hover/btn:translate-x-1 group-hover/btn:scale-105">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </span>
                <span className="font-mono text-sm font-bold text-[#1f1a17] group-hover/btn:text-[#E86F47] transition-colors">
                  Get Started
                </span>
              </Link>
            </div>

            {/* Right Graphic: Quiz 3D Illustration */}
            <div className="relative shrink-0 flex items-center justify-center">
              <img
                src="/student-card-graphic.png"
                alt="Practice and Learn"
                className="w-52 sm:w-60 md:w-64 lg:w-72 h-auto object-contain select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>

          {/* ================= RIGHT CARD: FOR TEACHERS ================= */}
          <div className="relative p-8 sm:p-10 lg:p-12 flex flex-col md:flex-row items-center justify-between gap-8 border-t lg:border-t-0 border-[#efc0ad] group">
            {/* Left Content Column */}
            <div className="flex flex-col items-start gap-6 max-w-[280px] sm:max-w-[300px]">
              {/* Badge: For Teachers */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#faebe3] border border-[#f5c4b5]/80 text-[#2c221e] text-xs font-mono font-medium shadow-xs">
                <svg className="w-4 h-4 text-[#d56b43]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>For Teachers</span>
              </div>

              {/* Title */}
              <h3 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold font-mono text-[#1f1a17] tracking-tight leading-[1.12]">
                Create<br />
                and Manage<span className="text-[#E86F47]">.</span>
              </h3>

              {/* CTA Button */}
              <Link
                href="/auth?mode=signup&role=teacher"
                className="inline-flex items-center gap-3.5 pt-1 group/btn"
              >
                <span className="w-9 h-9 rounded-full bg-[#E86F47] text-white flex items-center justify-center shadow-xs transition-transform duration-300 group-hover/btn:translate-x-1 group-hover/btn:scale-105">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </span>
                <span className="font-mono text-sm font-bold text-[#1f1a17] group-hover/btn:text-[#E86F47] transition-colors">
                  Get Started
                </span>
              </Link>
            </div>

            {/* Right Graphic: Create & Manage 3D Illustration */}
            <div className="relative shrink-0 flex items-center justify-center">
              <img
                src="/teacher-card-graphic.png"
                alt="Create and Manage"
                className="w-52 sm:w-60 md:w-64 lg:w-72 h-auto object-contain select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
