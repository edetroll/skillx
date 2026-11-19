# SkillX Task Builder v1.6 – GitHub Pages telepítés

1. Csomagold ki a `SkillX_Task_Builder_v1.6.zip` fájlt.
2. A `skillx-builder-v1.6` mappa **tartalmát** töltsd fel a GitHub repository gyökerébe. Az `index.html` közvetlenül a repository gyökerében legyen.
3. GitHub: **Settings → Pages**.
4. Build and deployment: **Deploy from a branch**.
5. Branch: **main**, folder: **/(root)**.
6. Save.

## Használat

- **Projekt mentése**: `.skillx.zip` fájlt készít. Ezt később vissza lehet tölteni a Builderbe és tovább lehet szerkeszteni.
- **Előkészítés AI-hoz**: egyetlen `.md` fájlt készít, amelyben benne van a feladat és a teljes pedagógiai instrukció. Ha vannak mellékletek, azokat a felület külön letöltésre felsorolja; a diáknak a `.md` fájllal együtt kell feltöltenie őket az AI-beszélgetésbe.

A `.skillx.zip` projektfájlt nem érdemes közvetlenül ChatGPT-be, Geminibe vagy más AI-chatbe feltölteni, mert egyes szolgáltatások csak a ZIP tartalomjegyzékét látják.

A ZIP-kezeléshez szükséges JSZip helyben van a projektben, ezért külön backend vagy API-kulcs nem szükséges.
