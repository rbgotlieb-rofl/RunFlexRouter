# RunFlexRouter

A running route generator that creates circular routes based on your location and preferences, using Mapbox for maps and OpenAI for intelligent route planning.

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Mapbox GL
- **Backend:** Express, TypeScript
- **Database:** Neon (PostgreSQL) via Drizzle ORM
- **APIs:** Mapbox, OpenAI

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later)
- npm (comes with Node.js)

### Installation

1. Clone the repo:
   ```bash
   git clone https://github.com/YOUR_USERNAME/RunFlexRouter.git
   cd RunFlexRouter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment file:
   ```bash
   cp .env.example .env
   ```

4. Open `.env` and fill in your API keys:
   - `MAPBOX_ACCESS_TOKEN` — get one at https://mapbox.com
   - `OPENAI_API_KEY` — get one at https://platform.openai.com

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:5000 in your browser.

## Scripts

- `npm run dev` — Start the development server
- `npm run build` — Build for production
- `npm run check` — Run TypeScript type checking
