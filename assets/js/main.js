/* Nila Bake House – site scripts */
(function () {
    "use strict";

    document.documentElement.classList.add("js");

    var BAKERY_WHATSAPP = "917593836666";

    // Google Sheet with the cake menu, published as CSV
    // (File > Share > Publish to web > CSV). Leave empty to use assets/data/cakes.csv.
    var MENU_SHEET_URL = "";

    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    /* ---------- Header: shadow on scroll + mobile menu ---------- */
    var header = document.getElementById("siteHeader");
    var navToggle = document.getElementById("navToggle");
    var mainNav = document.getElementById("mainNav");

    function onScroll() {
        if (header) header.classList.toggle("scrolled", window.scrollY > 8);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    function closeNav() {
        if (!mainNav) return;
        mainNav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open menu");
    }

    if (navToggle && mainNav) {
        navToggle.addEventListener("click", function () {
            var open = mainNav.classList.toggle("open");
            navToggle.setAttribute("aria-expanded", open ? "true" : "false");
            navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        });
        mainNav.addEventListener("click", function (e) {
            if (e.target.closest("a")) closeNav();
        });
    }

    /* ---------- Highlight current section in nav ---------- */
    var navLinks = document.querySelectorAll(".main-nav .nav-link");
    if ("IntersectionObserver" in window && navLinks.length) {
        var sectionObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var id = entry.target.id;
                navLinks.forEach(function (link) {
                    link.classList.toggle("active", link.getAttribute("href") === "#" + id);
                });
            });
        }, { rootMargin: "-45% 0px -50% 0px" });
        document.querySelectorAll("main section[id]").forEach(function (s) { sectionObserver.observe(s); });
    }

    /* ---------- Scroll reveal ---------- */
    var revealObserver = null;
    if ("IntersectionObserver" in window) {
        revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    }
    function reveal(el) {
        if (revealObserver) revealObserver.observe(el);
        else el.classList.add("visible");
    }
    document.querySelectorAll(".reveal").forEach(reveal);

    /* ---------- Pre-select an item in the order form ---------- */
    var orderItemSelect = document.getElementById("orderItem");

    function chooseItem(name) {
        if (!orderItemSelect || !name) return;
        var match = Array.prototype.find.call(orderItemSelect.options, function (o) { return o.value === name; });
        if (match) {
            orderItemSelect.value = name;
            orderItemSelect.classList.remove("invalid");
        }
    }

    document.addEventListener("click", function (e) {
        var trigger = e.target.closest("[data-order-item]");
        if (!trigger) return;
        var name = trigger.getAttribute("data-order-item");
        if (trigger.tagName === "BUTTON") {
            e.preventDefault();
            var order = document.getElementById("order");
            if (order) order.scrollIntoView({ behavior: "smooth" });
        }
        chooseItem(name);
        var qty = document.getElementById("quantity");
        if (qty) setTimeout(function () { qty.focus({ preventScroll: true }); }, 500);
    });

    /* ---------- Load cake menu from CSV ---------- */
    function cakeCard(cake) {
        var base = cake.image.replace(/\.[^.]+$/, "");
        var col = document.createElement("article");
        col.className = "cake-card reveal";
        col.setAttribute("data-tilt", "");
        col.innerHTML =
            '<div class="cake-media">' +
                '<img src="assets/cake/web/' + encodeURI(base) + '.webp" ' +
                    'data-fallback="assets/cake/' + encodeURI(cake.image) + '" ' +
                    'alt="' + escapeHtml(cake.name) + '" loading="lazy" width="900" height="600">' +
                '<span class="price-tag">' + escapeHtml(cake.price) + '</span>' +
            '</div>' +
            '<div class="cake-body">' +
                '<h3>' + escapeHtml(cake.name) + '</h3>' +
                '<p>' + escapeHtml(cake.description) + '</p>' +
                '<button type="button" class="cake-order" data-order-item="' + escapeHtml(cake.name) + '">' +
                    '<i class="bi bi-bag-plus"></i> Order this cake' +
                '</button>' +
            '</div>';

        // Use the original photo if there is no optimised .webp copy yet
        var img = col.querySelector("img");
        img.addEventListener("error", function onErr() {
            img.removeEventListener("error", onErr);
            img.src = img.getAttribute("data-fallback");
        });
        return col;
    }

    // Splits CSV text into rows of fields, handling quoted fields with commas,
    // quotes ("") and line breaks, as Google Sheets exports them.
    function parseCsv(text) {
        var rows = [], row = [], field = "", quoted = false;
        text = text.replace(/^\uFEFF/, "");
        for (var i = 0; i < text.length; i++) {
            var c = text[i];
            if (quoted) {
                if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
                else if (c === '"') quoted = false;
                else field += c;
            } else if (c === '"') {
                quoted = true;
            } else if (c === ",") {
                row.push(field); field = "";
            } else if (c === "\n" || c === "\r") {
                if (c === "\r" && text[i + 1] === "\n") i++;
                row.push(field); rows.push(row); row = []; field = "";
            } else {
                field += c;
            }
        }
        if (field !== "" || row.length) { row.push(field); rows.push(row); }
        return rows.filter(function (r) { return r.join("").trim() !== ""; });
    }

    // Turns CSV rows into cakes, finding columns by their header names
    function cakesFromCsv(text) {
        var rows = parseCsv(text);
        if (rows.length <= 1) return [];
        var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
        function col(name, fallback) {
            var idx = header.indexOf(name);
            return idx === -1 ? fallback : idx;
        }
        var cols = { name: col("name", 0), price: col("price", 1), description: col("description", 2), image: col("image", 3) };
        return rows.slice(1).map(function (r) {
            return {
                name: (r[cols.name] || "").trim(),
                price: (r[cols.price] || "").trim(),
                description: (r[cols.description] || "").trim(),
                image: (r[cols.image] || "").trim()
            };
        }).filter(function (cake) { return cake.name; });
    }

    function fetchCsv(url) {
        // Cache-buster so browser always gets the latest menu
        return fetch(url + (url.indexOf("?") === -1 ? "?" : "&") + "_=" + Date.now())
            .then(function (response) {
                if (!response.ok) throw new Error("Network response was not ok");
                return response.text();
            })
            .then(function (text) {
                var cakes = cakesFromCsv(text);
                if (!cakes.length && /<html/i.test(text)) throw new Error("Not a CSV file");
                return cakes;
            });
    }

    function loadCakes() {
        var cakeListEl = document.getElementById("cake-list");
        if (!cakeListEl) return;

        var localCsv = "assets/data/cakes.csv";
        var menu = MENU_SHEET_URL
            ? fetchCsv(MENU_SHEET_URL).catch(function (error) {
                // Sheet unreachable or not published: use the copy in the repo
                console.warn("Could not load the Google Sheet menu, using cakes.csv:", error);
                return fetchCsv(localCsv);
            })
            : fetchCsv(localCsv);

        menu
            .then(function (cakes) {
                if (!cakes.length) {
                    cakeListEl.innerHTML = '<p class="cake-status">No cakes to display right now.</p>';
                    return;
                }

                cakeListEl.innerHTML = "";

                // Keep the first "Select an item" option, clear the rest
                if (orderItemSelect) {
                    var firstOption = orderItemSelect.querySelector("option");
                    orderItemSelect.innerHTML = "";
                    if (firstOption) orderItemSelect.appendChild(firstOption);
                }

                cakes.forEach(function (cake) {
                    var card = cakeCard(cake);
                    cakeListEl.appendChild(card);
                    reveal(card);

                    if (orderItemSelect) {
                        var opt = document.createElement("option");
                        opt.value = cake.name;
                        opt.textContent = cake.name;
                        orderItemSelect.appendChild(opt);
                    }
                });

                // Add "Custom Cake" option manually at end
                if (orderItemSelect) {
                    var customOpt = document.createElement("option");
                    customOpt.value = "Custom Cake";
                    customOpt.textContent = "Custom Cake (theme / photo etc.)";
                    orderItemSelect.appendChild(customOpt);
                }
            })
            .catch(function (error) {
                console.error("Error loading the cake menu:", error);
                cakeListEl.innerHTML =
                    '<p class="cake-status error">Unable to load cake menu at the moment. Please try again later.</p>';
            });
    }

    /* ---------- Order form → WhatsApp ---------- */
    function setupOrderForm() {
        var orderForm = document.getElementById("orderForm");
        if (!orderForm) return;

        var errorEl = document.getElementById("formError");
        var dateInput = document.getElementById("pickupDate");
        if (dateInput) {
            var today = new Date();
            today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
            dateInput.min = today.toISOString().slice(0, 10);
        }

        function showError(message, field) {
            errorEl.textContent = message;
            errorEl.hidden = false;
            if (field) {
                field.classList.add("invalid");
                field.focus();
            }
        }

        orderForm.addEventListener("input", function (e) {
            e.target.classList.remove("invalid");
        });
        orderForm.addEventListener("change", function (e) {
            e.target.classList.remove("invalid");
        });

        orderForm.addEventListener("submit", function (e) {
            e.preventDefault();
            errorEl.hidden = true;

            var nameEl = document.getElementById("customerName");
            var phoneEl = document.getElementById("customerPhone");
            var qtyEl = document.getElementById("quantity");

            var name = nameEl.value.trim();
            var phone = phoneEl.value.trim();
            var item = orderItemSelect.value;
            var quantity = qtyEl.value.trim();
            var pickupDate = document.getElementById("pickupDate").value;
            var pickupTimeRaw = document.getElementById("pickupTime").value;
            var notes = document.getElementById("extraNotes").value.trim();

            if (!name) return showError("Please enter your name.", nameEl);

            // MOBILE NUMBER VALIDATION – must be 10 digits
            var phoneOnlyDigits = phone.replace(/\D/g, "");
            if (phoneOnlyDigits.length !== 10) {
                return showError("Please enter a valid 10-digit mobile number.", phoneEl);
            }
            if (!item) return showError("Please choose what you would like to order.", orderItemSelect);
            if (!quantity) return showError("Please enter the quantity or weight.", qtyEl);

            // TIME → AM/PM conversion
            var pickupTime = "";
            if (pickupTimeRaw) {
                var t = pickupTimeRaw.split(":");
                var hour = parseInt(t[0], 10);
                var ampm = hour >= 12 ? "PM" : "AM";
                pickupTime = (hour % 12 || 12) + ":" + t[1] + " " + ampm;
            }

            // BUILD MESSAGE
            var message = "";
            message += "New order request from " + name + "\n";
            message += "Phone: " + phoneOnlyDigits + "\n";
            message += "Item: " + item + "\n";
            message += "Quantity/Weight: " + quantity + "\n";

            var dateTimeText = "Not specified";
            if (pickupDate || pickupTime) {
                dateTimeText = "";
                if (pickupDate) dateTimeText += pickupDate;
                if (pickupTime) dateTimeText += (dateTimeText ? " " : "") + pickupTime;
            }
            message += "Preferred Date & Time: " + dateTimeText + "\n";

            if (notes) message += "Special Instructions: " + notes + "\n";

            message += "\nPlease confirm availability and price.";

            var url = "https://wa.me/" + BAKERY_WHATSAPP + "?text=" + encodeURIComponent(message);
            window.open(url, "_blank");
        });
    }

    /* ---------- 3D tilt on cards (mouse / pen only) ---------- */
    var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (canHover && !reduceMotion) {
        var tiltEl = null, tiltFrame = 0, tiltEvt = null;

        function applyTilt() {
            tiltFrame = 0;
            if (!tiltEl || !tiltEvt) return;
            var r = tiltEl.getBoundingClientRect();
            var x = (tiltEvt.clientX - r.left) / r.width;   // 0 → 1
            var y = (tiltEvt.clientY - r.top) / r.height;
            var max = tiltEl.getAttribute("data-tilt") === "soft" ? 5 : 9;
            tiltEl.style.setProperty("--ry", ((x - 0.5) * 2 * max).toFixed(2) + "deg");
            tiltEl.style.setProperty("--rx", ((0.5 - y) * 2 * max).toFixed(2) + "deg");
            tiltEl.style.setProperty("--tx", ((x - 0.5) * 2).toFixed(3));
            tiltEl.style.setProperty("--ty", ((y - 0.5) * 2).toFixed(3));
            tiltEl.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
            tiltEl.style.setProperty("--my", (y * 100).toFixed(1) + "%");
        }
        function resetTilt(el) {
            el.classList.remove("tilting");
            ["--rx", "--ry", "--tx", "--ty", "--mx", "--my"].forEach(function (p) { el.style.removeProperty(p); });
        }

        document.addEventListener("pointermove", function (e) {
            if (e.pointerType === "touch") return;
            var el = e.target.closest && e.target.closest("[data-tilt]");
            if (el !== tiltEl) {
                if (tiltEl) resetTilt(tiltEl);
                tiltEl = el;
                if (el) el.classList.add("tilting");
            }
            if (!el) return;
            tiltEvt = e;
            if (!tiltFrame) tiltFrame = requestAnimationFrame(applyTilt);
        }, { passive: true });
        document.addEventListener("pointerleave", function () {
            if (tiltEl) resetTilt(tiltEl);
            tiltEl = null;
        });

        // Hero depth: chips and disc drift with the pointer
        var hero = document.querySelector(".hero");
        var heroVisual = document.querySelector(".hero-visual");
        if (hero && heroVisual) {
            hero.addEventListener("pointermove", function (e) {
                var r = hero.getBoundingClientRect();
                heroVisual.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
                heroVisual.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
            }, { passive: true });
            hero.addEventListener("pointerleave", function () {
                heroVisual.style.setProperty("--px", 0);
                heroVisual.style.setProperty("--py", 0);
            });
        }
    }

    /* ---------- Footer year ---------- */
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    loadCakes();
    setupOrderForm();
})();
