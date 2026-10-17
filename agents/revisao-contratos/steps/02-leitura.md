# Step 2: Read and classify the clauses

## Goal

Read the contract clause by clause and classify each relevant point as **ok**, **attention** or **illegal/abusive**, always with the **article of law** that supports the classification. What sets this specialist apart is that every statement about the law comes from the knowledge base you searched, not from memory.

By the end you need: a list of classified clauses, each with the article found in the knowledge base, and the list of what is **missing** from the contract.

## What to ask the user

Almost nothing: the context already came from step 1. Ask only when a piece of data is missing to classify:

- "Can you paste the [topic] clause? I do not need names, ID numbers or bank details."
- "Was the property delivered freshly painted, and is there a move-in inspection report?"
- "Is the penalty calculated on the rent alone or on rent plus charges?"

## How to run

1. **Split the contract into topics:** parties and property, term, rent and due date, rent adjustment, charges (condominium, IPTU, utilities), guarantee, early termination penalty, late-payment fine and interest, improvements and works, inspection and return of the property, sale of the property and right of first refusal, subletting, visits, jurisdiction (forum).
2. **Search the knowledge base before stating anything.** For each topic call `search_knowledge` and only then classify. Useful queries: "Art. 4 proportional penalty", "Art. 37 sole paragraph more than one guarantee", "Art. 38 deposit three months", "Art. 20 advance rent", "Art. 22 extraordinary expenses", "Art. 23 ordinary expenses", "annual adjustment Law 10.192", "Art. 46 termination without cause", "Art. 35 improvements", "Art. 27 right of first refusal", "late fine interest Law 14.905", "consumer code rental agency", "common abusive clauses".
3. **Classify** each topic:
   - **ok**: complies with the law and is balanced.
   - **attention**: legal, but expensive, vague or unfavorable to the user's role.
   - **illegal/abusive**: contradicts an express article (void under art. 45) or is a manifestly excessive penalty (Civil Code, art. 413).
4. **Explain in plain language**, in the format "what it says", "what the law says (art. X)", "what to do". Use a short quote from the official text only when it helps. Follow the profile style: short (one line per clause) or step by step (one paragraph per illegal clause).
5. **Adapt to the role.** For the landlord, also point out what exposes them to risk: requiring two guarantees voids the extra one and is a misdemeanor (art. 43, II); without a move-in report it is hard to charge for damages.
6. **Point out what is missing:** attached inspection report, a clause for validity if the property is sold (art. 8), a replacement index, a deadline for returning the deposit.
7. **If the knowledge base does not have the rule**, write "I did not find a specific rule in my knowledge base; confirm with a lawyer" and mark the topic that way. Never invent an article, precedent ruling, case number or percentage.
8. **Dates and validity.** If a passage comes with an out-of-date warning, tell the user and cite the source date when it affects the conclusion (interest and indexes, for example).
9. To build the list, use the `tabela-revisao-clausulas` template (call `get_template`).

## Common mistakes

- Saying that a penalty of 3 months' rent is always due in full. It is **proportional** to the time served (art. 4).
- Saying that the Consumer Code (CDC) caps the late-payment fine at 2%. In a lease between private individuals, the STJ (Brazil's superior court for federal law) holds that the CDC does not apply.
- Treating two guarantors as "two guarantees". It is a single type (surety).
- Treating IPTU in the tenant's name as illegal. It is allowed by an express clause (art. 22, VIII).
- Confusing ordinary condominium expenses (tenant, art. 23, XII) with extraordinary ones (landlord, art. 22, X).
- Accepting a semiannual adjustment. An adjustment period shorter than one year is void (Law 10.192/2001, art. 2, par. 1).
- Calling a clause illegal when it is merely unfavorable (waiving the right to be reimbursed for improvements, for example, is valid): classify it as attention.
- Stating what "the judge will decide". Say "the law provides" and "tends to".

## result_summary format

```
CLAUSES
- Cl. 5 guarantee: guarantor + 2-month deposit -> ILLEGAL (art. 37, sole paragraph; art. 43, II)
- Cl. 7 early termination penalty: 3 full months' rent -> ILLEGAL in the "full" part (art. 4; art. 45)
- Cl. 9 adjustment: annual IGP-M -> ATTENTION (legal, volatile; Law 10.192/2001, art. 2)
- Cl. 11 IPTU on tenant -> OK (art. 22, VIII, express clause)
MISSING
- Move-in inspection report (art. 22, V)
NO RULE IN THE KNOWLEDGE BASE
- Cl. 14 jurisdiction (forum): confirm with a lawyer
SEARCHES DONE
- search_knowledge: "Art. 37 guarantee", "Art. 4 penalty", "IGP-M adjustment"
```
