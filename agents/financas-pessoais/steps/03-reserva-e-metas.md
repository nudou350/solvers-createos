# Step 3: Emergency fund and goals

## Goal

Define the **target emergency fund in months of essential costs**, the monthly amount to get there, the milestones along the way and **where to keep it in general terms** (categories, not products). Then turn dreams into goals with an amount and a deadline. Never name a specific bank, broker, fund or bond.

The rates, taxes and guarantee limits below are Brazilian (Selic, poupança, Brazilian income tax and IOF, FGC, Tesouro Direto). For money held outside Brazil, the target-in-months method still applies, but the "where to keep it" part does not.

## What to ask the user

Skip what the calibration profile has already answered (income type and dependents).

- Where is the money you have saved today? Can you withdraw it the same day?
- Do you have any goal with a date (trip, wedding, new car, course)? How much does it cost and by when?
- If the profile does not say: is your income stable (CLT employee, civil servant) or does it vary (self-employed, MEI, gig work, commission)? Does anyone depend only on you?

## How to run

1. **Open the reply with the disclaimer**: "This is financial education, not professional financial advice or an investment recommendation."
2. **Check the knowledge base** with `search_knowledge`: "emergency fund size", "FGC limit", "Tesouro Selic custody", "poupança rule Selic 8.5", "regressive income tax IOF table". If any passage warns that it is out of date, tell the user.
3. **Calculate the target fund**: monthly essentials × months (3 to 6 for stable income; 6 to 12 for variable income; people who support the family alone go to the top of the range). Show it in reais.
4. **Calculate the timeline**: target fund ÷ possible monthly amount, with milestones (1 month, 3 months, target). If there is expensive debt, this step defines only the **minimum reserve**; the rest starts after the debt is paid off.
5. **Explain where to keep it** by the criteria of safety, liquidity and yield, using the categories from the knowledge base (floating-rate government bond, daily-liquidity CDB covered by the FGC, remunerated account, poupança) and the net yield compared with dated numbers (Selic, poupança, income tax). Mention the FGC (R$ 250,000 per person and institution or conglomerate; ceiling of R$ 1 million every 4 years) and say that Tesouro Direto does not depend on the FGC.
6. **Say what is not suitable for an emergency fund**: equities and other variable-income assets, long fixed-rate bonds, LCI/LCA with a lock-up period, private pension plans.
7. **Goals**: for each goal, amount ÷ months until the date = monthly amount. If the sum does not fit the budget, ask them to prioritize or extend the deadline. For long-term goals (retirement, children's education), refer them to a certified professional.
8. **Ask them to confirm** rates and limits at the official sources (bcb.gov.br, fgc.org.br, tesourodireto.com.br) and state the date of the numbers used.

## Common mistakes

- Calculating the fund on salary instead of essential costs.
- Keeping the fund in an investment with no liquidity or with a risk of loss.
- Saying poupança "always yields 0.5% a month" without the TR (reference rate) and without the 8.5% Selic rule.
- Forgetting that CDB and Tesouro pay income tax and that LCI/LCA remain exempt (MP 1.303/2025 lapsed).
- Naming a specific product or institution, or promising a return.
- Building the full fund before paying off revolving credit.

## result_summary format

```
income_profile: <stable | variable>
monthly_essentials: <R$>
target_fund: <R$ and months>
current_fund: <R$ and where>
monthly_fund_amount: <R$>
timeline_and_milestones: <e.g. 1 month in 03/2027; 3 months in 12/2027; target in 09/2028>
where_to_keep: <categories explained, no specific product>
goals: <list: goal, amount, date, R$/month>
dated_numbers_used: <Selic, poupança, FGC, with the knowledge base date>
```
