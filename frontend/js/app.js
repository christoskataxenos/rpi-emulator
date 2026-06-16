// Κεντρικός Ελεγκτής (Controller) του Frontend
const App = {
    active_session_id: null,
    current_scenario_id: "01_blink_led",
    pins_data: {},

    init() {
        ConsoleLogger.init();
        ComponentsDrawer.init();
        WiringManager.init();
        BreadboardCanvas.init();
        
        this.render_gpio_monitor();
        this.bind_controls();
        this.connect_websocket();
        
        CodeEditorManager.init();
        
        ConsoleLogger.system("Η εφαρμογή Virtual RPi Lab αρχικοποιήθηκε.");
    },

    // Σύνδεση με το WebSocket
    connect_websocket() {
        simWebSocket.connect();
        
        // Όταν συνδεθούμε, ζητάμε την αρχική κατάσταση
        simWebSocket.on("connect", () => {
            ConsoleLogger.system("Συνδέθηκε με τον εξομοιωτή.");
        });

        simWebSocket.on("disconnect", () => {
            ConsoleLogger.stderr("Η σύνδεση με τον εξομοιωτή χάθηκε.");
        });

        // Αρχικοποίηση κατάστασης
        simWebSocket.on("init", (data) => {
            this.update_pins(data.pins);
            BreadboardCanvas.update_circuit(data.circuit);
        });

        // Αλλαγή κατάστασης ενός pin
        simWebSocket.on("gpio_state_change", (data) => {
            this.update_pin_state(data.pin_number, data.state);
        });

        // Ρύθμιση pin
        simWebSocket.on("gpio_setup", (data) => {
            this.update_pin_setup(data.pin_number, data.mode, data.pull);
        });

        // Αλλαγή PWM σε pin
        simWebSocket.on("gpio_pwm", (data) => {
            this.update_pin_pwm(data.pin_number, data.is_pwm, data.duty_cycle);
        });

        // Καθαρισμός GPIO
        simWebSocket.on("gpio_cleanup", () => {
            this.reset_all_pins();
        });

        // Αλλαγή στο κύκλωμα
        simWebSocket.on("circuit_change", (data) => {
            BreadboardCanvas.update_circuit(data.circuit);
            BreadboardCanvas.update_solve_results(data.solve_results);
        });

        // Επίλυση κυκλώματος
        simWebSocket.on("circuit_solved", (data) => {
            BreadboardCanvas.update_solve_results(data.data);
        });

        // Logs κονσόλας
        simWebSocket.on("console_log", (data) => {
            if (data.stream === "stderr") {
                ConsoleLogger.stderr(data.text);
            } else {
                ConsoleLogger.stdout(data.text);
            }
        });

        // Τερματισμός εκτέλεσης κώδικα
        simWebSocket.on("execution_finished", (data) => {
            ConsoleLogger.system(`Η εκτέλεση τερματίστηκε με exit code: ${data.exit_code}`);
            this.set_running_state(false);
            this.active_session_id = null;
        });
    },

    // Δημιουργία και σχεδίαση του 40-Pin GPIO Monitor στο footer
    render_gpio_monitor() {
        const left_col = document.getElementById("gpio-left-col");
        const right_col = document.getElementById("gpio-right-col");
        
        left_col.innerHTML = "";
        right_col.innerHTML = "";
        
        const pin_defs = BreadboardCanvas.rpi_pin_definitions;
        
        // Δημιουργία των στοιχείων των pins (Αριστερή και Δεξιά στήλη)
        for (let i = 0; i < pin_defs.length; i++) {
            const def = pin_defs[i];
            const pin_num = def.num;
            const is_even = pin_num % 2 === 0;
            
            const pin_element = document.createElement("div");
            pin_element.id = `pin-mon-${pin_num}`;
            pin_element.className = "pin-monitor";
            pin_element.title = `Pin ${pin_num}: ${def.name} (${def.type})`;
            
            // Προσθήκη ειδικών στυλ ανάλογα με τον τύπο (Power, Ground)
            if (def.type === "VCC5") pin_element.classList.add("pin-vcc-5v");
            else if (def.type === "VCC3") pin_element.classList.add("pin-vcc-3v");
            else if (def.type === "GND") pin_element.classList.add("pin-gnd");
            
            pin_element.innerHTML = `
                <span class="pin-num-label">${pin_num}</span>
                <span class="pin-type-dot"></span>
            `;
            
            // Αποθήκευση της αρχικής κατάστασης
            this.pins_data[pin_num] = {
                mode: "INPUT",
                state: 0,
                is_pwm: false,
                pull: "PUD_OFF"
            };

            // Δυνατότητα κλικ σε pin εισόδου (INPUT) για προσομοίωση πατήματος
            pin_element.addEventListener("click", () => this.handle_pin_click(pin_num));
            
            // Highlight RPi pin on canvas when hovering over monitor pin
            pin_element.addEventListener("mouseenter", () => {
                if (window.BreadboardCanvas) {
                    window.BreadboardCanvas.hovered_terminal = {
                        comp_id: "RPI",
                        name: `pin${pin_num}`,
                        x: window.BreadboardCanvas.rpi_layout.pins[pin_num].x,
                        y: window.BreadboardCanvas.rpi_layout.pins[pin_num].y
                    };
                }
            });
            pin_element.addEventListener("mouseleave", () => {
                if (window.BreadboardCanvas) {
                    window.BreadboardCanvas.hovered_terminal = null;
                }
            });
            
            if (is_even) {
                right_col.appendChild(pin_element);
            } else {
                left_col.appendChild(pin_element);
            }
        }
    },

    // Διαχείριση κλικ σε pin του monitor (για προσομοίωση εισόδου)
    async handle_pin_click(pin_num) {
        const pin = this.pins_data[pin_num];
        const def = BreadboardCanvas.rpi_pin_definitions[pin_num - 1];
        
        // Λειτουργεί μόνο αν το pin είναι ρυθμισμένο ως INPUT
        if (def.type === "GPIO" && pin.mode === "INPUT") {
            const next_state = pin.state === 1 ? 0 : 1;
            ConsoleLogger.system(`Προσομοίωση εισόδου στο GPIO ${def.name.replace("GPIO ", "")}: ${next_state}`);
            
            // Αποστολή αιτήματος προσομοίωσης εισόδου στο backend
            const payload = {
                pin: pin_num,
                pressed: next_state === 1,
                component_id: "RPI" // Δηλώνουμε ότι η αλλαγή γίνεται απευθείας στο RPi
            };

            try {
                await fetch("/api/simulator/input", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            } catch (err) {
                console.error("Σφάλμα κατά την αποστολή προσομοίωσης εισόδου:", err);
            }
        }
    },

    // Ενημέρωση όλων των pins από το WebSocket
    update_pins(pins_list) {
        pins_list.forEach(pin => {
            this.update_pin_setup(pin.pin_number, pin.mode, pin.pull);
            this.update_pin_state(pin.pin_number, pin.state);
            this.update_pin_pwm(pin.pin_number, pin.is_pwm, pin.pwm_duty_cycle);
        });
    },

    // Ενημέρωση κατάστασης ενός pin
    update_pin_state(pin_num, state) {
        const pin = this.pins_data[pin_num];
        if (!pin) return;
        
        pin.state = state;
        
        const element = document.getElementById(`pin-mon-${pin_num}`);
        if (!element) return;
        
        // Αφαίρεση παλαιών κλάσεων κατάστασης
        element.classList.remove("pin-gpio-out-high", "pin-gpio-in-high");
        
        const def = BreadboardCanvas.rpi_pin_definitions[pin_num - 1];
        if (def.type === "GPIO") {
            if (state === 1) {
                if (pin.mode === "OUTPUT") {
                    element.classList.add("pin-gpio-out-high");
                } else {
                    element.classList.add("pin-gpio-in-high");
                }
            }
        }
    },

    // Ενημέρωση setup ενός pin (INPUT / OUTPUT)
    update_pin_setup(pin_num, mode, pull) {
        const pin = this.pins_data[pin_num];
        if (!pin) return;
        
        pin.mode = mode;
        pin.pull = pull;
        
        const element = document.getElementById(`pin-mon-${pin_num}`);
        if (!element) return;
        
        element.title = `Pin ${pin_num}: ${BreadboardCanvas.rpi_pin_definitions[pin_num - 1].name} (${mode})`;
    },

    // Ενημέρωση PWM
    update_pin_pwm(pin_num, is_pwm, duty_cycle) {
        const pin = this.pins_data[pin_num];
        if (!pin) return;
        
        pin.is_pwm = is_pwm;
        
        const element = document.getElementById(`pin-mon-${pin_num}`);
        if (!element) return;
        
        if (is_pwm) {
            element.classList.add("pin-pwm");
        } else {
            element.classList.remove("pin-pwm");
        }
    },

    // Επαναφορά όλων των pins
    reset_all_pins() {
        for (let i = 1; i <= 40; i++) {
            const def = BreadboardCanvas.rpi_pin_definitions[i - 1];
            const pin = this.pins_data[i];
            if (pin) {
                pin.mode = "INPUT";
                pin.state = 0;
                pin.is_pwm = false;
                pin.pull = "PUD_OFF";
            }
            const element = document.getElementById(`pin-mon-${i}`);
            if (element) {
                element.className = "pin-monitor";
                if (def.type === "VCC5") element.classList.add("pin-vcc-5v");
                else if (def.type === "VCC3") element.classList.add("pin-vcc-3v");
                else if (def.type === "GND") element.classList.add("pin-gnd");
            }
        }
    },

    // Σύνδεση ελέγχων των κουμπιών UI
    bind_controls() {
        const btn_run = document.getElementById("btn-run");
        const btn_stop = document.getElementById("btn-stop");
        const btn_clear = document.getElementById("btn-clear");
        const btn_clear_console = document.getElementById("btn-clear-console");
        const btn_reset_code = document.getElementById("btn-reset-code");
        
        // Λίστα Σεναρίων
        const scenario_items = document.querySelectorAll(".scenario-item");
        scenario_items.forEach(item => {
            item.addEventListener("click", () => {
                scenario_items.forEach(i => i.classList.remove("active"));
                item.classList.add("active");
                this.load_scenario(item.dataset.scenario);
            });
        });

        // Κουμπί Run Code
        btn_run.addEventListener("click", () => this.run_code());
        
        // Κουμπί Stop Code
        btn_stop.addEventListener("click", () => this.stop_code());

        // Κουμπί Clear Grid
        btn_clear.addEventListener("click", () => this.clear_circuit());

        // Κουμπί Καθαρισμού Κονσόλας
        btn_clear_console.addEventListener("click", () => ConsoleLogger.clear());

        // Κουμπί Επαναφοράς Starter Κώδικα
        btn_reset_code.addEventListener("click", () => {
            this.load_scenario(this.current_scenario_id, true);
        });

        // Σύνδεση των Tabs
        const tab_circuit = document.getElementById("tab-circuit");
        const tab_editor = document.getElementById("tab-editor");
        
        tab_circuit.addEventListener("click", () => {
            tab_editor.classList.remove("active");
            tab_circuit.classList.add("active");
            this.set_workspace_mode("circuit");
        });
        
        tab_editor.addEventListener("click", () => {
            tab_circuit.classList.remove("active");
            tab_editor.classList.add("active");
            this.set_workspace_mode("code");
        });

        // Σύνδεση των Toggles
        document.getElementById("toggle-sidebar-left").addEventListener("click", () => this.toggle_sidebar("left", true));
        document.getElementById("btn-expand-sidebar-left").addEventListener("click", () => this.toggle_sidebar("left", false));
        
        document.getElementById("toggle-sidebar-right").addEventListener("click", () => this.toggle_sidebar("right", true));
        document.getElementById("btn-expand-sidebar-right").addEventListener("click", () => this.toggle_sidebar("right", false));

        document.getElementById("toggle-gpio").addEventListener("click", () => this.toggle_footer_panel("gpio", true));
        document.getElementById("btn-expand-gpio").addEventListener("click", () => this.toggle_footer_panel("gpio", false));

        document.getElementById("toggle-console").addEventListener("click", () => this.toggle_footer_panel("console", true));
        document.getElementById("btn-expand-console").addEventListener("click", () => this.toggle_footer_panel("console", false));
    },

    // Φόρτωση σεναρίου μάθησης
    async load_scenario(scenario_id, force_reset_code = false) {
        this.current_scenario_id = scenario_id;
        ConsoleLogger.system(`Φόρτωση μαθήματος: ${scenario_id}...`);
        
        try {
            // 1. Φόρτωση README οδηγιών
            const res_readme = await fetch(`/scenarios/${scenario_id}/README.md`);
            if (res_readme.ok) {
                const md_text = await res_readme.text();
                // Απλή μετατροπή markdown σε HTML για εκπαιδευτική χρήση
                document.getElementById("tutorial-text").innerHTML = this.simple_markdown_to_html(md_text);
            }
            
            // 2. Φόρτωση starter κώδικα (μόνο αν δεν εκτελείται ήδη κώδικας ή ζητήθηκε force)
            if (!this.active_session_id || force_reset_code) {
                const res_code = await fetch(`/scenarios/${scenario_id}/starter.py`);
                if (res_code.ok) {
                    const code_text = await res_code.text();
                    CodeEditorManager.set_code(code_text);
                }
            }

            // 3. Φόρτωση κυκλώματος (διαγραφή προηγούμενου και φόρτωση νέου)
            await fetch("/api/circuit/clear", { method: "POST" });
            
            const res_circuit = await fetch(`/scenarios/${scenario_id}/circuit.json`);
            if (res_circuit.ok) {
                const circuit = await res_circuit.json();
                
                // Προσθήκη εξαρτημάτων
                for (const comp of circuit.components) {
                    if (comp.id === "RPI") continue;
                    
                    // Υπολογισμός θέσης τοποθέτησης (για να μην πέφτουν το ένα πάνω στο άλλο)
                    // Στα προκαθορισμένα κυκλώματα ορίζουμε θέσεις
                    let x = 450;
                    let y = 150;
                    
                    if (comp.id === "LED1") { x = 450; y = 180; }
                    else if (comp.id === "R1") { x = 550; y = 180; }
                    else if (comp.id === "BTN1") { x = 450; y = 300; }
                    else if (comp.id === "BUZ1") { x = 650; y = 300; }

                    await fetch("/api/circuit/component", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            id: comp.id,
                            type: comp.type,
                            properties: { x, y, ...comp.properties }
                        })
                    });
                }

                // Προσθήκη καλωδίων
                for (const wire of circuit.wires) {
                    await fetch("/api/circuit/wire", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(wire)
                    });
                }
            }
            
        } catch (err) {
            ConsoleLogger.stderr(`Αποτυχία φόρτωσης σεναρίου: ${err}`);
        }
    },

    // Απλή μετατροπή Markdown σε HTML για τις οδηγίες
    simple_markdown_to_html(md) {
        return md
            .replace(/^# (.*$)/gim, "<h1>$1</h1>")
            .replace(/^## (.*$)/gim, "<h2>$1</h2>")
            .replace(/^### (.*$)/gim, "<h3>$1</h3>")
            .replace(/> \[\!NOTE\]\n> (.*$)/gim, "<blockquote><strong>Σημείωση:</strong> $1</blockquote>")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/`(.*?)`/g, "<code>$1</code>")
            .replace(/\n/g, "<br>");
    },

    // Εκτέλεση κώδικα Python
    async run_code() {
        if (this.active_session_id) return;
        
        const code = CodeEditorManager.get_code();
        ConsoleLogger.system("Έναρξη εκτέλεσης κώδικα Python...");
        this.set_running_state(true);

        try {
            const response = await fetch("/api/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code })
            });

            if (response.ok) {
                const data = await response.json();
                this.active_session_id = data.session_id;
            } else {
                ConsoleLogger.stderr("Αποτυχία έναρξης εκτέλεσης.");
                this.set_running_state(false);
            }
        } catch (err) {
            ConsoleLogger.stderr(`Σφάλμα δικτύου κατά την εκτέλεση: ${err}`);
            this.set_running_state(false);
        }
    },

    // Διακοπή εκτέλεσης κώδικα Python
    async stop_code() {
        if (!this.active_session_id) return;
        
        ConsoleLogger.system("Διακοπή εκτέλεσης από το χρήστη...");
        try {
            await fetch(`/api/execute/stop/${this.active_session_id}`, {
                method: "POST"
            });
        } catch (err) {
            ConsoleLogger.stderr(`Σφάλμα κατά τη διακοπή: ${err}`);
        }
    },

    // Καθαρισμός όλου του κυκλώματος
    async clear_circuit() {
        if (confirm("Είστε σίγουροι ότι θέλετε να καθαρίσετε το κύκλωμα;")) {
            try {
                await fetch("/api/circuit/clear", { method: "POST" });
                ConsoleLogger.system("Το κύκλωμα καθαρίστηκε.");
            } catch (err) {
                ConsoleLogger.stderr("Σφάλμα κατά τον καθαρισμό.");
            }
        }
    },

    // Ενημέρωση κατάστασης λειτουργίας (Running UI)
    set_running_state(is_running) {
        const btn_run = document.getElementById("btn-run");
        const btn_stop = document.getElementById("btn-stop");
        
        if (is_running) {
            btn_run.classList.add("disabled");
            btn_run.disabled = true;
            btn_stop.classList.remove("disabled");
            btn_stop.disabled = false;
        } else {
            btn_run.classList.remove("disabled");
            btn_run.disabled = false;
            btn_stop.classList.add("disabled");
            btn_stop.disabled = true;
        }
    },

    // highlight_monitor_pin highlights a specific pin in the bottom monitor panel on canvas hover
    highlight_monitor_pin(pin_num) {
        // Remove active highlight from all pins
        document.querySelectorAll(".pin-monitor").forEach(el => {
            el.style.borderColor = "";
            el.style.transform = "";
            el.style.boxShadow = "";
        });

        if (pin_num) {
            const el = document.getElementById(`pin-mon-${pin_num}`);
            if (el) {
                el.style.borderColor = "var(--accent-secondary)";
                el.style.transform = "scale(1.15)";
                el.style.boxShadow = "0 0 8px var(--accent-secondary)";
            }
        }
    },

    // set_workspace_mode changes layout focus between Circuit designing and Python coding
    set_workspace_mode(mode) {
        const breadboard_panel = document.getElementById("breadboard-panel");
        const editor_panel = document.getElementById("editor-panel");
        const workspace_center = document.getElementById("workspace-center");

        if (mode === "circuit") {
            editor_panel.classList.add("hidden");
            breadboard_panel.classList.remove("hidden");
            workspace_center.style.gridTemplateRows = "1fr";
        } else {
            // code mode
            breadboard_panel.classList.add("hidden");
            editor_panel.classList.remove("hidden");
            workspace_center.style.gridTemplateRows = "1fr";
        }

        // Notify canvas to resize and fit correctly
        if (window.BreadboardCanvas) {
            setTimeout(() => {
                window.BreadboardCanvas.resize_canvas();
                window.BreadboardCanvas.calculate_rpi_pins();
            }, 100);
        }
    },

    // toggle_sidebar collapses/expands the left or right aside panels
    toggle_sidebar(side, collapse) {
        const main_content = document.getElementById("main-content");
        const sidebar = document.getElementById(`sidebar-${side}`);
        const expand_btn = document.getElementById(`btn-expand-sidebar-${side}`);

        if (collapse) {
            sidebar.classList.add("hidden");
            expand_btn.classList.remove("hidden");
        } else {
            sidebar.classList.remove("hidden");
            expand_btn.classList.add("hidden");
        }

        // Update main content grid structure
        const left_hidden = document.getElementById("sidebar-left").classList.contains("hidden");
        const right_hidden = document.getElementById("sidebar-right").classList.contains("hidden");

        main_content.className = "";
        if (left_hidden && right_hidden) {
            main_content.classList.add("both-collapsed");
        } else if (left_hidden) {
            main_content.classList.add("left-collapsed");
        } else if (right_hidden) {
            main_content.classList.add("right-collapsed");
        }

        // Re-fit canvas
        if (window.BreadboardCanvas) {
            setTimeout(() => {
                window.BreadboardCanvas.resize_canvas();
                window.BreadboardCanvas.calculate_rpi_pins();
            }, 100);
        }
    },

    // toggle_footer_panel collapses or expands either the GPIO monitor or the Console
    toggle_footer_panel(panel, collapse) {
        const target = panel === "gpio" ? document.getElementById("gpio-monitor-panel") : document.getElementById("terminal-panel");
        const expand_btn = panel === "gpio" ? document.getElementById("btn-expand-gpio") : document.getElementById("btn-expand-console");
        const bottom_bar = document.getElementById("bottom-bar");
        const app_container = document.getElementById("app-container");
        const expand_bar = document.getElementById("footer-expand-bar");

        if (collapse) {
            target.classList.add("collapsed");
            expand_btn.classList.remove("hidden");
        } else {
            target.classList.remove("collapsed");
            expand_btn.classList.add("hidden");
        }

        // Check overall footer states
        const gpio_hidden = document.getElementById("gpio-monitor-panel").classList.contains("collapsed");
        const console_hidden = document.getElementById("terminal-panel").classList.contains("collapsed");

        bottom_bar.className = "";
        if (gpio_hidden && console_hidden) {
            bottom_bar.classList.add("both-collapsed");
            app_container.classList.add("bottom-collapsed");
            expand_bar.classList.remove("hidden");
        } else {
            app_container.classList.remove("bottom-collapsed");
            if (gpio_hidden) {
                bottom_bar.classList.add("gpio-collapsed");
                expand_bar.classList.remove("hidden");
            } else if (console_hidden) {
                bottom_bar.classList.add("console-collapsed");
                expand_bar.classList.remove("hidden");
            } else {
                expand_bar.classList.add("hidden");
            }
        }

        // Re-fit canvas
        if (window.BreadboardCanvas) {
            setTimeout(() => {
                window.BreadboardCanvas.resize_canvas();
                window.BreadboardCanvas.calculate_rpi_pins();
            }, 100);
        }
    }
};

// Εκκίνηση της εφαρμογής όταν φορτωθεί το DOM
window.addEventListener("DOMContentLoaded", () => App.init());
