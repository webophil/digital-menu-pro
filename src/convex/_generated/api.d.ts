/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as accountEmail from "../accountEmail.js";
import type * as accountEmailSend from "../accountEmailSend.js";
import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as appearance from "../appearance.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as billing from "../billing.js";
import type * as billingInternal from "../billingInternal.js";
import type * as checkout from "../checkout.js";
import type * as contact from "../contact.js";
import type * as contactInternal from "../contactInternal.js";
import type * as http from "../http.js";
import type * as photos from "../photos.js";
import type * as plans from "../plans.js";
import type * as publicMenu from "../publicMenu.js";
import type * as restaurants from "../restaurants.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  accountEmail: typeof accountEmail;
  accountEmailSend: typeof accountEmailSend;
  admin: typeof admin;
  ai: typeof ai;
  appearance: typeof appearance;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  billing: typeof billing;
  billingInternal: typeof billingInternal;
  checkout: typeof checkout;
  contact: typeof contact;
  contactInternal: typeof contactInternal;
  http: typeof http;
  photos: typeof photos;
  plans: typeof plans;
  publicMenu: typeof publicMenu;
  restaurants: typeof restaurants;
  users: typeof users;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
