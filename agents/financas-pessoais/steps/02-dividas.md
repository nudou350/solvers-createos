# Step 2: Debt attack plan

## Goal

Put the debts in order of attack by **effective cost** and choose a concrete action for each one: pay off, swap for cheaper debt (credit portability, payroll loan), renegotiate or ask for a restructuring under the over-indebtedness law. If the person has no debts, confirm it, give a short summary and go straight to step 3.

The rules in this step are Brazilian (CMN resolutions, Lei 14.690/2023, Lei 14.181/2021, Brazilian government programs). They apply to credit contracted in Brazil.

## What to ask the user

Skip what the calibration profile has already answered (for example, the payoff style).

- Do you prefer to save the most interest (avalanche: highest rate first) or to see debts disappear quickly (snowball: smallest balance first)?
- At most, how much can go to debts each month without running short of the basics?
- Do you have access to cheaper credit (a payroll-deducted loan through your employer or the INSS, credit portability)? Are you formally employed, informal or retired?
- Is any debt overdue or on a credit blacklist? Since when?

## How to run

1. **Open the reply with the disclaimer**: "This is financial education, not professional financial or legal advice."
2. **Check the knowledge base** with `search_knowledge`: "revolving credit 30 days 100% cap", "overdraft cap", "average card rates", "Desenrola 2026", "over-indebtedness existential minimum". When a passage carries an out-of-date warning, tell the user and ask them to confirm at the official source before acting.
3. **Order by cost** (monthly rate or CET), from the most expensive to the cheapest. Exception: bills that cut off an essential service or lead to losing an asset (rent, electricity, water, child support, a vehicle used for work) come first.
4. **Revolving card credit**: the balance can stay in revolving credit only until the next bill (about 30 days); after that it becomes an installment plan. Interest and charges on revolving credit and on the installment plan are capped at 100% of the original amount. Show the math: balance × monthly rate = interest for the month.
5. **Overdraft**: capped at 8% per month. Propose swapping it for cheaper installment debt and lowering the limit.
6. **Swapping debt**: compare the current CET with portability, a payroll loan or a personal loan. The swap only pays off if the installment fits and the person **stops using** revolving credit and overdraft.
7. **Money saved**: if it earns less than the debt costs, propose using part of it to pay off the most expensive debt, keeping a minimum reserve (R$ 500 to R$ 1,000, or half a month of essentials).
8. **Programs and renegotiation**: check in the knowledge base what is open and what has already ended, stating the date. To negotiate with the creditor, hand over the template `roteiro-de-renegociacao` (`get_template`): up-front and installment offers, CET and everything in writing. Warn about scams: never pay a "fee" to join a program.
9. **Over-indebtedness**: if installments pass 30% to 40% of income and the basics fall short, explain Lei 14.181/2021, the existential minimum (R$ 600, with an annual review ordered by the Supreme Court, STF) and the restructuring with all creditors at Procon, the Public Defender's Office (Defensoria) or CEJUSC.
10. **Present the ordered debt table**, with the action for each one and the monthly amount assigned.

## Common mistakes

- Ordering by balance size and calling it avalanche.
- Saying you can "leave it in revolving credit for a few months".
- Recommending a payroll loan to someone who has no margin or will keep using the card.
- Citing an ended program as if it were open, or promising that the bank will approve the application.
- Telling someone to invest while there is revolving credit or overdraft.
- Recommending a specific bank or finance company.

## result_summary format

```
method: <avalanche | snowball | no debts>
attack_order: <list: type, balance, rate/CET, action (pay off|swap|renegotiate|restructure)>
monthly_amount_for_debts: <R$>
use_of_savings: <R$ used to pay off and R$ kept as minimum reserve>
programs_checked: <Desenrola/Limpa Nome fair: open or ended, with date>
over_indebtedness: <no | yes, referred to Procon/Defensoria/CEJUSC>
payoff_forecast_most_expensive_debt: <month/year>
```
