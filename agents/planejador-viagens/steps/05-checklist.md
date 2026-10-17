# Step 5: Final checklist and delivery

## Goal

Deliver a complete, actionable plan: trip summary, documents, budget, itinerary and a checklist with **concrete dates** calculated from the departure date. Finish by updating memory so the next trip starts better.

## What to ask the user

- Is the departure date confirmed? All the checklist deadlines depend on it.
- Do they prefer the plan in a single block to copy, or split into parts?
- Is there anything still worrying them? Often the real doubt (fear of immigration, of getting lost, of overspending) only shows up here.

## How to run

1. Build the checklist with `get_template` (name `checklist-pre-viagem`), converting each relative deadline into a real date (departure on May 10: "90 days before" becomes February 9). Remove what does not apply (visa, minor authorization) and add the destination's items.
2. Order by priority: long-lead documents (passport, visa, CIVP); flights and lodging; critical bookings; insurance (after buying the flight); money and payment method; health (medication in carry-on, with a prescription); connectivity; the last week (check-in, digital copies of documents); departure day.
3. Make a highlighted block **"To confirm on an official site"** with each piece of information that may have changed and the site to check it: entry rules and visa, ETIAS and EES if going to Europe, US visas, the current IOF rate, baggage allowance, the shopping allowance when returning to Brazil, attraction opening hours. Reconfirm the entry items 2 to 4 weeks before departure.
4. Add a short **contingency plan**: lost passport (police report and the Brazilian consulate), health problem (the insurer's hotline number saved on the phone and on paper), lost card (the bank's phone number written down outside the phone), cancelled flight (keep receipts; rights vary by country and airline).
5. Deliver the final plan in this order: 5-line summary, documents, budget, itinerary, checklist with dates, "to confirm on an official site", contingency.
6. **Update memory** with `save_memory`: add to the existing summary the destination and planned dates, decisions that reveal preferences ("preferred 4 bases over 6 cities", "chose an apartment with a kitchen") and what the user asked to remember. If they ask to keep something specific, use `kind: "note"`. Keep it free of sensitive data.
7. Invite the user to come back after the trip and tell you what worked, for the next plan.

## Common mistakes

- A generic checklist without dates: "get the passport" does not help; "book the passport appointment by February 9" does.
- Leaving in items that do not apply, which makes the document confusing.
- Omitting the "to confirm on an official site" section or presenting it as certainty.
- Not updating memory at the end.
- Finishing without asking whether any concern is left.
- Telling people to pack medication or documents in checked baggage.

## result_summary format

```
FINAL DELIVERY
- Plan delivered: summary, documents, budget, itinerary, checklist (18 items with dates), to confirm, contingency
- Nearest deadline: February 9, book the passport appointment
- Items to confirm on an official site: 6
MEMORY
- save_memory updated: preferred 4 bases; likes an apartment with a kitchen; wants Japan in 2027
USER PENDING ITEMS
- Buy insurance after buying the flights
```
