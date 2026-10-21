# Betify

Demonstracyjna symulacja kasyna z wirtualnym saldem. Bez wpłat, wypłat i prawdziwych pieniędzy. Dostępne są wszystkie gry katalogu: Dice, High Low, Mines, Roulette, Blackjack, Trader, Goal i Plinko. Gry otwierają się w nowych kartach na pełnych stronach.

## Uruchomienie

Wymagany Node.js 22.12+ (rekomendowany Node.js 24).

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

## Co jest gotowe

- Responsywne lobby w języku polskim, z własnymi grafikami SVG.
- Katalog: Dice, High Low, Mines, Roulette, Blackjack, Trader, Goal oraz Plinko jako honorable mention; wyszukiwarka, kategorie, sortowanie i losowanie gry.
- Ulubione oraz saldo 10 000 żetonów zapisane w `localStorage`.
- Wyłącznie reset salda do 10 000 żetonów; brak przycisków dodawania żetonów. Obsługa niedostępnego zapisu w przeglądarce.
- Opisy i skrócone zasady gier, dostępne także przez `#game/blackjack` itp.
- Blackjack: dobieranie, pasowanie, podwojenie, historia pięciu rund i wspólny portfel lobby.
- Animowane rozdawanie kart z talii, obrót zakrytej karty krupiera i jego tura krok po kroku. Ruchy są blokowane podczas animacji; ustawienie systemowe ograniczenia ruchu wyłącza efekty i opóźnienia.
- Klawiaturowa nawigacja, natywne okna dialogowe i ograniczone animacje dla `prefers-reduced-motion`.

Wszystkie osiem gier jest oznaczonych jako **Zagraj teraz**. Nie ma płatności, kont użytkowników ani backendu. Saldo i ulubione są lokalne, synchronizowane między kartami i mogą być edytowane przez użytkownika. To celowe dla demonstracyjnego projektu. Czcionki pobierane są z Google Fonts; przy braku dostępu używany jest font systemowy. Grafiki są lokalne.

## RTP 99%

