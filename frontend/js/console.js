// Βοηθητικό module για τη διαχείριση της κονσόλας εξόδου στο UI
const ConsoleLogger = {
    element: null,

    // Αρχικοποίηση με σύνδεση του HTML στοιχείου
    init() {
        this.element = document.getElementById("console-output");
        this.clear();
    },

    // Καθαρισμός όλων των καταγραφών
    clear() {
        if (this.element) {
            this.element.innerHTML = "";
        }
    },

    // Προσθήκη γραμμής καταγραφής
    appendLine(text, type = "stdout-log") {
        if (!this.element) return;

        const lineDiv = document.createElement("div");
        lineDiv.className = `log-line ${type}`;
        
        // Λήψη τρέχουσας ώρας σε μορφή HH:MM:SS
        const now = new Date();
        const timeStr = now.toTimeString().split(" ")[0];
        
        // Μορφοποίηση κειμένου
        lineDiv.textContent = `[${timeStr}] ${text}`;
        
        this.element.appendChild(lineDiv);
        
        // Αυτόματη κύλιση (scroll) στο κάτω μέρος της κονσόλας
        this.element.scrollTop = this.element.scrollHeight;
    },

    // Μέθοδος για καταγραφή συστήματος
    system(text) {
        this.appendLine(text, "system-log");
    },

    // Μέθοδος για καταγραφή stdout (print)
    stdout(text) {
        this.appendLine(text, "stdout-log");
    },

    // Μέθοδος για καταγραφή stderr (σφάλματα Python)
    stderr(text) {
        this.appendLine(text, "stderr-log");
    },

    // Μέθοδος για καταγραφή προειδοποιήσεων (π.χ. overcurrent)
    warn(text) {
        this.appendLine(text, "warning-log");
    }
};

window.ConsoleLogger = ConsoleLogger;
