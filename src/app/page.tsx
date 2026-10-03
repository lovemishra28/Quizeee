import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import RoleCards from '@/components/RoleCards';
import InstantQuizSection from '@/components/InstantQuizSection';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fff5f0] text-foreground font-mono overflow-x-hidden relative selection:bg-[#E86F47] selection:text-white flex flex-col">

      {/* Shared Navbar */}
      <Navbar />

      {/* Main Hero Container */}
      <div className="relative w-full h-[calc(100vh-64px)] min-h-[580px] flex items-center justify-center overflow-hidden bg-[#fff5f0]">

        {/* --- Background SVG Elements (Blobs & Precise Circuit Lines) --- */}
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          <svg
            viewBox="0 0 1024 522"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 w-full h-full"
          >
            {/* Background Blobs matching reference geometry */}
            {/* Blob 1 - Left Circle */}
            <circle cx="-10" cy="235" r="245" fill="#edd6cb" fillOpacity="0.55" />

            {/* Blob 2 - Right Arch */}
            <path
              d="M 810 302 L 810 105 A 77.5 77.5 0 0 1 965 105 L 965 302 Z"
              fill="#edd6cb"
              fillOpacity="0.55"
            />

            {/* Blob 3 - Bottom Right Circle */}
            <circle cx="920" cy="480" r="180" fill="#edd6cb" fillOpacity="0.55" />

            {/* --- Exact Circuit Lines (Tracks) --- */}
            {/* Left Path 1: From top header line, straight down, curves left to left edge */}
            <path
              d="M 168 0 L 168 212 A 46 46 0 0 1 122 258 L -50 258"
              stroke="#E86F47"
              strokeWidth="1.5"
              fill="none"
            />

            {/* Left Path 2: In from left edge, crosses Path 1, curves down to bottom edge */}
            <path
              d="M -50 207 L 177 207 A 33 33 0 0 1 210 240 L 210 700"
              stroke="#E86F47"
              strokeWidth="1.5"
              fill="none"
            />

            {/* Bottom Horizontal line & S-curve to right exit */}
            <path
              d="M -50 463 L 842 463 A 41 41 0 0 0 883 422 L 883 209 A 57 57 0 0 1 940 152 L 1100 152"
              stroke="#E86F47"
              strokeWidth="1.5"
              fill="none"
            />

            {/* Right Vertical line from header, curving right to bottom exit */}
            <path
              d="M 940 0 L 940 394 A 57 57 0 0 0 997 451 L 1100 451"
              stroke="#E86F47"
              strokeWidth="1.5"
              fill="none"
            />

            {/* --- Animated Circuit Circles/Dots Moving Continuously Along Line Tracks --- */}
            {/* Dot 1: Moves along Left Path 1 (Top entry -> Down -> Curve Left -> Left exit) */}
            <g>
              <animateMotion
                path="M 168 -25 L 168 212 A 46 46 0 0 1 122 258 L -60 258"
                dur="7s"
                repeatCount="indefinite"
              />
              <circle cx="0" cy="0" r="14" fill="#E86F47" opacity="0.25">
                <animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.12;0.25" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="0" cy="0" r="9.5" fill="#E86F47" />
              <circle cx="0" cy="0" r="3.5" fill="#ffffff" opacity="0.65" />
            </g>

            {/* Dot 2: Moves along Left Path 2 (Left entry -> Across -> Curve Down -> Bottom exit) */}
            <g>
              <animateMotion
                path="M -60 207 L 177 207 A 33 33 0 0 1 210 240 L 210 580"
                dur="8s"
                begin="-4s"
                repeatCount="indefinite"
              />
              <circle cx="0" cy="0" r="14" fill="#E86F47" opacity="0.25">
                <animate attributeName="r" values="12;16;12" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.12;0.25" dur="2.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="0" cy="0" r="9.5" fill="#E86F47" />
              <circle cx="0" cy="0" r="3.5" fill="#ffffff" opacity="0.65" />
            </g>

            {/* Dot 3A: Moves along Bottom Path 3 (Left entry -> Bottom -> Curve Up -> Curve Right -> Right exit) */}
            <g>
              <animateMotion
                path="M -60 463 L 842 463 A 41 41 0 0 0 883 422 L 883 209 A 57 57 0 0 1 940 152 L 1100 152"
                dur="14s"
                begin="0s"
                repeatCount="indefinite"
              />
              <circle cx="0" cy="0" r="14" fill="#E86F47" opacity="0.25">
                <animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.12;0.25" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="0" cy="0" r="9.5" fill="#E86F47" />
              <circle cx="0" cy="0" r="3.5" fill="#ffffff" opacity="0.65" />
            </g>

            {/* Dot 3B: Staggered along Bottom Path 3 for continuous graceful motion */}
            <g>
              <animateMotion
                path="M -60 463 L 842 463 A 41 41 0 0 0 883 422 L 883 209 A 57 57 0 0 1 940 152 L 1100 152"
                dur="14s"
                begin="-7s"
                repeatCount="indefinite"
              />
              <circle cx="0" cy="0" r="14" fill="#E86F47" opacity="0.25">
                <animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.12;0.25" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="0" cy="0" r="9.5" fill="#E86F47" />
              <circle cx="0" cy="0" r="3.5" fill="#ffffff" opacity="0.65" />
            </g>

            {/* Dot 4: Moves along Right Path 4 (Top entry -> Straight Down -> Curve Right -> Right exit) */}
            <g>
              <animateMotion
                path="M 940 -25 L 940 394 A 57 57 0 0 0 997 451 L 1100 451"
                dur="8.5s"
                begin="-2s"
                repeatCount="indefinite"
              />
              <circle cx="0" cy="0" r="14" fill="#E86F47" opacity="0.25">
                <animate attributeName="r" values="12;16;12" dur="2.1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.12;0.25" dur="2.1s" repeatCount="indefinite" />
              </circle>
              <circle cx="0" cy="0" r="9.5" fill="#E86F47" />
              <circle cx="0" cy="0" r="3.5" fill="#ffffff" opacity="0.65" />
            </g>
          </svg>
        </div>

        {/* Main Hero Logo - Adjust width & max-width classes below to scale size */}
        <main className="relative z-10 flex items-center justify-center px-4">
          <img
            src="/quizeee-hero.png"
            alt="quizeee"
            className="w-[72vw] max-w-[860px] min-w-[340px] h-auto select-none pointer-events-none drop-shadow-sm transition-all"
          />
        </main>
      </div>

      {/* Instant Quiz Hub: Host Without Login & Join Live Game */}
      <InstantQuizSection />

      {/* Role Selection Cards: Students & Teachers */}
      <RoleCards />

      {/* Features Section - Scrolling Ticker (Located below the hero section on scroll) */}
      <section id="features" className="py-14 relative z-20 overflow-hidden bg-[#fff5f0] border-t border-[#E86F47]/30">
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused] items-center">
          {[...Array(2)].map((_, loopIndex) => (
            <div key={loopIndex} className="flex items-center">
              {[
                {
                  title: "Create Quizzes",
                  desc: "Create static or competitive quizzes in minutes.",
                  image: "/illustration-step-1.png",
                },
                {
                  title: "Track Progress",
                  desc: "Get insights and analytics instantly.",
                  image: "/illustration-step-2.png",
                },
                {
                  title: "Better Learning",
                  desc: "Make learning interactive and fun.",
                  image: "/illustration-step-3.png",
                },
                {
                  title: "Collaborate Easily",
                  desc: "Share with students and conduct quizzes seamlessly.",
                  image: "/illustration-step-4.png",
                },
              ].map((step, stepIndex) => (
                <div key={stepIndex} className="flex items-center">
                  {/* Step Card */}
                  <div className="flex flex-col items-center justify-center text-center w-[270px] shrink-0 px-2 group select-none">
                    <div className="h-[135px] w-full flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-105">
                      <img
                        src={step.image}
                        alt={step.title}
                        className="max-h-full max-w-full object-contain pointer-events-none drop-shadow-xs"
                      />
                    </div>
                    <h3 className="text-xl font-bold font-mono text-[#282726] tracking-tight mb-2">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 font-mono leading-relaxed text-[13px] max-w-[220px]">
                      {step.desc}
                    </p>
                  </div>

                  {/* Flow Arrow Connector between steps */}
                  <div className="flex items-center shrink-0 px-2 sm:px-4 opacity-90">
                    <div className="w-5 sm:w-8 border-t-2 border-dashed border-[#E86F47]/40"></div>
                    <div className="w-8 h-8 rounded-full bg-[#f8cfc1] flex items-center justify-center text-[#d56b43] shadow-xs">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </div>
                    <div className="w-5 sm:w-8 border-t-2 border-dashed border-[#E86F47]/40"></div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Footer Section matching exact reference design - Sleek, Full-Width with Animated Ball & Bottom Touching Curve */}
      <Footer />

    </div>
  );
}
