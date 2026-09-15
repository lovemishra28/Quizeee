
---

# Quizeee: Master Design & UX Specification (design.md)

## Project Context & Overview

**Project Name:** Quizeee
**Core Concept:** Quizeee is a real-time, interactive educational platform that bridges the gap between static study materials and highly engaging classroom assessments.

At its core, Quizeee leverages artificial intelligence to transform uploaded static documents (like lecture notes or syllabus PDFs) into dynamic, fully formatted multiple-choice quizzes. The platform fundamentally serves two distinct user types: Teachers (who manage content, host live sessions, and review analytics) and Students (who participate in high-energy live games or take self-paced assignments).

**Core Functionalities:**

1. **AI Question Generation (Human-in-the-Loop):** Teachers upload PDFs, the AI generates contextually accurate questions, and the system provides a specialized interface for the teacher to review and edit the questions before saving.
2. **Competitive Live Mode:** A synchronous, highly gamified mode designed for the classroom. The teacher broadcasts a 6-digit room code on a projector. Students join via mobile devices, and a live, dynamically shifting leaderboard tracks scores based on both accuracy and response speed.
3. **Static Scheduled Mode:** An asynchronous mode for homework or formal assessments. Students have a fixed overall timer to complete the quiz independently without the pressure of a live leaderboard.
4. **Post-Quiz Analytics:** The system mathematically aggregates student submissions and generates diagnostic charts, showing teachers exactly which subtopics the classroom struggled with the most.

**Current Page Architecture:**
The platform currently consists of the following foundational pages that require comprehensive UI/UX design:

* **Landing Page (To be designed):** The marketing and introduction front.
* **Authentication Hub (`/auth`):** Login and registration forms for routing users based on their role (Teacher vs. Student).
* **Teacher Dashboard (`/dashboard/teacher`):** The primary command center displaying total quizzes, active sessions, and a quick-action button to create new content.
* **Student Dashboard (`/dashboard/student`):** A streamlined, distraction-free portal focused solely on a massive input field to enter a 6-digit live room code.
* **AI Quiz Creator & Review UI:** A multi-step interface where teachers upload PDFs, input question counts, and then review/edit the generated JSON data via dynamic text fields.
* **Live Host Lobby (`/quiz/live/host/[quizId]`):** The teacher's projector screen displaying the massive room code and a real-time counter of joining students.
* **Student Live Room (`/quiz/live/student/[roomCode]`):** The mobile-first interface where students wait for the host, read questions, and tap multiple-choice options under a high-pressure timer.
* **Static Quiz Interface (`/quiz/static/[quizId]`):** A calmer, self-paced interface with a global countdown timer and previous/next navigation buttons.
* **Analytics Dashboard (`/analytics/[sessionId]`):** A data-dense page featuring high-level metrics (class accuracy) and interactive bar charts breaking down comprehension by subtopic.

---

## 1. Overall Design Vision

The visual identity of Quizeee must bridge the gap between a premium, professional SaaS product and a highly engaging, gamified educational tool. The design philosophy centers on building trust with educators through clean, data-driven interfaces, while keeping students energized through fluid, modern aesthetics.

The appearance should be sleek and contemporary, utilizing ample whitespace, crisp typography, and purposeful use of color to draw attention to primary actions. It must avoid looking like a cluttered, legacy academic portal; instead, it should feel as polished, fast, and intuitive as modern consumer applications like Notion or Discord.

## 2. User Experience (UX) Philosophy

Navigation through Quizeee must be role-dependent and aggressively minimize friction.

* **For Students:** The flow must be near-instantaneous. The UI should guide them from login directly to the room-code input field with zero distractions.
* **For Teachers:** The experience should feel empowering and organized. Complex workflows (like AI generation and database editing) should be broken down into clear, digestible steps with constant system feedback.

Important actions (starting a quiz, ending a session, viewing reports) must be easily discoverable via prominent primary buttons. Transitions between states (e.g., waiting in the lobby to the first question starting) must feel smooth, responsive, and engaging, utilizing micro-interactions to assure the user that the system is operating in real-time.

## 3. Responsive Design Strategy

The platform requires a strict bifurcated approach to responsiveness based on the primary user context.

**Mobile Experience (Primarily Students):**

* **Mobile-First Principles:** Student interfaces (Live Room, Static Quiz) must be designed for mobile screens first.
* **Ergonomics:** Utilize thumb-friendly navigation. Multiple-choice option buttons must be large, easily tappable, and spaced to prevent accidental misclicks during high-speed live games.
* **Minimal Scrolling:** Critical information (the timer, the question text, the options) should fit within a single viewport on standard smartphones without requiring vertical scrolling.

**Desktop/Web Experience (Primarily Teachers/Hosts):**

* **Spacious Layouts:** Teacher dashboards and analytics pages must leverage widescreen real estate effectively, utilizing multi-panel layouts (e.g., displaying a quiz configuration panel next to a live preview).
* **Projector Optimization:** The Live Host Lobby and dynamic leaderboard must be designed for high visibility across a physical classroom, utilizing massive typography and high-contrast elements.

## 4. Master Design System

