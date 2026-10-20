# Polityka cookies i pamięci lokalnej Betify

Wersja bez danych administratora z 20 października 2026 r.

> Dokument opisuje obecny kod Betify. Nie zawiera danych administratora ani nie potwierdza wdrożenia mechanizmu zgód. Ograniczenia tej wersji opisano w Polityce prywatności i uwagach do publikacji.

## 1. Kogo dotyczy ten dokument

Polityka dotyczy korzystania z cookies i pamięci przeglądarki w serwisie Betify.

Informacje o przetwarzaniu danych i zakresie tego dokumentu znajdziesz w [Polityce prywatności](polityka-prywatnosci.md).

## 2. Cookies a pamięć lokalna

Cookies to niewielkie informacje zapisywane przez przeglądarkę dla danej witryny. W zależności od ustawień mogą być przesyłane do serwera wraz z żądaniami.

`localStorage` to odrębna pamięć przeglądarki. Nie jest automatycznie dołączana do żądań HTTP. Kod strony może ją odczytywać i zmieniać. Przepisy dotyczące dostępu do urządzenia obejmują również technologie inne niż cookies.

## 3. Co wykorzystuje Betify

Kod Betify nie ustawia własnych plików cookies i nie zawiera narzędzi reklamy ani analityki. Korzysta natomiast z poniższego trwałego zapisu:

| Właściwość | Opis |
| --- | --- |
| Technologia | `localStorage` — lokalna pamięć przeglądarki. |
| Nazwa wpisu | `betify:player:v1`. |
| Zawartość | `balance`: saldo wirtualnych żetonów; `favorites`: identyfikatory gier dodanych do ulubionych. |
| Cel | Zachowanie salda i ulubionych po ponownym otwarciu strony oraz synchronizacja tych wartości między kartami tego samego pochodzenia w tej samej przeglądarce. |
| Moment odczytu | Uruchomienie aplikacji oraz odświeżenie stanu, w tym przed zapisaniem zmian i po zmianie danych w innej karcie. |
| Moment zapisu | Zmiana salda, jego reset albo zmiana listy ulubionych. Samo pierwsze wyświetlenie pustego lobby nie tworzy wpisu. |
| Czas przechowywania | Bez terminu wygaśnięcia ustawionego przez aplikację; do usunięcia danych lub ich wyczyszczenia przez przeglądarkę. |
| Przesyłanie przez aplikację | Kod Betify nie wysyła zawartości tego wpisu do administratora ani do zewnętrznej bazy graczy. |

Osobny wpis `betify:cookie-notice:v1` przechowuje wartość `1` po kliknięciu „Rozumiem” w powiadomieniu o cookies i pamięci lokalnej. Zapobiega ponownemu wyświetlaniu komunikatu, również na stronach gier i w innych kartach. Pozostaje do usunięcia danych witryny; aplikacja nie wysyła go na serwer. Jeśli zapis jest niedostępny, komunikat można zamknąć tylko w bieżącej karcie. Szczegóły można ponownie otworzyć przez „Cookies i prywatność” w stopce lobby lub „Cookies” na górnym pasku gry.

Pamięć ta jest przypisana do pochodzenia strony, czyli kombinacji protokołu, hosta i portu, a nie wyłącznie do ścieżki `/Betify/`. Inne aplikacje uruchomione z tego samego pochodzenia mogą technicznie mieć dostęp do tej przestrzeni. Nie należy zapisywać w niej danych poufnych.

Bieżąca rozgrywka i historia ostatnich wyników są utrzymywane osobno w pamięci danej gry; nie są zawartością tego trwałego wpisu. Pamięć podręczna przeglądarki może również zachowywać pliki strony i czcionki zgodnie z ustawieniami przeglądarki oraz nagłówkami serwera.

## 4. Zgoda i funkcje opcjonalne

