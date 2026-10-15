export const categories = [
  { id: 'all', name: 'Wszystkie gry', icon: 'grid' },
  { id: 'cards', name: 'Gry karciane', icon: 'cards' },
  { id: 'table', name: 'Gry stołowe', icon: 'roulette' },
  { id: 'slots', name: 'Automaty', icon: 'slots' },
  { id: 'instant', name: 'Gry instant', icon: 'bolt' },
];

// Add a game here, then connect its module in main.js when it is playable.
export const games = [
  { id: 'blackjack', name: 'Blackjack', category: 'cards', label: 'Klasyka przy stole', tagline: 'Dwadzieścia jeden. Tyle wystarczy.', color: 'green', tag: 'Klasyk', players: '1 gracz', description: 'Dobieraj karty i spróbuj zbliżyć się do 21 punktów bardziej niż krupier, nie przekraczając tej liczby.', rules: ['Ty i krupier otrzymujecie karty.', 'Dobierz kolejną kartę lub pozostań przy swoim wyniku.', 'Przekroczenie 21 punktów oznacza przegraną.'], status: 'playable' },
  { id: 'roulette', name: 'Ruletka', category: 'table', label: 'Zakręć klasyką', tagline: 'Jeden obrót. Wiele możliwości.', color: 'rose', tag: 'Klasyk', players: '1 gracz', description: 'Europejska ruletka z jednym zerem. Wybierz liczbę, kolor albo grupę pól i obserwuj, gdzie zatrzyma się kulka.', rules: ['Wybierz pola na planszy i stawkę w żetonach.', 'Koło wylosuje jedną z liczb od 0 do 36.', 'Wynik i wypłata zależą od rodzaju wybranego zakładu.'], status: 'playable' },
  { id: 'slots', name: 'Lucky Slots', category: 'slots', label: 'Mały obrót, wielkie emocje', tagline: 'Trzy bębny. Twój szczęśliwy układ.', color: 'purple', tag: null, players: '1 gracz', description: 'Autorski automat z trzema bębnami i klasycznymi symbolami. Dopasuj symbole na linii, aby zdobyć wirtualne żetony.', rules: ['Ustal stawkę w wirtualnych żetonach.', 'Zakręć trzema bębnami.', 'Pasujące symbole na linii przyniosą wygraną według tabeli gry.'], status: 'planned' },
  { id: 'poker', name: 'Video Poker', category: 'cards', label: 'Rozegraj to po swojemu', tagline: 'Dobra ręka to dopiero początek.', color: 'blue', tag: null, players: '1 gracz', description: 'Pięciokartowy Video Poker w wariancie Jacks or Better. Zatrzymuj wybrane karty i wymieniaj pozostałe, aby ułożyć mocniejszy układ.', rules: ['Otrzymujesz pięć kart.', 'Zaznacz karty, które chcesz zatrzymać, i wymień resztę.', 'Para waletów lub silniejszy układ daje wygraną według tabeli gry.'], status: 'planned' },
  { id: 'baccarat', name: 'Baccarat', category: 'cards', label: 'Elegancja w dwóch kartach', tagline: 'Gracz, bankier czy remis?', color: 'gold', tag: null, players: '1 gracz', description: 'Postaw na rękę gracza, bankiera lub remis. Wygrywa ręka z wynikiem najbliższym dziewięciu punktom.', rules: ['Wybierz gracza, bankiera lub remis.', 'Karty dobierane są według ustalonych reguł.', 'Porównaj końcowe wyniki obu rąk.'], status: 'planned' },
  { id: 'mines', name: 'Mines', category: 'instant', label: 'Odkrywaj krok po kroku', tagline: 'Jeszcze jedno bezpieczne pole?', color: 'teal', tag: 'Instant', players: '1 gracz', description: 'Odkrywaj diamenty na planszy, unikając ukrytych min. Każde bezpieczne pole zwiększa wirtualną wygraną.', rules: ['Wybierz stawkę oraz liczbę min.', 'Odkrywaj kolejne pola z diamentami.', 'Zakończ rundę przed trafieniem na minę, aby zachować wygraną.'], status: 'planned' },
  { id: 'dice', name: 'Dice', category: 'instant', label: 'Prosta gra, Twój wybór', tagline: 'Wybierz próg. Rzuć wyzwanie.', color: 'orange', tag: null, players: '1 gracz', description: 'Wybierz próg i sprawdź, czy wylosowany wynik znajdzie się powyżej lub poniżej niego. Szansa i mnożnik będą widoczne przed rundą.', rules: ['Ustaw próg oraz kierunek zakładu.', 'Sprawdź szansę i potencjalny mnożnik.', 'Wylosuj wynik i porównaj go ze swoim wyborem.'], status: 'planned' },
  { id: 'crash', name: 'Crash', category: 'instant', label: 'Wyczuj swój moment', tagline: 'Mnożnik rośnie. Kiedy wysiadasz?', color: 'pink', tag: 'Instant', players: '1 gracz', description: 'Obserwuj rosnący mnożnik i zakończ rundę przed jego zatrzymaniem. Wszystkie stawki oraz wyniki dotyczą wyłącznie wirtualnych żetonów.', rules: ['Wybierz wirtualną stawkę i rozpocznij rundę.', 'Mnożnik rośnie do losowego momentu zatrzymania.', 'Odbierz żetony przed zatrzymaniem albo stracisz stawkę.'], status: 'planned' },
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
