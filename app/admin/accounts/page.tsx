// /admin/accounts — Account Manager (admin only)
// Server component wrapper. Auth is enforced by parent /admin/layout.tsx.

import { AccountsManagerClient } from "./AccountsManagerClient";

export const metadata = {
  title: "Account Manager — StaticsFlow Admin",
};

export default function AccountsPage() {
  return <AccountsManagerClient />;
}
