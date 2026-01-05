# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a work hours (kosu) management system for tracking employee work time and task categories. It consists of a React frontend and Django REST API backend.

## Development Commands

### Frontend (from `frontend/` directory)
```bash
npm start          # Start dev server at http://localhost:3000
npm run build      # Production build
npm test           # Run tests with Vitest (watch mode)
npm run test:run   # Run tests once
npm run test:ui    # Run tests with Vitest UI
```

### Backend (from root directory)
```bash
python manage.py runserver           # Start Django dev server at http://localhost:8000
python manage.py migrate             # Apply database migrations
python manage.py makemigrations      # Create new migrations
python manage.py qcluster            # Start Django-Q task queue worker
```

### Environment Setup
- Backend requires `.env` file with: `SECRET_KEY`, `DEBUG`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`
- Frontend uses `REACT_APP_API_BASE_URL` for API endpoint configuration

## Architecture

### Frontend Structure (`frontend/src/`)
- **Page modules**: `KosuPage/`, `MemberPage/`, `TeamPage/`, `DefinitionPage/`, `InquirPage/`, `AdministratorPage/`, `MainPage/`
- **Shared components**: `Components/` - reusable UI (Pagination, TableContainer, Loading, various Select components)
- **Routing**: Defined in `index.tsx` using React Router DOM
- **Styling**: CSS files in `styles/` organized by page

### Backend Structure
- **Django app**: `kosu/` - main application
  - `views/` - API endpoints organized by feature (kosu_views, member_views, team_views, def_views, inquiry_views, main_views, asynchronous_views)
  - `models.py` - Database models
  - `urls.py` - URL routing
  - `tasks.py` - Django-Q async tasks for backup/restore
  - `signals.py` - Model change tracking
- **Django project**: `hozen_another/` - settings and configuration

### Key Models
- `member` - Employee with shop assignment and break time settings
- `Business_Time_graph` - Daily work records with task categories
- `team_member` - Team composition (up to 15 members)
- `kosu_division` - Work category definitions (up to 50 categories per version)
- `AsyncTask` / `History` - Task tracking and audit logs

### API Pattern
- REST API using Django REST Framework
- Session-based authentication
- Frontend makes requests to `/api/` endpoints
- 401 responses should redirect to `/login`

### Testing
- Frontend uses Vitest + React Testing Library
- Tests located in `frontend/src/tests/`
- Mock axios and child components for unit tests

## Tech Stack

**Frontend**: React 19, TypeScript, Material-UI 7, React Router DOM 7, Axios, Chart.js, FullCalendar, Vitest

**Backend**: Django 4.2, Django REST Framework, Django-Q (async tasks), PostgreSQL, WhiteNoise
