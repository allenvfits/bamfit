# BAM FIT ownership and launch

Anthony owns the business and must authorize his own Stripe account, bank details, and identity verification. The code is prepared for this model; it does not transfer any external account automatically.

## Hosting and repository
Transfer the GitHub repository to Anthony's confirmed GitHub username or organization after he accepts. Deploy into his confirmed Render workspace and place the domain registration/DNS under his control. Keep the developer as an invited collaborator only if he wants ongoing support. The current repository remains allenvfits/bamfit until an actual transfer is completed.

## Database and email
Use a dedicated BAM FIT Supabase project owned by Anthony. Apply setup.sql there for the payment connection and paid-order inbox. Existing clients, contact_forms, packages, bookings, pnf_appointments, nutrition_plans and upcoming_bookings schema must already exist for the legacy management routes. Verify that schema before launch. Do not use another client's database. Configure Anthony's email sender and a strong unique ADMIN_SECRET that is delivered securely to Anthony. Do not put credentials into GitHub or browser code.

## Connect setup
1. Configure Stripe Connect OAuth on the platform that provides the integration. Set STRIPE_SECRET_KEY and STRIPE_CONNECT_CLIENT_ID from the same platform and mode. OAuth token exchange requires credentials permitted by Stripe for that endpoint; use restricted credentials where supported.
2. Set FRONTEND_URL to the exact HTTPS BAM FIT domain and register that origin plus /api/connect/callback in Stripe OAuth redirect settings.
3. Set a connected-account webhook for /api/payments/webhook with checkout.session.completed and checkout.session.async_payment_succeeded. Use its signing secret as STRIPE_WEBHOOK_SECRET.
4. Anthony opens /owner.html, enters his owner access key and authorizes his own Stripe account. Only the account ID and mode are stored. Account replacement is blocked to prevent silently rerouting payments.
5. Confirm live mode and active card-payment capability in the owner page. Account capability retrieval uses Accounts v2; verify the connected account supports the merchant configuration before launch. No platform-account payment fallback exists.
6. Run a Stripe test-mode purchase, signed webhook, repeat delivery and account-restriction check. Mock tests are not a substitute for these live integration checks.

Checkout creates direct charges on Anthony's connected account and takes no application fee. Anthony manages payouts, refunds, disputes, and account requirements in his full Stripe Dashboard. For an embedded owner dashboard expansion, add Stripe's notification_banner and account_management components.

## Service delivery
Paid orders are recorded once per Checkout Session in the owner inbox with fulfillment pending. Anthony must coordinate appointments and fulfill purchases. No placeholder appointment or automatic credits are generated. Nutrition remains contact-only because advertised monthly coaching needs separately configured recurring billing.

## Verification completed in code
Use npm ci, npm test, npm start. Check /health and all seven HTML pages. Review desktop/mobile styling. Complete real database, email, OAuth, webhook and Stripe test-mode acceptance checks before telling the client checkout is live or issuing a final completion invoice.

Local validation: all five automated tests pass. The browser environment blocked localhost, so desktop/mobile visual acceptance is still required on the deployment preview.
