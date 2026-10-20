# Polityka prywatności Betify

Wersja bez danych administratora z 20 października 2026 r.

> Dokument opisuje działanie Betify. W tej wersji pominięto tożsamość i kontakt do administratora, dlatego nie stanowi pełnej informacji wymaganej przez art. 13 RODO. Nie potwierdza również wdrożenia mechanizmu zgód.

## 1. O serwisie

Polityka dotyczy serwisu Betify — demonstracyjnej aplikacji z grami na wirtualne żetony. Serwis nie prowadzi kont graczy, nie przyjmuje wpłat i nie umożliwia wypłat prawdziwych pieniędzy.

## 2. Jakie informacje są wykorzystywane

### Informacje o rozgrywce zapisane na urządzeniu

Betify zapisuje w pamięci lokalnej przeglądarki (`localStorage`) saldo wirtualnych żetonów oraz identyfikatory gier dodanych do ulubionych. Wykorzystuje do tego wpis `betify:player:v1`.

Osobny wpis `betify:cookie-notice:v1` zapamiętuje zamknięcie powiadomienia „Cookies i pamięć lokalna”. Kod aplikacji nie wysyła tej informacji na serwer. Przycisk „Rozumiem” zamyka informację, bez zmiany ustawień zapisu salda i ulubionych.

Kod aplikacji nie wysyła tych informacji do administratora ani do centralnej bazy graczy. Nie zapisuje w tym wpisie imienia, nazwiska, adresu e-mail ani historii płatności. Wyniki ostatnich rund i trwające rozdania są przechowywane w pamięci bieżącej gry, a nie jako trwała historia konta.

Przechowywanie danych na urządzeniu nie oznacza pełnej anonimowości połączenia internetowego. Dostawcy obsługujący pobranie strony i czcionek otrzymują dane techniczne opisane poniżej.

### Dane techniczne połączenia

Przeglądarka przekazuje serwerowi informacje potrzebne do obsługi żądania, w szczególności adres IP oraz dane żądania HTTP. Zakres może obejmować czas połączenia, adres pobieranego zasobu, informacje o przeglądarce i systemie oraz adres strony odsyłającej, zależnie od konfiguracji przeglądarki i serwera.

Przy hostingu w GitHub Pages GitHub rejestruje adresy IP odwiedzających dla celów bezpieczeństwa. Informacja dotyczy również osób niezalogowanych do GitHub. [Informacja GitHub o danych odwiedzających](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection).

## 3. Cele i podstawy przetwarzania

W zakresie, w jakim informacje stanowią dane osobowe, administrator wykorzystuje je w następujących celach:

| Cel | Podstawa i wyjaśnienie |
| --- | --- |
| Udostępnienie żądanej rozgrywki i jej funkcji | Art. 6 ust. 1 lit. b RODO — w zakresie niezbędnym do świadczenia usługi, z której korzystasz. |
| Bezpieczeństwo serwisu, ustalanie przyczyn błędów i ochrona przed nadużyciami | Art. 6 ust. 1 lit. f RODO — uzasadniony interes polegający na zapewnieniu bezpiecznego działania serwisu. Dotyczy danych, do których administrator faktycznie ma dostęp; dostawcy mogą realizować także własne cele. |

Podstawa prawna przetwarzania danych osobowych i warunki zapisywania informacji w urządzeniu to odrębne kwestie. Szczegóły dotyczące pamięci przeglądarki opisuje [Polityka cookies i pamięci lokalnej](polityka-cookies.md).

W obecnym kodzie czcionki Google Fonts pobierane są automatycznie. Nie ma mechanizmu uzyskiwania zgody na to połączenie. Dokument nie przyjmuje, że samo korzystanie ze strony oznacza zgodę ani że estetyka strony automatycznie uzasadnia przekazywanie danych. Ustalenie podstawy korzystania z zewnętrznych czcionek pozostaje odrębną kwestią opisaną w uwagach do publikacji.

## 4. Dostawcy i odbiorcy danych

Kod i konfiguracja projektu przewidują następujące usługi:

