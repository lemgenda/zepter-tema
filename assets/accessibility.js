
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
    motionObserver: null,

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
      this.initFormErrorFocus();
      this.initReducedMotion();
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
      const candidates = document.querySelectorAll(
        '.shopify-section-group-header-group, .shopify-section-group-header-group *, header, .header, [data-sticky-header]'
      );
      let offset = 0;

      candidates.forEach((element) => {
        const style = window.getComputedStyle(element);
        if (
          (style.position !== 'fixed' && style.position !== 'sticky') ||
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          Number(style.opacity) === 0
        ) return;

        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) return;

        // Use the lowest visible top occluder, not the sum of nested sticky elements.
        offset = Math.max(offset, rect.bottom);
      });

      return Math.max(0, Math.ceil(offset));
    },

    getBottomOffset() {
      const candidates = document.querySelectorAll(
        '.mobile-dock, [data-a11y-fixed-bottom]'
      );
      let offset = 0;

      candidates.forEach((element) => {
        const style = window.getComputedStyle(element);
        if (
          (style.position !== 'fixed' && style.position !== 'sticky') ||
          style.display === 'none' ||
          style.visibility === 'hidden'
        ) return;

        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || rect.top >= window.innerHeight || rect.bottom < window.innerHeight - 1) return;

        offset = Math.max(offset, window.innerHeight - rect.top);
      });

      return Math.max(0, Math.ceil(offset));
    },

    updateHeaderOffset() {
      const topOffset = this.getHeaderOffset();
      const bottomOffset = this.getBottomOffset();

      document.documentElement.style.setProperty('--a11y-header-offset', `${topOffset}px`);
      document.documentElement.style.setProperty('--a11y-bottom-offset', `${bottomOffset}px`);

      return { top: topOffset, bottom: bottomOffset };
    },

    initHeaderOffset() {
      if (this.headerObserver) {
        this.headerObserver.disconnect();
        this.headerObserver = null;
      }

      if (this.headerResizeHandler) {
        window.removeEventListener('resize', this.headerResizeHandler);
        window.removeEventListener('scroll', this.headerResizeHandler);
      }

      this.headerResizeHandler = () => this.updateHeaderOffset();
      this.updateHeaderOffset();

      const observeTargets = document.querySelectorAll(
        '.shopify-section-group-header-group, header, .header, .mobile-dock, [data-a11y-fixed-bottom]'
      );

      if ('ResizeObserver' in window) {
        this.headerObserver = new ResizeObserver(this.headerResizeHandler);
        observeTargets.forEach((element) => this.headerObserver.observe(element));
      }

      window.addEventListener('resize', this.headerResizeHandler, { passive: true });
      window.addEventListener('scroll', this.headerResizeHandler, { passive: true });
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
        'cart:updated',
        () => {
          const message = document.body.dataset.a11yCartUpdated || 'Your cart has been updated.';
          this.announce(message);
        }
      );

      document.addEventListener(
        'cart:error',
        () => {
          const message = document.body.dataset.a11yCartError || 'There was a problem updating your cart.';
          this.announceError(message);
        }
      );

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

    initFormErrorFocus() {
      const summaries = Array.from(document.querySelectorAll('[data-a11y-error-summary]'));
      const summary = summaries.find((element) => element.getClientRects().length > 0) ||
        summaries.find((element) => element.closest('x-modal[hidden], drawer-element[hidden], newsletter-modal[hidden], quick-view[hidden]'));

      if (!summary) return;

      const modal = summary.closest('x-modal[hidden], drawer-element[hidden], newsletter-modal[hidden], quick-view[hidden]');
      if (modal && typeof modal.show === 'function') {
        modal.show();
      }

      window.requestAnimationFrame(() => {
        summary.focus({ preventScroll: true });
        summary.scrollIntoView({ block: 'center', behavior: 'auto' });
      });
    },

    initReducedMotion() {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const applyPreference = (event) => {
        if (window.theme && window.theme.config) {
          window.theme.config.motionReduced = event.matches;
        }

        if (event.matches) {
          const disableAutoplay = (root) => {
            if (root.matches?.('slideshow-element[autoplay]')) {
              root.removeAttribute('autoplay');
              root.setAttribute('aria-live', 'polite');
              const control = document.querySelector('[is="control-button"][aria-controls="' + root.id + '"]');
              control?.setAttribute('paused', '');
              root.slider?.pausePlayer();
            }

            if (root.matches?.('video-media[autoplay]')) {
              root.removeAttribute('autoplay');
              root.pause?.();
            }

            if (root.matches?.('video[autoplay]')) {
              root.removeAttribute('autoplay');
              root.pause();
            }

            root.querySelectorAll?.('slideshow-element[autoplay], video-media[autoplay], video[autoplay]').forEach(disableAutoplay);
          };

          disableAutoplay(document.documentElement);
          if (!this.motionObserver && 'MutationObserver' in window) {
            this.motionObserver = new MutationObserver((records) => {
              records.forEach((record) => record.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) disableAutoplay(node);
              }));
            });
            this.motionObserver.observe(document.documentElement, { childList: true, subtree: true });
          }
        }
      };

      applyPreference(mediaQuery);
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', applyPreference);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(applyPreference);
      }
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
      this.initHeaderOffset();
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
