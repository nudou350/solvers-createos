# Step 1: Understand the problem and the spreadsheet

Always reply in the user's language.

## Goal

Leave this step knowing which program, version and language the user works in, what they want to get and what the data looks like, without having asked for any real personal data. A formula written for the wrong version or the wrong language is the most common cause of "I copied it and got an error".

## What to ask the user

Before asking, call `get_memory`. If the profile comes back (program, language, level, use), use it and do not repeat the questions. If it returns `needs_onboarding`, ask the calibration questions in at most two messages, explain in one sentence why each one matters and accept "skip".

Then ask only what is still missing about this problem, all at once:

1. What result do you expect? Show an example of the right value for one row.
2. What are the columns and what is in each one? Paste 3 to 5 example rows.
3. Where will the result live (another sheet, a single cell, a report)? Does the data grow over time?
4. If there is an error: which message appears (#N/A, #VALUE!, #REF!, #DIV/0!, #SPILL!; in a Portuguese-language spreadsheet #N/D, #VALOR!, #REF!, #DIV/0!, #DESPEJAR!) and which formula did you use?

Explain that personal data (names, ID numbers, emails, phone numbers) and real values should be replaced by made-up examples with the same format. The whole spreadsheet is not needed.

## How to run

1. **Save the profile** if the user answered the calibration just now: `save_memory` with `kind: "profile"` and a short summary (program and version, language and separator, level, use). If they skipped, save `{"skipped": true}` and assume Excel 365 with function names in the language the user is writing in (English names and commas for English; Brazilian Portuguese names and semicolons for Portuguese), say that you assumed it and offer the alternative for an older version or another language. If memory is not available on this connection, do the same.
2. **Confirm the environment.** Program and version define the available functions: XLOOKUP, FILTER, UNIQUE and SORT do not exist in Excel 2019 or 2016; TEXTSPLIT and TEXTBEFORE only exist in Excel 365 and 2024. Use `search_knowledge` ("functions by version", "separators") to check and cite the source's date. This knowledge base covers function names in English and in Brazilian Portuguese; for a spreadsheet in another language, write in English and tell the user to type `=` and the first letters to see the name their program accepts.
3. **Rewrite the problem in one sentence** in the format "From <data> I want <result> when <condition>" and confirm it with the user.
4. **Classify the type of problem:** look up a value in another table, sum or count with a condition, clean or convert data, summarize (PivotTable or QUERY), validate input, or fix a formula that already exists.
5. **Record the assumptions** (e.g. "data in the Sales sheet, header in row 1") and ask for corrections before moving on.

## Common mistakes

- Writing the solution before knowing the version: XLOOKUP does not work for someone with Excel 2019.
- Writing the formula in English, or with a comma, for someone whose spreadsheet is in Portuguese (or the other way around).
- Asking for the whole spreadsheet or for real data. Ask for a made-up excerpt with the same format.
- Accepting "it doesn't work" without the error message and the formula used.
- Confusing the expected result with the way to get there: the user asks for "a VLOOKUP", but what they want is to cross two tables.

## result_summary format

```
profile: program=<...>, language_separator=<en-US , | pt-BR ;>, level=<...>, use=<...> (memory | answered now | skipped)
problem: <From ... I want ... when ...>
type: <lookup | conditional sum | cleanup | summary | validation | fix>
data: <columns and an anonymized example>
expected_result: <one-row example>
assumptions: <short list>
confirmed_by_user: yes|no
```
