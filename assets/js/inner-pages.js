/**
 * WildSlabs inner-page controller
 * ------------------------------------------------------------------
 * Renders catalogue-driven pages, maintains the demo bag and powers the
 * dependency-free 360° CSS 3D viewer. Everything is intentionally kept
 * framework-free for an uncomplicated future WordPress handoff.
 */

document.documentElement.classList.add("js");

(() => {
  "use strict";

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const catalog = window.WILDSLABS_CATALOG || [];
  const CART_KEY = "wildslabs-demo-cart";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const money = (amount) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);

  const readCart = () => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      return [];
    }
  };

  const writeCart = (cart) => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateBagCount(cart);
  };

  const updateBagCount = (cart = readCart()) => {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    $$('[data-cart-count]').forEach((element) => { element.textContent = count; });
  };

  const getProduct = (id) => catalog.find((product) => product.id === id) || catalog[0];

  const productCard = (product, index = 0) => `
    <article class="product-card reveal is-visible" data-category="${product.category}" data-delay="${index % 3}">
      <a class="product-visual ${product.mediaClass}" href="product.html?id=${product.id}" aria-label="View ${product.name}">
        <img src="${product.image}" alt="${product.name} collectible" width="900" height="900" loading="lazy">
        <span>View object</span>
      </a>
      <div class="product-info">
        <div><h3><a href="product.html?id=${product.id}">${product.name}</a></h3><p>${product.edition}</p></div>
        <p>${money(product.price)}</p>
      </div>
    </article>`;

  /* Shared full-screen navigation. */
  const header = $("[data-header]");
  const menuButton = $("[data-menu-button]");
  const menu = $("[data-mobile-menu]");

  const setMenu = (open) => {
    if (!menuButton || !menu) return;
    menuButton.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
    menu.classList.toggle("is-open", open);
    document.body.classList.toggle("is-locked", open);
    document.body.classList.toggle("is-menu-open", open);
    $(".sr-only", menuButton).textContent = open ? "Close menu" : "Open menu";
  };

  menuButton?.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
  window.addEventListener("scroll", () => header?.classList.toggle("is-scrolled", window.scrollY > 45), { passive: true });

  /* Collection page rendering. */
  const collectionGrid = $("[data-collection-grid]");
  if (collectionGrid) {
    const requestedType = new URLSearchParams(location.search).get("type") || "all";
    const activeType = ["all", "sport", "culture"].includes(requestedType) ? requestedType : "all";
    const visibleProducts = activeType === "all" ? catalog : catalog.filter((product) => product.category === activeType);
    const titles = { all: "The complete viewing room.", sport: "Sport Study.", culture: "Culture Archive." };
    const intros = {
      all: "Every available WildSlabs object, presented without hierarchy or noise.",
      sport: "Structure, atmosphere and collective memory translated from the field into archival objects.",
      culture: "Broadcast, sound and shared visual memory preserved in limited acrylic editions."
    };

    $("[data-collection-title]").textContent = titles[activeType];
    $("[data-collection-intro]").textContent = intros[activeType];
    document.title = `${titles[activeType].replace(".", "")} — WildSlabs`;
    collectionGrid.innerHTML = visibleProducts.map(productCard).join("");
    $$('[data-collection-switch]').forEach((link) => link.classList.toggle("is-active", link.dataset.collectionSwitch === activeType));
  }

  /* Product page rendering. */
  const productPage = $("[data-product-page]");
  if (productPage) {
    const product = getProduct(new URLSearchParams(location.search).get("id"));
    document.title = `${product.name} — WildSlabs`;

    $$('[data-product-name]').forEach((element) => { element.textContent = product.name; });
    $$('[data-product-price]').forEach((element) => { element.textContent = money(product.price); });
    $$('[data-product-edition]').forEach((element) => { element.textContent = product.edition; });
    $$('[data-product-code]').forEach((element) => { element.textContent = product.code; });
    $$('[data-product-description]').forEach((element) => { element.textContent = product.description; });
    $("[data-product-material]").textContent = product.material;
    $("[data-product-dimensions]").textContent = product.dimensions;
    $("[data-product-certificate]").textContent = product.certificate;
    $("[data-product-remaining]").textContent = `${String(product.remaining).padStart(2, "0")} remaining`;
    $$('[data-product-image]').forEach((image) => {
      image.src = product.image;
      image.alt = `${product.name} collectible`;
    });

    const addButton = $("[data-product-add]");
    addButton.addEventListener("click", () => {
      const cart = readCart();
      const existing = cart.find((item) => item.id === product.id);
      if (existing) existing.quantity += 1;
      else cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 });
      writeCart(cart);
      const toast = $("[data-toast]");
      toast.textContent = `${product.name} added to your bag.`;
      toast.classList.add("is-visible");
      window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
    });

    const related = catalog.filter((item) => item.id !== product.id && item.category === product.category).slice(0, 2);
    $("[data-related-grid]").innerHTML = related.map(productCard).join("");
  }

  /* Real, drag-controlled 360° CSS 3D slab model. */
  $$('[data-object-viewer]').forEach((viewer) => {
    const model = $("[data-slab-model]", viewer);
    const reset = $("[data-viewer-reset]", viewer);
    const spinButton = $("[data-viewer-spin]", viewer);
    let rotationX = -4;
    let rotationY = -12;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    // Auto-rotation remains available, but never starts automatically when
    // the visitor has enabled a reduced-motion preference.
    let spinning = !reducedMotion;
    let viewerInView = true;
    let animationFrame = 0;
    let lastTime = performance.now();

    const paint = () => {
      const normalizedRotation = ((rotationY % 360) + 360) % 360;
      model.style.transform = `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`;
      model.classList.toggle("is-back-view", normalizedRotation > 90 && normalizedRotation < 270);
      viewer.setAttribute("aria-valuenow", String(Math.round(normalizedRotation)));
    };

    const animate = (time) => {
      if (spinning && !dragging && viewerInView && !document.hidden) {
        rotationY += (time - lastTime) * 0.018;
        paint();
      }
      lastTime = time;
      animationFrame = requestAnimationFrame(animate);
    };

    const updateSpinButton = () => {
      if (!spinButton) return;
      spinButton.setAttribute("aria-pressed", String(spinning));
      spinButton.firstChild.textContent = spinning ? "Pause rotation " : "Auto rotate ";
    };

    const stopSpin = () => {
      spinning = false;
      updateSpinButton();
    };

    viewer.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button, a")) return;
      stopSpin();
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      viewer.setPointerCapture(event.pointerId);
      viewer.classList.add("is-dragging");
    });

    viewer.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      rotationY += (event.clientX - lastX) * .55;
      rotationX = Math.max(-28, Math.min(28, rotationX - (event.clientY - lastY) * .22));
      lastX = event.clientX;
      lastY = event.clientY;
      paint();
    });

    const releasePointer = () => {
      dragging = false;
      viewer.classList.remove("is-dragging");
    };
    viewer.addEventListener("pointerup", releasePointer);
    viewer.addEventListener("pointercancel", releasePointer);

    viewer.addEventListener("keydown", (event) => {
      const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      stopSpin();
      if (event.key === "ArrowLeft") rotationY -= 10;
      if (event.key === "ArrowRight") rotationY += 10;
      if (event.key === "ArrowUp") rotationX = Math.max(-28, rotationX - 5);
      if (event.key === "ArrowDown") rotationX = Math.min(28, rotationX + 5);
      paint();
    });

    reset?.addEventListener("click", () => {
      stopSpin();
      rotationX = -4;
      rotationY = -12;
      paint();
    });

    spinButton?.addEventListener("click", () => {
      spinning = !spinning;
      updateSpinButton();
      lastTime = performance.now();
    });

    if ("IntersectionObserver" in window) {
      const viewerObserver = new IntersectionObserver(([entry]) => {
        viewerInView = entry.isIntersecting;
        lastTime = performance.now();
      }, { threshold: 0.05 });
      viewerObserver.observe(viewer);
    }

    updateSpinButton();
    paint();
    animationFrame = requestAnimationFrame(animate);
    window.addEventListener("pagehide", () => cancelAnimationFrame(animationFrame), { once: true });
  });

  /* Checkout summary and reversible demo completion. */
  const checkoutList = $("[data-checkout-items]");
  if (checkoutList) {
    const renderCheckout = () => {
      const cart = readCart();
      const empty = $("[data-checkout-empty]");
      const content = $("[data-checkout-content]");
      empty.hidden = cart.length > 0;
      content.hidden = cart.length === 0;

      checkoutList.innerHTML = cart.map((item) => `
        <article class="checkout-item">
          <img src="${item.image}" alt="">
          <div><h3>${item.name}</h3><p>Quantity ${item.quantity}</p></div>
          <div><strong>${money(item.price * item.quantity)}</strong><button type="button" data-checkout-remove="${item.id}">Remove</button></div>
        </article>`).join("");

      const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      $("[data-checkout-subtotal]").textContent = money(subtotal);
      $("[data-checkout-total]").textContent = money(subtotal);
      updateBagCount(cart);

      $$('[data-checkout-remove]').forEach((button) => button.addEventListener("click", () => {
        writeCart(cart.filter((item) => item.id !== button.dataset.checkoutRemove));
        renderCheckout();
      }));
    };

    $("[data-checkout-form]").addEventListener("submit", (event) => {
      event.preventDefault();
      $("[data-checkout-message]").textContent = "Reservation captured — connect this step to WooCommerce when WordPress is installed.";
      event.currentTarget.querySelector("button[type='submit']").disabled = true;
    });

    renderCheckout();
  }

  updateBagCount();
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu?.classList.contains("is-open")) setMenu(false);
  });
})();
