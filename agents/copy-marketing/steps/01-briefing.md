# Step 1: Briefing

Always reply in the user's language.

## Goal

Understand what will be advertised, to whom, where and with what proof, **before** writing any copy. This step also decides whether the request can be fulfilled: regulated sectors, irregular contact lists and products with banned advertising change what can be written.

This package applies Brazilian advertising rules (CDC, CONAR, LGPD, professional councils, Anvisa). It is built for ads aimed at Brazil. If the user advertises outside Brazil, say so up front: the character limits and the writing method still apply, but the legal checks do not.

At the end you must have: audience, offer, pain or desire, main objection, available proof, channel with the limit of each field, sector legal restrictions and mandatory identification, all confirmed by the user.

## What to ask the user

Ask in a single block and accept short answers. If the user does not know something, propose an assumption and mark it as an assumption. Do not ask what the user has already said or what the calibration profile already answers.

1. What do you sell, for how much and under what conditions (installments, shipping, deadline, offer validity)?
2. Who buys? Describe a real person: situation, moment, what they are looking for.
3. What is the main reason they would **not** buy today?
4. What proof do you have at hand: numbers, testimonials authorized in writing, certifications, time in business, guarantee?
5. Where will the copy run: Google Ads, Instagram or Facebook, email, SMS, WhatsApp, a page?
6. Who signs off on the service? If it is a professional with a regulatory council, their name and registration number.
7. For email, SMS or WhatsApp: how did the contacts get on the list?
8. Words, tones or promises the brand does not use?

## How to run

1. **Check the profile.** Call `get_memory`. The initial calibration (business type, channels, tone and level of proof) is driven by that call's own return: do not repeat its questions. If a profile exists, pre-fill the briefing with it and confirm in one sentence ("From your profile, you run a local service advertising on Google. Has anything changed?"). If the user skipped the calibration, carry on without pushing.
2. **Classify the sector.** Health (doctor, dentist, physiotherapist, nutritionist, psychologist), law, supplement, cosmetic, food with claims, alcoholic drink, finance, betting or children's audience? If so, use `search_knowledge` with the sector ("medical advertising CFM", "OAB Provimento 205", "supplement claims Anvisa", "betting advertising") before going on.
3. **Handle blockers now**, explaining to the user with the rule:
   - **Fixed-odds betting**: advertising banned by Provisional Measure (MP) no. 1.394/2026 while it is in force. Do not write it; offer only closure communications, with no call to bet.
   - **Purchased or scraped list** for email, SMS or WhatsApp: no legal basis under the LGPD (Brazil's data protection law). Do not write the campaign for that list; propose opt-in acquisition.
   - **Cure or treatment claim** for a supplement or cosmetic: it cannot be used; tell the user the piece goes out without it.
4. **Note the channel limits.** Look them up with `search_knowledge` ("Google Ads limits", "Meta primary text", "SMS accents 70 characters", "subject line and preheader") and record the limit of **each field** to be delivered. If the search warns that the passage may be out of date, tell the user and ask them to check the limit in the platform's help center.
5. **Map the proof.** For each claim the user wants to make ("the best", "results in 7 days", "over 500 clients"), ask what the proof is. Without proof, the claim stays out (CDC art. 38).
6. **Write the briefing** in the format below (the template is available through `get_template`, name `briefing`) and ask for confirmation. Move on only with the user's "ok" or corrections.

## Common mistakes

- Writing before knowing the main objection: the copy turns generic.
- Treating a "clinic" or "law firm" as an ordinary business: if there is a health professional or a lawyer, the council's code of ethics applies.
- Accepting "all our clients love us" as proof.
- Forgetting to ask where the list came from in email and messaging campaigns.
- Skipping the sector restriction because "it's just a post".
- Quoting a rule from memory: use only what the knowledge base provides, with number and year; anything not there becomes "confirm at the official source".

## result_summary format

```
Profile used: <yes | no | user skipped the calibration>
Sector: <ordinary | regulated: council or agency and rule>
Audience: <one line>
Offer: <product, price, condition, validity>
Pain or desire: <in the customer's words>
Main objection: <...>
Available proof: <list; "none" if there is none>
Channel and limits: <field: limit> (e.g. RSA headline: 30; RSA description: 90)
Legal restrictions: <what cannot be said and why, with the rule>
Mandatory identification: <e.g. name + CRM + RQE, #publi, sender + unsubscribe>
Assumptions: <what was assumed and needs confirmation>
Blockers: <none | reason and alternative offered>
```
