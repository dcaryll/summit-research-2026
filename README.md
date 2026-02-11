# User Feedback Studies Monorepo

This repository contains two React applications designed for user feedback studies, both built with Red Hat branding and design principles.

## Applications

### App 1: The Wizard of OS
**Location:** `app1/`

Interactive terminal-style application for collecting user feedback. Features a command-line interface where users can input questions and receive a multi-step questionnaire flow, culminating in a dashboard showing word clouds and peer statistics.

**Key Features:**
- Terminal-style interface with command prompt (`admin@redhat-future:~$`)
- Dynamic cycling example prompts
- Multi-step question flow with multiple choice options
- Dashboard with word cloud visualization and peer statistics
- Robust data storage: IndexedDB, localStorage backup, and backend API integration
- Offline-first approach with automatic retry when connection is restored
- Red Hat branding with custom fonts and colors

### App 2: User Study Screener
**Location:** `app2/`

A kiosk-style "choose your adventure" screener that allows user research participants to select their focus area for completing a study. Participants can choose from predefined study tracks or be randomly assigned one.

**Key Features:**
- Large, clear focus cards for easy selection
- Kiosk-friendly interface
- Random study assignment option
- Multi-page study flow with various question types (text, multiple-choice, rating)
- Completion screen with next steps guidance
- Same robust data storage as App 1 (IndexedDB, localStorage, backend API)
- Red Hat Display font for headlines, Red Hat Text for body copy
- Blue accent colors for interactive elements

## Setup

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

Each app has its own dependencies. Navigate to the app directory and install:

**For App 1:**
```bash
cd app1
npm install
```

**For App 2:**
```bash
cd app2
npm install
```

## Development

### Running Locally

**App 1:**
```bash
cd app1
npm run dev
```

**App 2:**
```bash
cd app2
npm run dev
```

Each app will start on its own development server (typically `http://localhost:5173`).

## Backend API Configuration

Both apps support backend API integration for data persistence. To configure:

1. Copy the `.env.example` file to `.env` in the respective app directory:
   ```bash
   # For App 1
   cp app1/.env.example app1/.env
   
   # For App 2
   cp app2/.env.example app2/.env
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

**App 1:**
```bash
cd app1
npm run build
```

**App 2:**
```bash
cd app2
npm run build
```

Build outputs will be in the `dist/` directory of each app.

## Project Structure

```
.
├── app1/                 # Terminal-style feedback application
│   ├── src/
│   │   ├── components/
│   │   ├── images/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── app2/                 # Focus selector screener application
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

## License

Private repository for Red Hat user research studies.
