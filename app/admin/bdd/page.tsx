// /admin/bdd — BDD Manager (admin only)
// Server component wrapper — renders the client-side BDD Manager UI.
// Auth is enforced by the parent /admin/layout.tsx.

import { BddManagerClient } from "./BddManagerClient";

export const metadata = {
  title: "BDD Manager — StaticsFlow Admin",
};

export default function BddManagerPage() {
  return <BddManagerClient />;
}
