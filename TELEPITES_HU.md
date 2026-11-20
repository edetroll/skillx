# SkillX Task Builder v1.8 – GitHub Pages telepítés

1. Csomagold ki a `SkillX_Task_Builder_v1.8.zip` fájlt.
2. A `skillx-builder-v1.8` mappa **tartalmát** töltsd fel a GitHub repository gyökerébe. Az `index.html` közvetlenül a repository gyökerében legyen.
3. GitHub: **Settings → Pages**.
4. Build and deployment: **Deploy from a branch**.
5. Branch: **main**, folder: **/(root)**.
6. Save.

## Használat

- **Újrafelhasználható projekt letöltése**: `.skillx.zip` fájlt készít. Ezt később vissza lehet tölteni a Builderbe és tovább lehet szerkeszteni.
- **AI-feladat letöltése**: ha nincs melléklet, egyetlen `SkillX_Task.md` fájlt tölt le. Ha van melléklet, egy AI-feladat ZIP készül `SkillX_Task.md`, `README.txt` és az összes melléklet tartalmával. Ezt a ZIP-et ki kell csomagolni, majd az `.md` fájlt és az összes mellékletet együtt kell feltölteni az AI-nak.

A `.skillx.zip` projektfájlt nem érdemes közvetlenül ChatGPT-be, Geminibe vagy más AI-chatbe feltölteni, mert egyes szolgáltatások csak a ZIP tartalomjegyzékét látják.

A ZIP-kezeléshez szükséges JSZip helyben van a projektben, ezért külön backend vagy API-kulcs nem szükséges.


## Használat
- Az **Újrafelhasználható projekt letöltése** gomb `.skillx.zip` fájlt készít későbbi szerkesztéshez.
- Az **AI-feladat letöltése** melléklet nélkül `.md` fájlt, mellékletekkel pedig kicsomagolandó AI-feladat ZIP-et készít.
- A tanuló a `SkillX_Task.md` fájlt és minden mellékletet ugyanabba az AI-beszélgetésbe tölti fel. A ZIP-et magát nem kell és nem célszerű az AI-nak feltölteni.
