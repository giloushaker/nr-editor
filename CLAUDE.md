# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NewRecruit Data Editor is a desktop application built with Electron and Nuxt 3 that serves as a data editor for tabletop wargames. It's designed as an alternative to Battlescribe's data editor, providing a user-friendly interface for creating and editing game system data files.

## Technology Stack

- **Frontend**: Nuxt 3 (Vue.js 3 + TypeScript)
- **Desktop**: Electron 24.3.1 
- **Styling**: WindiCSS + SCSS
- **State**: Pinia stores
- **Database**: Dexie (IndexedDB wrapper)
- **Build**: Vite + Rollup

## Development Commands

```bash
# Development
npm run dev              # Start dev server (port 3005)
npm run electron         # Run Electron app (no hot reload)

# Building
npm run build            # Build for Electron
npm run buildelectron    # Build Electron installer
npm run buildweb         # Build for web
npm run generate         # Generate static files

# Publishing
npm run buildelectron:publish  # Build and publish Electron app
npm run deploy                 # Deploy to GitHub Pages
```

## Architecture

### Hybrid Application Structure
- Works as both desktop (Electron) and web application
- Single Page Application with client-side routing using Nuxt 3
- Component-based architecture with Vue 3 Composition API

### Key Directories

- **`/pages/`** - Route pages (index, catalogue, system, scripts, search)
- **`/components/`** - Vue components organized by feature
  - `catalogue/` - Main editor with left_panel, right_panel, builder_panel
  - `my_catalogues/` - Catalogue management UI
  - `scripts/` - Script execution interface
- **`/stores/`** - Pinia state management (editorStore, cataloguesState, settingsState, uiState)
- **`/assets/shared/`** - Git submodule with shared code including Battlescribe format handling and type definitions
- **`/electron/`** - Electron-specific code (main.ts, preload.js, renderer.ts)
- **`/default-scripts/`** - Built-in automation scripts for game systems (nrt9a, t9a, tow)

### State Management
Uses Pinia with key stores:
- `editorStore` - Main editor state and operations
- `cataloguesState` - Catalogue data and management
- `settingsState` - User preferences and configuration
- `uiState` - UI state and theming

### File Format Support
- Battlescribe format (.cat, .gst files)
- JSON import/export
- XML parsing and generation
- ZIP archive handling

## Development Patterns

### Shared Code Integration
The `/assets/shared/` directory is a Git submodule containing:
- Battlescribe format utilities in `battlescribe/`
- TypeScript type definitions in `types/`
- Shared utilities used by both this editor and newrecruit.eu

### Script System
Extensible automation via TypeScript scripts in `/default-scripts/`:
- Game system-specific importers and processors
- Data transformation utilities
- Built-in scripts for popular game systems

### Component Architecture
Vue components follow feature-based organization:
- Catalogue editor split into logical panels (left/right/builder)
- Reusable utility components in `components/util/`
- Page-level components in `/pages/` directory

### Electron Integration
- Main process in `electron/main.ts`
- Preload script for secure renderer communication
- Renderer integration in `electron/renderer.ts`
- Supports both development and production modes