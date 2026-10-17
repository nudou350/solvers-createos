# Step 4: An itinerary with a doable pace

## Goal

Create a day-by-day itinerary that the traveler **can actually complete** without coming home exhausted: few bases, smart transfers, attractions grouped by area and planned breaks. The itinerary also lists what needs to be booked in advance and by when.

## What to ask the user

- What are the 3 things they cannot miss seeing or doing? Everything else is optional.
- Do they prefer changing city more often or staying longer in each place?
- Would they rent a car? Do they have a license and road experience? (In several countries an International Driving Permit, issued by the Brazilian Detran, is required or recommended: confirm on the official site.)
- What time are the flights already bought, if any?
- Are they interested in day trips from a base?

## How to run

1. Use `search_knowledge` with "itinerary pace" and with the destination and season ("seasonality Europe May", "Orlando July parks"). Re-read the user's **pace** from the profile: relaxed calls for 1 major attraction per day; moderate, up to 2; intense, 2 with clearly marked days off.
2. Apply the pace rules, which are the heart of this specialist:
   - **At most 1 or 2 major attractions per day** (half a day or more: a big museum, a theme park, a hike, a palace with a queue). Fill in with light things: a neighborhood to stroll, a viewpoint, a market.
   - **A travel day counts as half a day, at most**: a 1-hour flight eats 4 to 6 hours door to door.
   - **An international arrival day counts as almost zero**: only a light walk near the hotel, nothing with a timed ticket.
   - **Minimum of 3 nights per base**. Number of nights ÷ 3 = maximum number of bases; if it comes to fewer than 3 per city, cut cities or turn them into day trips.
   - **Group by area** and avoid crossing the city twice. **A day off every 4 or 5 days** on long trips, and a free afternoon with small children or older relatives.
   - **Consider the calendar**: weekly closing day of museums, local holidays, Sundays. In a rainy or very hot destination, give a covered plan B for each day.
   - **Last day**: nothing timed before the flight; arrive at the airport 3 hours early for an international flight.
3. Generate the itinerary with `get_template` (name `roteiro-modelo`): day, date, city, morning, afternoon, evening, transfer, plan B, booking needed and note.
4. List separately the **critical bookings with deadlines** (for example, attractions with quotas, high-speed trains and parks with timed entry) and tell the user to confirm the sales window on each attraction's official site.
5. If the user's request is unworkable (6 cities in 12 days), explain why and propose the corrected version, keeping their 3 priorities.

## Common mistakes

- **The "turbo" itinerary**: 6 cities in 12 days, 4 museums a day. It is generic AI's number one mistake and the one that causes the most regret.
- Ignoring door-to-door transfer time and jet lag (with a time difference of 4 or 5 hours or more, the first day yields little).
- Suggesting a train route that does not exist or is very slow: if you are not sure, tell the user to check the operator's site.
- Not respecting the user's 3 priorities or the pace in the profile.
- Forgetting the season: extreme heat in the European summer, hurricanes in the Caribbean, rains on the Northeast Brazilian coast from April to July.

## result_summary format

```
ITINERARY
- Bases: Lisbon (4n), Porto (3n), Madrid (4n), Seville (3n)
- Transfers: Lisbon->Porto train (~3h), Porto->Madrid flight, Madrid->Seville train (~2h30)
- Days off: day 6 (Porto), day 11 (Madrid)
- Priorities met: Sintra, Prado Museum, flamenco in Seville
CRITICAL BOOKINGS
- Pena Palace: buy online in advance (check the deadline on the official site)
- Madrid-Seville train: buy as soon as sales open
PENDING ITEMS
- Confirm opening hours and closing days of the attractions
```
