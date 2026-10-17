# Step 4: Negotiation questions and final delivery

## Goal

Deliver material the user can **use today**: a summary table, questions to send to the other party, notice templates and next steps. Plain language, respectful tone, no alarmism and no promised results.

By the end the user must have: the review table, the main calculations, ready-to-send questions, next steps with deadlines and the lawyer notice in the right place.

## What to ask the user

Only what changes the delivery:

- "Do you want me to write the messages to the landlord or to the real estate agency?"
- "Is there an upcoming deadline (signing, move-out date, rent due date)?"
- "Do you want the inspection checklist now?" (if the user has not signed yet or has not moved in)

## How to run

1. **Lawyer notice.** If step 1 flagged **high risk**, the delivery **opens** with the notice below, before any table. In all other cases, the delivery ends with "This review does not replace the advice of a lawyer."

   > **Attention: your case has high-risk signals ([reason]). Seek a lawyer or the Public Defender's Office (Defensoria Pública) before signing or replying. [If there is a summons: the 15-day period to pay and avoid eviction runs from the summons (art. 62, II).]**

2. **Summary table.** Call `get_template` with `tabela-revisao-clausulas`. Fill in: clause, what it says, classification (ok, attention, illegal or abusive), article and what to do. Illegal ones first, then the attention ones.
3. **Main calculations** from step 3, one line each, with the caveat that they are estimates.
4. **Negotiation questions.** Call `get_template` with `perguntas-para-negociar`. Choose only those that apply and adapt them to the user's role. For each illegal clause, include a proposed alternative wording. Polite and objective tone, citing the article ("Under art. 37, sole paragraph, of Law 8.245/1991...").
5. **Notice templates.** If the case calls for it (leaving the contract, job transfer, deposit return, request for a validity clause), use the `modelos-de-aviso-e-pedidos` template. Remind the user that the notice must be **in writing** and kept with proof of delivery.
6. **Inspection.** If the contract has not been signed yet or the move has not happened, offer the `checklist-vistoria` template.
7. **Next steps**, numbered, with the legal deadline when there is one (e.g., "give written notice 30 days in advance").
8. **Adjust to the profile.** Short style: the table and three next steps. Step by step: explain each illegal clause in a paragraph. If the user asks you to remember something (e.g., the date of the notice), save it as a note with `save_memory`; without a request, do not save anything.

## Common mistakes

- Drafting the whole contract or guaranteeing a result ("the judge will annul it"). Say "the law provides" and "tends to".
- Recommending that the user stop paying rent as leverage: this opens the way to eviction (art. 9, III).
- Advising the landlord to change the locks, cut off power or remove belongings: only an eviction action takes the property back (art. 5).
- Stating something that is not in the knowledge base you searched. If information is missing, say what to confirm.
- Sending a long table without prioritizing: start with the illegal clauses and the ones that cost money.
- Forgetting the lawyer notice at the start when the risk is high.
- Putting names, ID numbers or bank details in the templates: leave the fields in square brackets for the user to fill in.

## result_summary format

```
LAWYER NOTICE: at the start (high risk: eviction summons) | at the end (default)
TABLE: 9 clauses -> 2 illegal, 3 attention, 4 ok
CALCULATIONS: early termination penalty month 12 = R$ 3,600; simulated adjustment R$ 2,090 (estimates)
QUESTIONS: 5 questions sent (guarantee, penalty, adjustment, inspection, sale)
TEMPLATES: move-out notice (art. 6) | none
NEXT STEPS: request deposit release; attach inspection report; register the contract
```
