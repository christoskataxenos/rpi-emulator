// ============================================================
//  TutorialOverlay — Ολοκληρωμένος Οδηγός Μαθήματος
//  Διαβάζει το README.md κάθε σεναρίου και εμφανίζει
//  tabs (Στόχοι / Κύκλωμα / Οδηγίες) με checkboxes και
//  progress bar πάνω από το κύκλωμα.
// ============================================================
const TutorialOverlay = {

    is_open: false,

    // ----------------------------------------------------------
    // open() — Ανοίγει το overlay και γεμίζει τα tabs
    // ----------------------------------------------------------
    open() {
        const md = App.current_md_text;
        if (!md) return;

        const parsed = this.parse_readme(md);

        // Τίτλος
        document.getElementById("tutorial-overlay-title").textContent = parsed.title;

        // Γέμισμα panels
        document.getElementById("tut-panel-goals").innerHTML   = this.render_goals(parsed.goals, parsed.intro);
        document.getElementById("tut-panel-circuit").innerHTML = this.render_circuit(parsed.circuit);
        document.getElementById("tut-panel-steps").innerHTML   = this.render_steps(parsed.steps);

        // Ενεργοποίηση πρώτου tab
        this.switch_tab("goals");

        // Ενημέρωση progress
        this.update_progress();

        // Binding checkboxes
        document.querySelectorAll(".tut-step-checkbox").forEach(cb => {
            cb.addEventListener("change", () => this.update_progress());
        });

        // Binding κλικ στο step-item (label συμπεριφορά)
        document.querySelectorAll(".tut-step-item").forEach(item => {
            item.addEventListener("click", (e) => {
                if (e.target.classList.contains("tut-step-checkbox")) return;
                const cb = item.querySelector(".tut-step-checkbox");
                if (cb) { cb.checked = !cb.checked; this.update_progress(); }
            });
        });

        // Εμφάνιση overlay
        const overlay = document.getElementById("tutorial-overlay");
        overlay.classList.remove("hidden");
        this.is_open = true;

        // Το overlay τοποθετείται σχετικά με το #workspace-center
        const workspace = document.getElementById("workspace-center");
        if (workspace && overlay.parentElement !== workspace) {
            workspace.style.position = "relative";
            workspace.appendChild(overlay);
        }
    },

    // ----------------------------------------------------------
    // close() — Κλείνει το overlay
    // ----------------------------------------------------------
    close() {
        document.getElementById("tutorial-overlay").classList.add("hidden");
        this.is_open = false;
    },

    // ----------------------------------------------------------
    // switch_tab(tab_name) — Εναλλαγή ενεργού tab
    // ----------------------------------------------------------
    switch_tab(tab_name) {
        const panels = {
            goals:   document.getElementById("tut-panel-goals"),
            circuit: document.getElementById("tut-panel-circuit"),
            steps:   document.getElementById("tut-panel-steps"),
        };
        // Απόκρυψη όλων
        Object.values(panels).forEach(p => { if (p) p.classList.add("hidden"); });

        // Εμφάνιση επιλεγμένου
        if (panels[tab_name]) panels[tab_name].classList.remove("hidden");

        // Ενημέρωση tab buttons
        document.querySelectorAll(".tut-tab").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tab === tab_name);
            btn.setAttribute("aria-selected", btn.dataset.tab === tab_name ? "true" : "false");
        });
    },

    // ----------------------------------------------------------
    // update_progress() — Ενημερώνει progress bar και label
    // ----------------------------------------------------------
    update_progress() {
        const checkboxes = document.querySelectorAll(".tut-step-checkbox");
        const total = checkboxes.length;
        let done = 0;

        checkboxes.forEach(cb => {
            const item = cb.closest(".tut-step-item");
            if (cb.checked) {
                done++;
                item.classList.add("done");
            } else {
                item.classList.remove("done");
            }
        });

        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        document.getElementById("tut-progress-fill").style.width = `${pct}%`;
        document.getElementById("tut-progress-label").textContent = `${done} / ${total}`;
    },

    // ----------------------------------------------------------
    // parse_readme(md) — Αναλύει το markdown σε τμήματα
    // Επιστρέφει: { title, intro, goals, circuit, steps }
    // ----------------------------------------------------------
    parse_readme(md) {
        const lines = md.split("\n");
        let title = "";
        let intro_lines = [];
        let goals_lines = [];
        let circuit_lines = [];
        let steps_lines = [];
        let current_section = "intro";

        for (const line of lines) {
            // H1 → τίτλος
            if (/^# /.test(line)) {
                title = line.replace(/^# /, "").trim();
                continue;
            }
            // H2 → αλλαγή section
            if (/^## /.test(line)) {
                const heading = line.replace(/^## /, "").trim().toLowerCase();
                if (heading.includes("στόχ") || heading.includes("goal")) {
                    current_section = "goals";
                } else if (heading.includes("κύκλωμα") || heading.includes("circuit")) {
                    current_section = "circuit";
                } else if (heading.includes("οδηγ") || heading.includes("step") || heading.includes("instruct")) {
                    current_section = "steps";
                } else {
                    current_section = "intro";
                }
                continue;
            }
            // Κατανομή γραμμών στο σωστό τμήμα
            if (current_section === "intro")    intro_lines.push(line);
            else if (current_section === "goals")   goals_lines.push(line);
            else if (current_section === "circuit") circuit_lines.push(line);
            else if (current_section === "steps")   steps_lines.push(line);
        }

        return {
            title:   title || "Οδηγός Μαθήματος",
            intro:   intro_lines.join("\n").trim(),
            goals:   goals_lines.join("\n").trim(),
            circuit: circuit_lines.join("\n").trim(),
            steps:   steps_lines.join("\n").trim(),
        };
    },

    // ----------------------------------------------------------
    // render_goals(md, intro) — Renders Στόχοι tab
    // ----------------------------------------------------------
    render_goals(md, intro) {
        let html = "";

        // Εισαγωγικό κείμενο
        if (intro) {
            html += `<p class="tut-intro-text">${this.inline_format(intro)}</p>`;
        }

        html += `<h3>Τι θα μάθετε σε αυτό το σενάριο</h3>`;
        html += `<ul class="tut-goals-list">`;

        const lines = md.split("\n");
        let has_items = false;
        for (const line of lines) {
            // Bullet items
            const bullet = line.match(/^[-*]\s+(.+)/);
            if (bullet) {
                html += `<li class="tut-goal-item">
                    <span class="tut-goal-bullet"></span>
                    <span>${this.inline_format(bullet[1])}</span>
                </li>`;
                has_items = true;
            }
            // Note callouts
            const note = line.match(/^> \[!NOTE\]\s*(.*)/i);
            if (note) {
                // Η επόμενη γραμμή μπορεί να είναι το κείμενο
                continue;
            }
        }
        // Αν δεν βρέθηκαν bullet items, εμφάνιση ολόκληρου κειμένου
        if (!has_items && md.trim()) {
            html += `<li class="tut-goal-item">
                <span class="tut-goal-bullet"></span>
                <span>${this.inline_format(md.trim())}</span>
            </li>`;
        }

        html += `</ul>`;
        return html;
    },

    // ----------------------------------------------------------
    // render_circuit(md) — Renders Κύκλωμα tab
    // ----------------------------------------------------------
    render_circuit(md) {
        let html = `<h3>Σύνδεση Κυκλώματος</h3>`;
        html += `<ol class="tut-circuit-list">`;

        const lines = md.split("\n");
        let step_num = 0;
        let note_buffer = [];
        let in_note = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Note callout — συλλογή πολλαπλών γραμμών
            if (/^>\s*\[!NOTE\]/i.test(line)) {
                in_note = true;
                note_buffer = [];
                continue;
            }
            if (in_note) {
                if (/^>/.test(line)) {
                    note_buffer.push(line.replace(/^>\s*/, ""));
                } else {
                    // Τέλος note
                    html += `</ol>${this.render_note(note_buffer.join(" "))}<ol class="tut-circuit-list">`;
                    in_note = false;
                    note_buffer = [];
                }
            }

            // Αριθμημένο item
            const numbered = line.match(/^\d+\.\s+(.+)/);
            if (numbered) {
                step_num++;
                html += `<li class="tut-circuit-item">
                    <span class="tut-circuit-num">${step_num}</span>
                    <span>${this.inline_format(numbered[1])}</span>
                </li>`;
            }
        }

        // Φλαστάρωμα αν το note ήταν τελευταίο
        if (in_note && note_buffer.length > 0) {
            html += `</ol>${this.render_note(note_buffer.join(" "))}`;
            return html;
        }

        html += `</ol>`;
        return html;
    },

    // ----------------------------------------------------------
    // render_steps(md) — Renders Οδηγίες tab με checkboxes
    // ----------------------------------------------------------
    render_steps(md) {
        let html = `<h3>Βήματα Υλοποίησης</h3>`;
        html += `<div class="tut-steps-list">`;

        const lines = md.split("\n");
        let step_idx = 0;

        for (const line of lines) {
            // Αριθμημένο βήμα
            const numbered = line.match(/^\d+\.\s+(.+)/);
            if (numbered) {
                const id = `tut-step-${step_idx++}`;
                html += `<div class="tut-step-item">
                    <input type="checkbox" class="tut-step-checkbox" id="${id}" aria-label="Βήμα ${step_idx}">
                    <span class="tut-step-text">${this.inline_format(numbered[1])}</span>
                </div>`;
            }
            // Note callout εντός βημάτων
            const note = line.match(/^>\s*\[!NOTE\]\s*(.*)/i);
            if (note && note[1]) {
                html += this.render_note(note[1]);
            }
        }

        html += `</div>`;
        return html;
    },

    // ----------------------------------------------------------
    // render_note(text) — Styled info callout
    // ----------------------------------------------------------
    render_note(text) {
        return `<div class="tut-note">
            <i class="fa-solid fa-circle-info"></i>
            <span>${this.inline_format(text)}</span>
        </div>`;
    },

    // ----------------------------------------------------------
    // inline_format(text) — Μορφοποίηση inline markdown
    // **bold**, `code`, *italic*
    // ----------------------------------------------------------
    inline_format(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g,  "<strong>$1</strong>")
            .replace(/`(.*?)`/g,         "<code>$1</code>")
            .replace(/\*(.*?)\*/g,       "<em>$1</em>");
    },

    // ----------------------------------------------------------
    // render_sidebar_preview(md) — Σύντομη προεπισκόπηση
    // για το #tutorial-text στο sidebar
    // ----------------------------------------------------------
    render_sidebar_preview(md) {
        const parsed = this.parse_readme(md);
        let html = "";

        if (parsed.title) {
            html += `<h1 style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text-primary);">${parsed.title}</h1>`;
        }
        if (parsed.intro) {
            html += `<p style="font-size:12px;color:var(--text-secondary);line-height:1.55;margin-bottom:10px;">${this.inline_format(parsed.intro)}</p>`;
        }
        if (!parsed.title && !parsed.intro) {
            html += `<p class="select-prompt">Επιλέξτε ένα σενάριο για να ξεκινήσετε.</p>`;
        }
        return html;
    },
};

