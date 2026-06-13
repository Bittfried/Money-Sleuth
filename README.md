# Money Sleuth

An offline-first Expo mobile app for tracking capital, expenses, and money people owe you.

## Stack

- Expo SDK 56 development builds
- Expo Router file-based navigation
- Expo SQLite for durable local data
- EAS profiles for development, preview, and production builds

Existing AsyncStorage records are imported into SQLite once on the first launch after upgrading.

## Development

Install dependencies and verify the project:

```bash
npm install
npm run doctor
```

Create the native development client locally:

```bash
npm run android
npm start
```

Or build an installable development APK with EAS:

```bash
npm run build:dev:android
```

`npm start` targets the custom development client. Expo Go is not used by this project.

For local Android builds, use JDK 17 or 21. `npm run android` generates the native Android project when needed. To regenerate it manually:

```bash
npx expo prebuild --clean --platform android
```

## Builds

```bash
npm run build:preview:android
npm run build:production
```

The preview profile creates an internally distributable Android APK. The production profile creates store-ready builds.

## Structure

```text
app/                         Expo Router routes and root layout
src/data/DataContext.js      SQLite-backed state, migration, and backup logic
src/components/              Shared interface components
src/screens/                 Application screens
eas.json                     Development, preview, and production profiles
```
