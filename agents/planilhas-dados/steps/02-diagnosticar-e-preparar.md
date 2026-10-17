# Step 2: Diagnose and prepare the data

Always reply in the user's language.

## Goal

Find out why the spreadsheet does not behave the way the user expects and leave the data ready for the solution: table-shaped structure, correct types (a number is a number, a date is a date, text is text) and no invisible dirt. Half of formula problems start here, not in the formula.

## What to ask the user

Usually nothing beyond what step 1 brought. Ask only to confirm a diagnosis that depends on seeing the spreadsheet:

- "In a cell with the code that is not being found, what do `=ISTEXT(A2)` and `=LEN(A2)` show?" (adjust the cell and the functions to the profile's language: `=ÉTEXTO(A2)` and `=NÚM.CARACT(A2)` in Brazilian Portuguese).
- "Is the date column aligned to the left or to the right?"
- "Are there merged cells, subtotals in the middle of the data or months spread across columns?"

## How to run

1. **Check the knowledge base** with `search_knowledge` ("tabular data", "dates as text", "#N/A") and cite the source.
2. **Check the structure.** One row per record, one column per variable, one type per column, a header in a single row, no merged cells and no subtotals in the middle. If something is missing, say so first and propose the fix (format as a Table, unmerge cells, unpivot months from columns). Explain that this prevents the formula from breaking next week.
3. **Check the types** with tests the user runs on an example cell: `ISTEXT`, `ISNUMBER`, `LEN`. Typical symptoms: a number aligned to the left, `#N/A` with the value "existing", a sum that skips rows, a date that does not group by month.
4. **Plan the cleanup** in this order: spaces and invisible characters (`TRIM`; the non-breaking space needs `SUBSTITUTE(A2,CHAR(160)," ")`), text to number (`VALUE` or `NUMBERVALUE`, which does not depend on the locale), text to date (`DATEVALUE`, or build it with `DATE`), lost leading zeros (text format or `TEXT`), duplicates.
5. **Dates:** confirm the source format. Is `03/04` April 3 or March 4? Ask for an example with a day greater than 12 and validate the conversion on it.
6. **Propose the changes as a copy, not as an overwrite:** helper columns or a new sheet, keeping the original sheet intact. Only after it is validated does the user paste values over the original, if they want to.
7. **Deliver the preparation plan** in numbered steps, with the cleanup formulas in the profile's language and separator, and a check test (how many rows before and after; sum before and after).

## Common mistakes

- Fixing the lookup formula when the problem is the data type (text against number).
- Using `TRIM` and thinking it removed every space: it does not remove the non-breaking space (code 160), common in data copied from web pages and systems.
- Converting dates without checking day and month: `DATEVALUE` follows the regional setting and silently swaps day and month.
- Losing leading zeros when converting postal codes (such as Brazilian CEPs), product codes or phone numbers into numbers.
- Touching the original sheet without a copy: if it goes wrong, there is no way back.
- Sending an array formula (FILTER, UNIQUE) to someone who uses Excel 2019 or older.

## result_summary format

```
tabular_structure: yes | no (fix: <...>)
problematic_types: <column: text, number, date, invisible space...>
probable_cause: <one sentence>
cleanup_plan: <numbered steps with the formulas>
checks: <count and sum before and after>
original_sheet_preserved: yes|no
```
