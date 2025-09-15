// Prevent prefetch on non-http(s) URLs (avoids noisy CORS warning in console).
(() => {
  const supports = typeof document !== "undefined" && "querySelectorAll" in document;
  if (!supports) return;
  const links = document.querySelectorAll('link[rel="prefetch"]');
  for (const link of links) {
    try {
      const href = link.getAttribute("href") || "";
      if (href && !/^https?:\/\//i.test(href) && !href.startsWith("/")) {
        link.remove(); // drop data:, blob:, etc.
      }
    } catch {}
  }
})();
