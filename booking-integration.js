/*
  Add this script AFTER Razorpay checkout.js and before </body>.
  Replace the existing #bf WhatsApp submit handler with this handler.
  Required form IDs from your current HTML: bf, ci, co, gu, rt, nm.
  Add phone/email inputs to your form (IDs: ph and em) before using this script.
*/
document.getElementById("bf").addEventListener("submit", async function (event) {
  event.preventDefault();
  const button = this.querySelector('button[type="submit"]');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Checking availability...";

  try {
    const roomLabel = document.getElementById("rt").value;
    const roomMap = {
      "Deluxe Room": "DELUXE",
      "Round Bed Room": "ROUND",
      "Premium Room": "PREMIUM",
      "Classic Double Room": "CLASSIC",
      "Standard Room": "STANDARD",
      "Comfort Room": "COMFORT"
    };
    if (roomLabel === "Any room") throw new Error("Please select a room type to book online.");
    const phone = document.getElementById("ph")?.value?.trim();
    const email = document.getElementById("em")?.value?.trim() || "";
    if (!phone) throw new Error("Please enter your phone number.");

    const payload = {
      name: document.getElementById("nm").value.trim(),
      phone, email, roomCode: roomMap[roomLabel],
      checkIn: document.getElementById("ci").value,
      checkOut: document.getElementById("co").value,
      guests: Number(document.getElementById("gu").value.replace("+", ""))
    };

    const response = await fetch("/api/bookings/create-order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const order = await response.json();
    if (!response.ok) throw new Error(order.error || "Could not create booking.");

    const checkout = new Razorpay({
      key: order.razorpayKeyId,
      amount: order.amount,
      currency: order.currency,
      name: "Hotel Sparkk Deluxe",
      description: `${order.roomName} · ${order.nights} night(s)`,
      order_id: order.orderId,
      prefill: { name: order.customer.name, email: order.customer.email, contact: order.customer.phone },
      notes: { bookingRef: order.bookingRef },
      theme: { color: "#d4a84b" },
      handler: async function (payment) {
        const verifyResponse = await fetch("/api/payments/verify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingRef: order.bookingRef, ...payment })
        });
        const verified = await verifyResponse.json();
        if (!verifyResponse.ok) {
          alert(verified.error || "Payment verification failed. Contact the hotel with booking reference " + order.bookingRef);
          return;
        }
        alert("Booking confirmed! Your booking reference is " + order.bookingRef);
        document.getElementById("bf").reset();
      },
      modal: { ondismiss: function () { alert("Payment window closed. Your room hold expires in about 10 minutes. Booking reference: " + order.bookingRef); } }
    });
    checkout.on("payment.failed", function () {
      alert("Payment failed. Please try again or contact the hotel.");
    });
    checkout.open();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});
