// Κλάση διαχείρισης WebSocket σύνδεσης με το backend
class SimWebSocket {
    constructor(host = window.location.host || "localhost:8000") {
        this.host = host;
        this.socket = null;
        this.listeners = {};
    }

    // Έναρξη της σύνδεσης
    connect() {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        this.socket = new WebSocket(`${protocol}//${this.host}/api/websocket`);

        this.socket.onopen = () => {
            console.log("[WebSocket] Σύνδεση επιτεύχθηκε με επιτυχία.");
            this.trigger("connect", null);
        };

        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.trigger(message.type, message);
            } catch (err) {
                console.error("[WebSocket] Σφάλμα ανάλυσης μηνύματος JSON:", err);
            }
        };

        this.socket.onclose = () => {
            console.warn("[WebSocket] Η σύνδεση έκλεισε. Επανασύνδεση σε 2 δευτερόλεπτα...");
            this.trigger("disconnect", null);
            setTimeout(() => this.connect(), 2000);
        };

        this.socket.onerror = (error) => {
            console.error("[WebSocket] Σφάλμα σύνδεσης:", error);
            this.trigger("error", error);
        };
    }

    // Εγγραφή listener για συγκεκριμένο τύπο μηνύματος
    on(type, callback) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(callback);
    }

    // Πυροδότηση όλων των εγγεγραμμένων callbacks
    trigger(type, data) {
        if (this.listeners[type]) {
            this.listeners[type].forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`[WebSocket] Σφάλμα κατά την εκτέλεση callback για το event ${type}:`, err);
                }
            });
        }
    }

    // Αποστολή μηνύματος στο backend
    send(type, payload = {}) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type, ...payload }));
        } else {
            console.warn("[WebSocket] Δεν είναι δυνατή η αποστολή μηνύματος, το socket είναι κλειστό.");
        }
    }
}

// Δημιουργία καθολικού στιγμιότυπου
window.simWebSocket = new SimWebSocket();
