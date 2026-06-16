// Κύριο module για τη σχεδίαση και διαχείριση της πλακέτας και των εξαρτημάτων στο HTML5 Canvas
const BreadboardCanvas = {
    canvas: null,
    ctx: null,
    components: {},
    wires: [],
    component_states: {},
    warnings: [],
    
    // Στοιχεία για το drag and drop και την καλωδίωση
    dragged_comp: null,
    drag_offset: { x: 0, y: 0 },
    hovered_terminal: null,
    temp_wire_end: null,

    // Συντεταγμένες και ορισμοί για το Raspberry Pi Board στο Canvas
    rpi_layout: {
        x: 40,
        y: 40,
        width: 180,
        height: 360,
        pins: {} // Αποθηκεύει τις συντεταγμένες κάθε pin στο canvas
    },

    // Λίστα με τις θέσεις και τα ονόματα των 40 pins του Pi
    rpi_pin_definitions: [
        { num: 1, name: "3.3V", type: "VCC3" },    { num: 2, name: "5V", type: "VCC5" },
        { num: 3, name: "GPIO 2", type: "GPIO" },  { num: 4, name: "5V", type: "VCC5" },
        { num: 5, name: "GPIO 3", type: "GPIO" },  { num: 6, name: "GND", type: "GND" },
        { num: 7, name: "GPIO 4", type: "GPIO" },  { num: 8, name: "GPIO 14", type: "GPIO" },
        { num: 9, name: "GND", type: "GND" },     { num: 10, name: "GPIO 15", type: "GPIO" },
        { num: 11, name: "GPIO 17", type: "GPIO" }, { num: 12, name: "GPIO 18", type: "GPIO" },
        { num: 13, name: "GPIO 27", type: "GPIO" }, { num: 14, name: "GND", type: "GND" },
        { num: 15, name: "GPIO 22", type: "GPIO" }, { num: 16, name: "GPIO 23", type: "GPIO" },
        { num: 17, name: "3.3V", type: "VCC3" },   { num: 18, name: "GPIO 24", type: "GPIO" },
        { num: 19, name: "GPIO 10", type: "GPIO" }, { num: 20, name: "GND", type: "GND" },
        { num: 21, name: "GPIO 9", type: "GPIO" },  { num: 22, name: "GPIO 25", type: "GPIO" },
        { num: 23, name: "GPIO 11", type: "GPIO" }, { num: 24, name: "GPIO 8", type: "GPIO" },
        { num: 25, name: "GND", type: "GND" },     { num: 26, name: "GPIO 7", type: "GPIO" },
        { num: 27, name: "GPIO 0", type: "GPIO" },  { num: 28, name: "GPIO 1", type: "GPIO" },
        { num: 29, name: "GPIO 5", type: "GPIO" },  { num: 30, name: "GND", type: "GND" },
        { num: 31, name: "GPIO 6", type: "GPIO" },  { num: 32, name: "GPIO 12", type: "GPIO" },
        { num: 33, name: "GPIO 13", type: "GPIO" }, { num: 34, name: "GND", type: "GND" },
        { num: 35, name: "GPIO 19", type: "GPIO" }, { num: 36, name: "GPIO 16", type: "GPIO" },
        { num: 37, name: "GPIO 26", type: "GPIO" }, { num: 38, name: "GPIO 20", type: "GPIO" },
        { num: 39, name: "GND", type: "GND" },     { num: 40, name: "GPIO 21", type: "GPIO" }
    ],

    init() {
        this.canvas = document.getElementById("circuit-canvas");
        this.ctx = this.canvas.getContext("2d");
        
        this.resize_canvas();
        this.calculate_rpi_pins();
        this.setup_events();
        
        // Έναρξη του loop σχεδίασης (Drawing Loop)
        this.draw_loop();
        
        window.addEventListener("resize", () => {
            this.resize_canvas();
            this.calculate_rpi_pins();
        });
    },

    // Προσαρμογή του μεγέθους του canvas με βάση το parent container
    resize_canvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        // Dynamic fit to screen
        this.rpi_layout.y = 15;
        this.rpi_layout.height = this.canvas.height - 30;
        this.rpi_layout.width = 160;
        this.rpi_layout.x = 20;
    },

    // Υπολογισμός των συντεταγμένων των 40 pins του Pi
    calculate_rpi_pins() {
        const rpi = this.rpi_layout;
        const pin_rows = 20;
        const start_y = rpi.y + 40;
        const spacing_y = (rpi.height - 80) / (pin_rows - 1);
        
        // Row 1 (Αριστερή στήλη - Pins 1, 3, 5...)
        const col1_x = rpi.x + 50;
        // Row 2 (Δεξιά στήλη - Pins 2, 4, 6...)
        const col2_x = rpi.x + 80;

        for (let i = 0; i < this.rpi_pin_definitions.length; i++) {
            const def = this.rpi_pin_definitions[i];
            const row = Math.floor(i / 2);
            const is_even = i % 2 !== 0;
            
            const px = is_even ? col2_x : col1_x;
            const py = start_y + row * spacing_y;
            
            rpi.pins[def.num] = {
                x: px,
                y: py,
                name: def.name,
                type: def.type
            };
        }
    },

    // Σύνδεση των mouse events
    setup_events() {
        const canvas = this.canvas;
        
        // Υποστήριξη Drag and Drop εξαρτημάτων από τη λίστα
        canvas.addEventListener("dragover", (e) => e.preventDefault());
        canvas.addEventListener("drop", (e) => this.handle_drop(e));
        
        // Mouse click & drag αλληλεπιδράσεις
        canvas.addEventListener("mousedown", (e) => this.handle_mousedown(e));
        canvas.addEventListener("mousemove", (e) => this.handle_mousemove(e));
        canvas.addEventListener("mouseup", (e) => this.handle_mouseup(e));
        
        // Διπλό κλικ για διαγραφή εξαρτημάτων ή καλωδίων
        canvas.addEventListener("dblclick", (e) => this.handle_dblclick(e));
    },

    // Χειρισμός απόθεσης (Drop) νέου εξαρτήματος
    handle_drop(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        try {
            const data = JSON.parse(event.dataTransfer.getData("application/json"));
            const comp_type = data.type;
            
            // Παραγωγή μοναδικού ID
            const count = Object.keys(this.components).filter(k => k.startsWith(comp_type)).length + 1;
            const comp_id = `${comp_type}${count}`;
            
            const properties = {};
            if (data.color) properties.color = data.color;
            if (data.resistance) properties.resistance = data.resistance;
            
            // Αποστολή αιτήματος στο backend
            this.api_add_component(comp_id, comp_type, x, y, properties);
        } catch (err) {
            console.error("Σφάλμα κατά το drop εξαρτήματος:", err);
        }
    },

    // REST Κλήση για προσθήκη εξαρτήματος στο backend
    async api_add_component(comp_id, comp_type, x, y, properties) {
        // Αποθηκεύουμε προσωρινά τις συντεταγμένες x, y τοπικά
        properties.x = x;
        properties.y = y;
        
        const payload = {
            id: comp_id,
            type: comp_type,
            properties: properties
        };

        try {
            const response = await fetch("/api/circuit/component", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const err = await response.json();
                ConsoleLogger.stderr(`Σφάλμα: ${err.detail}`);
            }
        } catch (err) {
            ConsoleLogger.stderr(`Σφάλμα δικτύου: ${err}`);
        }
    },

    // Χειρισμός πατήματος κλικ (Mousedown)
    handle_mousedown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 1. Έλεγχος αν έγινε κλικ σε κάποιο terminal (για σύνδεση καλωδίου)
        const term = this.get_terminal_at(x, y);
        if (term) {
            WiringManager.select_terminal(term.comp_id, term.name);
            this.temp_wire_end = { x, y };
            return;
        }
        
        // Ακύρωση τρέχουσας επιλογής αν γίνει κλικ στο κενό
        WiringManager.cancel();
        
        // 2. Έλεγχος αν έγινε κλικ σε εξάρτημα για μετακίνηση (drag)
        const comp = this.get_component_at(x, y);
        if (comp && comp.id !== "RPI") {
            this.dragged_comp = comp;
            this.drag_offset.x = x - (comp.properties.x || x);
            this.drag_offset.y = y - (comp.properties.y || y);
            return;
        }
    }

    // Χειρισμός κίνησης ποντικιού (Mousemove)
    ,handle_mousemove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Αν σύρουμε εξάρτημα, ενημερώνουμε τις συντεταγμένες του
        if (this.dragged_comp) {
            this.dragged_comp.properties.x = x - this.drag_offset.x;
            this.dragged_comp.properties.y = y - this.drag_offset.y;
            return;
        }

        // Αν σχεδιάζουμε καλώδιο, ενημερώνουμε το προσωρινό άκρο
        if (WiringManager.selected_terminal) {
            this.temp_wire_end = { x, y };
        }
        
        // Έλεγχος αν το ποντίκι είναι πάνω από κάποιο terminal (hover effect)
        this.hovered_terminal = this.get_terminal_at(x, y);
        this.update_tooltip(event);
    },

    // Ενημέρωση και εμφάνιση του tooltip με πληροφορίες για το pin
    update_tooltip(event) {
        const tooltip = document.getElementById("pin-details-tooltip");
        if (!tooltip) return;

        if (this.hovered_terminal && this.hovered_terminal.comp_id === "RPI") {
            const pin_num = parseInt(this.hovered_terminal.name.replace("pin", ""));
            const pin_def = this.rpi_pin_definitions[pin_num - 1];
            
            // Get state info if available
            const pin_data = (window.App && window.App.pins_data) ? window.App.pins_data[pin_num] : null;
            const mode = pin_data ? pin_data.mode : pin_def.type;
            const state = pin_data ? pin_data.state : 0;

            let type_greek = "GPIO (Γενική Είσοδος/Έξοδος)";
            let status_class = "status-low";
            let state_text = "LOW (0V)";

            if (pin_def.type === "VCC5") {
                type_greek = "Τροφοδοσία 5V";
                status_class = "status-vcc";
                state_text = "5V";
            } else if (pin_def.type === "VCC3") {
                type_greek = "Τροφοδοσία 3.3V";
                status_class = "status-vcc";
                state_text = "3.3V";
            } else if (pin_def.type === "GND") {
                type_greek = "Γείωση (Ground)";
                status_class = "status-low";
                state_text = "0V";
            } else {
                if (state === 1) {
                    status_class = "status-high";
                    state_text = "HIGH (3.3V)";
                }
            }

            tooltip.innerHTML = `
                <div class="tooltip-title">Pin ${pin_num}: ${pin_def.name}</div>
                <div class="tooltip-detail"><strong>Τύπος:</strong> ${type_greek}</div>
                <div class="tooltip-detail"><strong>Κατάσταση:</strong> ${mode}</div>
                <div class="tooltip-status ${status_class}">${state_text}</div>
            `;

            // Position tooltip near cursor
            const rect = this.canvas.getBoundingClientRect();
            tooltip.style.left = `${event.clientX - rect.left + 15}px`;
            tooltip.style.top = `${event.clientY - rect.top + 15}px`;
            tooltip.style.display = "block";

            // Sync with bottom monitor hover highlight
            if (window.App && window.App.highlight_monitor_pin) {
                window.App.highlight_monitor_pin(pin_num);
            }
        } else {
            tooltip.style.display = "none";
            if (window.App && window.App.highlight_monitor_pin) {
                window.App.highlight_monitor_pin(null);
            }
        }
    },

    // Χειρισμός απελευθέρωσης κλικ (Mouseup)
    handle_mouseup(event) {
        if (this.dragged_comp) {
            // Αποθήκευση της νέας θέσης του εξαρτήματος
            this.dragged_comp = null;
            return;
        }
        
        if (WiringManager.selected_terminal) {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            const term = this.get_terminal_at(x, y);
            if (term) {
                WiringManager.select_terminal(term.comp_id, term.name);
            } else {
                WiringManager.cancel();
            }
            this.temp_wire_end = null;
        }
    },

    // Χειρισμός διπλού κλικ (διαγραφή εξαρτήματος ή καλωδίου)
    handle_dblclick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Έλεγχος για διαγραφή εξαρτήματος
        const comp = this.get_component_at(x, y);
        if (comp && comp.id !== "RPI") {
            this.api_remove_component(comp.id);
            return;
        }

        // Έλεγχος για διαγραφή καλωδίου (διπλό κλικ κοντά στο κέντρο του καλωδίου)
        const wire = this.get_wire_at(x, y);
        if (wire) {
            WiringManager.delete_wire(wire.from_component, wire.from_terminal, wire.to_component, wire.to_terminal);
        }
    },

    // REST Κλήση για αφαίρεση εξαρτήματος
    async api_remove_component(comp_id) {
        try {
            const response = await fetch(`/api/circuit/component/${comp_id}`, {
                method: "DELETE"
            });
            if (response.ok) {
                ConsoleLogger.system(`Αφαιρέθηκε το εξάρτημα ${comp_id}.`);
            }
        } catch (err) {
            ConsoleLogger.stderr(`Σφάλμα σύνδεσης: ${err}`);
        }
    },

    // Εύρεση εξαρτήματος στις συντεταγμένες x, y (εξαιρεί τα άκρα/terminals)
    get_component_at(x, y) {
        for (const comp of Object.values(this.components)) {
            if (comp.id === "RPI") continue;
            const cx = comp.properties.x || 100;
            const cy = comp.properties.y || 100;
            
            // Αν το κλικ είναι πολύ κοντά στα terminals (αριστερά/δεξιά), μην επιλέξεις το εξάρτημα
            const terms_coords = this.get_terminals_coordinates(comp, cx, cy);
            let near_terminal = false;
            for (const coord of Object.values(terms_coords)) {
                if (Math.hypot(x - coord.x, y - coord.y) < 12) {
                    near_terminal = true;
                    break;
                }
            }
            if (near_terminal) continue;

            const size = 20; // Μειώνουμε το μέγεθος της περιοχής drag
            if (Math.hypot(x - cx, y - cy) < size) {
                return comp;
            }
        }
        return null;
    },

    // Εύρεση ακροδέκτη (terminal) στις συντεταγμένες x, y
    get_terminal_at(x, y) {
        // 1. Έλεγχος στα pins του RPi
        for (const [pin_num, pin_coord] of Object.entries(this.rpi_layout.pins)) {
            if (Math.hypot(x - pin_coord.x, y - pin_coord.y) < 8) {
                return { comp_id: "RPI", name: `pin${pin_num}`, x: pin_coord.x, y: pin_coord.y };
            }
        }
        
        // 2. Έλεγχος στα εξαρτήματα
        for (const comp of Object.values(this.components)) {
            if (comp.id === "RPI") continue;
            const cx = comp.properties.x || 100;
            const cy = comp.properties.y || 100;
            
            // Υπολογισμός συντεταγμένων των terminals για κάθε εξάρτημα
            const terms_coords = this.get_terminals_coordinates(comp, cx, cy);
            for (const [name, coord] of Object.entries(terms_coords)) {
                if (Math.hypot(x - coord.x, y - coord.y) < 10) {
                    return { comp_id: comp.id, name, x: coord.x, y: coord.y };
                }
            }
        }
        return null;
    },

    // Υπολογισμός συντεταγμένων των ακροδεκτών ενός εξαρτήματος
    get_terminals_coordinates(comp, cx, cy) {
        const coords = {};
        if (comp.type === "LED") {
            // LED: anode (positive, left) and cathode (negative, right)
            coords["anode"] = { x: cx - 25, y: cy };
            coords["cathode"] = { x: cx + 25, y: cy };
        } else if (comp.type === "RESISTOR" || comp.type === "BUTTON") {
            // Resistor and Button: terminal_a (left) and terminal_b (right)
            coords["terminal_a"] = { x: cx - 25, y: cy };
            coords["terminal_b"] = { x: cx + 25, y: cy };
        } else if (comp.type === "BUZZER") {
            // Buzzer: positive (top) and negative (bottom)
            coords["positive"] = { x: cx, y: cy - 20 };
            coords["negative"] = { x: cx, y: cy + 20 };
        }
        return coords;
    },

    // Εύρεση καλωδίου κοντά στο σημείο x, y (για διαγραφή)
    get_wire_at(x, y) {
        for (const wire of this.wires) {
            const pt_a = this.get_terminal_position(wire.from_component, wire.from_terminal);
            const pt_b = this.get_terminal_position(wire.to_component, wire.to_terminal);
            if (!pt_a || !pt_b) continue;
            
            // Για curved wire (Bezier), κάνουμε δειγματοληψία 10 σημείων κατά μήκος της καμπύλης
            // ctrl_y = Math.max(pt_a.y, pt_b.y) + 40
            const ctrl_y = Math.max(pt_a.y, pt_b.y) + 40;
            
            for (let t = 0; t <= 1.0; t += 0.1) {
                // Bezier equation: (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
                // Εδώ έχουμε cubic bezier CurveTo: x = (1-t)^3*P0_x + 3*(1-t)^2*t*C1_x + 3*(1-t)*t^2*C2_x + t^3*P3_x
                // ctrl points: C1 = (P0_x, ctrl_y), C2 = (P3_x, ctrl_y)
                const mt = 1 - t;
                const bx = mt*mt*mt*pt_a.x + 3*mt*mt*t*pt_a.x + 3*mt*t*t*pt_b.x + t*t*t*pt_b.x;
                const by = mt*mt*mt*pt_a.y + 3*mt*mt*t*ctrl_y + 3*mt*t*t*ctrl_y + t*t*t*pt_b.y;
                
                if (Math.hypot(x - bx, y - by) < 12) {
                    return wire;
                }
            }
        }
        return null;
    },

    // Λήψη ακριβούς θέσης ενός ακροδέκτη
    get_terminal_position(comp_id, terminal_name) {
        if (comp_id === "RPI") {
            const pin_num = int_val = parseInt(terminal_name.replace("pin", ""));
            return this.rpi_layout.pins[pin_num];
        }
        
        const comp = this.components[comp_id];
        if (!comp) return null;
        
        const cx = comp.properties.x || 100;
        const cy = comp.properties.y || 100;
        
        return this.get_terminals_coordinates(comp, cx, cy)[terminal_name];
    },

    // Κύριο loop σχεδίασης
    draw_loop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 1. Σχεδίαση φόντου / πλέγματος (Grid)
        this.draw_grid();
        
        // 2. Σχεδίαση Raspberry Pi Board
        this.draw_rpi();
        
        // 3. Σχεδίαση Εξαρτημάτων
        this.draw_components();
        
        // 4. Σχεδίαση Καλωδίων
        this.draw_wires();
        
        // 5. Σχεδίαση Προειδοποιήσεων (Warnings overlay)
        this.draw_warnings();
        
        // Επανάληψη του loop στο επόμενο frame
        requestAnimationFrame(() => this.draw_loop());
    },

    // Σχεδίαση διακριτικού πλέγματος στο φόντο
    draw_grid() {
        const ctx = this.ctx;
        ctx.strokeStyle = "hsla(220, 20%, 80%, 0.4)";
        ctx.lineWidth = 1;
        const grid_size = 20;
        
        for (let x = 0; x < this.canvas.width; x += grid_size) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += grid_size) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }
    },

    // Σχεδίαση του Raspberry Pi Board με λεπτομέρειες
    draw_rpi() {
        const ctx = this.ctx;
        const rpi = this.rpi_layout;
        
        // Σχεδίαση πράσινης πλακέτας
        ctx.fillStyle = "hsl(140, 60%, 18%)";
        ctx.strokeStyle = "hsl(140, 50%, 25%)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(rpi.x, rpi.y, rpi.width, rpi.height, 16);
        ctx.fill();
        ctx.stroke();
        
        // Σχεδίαση GPIO Header Base (Μαύρο πλαστικό)
        ctx.fillStyle = "hsl(0, 0%, 8%)";
        ctx.beginPath();
        ctx.roundRect(rpi.x + 38, rpi.y + 25, 54, rpi.height - 50, 4);
        ctx.fill();

        // Σχεδίαση των 40 Pins
        for (const [pin_num_str, pin] of Object.entries(rpi.pins)) {
            const pin_num = parseInt(pin_num_str);
            // Χρωματικός κώδικας για εκπαιδευτική χρήση
            let pin_color = "hsl(45, 90%, 55%)"; // Προεπιλογή: Χρυσό / GPIO
            if (pin.type === "VCC5") {
                pin_color = "hsl(0, 85%, 50%)"; // Red for 5V
            } else if (pin.type === "VCC3") {
                pin_color = "hsl(38, 90%, 55%)"; // Orange/Yellow for 3.3V
            } else if (pin.type === "GND") {
                pin_color = "hsl(0, 0%, 85%)"; // Gray/White for GND
            } else {
                pin_color = "hsl(200, 85%, 50%)"; // Blue for general GPIO
            }

            ctx.fillStyle = pin_color;
            ctx.beginPath();
            ctx.arc(pin.x, pin.y, 4.5, 0, Math.PI * 2);
            ctx.fill();

            // Σχεδίαση μικρών ετικετών (labels) δίπλα στα pins
            ctx.fillStyle = "hsla(0, 0%, 100%, 0.35)";
            ctx.font = "bold 7.5px 'JetBrains Mono'";
            ctx.textAlign = pin_num % 2 === 0 ? "left" : "right";
            
            // Text offset
            const offset_x = pin_num % 2 === 0 ? 8 : -8;
            let display_name = pin.name;
            if (display_name.startsWith("GPIO ")) {
                display_name = "G" + display_name.replace("GPIO ", "");
            }
            
            ctx.fillText(display_name, pin.x + offset_x, pin.y + 2.5);

            // Αν είναι το hovered pin, σχεδιάζουμε ένα δακτύλιο
            if (this.hovered_terminal && this.hovered_terminal.comp_id === "RPI" && this.hovered_terminal.name === `pin${pin_num}`) {
                ctx.strokeStyle = "white";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(pin.x, pin.y, 8, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        
        // Σχεδίαση κειμένου RPi Label
        ctx.fillStyle = "hsla(0, 0%, 100%, 0.15)";
        ctx.font = "bold 18px 'Inter'";
        ctx.textAlign = "center";
        ctx.save();
        ctx.translate(rpi.x + 25, rpi.y + rpi.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText("RASPBERRY PI", 0, 0);
        ctx.restore();
    },

    // Σχεδίαση όλων των εξαρτημάτων στο Canvas
    draw_components() {
        const ctx = this.ctx;
        
        for (const comp of Object.values(this.components)) {
            if (comp.id === "RPI") continue;
            
            const cx = comp.properties.x || 100;
            const cy = comp.properties.y || 100;
            
            ctx.save();
            
            // Σχεδίαση του σώματος του εξαρτήματος
            if (comp.type === "LED") {
                const is_lit = this.component_states[comp.id] === "lit";
                const led_color = comp.properties.color || "red";
                
                // Σχεδίαση των μεταλλικών ποδιών (pins)
                ctx.strokeStyle = "#888";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx - 25, cy);
                ctx.lineTo(cx - 10, cy);
                ctx.moveTo(cx + 10, cy);
                ctx.lineTo(cx + 25, cy);
                ctx.stroke();

                // Σχεδίαση '+' και '-' ενδείξεων πολικότητας πάνω από τα πόδια
                ctx.fillStyle = "hsla(0, 0%, 100%, 0.45)";
                ctx.font = "bold 9px 'Inter'";
                ctx.textAlign = "center";
                ctx.fillText("+", cx - 25, cy - 8);
                ctx.fillText("-", cx + 25, cy - 8);

                // Σχεδίαση σώματος LED
                let fill_style = `hsl(0, 60%, 25%)`; // Off state
                let stroke_style = `hsl(0, 60%, 40%)`;
                let glow = false;
                
                if (led_color === "green") {
                    fill_style = is_lit ? "hsl(145, 90%, 55%)" : "hsl(145, 60%, 20%)";
                    stroke_style = "hsl(145, 70%, 40%)";
                    glow = is_lit;
                } else { // red
                    fill_style = is_lit ? "hsl(0, 90%, 55%)" : "hsl(0, 60%, 25%)";
                    stroke_style = "hsl(0, 70%, 45%)";
                    glow = is_lit;
                }
                
                if (glow) {
                    ctx.shadowColor = led_color === "green" ? "hsl(145, 90%, 55%)" : "hsl(0, 90%, 55%)";
                    ctx.shadowBlur = 15;
                }
                
                ctx.fillStyle = fill_style;
                ctx.strokeStyle = stroke_style;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
            } else if (comp.type === "RESISTOR") {
                // Πόδια αντίστασης
                ctx.strokeStyle = "#888";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(cx - 25, cy);
                ctx.lineTo(cx + 25, cy);
                ctx.stroke();

                // Σώμα αντίστασης
                ctx.fillStyle = "hsl(34, 44%, 67%)"; // Μπεζ σώμα
                ctx.strokeStyle = "#555";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(cx - 15, cy - 6, 30, 12, 3);
                ctx.fill();
                ctx.stroke();
                
                // Σχεδίαση των χρωματικών λωρίδων (Color bands)
                const val = comp.properties.resistance || 330;
                ctx.fillStyle = "brown"; // 1st band
                ctx.fillRect(cx - 10, cy - 6, 3, 12);
                
                if (val === 330) {
                    ctx.fillStyle = "orange"; // 2nd band
                    ctx.fillRect(cx - 4, cy - 6, 3, 12);
                    ctx.fillStyle = "brown"; // multiplier
                    ctx.fillRect(cx + 2, cy - 6, 3, 12);
                } else { // 10k
                    ctx.fillStyle = "black";
                    ctx.fillRect(cx - 4, cy - 6, 3, 12);
                    ctx.fillStyle = "orange";
                    ctx.fillRect(cx + 2, cy - 6, 3, 12);
                }
                
            } else if (comp.type === "BUTTON") {
                // Πόδια
                ctx.strokeStyle = "#888";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx - 25, cy);
                ctx.lineTo(cx - 12, cy);
                ctx.moveTo(cx + 12, cy);
                ctx.lineTo(cx + 25, cy);
                ctx.stroke();

                // Σώμα διακόπτη
                const is_pressed = comp.properties.pressed || false;
                ctx.fillStyle = "#222";
                ctx.beginPath();
                ctx.roundRect(cx - 12, cy - 12, 24, 24, 4);
                ctx.fill();
                
                // Το κόκκινο έμβολο (Button plunger)
                ctx.fillStyle = is_pressed ? "hsl(0, 80%, 40%)" : "hsl(0, 80%, 55%)";
                ctx.beginPath();
                ctx.arc(cx, cy, 6, 0, Math.PI * 2);
                ctx.fill();
                
            } else if (comp.type === "BUZZER") {
                // Πόδια
                ctx.strokeStyle = "#888";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy - 20);
                ctx.lineTo(cx, cy - 10);
                ctx.moveTo(cx, cy + 10);
                ctx.lineTo(cx, cy + 20);
                ctx.stroke();

                // Σώμα βομβητή
                const is_sounding = this.component_states[comp.id] === "sounding";
                ctx.fillStyle = "black";
                ctx.strokeStyle = "#444";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Σχεδίαση '+' ετικέτας στο θετικό πόδι (πάνω)
                ctx.fillStyle = "white";
                ctx.font = "10px monospace";
                ctx.fillText("+", cx - 8, cy - 6);
                
                // Σχεδίαση '+' και '-' ενδείξεων πολικότητας δίπλα στους ακροδέκτες του buzzer
                ctx.fillStyle = "hsla(0, 0%, 100%, 0.45)";
                ctx.font = "bold 9px 'Inter'";
                ctx.textAlign = "center";
                ctx.fillText("+", cx - 10, cy - 20 + 3);
                ctx.fillText("-", cx - 10, cy + 20 + 3);

                if (is_sounding) {
                    // Σχεδίαση κυμάτων ήχου
                    ctx.strokeStyle = "hsla(190, 90%, 50%, 0.6)";
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(cx, cy, 20 + (Date.now() % 300) / 15, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            
            // Σχεδίαση των Terminals ως πράσινα κυκλάκια
            const terms_coords = this.get_terminals_coordinates(comp, cx, cy);
            for (const [name, coord] of Object.entries(terms_coords)) {
                ctx.fillStyle = "hsl(145, 80%, 45%)";
                ctx.beginPath();
                ctx.arc(coord.x, coord.y, 3.5, 0, Math.PI * 2);
                ctx.fill();
                
                // Δακτύλιος αν είναι hovered
                if (this.hovered_terminal && this.hovered_terminal.comp_id === comp.id && this.hovered_terminal.name === name) {
                    ctx.strokeStyle = "white";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(coord.x, coord.y, 6, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            // Σχεδίαση της ετικέτας ID του εξαρτήματος
            ctx.fillStyle = "var(--text-secondary)";
            ctx.font = "bold 9px 'Inter'";
            ctx.textAlign = "center";
            ctx.fillText(comp.id, cx, cy - 18);
            
            ctx.restore();
        }
    },

    // Σχεδίαση όλων των καλωδίων
    draw_wires() {
        const ctx = this.ctx;
        
        for (const wire of this.wires) {
            const pt_a = this.get_terminal_position(wire.from_component, wire.from_terminal);
            const pt_b = this.get_terminal_position(wire.to_component, wire.to_terminal);
            
            if (pt_a && pt_b) {
                ctx.save();
                
                // Σχεδίαση καλωδίου ως καμπύλη Bezier για ρεαλιστική αίσθηση (curved wire)
                ctx.strokeStyle = wire.color;
                ctx.lineWidth = 3.5;
                ctx.lineCap = "round";
                
                ctx.beginPath();
                ctx.moveTo(pt_a.x, pt_a.y);
                // Τα Control points καθορίζουν πόσο θα κρέμεται το καλώδιο
                const ctrl_y = Math.max(pt_a.y, pt_b.y) + 40;
                ctx.bezierCurveTo(pt_a.x, ctrl_y, pt_b.x, ctrl_y, pt_b.x, pt_b.y);
                ctx.stroke();
                
                ctx.restore();
            }
        }
        
        // Σχεδίαση του προσωρινού καλωδίου κατά το σύρσιμο (Wiring drag)
        if (WiringManager.selected_terminal && this.temp_wire_end) {
            const start = this.get_terminal_position(WiringManager.selected_terminal.component_id, WiringManager.selected_terminal.terminal_name);
            if (start) {
                ctx.save();
                ctx.strokeStyle = WiringManager.current_color;
                ctx.lineWidth = 2.5;
                ctx.setLineDash([4, 4]); // Διακεκομμένη γραμμή
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(this.temp_wire_end.x, this.temp_wire_end.y);
                ctx.stroke();
                ctx.restore();
            }
        }
    },

    // Σχεδίαση προειδοποιητικών μηνυμάτων (Warnings)
    draw_warnings() {
        const ctx = this.ctx;
        if (this.warnings.length === 0) return;
        
        ctx.save();
        ctx.fillStyle = "hsla(0, 84%, 58%, 0.1)";
        ctx.strokeStyle = "var(--danger)";
        ctx.lineWidth = 2;
        
        // Σχεδιάζουμε κόκκινο περίγραμμα σε ολόκληρο το panel αν υπάρχει critical warning
        ctx.beginPath();
        ctx.roundRect(4, 4, this.canvas.width - 8, this.canvas.height - 8, var_radius = 8);
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    },

    // Ενημέρωση των δεδομένων κυκλώματος από το WebSocket
    update_circuit(circuit_data) {
        this.components = {};
        this.wires = [];
        
        // Φόρτωση εξαρτημάτων
        circuit_data.components.forEach(comp => {
            this.components[comp.id] = comp;
        });
        
        // Φόρτωση καλωδίων
        this.wires = circuit_data.wires;
    },

    // Ενημέρωση των αποτελεσμάτων του physics solver
    update_solve_results(results) {
        this.component_states = results.component_states || {};
        this.warnings = results.warnings || [];
        
        // Καταγραφή προειδοποιήσεων στην κονσόλα
        this.warnings.forEach(w => {
            ConsoleLogger.warn(w.message);
        });
    }
};

window.BreadboardCanvas = BreadboardCanvas;