* **Color Palette:** Establish a primary brand color (e.g., Deep Indigo/Violet) that conveys intelligence and modern tech. Pair this with a clean slate/gray scale for text and borders. Utilize semantic colors strictly for feedback: vibrant Emerald for correct answers and success states, and bold Rose for incorrect answers and destructive actions.
* **Typography Hierarchy:** Employ a highly legible, modern geometric sans-serif (such as Inter or Plus Jakarta Sans). Use heavy, black font weights for active timers and room codes, and medium weights for reading heavy text like question descriptions.
* **Spacing & Elevation:** Standardize on an 8px spacing grid. Use soft, modern border radii (12px to 16px) for all cards and containers. Apply subtle, diffused drop shadows to elevate primary actions and floating active cards, keeping the background layers flat and clean.
* **Iconography:** Use a consistent, rounded icon set (like Lucide or Feather) to aid visual scanning on dashboards.
* **Components:** Button styles must be clear (solid for primary, outlined for secondary, ghost for tertiary). Forms and inputs should feature clear focus states with colored ring borders to aid keyboard navigation.

## 5. Page-by-Page Design Specifications

* **Auth Pages (`/auth`):** Clean, split-screen layout. One side features the login/signup card; the other features a soft, abstract graphic or brand messaging. Clear toggle between "I am a Teacher" and "I am a Student".
* **Teacher Dashboard:** A sidebar or clean top-nav layout. Use modern metric cards at the top for "Total Quizzes" and "Active Sessions". The main body should feature a data table or grid of available quizzes with quick-action dropdowns.
* **Quiz Creator (Human-in-the-Loop):** A step-by-step wizard layout. Step 1 focuses on a large, dashed-border dropzone for PDF uploads. Step 2 transitions to a clean, vertical list of editable cards where teachers can tweak AI-generated text and toggle radio buttons for correct answers.
* **Student Dashboard:** A centered, focused layout. A massive, centrally aligned input field for the 6-digit code, dominating the screen to eliminate confusion.
* **Live Host Lobby & Leaderboard:** Dark mode by default to stand out on projectors. The room code should take up 30% of the screen. The leaderboard must use distinct rows with clear rank numbers, avatar placeholders, and score bars that visually fill based on points.
* **Live Student Room:** High-contrast, color-coded buttons for multiple-choice options. A persistent, floating timer bar pinned to the top of the screen.
* **Analytics Dashboard:** A multi-panel layout. Top row features high-level stat cards. The main body features a responsive bar chart (via Recharts) displaying comprehension by subtopic, wrapped in a clean, white card with subtle borders.

## 6. Functionality-Aware Design

The UI must directly support the underlying technical architecture (WebSockets and AI).

* **Real-Time Synchronization:** Because the Host screen controls the Student screen via WebSockets, the design must include visual cues (like pulsing dots or "Waiting for Host" skeleton screens) to communicate active network states to the student.
* **Speed-Based Scoring:** The student UI must visually reinforce that speed matters. As the timer ticks down, the color of the timer could shift from green to yellow to red, subtly encouraging faster response times.
* **AI Generation:** During PDF processing, utilize engaging, informative loading states (e.g., "Analyzing document...", "Extracting concepts...") rather than a static spinner, making the AI wait time feel active and valuable.

## 7. Modern UI Trends and Premium Features

* **Glassmorphism:** Use frosted glass effects (blur backdrops with slight transparency) for floating elements like the live timer or modal popups, giving a sleek, layered feel.
* **Skeleton Loading States:** Replace all traditional spinners on dashboards with skeleton loaders that mimic the shape of the data cards to make the application feel instantly responsive.
* **Fluid Animations:** Implement smooth, spring-based layout animations (e.g., using Framer Motion) for the live leaderboard so rows seamlessly slide past each other as students change rank, rather than snapping instantly.
* **Dark Mode Support:** Build the design tokens to seamlessly support a dark theme, which is highly preferred in modern SaaS environments and optimal for the live classroom projector view.

## 8. Unique Differentiators

* **Gamified Feedback:** When a student submits a correct answer quickly, trigger a localized micro-interaction (like a subtle confetti burst or a glowing border) on their personal device to boost dopamine and engagement.
* **Streak Indicators:** Add visual fire icons or multipliers next to a student's name on the host leaderboard if they get 3 or more questions right in a row.
* **Interactive Review:** On the analytics page, allow the teacher to click on a specific poorly-performing subtopic bar chart, which smoothly expands to reveal the exact AI question that confused the students.

## 9. Accessibility & Performance

* **WCAG AA Compliance:** Ensure all text passes minimum contrast ratios, especially critical data like timers and question text.
* **Keyboard & Screen Reader Support:** All dashboards and forms must be fully navigable via the `Tab` key, featuring visible focus rings. Ensure the AI review UI includes ARIA labels so screen readers can parse the editable questions.
* **Performance-First UI:** Avoid heavy background images or unoptimized SVG assets in the Live Game rooms. The design must rely on CSS-based styling (gradients, shadows, border-radii) to guarantee sub-millisecond rendering during fast-paced WebSocket updates.

## 10. Implementation Guidance for Developers/AI Tools

* **Component Architecture:** The design should be broken down into strict atomic components (e.g., `QuizCard`, `TimerBadge`, `OptionButton`, `MetricCard`) to ensure reusability across the Static and Live quiz modes.
* **Design Tokens:** Implement the styling using a utility-first approach (like Tailwind CSS), mapping all hex codes and spacing values directly to a centralized configuration file.
* **State Management UI:** Ensure every interactive component has explicitly designed states for `Hover`, `Active`, `Disabled`, and `Loading`. (e.g., The "Start Game" button must have a distinct, greyed-out disabled state if 0 students have joined).