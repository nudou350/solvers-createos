# Step 2: Writing by channel

## Goal

Write the piece's variations for each channel in the briefing, **within the limit of each field** and with no claim the user cannot prove. The copy leaves this step already counted; step 3 checks and formalizes it.

At the end you must have: 3 to 5 named variations per channel, each text with its character count in parentheses, the structure used and a single CTA per piece.

## What to ask the user

Normally nothing: the briefing is already approved. Ask only when a real decision comes up:

- "Would you rather test the pain angle or the desire angle first?"
- "Can I cite the number X? Can you back it up?"
- For SMS: "Do you prefer no accents (160 characters fit) or with accents (70 fit)?"

## How to run

1. **Reread the profile and the briefing.** Use the brand's tone and banned words. If the profile indicates little proof, write with a concrete benefit and no numbers; if it indicates plenty, open with the strongest proof.
2. **Choose the structure** (use `search_knowledge("AIDA PAS 4U")` if needed): PAS for short ads and social media, AIDA for email and pages, 4U for headlines and subject lines, BAB for services.
3. **Write field by field, respecting each limit:**
   - **Google Ads RSA**: 10 to 15 headlines of up to 30 characters, each making sense on its own; 4 descriptions of up to 90; 2 paths of up to 15. Keyword in 2 or 3 headlines.
   - **Meta**: hook and offer in the first ~125 characters of the primary text; headline up to ~40; description up to ~30, with no essential information.
   - **Email**: subject up to ~50; preheader of 40 to 90 that complements the subject; body with one CTA; footer with identification and unsubscribe.
   - **SMS**: sender at the start and a way to opt out; 160 characters without accents outside GSM-7, or 70 with accents (see the limits knowledge base).
   - **WhatsApp**: first line with the hook, short body, one button, a way to opt out.
   - **Influencer paid post (publi)**: advertising disclosure on the **first line**, within the visible characters (see the influencer guide knowledge base).
4. **Count every text** in groups of 10 characters, including spaces, punctuation and emojis, and write the count in parentheses right after: `Pilates for back pain (21)`. Leave 2 or 3 characters of headroom under the limit. If it goes over, rewrite; do not cut a word.
5. **Vary one axis at a time** between variations (angle, proof, offer or CTA) and name each one ("V1 pain", "V2 numeric proof").
6. **Apply the sector rules while writing**, not only in the review: no promise of results in health and law, no therapeutic claims for supplements and cosmetics, price only if the council allows it.
7. **Swap promises for facts** (use `search_knowledge("swap promise for fact")`): "the best" becomes a verifiable data point; "guaranteed" goes out.
8. Show the variations to the user and move on to the review.

## Common mistakes

- Counting "by eye" and being off by 2 or 3 characters. Accented letters count as 1; emojis may count as 2 in some tools.
- Google headlines that only make sense together.
- Hiding the offer condition or the advertising disclosure after the "see more".
- An SMS containing "não" and "promoção" counted as if 160 characters fit.
- Several CTAs in the same piece.
- Inventing a testimonial, a number or a seal. If there is no proof, say it is missing and suggest how to collect it.
- Agency-speak ("innovative solutions") in place of the customer's own words.

## result_summary format

```
Structure: <PAS | AIDA | 4U | BAB>
Channels: <list>
Variations: <V1 name, V2 name, V3 name...>
Axis tested: <angle | proof | offer | CTA>
Texts over the limit that were rewritten: <how many>
Claims removed for lack of proof: <list>
Tone applied: <from the profile or the briefing>
```
