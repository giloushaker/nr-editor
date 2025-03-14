# NewRecruit Data Editor

## Description

NewRecruit Data Editor is a desktop application built with Electron, designed to provide a user-friendly and up-to-date editor for data files used in tabletop wargames. Inspired by the popular Battlescribe's data editor, our app aims to be a reliable alternative that continues to receive regular updates.

## Motivation

The motivation behind creating NewRecruit Data Editor stems from the frustration many tabletop wargaming enthusiasts have experienced due to the lack of updates and the negative behavior of the developer behind Battlescribe. Our goal is to provide a viable solution that not only offers an intuitive user interface but also ensures ongoing development and community involvement.

## Key Features

Continuous updates and improvements: We are committed to regularly updating and improving NewRecruit Data Editor to ensure it remains relevant and up-to-date with the latest tabletop wargaming requirements.

Community-driven development: We welcome and value the feedback and suggestions from our community. Your input plays a crucial role in shaping the future direction of NewRecruit Data Editor.

## Installation

To install NewRecruit Data Editor, follow these steps:

Download the latest release from the [Releases](https://github.com/giloushaker/nr-editor/releases)
page.

Choose the appropriate installer for your operating system (Windows, macOS, Linux).

Run the installer and follow the on-screen instructions to complete the installation process.

Once installed, launch the NewRecruit Data Editor application on your desktop.

If you are on a MAC you may have to run 
```
$ xattr -c <path/to/application.app>
```
to remove the "App Is Damaged and Can’t Be Opened. You Should Move It To The Trash" popup 


## Usage

Launch the NewRecruit Data Editor application.

Select the system you want to edit, or create a new one.

Open an existing data file or create a new one.

Save your changes.

Enjoy playing with your updated data file!

## Development

## Setup

Make sure to install the dependencies:

```bash
# yarn
yarn install

# npm
npm install

# pnpm
pnpm install
```

Initialize the submobules (code shared with newrecruit.eu)
```bash
git submodule update --init --recursive
```

## Development Server

Start the development server on `http://localhost:3005`

```bash
npm run dev
```

Start the Electron Application (No hot reload)
```bash
npm run electron
```

## Production

Build the application for production:

```bash
npm run build
```

Locally preview production build:

```bash
npm run preview
```