// Κεντρικός Ελεγκτής (Controller) του Frontend
const App = {
    active_session_id: null,
    current_scenario_id: "01_blink_led",
    current_md_text: null,
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
        this.load_scenarios_list();
        
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
        
        // Κουμπιά Save / Load
        const btn_save = document.getElementById("btn-save-project");
        const btn_load = document.getElementById("btn-load-project");
        const file_load = document.getElementById("file-load-project");
        
        btn_save.addEventListener("click", () => this.save_project());
        btn_load.addEventListener("click", () => file_load.click());
        file_load.addEventListener("change", (e) => this.load_project(e));
        
        // Λίστα Σεναρίων (Η σύνδεση γίνεται πλέον δυναμικά στο load_scenarios_list)

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
        const tab_split = document.getElementById("tab-split");
        
        tab_circuit.addEventListener("click", () => {
            tab_editor.classList.remove("active");
            if (tab_split) tab_split.classList.remove("active");
            tab_circuit.classList.add("active");
            this.set_workspace_mode("circuit");
        });
        
        tab_editor.addEventListener("click", () => {
            tab_circuit.classList.remove("active");
            if (tab_split) tab_split.classList.remove("active");
            tab_editor.classList.add("active");
            this.set_workspace_mode("code");
        });

        if (tab_split) {
            tab_split.addEventListener("click", () => {
                tab_circuit.classList.remove("active");
                tab_editor.classList.remove("active");
                tab_split.classList.add("active");
                this.set_workspace_mode("split");
            });
        }

        // --- Activity Bar Buttons Binding ---
        const act_components = document.getElementById("act-btn-components");
        const act_lessons = document.getElementById("act-btn-lessons");
        const act_run = document.getElementById("act-btn-run");
        const act_terminal = document.getElementById("act-btn-terminal");
        const act_gpio = document.getElementById("act-btn-gpio");
        const act_theme = document.getElementById("act-btn-theme");

        if (act_components) {
            act_components.addEventListener("click", () => {
                const sidebar = document.getElementById("sidebar-left");
                const is_hidden = sidebar.classList.contains("hidden");
                this.toggle_sidebar("left", !is_hidden);
            });
        }

        if (act_lessons) {
            act_lessons.addEventListener("click", () => {
                const sidebar = document.getElementById("sidebar-right");
                const is_hidden = sidebar.classList.contains("hidden");
                this.toggle_sidebar("right", !is_hidden);
            });
        }

        if (act_run) {
            act_run.addEventListener("click", () => {
                const is_running = this.active_session_id !== null;
                if (is_running) {
                    this.stop_code();
                } else {
                    this.run_code();
                }
            });
        }

        if (act_terminal) {
            act_terminal.addEventListener("click", () => {
                const panel = document.getElementById("terminal-panel");
                const is_hidden = panel.classList.contains("hidden");
                this.toggle_footer_panel("console", !is_hidden);
            });
        }

        if (act_gpio) {
            act_gpio.addEventListener("click", () => {
                const panel = document.getElementById("gpio-monitor-panel");
                const is_hidden = panel.classList.contains("hidden");
                this.toggle_footer_panel("gpio", !is_hidden);
            });
        }

        if (act_theme) {
            act_theme.addEventListener("click", () => {
                const is_light = document.body.classList.contains("light-theme");
                if (is_light) {
                    document.body.classList.remove("light-theme");
                    document.body.classList.add("dark-theme");
                    act_theme.innerHTML = '<i class="fa-solid fa-sun"></i>';
                    if (CodeEditorManager.editor && typeof monaco !== "undefined") {
                        monaco.editor.setTheme("vscode-dark-theme");
                    }
                } else {
                    document.body.classList.remove("dark-theme");
                    document.body.classList.add("light-theme");
                    act_theme.innerHTML = '<i class="fa-solid fa-moon"></i>';
                    if (CodeEditorManager.editor && typeof monaco !== "undefined") {
                        monaco.editor.setTheme("vscode-light-theme");
                    }
                }
            });
        }

        // --- Keyboard Shortcuts (VSCode Style) ---
        window.addEventListener("keydown", (e) => {
            // F5: Run, Shift+F5: Stop
            if (e.key === "F5") {
                e.preventDefault();
                if (e.shiftKey) {
                    this.stop_code();
                } else {
                    this.run_code();
                }
            }
            // Ctrl+S: Save Project
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                this.save_project();
            }
        });

        // Σύνδεση των Toggles
        document.getElementById("toggle-sidebar-left").addEventListener("click", () => this.toggle_sidebar("left", true));
        document.getElementById("btn-expand-sidebar-left").addEventListener("click", () => this.toggle_sidebar("left", false));
        
        document.getElementById("toggle-sidebar-right").addEventListener("click", () => this.toggle_sidebar("right", true));
        document.getElementById("btn-expand-sidebar-right").addEventListener("click", () => this.toggle_sidebar("right", false));

        // --- Tutorial Mode Overlay ---
        document.getElementById("btn-open-tutorial").addEventListener("click", () => TutorialOverlay.open());
        document.getElementById("btn-close-tutorial").addEventListener("click", () => TutorialOverlay.close());
        document.querySelectorAll(".tut-tab").forEach(tab => {
            tab.addEventListener("click", () => TutorialOverlay.switch_tab(tab.dataset.tab));
        });

        document.getElementById("toggle-gpio").addEventListener("click", () => this.toggle_footer_panel("gpio", true));
        document.getElementById("btn-expand-gpio").addEventListener("click", () => this.toggle_footer_panel("gpio", false));

        document.getElementById("toggle-console").addEventListener("click", () => this.toggle_footer_panel("console", true));
        document.getElementById("btn-expand-console").addEventListener("click", () => this.toggle_footer_panel("console", false));

        // --- Drag-to-Resize Logic ---
        const resizer = document.getElementById("workspace-resizer");
        const breadboard = document.getElementById("breadboard-panel");
        const editor = document.getElementById("editor-panel");
        let isResizing = false;

        if(resizer) {
            resizer.addEventListener("mousedown", (e) => {
                isResizing = true;
                document.body.style.cursor = "row-resize";
                e.preventDefault();
            });

            document.addEventListener("mousemove", (e) => {
                if (!isResizing) return;
                const container = document.getElementById("workspace-center");
                const containerRect = container.getBoundingClientRect();
                
                // Υπολογισμός ποσοστού με βάση τη θέση του ποντικιού
                let percentage = ((e.clientY - containerRect.top) / containerRect.height) * 100;
                
                // Περιορισμός μεταξύ 20% και 80% για να μην κρύβονται τελείως
                if (percentage < 20) percentage = 20;
                if (percentage > 80) percentage = 80;
                
                breadboard.style.flex = `0 0 calc(${percentage}% - 6px)`;
                editor.style.flex = `0 0 calc(${100 - percentage}% - 6px)`;
            });

            document.addEventListener("mouseup", () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = "default";
                    
                    // Ενημέρωση του canvas όταν τελειώσει το resize
                    if (window.BreadboardCanvas) {
                        setTimeout(() => {
                            window.BreadboardCanvas.resize_canvas();
                            window.BreadboardCanvas.calculate_rpi_pins();
                        }, 50);
                    }
                }
            });
        }
    },

    // Δυναμική Φόρτωση της λίστας των σεναρίων
    async load_scenarios_list() {
        try {
            const response = await fetch("/api/scenarios");
            if (response.ok) {
                const scenarios = await response.json();
                const container = document.getElementById("scenarios-list-container");
                container.innerHTML = "";
                
                scenarios.forEach((scenario, index) => {
                    const item = document.createElement("div");
                    item.className = `scenario-item ${index === 0 ? 'active' : ''}`;
                    item.dataset.scenario = scenario.id;
                    
                    let diffClass = "easy";
                    if (scenario.difficulty === "Μεσαίο") diffClass = "medium";
                    if (scenario.difficulty === "Δύσκολο") diffClass = "hard";
                    
                    item.innerHTML = `
                        <div class="scenario-num">${scenario.number || (index+1).toString().padStart(2, '0')}</div>
                        <div class="scenario-info">
                            <h3>${scenario.title}</h3>
                            <span class="difficulty-tag ${diffClass}">${scenario.difficulty}</span>
                        </div>
                    `;
                    
                    item.addEventListener("click", () => {
                        document.querySelectorAll(".scenario-item").forEach(i => i.classList.remove("active"));
                        item.classList.add("active");
                        this.load_scenario(scenario.id);
                    });
                    
                    container.appendChild(item);
                });
                
                // Φόρτωση του πρώτου σεναρίου από προεπιλογή
                if (scenarios.length > 0) {
                    this.load_scenario(scenarios[0].id);
                }
            } else {
                ConsoleLogger.stderr("Αποτυχία φόρτωσης λίστας σεναρίων από το API.");
            }
        } catch (err) {
            ConsoleLogger.stderr(`Σφάλμα κατά τη φόρτωση λίστας σεναρίων: ${err}`);
        }
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
                // Αποθήκευση για χρήση από τον TutorialOverlay
                App.current_md_text = md_text;
                // Απλή προεπισκόπηση στο sidebar (τίτλος + εισαγωγή)
                document.getElementById("tutorial-text").innerHTML = TutorialOverlay.render_sidebar_preview(md_text);
                // Ενεργοποίηση κουμπιού Οδηγού
                document.getElementById("btn-open-tutorial").disabled = false;
                // Αν το overlay είναι ήδη ανοικτό, ανανέωση περιεχομένου
                if (TutorialOverlay.is_open) {
                    TutorialOverlay.open();
                }
            }
            
            // 2. Φόρτωση starter κώδικα (μόνο αν δεν εκτελείται ήδη κώδικας ή ζητήθηκε force)
            if (!this.active_session_id || force_reset_code) {
                const res_code = await fetch(`/scenarios/${scenario_id}/starter.py`);
                if (res_code.ok) {
                    const code_text = await res_code.text();
                    CodeEditorManager.set_code(code_text);
                }
            }

            // 3. Φόρτωση κυκλώματος μαζικά μέσω του API
            const res_circuit = await fetch(`/scenarios/${scenario_id}/circuit.json`);
            if (res_circuit.ok) {
                const circuit = await res_circuit.json();
                
                // Προετοιμασία των components με συντεταγμένες x, y από το circuit.json
                const components_payload = [];
                for (const comp of circuit.components) {
                    if (comp.id === "RPI") continue;
                    
                    // Αν δεν ορίζονται συντεταγμένες x, y στο circuit.json, δίνουμε προεπιλεγμένες τιμές
                    const x = comp.properties && comp.properties.x !== undefined ? comp.properties.x : 450;
                    const y = comp.properties && comp.properties.y !== undefined ? comp.properties.y : 150;
                    
                    components_payload.push({
                        id: comp.id,
                        type: comp.type,
                        properties: { x, y, ...comp.properties }
                    });
                }

                // Αποστολή αιτήματος μαζικής φόρτωσης στο backend
                const load_response = await fetch("/api/circuit/load", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        components: components_payload,
                        wires: circuit.wires
                    })
                });

                if (!load_response.ok) {
                    const err = await load_response.json();
                    ConsoleLogger.stderr(`Αποτυχία μαζικής φόρτωσης κυκλώματος: ${err.detail || "Άγνωστο σφάλμα"}`);
                }
            }
            
        } catch (err) {
            ConsoleLogger.stderr(`Αποτυχία φόρτωσης σεναρίου: ${err}`);
        }
    },

    // Αποθήκευση Project (Κύκλωμα + Κώδικας)
    async save_project() {
        try {
            // Λήψη δεδομένων κυκλώματος από το API
            const res = await fetch("/api/circuit");
            const circuit_data = await res.json();
            
            // Λήψη κώδικα
            const code = CodeEditorManager.get_code();
            
            // Δημιουργία δομής project
            const project = {
                version: "1.0",
                type: "rpi_emulator_project",
                circuit: circuit_data,
                code: code
            };
            
            // Δημιουργία αρχείου προς λήψη
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 4));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "my_project.rpi");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            
            ConsoleLogger.system("Το project αποθηκεύτηκε επιτυχώς (.rpi).");
        } catch (err) {
            ConsoleLogger.stderr(`Σφάλμα κατά την αποθήκευση: ${err}`);
        }
    },

    // Φόρτωση Project (.rpi)
    async load_project(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const project = JSON.parse(e.target.result);
                
                // Απλός έλεγχος συμβατότητας
                if (project.type !== "rpi_emulator_project" && (!project.components || !project.wires)) {
                    throw new Error("Μη έγκυρο αρχείο project.");
                }
                
                // Φόρτωση κώδικα (αν υπάρχει)
                if (project.code !== undefined) {
                    CodeEditorManager.set_code(project.code);
                }
                
                // Φόρτωση Κυκλώματος
                const circuit = project.circuit || project; // Υποστήριξη και παλαιότερων δομών χωρίς type
                if (circuit && circuit.components && circuit.wires) {
                    const components_payload = [];
                    for (const [id, comp] of Object.entries(circuit.components)) {
                        if (id === "RPI") continue;
                        components_payload.push({
                            id: id,
                            type: comp.type,
                            properties: comp.properties
                        });
                    }
                    
                    const load_response = await fetch("/api/circuit/load", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            components: components_payload,
                            wires: circuit.wires
                        })
                    });
                    
                    if (!load_response.ok) {
                        const err = await load_response.json();
                        throw new Error(err.detail || "Σφάλμα φόρτωσης κυκλώματος.");
                    }
                }
                
                ConsoleLogger.system(`Το project φορτώθηκε επιτυχώς από το ${file.name}.`);
            } catch (err) {
                ConsoleLogger.stderr(`Σφάλμα κατά τη φόρτωση του project: ${err.message}`);
            }
            
            // Μηδενισμός του input για να μπορεί να ξαναφορτωθεί το ίδιο αρχείο
            event.target.value = "";
        };
        reader.readAsText(file);
    },

    // Απλή μετατροπή Markdown σε HTML — πλέον χρησιμοποιεί τον TutorialOverlay renderer
    simple_markdown_to_html(md) {
        return TutorialOverlay.render_sidebar_preview(md);
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
        const act_btn_run = document.getElementById("act-btn-run");
        const status_bar = document.getElementById("vscode-status-bar");
        const status_env = document.getElementById("status-env");
        
        if (is_running) {
            btn_run.classList.add("disabled");
            btn_run.disabled = true;
            btn_stop.classList.remove("disabled");
            btn_stop.disabled = false;
            
            // Ενημέρωση Activity Bar
            if (act_btn_run) {
                act_btn_run.innerHTML = "<i class=\"fa-solid fa-stop\" style=\"color: var(--danger);\"></i>";
                act_btn_run.title = "Διακοπή Κώδικα (Shift+F5)";
                act_btn_run.classList.add("active");
            }
            
            // Ενημέρωση Status Bar
            if (status_bar) {
                status_bar.classList.add("running");
            }
            if (status_env) {
                status_env.innerHTML = "<i class=\"fa-solid fa-spinner fa-spin\"></i> Running";
            }
        } else {
            btn_run.classList.remove("disabled");
            btn_run.disabled = false;
            btn_stop.classList.add("disabled");
            btn_stop.disabled = true;
            
            // Ενημέρωση Activity Bar
            if (act_btn_run) {
                act_btn_run.innerHTML = "<i class=\"fa-solid fa-play\"></i>";
                act_btn_run.title = "Εκτέλεση Κώδικα (F5)";
                act_btn_run.classList.remove("active");
            }
            
            // Ενημέρωση Status Bar
            if (status_bar) {
                status_bar.classList.remove("running");
            }
            if (status_env) {
                status_env.innerHTML = "<i class=\"fa-solid fa-circle-check\"></i> Ready";
            }
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

    // set_workspace_mode changes layout focus between Circuit designing, Python coding, or Split display
    set_workspace_mode(mode) {
        const breadboard_panel = document.getElementById("breadboard-panel");
        const editor_panel = document.getElementById("editor-panel");
        const resizer = document.getElementById("workspace-resizer");

        if (mode === "circuit") {
            editor_panel.classList.add("hidden");
            breadboard_panel.classList.remove("hidden");
            if (resizer) resizer.classList.add("hidden");
            breadboard_panel.style.flex = "1";
        } else if (mode === "code") {
            breadboard_panel.classList.add("hidden");
            editor_panel.classList.remove("hidden");
            if (resizer) resizer.classList.add("hidden");
            editor_panel.style.flex = "1";
        } else if (mode === "split") {
            breadboard_panel.classList.remove("hidden");
            editor_panel.classList.remove("hidden");
            if (resizer) resizer.classList.remove("hidden");
            breadboard_panel.style.flex = "0 0 calc(50% - 6px)";
            editor_panel.style.flex = "0 0 calc(50% - 6px)";
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
            
            // Ενημέρωση active κατάστασης στο Activity Bar
            if (side === "left") {
                const act_btn = document.getElementById("act-btn-components");
                if (act_btn) act_btn.classList.remove("active");
            } else {
                const act_btn = document.getElementById("act-btn-lessons");
                if (act_btn) act_btn.classList.remove("active");
            }
        } else {
            sidebar.classList.remove("hidden");
            expand_btn.classList.add("hidden");
            
            // Ενημέρωση active κατάστασης στο Activity Bar
            if (side === "left") {
                const act_btn = document.getElementById("act-btn-components");
                if (act_btn) act_btn.classList.add("active");
            } else {
                const act_btn = document.getElementById("act-btn-lessons");
                if (act_btn) act_btn.classList.add("active");
            }
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
            
            // Ενημέρωση active κατάστασης στο Activity Bar
            if (panel === "gpio") {
                const act_btn = document.getElementById("act-btn-gpio");
                if (act_btn) act_btn.classList.remove("active");
            } else {
                const act_btn = document.getElementById("act-btn-terminal");
                if (act_btn) act_btn.classList.remove("active");
            }
        } else {
            target.classList.remove("collapsed");
            expand_btn.classList.add("hidden");
            
            // Ενημέρωση active κατάστασης στο Activity Bar
            if (panel === "gpio") {
                const act_btn = document.getElementById("act-btn-gpio");
                if (act_btn) act_btn.classList.add("active");
            } else {
                const act_btn = document.getElementById("act-btn-terminal");
                if (act_btn) act_btn.classList.add("active");
            }
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
