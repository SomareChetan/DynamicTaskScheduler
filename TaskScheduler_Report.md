# AI-Integrated Dynamic Task Scheduler (Aetheris) - Project Report

## 1. Project Vision & Overview
The Aetheris Task Scheduler is a proactive, AI-powered scheduling agent designed to treat a user's time as a constrained optimization problem. Unlike traditional passive calendars, this system continuously solves, re-solves, and learns from user behavior to automate and optimize time management.

**Core Principles:**
- **Cognitive Load Reduction:** Users state intent in plain language; AI handles the scheduling math.
- **Adaptability:** Real-time re-optimization based on new events and energy signals.
- **Transparency:** The "XAI Why Engine" explains every scheduling decision in plain English.
- **Continuous Learning:** The system learns from completed and skipped tasks to refine chronotypes and duration estimates.

---

## 2. Technology Stack & Infrastructure

The project utilizes a modern, service-oriented architecture designed for real-time responsiveness and heavy AI computational offloading:

### Frontend & Client
- **Framework:** Next.js 15 (App Router) for server-side rendering, routing, and API endpoints.
- **Core Library:** React 19
- **Styling & Components:** Tailwind CSS and shadcn/ui for accessible, rapid UI development.
- **State & Data Flow:** Zustand for global state management, paired with WebSockets (Socket.io) for real-time updates.
- **Data Visualization & UI:** Recharts (energy/insights dashboards), Framer Motion (animations), and FullCalendar.io (calendar views).

### Backend & API Services
- **API Gateway:** Node.js (Next.js API routes) handling authentication (JWT/OAuth), rate limiting, and request routing.
- **Core Services:** Dedicated Node.js services for Task CRUD operations and Calendar Event syncing.

### AI Core & Machine Learning
- **AI Orchestrator:** Python (FastAPI) serving as the pipeline controller.
- **LLM Integration:** Google Gemini API (`@google/genai`) for Intent/Entity extraction and recursive task decomposition.
- **Optimization Engine:** Custom Python engine utilizing Constraint Satisfaction Problems (CSP) and Genetic Algorithms (GA) to calculate placement scores.
- **Learning Engine:** Reinforcement Learning (simplified Q-Learning) and Linear Regression to adapt to user chronotypes and predict task durations.

### Data Storage & DevOps
- **Relational Database:** PostgreSQL (AWS RDS) for structured schemas (Users, Tasks, Scheduled Slots).
- **Caching:** Redis (ElastiCache) for fast schedule retrieval and session states.
- **Advanced Data:** VectorDB (Pinecone) for embeddings and semantic similarity.
- **Deployment Strategy:** Vercel (Next.js), AWS ECS/Lambda (Python AI services & Node API), CloudFlare (CDN/WAF).

---

## 3. Core AI Pipeline (The Four Stages)

The intelligence of the system flows through a sequential four-stage pipeline:

### Stage 1: Perception (NLP Parser)
Converts unstructured natural language into structured `Task` objects.
- **Entity Extraction:** Uses Gemini to extract task names, deadlines, and estimated durations.
- **Intent Classification:** Categorizes tasks into `DEEP_WORK`, `SHALLOW_WORK`, or `FIXED_EVENT`.
- **Sentiment & Urgency:** Analyzes phrasing for stress or emotional signals to dynamically boost urgency scores.

### Stage 2: Planning (Hierarchical Task Decomposition)
Breaks down complex goals into a Directed Acyclic Graph (DAG) of atomic sub-tasks.
- **Atomic Slicing:** Limits sub-tasks to 30–90 minutes to align with human ultradian focus rhythms.
- **Buffer Injection:** Automatically appends 10-minute buffers for context-switching overhead.

### Stage 3: Optimization Engine
Finds the most optimal arrangement of tasks into available time slots.
- **Placement Score Formula:** Calculates the fitness of a slot based on Chronotype Alignment (Ct), Urgency (Utask), Energy Difficulty Mismatch (Ediff), and Switching Cost (Scost).
- **Genetic Algorithm Solver:** Rapidly evaluates millions of permutations to find the optimal schedule while respecting hard (e.g., deadlines) and soft (e.g., peak focus hours) constraints.

### Stage 4: Learning (Reinforcement Feedback Loop)
Continuously updates the model's predictive weights based on real-world behavior.
- **Predictive Duration Engine:** Uses linear regression to correct historically optimistic user time estimates.
- **RL Weight Update:** Adjusts scheduling coefficients when users skip tasks, report energy crashes, or finish early.

---

## 4. Key Feature Specifications

### A. Deep Work Shield
Scans for fragmented free gaps, merges them into unified blocks, and tags them as protected. Automatically triggers OS-level "Do Not Disturb" modes for focused work.

### B. Conflict Resolution & Ripple Effect
When unexpected events arise, the system auto-resolves conflicts using a heuristic priority order:
1. **Compress:** Shorten shallow work blocks.
2. **Ripple:** Cascade-shift downstream dependent tasks.
3. **Eject / Escalate:** Move low-priority items or alert the user if deadlines are at risk.

### C. XAI "Why" Engine
Every scheduling decision is accompanied by a plain-English explanation. *(e.g., "Scheduled at 10 AM because your focus is 25% higher at this hour and it precedes your deadline.")*

### D. The Vacuum Effect (Gap Optimization)
When a task finishes early, the system identifies the "Temporal Void" and intelligently pulls forward actionable tasks from the backlog that match the void's energy profile.

---

## 5. System Architecture
The platform utilizes a modern service-oriented architecture:
- **Client Layer:** Rich Next.js web application.
- **API Gateway:** Handles authentication, rate limiting, and request routing.
- **AI Orchestrator:** Manages the flow between the NLP Parser, Optimization Engine, and RL Learning modules.
- **Database:** PostgreSQL stores users, tasks, scheduled slots, and feedback events, while Redis caches sessions and optimized daily schedules.

*Generated automatically based on the Aetheris Task Scheduler blueprints and system configuration.*
