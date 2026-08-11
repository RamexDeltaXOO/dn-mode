import {
  mysqlTable,
  mysqlEnum,
  varchar,
  text,
  timestamp,
  decimal,
  int,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

// ── Users ───────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  // Identifiant externe unique : "local_<uuid>" ou "google_<sub>".
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  passwordHash: varchar("password_hash", { length: 255 }),
  googleId: varchar("google_id", { length: 255 }),
  provider: varchar("provider", { length: 50 }).default("local"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Collections ─────────────────────────────────────────────
export const collections = mysqlTable("collections", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  image: varchar("image", { length: 500 }),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Collection = typeof collections.$inferSelect;

// ── Categories ──────────────────────────────────────────────
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  parentId: int("parentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;

// ── Products ────────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  shortDescription: text("shortDescription"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compareAtPrice", { precision: 10, scale: 2 }),
  images: json("images").$type<string[]>(),
  colors: json("colors").$type<string[]>(),
  sizes: json("sizes").$type<string[]>(),
  sku: varchar("sku", { length: 100 }),
  inventoryQuantity: int("inventoryQuantity").default(0),
  categoryId: int("categoryId"),
  collectionId: int("collectionId"),
  isActive: boolean("isActive").default(true),
  isFeatured: boolean("isFeatured").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Product = typeof products.$inferSelect;

// ── Carts ───────────────────────────────────────────────────
export const carts = mysqlTable("carts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Cart = typeof carts.$inferSelect;

// ── Cart Items ──────────────────────────────────────────────
export const cartItems = mysqlTable("cart_items", {
  id: int("id").autoincrement().primaryKey(),
  cartId: int("cartId").notNull(),
  productId: int("productId").notNull(),
  quantity: int("quantity").notNull().default(1),
  color: varchar("color", { length: 50 }),
  size: varchar("size", { length: 50 }),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type CartItem = typeof cartItems.$inferSelect;

// ── Orders ──────────────────────────────────────────────────
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull().unique(),
  userId: int("userId"),
  email: varchar("email", { length: 255 }).notNull(),
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  country: varchar("country", { length: 100 }).default("France"),
  phone: varchar("phone", { length: 30 }),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingCost: decimal("shippingCost", { precision: 10, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "shipped", "delivered", "cancelled"])
    .default("pending"),
  notes: text("notes"),
  // ── Livraison / Sendcloud ────────────────────────────────
  shippingMethodId: int("shipping_method_id"),
  shippingCarrier: varchar("shipping_carrier", { length: 100 }),
  shippingMethodName: varchar("shipping_method_name", { length: 255 }),
  servicePointId: varchar("service_point_id", { length: 100 }),
  servicePointName: varchar("service_point_name", { length: 255 }),
  servicePointAddress: varchar("service_point_address", { length: 500 }),
  sendcloudParcelId: varchar("sendcloud_parcel_id", { length: 100 }),
  trackingNumber: varchar("tracking_number", { length: 100 }),
  trackingUrl: varchar("tracking_url", { length: 500 }),
  labelUrl: varchar("label_url", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Order = typeof orders.$inferSelect;

// ── Order Items ─────────────────────────────────────────────
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId"),
  productName: varchar("productName", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  color: varchar("color", { length: 50 }),
  size: varchar("size", { length: 50 }),
});

export type OrderItem = typeof orderItems.$inferSelect;

// ── Contacts ────────────────────────────────────────────────
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  orderNumber: varchar("order_number", { length: 50 }),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "read", "replied"]).default("new"),
  adminReply: text("admin_reply"),
  repliedAt: timestamp("replied_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;

// ── Newsletter Subscribers ──────────────────────────────────
export const newsletterSubscribers = mysqlTable("newsletter_subscribers", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;

// ── Payments (Stripe) ──────────────────────────────────────
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("eur"),
  status: mysqlEnum("status", ["pending", "succeeded", "failed", "cancelled", "refunded"]).default("pending"),
  paymentMethod: varchar("payment_method", { length: 100 }),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;

// ── Site Config ────────────────────────────────────────────
export const siteConfig = mysqlTable("site_config", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type SiteConfig = typeof siteConfig.$inferSelect;

// ── Page Views ──────────────────────────────────────────────
export const pageViews = mysqlTable("page_views", {
  id: int("id").autoincrement().primaryKey(),
  page: varchar("page", { length: 255 }).notNull(),
  sessionId: varchar("session_id", { length: 255 }),
  userAgent: text("user_agent"),
  referrer: varchar("referrer", { length: 500 }),
  ipHash: varchar("ip_hash", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Product Views ───────────────────────────────────────────
export const productViews = mysqlTable("product_views", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull(),
  sessionId: varchar("session_id", { length: 255 }),
  ipHash: varchar("ip_hash", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Email Templates ─────────────────────────────────────────
export const emailTemplates = mysqlTable("email_templates", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  subject: varchar("subject", { length: 500 }).notNull(),
  htmlBody: text("html_body").notNull(),
  textBody: text("text_body"),
  description: varchar("description", { length: 500 }),
  variables: json("variables").$type<string[]>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;

// ── Campaigns ───────────────────────────────────────────────
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  htmlContent: text("html_content").notNull(),
  imageUrl: varchar("image_url", { length: 500 }),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  status: mysqlEnum("status", ["draft", "scheduled", "sent", "cancelled"]).default("draft"),
  recipientCount: int("recipient_count").default(0),
  openCount: int("open_count").default(0),
  clickCount: int("click_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Shipping Methods ────────────────────────────────────────
export const shippingMethods = mysqlTable("shipping_methods", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  carrier: varchar("carrier", { length: 100 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  estimatedDays: varchar("estimated_days", { length: 50 }),
  isActive: boolean("is_active").default(true),
  config: json("config").$type<Record<string, unknown>>(),
  sortOrder: int("sort_order").default(0),
  // ── Sendcloud ────────────────────────────────────────────
  sendcloudMethodId: int("sendcloud_method_id"),
  requiresServicePoint: boolean("requires_service_point").default(false),
  minWeight: decimal("min_weight", { precision: 10, scale: 3 }),
  maxWeight: decimal("max_weight", { precision: 10, scale: 3 }),
  countries: json("countries").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ShippingMethod = typeof shippingMethods.$inferSelect;
