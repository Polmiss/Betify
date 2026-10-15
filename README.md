# Betify

Demonstracyjna symulacja kasyna z wirtualnym saldem. Bez wpłat, wypłat i prawdziwych pieniędzy. Lobby zawiera już grywalnego blackjacka przeciwko krupierowi.

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
- Katalog ośmiu planowanych gier, wyszukiwarka, kategorie, sortowanie i losowanie gry.
- Ulubione oraz saldo 10 000 żetonów zapisane w `localStorage`.
- Darmowe uzupełnianie i reset salda, z obsługą niedostępnego zapisu w przeglądarce.
- Opisy i skrócone zasady gier, dostępne także przez `#game/blackjack` itp.
- Blackjack: dobieranie, pasowanie, podwojenie, historia pięciu rund i wspólny portfel lobby.
- Animowane rozdawanie kart z talii, obrót zakrytej karty krupiera i jego tura krok po kroku. Ruchy są blokowane podczas animacji; ustawienie systemowe ograniczenia ruchu wyłącza efekty i opóźnienia.
- Klawiaturowa nawigacja, natywne okna dialogowe i ograniczone animacje dla `prefers-reduced-motion`.

Blackjack jest oznaczony jako **Zagraj teraz**, a pozostałe gry jako **Wkrótce**. Nie ma płatności, kont użytkowników ani backendu. Saldo jest lokalne i może być edytowane przez użytkownika — to celowe dla demonstracyjnego projektu. Czcionki pobierane są z Google Fonts; przy braku dostępu używany jest font systemowy. Grafiki są lokalne.

## Blackjack

Kliknij Blackjack w lobby lub otwórz `#game/blackjack`. Wybierz parzystą stawkę od 10 do 5 000 żetonów. As ma wartość 1 lub 11, figury 10. Blackjack na dwóch kartach daje zysk 3:2, zwykła wygrana 1:1, remis zwraca stawkę. Parzyste stawki pozwalają wypłacać 3:2 w całkowitych żetonach.

Gra korzysta z sześciu talii tasowanych przez Web Crypto (ponowne tasowanie przed rundą, gdy zostaje mniej niż 60 kart). Krupier stoi na każdym 17, również miękkim. Można podwoić pierwsze dwie karty przy wystarczającym saldzie: dodatkowa stawka, dokładnie jedna karta i automatyczny pas. Bez podziału par, ubezpieczenia i poddania.

Zamknięcie okna gry, Escape albo przejście do innej sekcji automatycznie pasuje i rozlicza otwartą rundę. Odświeżenie lub zamknięcie całej strony podczas rundy powoduje utratę postawionych żetonów; aktywne rozdanie nie jest zapisywane. Historia rund dotyczy aktualnego otwarcia stołu. Saldo jest zapisywane po każdej operacji. Darmowe uzupełnienie znajduje się w portfelu lobby.

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
3. W funkcji `openGame` w `src/main.js` podłącz moduł i ustaw `status: 'playable'` w katalogu. Blackjack jest gotowym przykładem; pozostałe gry otwierają opis. Zwrócona funkcja sprzątająca powinna rozliczyć aktywną rundę i odpiąć zdarzenia.
4. Korzystaj z API `player.debit(amount)`, `player.credit(amount)` i `player.subscribe(listener)`; kwoty są całkowitymi żetonami. Obie operacje zwracają `false` przy niedopuszczalnej kwocie.
5. Utrzymaj linki przez hash. Dzięki temu bezpośrednie wejście i odświeżenie działają na hostingu statycznym bez reguł serwera.

## GitHub Pages

Projekt używa Vite i względnych ścieżek zasobów (`base: './'`), więc obsługuje podkatalog `/Betify/`. Konfigurację przygotowano według [dokumentacji wdrożenia Vite](https://vite.dev/guide/static-deploy.html#github-pages).

Po zapisaniu kodu na GitHubie:

1. W repozytorium **Settings → Pages → Build and deployment → Source** wybierz **GitHub Actions**.
2. W **Actions → Deploy to GitHub Pages → Run workflow** uruchom ręczne wdrożenie gałęzi `main`.
3. Adres wdrożenia pojawi się w wyniku workflow i w sekcji Pages. Dla obecnego repozytorium oczekiwany adres to `https://polmiss.github.io/Betify/`.

Workflow `ci.yml` sprawdza testy i build przy pushu/PR. `deploy.yml` publikuje po pushu na `main` i pozwala również uruchomić wdrożenie ręcznie.
