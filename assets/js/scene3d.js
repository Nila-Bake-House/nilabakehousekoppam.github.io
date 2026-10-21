/* Nila Bake House – 3D hero cake (three.js).
   Loaded as an ES module. If WebGL or the module is unavailable the page
   keeps showing the regular cake photo, so nothing breaks. */
import * as THREE from "./vendor/three.module.min.js";

(function () {
    "use strict";

    var visual = document.querySelector(".hero-visual");
    var stage = document.getElementById("heroStage");
    var flavourBtn = document.getElementById("flavourBtn");
    if (!visual || !stage) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch (err) {
        return; // no WebGL – keep the photo
    }

    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2));
    stage.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

    /* ---------- Lighting + a tiny studio environment for soft reflections ---------- */
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbfe3ff, 0.9));
    var key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 8, 5);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x66ccff, 1.4);
    rim.position.set(-6, 3, -4);
    scene.add(rim);

    (function buildEnvironment() {
        var env = new THREE.Scene();
        var dome = new THREE.Mesh(
            new THREE.SphereGeometry(20, 24, 12),
            new THREE.MeshBasicMaterial({ color: 0xcfeaff, side: THREE.BackSide })
        );
        env.add(dome);
        var panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        [[0, 12, 0, 14, 14], [-14, 4, 6, 8, 10], [14, 6, -4, 6, 12]].forEach(function (p, i) {
            var m = new THREE.Mesh(new THREE.PlaneGeometry(p[3], p[4]), panelMat);
            m.position.set(p[0], p[1], p[2]);
            m.lookAt(0, 0, 0);
            if (i === 0) m.rotation.x = Math.PI / 2;
            env.add(m);
        });
        var pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(env, 0.04).texture;
        pmrem.dispose();
        env.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    })();

    /* ---------- Flavours ---------- */
    var FLAVOURS = [
        { name: "Black Forest", label: "Signature", sponge: 0x4a2a1c, cream: 0xfff4e6, accent: 0x2b140d, kind: "cherry" },
        { name: "Strawberry",   label: "Flavour",   sponge: 0xf6dcc4, cream: 0xffc2d2, accent: 0xe8365d, kind: "strawberry" },
        { name: "Red Velvet",   label: "Flavour",   sponge: 0xa3162a, cream: 0xfff7ee, accent: 0xfffaf2, kind: "crumb" },
        { name: "Pista",        label: "Flavour",   sponge: 0xe3e8b0, cream: 0xd2e8a4, accent: 0x7fae4a, kind: "pista" },
        { name: "Mango",        label: "Flavour",   sponge: 0xffe08a, cream: 0xfff3c4, accent: 0xffa91f, kind: "mango" },
        { name: "Butterscotch", label: "Flavour",   sponge: 0xe9c58a, cream: 0xfff0d2, accent: 0xc9811f, kind: "nugget" }
    ];
    var flavourIndex = 0;

    /* ---------- Cake ---------- */
    var root = new THREE.Group();
    scene.add(root);

    var PLATE_TOP = 0.14, SPONGE_H = 0.5, CREAM_H = 0.16, CAKE_R = 1.55, CAP_H = 0.14;
    var LAYERS = ["s", "c", "s", "c", "s"];

    var plate = new THREE.Mesh(
        new THREE.CylinderGeometry(2.45, 2.55, 0.14, 72),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.05 })
    );
    plate.position.y = PLATE_TOP / 2;
    root.add(plate);
    var plateRim = new THREE.Mesh(
        new THREE.TorusGeometry(2.4, 0.04, 12, 96),
        new THREE.MeshStandardMaterial({ color: 0x66ccff, roughness: 0.35 })
    );
    plateRim.rotation.x = Math.PI / 2;
    plateRim.position.y = PLATE_TOP;
    root.add(plateRim);

    // soft contact shadow so the cake sits on the page
    (function () {
        var c = document.createElement("canvas");
        c.width = c.height = 128;
        var g = c.getContext("2d");
        var grad = g.createRadialGradient(64, 64, 20, 64, 64, 64);
        grad.addColorStop(0, "rgba(0,40,90,.38)");
        grad.addColorStop(1, "rgba(0,40,90,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
        var tex = new THREE.CanvasTexture(c);
        var shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(7.4, 7.4),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = -0.05;
        root.add(shadow);
    })();

    var spongeMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    var creamMat = new THREE.MeshStandardMaterial({ roughness: 0.4 });
    var accentMat = new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2 });

    var y = PLATE_TOP;
    LAYERS.forEach(function (t) {
        var isSponge = t === "s";
        var h = isSponge ? SPONGE_H : CREAM_H;
        var m = new THREE.Mesh(
            new THREE.CylinderGeometry(isSponge ? CAKE_R : CAKE_R + 0.05, isSponge ? CAKE_R : CAKE_R + 0.05, h, 64),
            isSponge ? spongeMat : creamMat
        );
        m.position.y = y + h / 2;
        root.add(m);
        y += h;
    });
    var CAP_Y = y + CAP_H / 2;
    var TOP_Y = y + CAP_H;
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(CAKE_R + 0.07, CAKE_R + 0.07, CAP_H, 64), accentMat);
    cap.position.y = CAP_Y;
    root.add(cap);

    var decor = new THREE.Group();
    root.add(decor);

    /* ---------- Toppings ---------- */
    function rand(a, b) { return a + Math.random() * (b - a); }
    // Seeded so the cake looks the same on every load
    var seed = 7;
    function srand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function srange(a, b) { return a + srand() * (b - a); }

    var geoSphere = new THREE.SphereGeometry(1, 20, 14);
    var geoIco = new THREE.IcosahedronGeometry(1, 0);
    var geoBox = new THREE.BoxGeometry(1, 1, 1);
    var geoCone = new THREE.ConeGeometry(1, 1, 8);
    var geoCapsule = new THREE.CapsuleGeometry(0.09, 1, 6, 12);
    var geoStem = new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6);
    var disposable = [];

    function mat(color, opts) {
        var m = new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.5 }, opts || {}));
        disposable.push(m);
        return m;
    }
    function physical(color, opts) {
        var m = new THREE.MeshPhysicalMaterial(Object.assign({ color: color, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }, opts || {}));
        disposable.push(m);
        return m;
    }
    function mesh(geo, material, sx, sy, sz) {
        var m = new THREE.Mesh(geo, material);
        m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
        return m;
    }

    function buildKit(kind) {
        var kit = {};
        if (kind === "cherry") {
            var cherryMat = physical(0xb0102a), stemMat = mat(0x5a6b2a);
            kit.big = function () {
                var g = new THREE.Group();
                g.add(mesh(geoSphere, cherryMat, 0.2));
                var stem = new THREE.Mesh(geoStem, stemMat);
                stem.position.set(0.05, 0.28, 0);
                stem.rotation.z = -0.35;
                g.add(stem);
                return g;
            };
            var choc = [mat(0x2b140d), mat(0x4a2a1c), mat(0x6b3d27)];
            kit.small = function () {
                var m = mesh(geoBox, choc[Math.floor(srand() * 3)], srange(0.2, 0.34), 0.035, srange(0.07, 0.12));
                m.rotation.set(srange(-0.4, 0.4), srange(0, 6.28), srange(-0.4, 0.4));
                return m;
            };
        } else if (kind === "strawberry") {
            var berryMat = physical(0xd81f45), leafMat = mat(0x3f9a3b), pearlMat = mat(0xffffff, { roughness: 0.2 });
            kit.big = function () {
                var g = new THREE.Group();
                var body = mesh(geoSphere, berryMat, 0.22, 0.26, 0.22);
                g.add(body);
                for (var i = 0; i < 5; i++) {
                    var leaf = mesh(geoCone, leafMat, 0.06, 0.16, 0.02);
                    leaf.position.set(Math.cos(i * 1.256) * 0.07, 0.25, Math.sin(i * 1.256) * 0.07);
                    leaf.rotation.set(Math.sin(i * 1.256) * 1.2, 0, -Math.cos(i * 1.256) * 1.2);
                    g.add(leaf);
                }
                return g;
            };
            kit.small = function () { return mesh(geoSphere, pearlMat, srange(0.05, 0.08)); };
        } else if (kind === "crumb") {
            var crumbMats = [mat(0xa3162a), mat(0x7d0f20), mat(0xc22a3d)];
            kit.big = function () {
                var g = new THREE.Group();
                for (var i = 0; i < 4; i++) {
                    var c = mesh(geoIco, crumbMats[i % 3], srange(0.07, 0.11));
                    c.position.set(srange(-0.09, 0.09), srange(0, 0.12), srange(-0.09, 0.09));
                    g.add(c);
                }
                return g;
            };
            kit.small = function () { return mesh(geoIco, crumbMats[Math.floor(srand() * 3)], srange(0.06, 0.12)); };
        } else if (kind === "pista") {
            var pistaMats = [mat(0x7fae4a), mat(0x9bc65b), mat(0xb7d58a)];
            kit.big = function () {
                var g = new THREE.Group();
                for (var i = 0; i < 3; i++) {
                    var p = mesh(geoSphere, pistaMats[i], 0.1, 0.075, 0.075);
                    p.position.set(srange(-0.08, 0.08), srange(0, 0.1), srange(-0.08, 0.08));
                    p.rotation.set(srange(0, 3), srange(0, 3), srange(0, 3));
                    g.add(p);
                }
                return g;
            };
            kit.small = function () {
                var p = mesh(geoSphere, pistaMats[Math.floor(srand() * 3)], 0.11, 0.08, 0.08);
                p.rotation.set(srange(0, 3), srange(0, 6), srange(0, 3));
                return p;
            };
        } else if (kind === "mango") {
            var mangoMats = [mat(0xffa91f, { roughness: 0.3 }), mat(0xffc13b, { roughness: 0.3 }), mat(0xff9412, { roughness: 0.3 })];
            kit.big = function () {
                var m = mesh(geoBox, mangoMats[0], 0.24, 0.2, 0.24);
                m.rotation.y = 0.5;
                return m;
            };
            kit.small = function () {
                var s = srange(0.09, 0.16);
                var m = mesh(geoBox, mangoMats[Math.floor(srand() * 3)], s, s * 0.8, s);
                m.rotation.set(srange(-0.3, 0.3), srange(0, 6.28), srange(-0.3, 0.3));
                return m;
            };
        } else { // nugget (butterscotch)
            var nuggetMats = [mat(0xc9811f, { roughness: 0.35 }), mat(0xe0a24a, { roughness: 0.35 }), mat(0x9c5e14, { roughness: 0.4 })];
            kit.big = function () {
                var g = new THREE.Group();
                for (var i = 0; i < 3; i++) {
                    var n = mesh(geoIco, nuggetMats[i], srange(0.07, 0.11));
                    n.position.set(srange(-0.08, 0.08), srange(0, 0.1), srange(-0.08, 0.08));
                    n.rotation.set(srange(0, 3), srange(0, 3), 0);
                    g.add(n);
                }
                return g;
            };
            kit.small = function () {
                var n = mesh(geoIco, nuggetMats[Math.floor(srand() * 3)], srange(0.07, 0.13));
                n.rotation.set(srange(0, 3), srange(0, 3), 0);
                return n;
            };
        }
        return kit;
    }

    var decorT = 1; // 0 → 1 pop-in progress
    function buildDecor(f) {
        while (decor.children.length) decor.remove(decor.children[0]);
        disposable.forEach(function (m) { m.dispose(); });
        disposable.length = 0;
        seed = 11 + flavourIndex * 5;

        var kit = buildKit(f.kind);
        var dripMat = physical(f.accent, { roughness: 0.25, clearcoat: 0.8 });
        var creamTop = mat(f.cream, { roughness: 0.4 });

        // drips running down the side
        var DRIPS = 18;
        for (var i = 0; i < DRIPS; i++) {
            var len = srange(0.22, 0.78);
            var pivot = new THREE.Group();
            pivot.rotation.y = (i / DRIPS) * Math.PI * 2 + srange(-0.05, 0.05);
            var d = mesh(geoCapsule, dripMat, 1, 1, 1);
            d.scale.set(0.62, len, 0.9);
            d.position.set(CAKE_R + 0.09, TOP_Y - 0.1 - (len + 0.18) / 2, 0);
            pivot.add(d);
            decor.add(pivot);
        }

        // piped cream rosettes around the rim, a topping on every other one
        var ROS = 14;
        for (var j = 0; j < ROS; j++) {
            var a = (j / ROS) * Math.PI * 2;
            var r = mesh(geoSphere, creamTop, 0.2, 0.17, 0.2);
            r.position.set(Math.cos(a) * (CAKE_R - 0.12), TOP_Y + 0.08, Math.sin(a) * (CAKE_R - 0.12));
            decor.add(r);
            if (j % 2 === 0) {
                var top = kit.big();
                top.position.set(Math.cos(a) * (CAKE_R - 0.12), TOP_Y + 0.3, Math.sin(a) * (CAKE_R - 0.12));
                top.rotation.y = -a;
                decor.add(top);
            }
        }

        // centre pile
        for (var k = 0; k < 26; k++) {
            var ang = srange(0, Math.PI * 2);
            var rad = Math.sqrt(srand()) * (CAKE_R - 0.65);
            var piece = kit.small();
            piece.position.set(Math.cos(ang) * rad, TOP_Y + 0.05 + (1 - rad / CAKE_R) * 0.1, Math.sin(ang) * rad);
            decor.add(piece);
        }
        var hero = kit.big();
        hero.scale.multiplyScalar(1.6);
        hero.position.set(0, TOP_Y + 0.26, 0);
        decor.add(hero);

        // a few crumbs at the base of the cake
        for (var c = 0; c < 10; c++) {
            var ca = srange(0, Math.PI * 2);
            var cr = srange(CAKE_R + 0.25, CAKE_R + 0.8);
            var crumb = mesh(geoIco, spongeMat, srange(0.03, 0.06));
            crumb.position.set(Math.cos(ca) * cr, PLATE_TOP + 0.03, Math.sin(ca) * cr);
            decor.add(crumb);
        }
    }

    var targetSponge = new THREE.Color(), targetCream = new THREE.Color(), targetAccent = new THREE.Color();
    function setFlavour(i, instant) {
        flavourIndex = (i + FLAVOURS.length) % FLAVOURS.length;
        var f = FLAVOURS[flavourIndex];
        targetSponge.set(f.sponge);
        targetCream.set(f.cream);
        targetAccent.set(f.accent);
        if (instant) {
            spongeMat.color.copy(targetSponge);
            creamMat.color.copy(targetCream);
            accentMat.color.copy(targetAccent);
        }
        buildDecor(f);
        decorT = instant ? 1 : 0;
        if (!instant) spinVel += 5;

        var nameEl = document.getElementById("flavourName");
        var labelEl = document.getElementById("flavourLabel");
        if (nameEl) nameEl.textContent = f.name;
        if (labelEl) labelEl.textContent = f.label;
        if (flavourBtn) flavourBtn.setAttribute("aria-label", "Change cake flavour, currently " + f.name);
        kick();
    }

    /* ---------- Floating sprinkles ---------- */
    var SPR = 64;
    var sprinkles = new THREE.InstancedMesh(
        new THREE.CapsuleGeometry(0.035, 0.15, 4, 8),
        new THREE.MeshStandardMaterial({ roughness: 0.45 }),
        SPR
    );
    var sprData = [];
    var palette = [0x009fe8, 0xffffff, 0xff7aa8, 0xffd34d, 0x3f3f95, 0x66ccff].map(function (c) { return new THREE.Color(c); });
    for (var s = 0; s < SPR; s++) {
        var ang0 = Math.random() * Math.PI * 2;
        sprData.push({
            a: ang0,
            r: rand(2.9, 3.9),
            y: rand(0.2, 3.6),
            sp: rand(0.12, 0.35) * (Math.random() < 0.5 ? -1 : 1),
            bob: rand(0, 6.28),
            rx: rand(0, 3), ry: rand(0, 3), rs: rand(0.4, 1.4)
        });
        sprinkles.setColorAt(s, palette[s % palette.length]);
    }
    sprinkles.instanceColor.needsUpdate = true;
    scene.add(sprinkles);

    var dummy = new THREE.Object3D();
    function updateSprinkles(t) {
        for (var i = 0; i < SPR; i++) {
            var d = sprData[i];
            var a = d.a + t * d.sp;
            dummy.position.set(Math.cos(a) * d.r, d.y + Math.sin(t * 0.8 + d.bob) * 0.15, Math.sin(a) * d.r);
            dummy.rotation.set(d.rx + t * d.rs, d.ry + t * d.rs * 0.7, 0);
            dummy.updateMatrix();
            sprinkles.setMatrixAt(i, dummy.matrix);
        }
        sprinkles.instanceMatrix.needsUpdate = true;
    }

    /* ---------- Interaction ---------- */
    var yaw = 0.6, spinVel = 0, dragging = false, moved = 0, lastX = 0, lastT = 0;
    var px = 0, py = 0, tpx = 0, tpy = 0;
    var canvas = renderer.domElement;
    canvas.style.touchAction = "pan-y"; // vertical swipes still scroll the page

    canvas.addEventListener("pointerdown", function (e) {
        dragging = true; moved = 0; lastX = e.clientX; lastT = performance.now();
        canvas.setPointerCapture(e.pointerId);
        canvas.classList.add("grabbing");
        kick();
    });
    canvas.addEventListener("pointermove", function (e) {
        var rect = canvas.getBoundingClientRect();
        tpx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        tpy = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        if (dragging) {
            var dx = e.clientX - lastX;
            var now = performance.now();
            var dt = Math.max(1, now - lastT) / 1000;
            moved += Math.abs(dx);
            yaw += dx * 0.012;
            spinVel = (dx * 0.012) / dt;
            lastX = e.clientX; lastT = now;
        }
        kick();
    });
    function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        canvas.classList.remove("grabbing");
        if (moved < 6 && e && e.type === "pointerup") setFlavour(flavourIndex + 1);
        spinVel = Math.max(-8, Math.min(8, spinVel));
        kick();
    }
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", function () { tpx = 0; tpy = 0; kick(); });

    if (flavourBtn) {
        flavourBtn.addEventListener("click", function () { setFlavour(flavourIndex + 1); });
    }

    /* ---------- Sizing ---------- */
    function resize() {
        var w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.userData.dist = Math.max(10.5, 7.4 / (0.5734 * camera.aspect));
        camera.updateProjectionMatrix();
        kick();
    }
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
    else window.addEventListener("resize", resize);

    /* ---------- Render loop ---------- */
    var visible = true, running = false, idleUntil = 0, last = performance.now(), clock = 0;

    function kick() {
        idleUntil = performance.now() + 2500;
        if (!running && visible) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    }

    function frame(now) {
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!reduceMotion) clock += dt;

        // spin: auto rotation + inertia from dragging / flavour change
        if (!dragging) {
            yaw += (reduceMotion ? 0 : 0.28 * dt) + spinVel * dt;
            spinVel *= Math.pow(0.02, dt);
        }
        px += (tpx - px) * (1 - Math.exp(-dt * 5));
        py += (tpy - py) * (1 - Math.exp(-dt * 5));

        var k = 1 - Math.exp(-dt * 7);
        spongeMat.color.lerp(targetSponge, k);
        creamMat.color.lerp(targetCream, k);
        accentMat.color.lerp(targetAccent, k);

        if (decorT < 1) decorT = Math.min(1, decorT + dt * 2.2);
        var e = decorT === 1 ? 1 : 1 + 2.70158 * Math.pow(decorT - 1, 3) + 1.70158 * Math.pow(decorT - 1, 2); // easeOutBack
        decor.scale.setScalar(Math.max(0.001, e));
        decor.position.y = (1 - e) * 0.4;

        var scrollY = window.scrollY || 0;
        root.rotation.y = yaw + scrollY * 0.003;
        root.position.y = reduceMotion ? 0 : Math.sin(clock * 1.2) * 0.07;
        root.rotation.z = px * 0.03;

        var elev = 0.42 + py * 0.08 - Math.min(scrollY, 600) * 0.0001;
        var dist = camera.userData.dist || 11;
        camera.position.set(Math.sin(px * 0.25) * dist * 0.15, Math.sin(elev) * dist, Math.cos(elev) * dist);
        camera.lookAt(0, 1.05, 0);

        updateSprinkles(clock);
        renderer.render(scene, camera);

        if (visible && (!reduceMotion || dragging || now < idleUntil || Math.abs(spinVel) > 0.01 || decorT < 1)) {
            requestAnimationFrame(frame);
        } else {
            running = false;
        }
    }

    // Only draw while the hero is on screen / tab is visible
    if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
            visible = entries[0].isIntersecting;
            if (visible) kick();
        }, { rootMargin: "100px" }).observe(visual);
    }
    document.addEventListener("visibilitychange", function () {
        visible = !document.hidden;
        if (visible) kick();
    });

    canvas.addEventListener("webglcontextlost", function (e) {
        e.preventDefault();
        visual.classList.remove("hero-3d"); // fall back to the photo
    });

    /* ---------- Go ---------- */
    setFlavour(0, true);
    resize();
    visual.classList.add("hero-3d");
    if (flavourBtn) flavourBtn.hidden = false;
    kick();
})();
