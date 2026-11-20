# Hotel Sparkk Deluxe — Full-stack starter

This package adds a Node.js/Express + MongoDB booking API, Razorpay Checkout and a basic admin dashboard. Your existing hotel design is not included or redesigned: copy your current HTML file to `public/index.html` and copy your existing `images/` folder plus `hero.mp4` into `public/`.

## 1. Install
- Install Node.js 20+ and MongoDB (local) or create a MongoDB Atlas database.
- In this folder run `npm install`.
- Copy `.env.example` to `.env` and fill in MongoDB and Razorpay **test** credentials.
- Set a long random `JWT_SECRET` and a strong `ADMIN_PASSWORD`.
- Run `npm run seed` once to create the six room categories.
- Run `npm run dev`, then open `http://localhost:5000`.

## 2. Connect your existing booking form
In your existing `#bf` form:
- Keep IDs `bf`, `ci`, `co`, `gu`, `rt`, `nm`.
- Add a required phone input: `<label for="ph">Phone</label><input id="ph" type="tel" required>`
- Optionally add email: `<label for="em">Email</label><input id="em" type="email">`
- Change the submit button text to `Pay & Book Now`.
- Remove the old JavaScript WhatsApp `#bf` submit listener. Keep the other existing slideshow/gallery/nav JavaScript.
- Add these two scripts just before `</body>`:
  `<script src="https://checkout.razorpay.com/v1/checkout.js"></script>`
  `<script src="/booking-integration.js"></script>`

The online booking form requires a specific room type; "Any room" is not accepted. Update room prices and actual physical room counts before accepting real bookings. Prices in `src/seed.js` are example amounts only.

## 3. Admin
Open `http://localhost:5000/admin.html` and sign in using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.
Admin APIs:
- `GET /api/admin/dashboard`
- `GET /api/admin/bookings`
- `PATCH /api/admin/bookings/:id/status`
- `POST /api/admin/rooms`
- `PATCH /api/admin/rooms/:id`

## 4. Important payment/booking notes
- Start with Razorpay test keys. Never put `RAZORPAY_KEY_SECRET`, MongoDB credentials, or `JWT_SECRET` in frontend code.
- The server verifies Razorpay's order/payment signature before confirming a booking.
- Configure a Razorpay webhook for production and verify webhook signatures before relying on webhook events. This starter intentionally does not expose an unverified webhook handler.
- The current inventory check and 10-minute pending hold are a starter implementation. For a multi-room hotel or concurrent traffic, use a MongoDB transaction and per-physical-room/per-night inventory locking before going live. Do not accept live payments until this is load-tested.
- Cancellation here changes booking status only; it does not automatically refund a Razorpay payment. Process refunds from the Razorpay dashboard and record them separately.
- Add HTTPS, backups, privacy/terms/refund policies, input validation, monitoring and production deployment configuration before launch.

## API quick test
`GET /api/rooms`
`GET /api/availability?checkIn=2027-01-10&checkOut=2027-01-12`

## Note about room inventory
The seeded `totalUnits` values are placeholders. Set them to the hotel's actual number of rooms in each category. The room names and categories match your current website.
