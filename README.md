# Kora Bakes

A polished bakery shop demo. Customers browse baked goods, sign in with Google, check out for pickup, receive a Mailgun email receipt, and return later to see their own orders.

Read [PRD.md](PRD.md) for scope and [AGENTS.md](AGENTS.md) for coding and validation rules.

## Stack

- React + Vite
- FastAPI
- Supabase Auth (Google OAuth) and Supabase Postgres
- Paystack hosted checkout (TEST mode)
- Mailgun API for confirmation emails
- Render Free web service for the demo deployment

## Brand assets

The Kora Bakes logo is a custom SVG seal (an ink ring around a cobalt "K" whose arms are croissant folds). It lives in two places and both must stay in sync:

- `frontend/src/BrandMark.jsx` draws the React version and shares it with the header, footer, and sign-in card. It takes `variant="seal"` (ring + monogram, the default), `variant="glyph"` (monogram only, for favicon/mobile use), and `mono` (every stroke follows `currentColor`, for single-colour packaging and stamps).
- `frontend/public/favicon.svg` is the static standalone glyph referenced by `frontend/index.html`.

Colours come from the CSS tokens `--kora-mark-ring` and `--kora-mark-form` (set in the identity block at the end of `frontend/src/styles.css`), so the mark follows the palette automatically. Accent colour for the "BAKES" descriptor is `--clay` on light backgrounds and `#ffc08f` over the hero photograph and dark footer. The mark is stroke-based with no raster assets, so it stays sharp at any size.

## Current status

The shop UI, catalog, cart, pickup checkout, account-scoped order history, API, and integration code are implemented. Paystack is restricted to TEST secret keys; configure a Paystack test key before trying hosted checkout. Catalog prices and product photos are illustrative demo content, not a real bakery's live menu. External Supabase/Google Cloud/Paystack/Mailgun configuration is human-led. Never put the Paystack secret key, Mailgun key, or database password in frontend code.

## Run locally

1. Copy `backend/.env.example` to `backend/.env` and set the Supabase URL, public anon key, a Postgres `DATABASE_URL`, a Paystack **Test Secret Key**, and a callback URL matching the frontend origin. SQLite can be used locally for API development, but it does not provide the production persistence guarantee.
2. Configure Google as a Supabase Auth provider. Add the local app URL `http://localhost:5173` to Supabase's allowed redirect URLs. See [Google OAuth setup](#google-oauth-setup).
3. Configure Mailgun values in `backend/.env` to send confirmation email. The email is sent only after the backend verifies a successful Paystack transaction. Without Mailgun values, the paid order is still saved and its email status reports that email is not configured.
4. Start the API and frontend in two terminals:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Paystack TEST setup

1. Use a Paystack account in **Test Mode** and copy its Test Secret Key into `PAYSTACK_SECRET_KEY` in `backend/.env`. The backend rejects keys that do not start with `sk_test_`; never add the key to frontend variables or source files.
2. Set `PAYSTACK_CALLBACK_URL` to the frontend origin, including the trailing slash, such as `http://localhost:5173/`. If Vite chooses another port, update this value to match.
3. For deployed testing, set the callback URL to the public app origin and configure Paystack's test webhook URL as `https://<your-app-host>/api/payments/webhook`.
4. Apply `supabase/migrations/20261003000000_add_paystack_payments.sql` to the existing Supabase database before deploying the backend. It adds payment state and payment-attempt records. Local SQLite adds its missing payment columns without deleting existing orders.
5. Submit a pickup order. Paystack hosts the payment page; the backend initializes with the saved order total, verifies the returned reference and transaction details, and sends the existing email only after verification. Use Paystack's official test payment details in Test Mode.

The return page verifies payment through the authenticated API. The webhook independently validates Paystack's HMAC-SHA512 signature and verifies the transaction with Paystack. Failed or cancelled attempts remain unpaid; the cart is preserved so payment can be retried.

## Supabase setup

1. Create a Supabase project in a region convenient for your users.
2. In Project Settings, copy the project URL and anon/publishable key. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the API environment. Do not use a service-role key in the browser.
3. In Supabase SQL Editor, run the migration in `supabase/migrations/` (or use the Supabase CLI workflow if you already use it).
4. Copy the Postgres connection string into `DATABASE_URL`. The API selects the installed psycopg v3 driver automatically. For Render, use the Supabase pooler connection string and require SSL.
5. In Authentication → URL Configuration, set the production Site URL to the Render app URL and add the local and production callback destinations to Redirect URLs.
6. In Authentication → Providers → Google, enable Google and add the OAuth Client ID and Client Secret from Google Cloud Console.

## Google OAuth setup

1. In Google Cloud Console, create/select a project and configure the OAuth consent screen / Google Auth Platform branding and audience.
2. Create an OAuth client of type **Web application**.
3. Add the app's local origin (`http://localhost:5173`) and production origin (`https://<your-render-service>.onrender.com`) as authorized JavaScript origins.
4. Add the Supabase Google callback URL shown on the Supabase Google provider page as an authorized redirect URI.
5. Copy the OAuth Client ID and Client Secret into the Supabase Google provider settings. Keep the client secret out of this repository.
6. Confirm both local and deployed app URLs are in Supabase's Redirect URLs allowlist.

Supabase's current guide: [Sign in with Google](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Mailgun setup

1. Create a Mailgun account and add a sending domain.
2. Complete the DNS verification steps Mailgun shows for that domain.
3. Create/copy an API key and set `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, and `MAILGUN_FROM_EMAIL` on the backend/Render service.
4. Test checkout with a recipient address you control, then confirm the message arrives and renders in HTML and plain text.

See Mailgun's [message sending API](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/post-v3--domain-name--messages).

## Deploy to Render

1. Push this repository to GitHub and create a Render Blueprint from `render.yaml`.
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL`, `PAYSTACK_SECRET_KEY`, and `PAYSTACK_CALLBACK_URL` as Render secrets/environment variables. Use a Paystack Test Secret Key (`sk_test_...`) and the deployed app origin for the callback.
3. Use the deployed Render URL for Supabase Site URL and allowed redirect URLs, and add it to Google Cloud authorized JavaScript origins.
4. Deploy, then test Google sign-in, place a pickup order, verify it appears in order history after signing out/in, and receive the Mailgun email.

Render Free services sleep after inactivity and use an ephemeral filesystem. This app uses Supabase Postgres for orders, so orders are not stored on Render's filesystem. Supabase Free projects may pause after a week of low activity; resume them in Supabase if that happens. Check [Render Free limits](https://render.com/docs/free) and [Supabase Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

## Validation

```powershell
cd backend
python -m pip install -r requirements-dev.txt
pytest
```

```powershell
cd frontend
npm ci
npm run build
```