- **GitHub Pages**, dostarczany przez GitHub, Inc. — hosting plików strony. Dostawca może przetwarzać dane techniczne połączeń, w tym adres IP, dla utrzymania i ochrony swojej infrastruktury. [Polityka prywatności GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
- **Google Fonts** — pobieranie czcionek DM Sans i Manrope z domen `fonts.googleapis.com` i `fonts.gstatic.com`. Połączenie z serwerami Google przekazuje co najmniej adres IP i dane techniczne żądania. Nie jest to przesyłanie salda lub listy ulubionych przez kod Betify. [Polityka prywatności Google](https://policies.google.com/privacy?hl=pl).

Administrator może udostępnić dane uprawnionym organom, gdy wynika to z wiążącego obowiązku prawnego. Kod Betify nie zawiera narzędzi reklamowych, pikseli marketingowych ani zewnętrznych skryptów analitycznych.

## 5. Przetwarzanie poza Europejskim Obszarem Gospodarczym

Dostawcy infrastruktury mogą przetwarzać dane poza EOG, w tym w Stanach Zjednoczonych. GitHub opisuje wykorzystywanie standardowych klauzul umownych oraz ram ochrony danych UE–USA; Google opisuje stosowane mechanizmy transferu w swojej polityce prywatności. Szczegóły i informacje o zabezpieczeniach są dostępne w dokumentach dostawców wskazanych powyżej.

Opis konfiguracji projektu nie potwierdza konkretnego miejsca przetwarzania wszystkich danych. Nie należy zakładać, że wszystkie dane pozostają w Polsce lub w EOG.

## 6. Jak długo informacje są przechowywane

- **Saldo i ulubione:** aplikacja nie ustawia terminu wygaśnięcia wpisu `localStorage`. Dane pozostają do usunięcia danych witryny, wyczyszczenia profilu przeglądarki lub usunięcia ich przez przeglądarkę. Prywatny tryb przeglądania może usuwać je wcześniej. Dalsza gra lub zmiana ulubionych ponownie zapisuje dane.
- **Zamknięcie powiadomienia:** do usunięcia wpisu `betify:cookie-notice:v1` lub danych witryny przez użytkownika albo przeglądarkę.
- **Bieżąca gra i historia ostatnich rund:** do zamknięcia, przeładowania lub ponownego zainicjowania danej gry, z zastrzeżeniem mechanizmów przywracania kart przez przeglądarkę. Saldo jest aktualizowane osobno w pamięci lokalnej.
- **Dane przetwarzane przez GitHub i Google:** okresy zależą od celu i zasad dostawcy. Betify nie ustawia czasu przechowywania ich logów. Obowiązujące informacje są dostępne w politykach dostawców; nie deklarujemy niepotwierdzonej liczby dni.

## 7. Twoje prawa

W granicach przewidzianych przez RODO możesz żądać dostępu do swoich danych, ich sprostowania, usunięcia lub ograniczenia przetwarzania. Możesz wnieść sprzeciw wobec przetwarzania opartego na uzasadnionym interesie. Prawo do przenoszenia danych przysługuje przy spełnieniu ustawowych warunków.

Jeżeli podstawą jest zgoda, możesz ją wycofać bez wpływu na wcześniejszą zgodność przetwarzania z prawem. Możesz złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych. [Informacja UODO o prawach](https://uodo.gov.pl/pl/493/2254).

Kod Betify nie tworzy centralnej kopii Twojego salda i ulubionych; te dane możesz usunąć bezpośrednio w przeglądarce. W sprawach danych przetwarzanych przez dostawców dla ich własnych celów możesz również korzystać z kontaktów podanych w ich politykach. Ta wersja dokumentu nie podaje kanału kontaktu z administratorem Betify, co ogranicza jej kompletność jako informacji o realizacji praw.

## 8. Dobrowolność, profilowanie i decyzje automatyczne

Nie musisz zakładać konta ani podawać imienia, nazwiska lub adresu e-mail, aby grać. Połączenie internetowe wymaga obsługi danych technicznych.

Kod Betify nie tworzy profili reklamowych i nie podejmuje decyzji wywołujących skutki prawne lub podobnie istotnie wpływających na użytkownika. Losowe wyniki gier dotyczą jedynie demonstracyjnych żetonów, które nie mają wartości pieniężnej.

## 9. Zmiany polityki

Politykę aktualizujemy po zmianie funkcji, dostawców lub sposobów przetwarzania danych. Aktualna wersja powinna być dostępna w serwisie z datą aktualizacji. Zmiana dokumentu sama w sobie nie zastępuje zgody, jeżeli wymaga jej nowy sposób przetwarzania.
