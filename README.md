# Siłka 🏋️🏃

Osobisty tracker treningów (siłownia + bieganie) jako PWA – bez backendu i bez budowania. Dane są tylko na Twoim telefonie (localStorage), działa offline.

## Funkcje
- **Kalendarz** – dni treningowe (siła/bieg), zrobione / zaplanowane / ominięte, statystyki miesiąca
- **Plan na dzień** – plan tygodnia + zmiana treningu dla konkretnej daty
- **Tracker serii** – kg × powt., ✓ przy serii uruchamia timer przerwy, ekran nie gaśnie
- **Progresja** – podwójna progresja: gdy wszystkie serie osiągną górny zakres powtórzeń, następnym razem podpowiada +kg (krok globalny lub per ćwiczenie); poprzedni wynik zawsze widoczny
- **Historia ćwiczeń** – rekord, szac. 1RM, wykres (maks. ciężar / 1RM / objętość), zmiany z treningu na trening
- **Bieganie** – dystans, czas, tempo, wykres i rekordy
- **Edytor planu**, eksport/import kopii JSON

## Plan „operator build” (wg raportu badawczego)
- Trening A/B w **kolejce** A→B→A→B (nie po dniach tygodnia), warianty: łączony (1 okno) i minimum 30–40 min
- Biegi: spokojny (tętno 130–145), interwały, test 3 km co 4–6 tyg.
- **Grafik pracy**: D / N, dzień po nocce = bez siłowni, zielone okna na trening (≥48 h odstępu)
- RIR przy seriach; progresja tylko gdy górny zakres przy RIR ≥2; wykrywanie stagnacji i podpowiedź deloadu
- Bilans ciągnięcie:pchanie, start treningu z rozgrzewką na dany dzień
- **Ciało**: waga (średnia 7 dni), talia, tętno, test 3 km

## Uruchomienie na telefonie
1. Włącz GitHub Pages: *Settings → Pages → Source: GitHub Actions* (workflow wdraża gałąź `main`).
2. Otwórz `https://<user>.github.io/silka/` na telefonie.
3. „Dodaj do ekranu głównego” (Chrome: menu ⋮, Safari: Udostępnij).

Lokalnie: `python3 -m http.server` i `http://localhost:8000`.

> Dane są w przeglądarce – rób czasem eksport (Plan → Dane).
