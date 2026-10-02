# dragit-site — izvorni kod sajta www.dragit.net

Ovaj repo je **izvor za produkciju**: GitHub Pages je podešen na granu `main`,
koren foldera (nema build koraka — sajt je statički HTML/CSS/JS, fajl `CNAME`
drži `www.dragit.net`).

## Pravilo broj jedan: `main` je produkcija i ne dira se izravno

Svaki push na `main` je **istovremeno deploy**. Zato:

| Grana | Uloga | Ko radi na njoj |
|---|---|---|
| `main` | produkcija (www.dragit.net) | **niko ne komituje direktno** — samo `release.py` |
| `dev` | integraciona grana, sve izmene žive ovde | svakodnevni rad |
| `feat/<tema>` | opciono, kad ima paralelnog rada | po potrebi |

Tok izmene je uvek isti:

```
izmena na dev  ->  kapije  ->  backup tag stare verzije  ->  ff-merge u main  ->  push (deploy)  ->  verifikacija produkcije
```

## Kako se radi (alat je u projektu, ne u ovom repou)

Skripte žive u `G:\Marketing\site_dev\release` (projekat „Marketing", ovaj repo
je njegov `site_dev/repo` podfolder):

```bash
# 1) rad na grani za razvoj
git switch dev

# 2) kapije - moraju proći pre isporuke (LQA, linkovi, JSON-LD, SEO, markup, AI-tekst)
C:/Python313/python site_dev/release/gate.py

# 3) isporuka: kapije -> backup tag -> ff-merge -> push -> provera produkcije
C:/Python313/python site_dev/release/release.py
```

`release.py` piše dokaz svake isporuke u `site_dev/release/deploy-<datum>.md`
(HTTP statusi i sadržajne probe na produkciji).

## Blokade

- **Lokalno:** `pre-push` hook blokira `git push origin main` (izvor u
  `site_dev/release/hooks/pre-push`, instalira se sa
  `python site_dev/release/install_hooks.py`; posle novog clone-a ga treba
  ponovo instalirati jer `.git/hooks` nije verzionisan).
- **Udaljeno:** granu `main` treba zaštititi pravilom „Require a pull request
  before merging" sa izuzetkom za administratore, da bi `release.py` mogao da
  isporuči (`site_dev/release/protect_main.py`; traži nalog sa admin pravima na repou).

## Zašto postoji ovaj README

Public repo bez uputstva znači da svako ko otvori GitHub UI može push-ovati
direktno u `main` i time promeniti živi sajt. Cifre sa produkcije uvek
povezati sa `dragit.net`, ne sa izvorom ovog teksta.

Kontakt: info@dragit.net · dragIT, Novi Sad / Milići
