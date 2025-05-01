# Variable Font Viewer

Its like Dinamo's Font Gauntlet, but with hot reload. Meaning that anytime there are changes to the font file they will instantly be reflected on the screen

## Features

- Hot reload
- Load sample text from .txt files
- Preview variable fonts with adjustable axes
- View fonts in different modes: plain text, waterfall, and glyphs view

## Setup

1. Install dependencies:
```
npm install
```

2. Start the server:
```
npm start
```

3. Open your browser and go to: `http://localhost:3000`

## Usage

- Add fonts to `data/fonts/` folder
- Select a font from the dropdown menu
- Adjust the variable font axes using the sliders
- Play animation on them
- Enter your own text or load the sample text to `data/texts`
- Customize text appearance using the controls in the sidebar

## Requirements

- Node.js
- Variable font files (.ttf, .otf, .woff, or .woff2) in the `data/fonts/` directory


