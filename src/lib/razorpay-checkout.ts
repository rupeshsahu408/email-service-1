const RZP_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Resolves when Razorpay Checkout.js is available (loads script if needed). */
export function ensureRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as Window & { Razorpay?: unknown };
  if (w.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (!document.querySelector(`script[src="${RZP_CHECKOUT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = RZP_CHECKOUT_SRC;
      script.async = true;
      script.onerror = () =>
        reject(new Error("Could not load payment checkout"));
      document.body.appendChild(script);
    }

    const start = Date.now();
    const poll = window.setInterval(() => {
      if ((window as Window & { Razorpay?: unknown }).Razorpay) {
        window.clearInterval(poll);
        resolve();
      } else if (Date.now() - start > 15000) {
        window.clearInterval(poll);
        reject(new Error("Payment checkout timed out"));
      }
    }, 50);
  });
}
