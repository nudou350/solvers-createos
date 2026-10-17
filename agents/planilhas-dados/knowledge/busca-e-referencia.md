---
title: Looking up values: VLOOKUP, XLOOKUP, INDEX with MATCH and the #N/A error
source: Microsoft Support (XLOOKUP, VLOOKUP, INDEX/MATCH and fixing #N/A; pt-BR pages)
source_url: https://support.microsoft.com/pt-br/office/fun%C3%A7%C3%A3o-procx-b7fd680e-6d10-43e6-84f9-88eae8bf5929
source_date: 2026-10-02
valid_until: 2027-04-30
tags: [procx, procv, indice, corresp, n-d]
---

## VLOOKUP: when it fits and what breaks

Official syntax: `VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])` (in Brazilian Portuguese, `PROCV(valor_procurado; matriz_tabela; núm_índice_coluna; [intervalo_pesquisa])`). It only looks from left to right (the lookup value sits in the first column of the array) and the column index is a fixed number: if someone inserts a column, the result changes without warning. Without the last argument set to `FALSE`, the search is approximate and returns a wrong value when the data is not sorted. So always write `FALSE` (or `0`) for an exact match.

It is available in every version of Excel and in Sheets.

## XLOOKUP: the default choice when it exists

Official syntax: `XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])` (in Brazilian Portuguese, `PROCX(valor_procurado; matriz_procurada; matriz_retorno; [se_não_encontrada]; [modo_correspondência]; [modo_pesquisa])`). It looks in any direction, has its own argument for "not found" and does not depend on a column number. Match mode: `0` exact (default), `-1` exact or the next smaller item, `1` exact or the next larger, `2` with wildcards. Search mode: `1` first to last (default), `-1` last to first, `2` and `-2` binary.

Availability according to Microsoft: Excel 2021, 2024, Microsoft 365 and Excel for the web; it does not exist in Excel 2019 or 2016. Example: `=XLOOKUP(A2,Clientes!A:A,Clientes!C:C,"not found")`.

## INDEX with MATCH: the alternative for older versions

`=INDEX(Clientes!C:C,MATCH(A2,Clientes!A:A,0))` (in Brazilian Portuguese, `=ÍNDICE(Clientes!C:C;CORRESP(A2;Clientes!A:A;0))`). The `0` in MATCH is the exact match. It works in any version, looks in any direction and does not break when a column is inserted, because the references adjust. It is the right answer for someone on Excel 2019 or older who needs to look to the left.

For more than one criterion without new functions: add a helper column that joins the criteria (`=A2&"|"&B2`) and look up in it. With XLOOKUP in Excel 365: `=XLOOKUP(1,(Dados[Cliente]=A2)*(Dados[Mês]=B2),Dados[Valor])`.

## Why #N/A appears with the value "existing"

The official page about the #N/A error (#N/D in Brazilian Portuguese) lists the causes: the value really is not in the data; the types do not match (a number on one side, text on the other); stray spaces at the start or the end; an approximate match used where an exact one was intended; ranges of different sizes in array formulas; missing arguments.

Diagnosis in two tests: `=ISTEXT(A2)` in both sheets (if one side gives TRUE and the other FALSE, the type is the cause) and `=LEN(A2)` (if the number of characters is greater than what is visible, there is a space or an invisible character). In Brazilian Portuguese: `=ÉTEXTO(A2)` and `=NÚM.CARACT(A2)`. Fix: `TRIM`, `VALUE`, or standardize the column with Text to Columns. See the data cleaning file.

## Handle "not found" without hiding the error

`IFERROR` (`SEERRO` in Brazilian Portuguese) replaces any error with a value, which is useful for "not found", but also hides real errors (a broken reference, a wrong name). With XLOOKUP, prefer its own `[if_not_found]` argument. With VLOOKUP or INDEX/MATCH, handle only the expected case: `=IFERROR(VLOOKUP(...),"not found")` and check that the message appears only where it should. Avoid returning `0` as "not found": it is confused with a real value.
