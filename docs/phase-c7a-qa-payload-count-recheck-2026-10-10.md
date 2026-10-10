# Phase C7A — QA Payload Count Recheck — 10 October 2026

## Scope and safety
Read-only SQL against isolated QA Supabase project `uqtsksgypncsbcnuanbk`, branch `staging/advocatedesk-test`. The query compared per-workspace/per-resource-type counts from the legacy `practice_records` `workspace_state` JSON arrays against rows in `practice_resources`. No data or schema was changed. Production was not accessed.

## Result

All current legacy collections with rows had matching target row counts and object payloads:

| Workspace (short ID) | Resource | Legacy array count | Resource rows | Difference |
|---|---|---:|---:|---:|
| `33d996c1…` | case | 1 | 1 | 0 |
| `33d996c1…` | client | 1 | 1 | 0 |
| `33d996c1…` | hearing | 1 | 1 | 0 |
| `33d996c1…` | task | 1 | 1 | 0 |
| `33d996c1…` | invoice | 1 | 1 | 0 |
| `33d996c1…` | payment | 1 | 1 | 0 |
| `55097c1f…` | case | 1 | 1 | 0 |
| `55097c1f…` | client | 1 | 1 | 0 |
| `55097c1f…` | hearing | 1 | 1 | 0 |

No non-empty legacy arrays for transactions, meetings, discussions, courts, or case parties were returned by this snapshot. Empty source collections do not validate those modules' real-world behavior.

## What this proves—and does not prove

- **Proves:** for the currently present, inventoried arrays, source and target row counts agree; every counted target payload is a JSON object; every source item had a candidate ID under the inventory's ID extraction rules.
- **Does not prove:** exact payload equality, uniqueness after the adapter's specific ID normalization, correct case/client relationships, correct handling of legacy aliases, deletion semantics, or visibility under real authenticated JWTs.
- The ID candidate extraction in this inventory is intentionally broad and is not the adapter's definitive stable-ID function. A payload-by-payload canonical comparison is still required.
- Count parity does not close the legacy aggregate exposure: the browser app still uses `practice_records.workspace_state`, which can expose a whole workspace state to a member even when resource-level policies would filter rows.

## Decision

Keep the resource-store cutover blocked. Next acceptance work must include canonical payload/hash comparison, relationship integrity checks, transaction/CAS implementation, and real authenticated Admin/assigned Advocate/unassigned Advocate/Accountant sessions. No production release is approved by this report.
