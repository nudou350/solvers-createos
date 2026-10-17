---
title: Formula errors, Excel and Sheets limits, and performance
source: Excel specifications and limits (Microsoft) and Google Drive file limits
source_url: https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3
source_date: 2026-10-02
valid_until: 2027-04-30
tags: [erros, limites, desempenho, volateis]
---

## The errors and what usually causes them

The names below are the English ones, with the Brazilian Portuguese name in parentheses when it differs.

`#N/A` (`#N/D`): value not found, different types (text against number), stray spaces or missing arguments. `#VALUE!` (`#VALOR!`): an operation with the wrong type (adding text, a date stored as text, ranges of incompatible sizes). `#REF!`: a deleted or broken reference (a deleted column, a removed sheet). `#DIV/0!`: division by zero or by an empty cell. `#NAME?` (`#NOME?`): a wrong function name or one in another language, text without quotes, a nonexistent defined name. `#NUM!` (`#NÚM!`): an invalid number for the function. `#NULL!` (`#NULO!`): an intersection with no points in common (a space where there should be a `,` or `:`; in Brazilian Portuguese, a `;` or `:`). `#SPILL!` (`#DESPEJAR!`): see the arrays file.

Diagnosis rule: read the message and the cell, evaluate the formula in parts (select a piece and press F9 in Excel) and only then change it. With `#NAME?` on a formula copied from the internet, the first suspect is language and separator.

## Excel limits

According to Microsoft's specifications and limits page: 1,048,576 rows by 16,384 columns per worksheet; 32,767 characters per cell; up to 64 levels of nested functions; up to 255 arguments per function. When a formula gets close to these numbers, the problem is one of design: split it into helper columns or rethink the structure.

## Google Sheets limits

According to Google Drive help: up to 20 million cells or 100 MB for spreadsheets created in Sheets or converted to it. When converting from Excel to Sheets, cells with more than 50,000 characters are removed. If the dataset exceeds these limits, the way forward is a database or an analytics service, not a formula anymore.

## Performance: what makes a spreadsheet slow

Volatile functions (INDIRECT, OFFSET, NOW, TODAY, RAND) recalculate on every change: over thousands of rows they are the most common cause of slowness. References to whole columns inside heavy arrays (SUMPRODUCT, FILTER, ARRAYFORMULA) force the calculation of a million rows: use a Table or a range limited to the size of the dataset with some room to spare. Many exact-match VLOOKUPs over large ranges: use a helper column with the key or switch to XLOOKUP.

In Excel, manual calculation (Formulas > Calculation Options) helps when working in a heavy spreadsheet, but remember to recalculate before using the result (F9).

## Before changing data in bulk

Keep a copy of the sheet or the file. Make the change in a helper column, check it by count and sum (how many rows, what it added up to before and after) and only then paste values over the original. Pasting values is irreversible for the formula that was there.
