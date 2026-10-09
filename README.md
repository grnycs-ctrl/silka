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

## Uruchomienie na telefonie
1. Włącz GitHub Pages: *Settings → Pages → Source: GitHub Actions* (workflow wdraża gałąź `main`).
2. Otwórz `https://<user>.github.io/silka/` na telefonie.
3. „Dodaj do ekranu głównego” (Chrome: menu ⋮, Safari: Udostępnij).

Lokalnie: `python3 -m http.server` i `http://localhost:8000`.

> Dane są w przeglądarce – rób czasem eksport (Plan → Dane).
