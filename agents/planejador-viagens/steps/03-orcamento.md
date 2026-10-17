# Step 3: Realistic budget

## Goal

Turn the amount the user has into a budget split by category, with the hidden costs (IOF, exchange rate, tourist taxes, baggage, insurance) and an emergency reserve. The user needs to leave knowing **how much they can spend per day** at the destination and whether the trip fits their pocket. Everything is a planning estimate, never a guaranteed price. IOF is a Brazilian tax on spending and buying foreign currency abroad, so this step assumes the user pays from Brazil in reais.

## What to ask the user

- Does the amount given include flights? Does it include insurance?
- Is anything already paid or booked (miles, a hotel already purchased)? How much?
- How do they plan to pay abroad: card, global account or prepaid card in foreign currency, cash?
- Is there any special spending planned: shopping, a concert, a theme park, a birthday dinner?
- Do they prefer to spend more on lodging or on experiences?

## How to run

1. **Run the split tool** with `run_tool`, `tool: "budget_split"` and an `input` like the one below. The `profile` comes from the spending style in the user's profile (`economico`, `moderado`, `conforto` or `luxo`, meaning budget, moderate, comfort or luxury); `destinationType` is `nacional` or `internacional` (domestic or international); `alreadyPaid` carries what has already been paid by category; `emergencyReservePct` has a minimum of 10.

```json
{
  "total": 45000,
  "currency": "BRL",
  "days": 15,
  "travelers": 3,
  "profile": "conforto",
  "destinationType": "internacional",
  "alreadyPaid": { "aereo": 0 },
  "emergencyReservePct": 10
}
```

   The result brings `categories` (the amount for each category), `perPersonPerDayLocal` (food, activities and local transport per person per day) and `alerts`. Pass the alerts on to the user.

2. **Sanity-check it** using `search_knowledge` ("budget and costs", destination): if a category falls outside the typical ranges or the daily amount drops below the destination's budget floor, say so clearly. A theme park (Orlando) weighs more on activities: compensate on lodging or food.
3. **Put the hidden costs on their own lines**: IOF (use the rate the knowledge base gives and ask the user to confirm the current one with the Receita Federal, Brazil's tax authority, or the bank), card spread, tourist tax per night, baggage and seat selection, transfer, tips in the US, SIM card or eSIM. To estimate in reais, use the day's exchange rate with a margin of 8% to 10%.
4. **If it does not add up**, offer concrete alternatives: fewer days, low season, fewer cities, an apartment with a kitchen, a cheaper neighborhood well served by the metro, another destination.
5. **Recommend how to pay in a neutral way**: a global account or prepaid card (currency bought gradually) plus a backup credit card and little cash. Do not recommend a brand.
6. **Deliver the table** with `get_template` (name `orcamento-viagem`): category, amount, percentage, note, amount per day per person and the reserve highlighted. Ask the user to validate it.

## Common mistakes

- Not calling the tool and making up percentages off the top of your head.
- Forgetting IOF or quoting the rate as final.
- Adding up the budget without the emergency reserve (minimum 10%).
- Converting prices at the commercial exchange rate, ignoring spread and IOF.
- Not warning when the budget does not add up: it is better to disappoint now than in the middle of the trip.
- Recommending a specific financial product as the best one.

## result_summary format

```
BUDGET (budget_split run)
- Total: R$ 45,000 | 15 days | 3 travelers | comfort profile
- Flights: R$ 15,300 (34%)
- Lodging: R$ 12,600 (28%)
- Food: R$ 6,300 (14%)
- Activities: R$ 3,600 (8%)
- Local transport: R$ 1,800 (4%)
- Insurance: R$ 900 (2%)
- Emergency reserve: R$ 4,500 (10%)
- Daily amount at the destination per person: R$ 260 (reference exchange rate to be confirmed)
HIDDEN COSTS INCLUDED
- IOF (rate to be confirmed), spread, tourist tax, baggage
ALERTS
- Tight lodging budget for Lisbon in May; suggest an apartment outside the historic center
PAYMENT
- Global account + backup credit card + little cash
```
