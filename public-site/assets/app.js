(function () {
  // 1. Mobile Navigation Toggle
  var toggleBtn = document.querySelector("[data-nav-toggle]");
  var mobileMenu = document.querySelector("[data-nav-mobile]");
  if (toggleBtn && mobileMenu) {
    toggleBtn.addEventListener("click", function () {
      var isOpen = mobileMenu.classList.toggle("is-open");
      toggleBtn.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // 2. Testimonials Carousel
  var testimonials = [
    {
      quote:
        '"Excelente atención y transparencia en todo el proceso. Compré mi carro con total confianza. ¡Recomendados!"',
      author: "Carlos Méndez",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=320&q=80",
    },
    {
      quote:
        '"La valoración de mi vehículo fue justa y rápida. Me acompañaron desde la revisión hasta la firma sin complicaciones."',
      author: "Laura Gómez",
      avatar:
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=320&q=80",
    },
    {
      quote:
        '"Vehículos impecables y asesoría honesta. Todo el trámite de crédito y entrega fue claro desde el primer día."',
      author: "Andrés Ramírez",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&q=80",
    },
  ];

  var testimonialIdx = 0;
  var quoteEl = document.querySelector("[data-testimonial-quote]");
  var authorEl = document.querySelector("[data-testimonial-author]");
  var avatarEl = document.querySelector("[data-testimonial-avatar]");
  var dots = Array.prototype.slice.call(
    document.querySelectorAll("[data-testimonial-dot]")
  );
  var prevBtn = document.querySelector("[data-testimonial-prev]");
  var nextBtn = document.querySelector("[data-testimonial-next]");

  function renderTestimonial(index) {
    if (!quoteEl || !authorEl || !avatarEl) return;
    testimonialIdx = (index + testimonials.length) % testimonials.length;
    var item = testimonials[testimonialIdx];
    quoteEl.textContent = item.quote;
    authorEl.textContent = item.author;
    avatarEl.src = item.avatar;
    avatarEl.alt = item.author;
    dots.forEach(function (dot, i) {
      dot.classList.toggle("is-active", i === testimonialIdx);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      renderTestimonial(testimonialIdx - 1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      renderTestimonial(testimonialIdx + 1);
    });
  }
  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () {
      renderTestimonial(i);
    });
  });

  // 3. Helpers for API hydration
  function fetchFirstJson(endpoints) {
    return endpoints.reduce(function (promise, url) {
      return promise.catch(function () {
        return fetch(url, { headers: { Accept: "application/json" } }).then(
          function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          }
        );
      });
    }, Promise.reject());
  }

  function resolveMediaUrl(raw) {
    if (!raw) return "";
    var val = String(raw).trim();
    if (/^https?:\/\//i.test(val)) {
      return val.replace(/\/static\//, "/api/static/").replace(/\/api\/api\/static\//, "/api/static/");
    }
    if (val.indexOf("/api/static/") === 0) return val;
    if (val.indexOf("/static/") === 0) return "/api" + val;
    if (val.indexOf("/") === -1) return "/api/static/" + val;
    return val;
  }

  function formatCop(value) {
    var num = Number(value);
    if (!isFinite(num) || num <= 0) return "Consultar";
    return (
      "$ " +
      Math.round(num)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    );
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 4. Hydrate Featured Vehicles (only if API responds with real available cars)
  var featuredGrid = document.querySelector("[data-featured-vehicles]");
  if (featuredGrid) {
    fetchFirstJson([
      "/api/vehicles/public?limit=4",
      "/crm/api/vehicles/public?limit=4",
    ])
      .then(function (payload) {
        var list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload && payload.items)
          ? payload.items
          : [];
        if (!list.length) return;

        var fallbackPhoto =
          "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80";

        featuredGrid.innerHTML = list
          .slice(0, 4)
          .map(function (v) {
            var photo =
              Array.isArray(v.photos) && v.photos.length
                ? resolveMediaUrl(v.photos[0])
                : fallbackPhoto;
            var specs = [v.year, v.transmission, v.fuel_type]
              .filter(Boolean)
              .join(" • ");
            var href = v.id ? "/crm/autos/" + encodeURIComponent(v.id) : "/crm/autos";
            return (
              '<a class="vcard" href="' +
              href +
              '">' +
              '<div class="vcard__img">' +
              '<span class="vcard__badge">Autos<span>QP</span></span>' +
              '<img src="' +
              escapeHtml(photo) +
              '" alt="' +
              escapeHtml((v.make || "") + " " + (v.model || "")) +
              '" loading="lazy">' +
              "</div>" +
              '<div class="vcard__body">' +
              '<div class="vcard__brand">' +
              escapeHtml(v.make || "Vehículo") +
              "</div>" +
              '<div class="vcard__model">' +
              escapeHtml(v.model || "") +
              "</div>" +
              '<div class="vcard__meta">' +
              escapeHtml(specs || "Disponible en inventario") +
              "</div>" +
              '<div class="vcard__price">' +
              escapeHtml(formatCop(v.price)) +
              "</div>" +
              "</div>" +
              "</a>"
            );
          })
          .join("");
      })
      .catch(function () {
        // Keep static showcase fallback cards silently
      });
  }

  // 5. Hydrate Footer Contact from Public Company Context (optional)
  fetchFirstJson([
    "/api/public/company-context",
    "/crm/api/public/company-context",
  ])
    .then(function (company) {
      if (!company) return;
      var phoneEl = document.querySelector("[data-company-phone]");
      var addressEl = document.querySelector("[data-company-address]");
      if (phoneEl && company.contact_phone) {
        phoneEl.textContent = company.contact_phone;
      }
      if (addressEl && company.contact_address) {
        addressEl.textContent = company.contact_address;
      }
    })
    .catch(function () {
      // Keep default footer contact silently
    });
})();
