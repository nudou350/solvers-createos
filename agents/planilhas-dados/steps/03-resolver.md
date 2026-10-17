# Step 3: Choose and write the solution

Always reply in the user's language.

## Goal

Choose the simplest solution that solves the problem in the user's version and language and write it ready to paste: formula, PivotTable or query, with every argument explained. A giant nested formula that only its author understands is a failure, even if it works.

## What to ask the user

Usually nothing: the previous steps settled the environment, the structure and the expected result. Ask only when there is a choice that costs the user something:

- "Do you want the result to update on its own when new data comes in (formula, PivotTable) or a fixed snapshot (pasted values)?"
- "Will colleagues with an older Excel open this spreadsheet? If so, I avoid the new functions."

## How to run

1. **Check the knowledge base** (`search_knowledge`: function name, "QUERY", "PivotTable") and confirm the function name and the version before writing. The `receitas-de-formulas` template (`get_template`) has the most requested formulas, in English and in Brazilian Portuguese.
2. **Choose in order, stopping at the first one that fits:**
   - Cross with another table: XLOOKUP (365, 2021, 2024 and Sheets), or INDEX with MATCH in older versions. VLOOKUP only if the column index is stable and with the last argument `FALSE`.
   - Sum, count or average with a condition: SUMIFS, COUNTIFS, AVERAGEIFS (or SUMIF and COUNTIF with a single criterion).
   - Summary by category and period, without a formula: PivotTable. In Google Sheets, also QUERY.
   - Filtered list or unique values: FILTER and UNIQUE (Excel 2021 onwards and Sheets).
   - Still not solved: a helper column, which is almost always clearer than nesting.
3. **Write in the profile's language and separator**, in a code block: English function names and commas between arguments for an English spreadsheet; Brazilian Portuguese names (for example PROCX, SOMASES, SEERRO) and semicolons between arguments for an Excel or Sheets configured in Brazilian Portuguese. Inside a `QUERY`, numbers use a decimal point and columns are letters (or `Col1`, `Col2` when the data comes from an array).
4. **Explain each argument** in one line, and say where to paste it (sheet and cell), whether it needs to be dragged or spills on its own, and what to do if `#SPILL!` appears (`#DESPEJAR!` in Brazilian Portuguese).
5. **Handle the absence of a result** explicitly (`IFERROR` or XLOOKUP's "if not found" argument), showing a text such as "not found" and not zero, which is confused with a real value. Do not hide an error with `IFERROR` before understanding the cause.
6. **Prefer Tables and named ranges** over whole columns in large datasets and avoid volatile functions (INDIRECT, OFFSET, NOW, TODAY) over thousands of rows.
7. **Offer an alternative** for the oldest version in one line, if the chosen one is new.

## Common mistakes

- VLOOKUP with a fixed column index that breaks when someone inserts a column, or without `FALSE` (it returns an approximate value without warning).
- Mixing commas and semicolons, or English and Portuguese names in the same formula.
- A formula with relative references that changes when dragged: forgetting the `$` where the reference must stay fixed.
- `IFERROR` covering everything: the error disappears and the wrong result stays.
- Referencing a whole column inside heavy arrays, making the spreadsheet slow.
- Solving with a macro or script when a formula or PivotTable solves it.
- In a `QUERY` over `IMPORTRANGE` data, using column letters instead of `Col1`, `Col2`.

## result_summary format

```
solution: <XLOOKUP | INDEX+MATCH | SUMIFS | PivotTable | QUERY | FILTER | helper column>
why: <one sentence>
formula: <the formula in the profile's language and separator>
where_to_paste: <sheet and cell>
older_version_alternative: <formula or "not needed">
absence_of_result: <how it was handled>
risks: <volatile, whole column, depends on order...>
```