Art. 399 Prawa komunikacji elektronicznej przewiduje uprzednią informację i zgodę na zapis lub odczyt informacji w urządzeniu oraz wyjątek dla działań koniecznych do transmisji albo dostarczenia usługi żądanej przez użytkownika. Samo użycie nazwy „funkcjonalne” nie przesądza o takim wyjątku. [Treść art. 399](https://eli.gov.pl/api/acts/DU/2024/1221/text.html).

Trwałe zapamiętywanie ulubionych i zachowywanie salda między wizytami trzeba ocenić osobno od obsługi bieżącej rozgrywki. Jeżeli zapis nie jest objęty wyjątkiem, wymaga uprzedniej zgody; samo czytanie polityki lub dalsze przeglądanie strony nie jest opisywanym tutaj mechanizmem jej udzielenia.

W obecnej wersji Betify nie ma panelu zgód ani przełącznika trwałego zapisu. Odczyt i zapis odbywają się w sposób opisany w punkcie 3. Możesz zarządzać danymi przez ustawienia przeglądarki opisane w punkcie 6; nie oznacza to jednak, że wdrożono uprzedni wybór dla funkcji wymagających zgody.

Powiadomienie „Cookies i pamięć lokalna” ma charakter informacyjny. Przycisk „Rozumiem” zamyka komunikat i zapamiętuje jego zamknięcie; nie zmienia działania zapisu salda ani ulubionych i nie jest panelem zgód.

## 5. Usługi zewnętrzne

Konfiguracja projektu przewiduje GitHub Pages jako hosting. GitHub opisuje rejestrowanie adresów IP odwiedzających w celach bezpieczeństwa. [Informacja GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection).

Arkusz stylów Betify pobiera czcionki z Google Fonts. Powoduje to połączenie przeglądarki z serwerami Google, chyba że zasób jest już dostępny w pamięci podręcznej lub żądanie zostanie zablokowane. Brak własnych cookies aplikacji nie oznacza braku przekazywania danych technicznych dostawcom. [Polityka prywatności Google](https://policies.google.com/privacy?hl=pl).

Betify nie wdraża cookies reklamowych ani analitycznych w kodzie aplikacji. Cookies mogą być również ustawiane przez odpowiedzi serwera, poza kodem JavaScript. Ten dokument nie przypisuje dostawcom niezweryfikowanej listy cookies ani terminów ich ważności.

## 6. Jak usunąć dane i ograniczyć zapis

1. Zakończ rozgrywkę i zamknij wszystkie karty Betify, aby działająca gra nie zapisała stanu ponownie.
2. W ustawieniach przeglądarki znajdź dane witryn dla domeny, pod którą działa Betify.
3. Usuń **dane witryny / pamięć lokalną**, a nie tylko historię przeglądania lub same cookies. Nazwy opcji zależą od przeglądarki.
4. Przy kolejnym uruchomieniu bez zapisanego stanu aplikacja pokaże początkowe 10 000 żetonów i pustą listę ulubionych.

Usunięcie danych całego pochodzenia może objąć także inne aplikacje pod tą samą domeną. Jeśli przeglądarka pozwala usuwać pojedyncze wpisy, dla Betify chodzi o `betify:player:v1` i `betify:cookie-notice:v1`.

**Przycisk „Resetuj saldo” nie usuwa danych witryny.** Ustawia saldo na 10 000, zachowuje ulubione i zapisuje te wartości ponownie.

Zablokowanie pamięci witryny w ustawieniach przeglądarki może uniemożliwić zachowywanie salda i ulubionych między wizytami. Przy niedostępnym zapisie aplikacja korzysta z pamięci bieżącej karty i wyświetla informację o ograniczeniu zapisu. Tryb prywatny może przechowywać dane tylko przez czas sesji; zależy to od przeglądarki.

Usunięcie danych lokalnych nie usuwa automatycznie logów dostawców infrastruktury. Informacje o prawach dotyczących danych osobowych i ograniczeniach tej wersji dokumentu znajdziesz w Polityce prywatności.

## 7. Zmiany

Po dodaniu analityki, reklam, logowania lub kolejnych zewnętrznych usług trzeba ponownie sprawdzić faktyczne mechanizmy zapisu i zaktualizować dokument. Funkcji wymagających zgody nie należy uruchamiać przed jej uzyskaniem.