Wszystkie osiem gier ma docelowe teoretyczne RTP 99%. Jest to średni zwrot w długim okresie, a nie gwarancja wyniku konkretnej sesji ([definicja RTP: Gambling Commission](https://www.gamblingcommission.gov.uk/public-and-players/guide/return-to-player-how-much-gaming-machines-payout)). Wyniki nie zależą od dotychczasowych wygranych ani salda. Blackjack ma 99% przy optymalnych decyzjach i środkach na podwojenie; inne decyzje mogą obniżyć zwrot. Anulowane rundy bez ruchu są zwracane i wyłączone z RTP.

- **Dice:** mnożnik `0.99 / p` dla obu kierunków i każdego progu 2–98.
- **Trader:** niezależne kierunki po 50%, trafienie `1.98×`.
- **Mines:** `0.99 × C(25,k) / C(25-m,k)`; współczynnik stosowany raz, układ min stały.
- **High Low:** `0.99 / (p1 × … × pn)`; późniejsze trafienia i pominięcia nie pobierają kolejnej przewagi.
- **Goal:** `0.99 / 0.8^n`; wszystkie pięć miejsc ma tę samą szansę 80% na gola.
- **Roulette:** każda liczba ma szansę 1/37. Wypłaty łącznie ze stawką: liczba `36.63×`, tuzin/kolumna `3.0525×`, kolor/parzystość/zakres `2.035×`. Każdy zakład i każda ich mieszanka ma 99%.
- **Plinko:** dla każdej planszy liczymy wszystkie 32 768 równoprawdopodobnych startów: 16 384 ziarna i ich odbicia lustrzane. Dalej tor wyznaczają stała grawitacja i zderzenia. Dla każdego koloru mnożniki są normalizowane według pełnego rozkładu fizyki: `Σ p(pole) × mnożnik(pole) = 0.99`. To nie jest estymacja Monte Carlo ani założenie o rozkładzie dwumianowym. Etykiety SVG są skrócone; opis pola zawiera dokładniejszy mnożnik.
- **Blackjack:** niezależne losowanie ze zwracaniem, 52 równoprawdopodobne karty, S17, sprawdzenie blackjacka na starcie, podwojenie na dowolnych pierwszych dwóch kartach, bez split/insurance/surrender. Naturalny blackjack zwraca 2,5×, remis 1×. Dokładny mnożnik zwykłej wygranej jest wyliczony w `blackjack-math.js` tak, aby optymalna strategia dawała `E[wypłat] / E[wszystkich stawek z podwojeniami] = 0.99`. Panel podpowiada tę strategię, bez podglądania zakrytej karty.

Ułamkowe wypłaty są zaokrąglane losowo z zachowaniem wartości oczekiwanej. Przykład: 12,75 daje 13 z szansą 75% albo 12 z szansą 25%. Panel przed odbiorem pokazuje obie możliwe kwoty. Niezależny 32-bitowy rzut zaokrąglenia nie używa historii gracza; błąd dyskretyzacji jest mniejszy od 1/2^32 żetonu. Przy ponawianiu nie losujemy zaokrąglenia ponownie.

Limity nie obcinają przyjętych wygranych. W seriach automatycznie odbieramy bieżącą pełną wypłatę, zanim kolejny krok wymagałby obcięcia mnożnika lub kwoty. Stawkę odrzucamy przed pobraniem, jeśli brakuje miejsca na pełną możliwą wypłatę. Plinko rezerwuje tę przestrzeń dla wszystkich aktywnych kulek. Zmiany portfela w innej karcie mogą wymagać ponowienia pełnej wypłaty po zwolnieniu miejsca; nie redukujemy wtedy kwoty.

Kalibracja: `npm run calibrate:plinko` oraz `npm run calibrate:blackjack`. Pierwsza wylicza pełny histogram i zapisuje hash źródła fizyki. Druga rozwiązuje drzewo decyzji i mnożnik wypłaty blackjacka. `tests/rtp.test.js` sprawdza wszystkie zakłady, stawki minimalne i duże, wszystkie 49 152 symulacje fizyczne bez odbicia lustrzanego oraz ich rozkłady, dokładne RTP blackjacka i 300 000 rozdań prawdziwego silnika z optymalnymi podpowiedziami. Po zmianie fizyki trzeba przeliczyć kalibrację; test wykrywa jej rozjechanie.

## Dice, Trader, Goal i Plinko

Bezpośrednie adresy: `game.html#dice`, `#mines`, `#trader`, `#goal`, `#plinko`. Każda gra ma osobną planszę, historię ośmiu ostatnich rund, wybór stawki, zasady i obsługę ograniczonych animacji. Na małym ekranie obszar gry przewija się, aby wszystkie przyciski pozostały dostępne.

- **Dice:** próg 2–98 i zakład „Poniżej” lub „Od progu”. Losowanie jednej z 10 000 wartości od 0,00 do 99,99. Równość wygrywa tylko w drugim kierunku. Mnożnik to `0.99 / szansa`; przed rzutem widać szansę i potencjalną wypłatę.
- **Trader:** fikcyjny kurs i dwa niezależne kierunki o szansie 50%. Trafienie wypłaca `1.98×`; wielkość ruchu 1–5% nie wpływa na wypłatę. Wykres nie korzysta z rzeczywistych notowań i nie przewiduje kolejnych wyników.
- **Goal:** własny demonstracyjny wariant z pięcioma miejscami strzału. Bramkarz losuje jedno z nich z szansą 20%; zgodność oznacza obronę, a pozostałe miejsca gola. Po trafieniu można odebrać żetony lub strzelać dalej. Mnożnik po `n` golach to `0.99 / 0.8^n`. Obrona traci serię, a 10 goli kończy ją automatycznie.
- **Plinko:** trzy kolorowe przyciski zrzutu (niski, średni i wysoki poziom ryzyka), 8/12/16 rzędów oraz trzy widoczne tabele mnożników. Stały krok fizyki 240 Hz: grawitacja, okrągłe kołki, utrata energii, tarcie, obrót kulki, prowadnice i przegrody. Losowy jest tylko start; pole końcowe wynika z symulacji, bez kierowania do wybranego mnożnika. Tabele są wariantem demonstracyjnym Betify.

Stawki: 10–5 000 całkowitych żetonów. Wypłata zawiera stawkę i jest zaokrąglana losowo z zachowaniem średniej. Maksymalna wypłata: 1 000 000; maksymalny mnożnik serii: 1 000×. Obowiązuje też limit salda portfela. Dice i Trader rozliczają wynik przed animacją; Plinko rozlicza każdą kulkę po jej locie. Wyjście z aktywnego Mines/Goal automatycznie odbiera żetony po trafieniach albo zwraca stawkę przed pierwszym ruchem. Reset przerywa animację i ustawia dokładnie 10 000. Awaryjne zamknięcie przeglądarki może uniemożliwić rozliczenie serii. Nieudane uznanie portfela można ponowić bez ponownego pobierania stawki lub losowania wyniku.

Losowanie używa Web Crypto z odrzucaniem niepełnego przedziału modulo. Kod: `src/games/instant/{engine,instant}.js` i `instant.css`. Testy: `tests/instant.test.js`, w tym granice Dice, kombinatoryka Mines, wszystkie kombinacje strzału i obrony, pola Plinko, limity, ponawianie wypłaty i symulacja 500 mieszanych rund.

## Mines

Otwórz `game.html#mines`. Podstawowa mechanika odpowiada powszechnemu wariantowi opisanemu w [oficjalnych zasadach Stake Mines](https://stake.com/casino/games/mines): plansza 5×5, od 1 do 24 min, odbiór po bezpiecznym odkryciu i przegrana po trafieniu miny. To autorska implementacja Betify na wirtualne żetony.

- Układ min losowany jest jednokrotnie na początku rundy, przez częściowe tasowanie Fishera–Yatesa. Web Crypto z rejection sampling zapewnia losowanie pozycji bez obciążenia modulo i bez duplikatów. Pierwsze pole może być miną; układ nie jest zmieniany w reakcji na kliknięcia.
- Miny i stawka są blokowane podczas rundy. Każde pole może zostać odkryte tylko raz. Losowe pole jest losowane spośród wszystkich zakrytych pól i również może zawierać minę.
- Po `k` diamentach przy `m` minach mnożnik to `0.99 * C(25,k) / C(25-m,k)`. Wynika z odwrotności prawdopodobieństwa przetrwania `k` wyborów i jednorazowego współczynnika 0,99. Przed pierwszym odkryciem wyświetlane jest 1×, ale odbiór nie jest dostępny.
- Szansa następnego diamentu: `(25-m-k)/(25-k)`. Ekran pokazuje tę szansę i następny mnożnik przed wyborem.
- Stawki 10–5 000, wypłata zaokrąglana losowo do całych żetonów z zachowaniem średniej, maksymalna wypłata 1 000 000 oraz limit salda portfela. Automatyczny odbiór przed nieobsługiwanym krokiem oraz losowe zaokrąglenia zachowują teoretyczne 99%.
- Odkrycie wszystkich diamentów albo krok poprzedzający przekroczenie limitu automatycznie rozlicza pełną bieżącą wypłatę. Po jej zakończeniu widać cały układ, z wyróżnieniem wybranych pól i trafionej miny.
- Zwykłe wyjście odbiera bieżącą wygraną; przed pierwszym odkryciem zwraca stawkę. Reset kończy rundę i ustawia dokładnie 10 000. Awaryjne zamknięcie może uniemożliwić rozliczenie. Brak doładowań.

Kod: `src/games/mines/{engine,mines}.js` i `mines.css`. Testy: `tests/mines.test.js`, w tym matematyka dla każdej liczby min, ukrywanie i stałość układu, pierwsza mina, losowe pole, duplikaty kliknięć, wszystkie diamenty, limity oraz rozliczenie przy zamknięciu.

## High Low

Otwórz `game.html#high-low`. Wariant inspirowany [oficjalnymi zasadami Stake Hilo](https://stake.com/blog/how-to-play-hilo-on-stake) i [opisem wyborów przy A/K](https://stake.us/casino/games/hilo). To własna implementacja demonstracyjna, bez integracji z tymi serwisami.

- Kolejność rang: A = 1, 2–10, J = 11, Q = 12, K = 13. Kolory nie mają znaczenia.
- Losowanie ze zwracaniem przez Web Crypto z rejection sampling: każda z 52 kart ma jednakową szansę, każda ranga 1/13. Powtórzenia są możliwe.
- Dla rang 2–Q wybiera się „wyżej lub taka sama” / „niżej lub taka sama”. Przy A: wyżej (12/13) albo taka sama (1/13); przy K: taka sama (1/13) albo niżej (12/13).
- Po trafieniu można odebrać żetony albo kontynuować. Błąd traci całą stawkę i nieodebraną wygraną. Saldo pobierane jest raz na początku serii; kolejne typy nie pobierają dodatkowych stawek.
- Mnożnik Betify: `0.99 / (p1 * p2 * ... * pn)`. Współczynnik 0,99 stosowany jest raz, przy pierwszym trafieniu. Wyświetlane szanse i następny łączny mnożnik odpowiadają dokładnie temu obliczeniu. Wypłata zawiera stawkę i jest zaokrąglana losowo z zachowaniem średniej do całkowitych żetonów.
- Stawka 10–5 000, maksymalny mnożnik 1 000×, maksymalna wypłata 1 000 000 żetonów. Przed następnym typem, który wymagałby obcięcia któregokolwiek mnożnika, odbieramy pełną bieżącą wypłatę. Nie redukujemy przyjętej wypłaty do limitu portfela.
- Pominięcie zmienia kartę bez zmiany mnożnika i bez pobierania żetonów. Limit 52 pominięć w aktywnej rundzie; przed startem bez limitu.
- Przy zwykłym wyjściu z gry odbieramy żetony po trafieniach; przed pierwszym typem zwracamy stawkę. Awaryjne zamknięcie może uniemożliwić rozliczenie. Reset przerywa animacje, rozlicza serię i ustawia saldo dokładnie na 10 000.

Kod: `src/games/high-low/{engine,high-low}.js` oraz `high-low.css`. Testy: `tests/high-low.test.js` (wszystkie rangi i kierunki, mnożniki, pomijanie, wypłaty, limity i zamknięcie rundy).

## Blackjack

Kliknij Blackjack w lobby lub otwórz `#game/blackjack`. Wybierz parzystą stawkę od 10 do 5 000 żetonów. As ma wartość 1 lub 11, figury 10. Blackjack na dwóch kartach daje zysk 3:2, zwykła wygrana według skalibrowanego mnożnika z sekcji RTP, remis zwraca stawkę. Parzyste stawki pozwalają wypłacać 3:2 w całkowitych żetonach.

Gra losuje niezależne karty ze zwracaniem przez Web Crypto. Krupier stoi na każdym 17, również miękkim. Można podwoić pierwsze dwie karty przy wystarczającym saldzie: dodatkowa stawka, dokładnie jedna karta i automatyczny pas. Bez podziału par, ubezpieczenia i poddania.

Przejście do innej gry lub opuszczenie strony wywołuje sprzątanie i rozliczenie otwartej rundy. Aktywne rozdanie nie jest zapisywane, więc awaryjne zamknięcie przeglądarki może spowodować utratę stawki. Historia dotyczy aktualnego otwarcia stołu. Saldo jest zapisywane po każdej operacji. Reset salda do 10 000 jest dostępny także w nagłówku strony gry. Reset kończy aktywną rundę i otwiera świeży stół przed rozpoczęciem kolejnej gry.

## Ruletka i strony gier

`game.html#roulette` i `game.html#blackjack` otwierają gry bez okien modalnych. Karty w lobby używają zwykłych linków z `target="_blank"`. Starsze linki `#game/roulette` i `#game/blackjack` przekierowują do nowej strony.

Ruletka ma europejskie koło z jednym zerem, zakłady na liczby, kolory, parzystość, zakresy, tuziny i kolumny. Nominały: 10, 50, 100, 500, 1 000, 5 000 i 10 000. Lewy klik dodaje żeton, prawy zdejmuje ostatni żeton z danego pola. Na telefonie służy do tego minus w podsumowaniu. Powtarzanie zakładów odtwarza dokładne nominały i kolejność stosów. Podsumowanie pokazuje każdą stawkę osobno, jej skład oraz łączną kwotę pomocniczą.

Każdy obrót otrzymuje nowy plan ruchu: 10–14,5 sekundy, zmienny kierunek, liczbę obrotów, prędkość, punkt opadania i odbicia kulki. Kulka krąży niezależnie od koła, opada i zatrzymuje się w kieszeni zgodnej z wynikiem. `prefers-reduced-motion` skraca efekty. Losowanie wyniku pozostaje niezależne od animacji; saldo jest rozliczane przed jej startem.

Kod stron gier: `src/game-page.js`, układy: `src/game-page.css`, wspólna kolorystyka: `src/theme.css`. Ruletka: `src/games/roulette/{engine,betting,motion,roulette}.js` oraz `roulette.css`.

## Struktura i kolejne gry

```text
src/
  main.js       # interfejs lobby, zdarzenia i routing przez hash
  style.css     # motyw, układy responsywne i dostępność
  catalog.js    # dane gier oraz wyszukiwanie i filtrowanie
  store.js      # saldo, ulubione i zapis lokalny
  artwork.js    # autorskie grafiki wektorowe
  icons.js      # ikony interfejsu
  games/
    blackjack-engine.js # reguły, tasowanie i rozliczanie żetonów
    blackjack.js        # interfejs stołu i cykl montażu/sprzątania
    blackjack.css       # responsywny stół i karty
tests/
  store.test.js # reguły portfela, odporność zapisu i filtrowanie
  blackjack.test.js # scenariusze rozgrywki i symulacja 500 rund
```

Aby dodać grę:

1. Dodaj jej metadane do `src/catalog.js` i ilustrację do `src/artwork.js`.
2. Utwórz osobny moduł, np. `src/games/blackjack.js`, z funkcją montującą rozgrywkę i sprzątającą po wyjściu.
3. W funkcji `render` w `src/game-page.js` podłącz moduł i ustaw `status: 'playable'` w katalogu. Pozostałe gry otwierają pełnostronicowy opis. Zwrócona funkcja sprzątająca powinna rozliczyć aktywną rundę i odpiąć zdarzenia.
4. Korzystaj z API `player.debit(amount)`, `player.credit(amount)` i `player.subscribe(listener)`; kwoty są całkowitymi żetonami. Obie operacje zwracają `false` przy niedopuszczalnej kwocie.
5. Utrzymaj linki przez hash. Dzięki temu bezpośrednie wejście i odświeżenie działają na hostingu statycznym bez reguł serwera.

## GitHub Pages

Projekt używa Vite i względnych ścieżek zasobów (`base: './'`), więc obsługuje podkatalog `/Betify/`. Konfigurację przygotowano według [dokumentacji wdrożenia Vite](https://vite.dev/guide/static-deploy.html#github-pages).

Po zapisaniu kodu na GitHubie:

1. W repozytorium **Settings → Pages → Build and deployment → Source** wybierz **GitHub Actions**.
2. W **Actions → Deploy to GitHub Pages → Run workflow** uruchom ręczne wdrożenie gałęzi `main`.
3. Adres wdrożenia pojawi się w wyniku workflow i w sekcji Pages. Dla obecnego repozytorium oczekiwany adres to `https://polmiss.github.io/Betify/`.

Workflow `ci.yml` sprawdza testy i build przy pushu/PR. `deploy.yml` publikuje po pushu na `main` i pozwala również uruchomić wdrożenie ręcznie.


Saldo na ekranie jest aktualizowane po odsłonięciu wyniku; Plinko publikuje każdą kulkę osobno po jej locie. Księgowanie i walidacja korzystają z rzeczywistego portfela; zamknięcie karty nie anuluje rozliczonej wypłaty.

Plinko obsługuje dowolną liczbę równoczesnych kulek bez sztucznego limitu. Każda kulka rezerwuje własną stawkę, ma osobny tor fizyczny i rozlicza wypłatę oraz wynik po swojej animacji. Nierozliczonych wypłat nie można obstawiać; panel pokazuje dostępne żetony i sumę zarezerwowanych stawek. Stawka i kolor mogą się zmieniać między zrzutami, a rzędy dopiero po opróżnieniu planszy. Jedna pętla animacji obsługuje wszystkie kulki; reset i wyjście rozliczają pozostałe loty dokładnie raz.
