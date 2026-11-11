# WCAG 2.2 AA — izvještaj implementacije i provjere

**Repozitorij:** https://github.com/lemgenda/zepter-tema  
**Grana:** `wcag-22`  
**Datum ažuriranja:** 11. 11. 2026.  
**Opseg:** popravci otvorenih stavki iz prethodne verzije izvještaja i dodavanje testnog workflowa.

## Sažetak

U ovom prolazu popravljena je desktop navigacija nakon što je prethodno dodani `role="none"` uzrokovao da čitač zaslona izgovara „none”. Vraćena je nativna HTML semantika `nav > ul > li`, uklonjeni su redundantni `aria-label` atributi s linkova i `summary` kontrola te je vidljivi tekst navigacije vraćen u accessibility tree. Animacijski duplikat ostaje izričito skriven s `aria-hidden="true"`.

Browser test sada se pokreće i na svakom pushu grane `wcag-22`, uz aktivni Shopify preview URL i zadane rute home, product, collections, FAQ, contact, login, account, cart i search. Test dodatno provjerava nativnu list semantiku, redundantna imena i target size za linkove, gumbe i disclosure kontrole.

**Status:** potpuna WCAG 2.2 AA sukladnost nije potvrđena. Shopify Theme Check i JSON validacija prošli su u workflowu [#42934986286](https://github.com/lemgenda/zepter-tema/actions/runs/42934986286). Browser audit istog workflowa još je u tijeku u trenutku ovog ažuriranja. Prolaz automatiziranih provjera ne zamjenjuje ručno testiranje NVDA/Firefox, VoiceOver/Safari i TalkBack/Chrome.

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

### 8. Validacije izvršene u ovom prolazu

- Svih šest locale JSON datoteka uspješno je parsirano; provjereni su navigacijski, dialog, carousel, pagination, cart, media-type i product-state ključevi.
- `node --check` prošao je za `scripts/wcag-a11y-smoke.mjs`, `assets/accessibility.js`, `assets/search.js`, `assets/recipient-form.js` te izdvojene izmijenjene klase `AnnouncementBar`, `SlideshowElement` i `SliderElement` iz `assets/theme.js`.
- Ruby YAML parser uspješno je parsirao `.github/workflows/wcag-22.yml`.
- Statički su pregledani relevantni Liquid/JS/CSS dijelovi i potvrđene su promjene na grani.
- **Nisu izvršeni** Shopify Theme Check, axe-core browser run, Playwright run na storefrontu, Liquid render ni test s čitačem zaslona. Za zadnji commit nisu pronađeni GitHub Actions workflow runovi.

## Preostale stavke / nije moguće potvrditi bez preview trgovine

1. **Stvarni browser audit:** pokrenuti `workflow_dispatch` s javno dostupnim Shopify preview URL-om i putanjama koje uključuju stvarne product, collection, FAQ, contact, login, account, cart i search stranice. Trenutni smoke test defaultno provjerava home, all collections, cart i search.
2. **Shopify Theme Check:** workflow je pripremljen, ali rezultat nije dostupan jer workflow nije izvršen. Liquid parser i Theme Check status stoga ostaju nepotvrđeni.
3. **Ručni assistive technology testovi:** NVDA/Firefox, VoiceOver/Safari i TalkBack/Chrome nisu testirani. Potrebno je provjeriti redoslijed fokusa, izgovor, povrat fokusa, modal Escape/close i dinamičke najave.
4. **Kontrast i theme schemes:** stvarne kombinacije foreground/background boja za sve merchant color schemes, overlaye, hover/focus/disabled stanja i button varijante nisu izmjerene.
5. **Zoom/reflow:** 320 px reflow i tekstualni spacing override su u test harnessu; stvarni browser zoom 200%/400% i sadržaj na 320 CSS px još nisu testirani na storefrontu.
6. **Target size 2.5.8:** skripta izlistava kontrole manje od 24 × 24 px; svaku stavku treba ručno provjeriti zbog WCAG iznimaka (inline, ekvivalentna kontrola, spacing i user-agent kontrola).
7. **Product variant i pickup flow:** odabrana vrijednost, cijena, SKU, cijena po komadu, inventory i pickup preview sada imaju status/live semantiku; stvarni redoslijed i čitljivost najava nakon AJAX promjene još treba provjeriti na trgovini.
8. **Facets/filteri:** count live region je dodan, ali stvarni rezultat nakon AJAX filtriranja, fokusni povratak, URL/history i kombinacije checkbox/swatch filtera trebaju browser test.
9. **Product recommendations/recently viewed:** imenovane carousel regije, load statusi i inert/aria-hidden upravljanje izvan-viewport karticama su implementirani; stvarna keyboard operabilnost, screen-reader izgovor i scroll/focus interakcija još trebaju browser test.
10. **Ostale slike:** sve ostale merchant-managed image settinge, article/blog, footer, map, promo i app-provided slike treba pregledati u stvarnom sadržaju. Fallback alt ne može zamijeniti dobar opis koji odgovara stvarnoj slici.
11. **Third-party/hosted flows:** BEAE quickview/header, Shine Pages cart open/close/focus state, Auglio, hCaptcha, external video iframeovi, Shopify Customer Privacy API, checkout i hosted customer challenge nisu testirani niti mijenjani u ovoj iteraciji. Njihovo ponašanje ne treba mijenjati bez runtime provjere.
12. **Cross-browser i responsive:** Safari, Firefox, Chromium, iOS/Android touch, forced colors i dinamičke Shopify theme editor section reload situacije nisu ručno testirane.

## Sljedeći koraci za zatvaranje

1. Pokrenuti workflow ručno s aktivnim preview URL-om i stvarnim putanjama proizvoda/kolekcija.
2. Ispraviti sve Theme Check i axe nalaze te ponoviti CI.
3. Proći tipkovnicu i screen reader kroz sve glavne tokove.
4. Izmjeriti kontrast i target size u svim relevantnim stanjima.
5. Testirati third-party integracije na stvarnoj trgovini.
6. Tek nakon ponovljenog browser i ručnog audita ažurirati status na WCAG 2.2 AA verified.

**Zaključak:** dodan je veći skup dodatnih implementacija i pripremljena je testna infrastruktura. Ipak, dok Theme Check i browser testovi ne budu stvarno izvršeni na aktivnoj Shopify preview trgovini i dok se ne zatvore third-party i ručni testovi, nije opravdano tvrditi da je tema WCAG 2.2 AA sukladna.
## 9. Dodatna provjera desktop navigacije — problem i dalje otvoren

- Korisnik je ponovno potvrdio da NVDA uz ScreenVox pri čitanju desktop navigacije izgovara „Science Behind” dvaput, iako je `Tab` redoslijed ispravan.
- Pokušaj suzbijanja ponavljanja postavljanjem `role="presentation"` na vanjski `ul` u `snippets/header-nav-desktop.liquid` nije riješio problem prema ručnom testu korisnika. Ova izmjena **nije potvrđeno rješenje** i ne smije se tretirati kao zatvorena WCAG stavka.
- Commit `e3af0ce` sadrži izmjenu navigacijskog markup-a; commit `69adb4a` proširuje dijagnostiku. Workflow [#42933526297](https://github.com/lemgenda/zepter-tema/actions/runs/42933526297) izvršen je na commitu `69adb4a66874a060b730aa503e3e4ba3e1c479b5` i završio je uspješno.
- Workflow je zabilježio `listRole: presentation`, eksplicitna imena kontrola i skriveni dekorativni tekst. `navigationTabOrder` je prošao, a axe nije prijavio automatizirane povrede na pregledanim rutama. To potvrđuje samo DOM/automatizirane provjere; ne potvrđuje izgovor pri kretanju strelicama.
- **Status:** otvoreno — ponavljanje „Science Behind” / „Our Tech” pri kretanju strelicama nije riješeno niti verificirano. Ne uklanjati dalje semantiku elemenata naslijepo. Potrebno je pregledati stvarni accessibility tree i DOM potomaka svake stavke, uključujući eventualne duple tekstualne čvorove koje generira animacijski/custom element, te provjeriti s NVDA/ScreenVox nakon ciljane izmjene.
- Sljedeći korak: dodati dijagnostiku punog `outerHTML`/strukture potomaka stavki navigacije i izračunatog accessible name-a; zatim testirati promjenu na previewu i zatražiti ponovni NVDA/ScreenVox test. Playwright/axe ne mogu sami potvrditi govor čitača zaslona.

## 10. Ispravak desktop navigacije i proširenje automatskih provjera

- Uklonjeni su `role="none"` s top-level `li` elemenata i `role="presentation"` s navigacijskog `ul`. Nativna struktura liste je vraćena kako čitač zaslona ne bi izgovarao „none”.
- Uklonjeni su redundantni `aria-label` atributi s top-level `summary` i link kontrola; naziv se sada izvodi iz vidljivog teksta.
- Uklonjen je `aria-hidden="true"` s `magnet-element` wrappera, dok animacijski duplikat `.btn-duplicate` ostaje skriven. Time accessibility tree dobiva jedan vidljivi naziv.
- Playwright dijagnostika provjerava native `ul/li` semantiku, odsutnost redundantnih naziva i skrivanje animacijskog duplikata.
- Browser audit se sada izvršava i na push, ne samo ručnim `workflow_dispatch`. Zadane rute uključuju deset vrsta stranica, a target-size pregled obuhvaća linkove, gumbe i `summary` kontrole.
- Shopify Theme Check i JSON validacija prošli su u workflowu #42934986286. Browser dio tog runa bio je u tijeku u trenutku ažuriranja.
- Nije moguće programski potvrditi izgovor NVDA/ScreenVox samo iz DOM-a. Potrebna je nova ručna provjera na preview temi nakon što se promjena deploya.
- Kontrast u svim merchant schemes, stvarni 200%/400% browser zoom, dinamički AJAX tokovi, cross-browser i third-party integracije i dalje zahtijevaju stvarne runtime testove. Automatizirani axe test pokriva samo stanje stranice koje je učitano.

