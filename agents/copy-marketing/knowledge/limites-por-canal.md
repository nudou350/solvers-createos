---
title: Character limits by channel (Google Ads, Meta, email, SMS, WhatsApp)
source: Central de ajuda do Google Ads, Meta for Business e WhatsApp Business Platform; especificação GSM 03.38 para SMS
source_url: https://support.google.com/google-ads/
source_date: 2026-10-02
valid_until: 2027-01-31
trial: true
tags: [limites, caracteres, limits, characters, google ads, meta, sms, whatsapp, e-mail]
---

# Character limits by channel

Reference as of October 2, 2026. Platform limits change without notice: check the platform's help center before uploading the campaign. Spaces, punctuation and emojis count as characters.

## How to count and show the count

- Count **all** characters: letters, spaces, punctuation, emojis and symbols. "R$ 197" is 6 characters.
- Show the count in parentheses right after each text: `Physiotherapy in Campinas (25)`. This also applies inside tables.
- If it goes over the limit, **rewrite**. Never cut a word in half nor trust "the platform trims it automatically".
- When in doubt between two spellings, prefer the shorter one that stays natural ("48 h" instead of "48 hours" only if the audience will understand).
- Avoid abbreviations the audience does not use ("serv." instead of "service" sounds amateur).

## Google Ads: responsive search ad (RSA)

| Field | Limit | Quantity |
|---|---|---|
| Headline | 30 characters | 3 to 15 (recommended: 10 or more) |
| Description | 90 characters | 2 to 4 |
| Display path | 15 characters each | up to 2 (e.g. `/physiotherapy/spine`) |

Practical RSA rules:

- Google **combines headlines and descriptions automatically**. Each headline must make sense on its own and in any order; do not write a headline that continues another ("Book today" + "your assessment").
- Do not repeat the same idea across several headlines: vary between offer, proof, location, differentiator and CTA.
- Include the main keyword in at least 2 or 3 headlines.
- Pinning a headline to position 1 reduces combinations; use it only when there is a legal or brand requirement (e.g. mandatory professional identification).
- Characters of double-width languages (Chinese, Japanese, Korean) count as 2. Accented letters in Portuguese count as 1.
- Google's advertising policies have their own restrictions for health, finance, gambling and other sectors; they add to Brazilian law.

## Meta: Facebook and Instagram (feed ads)

| Field | Reference | Note |
|---|---|---|
| Primary text | ~125 characters visible before "see more" | The text can be longer, but the hook and the offer stay in the first 125 |
| Headline | ~40 characters | Appears below the media; cut off on small screens |
| Description | ~30 characters | Many placements do not show it at all; do not put essential information only here |

- Meta's values are **display recommendations**, not field locks. Treat them as limits anyway.
- Mandatory information (offer condition, advertising disclosure, legal warning) cannot be hidden after the "see more" if it is essential to the decision.
- Organic Instagram post caption: up to 2,200 characters, but it also cuts off at ~125 in the feed. Same hook rule.

## Email: subject and preheader

| Field | Recommendation | Why |
|---|---|---|
| Subject | up to ~50 characters (ideal 30 to 50) | Phones cut long subjects |
| Preheader | 40 to 90 characters | Text shown beside or below the subject in the inbox |
| Sender name | recognizable name ("Ana, from Store X") | It weighs on opens as much as the subject |

- The preheader **complements** the subject; do not repeat it. Subject: "Your cart is still here" (23). Preheader: "Free shipping over R$ 150 until Sunday" (38).
- If the preheader is not set, the email client shows the start of the body ("Can't see this email?"), wasting space.
- The subject cannot mislead about the content (CDC art. 37 and LGPD, see the email knowledge base).
- Avoid ALL CAPS, excess "!!!" and a lone "FREE": besides sounding like spam, it hurts delivery.

## SMS: 160 or 70 characters

- An SMS has **160 characters** in the standard GSM-7 alphabet, but drops to **70 characters** if there is **a single** character outside it (Unicode/UCS-2 encoding).
- In Portuguese this weighs heavily: **á, í, ó, ú, â, ê, ô, ã, õ and lowercase ç** are not in GSM-7. A word like "não", "você" or "promoção" drops the message to 70 characters. Emojis too. In English, only emojis, curly quotes and a few symbols trigger the same drop.
- Long messages are split into parts of 153 (GSM-7) or 67 (Unicode) characters, and each part is billed.
- Two ways out: (1) write **without problematic accents** and fit within 160, telling the user about the swap; (2) keep accents and fit within 70. Tell the user which of the two was used and the count.
- Identify the sender at the start ("Pizzaria Bella:") and include how to stop receiving ("Resp SAIR p/ nao receber", in Portuguese; "Reply STOP to opt out" in English).

## WhatsApp Business (official API, message templates)

| Component | Limit |
|---|---|
| Text header | 60 characters |
| Body | 1,024 characters |
| Footer | 60 characters |
| Buttons | short text (about 20 to 25 characters, check in WhatsApp Manager) |

- Company-initiated messages outside the conversation window require a **template approved** by Meta in the right category (marketing, utility or authentication).
- Meta requires the contact's **opt-in** (permission) to receive messages from the company and a way to opt out; this adds to the LGPD.
- Even with 1,024 characters available, the message that works is short: hook on the first line, offer, one button.

## Other useful fields

| Channel | Field | Reference |
|---|---|---|
| Page / SEO | Title tag | ~50 to 60 characters |
| Page / SEO | Meta description | ~150 to 160 characters |
| Push (app) | Title / text | ~40 / ~100 visible characters, varies by system |

These are display references, not legal limits. When the user mentions another channel, ask for the field limit or ask for a screenshot of the tool.
