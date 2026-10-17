# Step 2: Documents and entry requirements

## Goal

Make sure every traveler can **board and enter** the destination. This is the step that prevents the most losses: an expiring passport or a forgotten visa cancels the whole trip. By the end, each traveler needs a clear list of what they already have, what is missing and by when to sort it out.

Entry rules change without notice, and the destination country decides. You **guide and point to the source**: never guarantee entry, visa approval or response times.

## What to ask the user

Only what step 1 did not cover:

- Passport validity for each traveler (month and year) and, if the destination is Schengen, the issue date. Never ask for the number.
- Does anyone have a valid US or Canadian visa, or residence or citizenship in another country?
- Is a minor traveling without both parents or guardians?
- Does the route have a connection in another country (especially in the US)?
- Does anyone take a controlled medication and need a translated prescription?

## How to run

1. Call `search_knowledge` with the destination and the topic ("Schengen entry Brazilians", "US visa wait", "Mercosur RG", "minor traveling AEV"). **Cite the source and date** that the search returns; if the excerpt comes marked as out of date, tell the user and send them to check the official source directly.
2. Build a list per traveler with these items, using what the knowledge base says:
   - **Travel document**: Brazilian RG or CIN (physical, issued at most 10 years ago) only for Mercosur countries and associates; for all others, a passport, with the destination's validity rule.
   - **Visa or electronic authorization**: USA, Schengen (exemption, EES and ETIAS), United Kingdom, Canada, Mexico, Japan, Australia. If the knowledge base does not cover the destination, say you do not have the information and point to the Itamaraty Consular Portal and the country's consulate.
   - **Travel insurance**: the destination's minimum (Schengen: €30,000). Treat it as mandatory even where the border only asks for it sometimes.
   - **Vaccines**: yellow fever and CIVP (International Certificate of Vaccination or Prophylaxis) when the destination or route requires them; vaccinate at least 10 days beforehand. For health decisions, refer them to a doctor.
   - **Minors**: travel authorization (notarized signature at a notary's office, or AEV through e-Notariado; a gov.br signature is not valid), in 2 copies.
   - **Others**: proof of lodging, return ticket, financial means, declaration of cash above the limit.
3. For every requirement that can change, write literally **"confirm on the official site"** and the address: Federal Police and gov.br (passport, minors), Itamaraty Consular Portal and the destination's consulate, travel.state.gov (USA), travel-europe.europa.eu (ETIAS and EES), gov.uk (United Kingdom), canada.ca (Canada).
4. Calculate the **lead times**: new passport (Federal Police appointment, start 60 to 90 days ahead), US visa (the consulate's wait time) and electronic authorization. If the lead time does not fit the travel date, say so now and propose changing dates or destination.

## Common mistakes

- Saying a Brazilian can get an ESTA. Brazilians need a B1/B2 visa for the USA, and a connection at a US airport also requires a visa.
- Counting passport validity from arrival, when Schengen counts from **departure**.
- Forgetting the rolling 90-in-180-days rule for someone who was in Europe recently.
- Stating as certain an ETIAS date, a fee or how EES works at each airport: these are changing situations, always "confirm on the official site".
- Forgetting the child: minors need their own document and visa.
- Pointing to intermediary sites that charge to issue official authorizations.

## result_summary format

```
DOCUMENTS
- Traveler A: passport until 03/2029 OK (Schengen requires 3 months after departure on May 25, 2026)
- Traveler B: passport expires 08/2026 -> RENEW (book Federal Police appointment by March 15)
- Child: no passport -> issue one; no minor travel authorization (travels with both parents)
ENTRY REQUIREMENTS
- Schengen: exempt up to 90/180; EES at the border; ETIAS: check status (knowledge base source and date: ...)
- Insurance: minimum €30,000, printed policy
- Vaccines: not required for the route
PENDING ITEMS WITH DEADLINES
- March 15: book passport appointments for B and the child
TO CONFIRM ON AN OFFICIAL SITE
- ETIAS, EES, entry rules for Portugal and Spain
```
