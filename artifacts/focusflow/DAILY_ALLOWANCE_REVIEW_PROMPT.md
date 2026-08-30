# Daily Allowance Review Prompt

Copy and paste this prompt before asking an agent to work on Daily Allowance:

> First read these two files in `artifacts/focusflow/`:
>
> 1. `DAILY_ALLOWANCE_COMPLETE_PLAIN_ENGLISH.md` — the plain-English helper guide explaining what breaks, who it affects, and the expected fix order.
> 2. `DAILY_ALLOWANCE_COMPLETE_TECHNICAL.md` — the main technical review with source-file and line references, proposed fixes, and the traceable master checklist.
>
> Treat the technical review as the source of truth for implementation details and the plain-English guide as the explanation of user impact. Keep every change traceable to the relevant item and source reference. Update the master checklist as you work: use `[ ]` for pending, `[x]` only after the fix is verified, and `[✗]` for rejected, not-applicable, or accepted limitations. Do not claim an item is fixed without checking its behavior and relevant tests. Follow the documented priority order unless there is a clear technical reason to change it.