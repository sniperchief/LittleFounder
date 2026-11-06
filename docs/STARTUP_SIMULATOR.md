# LITTLE FOUNDERS — Startup Simulator rules (Phase 5)

A one-season, single-player business challenge for ages 10–13. Children make three decisions from fixed options, the database calculates the result, and the child sees what happened and why.

**Founder Bucks (FB)** are pretend, virtual units used only for learning. They are not real money, cryptocurrency or redeemable rewards, and they are labelled "Pretend money" wherever amounts appear. Results are practice outcomes and never real business or investment performance.

Source of truth for the numbers: `src/content/simulator.ts`. `npm run content:seed` copies them into `simulator_scenarios.demand_params`. The only place results are calculated is `public.simulator_outcome()` in `supabase/migrations/20261106000900_startup_simulator.sql`.

## Challenges

| Key | Title | Notes |
|---|---|---|
| `ecobottle` | EcoBottle | A pretend business selling reusable water bottles to reduce single-use plastic. No Idea Lab project needed. |
| `my-idea` | My idea | Same numbers, applied to one of the child's own **created** Idea Lab ideas ("practice numbers", not an estimate for that idea). |

## Fixed values and options

| Item | Value |
|---|---|
| Starting budget | **1,000 FB** |
| Cost to make one item | **4 FB** |
| Selling price options | 6, 8, 10, 12, 15 FB |
| Quantity options | 50, 100, 150, 200, 250 |

Interested customers at each price (before marketing):

| Price | 6 | 8 | 10 | 12 | 15 |
|---|---|---|---|---|---|
| Interested customers | 160 | 130 | 100 | 70 | 40 |

Marketing options:

| Key | Option | Cost | Extra interested customers |
|---|---|---|---|
| `none` | No marketing | 0 FB | 0 |
| `posters` | Posters around town | 50 FB | 20 |
| `fair-stall` | Stall at the school fair | 100 FB | 45 |
| `radio` | Local radio shout-out | 200 FB | 80 |

There is no randomness: the same decisions always give the same result.

## Formulas

```
production cost   = quantity × 4
total cost        = production cost + marketing cost
  → refused as "over budget" if total cost > 1,000 (nothing is stored)
interested        = interested at price + marketing reach
units sold        = min(quantity, interested)
unsold            = quantity − units sold
missed customers  = max(interested − quantity, 0)
revenue           = units sold × price
profit            = revenue − total cost        (negative = loss, 0 = break-even)
cash remaining    = 1,000 − total cost + revenue  (= starting budget + profit)
```

Cash remaining is always shown separately from profit, with the explanation that it includes the starting budget.

Of the 100 option combinations, 15 are over budget: 250 items (1,000 FB) with any paid marketing.

### Worked examples

| Price | Quantity | Marketing | Sold | Revenue | Total cost | Profit | Cash remaining |
|---|---|---|---|---|---|---|---|
| 10 | 100 | posters | 100 (120 interested) | 1,000 | 450 | **+550** | 1,550 |
| 15 | 250 | none | 40 | 600 | 1,000 | **−400** | 600 |
| 6 | 200 | radio | 200 (240 interested) | 1,200 | 1,000 | **+200** | 1,200 |
| 10 | 250 | posters | — | — | 1,050 | refused: over budget by 50 | — |

## Feedback rules

The database returns feedback keys; the app maps them to child-friendly text (`feedbackText`, `tryNextText` in `src/content/simulator.ts`).

| Key | When |
|---|---|
| `profit` / `loss` / `break-even` | Sign of profit (always first) |
| `sold-out` | interested > quantity |
| `leftover` | quantity > interested |
| `price-low` | lowest price option chosen |
| `price-high` | highest price option chosen |
| `marketing-paid-off` | paid marketing and (units sold − units that would have sold without marketing) × price > marketing cost |
| `marketing-not-worth-it` | paid marketing that didn't earn back its cost |

## Attempt lifecycle

1. `start_simulation(scenario_key, project_id)` creates an **active** attempt for the child in Child Mode, or resumes the existing active attempt for the same challenge/idea. Max 20 new attempts per child per hour.
2. `save_simulation_draft(session_id, draft)` remembers the choices and step (only listed values are accepted) so the child can resume.
3. `run_simulation(session_id, price, quantity, marketing_key)` validates the options, enforces the budget, calculates, stores a `simulator_rounds` row and the `final_summary`, marks the attempt **completed** and evaluates achievements (**First Business Run** on the first completed attempt, awarded once).
4. `set_simulation_reflection(session_id, reflection)` stores one predefined reflection answer (`price`, `quantity`, `marketing`, `same`), once.

Completed attempts are immutable: triggers reject any change to a completed session's results (only the one-time reflection may be added) and any update to a stored round, even from server code. A new attempt is a new row, so earlier attempts stay available for comparison.

## Security

- Clients can read their family's attempts (RLS) but cannot insert, update or delete them; all writes go through the functions above.
- The child is always derived from the parent's active Child Mode (`learning_child()`); the browser never supplies a child id. "My idea" accepts only a created idea of that same child.
- No personal information is stored: only option values, calculated numbers and a predefined reflection key.
