# Alcobosh

Personal alcohol unit tracker. React + Vite + Firebase.

- Quick-add tiles for typical drinks (size + ABV pre-set)
- Long-press a tile to log a one-off drink with a different ABV
- Units auto-calculated on save: `(ml × ABV%) / 1000`
- Weekly cap with progress bar; visual warning approaching daily limit
- Combined week block (total + 7-day heatmap)
- Calendar view: month grid with units per day
- Free Day marker (with celebration) — extends the AF streak
- Alcohol-free day streak counter
- Edit/delete recent entries (including date)
- Anonymous device pairing via 6-digit code (Firestore sync)

## Run locally

```
npm install
npm run dev
```

## Firebase

Drop your project's web config into [`src/firebase.js`](src/firebase.js). Without it the app falls back to `localStorage` (single-device).

Required Firebase setup:
- Anonymous auth enabled
- Firestore database created
- Rules in `firestore.rules` published

## Stack

Vanilla React (no framework), Tailwind CSS, Firebase Web SDK. Single-page app, no router. Hosted at <https://simon-bristow.github.io/alcobosh/>.

## Storage keys

LocalStorage keys retain the legacy `alcbosh:*` prefix (`alcbosh:settings`, `alcbosh:drinks`, `alcbosh:dataUid`) so existing users don't lose their data when the app was renamed from Alcbosh to Alcobosh.
