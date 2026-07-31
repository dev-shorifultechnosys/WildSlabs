/**
 * WildSlabs front-end interactions
 * ---------------------------------------------------------------
 * Vanilla JavaScript only. The code is intentionally modular so a
 * future WordPress developer can map each feature to WooCommerce,
 * ACF or an enquiry plugin without unpicking a framework.
 */

document.documentElement.classList.add("js");

(() => {
  "use strict";

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------
     Header and mobile navigation
     ------------------------------------------------------------ */
  const header = $("[data-header]");
  const menuButton = $("[data-menu-button]");
  const mobileMenu = $("[data-mobile-menu]");

  const setMenu = (open) => {
    menuButton.setAttribute("aria-expanded", String(open));
    mobileMenu.setAttribute("aria-hidden", String(!open));
    mobileMenu.classList.toggle("is-open", open);
    document.body.classList.toggle("is-locked", open);
    document.body.classList.toggle("is-menu-open", open);
    $(".sr-only", menuButton).textContent = open ? "Close menu" : "Open menu";
  };

  menuButton.addEventListener("click", () => {
    setMenu(menuButton.getAttribute("aria-expanded") !== "true");
  });

  $$("a", mobileMenu).forEach((link) => link.addEventListener("click", () => setMenu(false)));

  window.addEventListener("scroll", () => {
    header.classList.toggle("is-scrolled", window.scrollY > 45);
  }, { passive: true });

  /* ------------------------------------------------------------
     Automatic hero showcase
     Displays complete featured artwork with a slow gallery transition.
     Auto-play can be paused and every slide remains keyboard accessible.
     ------------------------------------------------------------ */
  const heroShowcase = $("[data-hero-showcase]");
  if (heroShowcase) {
    const slides = $$("[data-hero-slide]", heroShowcase);
    const current = $("[data-hero-current]", heroShowcase);
    const caption = $("[data-hero-caption]") || $("[data-hero-caption]", heroShowcase.closest("figure"));
    const toggle = $("[data-hero-toggle]", heroShowcase);
    const next = $("[data-hero-next]", heroShowcase);
    const progress = $("[data-hero-progress]", heroShowcase);
    const names = ["Signal Study No. 01", "Field Lines No. 03", "Signal Static"];
    const interval = 4800;
    let activeIndex = 0;
    let playing = !reducedMotion;
    let timer = 0;

    const updateHeroToggle = () => {
      toggle.setAttribute("aria-pressed", String(playing));
      toggle.firstChild.textContent = playing ? "Pause " : "Play ";
      heroShowcase.classList.toggle("is-paused", !playing);
    };

    const showHeroSlide = (index) => {
      activeIndex = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        const isActive = slideIndex === activeIndex;
        slide.classList.toggle("is-active", isActive);
        slide.setAttribute("aria-hidden", String(!isActive));
      });
      current.textContent = String(activeIndex + 1).padStart(2, "0");
      caption.textContent = names[activeIndex];
      progress.classList.remove("is-running");
      // Restart the progress animation only after the browser has registered its reset.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (playing) progress.classList.add("is-running");
      }));
    };

    const queueHeroSlide = () => {
      window.clearTimeout(timer);
      if (!playing) return;
      timer = window.setTimeout(() => {
        showHeroSlide(activeIndex + 1);
        queueHeroSlide();
      }, interval);
    };

    toggle.addEventListener("click", () => {
      playing = !playing;
      updateHeroToggle();
      showHeroSlide(activeIndex);
      queueHeroSlide();
    });

    next.addEventListener("click", () => {
      showHeroSlide(activeIndex + 1);
      queueHeroSlide();
    });

    heroShowcase.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      showHeroSlide(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
      queueHeroSlide();
    });

    updateHeroToggle();
    showHeroSlide(0);
    queueHeroSlide();
  }

  /* ------------------------------------------------------------
     Pointer-led object viewing
     This lightweight perspective effect supports homepage browsing.
     Dedicated product pages provide the full six-face 360° model.
     ------------------------------------------------------------ */
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (!reducedMotion && finePointer) {
    $$('[data-tilt]').forEach((item) => {
      const strength = Number(item.dataset.tiltStrength || 4);

      item.addEventListener("pointermove", (event) => {
        const bounds = item.getBoundingClientRect();
        const positionX = (event.clientX - bounds.left) / bounds.width;
        const positionY = (event.clientY - bounds.top) / bounds.height;

        item.style.setProperty("--tilt-x", `${(0.5 - positionY) * strength}deg`);
        item.style.setProperty("--tilt-y", `${(positionX - 0.5) * strength}deg`);
        item.style.setProperty("--glare-x", `${positionX * 100}%`);
        item.style.setProperty("--glare-y", `${positionY * 100}%`);
        item.classList.add("is-tilting");
      });

      item.addEventListener("pointerleave", () => {
        item.style.setProperty("--tilt-x", "0deg");
        item.style.setProperty("--tilt-y", "0deg");
        item.style.setProperty("--glare-x", "50%");
        item.style.setProperty("--glare-y", "50%");
        item.classList.remove("is-tilting");
      });
    });

  }

  /* ------------------------------------------------------------
     Homepage automatic 360° product viewer
     Rotation starts immediately, remains visible in the current-release
     section and supports mouse, touch and keyboard interaction.
     ------------------------------------------------------------ */
  const homeViewer = $("[data-home-360]");
  if (homeViewer) {
    const model = $("[data-home-slab-model]", homeViewer);
    const toggle = $("[data-home360-toggle]", homeViewer);
    let rotationX = -4;
    let rotationY = -18;
    let autoRotate = !reducedMotion;
    let resumeAfterDrag = autoRotate;
    let viewerInView = true;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastTime = performance.now();

    const paintHomeViewer = () => {
      const normalized = ((rotationY % 360) + 360) % 360;
      model.style.transform = `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`;
      model.classList.toggle("is-back-view", normalized > 90 && normalized < 270);
      homeViewer.setAttribute("aria-valuenow", String(Math.round(normalized)));
    };

    const animateHomeViewer = (time) => {
      if (autoRotate && !dragging && viewerInView && !document.hidden) {
        rotationY += (time - lastTime) * .036;
        paintHomeViewer();
      }
      lastTime = time;
      requestAnimationFrame(animateHomeViewer);
    };

    const updateToggle = () => {
      toggle.setAttribute("aria-pressed", String(autoRotate));
      toggle.firstChild.textContent = autoRotate ? "Pause " : "Auto rotate ";
    };

    homeViewer.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button, a")) return;
      resumeAfterDrag = autoRotate;
      autoRotate = false;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      homeViewer.setPointerCapture(event.pointerId);
    });

    homeViewer.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      rotationY += (event.clientX - lastX) * .6;
      rotationX = Math.max(-25, Math.min(25, rotationX - (event.clientY - lastY) * .2));
      lastX = event.clientX;
      lastY = event.clientY;
      paintHomeViewer();
    });

    const finishHomeDrag = () => {
      if (!dragging) return;
      dragging = false;
      autoRotate = resumeAfterDrag;
      lastTime = performance.now();
      updateToggle();
    };
    homeViewer.addEventListener("pointerup", finishHomeDrag);
    homeViewer.addEventListener("pointercancel", finishHomeDrag);

    homeViewer.addEventListener("keydown", (event) => {
      if (!event.key.startsWith("Arrow")) return;
      event.preventDefault();
      autoRotate = false;
      if (event.key === "ArrowLeft") rotationY -= 10;
      if (event.key === "ArrowRight") rotationY += 10;
      if (event.key === "ArrowUp") rotationX = Math.max(-25, rotationX - 5);
      if (event.key === "ArrowDown") rotationX = Math.min(25, rotationX + 5);
      paintHomeViewer();
      updateToggle();
    });

    toggle.addEventListener("click", () => {
      autoRotate = !autoRotate;
      lastTime = performance.now();
      updateToggle();
    });

    if ("IntersectionObserver" in window) {
      const homeViewerObserver = new IntersectionObserver(([entry]) => {
        viewerInView = entry.isIntersecting;
        lastTime = performance.now();
      }, { threshold: 0.05 });
      homeViewerObserver.observe(homeViewer);
    }

    updateToggle();
    paintHomeViewer();
    requestAnimationFrame(animateHomeViewer);
  }

  /* ------------------------------------------------------------
     Scroll reveal
     Content is visible by default when JS or IntersectionObserver
     is unavailable, preserving progressive enhancement.
     ------------------------------------------------------------ */
  const reveals = $$(".reveal");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((item) => item.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6%" });

    reveals.forEach((item) => revealObserver.observe(item));
  }

  /* ------------------------------------------------------------
     Product filtering
     ------------------------------------------------------------ */
  const filters = $$("[data-filter]");
  const productCards = $$("[data-category]");

  const filterProducts = (category) => {
    filters.forEach((filter) => {
      const active = filter.dataset.filter === category;
      filter.classList.toggle("is-active", active);
      filter.setAttribute("aria-pressed", String(active));
    });

    productCards.forEach((card) => {
      const visible = category === "all" || card.dataset.category === category;
      card.classList.toggle("is-hidden", !visible);
    });
  };

  filters.forEach((filter) => filter.addEventListener("click", () => filterProducts(filter.dataset.filter)));

  // Featured collection cards jump to the correctly filtered viewing room.
  $$('[data-filter-jump]').forEach((button) => {
    button.addEventListener("click", () => {
      filterProducts(button.dataset.filterJump);
      $("#archive").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    });
  });

  /* ------------------------------------------------------------
     Shared overlay and body-lock helpers
     ------------------------------------------------------------ */
  const overlay = $("[data-overlay]");
  const cartDrawer = $("[data-cart-drawer]");

  const setOverlay = (visible) => {
    overlay.classList.toggle("is-visible", visible);
    document.body.classList.toggle("is-locked", visible);
  };

  const closeCart = () => {
    cartDrawer.classList.remove("is-open");
    cartDrawer.setAttribute("aria-hidden", "true");
    setOverlay(false);
  };

  const openCart = () => {
    setMenu(false);
    cartDrawer.classList.add("is-open");
    cartDrawer.setAttribute("aria-hidden", "false");
    setOverlay(true);
    $("[data-close-cart]").focus();
  };

  $$('[data-open-cart]').forEach((button) => button.addEventListener("click", openCart));
  $$('[data-close-cart]').forEach((button) => button.addEventListener("click", closeCart));
  overlay.addEventListener("click", closeCart);

  /* ------------------------------------------------------------
     Demo cart
     Replace these localStorage calls with WooCommerce AJAX when
     the design is converted to WordPress.
     ------------------------------------------------------------ */
  const CART_KEY = "wildslabs-demo-cart";
  const cartItemsContainer = $("[data-cart-items]");
  const emptyCart = $("[data-empty-cart]");
  const cartSummary = $("[data-cart-summary]");
  const cartTotal = $("[data-cart-total]");
  const cartCounts = $$("[data-cart-count]");

  const readCart = () => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      return [];
    }
  };

  let cart = readCart();

  const money = (amount) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);

  const writeCart = () => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
  };

  const renderCart = () => {
    cartItemsContainer.replaceChildren();

    cart.forEach((product) => {
      const item = document.createElement("article");
      item.className = "cart-item";
      item.innerHTML = `
        <img src="${product.image}" alt="">
        <div><h3>${product.name}</h3><p>Qty. ${product.quantity} / ${money(product.price)}</p></div>
        <button type="button" data-remove-item="${product.id}">Remove</button>
      `;
      cartItemsContainer.append(item);
    });

    const count = cart.reduce((sum, product) => sum + product.quantity, 0);
    const total = cart.reduce((sum, product) => sum + product.price * product.quantity, 0);

    cartCounts.forEach((item) => { item.textContent = count; });
    cartTotal.textContent = money(total);
    emptyCart.hidden = cart.length > 0;
    cartSummary.hidden = cart.length === 0;

    $$('[data-remove-item]', cartItemsContainer).forEach((button) => {
      button.addEventListener("click", () => {
        cart = cart.filter((product) => product.id !== button.dataset.removeItem);
        writeCart();
      });
    });
  };

  const addToCart = ({ id, name, price, image }) => {
    const existing = cart.find((product) => product.id === id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ id, name, price: Number(price), image, quantity: 1 });
    }
    writeCart();
    openCart();
  };

  $$('[data-add-product]').forEach((button) => {
    button.addEventListener("click", () => addToCart(button.dataset));
  });

  $("[data-checkout]").addEventListener("click", () => {
    window.location.href = "checkout.html";
  });

  renderCart();

  /* ------------------------------------------------------------
     Product quick view
     ------------------------------------------------------------ */
  const quickDialog = $("[data-quick-dialog]");
  const quickImage = $("[data-quick-image]");
  const quickName = $("[data-quick-name]");
  const quickEdition = $("[data-quick-edition]");
  const quickPrice = $("[data-quick-price]");
  const quickAdd = $("[data-quick-add]");
  const quickPage = $("[data-quick-page]");
  let activeProduct = null;

  $$('[data-quick-view]').forEach((button) => {
    button.addEventListener("click", () => {
      activeProduct = button.dataset;
      quickImage.src = activeProduct.image;
      quickImage.alt = `${activeProduct.name} collectible`;
      quickName.textContent = activeProduct.name;
      quickEdition.textContent = activeProduct.edition;
      quickPrice.textContent = money(Number(activeProduct.price));
      quickPage.href = `product.html?id=${activeProduct.id}`;
      quickDialog.showModal();
      $("[data-close-quick]").focus();
    });
  });

  $("[data-close-quick]").addEventListener("click", () => quickDialog.close());
  quickDialog.addEventListener("click", (event) => {
    if (event.target === quickDialog) quickDialog.close();
  });
  quickAdd.addEventListener("click", () => {
    if (!activeProduct) return;
    quickDialog.close();
    addToCart(activeProduct);
  });

  /* ------------------------------------------------------------
     Enquiry form and newsletter demo feedback
     ------------------------------------------------------------ */
  const enquiryDialog = $("[data-enquiry-dialog]");
  $$('[data-open-enquiry]').forEach((button) => button.addEventListener("click", () => enquiryDialog.showModal()));
  $("[data-close-enquiry]").addEventListener("click", () => enquiryDialog.close());
  enquiryDialog.addEventListener("click", (event) => {
    if (event.target === enquiryDialog) enquiryDialog.close();
  });

  $("[data-enquiry-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    $("[data-enquiry-message]").textContent = "Thank you — your enquiry is ready to connect to WordPress.";
    event.currentTarget.reset();
  });

  $("[data-signup-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    $("[data-form-message]").textContent = "You’re on the private-view list.";
    event.currentTarget.reset();
  });

  /* Escape closes custom overlays; native dialogs handle Escape themselves. */
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && cartDrawer.classList.contains("is-open")) closeCart();
    if (event.key === "Escape" && mobileMenu.classList.contains("is-open")) setMenu(false);
  });
})();
