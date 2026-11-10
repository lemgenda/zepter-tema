# WCAG 2.2 AA — izvještaj implementacije

**Repozitorij:** https://github.com/lemgenda/zepter-tema  
**Grana:** `wcag-22`  
**Polazni commit grane:** `cbf4dc79902a4b69a0db049e4af3a8f14a6926d3`  
**Datum:** 10. 11. 2026.  
**Opseg:** implementacija prioritetnih nalaza iz priloženog statičkog audita.

## Sažetak

Na grani `wcag-22` implementiran je skup ciljnih popravaka za zajednički fokusni mehanizam, globalne live-region poruke, modalne komponente, navigaciju, osnovnu validaciju kontaktne/newsletter forme i produktni zoom. Postojeće BEAE, Shine Pages, Shopify Customer Privacy i Auglio integracije nisu namjerno uklanjane.

Ovo nije potvrda WCAG 2.2 AA sukladnosti. Nisu izvršeni testovi na aktivnoj Shopify trgovini, s čitačima zaslona ili na svim breakpointima.

## Implementirane izmjene

### 1. Fokusni mehanizam — `assets/theme.js`

- `getFocusableElements()` sada izuzima disabled/hidden elemente, elemente unutar `inert` i `aria-hidden="true"` stabala, CSS `display:none` / `visibility:hidden` elemente te elemente bez layout boxa.
- Početni fokus bira vidljivi fokusabilni element; podržan je eksplicitni `[data-modal-focus]`.
- Ako modal nema fokusabilne potomke, fokusira se sam modal (dodaje se `tabindex="-1"` ako nedostaje), bez poziva `.focus()` nad `undefined`.
- Postojeći `theme.a11y` API i centralni focus-trap zadržani su; nije uveden drugi globalni trap.

### 2. Layouti i live regioni

- `layout/password.liquid`: dodani `accessibility.css`, `accessibility.js`, `#a11y-announcer` i `#a11y-alert`.
- `layout/theme.liquid`: dodani lokalizirani `data-a11y-cart-added` i `data-a11y-cart-error` atributi na `body`.
- `layout/beae.liquid`: dodani isti lokalizirani atributi na `body`; postojeći globalni accessibility asseti, live regioni i BEAE includeovi ostavljeni su na mjestu.

### 3. Dinamičke poruke i forme

- `snippets/alert.liquid`: error poruke koriste `role="alert"`; success poruke koriste `role="status"` i `aria-live="polite"`.
- `sections/contact-form.liquid`: email polje dobiva `aria-invalid="true"` i `aria-describedby` vezu s porukom pogreške kada Shopify vrati email grešku.
- `snippets/newsletter-form.liquid`: email polje dobiva `aria-invalid`, `aria-describedby` i fokus pri odgovarajućoj grešci.
- `assets/accessibility.js`: AJAX dodavanje artikla koristi lokalizirane poruke iz `body` data atributa uz postojeći fallback. Postojeći `ajaxProduct:added` / `ajaxProduct:error` događaji ostaju integracijska točka.

### 4. Navigacija i modalni prozori

- `snippets/header-drawer.liquid`: mobilni izbornik dobiva dialog semantiku, pristupačno ime i označeni nav landmark; close kontrola nije više CSS-skrivena na mobilnim breakpointima.
- `sections/header.liquid`: desktop landmarkovi koriste locale ključeve za Primary/Secondary navigaciju.
- `snippets/header-nav-desktop.liquid`: uklonjen je link ugniježđen u `summary` i uklonjen `tabindex="-1"` s funkcionalnog parent linka; disclosure i navigacijski link sada su odvojene kontrole.
- `sections/cart-drawer.liquid`, `sections/search-drawer.liquid`, `sections/help-drawer.liquid`, `sections/main-addresses.liquid`, `snippets/product-variant-picker.liquid`: close kontrole više nisu skrivene na mobilnim breakpointima.
- `sections/help-drawer.liquid`: dodan je fallback za pristupačno ime ako heading postavka nije unesena.
- `sections/cookie-banner.liquid`: ispravljen `aria-controls` close gumba s `AgeVerifier` na `CookieBanner`; dodan je stabilan naziv i modal semantika usklađena s fokusnim trapom.
- `assets/cookie-banner.js`: cookie banner sada zaključava pozadinu dok je otvoren, čime je modal semantika usklađena s postojećim fokusnim trapom.
- `sections/age-verifier.liquid`: postavljen `aria-modal="true"`, dodan stabilan naziv, uklonjena mobilna skrivenost close kontrole i označena primarna akcija s `data-modal-focus`.

### 5. Produktna galerija

- `snippets/product-media.liquid`: uklonjen je `tabindex="-1"` s funkcionalne zoom kontrole kako bi bila dostupna u redoslijedu tipkovnice.

### 6. Prijevodi

Dodani su prijevodi za nazive desktop navigacijskih landmarkova, disclosure naziv podizbornika i poruke o AJAX košarici u:
- `locales/en.default.json`
- `locales/de.json`
- `locales/es.json`
- `locales/fr.json`
- `locales/it.json`
- `locales/vi.json`

