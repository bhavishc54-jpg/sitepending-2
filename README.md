# For My Princess Nikita

A romantic interactive website with music, animated hearts, question flow, a gift reveal, and a final love-note screen.

## Open In Preview

Open `index.html` directly. This file is a standalone preview build, so it does not require Node.js, npm, Vite, or a dev server.

## Run Locally

The original React/Vite source is still included in `src/`. To run that development version, install Node.js 20 or newer and use:

```bash
npm install
npm run dev
```

Then open the local URL Vite prints in the terminal, usually:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

The production website will be generated in `dist/`.

## Notes

- The background music file is included at `src/assets/bgm.mp3`.
- The app stores progress in `localStorage` under `nikita-love-react`.
- The review submit button currently posts to the existing Formspree endpoint in `src/App.tsx`.
