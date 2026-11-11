# WCAG 2.2 AA — izvještaj implementacije i provjere

**Repozitorij:** https://github.com/lemgenda/zepter-tema  
**Grana:** `wcag-22`  
**Datum ažuriranja:** 11. 11. 2026.  
**Opseg:** implementacija WCAG 2.2 AA poboljšanja, automatizirane CI provjere i završna ručna provjera storefronta prema checklisti.

## Sažetak

U ovom prolazu popravljena je desktop navigacija nakon što je prethodno dodani `role="none"` uzrokovao da čitač zaslona izgovara „none”. Vraćena je nativna HTML semantika `nav > ul > li`, uklonjeni su redundantni `aria-label` atributi s linkova i `summary` kontrola te je vidljivi tekst navigacije vraćen u accessibility tree. Animacijski duplikat ostaje izričito skriven s `aria-hidden="true"`.

Browser test sada se pokreće i na svakom pushu grane `wcag-22`, uz aktivni Shopify preview URL i zadane rute home, product, collections, FAQ, contact, login, account, cart i search. Test dodatno provjerava nativnu list semantiku, redundantna imena i target size za linkove, gumbe i disclosure kontrole.

**Trenutačni status:** automatizirani workflow [#42963791626](https://github.com/lemgenda/zepter-tema/actions/runs/42963791626) završio je uspješno, a korisnik je potvrdio da je cijela ručna audit checklista provedena i da su sve stavke u redu. Raniji privremeni statusi i popisi otvorenih koraka uklonjeni su iz aktivnog izvještaja jer ih nadjačavaju završni rezultati. Ovo je evidencija implementacije i testiranja, a ne neovisna formalna certifikacija sukladnosti.

## Implementirane izmjene u ovom prolazu

### 1. Customer, contact i newsletter forme

- `sections/main-login.liquid`: dodani su fokusabilni error summary blokovi za login i recovery forme; invalid email/password polja povezana su s odgovarajućim summaryjem. Ispravljen je case-sensitive fragment link za povratak na login (`#Login`).
- `sections/main-register.liquid`: registracijske greške povezane su s email/password poljima, a error summary je fokusabilan.
- `sections/main-reset-password.liquid` i `sections/main-activate-account.liquid`: invalid password polja povezana su s fokusabilnim error summaryjem.
- `sections/main-activate-account.liquid`: cancel/decline submit kontrola sada šalje Shopifyjev `name="decline"` parametar.
- `sections/contact-form.liquid`: email greška ima `aria-invalid` i `aria-describedby`; error summary je fokusabilan.
- `snippets/newsletter-form.liquid`: error summary sada je valjan HTML wrapper s jedinstvenim ID-em, `data-a11y-error-summary` i `tabindex="-1"`. Time je uklonjen raniji pokušaj umetanja HTML `default_errors` sadržaja u inline `span`.
- `sections/main-addresses.liquid`: dodani su fokusabilni error summary blokovi za create/edit address forme.
- `snippets/gift-card-recipient-form.liquid`: email, ime, poruka i datum slanja imaju polju pridružene greške; error summary dobiva zajednički fokusni hook.
- `snippets/shine-pages-gift-card-recipient-form.liquid`: Shine Pages error heading povezan je sa zajedničkim fokusnim hookom.

### 2. Fokus i modalni prozori

- `assets/theme.js`: `getFocusableElements()` uključuje fokusabilne error summary elemente, tako da ih modalni focus trap može obuhvatiti.
- `assets/accessibility.js`: fokusira vidljivi error summary; ako se summary nalazi u zatvorenom `x-modal`, `drawer-element`, `newsletter-modal` ili `quick-view` elementu, pokušava otvoriti modal prije fokusiranja.
- Mobilne close kontrole više nisu skrivene na sljedećim komponentama:
  - `sections/main-cart.liquid`
  - `sections/pickup-availability.liquid`
  - `snippets/facets-drawer.liquid`
  - `snippets/product-variants.liquid`
  - `sections/newsletter-popup.liquid`
  - ranije popravljeni cart/search/help/address/product variant draweri
- `sections/age-verifier.liquid` i `sections/cookie-banner.liquid`: uklonjen je `sr-only` s roditeljskog header wrappera close gumba kako bi kontrola mogla biti vizualno dostupna; modal semantika ostaje `aria-modal="true"`.

### 3. Košarica i dinamički statusi

- `assets/accessibility.js`: dodane su live najave za `cart:updated` i `cart:error`; postojeće `ajaxProduct:added` i `ajaxProduct:error` najave zadržane su.
- `assets/cart.js`: cart update greške sada emitiraju `cart:error`; shipping calculator success/error sadržaji imaju `role="status"` / `role="alert"`.
- `sections/main-cart.liquid`: cart item slika dobiva fallback alt tekst iz naziva proizvoda; volume-pricing close kontrola nije skrivena na mobitelu.
- `snippets/shine-pages-cart-drawer.liquid`: uklonjen je `aria-hidden="true"` s dinamičkog line-item error regiona, dodan je `role="alert"`; minus/plus kontrole imaju nazive; slike dobivaju fallback alt tekst.
- Lokalizirane poruke za cart update dodane su u svih šest podržanih locale datoteka i izložene kroz `body` data atribute u glavnom i BEAE layoutu.

### 4. Slike i alternativni tekst

Dodani su kontekstualni fallback alt tekstovi za ključne slike u:
- `snippets/product-card.liquid`
- `snippets/product-thumbnail.liquid`
- `snippets/product-media.liquid`
- `snippets/collection-card.liquid`
- `snippets/article-card.liquid`
- `snippets/promotion-card.liquid`
- `sections/slideshow.liquid`
- `sections/main-cart.liquid`
- `sections/newsletter-popup.liquid`
- `sections/age-verifier.liquid`
- `sections/cookie-banner.liquid`
- `snippets/shine-pages-cart-drawer.liquid`

Ikone koje su dekorativne označene su praznim alt tekstom gdje je to primjereno. Ovo je ciljano popravljanje najvažnijih prikazanih komponenti, a ne dokaz da su sve slike u temi semantički pregledane.

### 5. Reduced motion, carousel i varijante

- `assets/accessibility.js`: prati `prefers-reduced-motion`; kod uključenog reduced motion uklanja autoplay s postojećih i naknadno umetnutih slideshow/video elemenata, pauzira postojeće playere i aktivira observer za dinamički dodane komponente.
- `assets/theme.js`: slideshow autoplay i automatsko pokretanje videa poštuju `theme.config.motionReduced`; kontrola pauze/play sinkronizira `aria-live`.
- `sections/slideshow.liquid`: carousel ima region/roledescription/naziv; svaki slide je označena slide grupa; slike imaju alt fallback; autoplay kontrola uklanja neodgovarajući `aria-live` atribut s gumba.
- `snippets/product-media-gallery.liquid`: featured media zoom kontrola više nema `tabindex="-1"`.
- `snippets/product-variant-picker.liquid`: odabrana vrijednost varijante koristi polite live region.
- `sections/main-product.liquid`: promjene cijene, SKU-a i cijene po komadu koriste polite status/live regije; `snippets/product-inventory.liquid` već izlaže stanje zalihe kao status.
- `snippets/facets-drawer.liquid`: dinamički broj filtera koristi status live region.

### 5a. Navigacija, predictive search, pagination i carouseli

- `snippets/header-nav-drawer.liquid`: back kontrole imaju kontekstualni naziv na svim podržanim jezicima; promo slike su dekorativne kada je link već imenovan tekstom.
- `assets/theme.js`: zatvaranje podizbornika vraća fokus na pripadajući `summary`.
- `snippets/predictive-search.liquid` i `assets/search.js`: uklonjen je neprikladan `role="listbox"` s rezultata koji nisu implementirani kao ARIA listbox; input je povezan s imenovanom regijom, a `aria-expanded` prati prikaz rezultata. Broj rezultata/nema rezultata koristi status najavu.
- `snippets/pagination.liquid`: pagination je imenovani `nav` landmark; `aria-current="page"` primjenjuje se samo na trenutačnu stranicu, ne na prethodnu/sljedeću ili obične linkove.
- `sections/main-search.liquid`: redundantna slika-link kartice članka uklonjena je iz tab-redoslijeda i accessibility treea jer naslov članka već daje isto odredište.
- `sections/product-recommendations.liquid` i `sections/recently-viewed.liquid`: slideri su imenovane carousel regije, a JS dodaje polite status nakon asinkronog učitavanja. Generički slider ograničava fokus na vidljive kartice, a prethodna/sljedeća kontrola ostaje dostupna.
- `sections/announcement-bar.liquid`: announcement bar je imenovani carousel region; pojedinačne objave imaju slide semantiku, autoplay kontrola postoji i kad je navigacija isključena, a aktivni slide state upravlja `aria-hidden` i `inert`.
- `assets/theme.js`: announcement i slideshow carouseli sinkroniziraju aktivni slide, uklanjaju neaktivne slideove iz fokusa i pauziraju rotaciju kad tipkovnički fokus uđe u slide. Generički `slider-element` sada postavlja `aria-hidden`/`inert` na horizontalno izvan-viewport kartice, uz iznimku kartice koja još sadrži fokus; vidljivost se osvježava pri scrollu, resizeu i focusoutu.
- `snippets/facets-drawer.liquid`: broj filtera koristi status live region; `snippets/facets.liquid` više nema dupli `class` atribut na image facet inputu.
- `snippets/pickup-availability.liquid`: promjena dostupnosti preuzimanja izložena je kao polite status.

### 5b. Product media, swatchevi i third-party forme

- `snippets/product-variants.liquid`: uklonjen je radio input ugniježđen u link; swatch je jedna keyboard-accessible poveznica s `aria-current="page"` za odabrani proizvod i nazivom za trenutno odabrano / rasprodano stanje.
- `snippets/swatch.liquid`: povezani swatchevi izlažu current state.
- `snippets/product-thumbnail.liquid`: naziv thumbnailla uključuje opis, tip medija i redni broj.
- `snippets/media.liquid`: video/model kontrolama dodani su opisni nazivi, a media wrapperi imaju pristupačna group imena.
- `assets/accessibility.js`: dinamički učitani iframeovi unutar product video/model medija dobivaju `title` iz pripadajućeg media opisa.
- `assets/recipient-form.js`: ispravljen je unsubscribe handle za cart error subscription; checkbox sinkronizira `aria-expanded`, email `required` stanje, dinamičke field error atribute i fokus error regiona.
- `snippets/shine-pages-gift-card-recipient-form.liquid` i `assets/accessibility.js`: checkbox disclosure ima `aria-controls` / `aria-expanded`, email required state prati odabir, a link greške za `send_on` cilja stvarni ID polja.
- `layout/password.liquid`: skip-link target `MainContent` sada je programatski fokusabilan (`tabindex="-1"`).
- `sections/faq.liquid`, `sections/footer.liquid`, `snippets/social-icons.liquid`: kontaktna FAQ forma ima fokusabilnu grešku i opis email greške; profilna slika i footer logo imaju alt fallback; icon-only social linkovi imaju `aria-label`.

### 5c. Focus scroll i overlay offsets

- `assets/accessibility.js`: offset za scroll/fokus računa vidljive fixed/sticky elemente u header grupi bez zbrajanja ugniježđenih elemenata; dodan je i bottom offset za mobile dock / označene fixed-bottom kontrole.
- `assets/accessibility.css`: `scroll-padding` i `scroll-margin` uzimaju u obzir gornje i donje overlaye.
- Observer se ponovno postavlja nakon Shopify section load/reorder/unload događaja.

### 6. CSS osnove

- `assets/accessibility.css`: common button controls imaju minimalnu inline/block veličinu od 24 CSS px. Ovo je minimalni prag za kontrole, ne zamjena za pregled svih stvarnih targeta i iznimaka u kontekstu.

### 7. Testna infrastruktura

Dodani su:
- `.github/workflows/wcag-22.yml`: na push/pull request prema `wcag-22` pokreće Shopify Theme Check i JSON parse validaciju; manual `workflow_dispatch` s preview URL-om pokreće browser test.
- `scripts/wcag-a11y-smoke.mjs`: Playwright + axe-core smoke test za desktop, 375 px i 320 px širine, uključujući WCAG axe pravila, prvi keyboard focus indikator, tekstualni spacing override, forced-colors/reduced-motion i popis malih interaktivnih targeta za ručni pregled.

### 8. Završne automatizirane provjere

Workflow [#42963791626](https://github.com/lemgenda/zepter-tema/actions/runs/42963791626) (workflow #409), na grani `wcag-22`, commit `7de3af302af9407a2d04a59f0c1a32ff61927785`, završio je sa statusom **success**.

Uspješno su završila oba joba:

- **Liquid, JSON, and theme lint**
- **Browser accessibility smoke tests**

Zabilježeni rezultati:

- Theme Check s `--auto-correct`: 293 datoteke pregledane, 0 prekršaja.
- Theme Check s `--fail-level suggestion`: 293 datoteke pregledane, 0 prekršaja/sugestija koje bi uzrokovale neuspjeh.
- JSON validacija: sve JSON datoteke valjane.
- Browser accessibility smoke test: prošao.
- Pregled ciljnih veličina: 0 kontrola ispod 24 px u izvještaju, 0 stavki označenih kao obavezna korekcija i 0 stavki označenih za ručni pregled.
- Heuristički pregled kontrasta: 2649 tekstualnih čvorova uzorkovano, bez kandidata s niskim kontrastom.
- Pregled slika: 33 slike, bez nedostajućeg alt teksta i bez praznog alt teksta unutar imenovanih linkova.
- Reduced motion: aktivan; preostali autoplay elementi: 0.
- Forced-colors provjera fokusa: prošla.
- Facet interakcija: drawer se otvorio, dvije facet grupe bile su dostupne, a odabir checkboxa i sinkronizacija URL-a potvrđeni su.

U logu su ostala Ruby `Template.register_tag` i Node `punycode` deprecation upozorenja. Ona nisu uzrokovala Theme Check prekršaje ni neuspjeh jobova.

### Ograničenja automatiziranih provjera

Ova ograničenja opisuju granice onoga što alati mogu dokazati; **nisu otvorene stavke za implementaciju**:

- Heuristički kontrastni pregled ne mjeri pouzdano sve kombinacije fotografskih/gradijentnih pozadina, transparentnosti, overlay slojeva i svih hover/focus/disabled stanja.
- Playwright i axe provjeravaju učitani DOM i automatizabilna pravila; ne mogu sami potvrditi što će čitač zaslona izgovoriti u svim kombinacijama preglednika i pomoćne tehnologije.
- Automatski pregled slika ne može procijeniti je li svaki opisni alt tekst urednički najbolji mogući opis stvarnog sadržaja slike.
- Uspješan smoke test predstavlja dokaz za obuhvaćene rute, viewportove i interakcije, a ne matematički dokaz za svaku moguću kombinaciju sadržaja i stanja trgovine.

## 9. Završni ručni audit storefronta

Korisnik je izričito potvrdio da je **cijela ručna checklistа iz audita provedena i da je sve provjereno i u redu**. Ovaj izvještaj bilježi tu potvrdu; pojedinačni koraci nisu zasebno neovisno opaženi kroz GitHub zapis.

Potvrđeni opseg ručnog audita:

- Prikaz na desktopu (1440 px), tabletu (768 px), mobitelu (390 px) i minimalnoj širini (320 px).
- Ključne storefront stranice: početna, kolekcije, kolekcije s filterima, proizvod, FAQ, kontakt, prijava, korisnički račun, košarica i pretraživanje.
- Navigacija, dropdowni, mobilni izbornik, semantika i provjera ponovljenih najava stavki.
- Čitači zaslona: NVDA + Firefox, VoiceOver + Safari te TalkBack + Chrome.
- Tipkovnički pristup, redoslijed i vidljivost fokusa, zatvaranje modala/izbornika i povrat fokusa.
- Kombinacije filtera, URL i rezultati, promjena varijante, košarica i dinamičke najave.
- Obrasci, oznake polja, validacijske poruke i korisnički račun.
- Kontrast, povećanje teksta, 400% zoom/reflow, horizontalni overflow, ciljevi dodira, reduced motion i forced colors.

**Ishod ručnog audita prema korisničkoj potvrdi: PASS — bez prijavljenih odstupanja.**

## 10. Završni status

| Područje | Status | Osnova |
|---|---|---|
| Theme Check | **PASS** | Workflow #42963791626; 293 datoteke, 0 prekršaja |
| JSON validacija | **PASS** | Workflow #42963791626 |
| Browser accessibility smoke tests | **PASS** | Workflow #42963791626 |
| Facet interakcija | **PASS za provjereni tok** | Drawer, dvije facet grupe, checkbox i URL sinkronizacija |
| Reduced motion / forced colors | **PASS za automatizirane provjere** | Workflow #42963791626 |
| Ručni storefront audit | **PASS prema potvrdi korisnika** | Cijela dostavljena checklista potvrđena kao provedena i uredna |
| Prijavljeni otvoreni problemi iz ovog audita | **0** | Nije prijavljeno odstupanje |

**Zaključak:** na temelju posljednjeg uspješnog CI runa i korisnikove potvrde ručnog audita, evidentirani opseg WCAG 2.2 AA implementacije i provjera je zatvoren. Nema preostalih implementacijskih zadataka ni „sljedećih koraka za zatvaranje” iz ovog audita.

Ovaj zaključak nije neovisna formalna certifikacija niti jamstvo da buduće izmjene teme neće uvesti regresije. Nakon budućih promjena teme treba ponovno pokrenuti CI i provjeriti relevantne korisničke tokove.

## 11. Povijest implementacije

Odjeljci 1–7 iznad opisuju implementirane promjene i tehnički opseg rada. Raniji privremeni nalazi, neuspjeli pokušaji i međurezultati iz tijeka razvoja nisu zadržani kao aktivne stavke ovog završnog izvještaja. Njihovo zadržavanje uz aktualni status stvaralo bi dojam da su provjere još otvorene, iako su naknadno provedene i zatvorene završnim CI runom i ručnim auditom.

