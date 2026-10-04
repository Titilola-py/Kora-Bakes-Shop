import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import BrandMark from "./BrandMark";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Croissant,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});
const CHECKOUT_RESUME_KEY = "kora-resume-checkout";
let supabaseClient = null;
const isCupcakeBox = (product) => product.name.startsWith("Cupcakes, box of ");
const productDisplayName = (product) => isCupcakeBox(product) ? "Cupcakes" : product.name;

const todayLocal = () => {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

async function responseData(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.detail === "string" ? body.detail : "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return body;
}

function getSupabaseClient(config) {
  if (!supabaseClient && config?.configured) {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabaseClient;
}

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`product-image art-${product.id}`}>
      {failed ? (
        <div className="product-image-fallback" role="img" aria-label={`${product.name} image unavailable`}>
          <Croissant size={28} aria-hidden="true" />
          <strong>{product.name}</strong>
        </div>
      ) : <img src={product.image_url} alt={product.name} loading="lazy" onError={() => setFailed(true)} />}
      <span className="image-grain" aria-hidden="true" />
    </div>
  );
}

function App() {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [products, setProducts] = useState([]);
  const [productsError, setProductsError] = useState("");
  const [supabase, setSupabase] = useState(null);
  const [session, setSession] = useState(null);
  const [auth, setAuth] = useState(null);
  const [authError, setAuthError] = useState("");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = JSON.parse(window.localStorage.getItem("kora-cart") || "{}");
      return savedCart && typeof savedCart === "object" && !Array.isArray(savedCart) ? savedCart : {};
    } catch {
      return {};
    }
  });
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem("kora-pending-payment-order") || "null");
    } catch {
      return null;
    }
  });
  const [paymentResult, setPaymentResult] = useState(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentChecking, setPaymentChecking] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All bakes");
  const [selectedCupcakeVariant, setSelectedCupcakeVariant] = useState("cupcakes-box-6");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [checkoutSelection, setCheckoutSelection] = useState(() => {
    try {
      const savedSelection = JSON.parse(window.localStorage.getItem("kora-buy-now-selection") || "null");
      return savedSelection && typeof savedSelection.productId === "string"
        && Number.isInteger(savedSelection.quantity)
        && savedSelection.quantity >= 1
        && savedSelection.quantity <= 25
        ? savedSelection
        : null;
    } catch {
      return null;
    }
  });
  const [view, setView] = useState("shop");
  const [pickupName, setPickupName] = useState("");
  const [pickupDate, setPickupDate] = useState(todayLocal);
  const [pickupNote, setPickupNote] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    window.localStorage.setItem("kora-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    let active = true;
    fetch("/api/config")
      .then(responseData)
      .then((data) => {
        if (active) {
          setConfig(data);
          setSupabase(getSupabaseClient(data));
        }
      })
      .catch((error) => {
        if (active) setConfigError(error.message || "The shop API is not running.");
      });
    fetch("/api/products")
      .then(responseData)
      .then((data) => {
        if (active) setProducts(data);
      })
      .catch((error) => {
        if (active) setProductsError(error.message || "We could not load the bakes.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    const resumeCheckoutIfRequested = (restoredSession) => {
      if (
        !restoredSession?.access_token
        || window.localStorage.getItem(CHECKOUT_RESUME_KEY) !== "true"
      ) return;
      window.localStorage.removeItem(CHECKOUT_RESUME_KEY);
      setView("checkout");
    };
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      setSession(data.session);
      resumeCheckoutIfRequested(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthError("");
      if (nextSession) {
        resumeCheckoutIfRequested(nextSession);
      } else {
        setCart({});
        setOrders([]);
        setView("shop");
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3800);
  }, []);

  const user = session?.user ?? null;
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "friend";
  const categories = useMemo(() => ["All bakes", ...new Set(products.map((product) => product.category))], [products]);
  const featuredProduct = products[0] ?? null;
  const storyProduct = products[1] ?? featuredProduct;
  const filteredProducts = products.filter((product) => {
    const matchesCategory = category === "All bakes" || product.category === category;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });
  const displayProducts = filteredProducts.filter((product, index, matches) => (
    !isCupcakeBox(product) || index === matches.findIndex(isCupcakeBox)
  ));
  const catalogProductCount = new Set(products.map(productDisplayName)).size;
  const cartLines = products.filter((product) => cart[product.id]).map((product) => ({
    ...product,
    quantity: cart[product.id],
  }));
  const baseDetailProduct = products.find((product) => product.id === selectedProductId);
  const detailVariants = baseDetailProduct
    ? isCupcakeBox(baseDetailProduct) ? products.filter(isCupcakeBox) : [baseDetailProduct]
    : [];
  const detailProduct = detailVariants.find((product) => product.id === selectedProductId) || baseDetailProduct;
  const checkoutLines = checkoutSelection
    ? products.filter((product) => product.id === checkoutSelection.productId).map((product) => ({
      ...product,
      quantity: checkoutSelection.quantity,
    }))
    : cartLines;
  const checkoutItemCount = checkoutLines.reduce((count, line) => count + line.quantity, 0);
  const checkoutTotalKobo = checkoutLines.reduce((total, line) => total + line.price_kobo * line.quantity, 0);
  const itemCount = cartLines.reduce((count, line) => count + line.quantity, 0);
  const totalKobo = cartLines.reduce((total, line) => total + line.price_kobo * line.quantity, 0);

  const fetchOrders = useCallback(async () => {
    if (!session?.access_token) return;
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const result = await responseData(await fetch("/api/orders", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }));
      setOrders(result);
    } catch (error) {
      setOrdersError(error.message);
    } finally {
      setOrdersLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (view === "orders" && session) fetchOrders();
  }, [view, session, fetchOrders]);

  useEffect(() => {
    if (user) setPickupName(userName);
  }, [user, userName]);

  const updateCart = (productId, change) => {
    setCart((current) => {
      const quantity = (current[productId] || 0) + change;
      if (quantity <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: Math.min(quantity, 25) };
    });
  };

  const openProduct = (productId) => {
    setSelectedProductId(productId);
    const product = products.find((item) => item.id === productId);
    if (product && isCupcakeBox(product)) setSelectedCupcakeVariant(productId);
    setDetailQuantity(1);
    setView("product");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addDetailProductToCart = () => {
    if (!detailProduct) return;
    updateCart(detailProduct.id, detailQuantity);
    setView("shop");
    showToast(`${detailProduct.name} (${detailProduct.unit}) added to your bag.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const buyDetailProductNow = () => {
    if (!detailProduct) return;
    const selection = { productId: detailProduct.id, quantity: detailQuantity };
    setCheckoutSelection(selection);
    window.localStorage.setItem("kora-buy-now-selection", JSON.stringify(selection));
    if (!user) {
      window.localStorage.setItem(CHECKOUT_RESUME_KEY, "true");
      setAuthOpen(true);
      return;
    }
    setView("checkout");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearCheckoutSelection = () => {
    setCheckoutSelection(null);
    window.localStorage.removeItem("kora-buy-now-selection");
  };

  const startCheckout = () => {
    if (!itemCount) return;
    clearCheckoutSelection();
    setCartOpen(false);
    if (!user) {
      window.localStorage.setItem(CHECKOUT_RESUME_KEY, "true");
      setAuthOpen(true);
      return;
    }
    setView("checkout");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const signInWithGoogle = async () => {
    if (!supabase) {
      setAuthError("Google sign-in is not configured yet. Follow the setup steps in the project README.");
      return;
    }
    setAuthError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError(error.message);
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) showToast(error.message);
    else showToast("You are signed out.");
  };

  const checkPayment = async (reference) => {
    if (!session?.access_token) {
      setPaymentError("Sign in again to check this payment.");
      return;
    }
    setPaymentChecking(true);
    setPaymentError("");
    try {
      const result = await responseData(await fetch("/api/payments/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reference }),
      }));
      setPaymentResult(result);
      setPickupName(result.order.customer_name);
      setPickupDate(result.order.pickup_date);
      setPickupNote(result.order.notes);
      if (result.order.payment_status === "paid") {
        if (checkoutSelection) {
          clearCheckoutSelection();
        } else {
          setCart({});
          window.localStorage.removeItem("kora-cart");
        }
        setPendingPaymentOrder(null);
        window.localStorage.removeItem("kora-pending-payment-order");
      }
    } catch (error) {
      setPaymentError(error.message || "We could not verify the payment yet.");
    } finally {
      setPaymentChecking(false);
    }
  };

  const startPaystackCheckout = async (orderId) => {
    if (!session?.access_token) return;
    setPlacingOrder(true);
    try {
      const payment = await responseData(await fetch(`/api/orders/${orderId}/payments/initialize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      }));
      window.location.assign(payment.authorization_url);
    } catch (error) {
      showToast(error.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (!reference) return;
    setPaymentReference(reference);
    setView("payment-result");
    void checkPayment(reference);
  }, [session?.access_token]);

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!session?.access_token || !checkoutLines.length) return;
    setPlacingOrder(true);
    try {
      const checkoutPayload = {
        customer_name: pickupName,
        pickup_date: pickupDate,
        notes: pickupNote,
        items: checkoutLines.map(({ id, quantity }) => ({ product_id: id, quantity })),
      };
      let orderId;
      if (
        pendingPaymentOrder?.user_id === user.id
        && pendingPaymentOrder.payload === JSON.stringify(checkoutPayload)
      ) {
        orderId = pendingPaymentOrder.id;
      } else {
        const order = await responseData(await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(checkoutPayload),
        }));
        orderId = order.id;
        const pending = { id: order.id, user_id: user.id, payload: JSON.stringify(checkoutPayload) };
        setPendingPaymentOrder(pending);
        window.localStorage.setItem("kora-pending-payment-order", JSON.stringify(pending));
      }
      const payment = await responseData(await fetch(`/api/orders/${orderId}/payments/initialize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      }));
      window.location.assign(payment.authorization_url);
    } catch (error) {
      showToast(error.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  const goShop = () => {
    clearCheckoutSelection();
    const callbackUrl = new URL(window.location.href);
    callbackUrl.searchParams.delete("reference");
    callbackUrl.searchParams.delete("trxref");
    window.history.replaceState({}, "", `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`);
    setView("shop");
    setAuthOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="site-shell">
      <header className={`topbar ${view === "shop" ? "topbar-on-hero" : ""}`}>
        <a className="brand" href="#top" onClick={goShop} aria-label="Kora Bakes home">
          <span className="brand-mark"><BrandMark /></span>
          <span>Kora <i>Bakes</i></span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <button className={view === "shop" ? "nav-link active" : "nav-link"} onClick={goShop}>Home</button>
          <a className="nav-link" href="#shop" onClick={goShop}>Shop</a>
          <a className="nav-link" href="#our-story" onClick={goShop}>About</a>
          {user && <button className={view === "orders" ? "nav-link active" : "nav-link"} onClick={() => setView("orders")}>My orders</button>}
        </nav>
        <div className="top-actions">
          {user ? (
            <div className="account-chip">
              <span className="avatar">{userName.slice(0, 1).toUpperCase()}</span>
              <span className="account-name">{userName.split(" ")[0]}</span>
              <button className="icon-button account-signout" onClick={signOut} aria-label="Sign out" title="Sign out"><ArrowDownRight size={17} /></button>
            </div>
          ) : (
            <button className="signin-link" onClick={() => setAuthOpen(true)}><UserRound size={16} /> Sign in</button>
          )}
          <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Open bag, ${itemCount} items`}>
            <ShoppingBag size={18} /><span className="bag-label">Bag</span><span className="bag-count">{itemCount}</span>
          </button>
        </div>
      </header>

      {view === "shop" && (
        <>
          <main id="top">
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow"><span /> KORA BAKES</div>
                <h1>Bakes worth<br /><em>coming back for.</em></h1>
                <div className="hero-actions">
                  <a href="#shop" className="button button-dark">Shop now <ArrowRight size={16} /></a>
                  <a href="#our-story" className="hero-secondary-link">About Kora</a>
                </div>
              </div>
              <div className="hero-visual" role="group" aria-label={featuredProduct ? `Featured bake: ${featuredProduct.name}` : "Kora Bakes"}>
                {featuredProduct && <img className="hero-product-image" src={featuredProduct.image_url} alt={featuredProduct.name} fetchPriority="high" />}
                {featuredProduct && <div className="hero-feature-label"><span>{featuredProduct.category}</span><strong>{featuredProduct.name}</strong><small>{money.format(featuredProduct.price_kobo / 100)} · {featuredProduct.unit}</small></div>}
              </div>
            </section>

            <section className="shop-section" id="shop">
              <div className="section-heading">
                <div>
                  <div className="eyebrow"><span /> KORA BAKES</div>
                  <h2>Top <em>Products</em></h2>
                </div>
                <p>Browse the counter.</p>
              </div>
              <div className="shop-controls">
                <div className="category-navigation-label">Explore more</div>
                <div className="category-tabs" role="group" aria-label="Filter products by category">
                  {categories.map((item) => <button key={item} className={category === item ? "category-tab selected" : "category-tab"} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
                </div>
                <label className="search-box"><Search size={16} /><input aria-label="Search bakes" placeholder="Find your favourite" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              </div>
              {productsError && <div className="notice error-notice" role="alert">{productsError}</div>}
              {products.length === 0 && !productsError ? <div className="loading-products">The oven is warming up…</div> : (
                <div className="product-grid">
                  {displayProducts.map((product, index) => {
                    const variants = isCupcakeBox(product)
                      ? products.filter(isCupcakeBox)
                      : [product];
                    const selectedProduct = variants.find((variant) => variant.id === selectedCupcakeVariant) || variants[0];
                    return (
                    <article className="product-card" key={product.id} style={{ "--card-index": index }} onClick={() => openProduct(selectedProduct.id)}>
                      <div className="product-media">
                        <button className="product-image-open" aria-label={`View ${selectedProduct.name} details`} onClick={(event) => { event.stopPropagation(); openProduct(selectedProduct.id); }}><ProductImage product={selectedProduct} /></button>
                        {selectedProduct.badge && <span className="product-badge">{selectedProduct.badge}</span>}
                        <button className="quick-add" onClick={(event) => { event.stopPropagation(); updateCart(selectedProduct.id, 1); showToast(`${selectedProduct.name} (${selectedProduct.unit}) added to your bag.`); }} aria-label={`Add ${selectedProduct.name}, ${selectedProduct.unit}, to bag`}><Plus size={15} /><span>Add</span></button>
                      </div>
                      <div className="product-info">
                        <div className="product-category">{product.category} <span>·</span> {selectedProduct.unit}</div>
                        <div className="product-title-row"><h3><button className="product-name-open" onClick={(event) => { event.stopPropagation(); openProduct(selectedProduct.id); }}>{productDisplayName(selectedProduct)}</button></h3><strong>{money.format(selectedProduct.price_kobo / 100)}</strong></div>
                        {variants.length > 1 && <label className="product-variant-picker"><span>Choose a box</span><select aria-label="Choose a cupcake box size" value={selectedProduct.id} onClick={(event) => event.stopPropagation()} onChange={(event) => { event.stopPropagation(); setSelectedCupcakeVariant(event.target.value); }} onKeyDown={(event) => event.stopPropagation()}>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.unit}</option>)}</select></label>}
                        <p>{selectedProduct.description}</p>
                        {cart[selectedProduct.id] > 0 && <div className="added-line"><Check size={13} /> {cart[selectedProduct.id]} in your bag</div>}
                      </div>
                    </article>
                    );
                  })}
                </div>
              )}
              {products.length > 0 && filteredProducts.length === 0 && <p className="empty-search">No bakes match that search. Try another name.</p>}
              <div className="catalog-footer"><span>KORA BAKES</span><span>{String(displayProducts.length).padStart(2, "0")} / {String(catalogProductCount).padStart(2, "0")} PRODUCTS</span></div>
            </section>

            <section className="story-section" id="our-story">
              <div className="story-image" role="img" aria-label={storyProduct ? storyProduct.name : "Kora Bakes"}>
                {storyProduct && <img src={storyProduct.image_url} alt={storyProduct.name} loading="lazy" />}
              </div>
              <div className="story-copy">
                <div className="eyebrow"><span /> KORA BAKES</div>
                <h2>Bakes worth<br /><em>coming back for.</em></h2>
                <a className="story-link" href="#shop">Explore the products <ArrowRight size={15} /></a>
              </div>
            </section>
          </main>
          <footer className="footer"><a className="brand footer-brand" href="#top" onClick={goShop}><span className="brand-mark"><BrandMark /></span><span>Kora <i>Bakes</i></span></a><span>Bakes worth coming back for.</span><a href="#shop" onClick={goShop}>Shop</a><a href="#our-story" onClick={goShop}>About</a></footer>
        </>
      )}

      {view === "product" && (
        <main className="page-wrap product-detail-page">
          <button className="back-link" onClick={goShop}><ArrowLeft size={16} /> Back to the shop</button>
          {detailProduct ? (
            <div className="product-detail-layout">
              <div className="product-detail-media">
                <ProductImage product={detailProduct} />
                {detailProduct.badge && <span className="product-detail-badge">{detailProduct.badge}</span>}
              </div>
              <section className="product-detail-copy" aria-labelledby="product-detail-title">
                <div className="eyebrow"><span /> {detailProduct.category}</div>
                <h1 id="product-detail-title">{productDisplayName(detailProduct)}</h1>
                <p className="product-detail-description">{detailProduct.description}</p>
                <div className="product-detail-price">{money.format(detailProduct.price_kobo / 100)} <span>/ {detailProduct.unit}</span></div>
                {detailVariants.length > 1 && (
                  <label className="product-detail-variant">
                    Pack size
                    <select value={detailProduct.id} onChange={(event) => { setSelectedProductId(event.target.value); setSelectedCupcakeVariant(event.target.value); }}>
                      {detailVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.unit}</option>)}
                    </select>
                  </label>
                )}
                <div className="product-detail-quantity">
                  <span>Quantity</span>
                  <div className="quantity-control">
                    <button type="button" aria-label="Decrease quantity" disabled={detailQuantity <= 1} onClick={() => setDetailQuantity((quantity) => Math.max(1, quantity - 1))}><Minus size={14} /></button>
                    <output aria-live="polite">{detailQuantity}</output>
                    <button type="button" aria-label="Increase quantity" disabled={detailQuantity >= 25} onClick={() => setDetailQuantity((quantity) => Math.min(25, quantity + 1))}><Plus size={14} /></button>
                  </div>
                </div>
                <div className="product-detail-actions">
                  <button className="button button-outline" onClick={addDetailProductToCart}>Add to Cart <ShoppingBag size={16} /></button>
                  <button className="button button-dark" onClick={buyDetailProductNow}>Buy Now <ArrowRight size={16} /></button>
                </div>
              </section>
            </div>
          ) : <div className="notice">This bake is not available. Return to the shop to browse the current menu.</div>}
        </main>
      )}

      {view === "checkout" && (
        <main className="page-wrap checkout-page">
          <button className="back-link" onClick={goShop}><ArrowLeft size={16} /> Back to the shop</button>
          <div className="checkout-title"><div className="eyebrow"><span /> THE LAST LITTLE STEP</div><h1>Make it <em>yours.</em></h1><p>We’ll bake it fresh and have it ready for your chosen pickup day.</p></div>
          <div className="checkout-layout">
            <form className="checkout-form" onSubmit={submitOrder}>
              <div className="form-section-heading"><span>01</span><div><h2>Pickup details</h2><p>Choose a pickup date for your order.</p></div></div>
              <label className="field-label">Name for the order<input required maxLength={100} value={pickupName} onChange={(event) => setPickupName(event.target.value)} placeholder="Your name" /></label>
              <label className="field-label">Choose a pickup date<input required type="date" min={todayLocal()} max={`${new Date().getFullYear() + 1}-12-31`} value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} /></label>
              <label className="field-label">A note for the bakehouse <span>OPTIONAL</span><textarea maxLength={500} rows={3} value={pickupNote} onChange={(event) => setPickupNote(event.target.value)} placeholder="Anything we should know?" /></label>
              <div className="checkout-auth-note"><UserRound size={17} /><span>Order confirmation will go to <strong>{user?.email}</strong></span></div>
              <button className="button button-dark place-order" type="submit" disabled={placingOrder}>{placingOrder ? "Preparing secure checkout…" : <>Continue to Paystack <ArrowRight size={16} /></>}</button>
              <p className="checkout-disclaimer">Pay securely through Paystack. Your pickup order is confirmed after payment.</p>
            </form>
            <aside className="order-summary">
              <div className="summary-title"><h2>Your little bundle</h2><span>{checkoutItemCount} {checkoutItemCount === 1 ? "item" : "items"}</span></div>
              <div className="summary-lines">
                {checkoutLines.map((line) => <div className="summary-line" key={line.id}><div className="summary-thumb"><img src={line.image_url} alt="" /></div><div className="summary-product"><strong>{line.name}</strong><span>{line.quantity} × {money.format(line.price_kobo / 100)}</span></div><strong>{money.format(line.price_kobo * line.quantity / 100)}</strong></div>)}
              </div>
              <div className="summary-total"><span>Subtotal</span><strong>{money.format(checkoutTotalKobo / 100)}</strong></div>
              <div className="pickup-summary"><Clock3 size={15} /><span>Pickup date<br /><strong>{pickupDate ? new Date(`${pickupDate}T12:00:00`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" }) : "Choose a date"}</strong></span></div>
            </aside>
          </div>
        </main>
      )}

      {view === "orders" && (
        <main className="page-wrap orders-page">
          <div className="orders-heading"><div><div className="eyebrow"><span /> YOUR ORDERS</div><h1>Good to see you,<br /><em>{userName.split(" ")[0]}.</em></h1><p>Your Kora Bakes orders, all in one place.</p></div><div className="orders-badge"><PackageCheck size={24} /><span>{orders.length} {orders.length === 1 ? "order" : "orders"}</span></div></div>
          {ordersLoading ? <div className="order-empty">Gathering your order history…</div> : ordersError ? <div className="notice error-notice" role="alert">{ordersError} <button onClick={fetchOrders}>Try again</button></div> : orders.length === 0 ? <div className="order-empty"><div className="empty-icon"><ShoppingBag size={24} /></div><h2>No orders just yet.</h2><p>The best things start with a first bite.</p><button className="button button-dark" onClick={goShop}>Find your first bake <ArrowRight size={16} /></button></div> : (
            <div className="orders-list">{orders.map((order) => <article className="order-card" key={order.id}><div className="order-card-top"><div><span className="order-label">ORDER {order.order_number}</span><strong>{new Date(order.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</strong></div><span className="order-status">{order.payment_status === "paid" ? <><Check size={13} /> Confirmed</> : <><Clock3 size={13} /> Payment pending</>}</span></div><div className="order-card-items">{order.items.map((item) => <div className="order-item" key={`${order.id}-${item.product_id}`}><span>{item.product_name} <small>× {item.quantity}</small></span><strong>{money.format(item.line_total_kobo / 100)}</strong></div>)}</div><div className="order-card-bottom"><span><Clock3 size={14} /> Pickup {new Date(`${order.pickup_date}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span><strong>{money.format(order.subtotal_kobo / 100)}</strong></div>{order.payment_status === "paid" && order.email_status !== "sent" && <div className="email-status">{order.email_status === "not_configured" ? "Email confirmations are not configured yet." : "Your order is paid, but its email confirmation needs attention."}</div>}</article>)}</div>
          )}
          <button className="back-link orders-back" onClick={goShop}><ArrowLeft size={16} /> Back to the shop</button>
        </main>
      )}

      {view === "success" && placedOrder && (
        <main className="page-wrap success-page">
          <div className="success-mark"><Check size={28} /></div>
          <div className="eyebrow"><span /> ORDER CONFIRMED</div>
          <h1>Something good<br /><em>is on its way.</em></h1>
          <p className="success-lead">Thanks, {pickupName.split(" ")[0] || "friend"}. Your bakes are in our book.</p>
          <div className="success-card"><div><span>ORDER NUMBER</span><strong>{placedOrder.order_number}</strong></div><div><span>PICKUP DATE</span><strong>{new Date(`${placedOrder.pickup_date}T12:00:00`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}</strong></div><div><span>TOTAL</span><strong>{money.format(placedOrder.subtotal_kobo / 100)}</strong></div><div><span>CONFIRMATION EMAIL</span><strong className="email-status-value">{placedOrder.email_status === "sent" ? `Sent to ${user?.email}` : placedOrder.email_status === "not_configured" ? "Mailgun setup is still needed" : "Email delivery needs attention"}</strong></div></div>
          {placedOrder.email_status !== "sent" && <p className="email-warning">Your order is saved. The email could not be sent yet; check the Mailgun setup and your order history.</p>}
          <div className="success-actions"><button className="button button-dark" onClick={() => setView("orders")}>See my orders <ArrowRight size={16} /></button><button className="text-button" onClick={goShop}>Keep browsing</button></div>
        </main>
      )}

      {view === "payment-result" && (
        <main className="page-wrap success-page">
          {paymentResult?.order?.payment_status === "paid" ? <div className="success-mark"><Check size={28} /></div> : <div className="success-mark"><Clock3 size={26} /></div>}
          <div className="eyebrow"><span /> {paymentResult?.order?.payment_status === "paid" ? "PAYMENT SUCCESSFUL" : "PAYMENT STATUS"}</div>
          <h1>{paymentResult?.order?.payment_status === "paid" ? <>Order<br /><em>confirmed.</em></> : <>Your order is<br /><em>still saved.</em></>}</h1>
          <p className="success-lead">{paymentChecking ? "Checking your payment with Paystack…" : paymentResult?.order?.payment_status === "paid" ? `Thanks, ${paymentResult.order.customer_name.split(" ")[0]}. Your pickup order is confirmed.` : paymentResult?.attempt_status === "pending" ? "Payment is not confirmed yet. You can check again or return to Paystack." : "Payment was not completed. Your bag is still here, and you can try again."}</p>
          {paymentError && <div className="notice error-notice" role="alert">{paymentError}</div>}
          {paymentResult?.order && <div className="success-card"><div><span>ORDER NUMBER</span><strong>{paymentResult.order.order_number}</strong></div><div><span>PICKUP DATE</span><strong>{new Date(`${paymentResult.order.pickup_date}T12:00:00`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}</strong></div><div><span>{paymentResult.order.payment_status === "paid" ? "AMOUNT PAID" : "TOTAL"}</span><strong>{money.format(paymentResult.order.subtotal_kobo / 100)}</strong></div><div><span>PAYMENT</span><strong>{paymentResult.order.payment_status === "paid" ? "Verified" : paymentResult.attempt_status}</strong></div>{paymentResult.order.payment_status === "paid" && <div><span>RECEIPT</span><strong className="email-status-value">{paymentResult.order.email_status === "sent" ? `Sent to ${user?.email}` : paymentResult.order.email_status === "not_configured" ? "Email confirmation is not configured" : "Email delivery needs attention"}</strong></div>}</div>}
          <div className="success-actions">
            {paymentResult?.order?.payment_status === "paid" ? <button className="button button-dark" onClick={() => setView("orders")}>See my orders <ArrowRight size={16} /></button> : <button className="button button-dark" disabled={placingOrder || paymentChecking} onClick={() => paymentResult?.order ? startPaystackCheckout(paymentResult.order.id) : checkPayment(paymentReference)}>{paymentChecking ? "Checking payment…" : paymentResult?.attempt_status === "pending" ? "Continue payment" : paymentResult ? "Try payment again" : "Check payment"} <ArrowRight size={16} /></button>}
            {paymentResult?.order?.payment_status !== "paid" && <button className="text-button" onClick={() => user ? setView("checkout") : setAuthOpen(true)}>Return to checkout</button>}
            {paymentResult?.order?.payment_status === "paid" && <button className="text-button" onClick={goShop}>Continue Shopping</button>}
          </div>
        </main>
      )}

      <div className={`drawer-backdrop ${cartOpen ? "visible" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
        <aside className={`cart-drawer ${cartOpen ? "open" : ""}`} aria-label="Shopping bag" aria-modal={cartOpen} role="dialog" aria-hidden={!cartOpen}>
          <div className="drawer-header"><div><span className="eyebrow"><span /> YOUR BAG</span><h2>A little something.</h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close bag"><X size={20} /></button></div>
          {cartLines.length === 0 ? <div className="cart-empty"><div className="empty-icon"><ShoppingBag size={23} /></div><h3>Your bag is taking a breather.</h3><p>Find a bake worth bringing home.</p><button className="button button-outline" onClick={() => { setCartOpen(false); goShop(); }}>Explore the shop <ArrowRight size={15} /></button></div> : (
            <>
              <div className="cart-lines">{cartLines.map((line) => <div className="cart-line" key={line.id}><div className="cart-thumb"><img src={line.image_url} alt="" /></div><div className="cart-line-main"><div className="cart-line-heading"><div><strong>{line.name}</strong><span>{line.unit}</span></div><button className="icon-button remove-item" onClick={() => setCart((current) => { const next = { ...current }; delete next[line.id]; return next; })} aria-label={`Remove ${line.name}`}><X size={16} /></button></div><div className="cart-line-bottom"><div className="quantity-control"><button onClick={() => updateCart(line.id, -1)} aria-label={`Remove one ${line.name}`}><Minus size={14} /></button><span>{line.quantity}</span><button onClick={() => updateCart(line.id, 1)} aria-label={`Add one ${line.name}`}><Plus size={14} /></button></div><strong>{money.format(line.price_kobo * line.quantity / 100)}</strong></div></div></div>)}</div>
              <div className="cart-bottom"><div className="cart-subtotal"><span>Subtotal</span><strong>{money.format(totalKobo / 100)}</strong></div><p>Pickup order</p><button className="button button-dark checkout-button" onClick={startCheckout}>Continue to checkout <ArrowRight size={16} /></button><span className="secure-note"><Check size={13} /> Your order is saved to your account</span></div>
            </>
          )}
        </aside>
      </div>

      {authOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { window.localStorage.removeItem(CHECKOUT_RESUME_KEY); setAuthOpen(false); } }}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="icon-button modal-close" onClick={() => { window.localStorage.removeItem(CHECKOUT_RESUME_KEY); setAuthOpen(false); }} aria-label="Close"><X size={19} /></button><div className="modal-mark"><BrandMark /></div><div className="eyebrow"><span /> A SEAT AT OUR TABLE</div><h2 id="auth-title">Keep your place.</h2><p>Sign in with Google to check out and find your order history whenever you come back.</p><button className="google-button" onClick={signInWithGoogle} disabled={!config?.configured}><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 38.05 46.98 31.93 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.91 23.91 0 0 0 0 24c0 3.88.93 7.55 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.94-2.13 15.91-5.8l-7.73-6c-2.14 1.45-4.88 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Continue with Google <ArrowRight size={16} /></button>{!config?.configured && <div className="config-hint">{configError || "Supabase setup is needed before Google sign-in can be enabled."}</div>}{authError && <div className="notice error-notice" role="alert">{authError}</div>}<div className="modal-privacy"><Check size={14} /> Your orders are private to your signed-in account.</div></section></div>}

      {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
    </div>
  );
}

export default App;
