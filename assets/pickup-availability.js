if (!customElements.get('pickup-availability')) {
  customElements.define(
    'pickup-availability',
    class PickupAvailability extends HTMLElement {
      constructor() {
        super();

        if (!this.hasAttribute('available')) return;

        this.abortController = null;
        this.errorHtml = this.querySelector('template').content.firstElementChild.cloneNode(true);
        this.onClickRefreshList = this.onClickRefreshList.bind(this);
        this.fetchAvailability(this.getAttribute('data-variant-id'));
      }

      fetchAvailability(variantId) {
        if (!variantId) return;
        this.abortController?.abort();
        this.abortController = new AbortController();
        const requestController = this.abortController;
        let rootUrl = this.getAttribute('data-root-url');
        if (!rootUrl.endsWith('/')) {
          rootUrl = rootUrl + '/';
        }
        const variantSectionUrl = `${rootUrl}variants/${variantId}/?section_id=pickup-availability`;

        fetch(variantSectionUrl, { signal: requestController.signal })
          .then((response) => {
            if (!response.ok) throw new Error(`Pickup availability request failed: ${response.status}`);
            return response.text();
          })
          .then((responseText) => {
            if (requestController !== this.abortController || String(variantId) !== this.getAttribute('data-variant-id')) return;
            const sectionInnerHTML = new DOMParser()
              .parseFromString(responseText, 'text/html')
              .querySelector('.shopify-section');
            this.renderPreview(sectionInnerHTML);
          })
          .catch((error) => {
            if (error.name === 'AbortError' || requestController !== this.abortController) return;
            const button = this.querySelector('button');
            if (button) button.removeEventListener('click', this.onClickRefreshList);
            this.renderError();
          });
      }

      onClickRefreshList() {
        this.fetchAvailability(this.getAttribute('data-variant-id'));
      }

      update(variant) {
        this.abortController?.abort();
        this.setAttribute('data-variant-id', variant?.id || '');
        if (variant?.available) {
          this.removeAttribute('hidden');
          this.setAttribute('available', '');
          this.fetchAvailability(variant.id);
        }
        else {
          this.innerHTML = '';
          this.removeAttribute('available');
          this.setAttribute('hidden', '');
        }
      }

      renderError() {
        this.innerHTML = '';
        this.appendChild(this.errorHtml);

        this.querySelector('button').addEventListener('click', this.onClickRefreshList);
      }

      renderPreview(sectionInnerHTML) {
        if (!sectionInnerHTML) {
          this.renderError();
          return;
        }
        const drawer = document.querySelector('.pickup-availability-drawer');
        if (drawer) drawer.remove();
        if (!sectionInnerHTML.querySelector('.pickup-availability-preview')) {
          this.innerHTML = '';
          this.removeAttribute('available');
          this.setAttribute('hidden', '');
          return;
        }

        const preview = sectionInnerHTML.querySelector('.pickup-availability-preview');
        if (!preview) {
          this.innerHTML = '';
          this.removeAttribute('available');
          this.setAttribute('hidden', '');
          return;
        }
        this.innerHTML = preview.outerHTML;
        this.removeAttribute('hidden');
        this.setAttribute('available', '');

        document.body.appendChild(sectionInnerHTML.querySelector('.pickup-availability-drawer'));
      }
    }
  );
}
