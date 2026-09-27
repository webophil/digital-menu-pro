import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { paymentWebhook } from "./webhooks";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/webhooks/payment",
  method: "POST",
  handler: paymentWebhook,
});

export default http;
