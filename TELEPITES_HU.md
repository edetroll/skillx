# SkillX Task Builder v1.1 – GitHub Pages telepítés

## 1. Csomagold ki

A ZIP-ben található fájlokat úgy töltsd fel, hogy az `index.html` közvetlenül a GitHub repository gyökerében legyen.

## 2. GitHub repository

Hozz létre egy új repository-t, például:

`skillx-task-builder`

Töltsd fel a következő struktúrát:

```text
index.html
.nojekyll
css/
  style.css
js/
  app.js
README.md
TELEPITES_HU.md
```

## 3. GitHub Pages bekapcsolása

Repository → **Settings → Pages**

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/(root)**
- Save

A GitHub ezután létrehozza a publikus webcímet.

## 4. Működés

A weboldal szerver nélkül működik. A feladat szerkesztése és a mellékletek kezelése a böngészőben történik.

A **Create new task** új feladatot hoz létre.

Az **Open package** egy korábban exportált `.skillx.zip` csomagot tölt vissza. A v1.0-s csomagok megnyitáskor automatikusan kiegészülnek a v1.1 új mezőivel.

Az **Export package** elkészíti a tanulónak átadható ZIP-et.

## 5. Internetkapcsolat

A ZIP-kezeléshez a jelenlegi verzió a JSZip könyvtárat CDN-ről tölti be, ezért az import/export funkcióhoz internetkapcsolat szükséges.

A hivatalos SkillX logó szintén a projekt weboldaláról töltődik be. Ha ez nem érhető el, a felület automatikusan egy egyszerű `SX` jelölést mutat helyette.

## 6. Adattárolás

Nincs központi adatbázis. A helyi piszkozatot a böngésző IndexedDB tárhelye menti. A végleges, hordozható projektfájl a `.skillx.zip`.
