---
title: Function names in Brazilian Portuguese and argument separators
source: Microsoft Support (Excel, pt-BR) and Google Docs Editors Help
source_url: https://support.microsoft.com/pt-br/office/fun%C3%A7%C3%B5es-do-excel-por-categoria-5f91f4e9-7b42-46d2-9bd1-63f26a86c0eb
source_date: 2026-10-02
tags: [excel, sheets, pt-br, funcoes, separador]
---

This file is specific to spreadsheets configured in Brazilian Portuguese (pt-BR). It does not apply to English-language spreadsheets, where the function names are the English ones used throughout the rest of this knowledge base and the arguments are separated by commas. For other languages, this knowledge base has no translated names: write the formula in English and tell the user to type `=` and the first letters, so the suggestion list shows the name their program accepts.

## Golden rule: language and separator decide

In Excel and Google Sheets configured in Brazilian Portuguese, function names appear translated and arguments are separated by semicolons (the comma is the decimal separator). Write `=SOMASES(C:C;A:A;"Pago")`, not `=SUMIFS(C:C,A:A,"Pago")`. An English formula pasted into a Portuguese spreadsheet gives a name error (`#NOME?`), and the reverse is also true.

If the user did not say the language, assume English function names with commas (or Brazilian Portuguese with semicolons if the user is writing in Portuguese), say that you assumed it and offer the other version.

## Portuguese names of the most used functions

Checked against the Portuguese-language support pages for Excel (and, where indicated, for Sheets):

| English | Brazilian Portuguese |
|---|---|
| VLOOKUP, XLOOKUP | PROCV, PROCX |
| INDEX, MATCH | ÍNDICE, CORRESP |
| SUMIFS, COUNTIFS, SUMIF, COUNTIF | SOMASES, CONT.SES, SOMASE, CONT.SE |
| IFERROR, IFS | SEERRO, SES |
| TRIM, TEXT, VALUE | ARRUMAR, TEXTO, VALOR |
| DATEVALUE | DATA.VALOR (Excel and Sheets) |
| LEN, MID | NÚM.CARACT, EXT.TEXTO |
| ISTEXT, ISNUMBER | ÉTEXTO, ÉNÚM |
| SUBSTITUTE, CHAR | SUBSTITUIR, CARACT |
| TEXTJOIN | UNIRTEXTO |
| FILTER, UNIQUE, SORT | FILTRO, ÚNICO, CLASSIFICAR |
| TEXTSPLIT, TEXTBEFORE | DIVIDIRTEXTO, TEXTOANTES |
| INDIRECT | INDIRETO |

The XLOOKUP argument for the value not found, for example, appears in the official Portuguese syntax: `PROCX(valor_procurado; matriz_procurada; matriz_retorno; [se_não_encontrada]; [modo_correspondência]; [modo_pesquisa])`.

## Array and decimal separators

In Brazilian Portuguese, an array constant separates columns with a backslash and rows with a semicolon. The example from Microsoft's support: `={1\2\3\4;5\6\7\8;9\10\11\12}` (three rows, four columns). In English it would be `{1,2,3,4;5,6,7,8;9,10,11,12}`.

In Excel, the list separator comes from the Windows regional settings, so a Portuguese installation may use a comma if the system is configured that way. If the user's formula uses a different separator than expected, ask for a formula they already have in the spreadsheet and copy its pattern.

## Google Sheets

Sheets stores the language and the region in File > Settings (General tab). The region defines the separator: where the decimal is a comma (as in Brazil), the argument separator is the semicolon; where the decimal is a point, it is the comma. The names of the classic functions match those of Excel in Portuguese (for example, DATA.VALOR). Sheets' own functions, such as QUERY, ARRAYFORMULA and FILTER, appear with the English name in the Portuguese-language help center.

When in doubt about the accepted name, tell the user to type `=` and the first letters: the suggestion list shows the right name for the spreadsheet's language.
