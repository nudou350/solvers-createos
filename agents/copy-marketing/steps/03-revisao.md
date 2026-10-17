# Step 3: Legal review, count and delivery

## Goal

Check each text against the law, the sector rules and the channel limits, and deliver everything in a **table** ready to upload to the platform, with the character count shown and the changes explained.

At the end the user must have: a delivery table per channel, a list of what was changed and why (with the rule), items they need to confirm and the suggested test.

## What to ask the user

Only what depends on them:

- "Do you have proof of [claim]? If not, I'll leave the version without it."
- "Can you confirm the council registration number so I can include it?"
- "Until when is the offer valid?"

## How to run

1. **Recount everything.** For each text, count the characters again (spaces, punctuation and emojis included) and compare with the field's limit. A text over the limit goes back for rewriting.
2. **General legal check** (use `search_knowledge("risky promises checklist")`):
   - Advertising disclosure (CDC art. 36; CONAR art. 28; CONAR influencer guide for paid posts).
   - Nothing misleading or abusive, including by omission of an essential condition (CDC art. 37).
   - Every claim backed by proof the advertiser can present (CDC art. 38). A superlative without a source goes out.
   - Price, installments and validity are clear (CDC arts. 30, 31 and 52). Urgency and scarcity are true.
3. **Sector check.** Use `search_knowledge` with the council or agency from the briefing and confirm what the knowledge base provides: CFM, COFFITO, CFO, OAB, Anvisa, betting. Include the mandatory identification (CRM and RQE, CREFITO, CRO, OAB). Cite the rule with number and year **as it appears in the knowledge base**; anything the knowledge base does not cover becomes "confirm at the official source", never a citation from memory.
4. **Personal data check** for email, SMS and WhatsApp: legal basis for the list, identified sender, easy unsubscribe (LGPD, Law 13.709/2018).
5. **Assemble the delivery** with the `entrega-anuncio` template (request it with `get_template`): one table per channel with the columns Field, Variation, Text (count), Limit and Status (within or over). After the table:
   - **What I changed and why**: original phrase, new phrase and rule.
   - **Confirm before publishing**: pending proof, registration number, offer dates, any rule that may have changed. For anything regulated, offer the `checklist-legal` template.
   - **Suggested test**: variation A x B, metric and minimum volume (`plano-de-teste` template).
6. **Close with the disclaimer**: the review is advisory, based on the rules cited as of the knowledge base date, and does not replace legal advice in sensitive cases nor guarantee approval by the platform, CONAR or the council.
7. **Memory.** If the user asks you to remember something (brand tone, banned words, registration number), save it with `save_memory` as a note. Never save without them asking.

## Common mistakes

- Delivering the count in a separate column and the text without the number beside it: it makes checking harder. Use `Text (NN)`.
- Saying "within the limit" without having recounted.
- Citing a generic rule ("according to the law") instead of number and year.
- Forgetting the professional's identification or the paid-post (publi) label.
- Not explaining to the user why one of their phrases was removed.
- Promising that the ad "will get through" the platform or the council: nobody can guarantee that.

## result_summary format

```
Channels delivered: <list>
Texts delivered: <number>, all within the limit: yes | no
Rules applied: <e.g. CDC arts. 36-38; CFM 2.336/2023; LGPD>
Changes made: <original phrase > new (rule)>
User's pending items: <proof, registration, dates>
Suggested test: <V1 x V2, metric, minimum volume>
Advisory-review disclaimer included: yes
```
