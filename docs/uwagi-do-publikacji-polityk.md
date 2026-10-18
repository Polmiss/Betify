# Uwagi do publikacji polityk Betify

Stan analizy: 17 października 2026 r. Dokument roboczy dla właściciela projektu — nie jest treścią polityki dla odwiedzających.

Przygotowano dwa dokumenty na podstawie kodu w gałęzi `codex/complete-five-missing-games`: politykę prywatności oraz politykę cookies i pamięci lokalnej. Nie wprowadzono zmian w działaniu aplikacji, nie opublikowano dokumentów w witrynie i nie dodano banera zgód.

## Zakres wersji bez danych administratora

Zgodnie z prośbą właściciela usunięto pola na tożsamość, adres i e-mail administratora oraz pozostałe pola do uzupełnienia. Nie zastąpiono ich wymyślonymi danymi ani informacjami z historii commitów. Usunięto także fragmenty zakładające istnienie podanego kanału korespondencji.

Taka wersja opisuje techniczne działanie aplikacji, lecz nie stanowi pełnej informacji z art. 13 RODO: pomija tożsamość i kontakt do administratora. Ograniczenie zaznaczono w dokumentach. Sam brak kont graczy nie usuwa obowiązków dotyczących przetwarzania danych technicznych.

Opis GitHub Pages wynika z konfiguracji repozytorium i nie potwierdza faktycznej konfiguracji docelowej domeny. Nie dopisano niezweryfikowanego dostawcy poczty, własnych logów ani zasad ich przechowywania.

## Dwie kwestie wymagające rozstrzygnięcia

**Trwały zapis.** `src/player-session.js` odczytuje `localStorage` przy uruchomieniu, a `src/store.js` zapisuje saldo i ulubione pod jednym kluczem. Nie ma wyboru zgody ani trybu „bez zapamiętywania”. Część dotycząca zachowywania preferencji między wizytami nie powinna być automatycznie uznawana za konieczną do gry. Dla funkcji nieobjętych wyjątkiem z art. 399 ust. 3 PKE potrzebny jest uprzedni wybór. Możliwy kierunek to gra w pamięci karty domyślnie i dobrowolne włączenie trwałego zapisu z możliwością późniejszego wyłączenia. Sama polityka nie wdraża takiego rozwiązania.

**Zewnętrzne czcionki.** `src/style.css` pobiera DM Sans i Manrope z Google Fonts. Trzeba ustalić podstawę tego przetwarzania i ewentualną potrzebę uprzedniego wyboru albo hostować pliki czcionek lokalnie z zachowaniem ich licencji. Dokument nie przedstawia samej estetyki strony jako automatycznie wystarczającego uzasadnienia transferu danych. Po zmianie sposobu dostarczania czcionek trzeba poprawić oba teksty.

## Przed udostępnieniem tekstów odwiedzającym

Sprawdź rzeczywistą domenę w nowym profilu przeglądarki: cookies odpowiedzi serwera, pamięć lokalną i połączenia z innymi domenami. Zweryfikuj role dostawców, retencję i transfery poza EOG. Dokumentów bez danych administratora nie należy przedstawiać jako pełnej realizacji obowiązku informacyjnego. Ich publikacja nie zastąpi rozwiązania kwestii zgód. Teksty muszą odpowiadać wdrożeniu, a nie planowanym funkcjom.

## Źródła

- [UODO — prawa i obowiązek informacyjny](https://uodo.gov.pl/pl/493/2254).
- [RODO — oficjalny tekst](https://eur-lex.europa.eu/legal-content/PL/TXT/PDF/?uri=CELEX%3A32016R0679), w szczególności art. 6, 12–22 i rozdział V.
- [Prawo komunikacji elektronicznej — art. 399–400](https://eli.gov.pl/api/acts/DU/2024/1221/text.html).
- [GitHub Pages — dane odwiedzających](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection).
- [Polityka prywatności GitHub — retencja i transfery](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
- [Polityka prywatności Google](https://policies.google.com/privacy?hl=pl).

Nie przypisano niepotwierdzonych terminów usuwania logów GitHub ani Google. Teksty są propozycją dopasowaną do obecnego kodu, a nie potwierdzeniem pełnej zgodności prawnej wdrożenia.
