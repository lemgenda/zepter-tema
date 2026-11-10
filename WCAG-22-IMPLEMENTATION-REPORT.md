# WCAG 2.2 AA — izvještaj implementacije i provjere

**Repozitorij:** https://github.com/lemgenda/zepter-tema  
**Grana:** `wcag-22`  
**Datum ažuriranja:** 10. 11. 2026.  
**Opseg:** popravci otvorenih stavki iz prethodne verzije izvještaja i dodavanje testnog workflowa.

## Sažetak

U ovom prolazu zatvoren je dodatni dio nedovršenih stavki: customer forme, adrese, newsletter i gift-card recipient validacija, najave promjena košarice, shipping calculator statusi, mobilne close kontrole, alternativni tekstovi ključnih storefront slika, reduced-motion ponašanje, osnovna semantika slideshowa, live najave odabira varijante i broja filtera te statički/browser testni workflow.

**Važno:** potpuna WCAG 2.2 AA sukladnost još nije potvrđena. U ovom okruženju nije dostupan aktivni Shopify preview URL ni browser session za stvarno testiranje storefront DOM-a. GitHub Actions workflow je dodan, ali za zadnji commit nisu pronađeni izvršeni workflow runovi. Browser smoke testovi zato nisu označeni kao prošli.

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
- `snippets/facets-drawer.liquid`: dinamički broj filtera koristi status live region.

### 6. CSS osnove

- `assets/accessibility.css`: common button controls imaju minimalnu inline/block veličinu od 24 CSS px. Ovo je minimalni prag za kontrole, ne zamjena za pregled svih stvarnih targeta i iznimaka u kontekstu.

### 7. Testna infrastruktura

Dodani su:
- `.github/workflows/wcag-22.yml`: na push/pull request prema `wcag-22` pokreće Shopify Theme Check i JSON parse validaciju; manual `workflow_dispatch` s preview URL-om pokreće browser test.
- `scripts/wcag-a11y-smoke.mjs`: Playwright + axe-core smoke test za desktop, 375 px i 320 px širine, uključujući WCAG axe pravila, prvi keyboard focus indikator, tekstualni spacing override, forced-colors/reduced-motion i popis malih interaktivnih targeta za ručni pregled.

### 8. Validacije izvršene u ovom prolazu

- JSON datoteke `locales/en.default.json`, `de.json`, `es.json`, `fr.json`, `it.json` i `vi.json` uspješno su parsirane.
- U svih šest locale datoteka potvrđeno je postojanje navigacijskih prijevoda i tri cart announcement ključa.
- Statički su pregledani relevantni Liquid/JS/CSS dijelovi i potvrđene su promjene na grani.
- **Nisu izvršeni** Shopify Theme Check, axe-core browser run, Playwright run, Liquid render, stvarni storefront test ili test s čitačem zaslona. Za zadnji commit nisu pronađeni GitHub Actions workflow runovi.

## Preostale stavke / nije moguće potvrditi bez preview trgovine

1. **Stvarni browser audit:** pokrenuti `workflow_dispatch` s javno dostupnim Shopify preview URL-om i putanjama koje uključuju stvarne product, collection, FAQ, contact, login, account, cart i search stranice. Trenutni smoke test defaultno provjerava home, all collections, cart i search.
2. **Shopify Theme Check:** workflow je pripremljen, ali rezultat nije dostupan jer workflow nije izvršen. Liquid parser i Theme Check status stoga ostaju nepotvrđeni.
3. **Ručni assistive technology testovi:** NVDA/Firefox, VoiceOver/Safari i TalkBack/Chrome nisu testirani. Potrebno je provjeriti redoslijed fokusa, izgovor, povrat fokusa, modal Escape/close i dinamičke najave.
4. **Kontrast i theme schemes:** stvarne kombinacije foreground/background boja za sve merchant color schemes, overlaye, hover/focus/disabled stanja i button varijante nisu izmjerene.
5. **Zoom/reflow:** 320 px reflow i tekstualni spacing override su u test harnessu; stvarni browser zoom 200%/400% i sadržaj na 320 CSS px još nisu testirani na storefrontu.
6. **Target size 2.5.8:** skripta izlistava kontrole manje od 24 × 24 px; svaku stavku treba ručno provjeriti zbog WCAG iznimaka (inline, ekvivalentna kontrola, spacing i user-agent kontrola).
7. **Product variant i pickup flow:** odabrana vrijednost varijante se najavljuje, ali cijena, dostupnost, SKU, inventory i pickup availability nakon AJAX promjene nisu ujednačeno najavljeni.
8. **Facets/filteri:** count live region je dodan, ali stvarni rezultat nakon AJAX filtriranja, fokusni povratak, URL/history i kombinacije checkbox/swatch filtera trebaju browser test.
9. **Product recommendations/recently viewed:** carousel keyboard operabilnost, aktivni slide state i dinamički sadržaj nisu kompletno popravljeni ni testirani.
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
