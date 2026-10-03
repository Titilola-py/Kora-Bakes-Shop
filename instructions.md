I want you to use the provided Figma bakery website design as the PRIMARY UI DESIGN for Kora Bakes.

This time, it is okay to closely reproduce the visual design and layout of the Figma reference.

The goal is to turn the Figma bakery storefront into a working Kora Bakes frontend connected to the EXISTING backend/API.

Do not redesign the concept from scratch.
Do not create a different visual direction.
Use the Figma reference as the design source.

==================================================
PROJECT
==================================================

Brand:
Kora Bakes

Tagline:
"Bakes worth coming back for."

Use the Figma bakery website as the primary visual reference for:

- page structure
- section order
- navigation
- hero composition
- typography hierarchy
- spacing
- product grids
- category navigation
- promotional/story sections
- image treatment
- buttons
- footer
- responsive behavior
- overall visual rhythm

Adapt the content and branding to Kora Bakes.

==================================================
VERY IMPORTANT: EXISTING BACKEND
==================================================

The backend already exists and works.

THIS IS A FRONTEND TASK.

Do NOT modify:

- backend code
- API contracts
- database schema
- database records
- business logic
- authentication
- cart logic
- checkout logic
- order logic

Do not start over.

Reuse the existing frontend/API architecture wherever possible.

==================================================
CATALOG DATA
==================================================

The existing API is the ONLY source of truth for products.

Use the actual product fields returned by the API:

- id
- name
- description
- category
- price_kobo
- unit
- image_url
- badge

Prices must continue to be formatted correctly as Nigerian naira on the frontend.

Do NOT copy the Figma template's sample:

- product names
- prices
- categories
- descriptions
- badges
- promotional copy
- images

Replace all sample catalog content with the actual Kora Bakes API data.

Do not invent additional products just to make the page match the reference.

If the Figma template has more product sections than the current catalog can support, adapt the layout to the six existing products rather than inventing products.

==================================================
BRANDING
==================================================

Replace the reference brand with:

KORA BAKES

Tagline:
"Bakes worth coming back for."

Use the existing Kora Bakes visual palette:

Background:
#F4F7FB

White:
#FFFFFF

Text:
#17243B

Cobalt:
#2457D6

Orange:
#EA762B

Magenta:
#C84B7B

Borders:
#DDE5F0

However, prioritize the Figma reference's visual structure and composition.

Adapt its colors to Kora Bakes rather than automatically reproducing the reference's brown/black palette.

==================================================
IMAGES
==================================================

Use the image_url provided by the existing API.

Do not replace product images with random images.

Do not add unrelated stock photography.

Match the Figma reference's image proportions, cropping, framing, and placement as closely as practical using the existing product images.

If the reference uses dramatic food photography, make the existing Kora Bakes product photography as visually prominent as possible.

==================================================
PAGE STRUCTURE
==================================================

Reproduce the overall structure of the Figma reference, adapted to the available Kora Bakes data.

The structure can include:

1. Compact header/navigation
2. Large food-focused hero
3. Category navigation/strip
4. Product sections
5. Brand/story section where appropriate
6. Additional product/category presentation if supported by the existing data
7. Strong footer

Do not create fake content to fill sections.

If a reference section requires information that does not exist in the Kora Bakes application, either:

- omit the section, or
- create a purely visual equivalent using existing Kora Bakes content.

Never invent factual business information.

==================================================
PRODUCT LAYOUT
==================================================

Follow the Figma reference's product presentation closely.

Use its:

- card proportions
- image placement
- spacing
- typography hierarchy
- price positioning
- category treatment
- badges
- button styling
- section spacing

But populate everything with real API data.

Add-to-cart controls must remain functional.

==================================================
CATEGORY NAVIGATION
==================================================

Use the actual categories returned by the API.

Do not hard-code categories that aren't present.

The current application should dynamically determine available categories.

Category selection/filtering must continue to work with the existing frontend logic/API.

==================================================
CART + CHECKOUT
==================================================

The visual design can be changed to match the Figma reference, but functionality must remain intact.

Verify:

- Add to cart
- Remove from cart
- Quantity changes
- Cart count
- Cart contents
- Checkout
- Order submission

Do not break any existing flow.

==================================================
RESPONSIVE DESIGN
==================================================

Follow the Figma reference's responsive behavior where available.

For desktop, reproduce the reference's composition closely.

For mobile, make sure:

- navigation remains usable
- product images remain prominent
- product information remains readable
- buttons are easy to tap
- cart access remains obvious
- there is no broken horizontal overflow
- product sections adapt cleanly

Do not simply scale the desktop design down.

==================================================
IMPLEMENTATION APPROACH
==================================================

Before changing code:

1. Inspect the current frontend.
2. Identify the existing API integration.
3. Identify product components.
4. Identify category/filter components.
5. Identify cart components.
6. Identify checkout components.
7. Identify reusable UI components.

Then adapt the existing frontend to reproduce the Figma design.

Reuse working components and functionality wherever possible.

Do NOT unnecessarily rewrite the entire application.

==================================================
IMPORTANT
==================================================

The priority order is:

1. Match the Figma reference's design closely.
2. Make it feel like Kora Bakes.
3. Use real API/catalog data.
4. Preserve all existing functionality.
5. Make the result responsive and polished.

Do not give me another design proposal.

Do not research additional references.

Do not redesign the concept.

Implement the Figma design.

After implementation, run the existing frontend build/check commands and fix any errors.

Then briefly report:

- files changed
- functionality preserved
- build/check result
- anything in the Figma design that had to be adapted because of the existing Kora Bakes data.