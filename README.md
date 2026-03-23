# TalentLens — Backend API

**AI-Powered Freelancer Intelligence & Gated Bid Access System**

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/Gemini_2.0_Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://aistudio.google.com)

---

## Overview

This is the NestJS REST API powering TalentLens. It handles job creation, freelancer applications, and the AI scoring pipeline that gates bid access based on profile-to-role fit.

The frontend repo lives at [talentlens-frontend](https://github.com/your-username/talentlens-frontend).

---

## Tech Stack

| | |
|---|---|
| Framework | NestJS · TypeScript |
| Runtime | Node.js 20+ |
| Database | Supabase (PostgreSQL) |
| AI Engine | Google Gemini 2.0 Flash |
| Deployment | Render |

---

## Project Structure

src/
├── common/
│   └── config/
├── database/
│   ├── migration/
│   └── base-model.ts
├── guards/
├── jobs/
│   ├── docs/
│   ├── dtos/
│   ├── model/
│   ├── services/
│   ├── jobs.controller.ts
│   └── jobs.module.ts
├── applications/
│   ├── docs/
│   ├── dtos/
│   ├── model/
│   ├── services/
│   ├── applications.controller.ts
│   └── applications.module.ts
├── scoring/
│   ├── services/
│   └── scoring.module.ts   ← no controller
├── app.module.ts
└── main.ts
---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com) API key

### Installation

```bash
git clone https://github.com/Dev-musty/Talent-Lens.git
cd talentlens-backend
npm install
```

### Environment Variables

```bash
cp .env.example .env
```

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
PORT=3000
```

### Run

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

API runs at `http://localhost:3000`

---

## API Reference

### `POST /jobs`
Create a new job. Returns a unique shareable link.

```json
// Request
{
  "title": "React Developer for fintech app",
  "description": "We need a developer to build...",
  "budget_min": 500,
  "budget_max": 1500,
  "required_tier": "mid",
  "client_name": "Acme Inc"
}

// Response 201
{
  "id": "uuid",
  "unique_link": "a3f7b91c",
  "apply_url": "/apply/a3f7b91c",
  "dashboard_url": "/dashboard/a3f7b91c"
}
```

`required_tier` accepts: `any` · `junior` · `mid` · `senior`

---

### `GET /jobs/:link`
Returns job details. Used by the frontend Apply page to display the role.

---

### `POST /jobs/:link/apply`
Submit a freelancer profile. Triggers the full AI scoring pipeline synchronously and returns the result immediately.

```json
// Request
{
  "freelancer_name": "John Doe",
  "skills": ["React", "TypeScript", "Node.js"],
  "years_experience": 3,
  "portfolio_urls": ["https://github.com/johndoe"],
  "bio": "Frontend developer specialising in...",
  "testimonies": "John delivered the project ahead of schedule...",
  "proposed_rate": 1200
}

// Response 201 — Admitted
{
  "access_granted": true,
  "inferred_tier": "mid",
  "fit_score": 82,
  "overall_rank_score": 78,
  "rank_position": 2,
  "total_applicants": 5,
  "ai_reasoning": "Strong React and TypeScript skills align well with the role requirements..."
}

// Response 201 — Rejected
{
  "access_granted": false,
  "inferred_tier": "junior",
  "rejection_reason": "This role requires Mid-level or above. Your profile was assessed as Junior based on 1 year of experience and limited portfolio depth."
}
```

---

### `GET /jobs/:link/applications`
Returns the ranked shortlist of admitted applicants.

| Query Param | Values |
|---|---|
| `tier` | `junior` · `mid` · `senior` |
| `sort` | `rank` (default) · `price` · `testimony` |

---

### `GET /health`
Health check endpoint. Returns `200` — used by UptimeRobot to keep the Render free tier warm.

---

## Scoring Logic

Application scoring is powered by **Gemini 2.0 Flash** at runtime. The backend sends a structured recruiter prompt and expects strict JSON with:

- `inferred_tier`
- `fit_score`
- `testimony_score`
- `ai_reasoning`
- `tier_reasoning`

If Gemini fails (network, auth, or invalid JSON), the API gracefully falls back to a pending-safe scoring state:

- `inferred_tier: "unknown"`
- `fit_score: 0`
- `testimony_score: 0`
- `ai_reasoning: "Scoring pending -- please check back shortly."`

```
overall_rank_score = (fit_score × 0.50)
                   + (testimony_score × 0.30)
                   + (price_score × 0.20)
```

| Signal | Source | Weight |
|---|---|---|
| `fit_score` | Gemini — skill and experience match against job description | 50% |
| `testimony_score` | Gemini — quality and relevance of past client feedback | 30% |
| `price_score` | Computed — alignment of proposed rate with budget range | 20% |

**Tier gate:**

| Job Requires | Allowed Tiers |
|---|---|
| `any` | Junior, Mid, Senior |
| `junior` | Junior only |
| `mid` | Mid, Senior |
| `senior` | Senior only |

Experience tier is always **inferred by Gemini** from profile evidence — never self-declared.

---

## Deployment — Render

| Setting | Value |
|---|---|
| Service Type | Web Service |
| Build Command | `npm install && npm run build` |
| Start Command | `node dist/main.js` |
| Health Check Path | `/health` |

Set all `.env` variables in the Render dashboard under **Environment**.

> Register the `/health` endpoint on [UptimeRobot](https://uptimerobot.com) with a 14-minute ping interval to prevent cold starts during demos.

---

## Scripts

```bash
npm run start:dev    # Start with hot reload
npm run build        # Compile TypeScript
npm run start:prod   # Run compiled output
npm run gitkeep      # Populate empty folders with .gitkeep before committing
```

---

## Built For

> DevCareer × Raenest Freelancer Hackathon — March 2026

**Author:** Oluwatobiloba (Mustapha Ridwan) · Lagos, Nigeria
