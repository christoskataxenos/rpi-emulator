// Διαχείριση των καλωδιώσεων και των συνδέσεων
const WiringManager = {
    selected_terminal: null,
    current_color: "#ff0000",

    init() {
        // Σύνδεση των χρωματικών επιλογέων από το UI
        const color_dots = document.querySelectorAll(".wire-color-picker .color-dot");
        color_dots.forEach(dot => {
            dot.addEventListener("click", () => {
                // Αφαίρεση της κλάσης active από όλα τα dots
                color_dots.forEach(d => d.classList.remove("active"));
                // Προσθήκη στο επιλεγμένο dot
                dot.classList.add("active");
                this.current_color = dot.dataset.color;
            });
        });
    },

    // Επιλογή ακροδέκτη
    select_terminal(component_id, terminal_name) {
        if (!this.selected_terminal) {
            // Αν δεν υπάρχει επιλεγμένος ακροδέκτης, ορίζουμε αυτόν ως αρχή
            this.selected_terminal = { component_id, terminal_name };
            ConsoleLogger.system(`Επιλέχθηκε αρχή καλωδίου: ${component_id} -> ${terminal_name}`);
        } else {
            // Αν υπάρχει ήδη, συνδέουμε την αρχή με το νέο ακροδέκτη (τέλος)
            const from_comp = this.selected_terminal.component_id;
            const from_term = this.selected_terminal.terminal_name;
            
            // Έλεγχος αν ο χρήστης έκανε κλικ στον ίδιο ακροδέκτη
            if (from_comp === component_id && from_term === terminal_name) {
                this.cancel();
                return;
            }

            this.create_wire(from_comp, from_term, component_id, terminal_name);
        }
    },

    // Αποστολή αιτήματος για δημιουργία καλωδίου στο backend
    async create_wire(from_comp, from_term, to_comp, to_term) {
        // Αυτόματη επιλογή χρώματος με βάση τις συνδέσεις Power/GND
        let wire_color = this.current_color;

        const check_vcc_gnd = (comp, term) => {
            if (comp === "RPI") {
                const pin_num = parseInt(term.replace("pin", ""));
                const pin_def = window.BreadboardCanvas ? window.BreadboardCanvas.rpi_pin_definitions[pin_num - 1] : null;
                if (pin_def) {
                    if (pin_def.type === "VCC3" || pin_def.type === "VCC5") return "VCC";
                    if (pin_def.type === "GND") return "GND";
                }
            }
            return null;
        };

        const from_type = check_vcc_gnd(from_comp, from_term);
        const to_type = check_vcc_gnd(to_comp, to_term);

        if (from_type === "VCC" || to_type === "VCC") {
            wire_color = "#ff0000"; // Κόκκινο για τροφοδοσία VCC
        } else if (from_type === "GND" || to_type === "GND") {
            wire_color = "#000000"; // Μαύρο για γείωση GND
        }

        const payload = {
            from_component: from_comp,
            from_terminal: from_term,
            to_component: to_comp,
            to_terminal: to_term,
            color: wire_color
        };

        try {
            const response = await fetch("/api/circuit/wire", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                ConsoleLogger.system(`Συνδέθηκε καλώδιο μεταξύ ${from_comp} και ${to_comp}.`);
            } else {
                const error = await response.json();
                ConsoleLogger.stderr(`Αποτυχία σύνδεσης: ${error.detail || "Άγνωστο σφάλμα"}`);
            }
        } catch (err) {
            ConsoleLogger.stderr(`Σφάλμα δικτύου κατά τη σύνδεση καλωδίου: ${err}`);
        }

        // Επαναφορά της επιλογής
        this.selected_terminal = null;
    },

    // Αποστολή αιτήματος για διαγραφή καλωδίου
    async delete_wire(from_comp, from_term, to_comp, to_term) {
        const payload = {
            from_component: from_comp,
            from_terminal: from_term,
            to_component: to_comp,
            to_terminal: to_term
        };

        try {
            const response = await fetch("/api/circuit/wire/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                ConsoleLogger.system(`Αφαιρέθηκε καλώδιο μεταξύ ${from_comp} και ${to_comp}.`);
            }
        } catch (err) {
            ConsoleLogger.stderr(`Σφάλμα δικτύου κατά τη διαγραφή καλωδίου: ${err}`);
        }
    },

    // Ακύρωση της τρέχουσας επιλογής καλωδίωσης
    cancel() {
        if (this.selected_terminal) {
            ConsoleLogger.system("Η καλωδίωση ακυρώθηκε.");
            this.selected_terminal = null;
        }
    }
};

window.WiringManager = WiringManager;
