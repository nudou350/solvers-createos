# Step 4: Monthly plan and next 30 days

## Goal

Deliver a plan **as a table**, in reais, that fits within income: an adapted budget split, amounts for debts and the emergency fund, weekly caps for variable spending and a short list of dated actions for the next 30 days. The person must leave knowing exactly what to do this week.

## What to ask the user

- On what day of the month does the money land? (Automatic transfers are set for that day.)
- Do you prefer to track it in your bank's app, in a spreadsheet or in a notebook? (If the profile already says, do not ask.)
- Which day of the week can you set aside 10 minutes for the review?

## How to run

1. **Open the reply with the disclaimer**: "This is financial education, not professional financial advice or an investment recommendation."
2. **Check the knowledge base** with `search_knowledge`: "adapted 50/30/20 budget split" and "habits that sustain the plan".
3. **Choose the split** by the essentials % from step 1: 50/30/20 (essentials up to 50%), 60/20/20 (up to 60%), temporary 70/20/10 (up to 70%). Above 70%, the problem is income or fixed costs: propose structural cuts or more income before closing the plan. With expensive debt, the "future" share goes to the debt, keeping the minimum reserve.
4. **Fill in the template** `plano-do-mes` (`get_template`): income, each category with amount and %, debt installments, reserve and surplus. **The sum must match the income**: check the math before showing it.
5. **Convert the variable categories into weekly caps** (monthly amount ÷ 4.3).
6. **List at most 5 actions for the next 30 days**, each with a date and the person themselves as the owner (e.g. "by Friday: ask the bank for the bill installment plan and the CET in writing"). Highlight **one** action for this week.
7. **Agree on the review**: hand over the template `revisao-semanal` (`get_template`), 10 minutes a week and a monthly review on the day the money lands.
8. **Refer them on**, if relevant: Procon, the Public Defender's Office (Defensoria), consumidor.gov.br or a certified professional.
9. **Close with the notice**: "This plan is financial education, not advice or an investment recommendation. Rates and rules change: confirm at the official source." If the user asks you to remember a preference or goal for a future conversation, save it as a note with `save_memory`, with no balances or account data.

## Common mistakes

- A plan with ten actions: the person does none.
- Sums that do not match the income.
- A monthly cap for groceries and leisure instead of a weekly one.
- Forgetting annual expenses divided by 12.
- Leaving the plan without a review date.
- Saving a memory note without the user asking.

## result_summary format

```
budget_split: <e.g. 60/20/20>
monthly_table: <category: R$ (%) ... | sum = income>
debts_this_month: <R$ and to which debt>
reserve_this_month: <R$>
weekly_caps: <groceries R$, leisure R$, other R$>
actions_30_days: <up to 5 actions with date>
action_this_week: <one action>
review: <day of the week and monthly date>
referral: <none | Procon | Defensoria | consumidor.gov.br | certified professional>
```
