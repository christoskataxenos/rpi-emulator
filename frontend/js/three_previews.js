// ============================================================
// three_previews.js — Premium 3D Component Previews για Sidebar
// Χρησιμοποιεί Three.js r183 με ES Module imports για
// PBR materials, tone mapping, και animated rendering.
// Κάθε component card αποκτά ένα ανεξάρτητο WebGL context.
// ============================================================

// Σταθερές για κοινά χρώματα PBR υλικών
const COLORS = {
    PCB_GREEN:    0x1a6b3a,
    METAL_GOLD:   0xd4a84b,
    METAL_SILVER: 0xb8bfc9,
    LED_RED_OFF:  0x5a1a1a,
    LED_RED_ON:   0xff3344,
    LED_GREEN_OFF:0x1a4a2a,
    LED_GREEN_ON: 0x00ff88,
    LED_BLUE_OFF: 0x1a2a5a,
    LED_BLUE_ON:  0x4499ff,
    LED_YELLOW_OFF:0x4a4a1a,
    LED_YELLOW_ON: 0xffee00,
    RESISTOR_BODY: 0xc8a870,
    BUTTON_BODY:   0x1a1a1a,
    BUTTON_RED:    0xee2233,
    BUZZER_BODY:   0x111111,
    DHT_BLUE:      0x1a4a9a,
    PIR_WHITE:     0xe8e8e0,
    LDR_BODY:      0xf0c040,
    ULTRASONIC:    0x2a4a9a,
    POTENTIOMETER: 0x1a1a2a,
};

// ============================================================
// ComponentPreviewRenderer — Renderer για ένα μεμονωμένο card
// ============================================================
class ComponentPreviewRenderer {
    constructor(canvas_element, comp_type, comp_options = {}) {
        this.canvas = canvas_element;
        this.comp_type = comp_type;
        this.options = comp_options;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.group = null;       // Περιέχει το 3D model
        this.timer_id = null;
        this.is_active = true;   // Για pause όταν δεν φαίνεται
        this._init();
    }

