Yes. Two things drive SMS writing: the character limit and the accents. An SMS holds 160 characters in the standard GSM-7 alphabet, but drops to **70** as soon as a single character outside it appears (ã, ç, õ, á, ô... or an emoji). Longer messages are split into parts (153 or 67 characters) and each part is billed. So I give you two ways out: **without accents (160 fit)** or **with accents (70 fit)**. The messages stay in Portuguese because your customers are Brazilian and that is where the accent issue applies; an English gloss follows. This review is advisory and applies Brazilian rules only.

## Briefing (draft to confirm)

- **Sector:** ordinary (food retail). No therapeutic or superlative claims.
- **Offer:** large pizza, 20% off, every Tuesday. Assumptions to confirm: dine-in and delivery both count, no end date, "large" means one size on the menu.
- **Mandatory in SMS:** sender at the start and a way to opt out.
- **Contact list (LGPD):** I assume these are customers who agreed to receive messages from the pizzeria (opt-in) or whom you contact under documented legitimate interest as current customers. If the list was bought, I can't write the campaign for it. Please confirm.
- **Placeholders:** "Pizzaria Bella" and the WhatsApp number (11) 90000-0000 are examples; replace them with yours and I will recount.

## Option A: no accents (limit 160 characters, one SMS)

| Variation | Text (count) | Limit | Status |
|---|---|---|---|
| V1 direct | Pizzaria Bella: toda terca, pizza grande com 20% off. Peca no WhatsApp (11) 90000-0000. Resp SAIR p/ nao receber (112) | 160 | within |
| V2 day hook | Pizzaria Bella: terca e dia de pizza grande com 20% off. Cardapio no WhatsApp (11) 90000-0000. Resp SAIR p/ parar (113) | 160 | within |
| V3 order channel | Pizzaria Bella: pizza grande com 20% off toda terca. Peca pelo WhatsApp (11) 90000-0000. Resp SAIR p/ sair da lista (115) | 160 | within |

## Option B: with accents (limit 70 characters, one SMS)

| Variation | Text (count) | Limit | Status |
|---|---|---|---|
| V1 direct | Bella: pizza grande -20% toda terça. SAIR p/ parar (50) | 70 | within |
| V2 clear offer | Bella: toda terça, pizza grande com 20% off. SAIR p/ parar (58) | 70 | within |
| V3 day hook | Bella: terça é dia de pizza grande -20%. SAIR p/ parar (54) | 70 | within |

Gloss: "Bella Pizzeria: every Tuesday, large pizza 20% off. Order on WhatsApp. Reply SAIR (STOP) to opt out." Option B has no room for the WhatsApp number, so the person has to know where to order; Option A carries the CTA.

Axis tested: angle and CTA wording. One CTA per message. I put the sender at the start and the opt-out at the end of each. Honor the opt-out immediately.

## What I would not use and why

- "Hoje tem promoção imperdível!!!" or similar: vague and spammy, and without a condition (CDC art. 31 asks for clear, precise offer information). Keep the condition: large pizza, Tuesdays.
- An original version with accents at ~180 characters would go out as 3 billed messages.

## Confirm before publishing

- [ ] That the contacts are customers who agreed to receive your messages (LGPD, Law 13.709/2018).
- [ ] The offer conditions (which sizes, dine-in or delivery, any exclusion) and the real WhatsApp number.
- [ ] Timing: avoid late night and early Sunday.

## Suggested test

Send V1 against V3 of Option A to equal halves of the list, changing only the CTA wording. Metric: WhatsApp replies and orders on Tuesday. Keep the winner only after enough sends.

Advisory review as of October 2, 2026 (knowledge base). It does not replace legal advice.
