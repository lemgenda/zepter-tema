
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
    recipientObserver: null,
    iframeObserver: null,
    announcementObserver: null,
    externalLinkObserver: null,

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
      this.initShineRecipientForms();
      this.initEmbeddedFrameTitles();
      this.initAnnouncementSlideInert();
      this.initAccessibleExternalLinks();
      this.initThirdPartySkipFocus();
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
          style.visibility === 'hidden' ||
          Number(style.opacity) === 0
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

    initEmbeddedFrameTitles() {
      const labelFrame = (frame) => {
        if (frame.hasAttribute('title') && frame.getAttribute('title').trim()) return;

        const media = frame.closest('video-media, model-media');
        if (!media) return;

        const label = media.getAttribute('aria-label') ||
          media.querySelector('img[alt]')?.getAttribute('alt') ||
          document.title;

        if (label && label.trim()) {
          frame.setAttribute('title', label.trim());
        }
      };

      document.querySelectorAll('video-media iframe, model-media iframe').forEach(labelFrame);

      if (!this.iframeObserver && 'MutationObserver' in window) {
        this.iframeObserver = new MutationObserver((records) => {
          records.forEach((record) => record.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.matches('iframe')) labelFrame(node);
            node.querySelectorAll?.('iframe').forEach(labelFrame);
          }));
        });
        this.iframeObserver.observe(document.body, { childList: true, subtree: true });
      }
    },

    initShineRecipientForms() {
      const initialize = (form) => {
        if (form.dataset.a11yRecipientInitialized === 'true') return;

        const checkbox = form.querySelector('input[type="checkbox"][id^="sp-recipient-checkbox-"]');
        const fields = form.querySelector('.sp-recipient-fields');
        const email = form.querySelector('input[type="email"]');
        if (!checkbox || !fields) return;

        if (!fields.id) {
          fields.id = 'sp-recipient-fields-' + (form.getAttribute('data-section-id') || 'section');
        }

        const syncDisclosure = () => {
          const expanded = checkbox.checked;
          checkbox.setAttribute('aria-expanded', String(expanded));
          checkbox.setAttribute('aria-controls', fields.id);
          if (email) email.required = expanded;
        };

        checkbox.addEventListener('change', syncDisclosure);
        syncDisclosure();
        form.dataset.a11yRecipientInitialized = 'true';
      };

      document.querySelectorAll('sp-recipient-form').forEach(initialize);

      if (!this.recipientObserver && 'MutationObserver' in window) {
        this.recipientObserver = new MutationObserver((records) => {
          records.forEach((record) => record.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.matches('sp-recipient-form')) initialize(node);
            node.querySelectorAll?.('sp-recipient-form').forEach(initialize);
          }));
        });
        this.recipientObserver.observe(document.body, { childList: true, subtree: true });
      }
    },


    initAnnouncementSlideInert() {
      const focusableSelector = 'a[href], area[href], button, input, select, textarea, iframe, audio[controls], video[controls], [tabindex]';
      const syncSlide = (slide) => {
        if (!slide.matches('.announcement__slide')) return;
        const hidden = slide.getAttribute('aria-hidden') === 'true';

        if (hidden) {
          slide.setAttribute('inert', '');
          slide.querySelectorAll(focusableSelector).forEach((item) => {
            if (!item.hasAttribute('data-a11y-original-tabindex')) {
              const original = item.getAttribute('tabindex');
              item.setAttribute('data-a11y-original-tabindex', original === null ? '__a11y_none__' : original);
            }
            item.setAttribute('tabindex', '-1');
          });
          return;
        }

        slide.removeAttribute('inert');
        slide.querySelectorAll('[data-a11y-original-tabindex]').forEach((item) => {
          const original = item.getAttribute('data-a11y-original-tabindex');
          if (original === '__a11y_none__') item.removeAttribute('tabindex');
          else item.setAttribute('tabindex', original);
          item.removeAttribute('data-a11y-original-tabindex');
        });
      };

      document.querySelectorAll('.announcement__slide').forEach(syncSlide);
      if (this.announcementObserver || !('MutationObserver' in window)) return;

      this.announcementObserver = new MutationObserver((records) => {
        records.forEach((record) => {
          if (record.type === 'attributes') {
            syncSlide(record.target);
            return;
          }

          const parentSlide = record.target.nodeType === Node.ELEMENT_NODE
            ? record.target.closest('.announcement__slide')
            : record.target.parentElement?.closest('.announcement__slide');
          if (parentSlide) syncSlide(parentSlide);

          record.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.matches('.announcement__slide')) syncSlide(node);
            node.querySelectorAll?.('.announcement__slide').forEach(syncSlide);
          });
        });
      });

      this.announcementObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['aria-hidden']
      });
    },

    initAccessibleExternalLinks() {
      const selector = 'a[rel~="nofollow"][target="_blank"]';
      const labelLink = (link) => {
        const ariaLabel = link.getAttribute('aria-label')?.trim();
        const labelledBy = (link.getAttribute('aria-labelledby') || '')
          .split(/\\s+/)
          .filter(Boolean)
          .some((id) => document.getElementById(id)?.textContent.trim());
        const descendantName = link.querySelector(
          'img[alt]:not([alt=""]), svg[aria-label]:not([aria-label=""]), [aria-label]:not([aria-label=""]), [title]:not([title=""])'
        );

        if (ariaLabel || labelledBy || link.textContent.trim() || descendantName || link.title.trim()) return;

        try {
          const host = new URL(link.href, window.location.href).hostname.replace(/^www\\./, '');
          link.setAttribute('aria-label', 'Visit ' + host + ' (opens in a new tab)');
        } catch (error) {
          link.setAttribute('aria-label', 'Open external link in a new tab');
        }
      };

      document.querySelectorAll(selector).forEach(labelLink);
      if (this.externalLinkObserver || !('MutationObserver' in window)) return;

      this.externalLinkObserver = new MutationObserver((records) => {
        records.forEach((record) => {
          const parentLink = record.target.nodeType === Node.ELEMENT_NODE
            ? record.target.closest(selector)
            : record.target.parentElement?.closest(selector);
          if (parentLink) labelLink(parentLink);

          record.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.matches(selector)) labelLink(node);
            node.querySelectorAll?.(selector).forEach(labelLink);
          });
        });
      });
      this.externalLinkObserver.observe(document.body, { childList: true, subtree: true });
    },

    initThirdPartySkipFocus() {
      const selectors = '#uw-skip-to-main, .uw-sl__item';
      const styledRoots = new WeakSet();

      const applyFocusIndicator = (element) => {
        if (!element || !element.matches?.(selectors)) return;
        element.style.setProperty('outline', '4px solid #000', 'important');
        element.style.setProperty('outline-offset', '4px', 'important');
        element.style.setProperty('border', '3px solid #fff', 'important');
        element.style.setProperty('box-shadow', '0 0 0 7px #000', 'important');
        element.style.setProperty('background', '#fff', 'important');
        element.style.setProperty('color', '#000', 'important');
      };

      const attachRoot = (root) => {
        if (!root || styledRoots.has(root)) return;
        styledRoots.add(root);

        if (root instanceof ShadowRoot) {
          const style = document.createElement('style');
          style.textContent = `
            #uw-skip-to-main:focus,
            #uw-skip-to-main:focus-visible,
            .uw-sl__item:focus,
            .uw-sl__item:focus-visible {
              outline: 4px solid #000 !important;
              outline-offset: 4px !important;
              border: 3px solid #fff !important;
              box-shadow: 0 0 0 7px #000 !important;
              background: #fff !important;
              color: #000 !important;
            }
            @media (forced-colors: active) {
              #uw-skip-to-main:focus,
              #uw-skip-to-main:focus-visible,
              .uw-sl__item:focus,
              .uw-sl__item:focus-visible {
                outline: 3px solid Highlight !important;
                outline-offset: 3px !important;
                border: 2px solid Canvas !important;
                box-shadow: 0 0 0 5px Highlight !important;
                background: Canvas !important;
                color: CanvasText !important;
              }
            }
          `;
          root.appendChild(style);
        }

        root.addEventListener('focusin', (event) => applyFocusIndicator(event.target), true);
        root.querySelectorAll?.('*').forEach((element) => {
          if (element.shadowRoot) attachRoot(element.shadowRoot);
        });
      };

      attachRoot(document);
      document.addEventListener('focusin', (event) => applyFocusIndicator(event.target), true);

      if ('MutationObserver' in window) {
        const observer = new MutationObserver((records) => {
          records.forEach((record) => record.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.shadowRoot) attachRoot(node.shadowRoot);
            node.querySelectorAll?.('*').forEach((element) => {
              if (element.shadowRoot) attachRoot(element.shadowRoot);
            });
            if (node.matches?.(selectors)) applyFocusIndicator(node);
            node.querySelectorAll?.(selectors).forEach(applyFocusIndicator);
          }));
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
    },

    initReducedMotion() {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const applyPreference = (event) => {
        if (window.theme && window.theme.config) {
          window.theme.config.motionReduced = event.matches;
        }

        if (event.matches) {
          const disableAutoplay = (root) => {
            if (root.matches?.('announcement-bar[autoplay]')) {
              root.removeAttribute('autoplay');
              root.setAttribute('aria-live', 'polite');
              const control = document.querySelector('[is="control-button"][aria-controls="' + root.id + '"]');
              control?.setAttribute('paused', '');
              root.slider?.pausePlayer();
              root.pause?.();
              root.pause?.();
            }

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

            root.querySelectorAll?.('announcement-bar[autoplay], slideshow-element[autoplay], video-media[autoplay], video[autoplay]').forEach(disableAutoplay);
          };

          disableAutoplay(document.documentElement);
          if (!this.motionObserver && 'MutationObserver' in window) {
            this.motionObserver = new MutationObserver((records) => {
              records.forEach((record) => {
                if (record.type === 'attributes' && record.target.nodeType === Node.ELEMENT_NODE) disableAutoplay(record.target);
                record.addedNodes.forEach((node) => {
                  if (node.nodeType === Node.ELEMENT_NODE) disableAutoplay(node);
                });
              });
            });
            this.motionObserver.observe(document.documentElement, {
              childList: true, subtree: true, attributes: true, attributeFilter: ['autoplay']
            });
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
