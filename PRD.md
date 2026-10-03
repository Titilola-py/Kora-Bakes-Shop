# Product Requirements: Kora Bakes

## Product concept

Kora Bakes is a fictional, neighborhood bakery in Lagos selling fresh breads and Nigerian-inspired bakes for pickup. It is a focused shop demo, not an operating business or a payment processor.

## Problem and goal

Visitors should be able to browse a believable product catalog, sign in with Google, place a pickup order, receive a well-formatted confirmation email, and later sign back in to see that order. Each account must see only its own orders.

## Primary users

- A customer browsing from a phone or laptop.
- The shop owner reviewing the customer's order confirmation and pickup details.
- A reviewer checking Google sign-in, order persistence, logout, and email delivery.

## Required experience

1. Visitors can view the shop, its products, prices, and product details without signing in.
2. Visitors can add items to a cart, change quantities, remove items, and review a total.
3. Checkout requires a signed-in Google account and collects a pickup date and customer name; it does not collect a street address or card details.
4. The backend recalculates prices from the server catalog, validates quantities, and stores an order and item snapshots in Supabase Postgres.
5. An authenticated user can see only their own orders.
6. Google sign-in persists across reloads. Signing out ends the local Supabase session. Signing back in restores the user's order history.
7. A successful checkout triggers a branded Mailgun confirmation email to the authenticated account's email address.
8. Payment processing is out of scope. Checkout records an order for pickup without charging the customer.

## Initial catalog

Prices are illustrative NGN demo prices and can be edited in the catalog module.

| Product | Price | Description |
| --- | ---: | --- |
| Butter Croissant Box | ₦6,500 | Six flaky, all-butter pastries |
| Banana Bread | ₦7,000 | One moist loaf with ripe banana |
| Danish Cookies | ₦4,500 | A 300 g jar of crisp, buttery cookies |
| Cupcakes, box of 6 | ₦2,500 | A box of cupcakes |
| Cupcakes, box of 12 | ₦5,000 | A box of cupcakes |
| Cinnamon Rolls | ₦8,500 | Six glazed rolls baked to order |
| Whole Wheat Loaf | ₦9,000 | A freshly baked whole wheat loaf |

## Success criteria

- Google OAuth sign-in and sign-out work in production.
- Unauthenticated visitors can browse, but cannot create or retrieve orders.
- A valid checkout creates a durable order with line items and the correct server-calculated total.
- An authenticated account can retrieve its own order after logout, browser close, and later sign-in.
- Another account cannot read or alter that order.
- Mailgun receives a real send request after successful checkout; the customer receives a readable HTML and plain-text receipt.
- Invalid products, quantities, tokens, and cross-user order lookups are rejected.
- The app works on mobile and desktop, with empty, loading, and error states.

## Architecture decisions

- React + Vite frontend, FastAPI backend, Supabase Auth and Postgres, Mailgun email, Render Free for the demo app.
- Supabase Auth owns Google OAuth and user sessions; the React client uses the Supabase public anon key. Google client credentials live only in the Supabase provider configuration.
- The API verifies each bearer token with Supabase Auth and scopes every order query by the verified user ID. The database connection string and Mailgun API key are server-only secrets.
- Products are a server-owned catalog. Order items store snapshots of product names and prices so old receipts do not change if the catalog changes later.
- Checkout is pickup-only, with no address or payment fields. Prices use integer minor units (kobo) in storage to avoid floating-point errors.
- Local development uses SQLite. Production uses Supabase Postgres through `DATABASE_URL`.
- Mail delivery happens after the order is committed. A mail failure must not erase the order; the API reports the email status and logs a safe diagnostic.
- External accounts, OAuth credentials, Mailgun domain verification, and production secrets must be created and configured by the user.

## Risks and limits

- Supabase Free may pause inactive projects. Order data is in Supabase, not Render's ephemeral filesystem; resume the Supabase project if it pauses.
- Render Free may sleep while idle, delaying the first page load.
- Mailgun's sending domain must be verified. Sandbox domains can only send to authorized recipients.
- Demo prices and the bakery concept are fictional; replace them before representing a real business.
- The app collects a Google account email and pickup order history. Do not enter real customer details until privacy, retention, and access needs are reviewed.

## Phases

1. PRD, repository instructions, and integration checklist.
2. Shop catalog, cart, and responsive experience.
3. Supabase Google authentication and session handling.
4. Postgres schema and per-user order API.
5. Checkout and order history.
6. Mailgun confirmation template and delivery result.
7. Local automated validation and production setup guide.
8. Human configures Supabase, Google OAuth, Mailgun, and Render secrets; run production end-to-end checks.