    _init() {
        const W = this.canvas.clientWidth  || 80;
        const H = this.canvas.clientHeight || 80;

        // --- Scene ---
        this.scene = new THREE.Scene();
        // Σκούρο ουδέτερο φόντο — ταιριάζει με το glass-panel
        this.scene.background = new THREE.Color(0x1a1e27);

        // --- Camera (Perspective, μικρό FOV για "telephoto" feel) ---
        this.camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
        this.camera.position.set(0, 1.2, 3.8);
        this.camera.lookAt(0, 0, 0);

        // --- Renderer με premium settings ---
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
        });
        this.renderer.setSize(W, H, false); // false = δεν αλλάζει CSS
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        // Σωστό color space (Three.js r152+)
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        // ACES Filmic tone mapping για κινηματογραφική αίσθηση
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        // Shadows για depth
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // --- Lighting ---
        this._setup_lights();

        // --- 3D Model ---
        this.group = new THREE.Group();
        this._build_model();
        this.scene.add(this.group);

        // --- Subtle floor για shadow reception ---
        const floor_geo = new THREE.PlaneGeometry(6, 6);
        const floor_mat = new THREE.MeshStandardMaterial({
            color: 0x12151e,
            roughness: 0.9,
            metalness: 0.0,
        });
        const floor = new THREE.Mesh(floor_geo, floor_mat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.85;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // --- Timer για animation ---
        this.timer = new THREE.Timer();
        this._animate();
    }

    // --------------------------------------------------------
    // Φωτισμός: key light + fill + rim + point glow
    // --------------------------------------------------------
    _setup_lights() {
        // Ambient — γενικό muted fill
        const ambient = new THREE.AmbientLight(0x8899bb, 0.4);
        this.scene.add(ambient);

        // Key light — κύρια πηγή από πάνω-δεξιά-μπροστά
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(2.5, 4, 3);
        key.castShadow = true;
        key.shadow.mapSize.width  = 512;
        key.shadow.mapSize.height = 512;
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far  = 20;
        key.shadow.bias = -0.002;
        this.scene.add(key);

        // Fill light — μαλακό από αριστερά για να μη σκοτεινιάσουν τελείως
        const fill = new THREE.DirectionalLight(0x4466aa, 0.6);
        fill.position.set(-3, 1, 1);
        this.scene.add(fill);

        // Rim light — πίσω-πάνω για καθορισμό silhouette
        const rim = new THREE.DirectionalLight(0xaaccff, 0.8);
        rim.position.set(0, 3, -4);
        this.scene.add(rim);
    }

    // --------------------------------------------------------
    // Factory: δημιουργεί το σωστό 3D model ανά τύπο
    // --------------------------------------------------------
    _build_model() {
        switch (this.comp_type) {
            case "LED":         this._build_led();         break;
            case "RESISTOR":    this._build_resistor();    break;
            case "BUTTON":      this._build_button();      break;
            case "BUZZER":      this._build_buzzer();      break;
            case "DHT11":       this._build_dht11();       break;
            case "PIR":         this._build_pir();         break;
            case "LDR":         this._build_ldr();         break;
            case "ULTRASONIC":  this._build_ultrasonic();  break;
            case "POTENTIOMETER": this._build_potentiometer(); break;
            default:            this._build_generic();     break;
        }
    }

    // --------------------------------------------------------
    // LED — Κύλινδρος + dome + δύο πόδια
    // --------------------------------------------------------
    _build_led() {
        const color_map = {
            red:    { off: COLORS.LED_RED_OFF,    on: COLORS.LED_RED_ON    },
            green:  { off: COLORS.LED_GREEN_OFF,  on: COLORS.LED_GREEN_ON  },
            blue:   { off: COLORS.LED_BLUE_OFF,   on: COLORS.LED_BLUE_ON   },
            yellow: { off: COLORS.LED_YELLOW_OFF, on: COLORS.LED_YELLOW_ON },
        };

        const led_color_key = this.options.color || "red";
        const colors = color_map[led_color_key] || color_map.red;
        this.led_colors = colors; // αποθήκευση για animation

        // Σώμα (κύλινδρος κάτω μέρος)
        const body_geo = new THREE.CylinderGeometry(0.32, 0.32, 0.45, 32);
        this.led_body_mat = new THREE.MeshStandardMaterial({
            color: colors.off,
            roughness: 0.25,
            metalness: 0.05,
            emissive: new THREE.Color(colors.off),
            emissiveIntensity: 0.08,
        });
        const body = new THREE.Mesh(body_geo, this.led_body_mat);
        body.position.y = 0.0;
        body.castShadow = true;
        this.group.add(body);

        // Dome (επάνω ημισφαίριο — φακός)
        const dome_geo = new THREE.SphereGeometry(0.32, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        this.led_dome_mat = new THREE.MeshStandardMaterial({
            color: colors.off,
            roughness: 0.08,
            metalness: 0.0,
            emissive: new THREE.Color(colors.off),
            emissiveIntensity: 0.15,
            transparent: true,
            opacity: 0.85,
        });
        const dome = new THREE.Mesh(dome_geo, this.led_dome_mat);
        dome.position.y = 0.225;
        dome.castShadow = true;
        this.group.add(dome);

        // Μεταλλική βάση
        const base_geo = new THREE.CylinderGeometry(0.34, 0.34, 0.06, 32);
        const base_mat = new THREE.MeshStandardMaterial({
            color: COLORS.METAL_SILVER,
            roughness: 0.3,
            metalness: 0.9,
        });
        const base = new THREE.Mesh(base_geo, base_mat);
        base.position.y = -0.25;
        base.castShadow = true;
        this.group.add(base);

        // Πόδια (leads)
        this._add_lead(this.group, -0.1, -0.25, 0.6);
        this._add_lead(this.group,  0.1, -0.25, 0.6);

        // Point light για glow effect (κρυφό — animated)
        this.led_point = new THREE.PointLight(colors.off, 0, 2.5);
        this.led_point.position.set(0, 0.5, 0.5);
        this.group.add(this.led_point);

        // Αρχική κατάσταση: lit (για preview)
        this._set_led_lit(true);

        // Ελαφρά κλίση της ομάδας για να φαίνεται το dome
        this.group.rotation.x = -0.25;
    }

    // Ορισμός lit/unlit κατάστασης LED
    _set_led_lit(lit) {
        if (!this.led_body_mat) return;
        const colors = this.led_colors;
        const target = lit ? colors.on : colors.off;
        this.led_body_mat.color.set(target);
        this.led_dome_mat.color.set(target);
        this.led_body_mat.emissive.set(target);
        this.led_dome_mat.emissive.set(target);
        this.led_body_mat.emissiveIntensity = lit ? 0.6 : 0.08;
        this.led_dome_mat.emissiveIntensity = lit ? 1.8 : 0.15;
        if (this.led_point) {
            this.led_point.color.set(target);
            this.led_point.intensity = lit ? 1.8 : 0;
        }
    }

    // --------------------------------------------------------
    // RESISTOR — Κύλινδρος με χρωματικές λωρίδες
    // --------------------------------------------------------
    _build_resistor() {
        const resistance = this.options.resistance || 330;

        // Σώμα (μπεζ κεραμικό)
        const body_geo = new THREE.CylinderGeometry(0.22, 0.22, 0.9, 24);
        const body_mat = new THREE.MeshStandardMaterial({
            color: COLORS.RESISTOR_BODY,
            roughness: 0.85,
            metalness: 0.0,
        });
        const body = new THREE.Mesh(body_geo, body_mat);
        body.rotation.z = Math.PI / 2; // Οριζόντια τοποθέτηση
        body.castShadow = true;
        this.group.add(body);

        // Χρωματικές λωρίδες (Color Bands) — πάνω στο σώμα
        const band_colors = resistance === 330
            ? [0x8b4513, 0xff6600, 0x8b4513, 0xffd700]  // 330Ω: καφέ, πορτοκαλί, καφέ, χρυσό
            : [0x8b4513, 0x000000, 0xff6600, 0xffd700];  // 10kΩ: καφέ, μαύρο, πορτοκαλί, χρυσό

        const band_positions = [-0.3, -0.1, 0.1, 0.35];
        band_colors.forEach((col, i) => {
            const band_geo = new THREE.TorusGeometry(0.225, 0.025, 8, 24);
            const band_mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0.0 });
            const band = new THREE.Mesh(band_geo, band_mat);
            band.rotation.x = Math.PI / 2; // Ευθυγράμμιση με τον άξονα
            band.position.set(band_positions[i], 0, 0);
            this.group.add(band);
        });

        // Μεταλλικά άκρα (caps)
        [-0.5, 0.5].forEach(x => {
            const cap_geo = new THREE.CylinderGeometry(0.23, 0.23, 0.08, 24);
            const cap_mat = new THREE.MeshStandardMaterial({ color: COLORS.METAL_SILVER, roughness: 0.2, metalness: 0.95 });
            const cap = new THREE.Mesh(cap_geo, cap_mat);
            cap.rotation.z = Math.PI / 2;
            cap.position.x = x;
            this.group.add(cap);
        });

        // Πόδια
        this._add_horiz_lead(this.group, -0.75, 0.55);
        this._add_horiz_lead(this.group,  0.75, 0.55);

        this.group.rotation.x = -0.2;
        this.group.position.y = 0.1;
    }

    // --------------------------------------------------------
    // BUTTON — Τετράγωνη μαύρη βάση + κόκκινο dome + πόδια
    // --------------------------------------------------------
    _build_button() {
        // Μαύρη πλαστική βάση
        const base_geo = new THREE.BoxGeometry(0.8, 0.3, 0.8);
        const base_mat = new THREE.MeshStandardMaterial({
            color: COLORS.BUTTON_BODY,
            roughness: 0.6,
            metalness: 0.1,
        });
        const base = new THREE.Mesh(base_geo, base_mat);
        base.position.y = -0.1;
        base.castShadow = true;
        this.group.add(base);

        // Ο κόκκινος διακόπτης (plunger)
        const plunger_geo = new THREE.CylinderGeometry(0.22, 0.22, 0.25, 32);
        this.btn_mat = new THREE.MeshStandardMaterial({
            color: COLORS.BUTTON_RED,
            roughness: 0.3,
            metalness: 0.15,
            emissive: new THREE.Color(COLORS.BUTTON_RED),
            emissiveIntensity: 0.12,
        });
        const plunger = new THREE.Mesh(plunger_geo, this.btn_mat);
        plunger.position.y = 0.175;
        plunger.castShadow = true;
        this.group.add(plunger);

        // 4 μεταλλικά πόδια στις γωνίες
        [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].forEach(([x, z]) => {
            const leg_geo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
            const leg_mat = new THREE.MeshStandardMaterial({ color: COLORS.METAL_GOLD, roughness: 0.2, metalness: 0.95 });
            const leg = new THREE.Mesh(leg_geo, leg_mat);
            leg.position.set(x, -0.45, z);
            this.group.add(leg);
        });

        this.group.rotation.x = -0.3;
        this.group.position.y = 0.2;
    }

    // --------------------------------------------------------
    // BUZZER — Μαύρος δίσκος + ζέβρα patterns + πόδια
    // --------------------------------------------------------
    _build_buzzer() {
        // Κυρίως σώμα (cylinder)
        const body_geo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 32);
        const body_mat = new THREE.MeshStandardMaterial({
            color: COLORS.BUZZER_BODY,
            roughness: 0.7,
            metalness: 0.2,
        });
        const body = new THREE.Mesh(body_geo, body_mat);
        body.castShadow = true;
        this.group.add(body);

        // Πάνω επιφάνεια με ομόκεντρους κύκλους (membrane effect)
        for (let r = 0.12; r <= 0.42; r += 0.1) {
            const ring_geo = new THREE.TorusGeometry(r, 0.012, 6, 32);
            const ring_mat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
            const ring = new THREE.Mesh(ring_geo, ring_mat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.155;
            this.group.add(ring);
        }

        // Κεντρική τρύπα (μαύρος κύκλος)
        const hole_geo = new THREE.CircleGeometry(0.08, 16);
        const hole_mat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1.0 });
        const hole = new THREE.Mesh(hole_geo, hole_mat);
        hole.rotation.x = -Math.PI / 2;
        hole.position.y = 0.165;
        this.group.add(hole);

        // Πλαστική βάση
        const base_geo = new THREE.CylinderGeometry(0.52, 0.52, 0.08, 32);
        const base_mat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.05 });
        const base = new THREE.Mesh(base_geo, base_mat);
        base.position.y = -0.19;
        this.group.add(base);

        // Πόδια
        this._add_lead(this.group, -0.15, -0.23, 0.45);
        this._add_lead(this.group,  0.15, -0.23, 0.45);

        // Animated sound waves (πόντοι φωτός)
        this.buzzer_point = new THREE.PointLight(0x00ccff, 0, 2.5);
        this.buzzer_point.position.set(0, 0.8, 0.5);
        this.group.add(this.buzzer_point);

        this.group.rotation.x = -0.3;
    }

    // --------------------------------------------------------
    // DHT11 — Μπλε ορθογώνιο block με λευκή πλέγμα-επιφάνεια
    // --------------------------------------------------------
    _build_dht11() {
        const DHT_BLUE = 0x1a4a9a;

        // Μπλε κυρίως σώμα
        const body_geo = new THREE.BoxGeometry(0.7, 1.1, 0.3);
        const body_mat = new THREE.MeshStandardMaterial({
            color: DHT_BLUE,
            roughness: 0.5,
            metalness: 0.1,
        });
        const body = new THREE.Mesh(body_geo, body_mat);
        body.castShadow = true;
        this.group.add(body);

        // Λευκό πλέγμα (πρόσοψη αισθητήρα)
        const grid_geo = new THREE.BoxGeometry(0.5, 0.55, 0.05);
        const grid_mat = new THREE.MeshStandardMaterial({ color: 0xeeeeff, roughness: 0.7 });
        const grid = new THREE.Mesh(grid_geo, grid_mat);
        grid.position.set(0, 0.22, 0.175);
        this.group.add(grid);

        // Οριζόντιες γραμμές πάνω στο πλέγμα
        for (let i = -2; i <= 2; i++) {
            const line_geo = new THREE.BoxGeometry(0.45, 0.015, 0.06);
            const line_mat = new THREE.MeshStandardMaterial({ color: 0x9999bb, roughness: 0.9 });
            const line = new THREE.Mesh(line_geo, line_mat);
            line.position.set(0, 0.22 + i * 0.09, 0.18);
            this.group.add(line);
        }

        // 3 πόδια (VCC, DATA, GND)
        [-0.2, 0, 0.2].forEach(x => {
            const leg_geo = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8);
            const leg_mat = new THREE.MeshStandardMaterial({ color: COLORS.METAL_GOLD, roughness: 0.2, metalness: 0.9 });
            const leg = new THREE.Mesh(leg_geo, leg_mat);
            leg.position.set(x, -0.77, 0);
            this.group.add(leg);
        });

        this.group.rotation.x = -0.2;
        this.group.position.y = 0.15;
    }

    // --------------------------------------------------------
    // PIR — Λευκό ημισφαίριο dome + κυκλική βάση PCB
    // --------------------------------------------------------
    _build_pir() {
        // Φρεσνέλ φακός (λευκό ημισφαίριο)
        const dome_geo = new THREE.SphereGeometry(0.55, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const dome_mat = new THREE.MeshStandardMaterial({
            color: COLORS.PIR_WHITE,
            roughness: 0.2,
            metalness: 0.0,
            transparent: true,
            opacity: 0.82,
        });
        const dome = new THREE.Mesh(dome_geo, dome_mat);
        dome.position.y = 0.15;
        dome.castShadow = true;
        this.group.add(dome);

        // Κυκλική PCB βάση (πράσινη)
        const pcb_geo = new THREE.CylinderGeometry(0.58, 0.58, 0.1, 32);
        const pcb_mat = new THREE.MeshStandardMaterial({
            color: COLORS.PCB_GREEN,
            roughness: 0.6,
            metalness: 0.15,
        });
        const pcb = new THREE.Mesh(pcb_geo, pcb_mat);
        pcb.position.y = 0.05;
        this.group.add(pcb);

        // 3 πόδια
        [-0.2, 0, 0.2].forEach(x => {
            const leg_geo = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8);
            const leg_mat = new THREE.MeshStandardMaterial({ color: COLORS.METAL_GOLD, roughness: 0.2, metalness: 0.9 });
            const leg = new THREE.Mesh(leg_geo, leg_mat);
            leg.position.set(x, -0.27, 0);
            this.group.add(leg);
        });

        this.group.rotation.x = -0.3;
        this.group.position.y = 0.1;
    }

    // --------------------------------------------------------
    // LDR — Κεραμικό σώμα με zigzag pattern
    // --------------------------------------------------------
    _build_ldr() {
        // Κυκλικό κεραμικό σώμα
        const body_geo = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 32);
        const body_mat = new THREE.MeshStandardMaterial({
            color: COLORS.LDR_BODY,
            roughness: 0.6,
            metalness: 0.0,
            emissive: new THREE.Color(0x332200),
            emissiveIntensity: 0.15,
        });
        const body = new THREE.Mesh(body_geo, body_mat);
        body.position.y = 0.1;
        body.castShadow = true;
        this.group.add(body);

        // Διαδρομή αντίστασης (zigzag pattern πάνω στον δίσκο) — 2 τόξα
        for (let i = 0; i < 3; i++) {
            const arc_geo = new THREE.TorusGeometry(0.13 + i * 0.07, 0.014, 6, 12, Math.PI);
            const arc_mat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
            const arc = new THREE.Mesh(arc_geo, arc_mat);
            arc.rotation.x = Math.PI / 2;
            arc.rotation.z = i % 2 === 0 ? 0 : Math.PI;
            arc.position.y = 0.165;
            this.group.add(arc);
        }

        // Πόδια
        this._add_lead(this.group, -0.12, 0.04, 0.55);
        this._add_lead(this.group,  0.12, 0.04, 0.55);

        this.group.rotation.x = -0.3;
        this.group.position.y = 0.1;
    }

    // --------------------------------------------------------
    // ULTRASONIC — HC-SR04 board με δύο κυλινδρικούς μεταδότες
    // --------------------------------------------------------
    _build_ultrasonic() {
        // PCB board (ορθογώνιο)
        const board_geo = new THREE.BoxGeometry(1.4, 0.08, 0.7);
        const board_mat = new THREE.MeshStandardMaterial({
            color: COLORS.PCB_GREEN,
            roughness: 0.6,
            metalness: 0.15,
        });
        const board = new THREE.Mesh(board_geo, board_mat);
        board.castShadow = true;
        this.group.add(board);

        // 2 κυλινδρικοί transducers
        [-0.38, 0.38].forEach(x => {
            const trans_geo = new THREE.CylinderGeometry(0.2, 0.2, 0.35, 24);
            const trans_mat = new THREE.MeshStandardMaterial({
                color: 0x2a4a9a,
                roughness: 0.3,
                metalness: 0.4,
            });
            const trans = new THREE.Mesh(trans_geo, trans_mat);
            trans.rotation.x = Math.PI / 2;
            trans.position.set(x, 0.2, 0.0);
            trans.castShadow = true;
            this.group.add(trans);

            // Πλέγμα transducer
            const face_geo = new THREE.CircleGeometry(0.18, 24);
            const face_mat = new THREE.MeshStandardMaterial({ color: 0x111133, roughness: 0.9 });
            const face = new THREE.Mesh(face_geo, face_mat);
            face.position.set(x, 0.2, 0.355);
            this.group.add(face);
        });

        // 4 πόδια
        [-0.55, -0.18, 0.18, 0.55].forEach(x => {
            const leg_geo = new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8);
            const leg_mat = new THREE.MeshStandardMaterial({ color: COLORS.METAL_GOLD, roughness: 0.2, metalness: 0.9 });
            const leg = new THREE.Mesh(leg_geo, leg_mat);
            leg.position.set(x, -0.21, -0.25);
            this.group.add(leg);
        });

        this.group.rotation.x = -0.35;
        this.group.position.y = 0.1;
    }

    // --------------------------------------------------------
    // POTENTIOMETER — Μπλε/μαύρο block με ρυθμιστικό knob
    // --------------------------------------------------------
    _build_potentiometer() {
        // Σώμα
        const body_geo = new THREE.BoxGeometry(0.65, 0.55, 0.65);
        const body_mat = new THREE.MeshStandardMaterial({
            color: COLORS.POTENTIOMETER,
            roughness: 0.55,
            metalness: 0.2,
        });
        const body = new THREE.Mesh(body_geo, body_mat);
        body.castShadow = true;
        this.group.add(body);

        // Περιστροφικό knob πάνω μέρος
        const knob_geo = new THREE.CylinderGeometry(0.22, 0.22, 0.22, 24);
        const knob_mat = new THREE.MeshStandardMaterial({
            color: COLORS.METAL_SILVER,
            roughness: 0.2,
            metalness: 0.85,
        });
        const knob = new THREE.Mesh(knob_geo, knob_mat);
        knob.position.y = 0.385;
        knob.castShadow = true;
        this.group.add(knob);
        this.knob = knob; // Αποθήκευση για animation

        // Ένδειξη (γραμμή πάνω στο knob)
        const mark_geo = new THREE.BoxGeometry(0.04, 0.235, 0.04);
        const mark_mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const mark = new THREE.Mesh(mark_geo, mark_mat);
        mark.position.set(0, 0.385, 0.13);
        this.group.add(mark);
        this.knob_mark = mark;

        // 3 πόδια
        [-0.2, 0, 0.2].forEach(x => {
            const leg_geo = new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8);
            const leg_mat = new THREE.MeshStandardMaterial({ color: COLORS.METAL_GOLD, roughness: 0.2, metalness: 0.9 });
            const leg = new THREE.Mesh(leg_geo, leg_mat);
            leg.position.set(x, -0.485, 0.0);
            this.group.add(leg);
        });

        this.group.rotation.x = -0.2;
        this.group.position.y = 0.15;
    }

    // --------------------------------------------------------
    // Generic fallback
    // --------------------------------------------------------
    _build_generic() {
        const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const mat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.6, metalness: 0.3 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        this.group.add(mesh);
    }

    // --------------------------------------------------------
    // Βοηθητικές: δημιουργία πόδιων (leads)
    // --------------------------------------------------------
    _add_lead(parent, x, y_start, length) {
        const geo = new THREE.CylinderGeometry(0.03, 0.03, length, 8);
        const mat = new THREE.MeshStandardMaterial({ color: COLORS.METAL_SILVER, roughness: 0.25, metalness: 0.9 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y_start - length / 2, 0);
        parent.add(mesh);
    }

    _add_horiz_lead(parent, x, length) {
        const geo = new THREE.CylinderGeometry(0.03, 0.03, length, 8);
        const mat = new THREE.MeshStandardMaterial({ color: COLORS.METAL_SILVER, roughness: 0.25, metalness: 0.9 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(x > 0 ? 0.5 + length / 2 : -0.5 - length / 2, 0, 0);
        parent.add(mesh);
    }

    // --------------------------------------------------------
    // Animation loop
    // --------------------------------------------------------
    _animate() {
        if (!this.is_active) return;

        this.timer.update();
        const elapsed = this.timer.getElapsed();
        const delta   = this.timer.getDelta();

        // Ήπια αυτόματη περιστροφή
        if (this.group) {
            this.group.rotation.y += delta * 0.55;
        }

        // LED: pulse glow
        if (this.comp_type === "LED" && this.led_point) {
            const pulse = 0.7 + 0.3 * Math.sin(elapsed * 3.5);
            this.led_point.intensity = 1.8 * pulse;
            if (this.led_dome_mat) {
                this.led_dome_mat.emissiveIntensity = 1.0 + 0.8 * Math.sin(elapsed * 3.5);
            }
        }

        // BUZZER: sound wave glow
        if (this.comp_type === "BUZZER" && this.buzzer_point) {
            const wave = 0.5 + 0.5 * Math.sin(elapsed * 6.0);
            this.buzzer_point.intensity = wave * 0.8;
        }

        // POTENTIOMETER: knob slow rotation demo
        if (this.comp_type === "POTENTIOMETER" && this.knob) {
            this.knob.rotation.y = Math.sin(elapsed * 0.7) * Math.PI * 0.8;
            if (this.knob_mark) {
                this.knob_mark.rotation.y = Math.sin(elapsed * 0.7) * Math.PI * 0.8;
            }
        }

        this.renderer.render(this.scene, this.camera);
        this._raf_id = requestAnimationFrame(() => this._animate());
    }

    // --------------------------------------------------------
    // Public: αλλαγή χρώματος LED on-the-fly
    // --------------------------------------------------------
    set_led_color(color_name) {
        this.options.color = color_name;
        // Rebuild the model με το νέο χρώμα
        this.scene.remove(this.group);
        this.group = new THREE.Group();
        this._build_model();
        this.scene.add(this.group);
    }

    // Public: ορισμός κατάστασης (lit/unlit, sounding, κλπ)
    set_state(state_key, state_val) {
        if (this.comp_type === "LED") {
            this._set_led_lit(state_val);
        }
    }

    // Καθαρισμός WebGL resources
    destroy() {
        this.is_active = false;
        if (this._raf_id) cancelAnimationFrame(this._raf_id);
        this.renderer.dispose();
        this.scene.traverse(obj => {
            if (obj.isMesh) {
                obj.geometry.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
    }
}

// ============================================================
// ThreePreviews — Manager που αρχικοποιεί όλα τα previews
// ============================================================
const ThreePreviews = {
    renderers: {},

    // Αρχικοποίηση μετά την φόρτωση του Three.js
    init() {
        // Εντοπίζουμε κάθε canvas με data-comp-type attribute
        document.querySelectorAll(".comp-3d-canvas").forEach(canvas => {
            const comp_type = canvas.dataset.compType;
            const options = {};
            if (canvas.dataset.color)      options.color      = canvas.dataset.color;
            if (canvas.dataset.resistance) options.resistance = parseInt(canvas.dataset.resistance);

            const comp_id = canvas.id || `preview_${comp_type}_${Math.random().toString(36).slice(2)}`;
            this.renderers[comp_id] = new ComponentPreviewRenderer(canvas, comp_type, options);
        });

        // IntersectionObserver για pause/resume (performance)
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const canvas = entry.target;
                const renderer_id = canvas.id || canvas.dataset.compType;
                const r = this.renderers[renderer_id];
                if (r) {
                    if (entry.isIntersecting && !r.is_active) {
                        r.is_active = true;
                        r._animate();
                    } else if (!entry.isIntersecting) {
                        r.is_active = false;
                    }
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll(".comp-3d-canvas").forEach(c => observer.observe(c));
    },

    // Public: αλλαγή χρώματος LED preview
    set_led_color(canvas_id, color_name) {
        const r = this.renderers[canvas_id];
        if (r) r.set_led_color(color_name);
    },
};

// Εκθέτουμε globally
window.ThreePreviews = ThreePreviews;
window.ComponentPreviewRenderer = ComponentPreviewRenderer;
