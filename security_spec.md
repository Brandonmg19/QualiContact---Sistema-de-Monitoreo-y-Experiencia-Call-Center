# Security Specification & Red-Team Audit (QualiContact Firestore)

## 1. Data Invariants
1. **Identity & Email Verification**: Every read/write requires `request.auth != null` and `request.auth.token.email_verified == true`.
2. **PII Isolation**: Email addresses and phone numbers live exclusively in `/users/{userId}` and `/admins/{uid}`. `/directory/{userId}` stores only non-PII operational roster fields (`name`, `voiceName`, `role`, `employeeCode`, `department`, `reportsToId`, `status`).
3. **No Self-Assigned Privilege Escalation**: Users cannot create or mutate `role`, `status`, or `/admins/{uid}` markers for themselves. Only verified Admins (or the bootstrapped admin `luis.montenegro@xtendo-it.com`) can manage user roles, statuses, and admin markers.
4. **Strict Field Allowlisting & Type/Size Bounds**: Every `create` validates `keys().hasAll(...) && keys().hasOnly(...)` plus string `.size()` caps and regex ID validation `^[a-zA-Z0-9_\-]+$`.
5. **Action-Based Updates**: Updates to `/monitorings/{monitoringId}` are strictly partitioned into named actions (`TL Feedback`, `Agent Commitment`, `Refutation`, `Analyst Refutation Resolution`, or `Admin Override`) using `affectedKeys().hasOnly(...)`.
6. **Terminal State Locking**: Once a monitoring reaches `'CERRADO'` or `'CONFORME_SIN_FEEDBACK'`, non-admin updates are blocked unless explicitly reopened by an Admin.
7. **Server Timestamps**: `serverCreatedAt` and `serverUpdatedAt` must equal `request.time`.
8. **Immutable Audit Logs**: `/audit_logs/{logId}` allows verified creation with `authorUid == request.auth.uid` and `serverCreatedAt == request.time`, and forbids client-side `update` and `delete`.

## 2. "Dirty Dozen" Adversarial Payloads
1. Unauthenticated read/write to `/users` or `/monitorings` -> `PERMISSION_DENIED`.
2. Unverified email (`email_verified: false`) trying to spoof bootstrapped admin email -> `PERMISSION_DENIED`.
3. Non-admin advisor reading `/users/{otherUserId}` containing PII (`email`, `phone`) -> `PERMISSION_DENIED`.
4. Non-admin advisor updating own `/users/{userId}` with `{ role: 'admin' }` -> `PERMISSION_DENIED`.
5. Non-admin advisor creating a document in `/admins/{uid}` -> `PERMISSION_DENIED`.
6. Shadow update on `/monitorings/{id}` injecting `{ isVerified: true }` -> `PERMISSION_DENIED`.
7. Maliciously long document ID (> 128 chars or containing `/` / `.`) on `/monitorings/{id}` -> `PERMISSION_DENIED`.
8. Oversized string (> max size) in `qaFindings.criticalFinding` or `name` (Denial of Wallet) -> `PERMISSION_DENIED`.
9. Client forging `serverCreatedAt` with a past timestamp instead of `request.time` -> `PERMISSION_DENIED`.
10. Advisor modifying another advisor's monitoring commitment -> `PERMISSION_DENIED`.
11. Advisor modifying a monitoring whose status is already `'CERRADO'` -> `PERMISSION_DENIED`.
12. Non-admin deleting or altering an existing `/audit_logs/{logId}` entry -> `PERMISSION_DENIED`.
