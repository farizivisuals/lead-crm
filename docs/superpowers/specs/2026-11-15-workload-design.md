# Workload view — short design

## Why
Managers and executives want to see at a glance how booked each employee is,
how many open tasks they have and how many clients they're dealing with, so
they can spread work and spot who is overloaded or free.

## Approaches
- **A. Days booked (picked).** Out of the month's working days, how many have
  something on them. Concrete ("free next Tuesday?"), but undated work doesn't
  count toward it.
- **B. Points score.** Weighted points for every open task, video and creative
  role, scaled so the busiest person is 100. Counts everything, but the number
  is abstract.

## What it shows (one row per employee)
- **Booked:** `14/21 days` for the month, with a bar — green under 50%, amber
  50–79%, red 80%+ — and a strip of one small square per working day (filled =
  booked) so free days are visible. ‹ › switches month; opens on this month.
- **Tasks:** open tasks assigned to them, plus "+N as creative".
- **Videos:** videos whose current phase is theirs.
- **Clients:** distinct clients across all of the above.
- **Overdue:** open assigned tasks past their due date (as of today), in red when > 0.
- Tasks, videos, clients and overdue are "right now", not per month.
- Sorted most booked first.

## Rules (my calls)
- Working days are Sunday–Thursday of the chosen calendar month (Kuwait time);
  past days of the month count too.
- A day is booked when the person has a task assigned to them (finished or
  not, so past days of the month still show) whose dates cover that day (start
  only, or due only → that one day), or a video phase assigned to them
  scheduled that day. Tasks/overdue/videos/clients count **open** work only
  ("open" = not at its department's final stage).
- Creative roles count toward Tasks and Clients but not booked days (being a
  creative doesn't put you on site that day).
- Everyone with role employee or manager is listed; executives only if they
  have work.

## Where
- Website: new **Workload** page in the sidebar, executives only (managers
  included). Clicking a name opens the calendar filtered to that person.
- App: **More → Workload** for executives.
- One shared, tested function computes the numbers for both.

## Not doing
Hours (times are mostly blank so far), history/trends, editing from this page.
