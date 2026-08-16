import { localAuthRouter } from "./local-auth-router";
import { googleAuthRouter } from "./google-auth-router";
import { productRouter } from "./product-router";
import { collectionRouter } from "./collection-router";
import { categoryRouter } from "./category-router";
import { cartRouter } from "./cart-router";
import { orderRouter } from "./order-router";
import { contactRouter } from "./contact-router";
import { newsletterRouter } from "./newsletter-router";
import { adminRouter } from "./admin-router";
import { stripeRouter } from "./stripe-router";
import { configRouter } from "./config-router";
import { analyticsRouter } from "./analytics-router";
import { emailRouter } from "./email-router";
import { campaignRouter } from "./campaign-router";
import { shippingRouter } from "./shipping-router";
import { sendcloudRouter } from "./sendcloud-router";
import { uploadRouter } from "./upload-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  localAuth: localAuthRouter,
  googleAuth: googleAuthRouter,
  product: productRouter,
  collection: collectionRouter,
  category: categoryRouter,
  cart: cartRouter,
  order: orderRouter,
  contact: contactRouter,
  newsletter: newsletterRouter,
  admin: adminRouter,
  stripe: stripeRouter,
  config: configRouter,
  analytics: analyticsRouter,
  email: emailRouter,
  campaign: campaignRouter,
  shipping: shippingRouter,
  sendcloud: sendcloudRouter,
  upload: uploadRouter,
});

export type AppRouter = typeof appRouter;
