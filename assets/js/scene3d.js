/* Nila Bake House – 3D hero cakes (three.js).
   One 3D model per cake on the menu (assets/data/cakes.csv), modelled to match the menu photos.
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
    renderer.toneMapping = THREE.NoToneMapping; // keep the cake colours true to the photos
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2));
    stage.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

    /* ---------- Lighting + a tiny studio environment for soft reflections ---------- */
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfe8ff, 0.6));
    var key = new THREE.DirectionalLight(0xffffff, 1.45);
    key.position.set(4, 8, 5);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x66ccff, 1.2);
    rim.position.set(-6, 3, -4);
    scene.add(rim);

    (function buildEnvironment() {
        var env = new THREE.Scene();
        env.add(new THREE.Mesh(
            new THREE.SphereGeometry(20, 24, 12),
            new THREE.MeshBasicMaterial({ color: 0xcfeaff, side: THREE.BackSide })
        ));
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

    /* ---------- Building blocks ---------- */
    var R = 1.6;          // cake radius
    var BASE = 0.06;      // top of the cake board
    var seed = 1;
    function srand() { // mulberry32
        seed = (seed + 0x6D2B79F5) | 0;
        var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function srange(a, b) { return a + srand() * (b - a); }
    function hash(str) { var h = 7; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 2147483000; return h + 1; }

    var matCache = {};
    function mat(color, o) {
        var k = color + JSON.stringify(o || {});
        if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.55 }, o || {}));
        return matCache[k];
    }
    function gloss(color, o) {
        var k = "g" + color + JSON.stringify(o || {});
        if (!matCache[k]) matCache[k] = new THREE.MeshPhysicalMaterial(Object.assign({ color: color, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 }, o || {}));
        return matCache[k];
    }
    var CREAM = 0xf3e8d0, PIPED = 0xe9d9b6;

    var geoBox = new THREE.BoxGeometry(1, 1, 1);
    var geoIco = new THREE.IcosahedronGeometry(1, 0);
    var geoSphere = new THREE.SphereGeometry(1, 24, 16);
    var dummy = new THREE.Object3D();

    // Piped cream rosette: a lathe dome, then fluted and twisted per vertex.
    var rosetteCache = {};
    function rosetteGeo(kind) {
        if (rosetteCache[kind]) return rosetteCache[kind];
        var P = {
            kiss: { r: 0.26, h: 0.24, flutes: 8, twist: 2.5, amp: 0.17, p: 1.6, q: 0.9 },
            tall: { r: 0.21, h: 0.4, flutes: 7, twist: 3, amp: 0.15, p: 1.15, q: 1.3 },
            tiny: { r: 0.085, h: 0.09, flutes: 6, twist: 2, amp: 0.14, p: 1.6, q: 0.9 },
            swirl: { r: 0.3, h: 0.25, flutes: 6, twist: 4, amp: 0.14, p: 1.5, q: 0.8 }
        }[kind];
        var pts = [], N = 22, i;
        for (i = 0; i <= N; i++) {
            var t = i / N;
            var rad = P.r * Math.pow(1 - Math.pow(t, P.p), P.q) * (1 + 0.12 * Math.sin(t * Math.PI * 3));
            pts.push(new THREE.Vector2(Math.max(rad, 0.0005), t * P.h));
        }
        var geo = new THREE.LatheGeometry(pts, 32);
        var pos = geo.attributes.position;
        for (i = 0; i < pos.count; i++) {
            var x = pos.getX(i), yy = pos.getY(i), z = pos.getZ(i);
            var ang = Math.atan2(z, x) + P.twist * (yy / P.h) * Math.PI;
            var rr = Math.sqrt(x * x + z * z) * (1 + P.amp * Math.sin(P.flutes * ang));
            pos.setXYZ(i, Math.cos(ang) * rr, yy, Math.sin(ang) * rr);
        }
        geo.computeVertexNormals();
        geo.userData.h = P.h;
        rosetteCache[kind] = geo;
        return geo;
    }

    function ring(group, n, radius, y, kind, material, onEach) {
        var geo = rosetteGeo(kind);
        material.side = THREE.DoubleSide;
        for (var i = 0; i < n; i++) {
            var a = (i / n) * Math.PI * 2;
            var m = new THREE.Mesh(geo, material);
            m.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
            m.rotation.y = srange(0, 6.28);
            group.add(m);
            if (onEach) onEach(i, a, m, geo.userData.h);
        }
    }

    function cherry(group, x, y, z) {
        var c = new THREE.Mesh(geoSphere, gloss(0xc40f26));
        c.scale.setScalar(0.15);
        c.position.set(x, y, z);
        group.add(c);
    }

    // Plain sponge cylinder
    function core(group, h, color) {
        var m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, h, 64), mat(color, { roughness: 0.8 }));
        m.position.y = h / 2;
        group.add(m);
    }

    // Cream top with a soft lip
    function creamTop(group, h, color, o) {
        o = o || {};
        var th = o.thick || 0.2;
        var m = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, th, 64), o.glossy ? gloss(color, { roughness: 0.35, clearcoat: 0.4 }) : mat(color, { roughness: 0.45 }));
        m.position.y = h - 0.12 + th / 2;
        group.add(m);
        return h - 0.12 + th; // top surface
    }

    // Buttercream with horizontal comb ridges, as on the Mango / Pineapple / Pista / Strawberry cakes
    function ridgedBody(group, h, color, pitch) {
        var pts = [new THREE.Vector2(0, 0), new THREE.Vector2(R - 0.04, 0), new THREE.Vector2(R, 0.03)];
        for (var y = 0.06; y < h - 0.06; y += 0.02) {
            pts.push(new THREE.Vector2(R + 0.03 * Math.cos((2 * Math.PI * y) / pitch), y));
        }
        pts.push(new THREE.Vector2(R - 0.01, h - 0.02), new THREE.Vector2(R - 0.06, h), new THREE.Vector2(0, h));
        var m = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), mat(color, { roughness: 0.5, side: THREE.DoubleSide }));
        group.add(m);
        return h;
    }

    // Many small pieces stuck to the side of the cake (shavings, nuggets, crumbs, flakes)
    function coat(group, o) {
        var mesh = new THREE.InstancedMesh(o.geo, mat(0xffffff, { roughness: o.rough || 0.65 }), o.n);
        var col = new THREE.Color();
        for (var i = 0; i < o.n; i++) {
            var a = srand() * Math.PI * 2, y = srange(o.y0, o.y1), s = srange(o.smin, o.smax);
            dummy.position.set(Math.cos(a) * (R + 0.005), y, Math.sin(a) * (R + 0.005));
            dummy.lookAt(Math.cos(a) * 10, y, Math.sin(a) * 10);
            dummy.rotateZ(srand() * Math.PI);
            dummy.rotateX((srand() - 0.5) * 0.7);
            dummy.scale.set(s * o.sx, s * o.sy, s * o.sz);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            col.set(o.colors[Math.floor(srand() * o.colors.length)]).offsetHSL(0, 0, (srand() - 0.5) * 0.06);
            mesh.setColorAt(i, col);
        }
        group.add(mesh);
    }

    // A heap of the same pieces on top of the cake
    function mound(group, o) {
        var dome = new THREE.Mesh(geoSphere, mat(o.colors[0], { roughness: 0.8 }));
        dome.scale.set(o.radius * 0.92, o.peak * 0.9, o.radius * 0.92);
        dome.position.y = o.y;
        group.add(dome);
        var mesh = new THREE.InstancedMesh(o.geo, mat(0xffffff, { roughness: o.rough || 0.65 }), o.n);
        var col = new THREE.Color();
        for (var i = 0; i < o.n; i++) {
            var rad = Math.sqrt(srand()) * o.radius, a = srand() * Math.PI * 2, s = srange(o.smin, o.smax);
            dummy.position.set(Math.cos(a) * rad, o.y + o.peak * Math.pow(1 - rad / o.radius, 1.2) + srand() * 0.04, Math.sin(a) * rad);
            dummy.rotation.set(srand() * 6.28, srand() * 6.28, srand() * 6.28);
            dummy.scale.set(s * o.sx, s * o.sy, s * o.sz);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            col.set(o.colors[Math.floor(srand() * o.colors.length)]).offsetHSL(0, 0, (srand() - 0.5) * 0.06);
            mesh.setColorAt(i, col);
        }
        group.add(mesh);
    }

    // Marble swirl texture for the Vancho cake (polar = top, otherwise the side wrap)
    function marbleTexture(w, h, polar) {
        var c = document.createElement("canvas");
        c.width = w; c.height = h;
        var g = c.getContext("2d"), img = g.createImageData(w, h), d = img.data;
        var cream = [243, 224, 184], choc = [74, 38, 20];
        function sm(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
        for (var py = 0; py < h; py++) {
            for (var px = 0; px < w; px++) {
                var u = px / w, v = py / h, t;
                if (polar) {
                    var x = u * 2 - 1, y = v * 2 - 1, r = Math.sqrt(x * x + y * y), a = Math.atan2(y, x);
                    var wp = Math.sin(3 * a + 15 * r + 1.6 * Math.sin(2 * a + 7 * r) + 1.1 * Math.sin(5 * a - 9 * r));
                    t = 1 - sm(0.35, 0.6, wp);          // mostly cream with brown swirls
                } else {
                    var g2 = u * Math.PI * 2;
                    var ws = Math.sin(7 * g2 + 2.6 * Math.sin(3 * g2 + 9 * v) + 16 * v + 1.6 * Math.sin(5 * g2 - 7 * v));
                    t = sm(0.5, 0.75, ws);      // mostly brown with cream swirls
                    if (v < 0.14) t = 1;                 // cream band under the top edge
                }
                var i4 = (py * w + px) * 4;
                for (var k = 0; k < 3; k++) d[i4 + k] = choc[k] + (cream[k] - choc[k]) * t;
                d[i4 + 3] = 255;
            }
        }
        g.putImageData(img, 0, 0);
        var tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        if (!polar) tex.wrapS = THREE.RepeatWrapping;
        return tex;
    }

    /* ---------- The 12 cakes (keys = image file names in cakes.csv) ---------- */
    var shaving = new THREE.BoxGeometry(1, 1, 1);
    var CHOC = [0x2a130b, 0x44251a, 0x5b3626, 0x34190f];
    var NUGGET = [0xe19a1c, 0xeeae2c, 0xcf8414, 0xf3c14a];

    var MODELS = {
        "black-forest": function (g) {
            var H = 1.62;
            core(g, H, 0x3b2014);
            coat(g, { n: 2600, geo: shaving, y0: 0.02, y1: H - 0.1, sx: 0.16, sy: 0.03, sz: 0.07, smin: 0.7, smax: 1.3, colors: CHOC });
            var T = creamTop(g, H, CREAM);
            ring(g, 9, R - 0.3, T, "kiss", mat(PIPED, { roughness: 0.4 }), function (i, a, m, h) { cherry(g, m.position.x, T + h + 0.03, m.position.z); });
            mound(g, { n: 260, geo: shaving, y: T, peak: 0.3, radius: 0.62, sx: 0.16, sy: 0.04, sz: 0.08, smin: 0.8, smax: 1.3, colors: CHOC });
            return H + 0.08;
        },
        "white-forest": function (g) {
            var H = 1.62, WH = [0xfff6e2, 0xf5e7c4, 0xefdcb0];
            core(g, H, 0xf3e6c8);
            coat(g, { n: 1000, geo: shaving, y0: 0.02, y1: H - 0.1, sx: 0.23, sy: 0.04, sz: 0.12, smin: 0.8, smax: 1.3, colors: WH, rough: 0.5 });
            var T = creamTop(g, H, CREAM);
            ring(g, 8, R - 0.3, T, "kiss", mat(PIPED, { roughness: 0.4 }), function (i, a, m, h) { cherry(g, m.position.x, T + h + 0.03, m.position.z); });
            mound(g, { n: 55, geo: shaving, y: T, peak: 0.26, radius: 0.55, sx: 0.28, sy: 0.04, sz: 0.14, smin: 0.8, smax: 1.3, colors: WH, rough: 0.5 });
            return H + 0.08;
        },
        "red-velvet": function (g) {
            var H = 1.65, RV = [0x8c1020, 0x6d0c18, 0xa2182a, 0x5a0a14];
            core(g, H, 0x7a0f1a);
            coat(g, { n: 3400, geo: geoIco, y0: 0.02, y1: H - 0.1, sx: 1, sy: 1, sz: 1, smin: 0.04, smax: 0.075, colors: RV, rough: 0.9 });
            var T = creamTop(g, H, CREAM);
            ring(g, 8, R - 0.3, T, "tall", mat(PIPED, { roughness: 0.4 }));
            mound(g, { n: 240, geo: geoIco, y: T, peak: 0.24, radius: 0.5, sx: 1, sy: 1, sz: 1, smin: 0.04, smax: 0.08, colors: RV, rough: 0.9 });
            return H + 0.08;
        },
        "vancho": function (g) {
            var H = 1.6;
            var side = mat(0xffffff, { map: marbleTexture(1024, 256, false), roughness: 0.55 });
            var top = mat(0xffffff, { map: marbleTexture(512, 512, true), roughness: 0.4 });
            var m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 96), [side, top, side]);
            m.position.y = H / 2;
            g.add(m);
            return H;
        },
        "butterscotch": function (g) {
            var H = 1.62;
            core(g, H, 0xd9962a);
            coat(g, { n: 1900, geo: geoIco, y0: 0.02, y1: H - 0.1, sx: 1, sy: 1, sz: 1, smin: 0.07, smax: 0.115, colors: NUGGET, rough: 0.45 });
            var T = creamTop(g, H, CREAM);
            var pool = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.03, 48), gloss(0xc7761a, { roughness: 0.15 }));
            pool.position.y = T + 0.012;
            g.add(pool);
            ring(g, 8, 1.12, T, "kiss", mat(PIPED, { roughness: 0.4 }));
            [0.4, 0.62].forEach(function (a, i) {
                var len = i ? 0.45 : 0.7;
                var d = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, len, 6, 10), gloss(0xe0a032));
                d.scale.set(0.7, 1, 0.9);
                d.position.set(Math.cos(a) * (R + 0.075), T - 0.04 - len / 2, Math.sin(a) * (R + 0.075));
                d.rotation.y = -a;
                g.add(d);
            });
            return T;
        },
        "honey-cake": function (g) {
            var y = 0, i;
            for (i = 0; i < 8; i++) {
                var sp = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.17, 64), mat(i % 2 ? 0xc98a3a : 0xd99c4a, { roughness: 0.85 }));
                sp.position.y = y + 0.085; g.add(sp); y += 0.17;
                if (i < 7) {
                    var cr = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.045, 64), mat(0xf3dcae, { roughness: 0.5 }));
                    cr.position.y = y + 0.0225; g.add(cr); y += 0.045;
                }
            }
            var glaze = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.005, R + 0.005, 0.05, 64), gloss(0xdc8420, { roughness: 0.25, clearcoat: 0.6 }));
            glaze.position.y = y + 0.025; g.add(glaze);
            return y + 0.05;
        },
        "nutty-bubly": function (g) {
            var H = 1.62, NB = [0xc9862a, 0xdc9f3e, 0xb06f1e, 0xe9b95c];
            core(g, H, 0xb8741f);
            coat(g, { n: 1900, geo: geoIco, y0: 0.02, y1: H - 0.1, sx: 1, sy: 1, sz: 1, smin: 0.075, smax: 0.12, colors: NB, rough: 0.5 });
            var T = creamTop(g, H, 0xd9b88c, { thick: 0.22 });
            ring(g, 5, 1.08, T, "swirl", mat(0xe2c9a4, { roughness: 0.45 }));
            mound(g, { n: 150, geo: geoIco, y: T, peak: 0.22, radius: 0.5, sx: 1, sy: 1, sz: 1, smin: 0.06, smax: 0.1, colors: NB, rough: 0.5 });
            return T;
        },
        "pista": function (g) {
            var T = ridgedBody(g, 1.7, 0x98c07c, 0.15);
            ring(g, 26, R - 0.06, T, "tiny", mat(0x86b955, { roughness: 0.45 }));
            return T;
        },
        "strawberry": function (g) {
            var T = ridgedBody(g, 1.7, 0xe4808f, 0.15);
            ring(g, 26, R - 0.06, T, "tiny", mat(0xdf6f89, { roughness: 0.45 }));
            return T;
        },
        "mango": function (g) {
            var T = ridgedBody(g, 1.7, 0xf0a800, 0.15);
            ring(g, 26, R - 0.06, T, "tiny", mat(0xf5b60a, { roughness: 0.45 }));
            return T;
        },
        "pineapple": function (g) {
            var T = ridgedBody(g, 1.7, 0xebcf6f, 0.15);
            var wedge = [1, 4, 6, 8];
            ring(g, 10, R - 0.25, T, "kiss", mat(PIPED, { roughness: 0.4 }), function (i, a, m, h) {
                if (wedge.indexOf(i) < 0) return;
                var w = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 3), gloss(0xf5d33a, { roughness: 0.3 }));
                w.position.set(m.position.x, T + h + 0.1, m.position.z);
                w.rotation.set(0.2, -a, 0.15);
                g.add(w);
            });
            return T;
        },
        "chocolate": function (g) {
            var H = 1.62;
            core(g, H, 0x2a140c);
            coat(g, { n: 2800, geo: shaving, y0: 0.02, y1: H - 0.1, sx: 0.12, sy: 0.03, sz: 0.06, smin: 0.7, smax: 1.3, colors: CHOC });
            var T = creamTop(g, H, 0x8a5a3b, { glossy: true });
            ring(g, 7, 1.1, T, "swirl", gloss(0x7b4a2c, { roughness: 0.3, clearcoat: 0.5 }));
            mound(g, { n: 220, geo: shaving, y: T, peak: 0.24, radius: 0.5, sx: 0.12, sy: 0.04, sz: 0.06, smin: 0.8, smax: 1.3, colors: CHOC });
            return T;
        }
    };

    // Used when assets/data/cakes.csv can't be read
    var DEFAULTS = [
        ["Black Forest", "black-forest"], ["White Forest", "white-forest"], ["Red Velvet", "red-velvet"],
        ["Vancho", "vancho"], ["Butter Scotch", "butterscotch"], ["Honey Cake", "honey-cake"],
        ["Nutty Bubly", "nutty-bubly"], ["Pista Cake", "pista"], ["Strawberry Cake", "strawberry"],
        ["Mango Cake", "mango"], ["Pineapple Cake", "pineapple"], ["Chocolate Cake", "chocolate"]
    ].map(function (p) { return { name: p[0], price: "", key: p[1] }; });

    var cakes = DEFAULTS;
    var cakeIndex = 0;
    var built = {};
    var current = null;

    /* ---------- Stage: cake board, contact shadow, sprinkles ---------- */
    var root = new THREE.Group();
    scene.add(root);

    var goldEdge = new THREE.Mesh(new THREE.CylinderGeometry(2.06, 2.06, 0.03, 80), mat(0xc9a45c, { roughness: 0.4, metalness: 0.4 }));
    goldEdge.position.y = 0.015;
    root.add(goldEdge);
    var board = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.03, 80), mat(0xffffff, { roughness: 0.4 }));
    board.position.y = 0.045;
    root.add(board);

    (function () {
        var c = document.createElement("canvas");
        c.width = c.height = 128;
        var g = c.getContext("2d");
        var grad = g.createRadialGradient(64, 64, 20, 64, 64, 64);
        grad.addColorStop(0, "rgba(0,40,90,.38)");
        grad.addColorStop(1, "rgba(0,40,90,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
        var shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(7.4, 7.4),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = -0.03;
        root.add(shadow);
    })();

    var cakeSlot = new THREE.Group();
    cakeSlot.position.y = BASE;
    root.add(cakeSlot);

    var SPR = 64;
    var sprinkles = new THREE.InstancedMesh(
        new THREE.CapsuleGeometry(0.035, 0.15, 4, 8),
        new THREE.MeshStandardMaterial({ roughness: 0.45 }),
        SPR
    );
    var sprData = [];
    var palette = [0x009fe8, 0xffffff, 0xff7aa8, 0xffd34d, 0x3f3f95, 0x66ccff].map(function (c) { return new THREE.Color(c); });
    function rand(a, b) { return a + Math.random() * (b - a); }
    for (var s = 0; s < SPR; s++) {
        sprData.push({
            a: Math.random() * Math.PI * 2, r: rand(3.3, 4.3), y: rand(0.1, 2.3),
            sp: rand(0.12, 0.35) * (Math.random() < 0.5 ? -1 : 1), bob: rand(0, 6.28),
            rx: rand(0, 3), ry: rand(0, 3), rs: rand(0.4, 1.4)
        });
        sprinkles.setColorAt(s, palette[s % palette.length]);
    }
    sprinkles.instanceColor.needsUpdate = true;
    scene.add(sprinkles);

    function updateSprinkles(t) {
        for (var i = 0; i < SPR; i++) {
            var d = sprData[i], a = d.a + t * d.sp;
            // swing around the back half only, so nothing ever floats in front of the cake
            dummy.position.set(Math.cos(a) * d.r, d.y + Math.sin(t * 0.8 + d.bob) * 0.15, -Math.abs(Math.sin(a)) * d.r * 0.9 - 0.4);
            dummy.rotation.set(d.rx + t * d.rs, d.ry + t * d.rs * 0.7, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            sprinkles.setMatrixAt(i, dummy.matrix);
        }
        sprinkles.instanceMatrix.needsUpdate = true;
    }

    /* ---------- Switching cakes ---------- */
    var popT = 1, spinVel = 0, topY = 1.8;

    function showCake(i, instant) {
        cakeIndex = (i + cakes.length) % cakes.length;
        var c = cakes[cakeIndex];
        if (current) current.visible = false;
        if (!built[c.key]) {
            var g = new THREE.Group();
            seed = hash(c.key);
            g.userData.top = MODELS[c.key](g);
            built[c.key] = g;
            cakeSlot.add(g);
        }
        current = built[c.key];
        current.visible = true;
        topY = current.userData.top;
        popT = instant ? 1 : 0;
        if (!instant) spinVel += 5;

        var nameEl = document.getElementById("flavourName");
        var labelEl = document.getElementById("flavourLabel");
        var priceEl = document.getElementById("priceMain");
        var unitEl = document.getElementById("priceUnit");
        if (nameEl) nameEl.textContent = c.name;
        if (labelEl) labelEl.textContent = c.key === "black-forest" ? "Signature" : "Our cake";
        if (priceEl && c.price) {
            var m = c.price.match(/^(.*?)\s*(per\s.*)$/i);
            priceEl.textContent = m ? m[1] : c.price;
            if (unitEl) unitEl.textContent = m ? m[2] : "";
        }
        if (flavourBtn) flavourBtn.setAttribute("aria-label", "Show next cake, currently " + c.name);
        kick();
    }

    /* ---------- Interaction ---------- */
    var yaw = 0.6, dragging = false, moved = 0, lastX = 0, lastT = 0;
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
            var dx = e.clientX - lastX, now = performance.now(), dt = Math.max(1, now - lastT) / 1000;
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
        if (moved < 6 && e && e.type === "pointerup") showCake(cakeIndex + 1);
        spinVel = Math.max(-8, Math.min(8, spinVel));
        kick();
    }
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", function () { tpx = 0; tpy = 0; kick(); });

    if (flavourBtn) flavourBtn.addEventListener("click", function () { showCake(cakeIndex + 1); });

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

        if (!dragging) {
            yaw += (reduceMotion ? 0 : 0.28 * dt) + spinVel * dt;
            spinVel *= Math.pow(0.02, dt);
        }
        px += (tpx - px) * (1 - Math.exp(-dt * 5));
        py += (tpy - py) * (1 - Math.exp(-dt * 5));

        if (popT < 1) popT = Math.min(1, popT + dt * 2.2);
        var e = popT === 1 ? 1 : 1 + 2.70158 * Math.pow(popT - 1, 3) + 1.70158 * Math.pow(popT - 1, 2); // easeOutBack
        cakeSlot.scale.setScalar(Math.max(0.001, e));

        var scrollY = window.scrollY || 0;
        root.rotation.y = yaw + scrollY * 0.003;
        root.position.y = reduceMotion ? 0 : Math.sin(clock * 1.2) * 0.07;
        root.rotation.z = px * 0.03;

        var elev = 0.56 + py * 0.08 - Math.min(scrollY, 600) * 0.0001;
        var dist = camera.userData.dist || 11;
        camera.position.set(Math.sin(px * 0.25) * dist * 0.15, Math.sin(elev) * dist, Math.cos(elev) * dist);
        camera.lookAt(0, 0.8, 0);

        updateSprinkles(clock);
        renderer.render(scene, camera);

        if (visible && (!reduceMotion || dragging || now < idleUntil || Math.abs(spinVel) > 0.01 || popT < 1)) {
            requestAnimationFrame(frame);
        } else {
            running = false;
        }
    }

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

    /* ---------- Go: follow the menu in cakes.csv ---------- */
    function start() {
        showCake(0, true);
        resize();
        visual.classList.add("hero-3d");
        if (flavourBtn) flavourBtn.hidden = false;
        kick();
    }

    fetch("assets/data/cakes.csv")
        .then(function (r) { if (!r.ok) throw new Error("csv"); return r.text(); })
        .then(function (text) {
            var list = [];
            text.split(/\r?\n/).slice(1).forEach(function (line) {
                if (!line.trim()) return;
                var parts = line.split(",");
                if (parts.length < 4) return;
                var k = parts[parts.length - 1].trim().replace(/\.[^.]+$/, "");
                if (MODELS[k]) list.push({ name: parts[0].trim(), price: parts[1].trim(), key: k });
            });
            if (list.length) cakes = list;
        })
        .catch(function () { /* keep the built-in list */ })
        .then(start);
})();
