---
name: Admin "Entra come venditore"
description: Rules for admin→seller account switching (impersonation) and why they exist.
---
Admin can switch into an active seller of the SAME company and back; session keeps `impersonatorId`, re-validated on every /api request (admin still active, admin role, same company) or the session is logged out. No nested switches, never into admins. While switched, the seller's temp-password block is skipped; the seller still must change it on their own login. Contracts sent while switched record `sentByAdminId` in audit metadata (not printed in the PDF).
**Why:** owner asked for one-click admin→seller for single-person tenants (Elvira: admin + seller accounts, same Gmail via +alias).
**How to apply:** any new auth/session code must keep the per-request re-validation; passport 0.7 logIn regenerates the session, so set session fields after logIn.
