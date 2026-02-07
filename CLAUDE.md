# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NR-Editor (NewRecruit Data Editor) is a desktop and web application for editing tabletop wargame data files (BattleScribe format). It's built with Electron, Vue 3, Nuxt 3, and TypeScript.

## Essential Commands

```bash
# Initial setup (required)
npm install
git submodule update --init --recursive

# Development
npm run dev          # Web dev server on http://localhost:3005
npm run electron     # Run as Electron desktop app

# Building
npm run build        # Build for production
npm run buildelectron # Build Electron distributable

# Version management
npm run increment-version  # Bump patch version
```

## Architecture Overview

### Technology Stack
- **Frontend**: Vue 3 + Nuxt 3 (Composition API)
- **Desktop**: Electron 24
- **State**: Pinia with persistence
- **Database**: Dexie (IndexedDB)
- **Styling**: WindiCSS + SCSS
- **Build**: Vite + Rollup

### Project Structure
```
├── components/         # Vue components
│   ├── catalogue/     # Main editor UI (left/right/builder panels)
│   ├── dialog/        # Dialogs and context menus
│   └── util/          # Reusable UI components
├── pages/             # Nuxt pages (routing)
├── stores/            # Pinia state management
├── electron/          # Electron-specific code
├── assets/shared/     # BattleScribe logic (git submodule)
├── default-scripts/   # Built-in automation scripts
└── scripts/           # Import/export utilities
```

### Core Data Model
The application works with BattleScribe's hierarchical data format:
- **GameSystem**: Top-level game container
- **Catalogue**: Game-specific rules and units
- **Entries**: Tree structure of game entities

Key classes in `assets/shared/battlescribe/` extend the base BattleScribe format with editor functionality.

### State Management
Primary Pinia stores:
- **editorStore**: Main editor state, undo/redo, clipboard
- **cataloguesState**: Persistent catalogue metadata
- **editorUIState**: UI state persistence
- **settingsState**: User preferences

### Component Architecture
The catalogue editor uses a three-panel layout:
1. **Left Panel**: Tree navigation with drag-and-drop
2. **Right Panel**: Context-sensitive property editors
3. **Builder Panel**: Spreadsheet-like bulk editing

### Platform Differences
- **Web Mode**: Uses IndexedDB for storage
- **Electron Mode**: Direct file system access, file watching, auto-updates

## Development Guidelines

### Code Conventions
- Use Vue 3 Composition API for new components
- TypeScript strict mode is **disabled** - be cautious with types
- Follow existing patterns in neighboring files
- Prettier formatting: 120 character line width

### Key Patterns
- **Reactive updates**: Use Vue's reactivity system properly
- **State changes**: Always go through Pinia stores
- **File operations**: Check if running in Electron vs web mode
- **Performance**: Test with large catalogues (1000+ entries)

### Common Tasks
- **Adding a new field**: Update both the UI component and the corresponding store
- **New import format**: Add to `scripts/import/` following existing patterns
- **Script development**: Use the script API in `default-scripts/` as examples

### Testing & Quality
**Note**: No automated tests or linting are configured. Manual testing is required.

## Important Notes
- The `assets/shared/` directory is a git submodule - changes here affect newrecruit.eu
- BattleScribe compatibility is crucial - don't break the data format
- Performance matters - the editor handles catalogues with thousands of entries
- Both web and Electron modes must work - test platform-specific code
