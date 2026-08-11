import { relations } from "drizzle-orm";
import { users, collections, categories, products, carts, cartItems, orders, orderItems } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  carts: many(carts),
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
  products: many(products),
}));

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  products: many(products),
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  collection: one(collections, { fields: [products.collectionId], references: [collections.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
}));

export const cartsRelations = relations(carts, ({ many, one }) => ({
  items: many(cartItems),
  user: one(users, { fields: [carts.userId], references: [users.id] }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  user: one(users, { fields: [orders.userId], references: [users.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
