# User Feedback Studies Monorepo

This repository contains two React applications designed for user feedback studies, both built with Red Hat branding and design principles.

## Applications

### The Wizard of OS
**Location:** `wizard-of-os/`

Interactive terminal-style application for collecting user feedback. Features a command-line interface where users can input questions and receive a multi-step questionnaire flow, culminating in a dashboard showing word clouds and peer statistics.

**Key Features:**
- Terminal-style interface with command prompt (`admin@redhat-future:~$`)
- Dynamic cycling example prompts
- Multi-step question flow with multiple choice options
- Dashboard with word cloud visualization and peer statistics
- Robust data storage: IndexedDB, localStorage backup, and backend API integration
- Offline-first approach with automatic retry when connection is restored
- Red Hat branding with custom fonts and colors

### Choose your adventure (user study screener)
**Location:** `choose-your-adventure/`

A kiosk-style screener that allows user research participants to select their focus area for completing a study. Participants can choose from predefined study tracks or be randomly assigned one.

**Key Features:**
- Large, clear focus cards for easy selection
- Kiosk-friendly interface
- Random study assignment option
- Multi-page study flow with various question types (text, multiple-choice, rating)
- Completion screen with next steps guidance
- Same robust data storage as the Wizard of OS app (IndexedDB, localStorage, backend API)
- Red Hat Display font for headlines, Red Hat Text for body copy
- Blue accent colors for interactive elements

## Setup

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

Each app has its own dependencies. Navigate to the app directory and install:

**Wizard of OS:**
```bash
cd wizard-of-os
npm install
```

**Choose your adventure:**
```bash
cd choose-your-adventure
npm install
```

## Development

### Running Locally

**Wizard of OS:**
```bash
cd wizard-of-os
npm run dev
```

**Choose your adventure:**
```bash
cd choose-your-adventure
npm run dev
```

Each app will start on its own development server (typically `http://localhost:5173`).

## Backend API Configuration

Both apps support backend API integration for data persistence. To configure:

1. Copy the `.env.example` file to `.env` in the respective app directory:
   ```bash
   # Wizard of OS
   cp wizard-of-os/.env.example wizard-of-os/.env
   
   # Choose your adventure
   cp choose-your-adventure/.env.example choose-your-adventure/.env
   ```

2. Update the `VITE_API_ENDPOINT` variable in each `.env` file with your API endpoint URL:
   ```
   VITE_API_ENDPOINT=https://your-api-endpoint.com/api/responses
   ```

### Data Storage Strategy

Both applications implement a multi-layered data storage approach:

1. **Primary:** Backend API (if configured and online)
2. **Secondary:** IndexedDB (browser database)
3. **Tertiary:** localStorage (backup)
4. **Offline Queue:** Failed API requests are queued and automatically retried when connection is restored

This ensures data is never lost, even in offline scenarios.

## Building for Production

**Wizard of OS:**
```bash
cd wizard-of-os
npm run build
```

**Choose your adventure:**
```bash
cd choose-your-adventure
npm run build
```

Build outputs will be in the `dist/` directory of each app.

## Project Structure

```
.
├── wizard-of-os/                 # Terminal-style feedback application
│   ├── src/
│   │   ├── components/
│   │   ├── images/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── choose-your-adventure/        # Focus selector screener application
│   ├── src/
│   │   ├── components/
│   │   ├── images/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **IndexedDB** - Client-side database
- **CSS3** - Styling with Flexbox, Grid, and animations

## Design System

Both apps follow Red Hat Design System principles:
- **Typography:** Red Hat Display (headlines), Red Hat Text (body)
- **Colors:** Custom palette with brand red (`#ee0000`) and blue accents (`#0066CC`)
- **Accessibility:** WCAG-compliant contrast ratios and keyboard navigation

## Deployment

Each app can be deployed independently. Both apps are configured for Vercel deployment, but can be adapted for other platforms.

### GitHub Pages

A GitHub Actions workflow builds and deploys both apps to GitHub Pages on every push to `main`.

**Required setup:** In the repo **Settings → Pages**, set **Source** to **GitHub Actions**. Without this, the workflow will not deploy.

**URLs after deployment:**
- The Wizard of OS: `https://<username>.github.io/summit-research-2026/wizard-of-os/`
- Choose your adventure: `https://<username>.github.io/summit-research-2026/choose-your-adventure/`

## License

Private repository for Red Hat user research studies.
