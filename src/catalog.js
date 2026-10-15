export const categories = [
  {
    "id": "all",
    "name": "Wszystkie gry",
    "icon": "grid"
  },
  {
    "id": "cards",
    "name": "Gry karciane",
    "icon": "cards"
  },
  {
    "id": "table",
    "name": "Gry stołowe",
    "icon": "roulette"
  },
  {
    "id": "instant",
    "name": "Gry instant",
    "icon": "bolt"
  }
];

// Lobby order: seven featured games followed by the honorable mention.
export const games = [
  {
    "id": "dice",
    "name": "Dice",
    "category": "instant",
    "label": "Prosta gra, Twój wybór",
    "tagline": "Wybierz próg. Rzuć wyzwanie.",
    "color": "orange",
    "tag": null,
    "players": "1 gracz",
    "description": "Wybierz próg i sprawdź, czy wylosowany wynik znajdzie się powyżej lub poniżej niego. Szansa i mnożnik będą widoczne przed rundą.",
    "rules": [
      "Ustaw próg oraz kierunek zakładu.",
      "Sprawdź szansę i potencjalny mnożnik.",
      "Wylosuj wynik i porównaj go ze swoim wyborem."
    ],
    "status": "planned"
  },
  {
    "id": "high-low",
    "name": "High Low",
    "category": "cards",
    "label": "Wyżej czy niżej?",
    "tagline": "Jedna karta. Dwa kierunki.",
    "color": "blue",
    "tag": null,
    "players": "1 gracz",
    "description": "Przewiduj, czy kolejna karta będzie wyższa czy niższa od obecnej. Każdy trafny wybór przedłuża Twoją serię.",
    "rules": [
      "Sprawdź wartość odkrytej karty.",
      "Wybierz, czy następna karta będzie wyższa czy niższa.",
      "Odkrywaj kolejne karty i zakończ serię w wybranym momencie."
    ],
    "status": "planned"
  },
  {
    "id": "mines",
    "name": "Mines",
    "category": "instant",
    "label": "Odkrywaj krok po kroku",
    "tagline": "Jeszcze jedno bezpieczne pole?",
    "color": "teal",
    "tag": "Instant",
    "players": "1 gracz",
    "description": "Odkrywaj diamenty na planszy, unikając ukrytych min. Każde bezpieczne pole zwiększa wirtualną wygraną.",
    "rules": [
      "Wybierz stawkę oraz liczbę min.",
      "Odkrywaj kolejne pola z diamentami.",
      "Zakończ rundę przed trafieniem na minę, aby zachować wygraną."
    ],
    "status": "planned"
  },
  {
    "id": "roulette",
    "name": "Roulette",
    "category": "table",
    "label": "Zakręć klasyką",
    "tagline": "Jeden obrót. Wiele możliwości.",
    "color": "rose",
    "tag": "Klasyk",
    "players": "1 gracz",
    "description": "Europejska ruletka z jednym zerem. Wybierz liczbę, kolor albo grupę pól i obserwuj, gdzie zatrzyma się kulka.",
    "rules": [
      "Wybierz pola na planszy i stawkę w żetonach.",
      "Koło wylosuje jedną z liczb od 0 do 36.",
      "Wynik i wypłata zależą od rodzaju wybranego zakładu."
    ],
    "status": "playable"
  },
  {
    "id": "blackjack",
    "name": "Blackjack",
    "category": "cards",
    "label": "Klasyka przy stole",
    "tagline": "Dwadzieścia jeden. Tyle wystarczy.",
    "color": "green",
    "tag": "Klasyk",
    "players": "1 gracz",
    "description": "Dobieraj karty i spróbuj zbliżyć się do 21 punktów bardziej niż krupier, nie przekraczając tej liczby.",
    "rules": [
      "Ty i krupier otrzymujecie karty.",
      "Dobierz kolejną kartę lub pozostań przy swoim wyniku.",
      "Przekroczenie 21 punktów oznacza przegraną."
    ],
    "status": "playable"
  },
  {
    "id": "trader",
    "name": "Trader",
    "category": "instant",
    "label": "Wybierz kierunek wykresu",
    "tagline": "W górę czy w dół?",
    "color": "purple",
    "tag": null,
    "players": "1 gracz",
    "description": "Obserwuj fikcyjny wykres i przewiduj kierunek kolejnego ruchu. Rozgrywka wykorzystuje wyłącznie wirtualne żetony.",
    "rules": [
      "Wybierz wirtualną stawkę.",
      "Przewiduj wzrost albo spadek fikcyjnego kursu.",
      "Sprawdź kierunek następnego ruchu wykresu."
    ],
    "status": "planned"
  },
  {
    "id": "goal",
    "name": "Goal",
    "category": "instant",
    "label": "Twój strzał. Twój moment.",
    "tagline": "Pokonaj bramkarza.",
    "color": "green",
    "tag": null,
    "players": "1 gracz",
    "description": "Wybierz miejsce strzału i spróbuj pokonać bramkarza w serii wirtualnych rzutów karnych.",
    "rules": [
      "Wybierz stawkę i kierunek strzału.",
      "Oddaj strzał i sprawdź reakcję bramkarza.",
      "Zdobywaj gole i zdecyduj, kiedy zakończyć serię."
    ],
    "status": "planned"
  },
  {
    "id": "plinko",
    "name": "Plinko",
    "category": "instant",
    "label": "Mała kulka, wiele dróg",
    "tagline": "Wyróżnienie poza główną siódemką.",
    "color": "pink",
    "tag": "Honorable mention",
    "players": "1 gracz",
    "description": "Puść kulkę na planszę pełną kołków i obserwuj jej drogę do jednego z pól na dole.",
    "rules": [
      "Wybierz wirtualną stawkę.",
      "Puść kulkę z góry planszy.",
      "Pole, na którym zatrzyma się kulka, określa wynik rundy."
    ],
    "status": "planned"
  }
];

const normalize = (text) => text.toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');

export function filterGames({ category = 'all', query = '', favorites = [], sort = 'recommended' } = {}) {
  const search = normalize(query.trim());
  const filtered = games.filter((game) =>
    (category === 'all' || (category === 'favorites' ? favorites.includes(game.id) : category === game.category)) &&
    normalize(`${game.name} ${game.label} ${categories.find((item) => item.id === game.category)?.name}`).includes(search),
  );
  return sort === 'name' ? filtered.sort((a, b) => a.name.localeCompare(b.name, 'pl')) : filtered;
}
