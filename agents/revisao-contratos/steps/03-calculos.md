# Step 3: Do the math with the contract's numbers

## Goal

Turn the clauses into **money**: how much it costs to leave early, how much the rent can go up and how much a late payment costs. Laypeople understand "R$ 3,600" better than "proportional penalty". Always show the formula, the numbers and the result, and make clear that these are **estimates** (a judge can reduce an excessive penalty, Civil Code, art. 413).

By the end you need: the early termination penalty (or the reason there is none), the simulated rent adjustment, the cost of a late payment and the deposit cap, all checked twice.

## What to ask the user

Only what is missing for the calculation:

- "How many months have you already served and in which month do you plan to leave?"
- "Is the penalty on the rent alone or on rent plus charges? Has the current rent already been adjusted?"
- "Do you know the cumulative index for the last 12 months? If not, I will run a simulation with hypothetical rates."
- "How many days of delay do you want to simulate?"

## How to run

Before calculating, call `search_knowledge` with "proportional penalty formula example", "annual adjustment index calculation" and "late fine interest example".

### 1. Early termination penalty (art. 4)

```
full penalty         = number of months' rent in the clause × current rent
months remaining     = total term − months served
proportional penalty = full penalty × months remaining ÷ total term
```

- Use the **current rent** (already adjusted). Charges only enter the base if the clause says "rent and charges".
- Build a table with the scenario the user asked about or 3 scenarios (e.g., month 6, 12 and 24).
- Transfer by the employer to another location, with 30 days' written notice: **zero** penalty (art. 4, sole paragraph).
- Contract that has expired and continues for an indefinite term: **no penalty**, 30 days' written notice is enough (art. 6). Without the notice, the landlord can charge one month of rent and charges.
- If the contract requires the **full** penalty, show both calculations (full and proportional) and say that the "full" part contradicts art. 4.

Example: rent R$ 2,000, penalty of 3 months' rent (R$ 6,000), 30-month contract. Leaving after 12 months: 6,000 × 18 ÷ 30 = **R$ 3,600**. After 6 months: R$ 4,800. After 24 months: R$ 1,200.

### 2. Annual rent adjustment

```
new rent = current rent × (1 + cumulative change over 12 months)
```

- Confirm that the adjustment is **annual** (Law 10.192/2001, art. 2, par. 1) and whether the contract deals with a negative change.
- If the user does not know the index, run a **simulation** with two rates (e.g., 4% and 10%), say that it is a hypothesis and tell the user to check the real index at FGV (IGP-M, IVAR), at IBGE (IPCA) or in the Central Bank's calculator. Never present an invented percentage as if it were the real index.
- Show the difference over the year: with R$ 2,000, 4.5% gives R$ 2,090 and 10% gives R$ 2,200, which is R$ 1,320 more over 12 months.

### 3. Late payment (fine and interest)

```
fine     = overdue amount × fine %
interest = overdue amount × monthly rate × days late ÷ 30
```

- A fine above 10% or interest above 1% per month: **attention** (Civil Code, arts. 406, 412 and 413).
- The Consumer Code (CDC, 2% cap) does not apply to a lease between private individuals.
- With no interest rate in the contract, the legal rate applies (Selic minus IPCA, Civil Code, art. 406, as worded by Law 14.905/2024). The monthly figure is published by the Central Bank: look it up, do not estimate it.
- Inflation adjustment by IPCA (art. 389, sole paragraph) is added separately, afterwards; say that it depends on the index for the period.

Example: R$ 2,000 paid 20 days late, 10% fine and 1% per month interest: fine R$ 200 + interest R$ 13.33 = **R$ 213.33** on top of the amount owed.

### 4. Security deposit

- In cash, at most **3 months' rent** (art. 38, par. 2), held in a savings account, with the earnings going to the tenant. Show the cap in reais and the excess, if any.

## Common mistakes

- Calculating the proportion on the time **served** instead of the time **remaining**.
- Using the initial rent when the clause refers to the current rent.
- Adding condominium fees and IPTU to the penalty base when the clause does not say so.
- Presenting the adjustment simulation as the real index for the period.
- Rounding in the middle of the calculation: round only at the end, to two decimal places.
- Saying "you will pay exactly" instead of "the calculation under the law comes to about".

## result_summary format

```
EARLY TERMINATION PENALTY (art. 4): full R$ 6,000; leaving month 12 -> R$ 3,600; month 24 -> R$ 1,200
JOB TRANSFER (art. 4, sole paragraph): zero penalty with 30 days' written notice
ADJUSTMENT: R$ 2,000 -> R$ 2,090 (IPCA simulation 4.5%) | R$ 2,200 (10% simulation)
LATE PAYMENT: 20 days on R$ 2,000 -> fine R$ 200 + interest R$ 13.33
MAXIMUM DEPOSIT: R$ 6,000 (3 months' rent, art. 38, par. 2)
CHECKED: twice | assumptions: current rent, no charges in the base
```
