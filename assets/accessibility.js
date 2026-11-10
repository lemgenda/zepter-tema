
/* ==========================================================
   Hyperlight Optics - WCAG 2.2 AA
   Global accessibility utilities
   ========================================================== */

(() => {
  'use strict';

  if (window.HyperlightAccessibility) return;

  const A11y = {
    announcer: null,
    alertRegion: null,

    init() {
      this.announcer = document.getElementById('a11y-announcer');
      this.alertRegion = document.getElementById('a11y-alert');

      this.initHeaderOffset();
      this.initFocusVisibility();
      this.initLiveAnnouncements();
      this.initKeyboardEscape();
      this.initHiddenContent();
    },

    initHeaderOffset() {
      const header = document.querySelector(
        '.header-section .header'
      );

      if (!header) return;

      const update = () => {
        const rect = header.getBoundingClientRect();

        document.documentElement.style.setProperty(
          '--a11y-header-offset',
          `${Math.ceil(rect.height)}px`
        );
      };

      update();

      if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(update);
        observer.observe(header);
      } else {
        window.addEventListener('resize', update);
      }
    },

    initFocusVisibility() {
      document.addEventListener('focusin', (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) return;

        if (
          target.matches(
            'a, button, input, select, textarea, summary, ' +
            '[tabindex]:not([tabindex="-1"])'
          )
        ) {
          requestAnimationFrame(() => {
            const rect = target.getBoundingClientRect();

            const headerHeight = parseFloat(
              getComputedStyle(document.documentElement)
                .getPropertyValue('--a11y-header-offset')
            ) || 0;

            if (
              rect.top < headerHeight ||
              rect.bottom > window.innerHeight
            ) {
              target.scrollIntoView({
                block: 'nearest',
                inline: 'nearest',
                behavior: window.matchMedia(
                  '(prefers-reduced-motion: reduce)'
                ).matches ? 'instant' : 'smooth'
              });
            }
          });
        }
      });
    },

    announce(message, urgent = false) {
      const region = urgent
        ? this.alertRegion
        : this.announcer;

      if (!region || !message) return;

      region.textContent = '';

      requestAnimationFrame(() => {
        region.textContent = message;
      });
    },

    initLiveAnnouncements() {
      document.addEventListener(
        'ajaxProduct:added',
        () => {
          this.announce(
            'Product added to cart.'
          );
        }
      );

      document.addEventListener(
        'cart:updated',
        () => {
          const count = document.querySelector(
            'cart-count:not([hidden])'
          );

          if (count) {
            this.announce(
              `Cart updated. ${count.textContent.trim()} items.`
            );
          }
        }
      );
    },

    initKeyboardEscape() {
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;

        const openDialog = document.querySelector(
          'dialog[open]'
        );

        if (openDialog) {
          openDialog.close();
          return;
        }

        const activeDrawer = document.querySelector(
          'menu-drawer:not([hidden]), ' +
          'cart-drawer:not([hidden])'
        );

        if (!activeDrawer) return;

        const closeButton = activeDrawer.querySelector(
          '[aria-label], [aria-controls]'
        );

        if (closeButton) closeButton.click();
      });
    },

    initHiddenContent() {
      // Native hidden, display:none and inert states should
      // remain the responsibility of the theme components.
      // Never blanket-apply aria-hidden to responsive menus.
      document.querySelectorAll('[aria-hidden="true"]')
        .forEach((element) => {
          if (
            element.contains(document.activeElement) &&
            document.activeElement !== document.body
          ) {
            element.removeAttribute('aria-hidden');
          }
        });
    }
  };

  window.HyperlightAccessibility = A11y;

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => A11y.init(),
      { once: true }
    );
  } else {
    A11y.init();
  }
})();
