
/* ==========================================================================
   Hyperlight Optics
   Global accessibility utilities
   Target: WCAG 2.2 Level AA

   This file provides shared accessibility utilities.

   Important:
   - Existing theme.a11y focus-trap functionality remains untouched.
   - Drawer and dialog behavior must be handled by their own components.
   - This file does not attempt to close arbitrary elements on Escape.
   ========================================================================== */

(() => {
  'use strict';

  /*
   * Prevent duplicate initialization if this asset is accidentally
   * included more than once.
   */
  if (window.HyperlightAccessibility) {
    return;
  }

  const A11y = {
    announcer: null,
    alertRegion: null,
    headerObserver: null,
    headerResizeHandler: null,

    initialized: false,

    /* ----------------------------------------------------------------------
       Initialization
       ---------------------------------------------------------------------- */

    init() {
      if (this.initialized) {
        return;
      }

      this.announcer = document.getElementById('a11y-announcer');
      this.alertRegion = document.getElementById('a11y-alert');

      this.initHeaderOffset();
      this.initLiveAnnouncements();
      this.initShopifySectionEvents();

      this.initialized = true;
    },

    /* ----------------------------------------------------------------------
       Header offset
       ---------------------------------------------------------------------- */

    getHeaderElement() {
      /*
       * Shopify themes commonly render header sections inside
       * .shopify-section-group-header-group.
       *
       * Prefer the actual header element when available.
       * Fall back to the first header-group section.
       */
      return (
        document.querySelector(
          '.shopify-section-group-header-group .header'
        ) ||
        document.querySelector(
          '.shopify-section-group-header-group header'
        ) ||
        document.querySelector(
          '.shopify-section-group-header-group'
        )
      );
    },

    getHeaderOffset() {
      const header = this.getHeaderElement();

      if (!header) {
        return 0;
      }

      const rect = header.getBoundingClientRect();

      return Math.max(0, Math.ceil(rect.height));
    },

    updateHeaderOffset() {
      const offset = this.getHeaderOffset();

      document.documentElement.style.setProperty(
        '--a11y-header-offset',
        `${offset}px`
      );

      return offset;
    },

    initHeaderOffset() {
      this.updateHeaderOffset();

      const header = this.getHeaderElement();

      if (!header) {
        return;
      }

      /*
       * ResizeObserver updates the offset when the header changes
       * height because of responsive layout, announcement bars,
       * or other layout changes.
       */
      if ('ResizeObserver' in window) {
        this.headerObserver = new ResizeObserver(() => {
          this.updateHeaderOffset();
        });

        this.headerObserver.observe(header);
      } else {
        this.headerResizeHandler = () => {
          this.updateHeaderOffset();
        };

        window.addEventListener(
          'resize',
          this.headerResizeHandler,
          { passive: true }
        );
      }
    },

    /* ----------------------------------------------------------------------
       Live announcements
       ---------------------------------------------------------------------- */

    announce(message) {
      this.writeAnnouncement(message, false);
    },

    announceError(message) {
      this.writeAnnouncement(message, true);
    },

    writeAnnouncement(message, urgent = false) {
      const text = String(message || '').trim();

      if (!text) {
        return;
      }

      /*
       * Reacquire the regions if they were not available at
       * initialization time.
       */
      if (!this.announcer) {
        this.announcer = document.getElementById(
          'a11y-announcer'
        );
      }

      if (!this.alertRegion) {
        this.alertRegion = document.getElementById(
          'a11y-alert'
        );
      }

      const region = urgent
        ? this.alertRegion
        : this.announcer;

      if (!region) {
        return;
      }

      /*
       * Clearing first allows assistive technology to announce
       * the same message again when it occurs more than once.
       */
      region.textContent = '';

      window.requestAnimationFrame(() => {
        region.textContent = text;
      });
    },

    initLiveAnnouncements() {
      /*
       * Custom event API:
       *
       * document.dispatchEvent(
       *   new CustomEvent('a11y:announce', {
       *     detail: {
       *       message: 'Your message',
       *       urgent: false
       *     }
       *   })
       * );
       */
      document.addEventListener(
        'a11y:announce',
        (event) => {
          const detail = event.detail || {};

          if (!detail.message) {
            return;
          }

          if (detail.urgent === true) {
            this.announceError(detail.message);
          } else {
            this.announce(detail.message);
          }
        }
      );

      /*
       * Existing theme event emitted after a successful
       * AJAX product add operation.
       */
      document.addEventListener(
        'ajaxProduct:added',
        () => {
          const message = document.body.dataset.a11yCartAdded || 'Product added to cart.';
          this.announce(message);
        }
      );

      /*
       * Existing theme event emitted when adding a product fails.
       */
      document.addEventListener(
        'ajaxProduct:error',
        (event) => {
          const message =
            event.detail &&
            event.detail.errorMessage
              ? event.detail.errorMessage
              : (document.body.dataset.a11yCartError || 'There was a problem adding this product to your cart.');

          this.announceError(message);
        }
      );
    },

    /* ----------------------------------------------------------------------
       Shopify theme section events
       ---------------------------------------------------------------------- */

    initShopifySectionEvents() {
      /*
       * Shopify can dynamically reload sections in the theme editor.
       * Recalculate the header offset after section changes.
       */

      document.addEventListener(
        'shopify:section:load',
        () => {
          this.refreshHeaderObserver();
        }
      );

      document.addEventListener(
        'shopify:section:reorder',
        () => {
          this.refreshHeaderObserver();
        }
      );

      document.addEventListener(
        'shopify:section:unload',
        () => {
          this.refreshHeaderObserver();
        }
      );
    },

    refreshHeaderObserver() {
      if (this.headerObserver) {
        this.headerObserver.disconnect();
        this.headerObserver = null;
      }

      this.updateHeaderOffset();

      const header = this.getHeaderElement();

      if (
        header &&
        'ResizeObserver' in window
      ) {
        this.headerObserver = new ResizeObserver(() => {
          this.updateHeaderOffset();
        });

        this.headerObserver.observe(header);
      }
    },

    /* ----------------------------------------------------------------------
       Public helper for other theme components
       ---------------------------------------------------------------------- */

    dispatchAnnouncement(message, urgent = false) {
      document.dispatchEvent(
        new CustomEvent('a11y:announce', {
          detail: {
            message: message,
            urgent: urgent
          }
        })
      );
    }
  };

  /*
   * Expose the API for other theme scripts and custom components.
   *
   * Example:
   * window.HyperlightAccessibility.announce('Cart updated.');
   *
   * Example:
   * window.HyperlightAccessibility.announceError(
   *   'Please correct the highlighted fields.'
   * );
   */
  window.HyperlightAccessibility = A11y;

  /* ------------------------------------------------------------------------
     DOM initialization
     ------------------------------------------------------------------------ */

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        A11y.init();
      },
      { once: true }
    );
  } else {
    A11y.init();
  }
})();
