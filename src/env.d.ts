/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { User } from "./lib/db";

declare global {
  namespace App {
    interface Locals {
      user: User | null;
    }
  }
}
