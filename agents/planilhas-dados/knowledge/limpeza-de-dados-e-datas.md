---
title: Data cleaning: spaces, text that is a number, dates as text and leading zeros
source: Microsoft Support (TRIM, DATEVALUE, NUMBERVALUE, converting dates stored as text; pt-BR pages)
source_url: https://support.microsoft.com/pt-br/office/fun%C3%A7%C3%A3o-arrumar-410388fa-c5df-49c6-b16c-9e5630b479f9
source_date: 2026-10-02
tags: [limpeza, arrumar, datas, texto, csv]
---

## Spaces and invisible characters

`TRIM(text)` (`ARRUMAR` in Brazilian Portuguese) removes all spaces from the text except single spaces between words. Careful: according to Microsoft, it only removes the ordinary ASCII space (code 32). The non-breaking space (code 160), common in data copied from web pages and systems, is not removed. For those cases: `=TRIM(SUBSTITUTE(A2,CHAR(160)," "))` (`=ARRUMAR(SUBSTITUIR(A2;CARACT(160);" "))`). The `CLEAN` function (`LIMPAR`) removes non-printable characters.

Diagnostic test: `=LEN(A2)` (`=NÚM.CARACT(A2)`) greater than the number of visible characters indicates a space or a hidden character.

## Text that looks like a number

Symptoms: a number aligned to the left, a sum that skips cells, #N/A in a lookup, a green triangle in the corner of the cell. Fixes: `=VALUE(TRIM(A2))` (`=VALOR(ARRUMAR(A2))`); for text with a decimal separator different from the system's, `NUMBERVALUE` (`VALOR.NÚMERO`), which converts text to a number independently of the locale (give the source decimal and thousands separators); or multiply by 1 (`=A2*1`) when the text is a plain number. After converting with a formula, copy and paste as values and delete the original column only once you have checked.

CSV import: if accented characters show up broken (for example "Ã£"), the file was opened with the wrong encoding; import through the text or CSV wizard choosing UTF-8. In Brazil, and in other locales that use a decimal comma, a CSV usually comes with a semicolon as the separator and a comma as the decimal.

## Dates stored as text

Symptoms: a date aligned to the left, a filter that does not group by month, `=ISNUMBER(A2)` (`=ÉNÚM(A2)`) returning `FALSE`. `=DATEVALUE(A2)` (`=DATA.VALOR(A2)`) converts text to a serial number, but it follows the regional setting: with a US source (month/day), `03/04/2026` becomes March 4. Always validate the conversion on an example with a day greater than 12 (for example, `25/03/2026`). When the format is fixed, build the date with `DATE(year, month, day)` (`DATA(ano; mês; dia)`), extracting the parts with `MID`, `LEFT` and `RIGHT` (`EXT.TEXTO`, `ESQUERDA` and `DIREITA`).

Two-digit years: through the cell's error indicator, Excel offers to convert "XX" into 19XX or 20XX. After converting, apply the date format to the column.

## Splitting and joining text

Text to Columns (the wizard under Data) splits by separator without a formula and works in any version. In a formula: `TEXTSPLIT` and `TEXTBEFORE` (`DIVIDIRTEXTO` and `TEXTOANTES`) exist only in Excel 365 and 2024 (according to Microsoft); in earlier versions, use `MID` with `FIND` (`EXT.TEXTO` with `LOCALIZAR`) or the wizard. To join: `TEXTJOIN(";",TRUE,A2:A10)` (`UNIRTEXTO`) skips blanks, or the `&` operator.

## Leading zeros and codes

Postal codes (such as the Brazilian CEP), product codes and phone numbers are text, not numbers: format the column as text before pasting the data, or restore them with `=TEXT(A2,"00000000")` (`=TEXTO(A2;"00000000")`). Converting to a number erases the zeros and takes the value out of text lookups. If the code arrived as a number and has to match another text, convert both sides to the same type before the lookup.