## Djelomično implementirano / potrebna dodatna provjera

- **Košarica:** dodavanje proizvoda i greška dodavanja imaju postojeće događaje i lokalizirani tekst. Uklanjanje artikla, promjena količine, cart refresh i greške iz svih alternativnih drawerova nisu povezani s jedinstvenim announcement flowom.
- **Kontakt forma:** email greška je povezana s poljem; ostala polja i custom blockovi nemaju generičko mapiranje Shopify field errora na ID poruke. Sažetak pogrešaka nije programatski fokusiran.
- **Newsletter:** greška je povezana s inputom, ali ID opisne poruke je pomoćni screen-reader element, dok se vidljivi alert zasebno renderira. Potrebna je provjera stvarnog DOM-a i čitača zaslona.
- **Cookie banner:** semantika i ponašanje su usklađeni prema postojećem focus-trap/lock obrascu, ali accept/decline/Escape i stvarna Shopify Customer Privacy API integracija zahtijevaju runtime test.
- **BEAE layout:** globalni sloj je uključen i live regije postoje. Dupli `content_for_header` i dva BEAE header toka nisu mijenjani jer audit traži potvrdu stvarnog DOM outputa prije diranja integracije.
- **Navigacija:** prijevodi i osnovna semantika su popravljeni, ali sinkronizacija `aria-expanded`, otvaranje Enter/Space/klikom i Escape kroz sve podizbornike treba testirati u browseru.
- **Modalni close gumbi:** uklonjena je mobilna skrivenost na ključnim komponentama, ali fizički touch targeti i prekrivanje fokusa nisu izmjereni.

## Nije implementirano u ovom prolazu

Sljedeće stavke iz audita nisu kompletno riješene i ostaju otvorene:

1. `snippets/header-icons.liquid` i `sections/mobile-dock.liquid`: nije promijenjena semantika cart/search linkova u gumbe jer je potrebno potvrditi stvarno ponašanje otvaranja drawera i fallback navigacije u runtimeu.
2. Potpuna standardizacija `aria-invalid`, `aria-describedby`, error ID-eva i fokusa grešaka u login, register, reset-password, activate-account, account, address, order, cart i gift-recipient formama.
3. Shine Pages cart drawer i gift-card recipient tok nisu posebno popravljeni.
4. Potpuni pregled alt tekstova za product/collection/article/promotion kartice, promo slike, cookie/age-verifier slike, media i ostale `image_tag` lokacije nije dovršen.
5. Product thumbnail nazivi, swatch state/labeli, varijantne promjene cijene/dostupnosti i screen-reader statusi nisu kompletirani.
6. Carousel/slider/video autoplay kontrola, reduced-motion, fokus i `aria-hidden` sinkronizacija nisu kompletno implementirani. Announcement bar već ima postojeću pause/play kontrolu, ali nije provjeren njen stvarni keyboard/runtime behavior.
7. Facets/filteri, pickup availability, product recommendations, recently viewed, FAQ, footer, article/blog/search/pagination i ostale datoteke iz poglavlja 9 nisu kompletno auditirane/popravljenje.
8. CSS SC 1.4.12 text-spacing override, kontrast svih stvarnih color-scheme kombinacija, target size 2.5.8 i focus-not-obscured 2.4.11 nisu potvrđeni mjerenjem.
9. BEAE quickview, newsletter popup, Auglio, hCaptcha, vanjski iframeovi, Shopify checkout i hosted customer challenge nisu testirani niti mijenjani.
10. Nisu dodani automatizirani axe-core/Lighthouse testovi niti testovi za focus trap, live announcements i Liquid render.

## Testiranje i ograničenja

- Izvršena je inspekcija izvornog koda i primjena izmjena putem GitHub API-ja.
- Nije pokrenut Shopify Theme Check, Liquid render, browser automation ni CI test suite.
- Nije izvršeno testiranje s NVDA, VoiceOver ili TalkBack.
- Nisu provjereni viewporti 320 CSS px, zoom 200%/400%, forced-colors, reduced-motion niti stvarne kontrastne vrijednosti.
- Nije testirana produkcijska trgovina ni vanjske aplikacije.

## Preporučeni sljedeći koraci

1. Pokrenuti Shopify Theme Check i validaciju svih locale JSON datoteka.
2. Testirati drawerove i fokusni trap tipkovnicom na desktopu i mobitelu, uključujući Escape i povrat fokusa.
3. Izvršiti axe-core testove na početnoj, kolekciji, proizvodu, kontaktu, FAQ-u, loginu, cartu i searchu.
4. Proći sve forme i dinamičke promjene uz NVDA/Firefox i VoiceOver/Safari.
5. Dovršiti alt tekstove, swatcheve, varijante, carousel/video, facets, account i third-party komponente.
6. Nakon popravaka ponoviti audit na aktivnom Shopify DOM-u.

**Zaključak:** ova grana sadrži implementirane ciljane popravke za temeljni fokusni mehanizam i nekoliko ključnih globalnih komponenti, ali otvoreni popis iznad mora se zatvoriti i testirati prije bilo kakve tvrdnje o WCAG 2.2 AA sukladnosti.
