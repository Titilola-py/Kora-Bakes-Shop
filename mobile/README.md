# Kora Bakes - Mobile App

Expo + React Native app for the Kora Bakes shop. It is a **second client of the
existing backend**, not a new product:

- **One auth system.** The same Supabase project as the website, so signing in
  with the same account gives you the same user id.
- **One cart.** `GET /api/cart` is the source of truth. The app keeps no local
  cart that could drift from the website.
- **One catalogue.** Products come from `/api/products` on the live API.

No second cart, no second database, no new login system.

## Requirements

- Node.js 22.13+ (SDK 57 needs it)
- Expo Go on your Android phone, from the Play Store
- The phone and this PC on the same Wi-Fi network

## Setup

```bash
cd mobile
npm install
```

Create `mobile/.env` (copy `.env.example`):

```bash
EXPO_PUBLIC_API_BASE_URL=https://kora-bakes.onrender.com
EXPO_PUBLIC_SUPABASE_URL=https://wkxxspiqkdnrnwahrkyl.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Only publishable values belong in this file. `EXPO_PUBLIC_*` values are compiled
into the app bundle, so never put the Supabase service-role key, the database
password, the Paystack secret or the Mailgun key here.

## Run

```bash
npm start          # then scan the QR code with Expo Go
npm run android    # Android emulator / USB device
npm run typecheck  # tsc --noEmit
```

**For a physical phone, `EXPO_PUBLIC_API_BASE_URL` must be the deployed URL
(`https://kora-bakes.onrender.com`), never `localhost`.** A phone cannot reach
your PC's `localhost`.

## Signing in

The app offers **two** ways in, both against the same Supabase project:

- **Continue with Google** — the same Google account used on the website.
- **Email + password** — an alternative for accounts that have a password.

Both resolve to the same Supabase user id for the same account, and therefore
to the same shared cart.

### Google sign-in requires a build, not Expo Go

**Expo Go cannot run this flow.** Per the Expo docs:

> Expo Go cannot be used for local development and testing of OAuth or OpenID
> Connect-enabled apps due to the inability to customize your app scheme.

The redirect must come back to *this app*, which means Android needs the
`korabakes://` scheme registered. Expo Go only registers `exp://`. Google
sign-in therefore needs a **development build** or a **standalone APK**.

Email/password still works in Expo Go, which is handy for quick UI checks.

### One-time Supabase setup

Add the app's redirect URI to the allow list:

> Supabase Dashboard → Authentication → URL Configuration → Redirect URLs

```
korabakes://auth/callback
```

Leave the existing web URL (`https://kora-bakes.onrender.com`) in place — the
website depends on it. **Do not remove it.**

### Building the APK

With EAS (cloud build, no local Android SDK required):

```bash
npx eas-cli login          # free Expo account, first time only
npx eas-cli build -p android --profile preview
```

You get a download link to an APK. Install it on the phone and the app runs
standalone — no laptop needed afterwards, which suits a demo.

For a build that hot-reloads from your PC:

```bash
npx eas-cli build -p android --profile development
# install the APK, then start Metro and open the dev build on the phone
```

### ⚠️ Windows path note

This project lives in `Crumb & Bloom` — the `&` breaks npm's generated `.bin`
shims on Windows, so **`npx expo <command>` fails** with
`'Bloom\mobile\node_modules\.bin\' is not recognized...`. Use the Expo CLI
directly instead:

```bash
node ./node_modules/expo/bin/cli <command>   # instead of `npx expo <command>`
# e.g.  node ./node_modules/expo/bin/cli config --type public
```

`npm start`, `npm run typecheck` and **`npx eas-cli`** are unaffected and work
as written (eas-cli runs from npm's cache, not from `.bin`).

`node ./node_modules/expo/bin/cli run:android` also works but needs the Android SDK installed locally,
which is a considerably larger setup.

## How the shared cart works

Every authenticated request sends the Supabase access token:

```
Authorization: Bearer <supabase access token>
```

The backend verifies the token and derives the user itself. The app never sends
a `user_id` as the source of truth.

| Action        | Request                                              |
| ------------- | ---------------------------------------------------- |
| Load cart     | `GET /api/cart`                                      |
| Add / set qty | `PUT /api/cart/items/{product_id}` `{quantity}`      |
| Remove        | `DELETE /api/cart/items/{product_id}`                |
| Clear         | `DELETE /api/cart`                                   |

Each mutation returns the whole recalculated cart, and the app renders that
response directly. Quantities and totals are always computed by the server.
The cart also re-fetches when the app returns to the foreground.

## Project layout

```
src/
  app/                      # Expo Router routes
    _layout.tsx             # providers + auth gate
    login.tsx               # sign in / sign up
    (shop)/                 # signed-in tabs
      _layout.tsx           # tab bar + live cart badge
      index.tsx             # product list
      cart.tsx              # server cart
      account.tsx           # profile + sign out
    product/[id].tsx        # product detail
  components/               # ProductCard, CartRow, Button, Feedback, BrandMark
  lib/
    api.ts                  # typed client for the existing API
    supabase.ts             # Supabase client + session persistence
    theme.ts                # colours, spacing, money formatting
  providers/
    AuthProvider.tsx        # session state
    CartProvider.tsx        # server cart state
scripts/smoke.ts            # live smoke test
```

## Verifying it works

Check the build and types:

```bash
npm run typecheck
npx expo export --platform android   # must complete without errors
```

Live smoke test against the real API (reads credentials from the environment,
writes nothing to disk, and restores your cart afterwards):

```powershell
$env:EXPO_PUBLIC_API_BASE_URL='https://kora-bakes.onrender.com'
$env:EXPO_PUBLIC_SUPABASE_URL='https://wkxxspiqkdnrnwahrkyl.supabase.co'
$env:EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_...'
$env:SMOKE_EMAIL='you@example.com'
$env:SMOKE_PASSWORD='your-password'
node --experimental-strip-types scripts/smoke.ts
```

## Troubleshooting

**"Unable to resolve module react-native-worklets"** - that package is a peer
dependency of `react-native-reanimated`. Install it with
`npx expo install react-native-worklets`.

**"Could not reach the bakery"** - check `EXPO_PUBLIC_API_BASE_URL` is the
deployed host and the phone has internet. Restart the app after editing `.env`;
Expo caches env vars at bundle time.

**Products load but the basket is empty** - that is expected if you have not
added anything. Add an item on the website, then reopen the app tab; it
re-fetches on foreground.

**Sign-in says the account does not exist** - see the Google note above.