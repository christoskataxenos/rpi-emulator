// Module διαχείρισης του Monaco Code Editor
const CodeEditorManager = {
    editor: null,
    pending_code: null,

    init() {
        // Έλεγχος αν ο loader του Monaco (require) είναι διαθέσιμος (π.χ. αν είμαστε offline)
        if (typeof require === "undefined") {
            ConsoleLogger.stderr("Ο loader του Monaco Editor δεν είναι διαθέσιμος. Ενεργοποίηση offline λειτουργίας.");
            this.setup_fallback_editor();
            return;
        }

        // Ρύθμιση του Monaco Editor Loader για φόρτωση από το CDN
        require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs" } });
        
        // Ορισμός χρονικού ορίου 5 δευτερολέπτων για τη φόρτωση του Monaco Editor
        const timeout = setTimeout(() => {
            if (!this.editor) {
                ConsoleLogger.stderr("Η φόρτωση του Monaco Editor καθυστερεί ή απέτυχε. Μετάβαση σε απλό επεξεργαστή κειμένου.");
                this.setup_fallback_editor();
            }
        }, 5000);

        require(["vs/editor/editor.main"], () => {
            clearTimeout(timeout);
            if (this.editor) return; // Έχει ήδη ενεργοποιηθεί ο fallback editor

            // Ορισμός του θέματος VS Code Light
            monaco.editor.defineTheme("rpi-dark-theme", {
                base: "vs",
                inherit: true,
                rules: [
                    { token: "comment", foreground: "008000" },
                    { token: "keyword", foreground: "0000FF" },
                    { token: "string", foreground: "A31515" }
                ],
                colors: {
                    "editor.background": "#f5f7fa",
                    "editor.lineHighlightBackground": "#e4e8f0"
                }
            });

            // Δημιουργία του Monaco Editor
            this.editor = monaco.editor.create(document.getElementById("code-editor-container"), {
                value: "# Γράψτε τον κώδικα Python σας εδώ\n",
                language: "python",
                theme: "rpi-dark-theme",
                automaticLayout: true,
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                lineNumbers: "on",
                minimap: { enabled: false }
            });

            // Εγγραφή των προτάσεων αυτόματης συμπλήρωσης (IntelliSense)
            this.setup_autocomplete();
            
            // Φόρτωση του εκκρεμούς κώδικα αν υπάρχει
            if (this.pending_code) {
                this.set_code(this.pending_code);
                this.pending_code = null;
            }

            // Αρχικοποίηση layout σε circuit mode μετά τη σωστή φόρτωση του editor
            setTimeout(() => {
                App.set_workspace_mode("circuit");
            }, 100);
        });
    },

    // Ρύθμιση απλού textarea σε περίπτωση σφάλματος φόρτωσης/offline
    setup_fallback_editor() {
        const container = document.getElementById("code-editor-container");
        if (!container) return;

        container.innerHTML = `
            <textarea id="fallback-textarea" style="
                width: 100%;
                height: 100%;
                box-sizing: border-box;
                resize: none;
                font-family: 'JetBrains Mono', monospace;
                font-size: 13px;
                padding: 10px;
                border: none;
                background: #f5f7fa;
                color: #333;
                outline: none;
            " placeholder="# Γράψτε τον κώδικα Python σας εδώ..."></textarea>
        `;

        this.editor = {
            getValue: () => document.getElementById("fallback-textarea").value,
            setValue: (val) => {
                const ta = document.getElementById("fallback-textarea");
                if (ta) ta.value = val;
            }
        };

        // Φόρτωση του εκκρεμούς κώδικα αν υπάρχει
        if (this.pending_code) {
            this.set_code(this.pending_code);
            this.pending_code = null;
        }

        // Αρχικοποίηση layout
        setTimeout(() => {
            App.set_workspace_mode("circuit");
        }, 100);
    },

    // Λήψη του κώδικα από τον editor
    get_code() {
        return this.editor ? this.editor.getValue() : "";
    },

    // Ορισμός του κώδικα στον editor
    set_code(code) {
        if (this.editor) {
            this.editor.setValue(code);
        } else {
            this.pending_code = code;
        }
    },

    // Ρύθμιση IntelliSense προτάσεων για RPi.GPIO και gpiozero
    setup_autocomplete() {
        monaco.languages.registerCompletionItemProvider("python", {
            provideCompletionItems: (model, position) => {
                const suggestions = [
                    // Imports
                    {
                        label: "import RPi.GPIO as GPIO",
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "import RPi.GPIO as GPIO\n",
                        documentation: "Εισαγωγή της βιβλιοθήκης RPi.GPIO για έλεγχο των pins."
                    },
                    {
                        label: "import gpiozero",
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: "from gpiozero import LED, Button, Buzzer\n",
                        documentation: "Εισαγωγή εξαρτημάτων από τη βιβλιοθήκη gpiozero."
                    },
                    // RPi.GPIO Functions
                    {
                        label: "GPIO.setmode",
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: "GPIO.setmode(GPIO.BCM)",
                        documentation: "Ορισμός αρίθμησης pin (BCM ή BOARD)."
                    },
                    {
                        label: "GPIO.setup",
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: "GPIO.setup(${1:pin}, GPIO.OUT)",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: "Ρύθμιση ενός pin ως OUT ή IN."
                    },
                    {
                        label: "GPIO.output",
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: "GPIO.output(${1:pin}, GPIO.HIGH)",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: "Ορισμός της κατάστασης εξόδου ενός pin (HIGH/LOW)."
                    },
                    {
                        label: "GPIO.input",
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: "GPIO.input(${1:pin})",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: "Ανάγνωση της ψηφιακής τιμής εισόδου ενός pin."
                    },
                    {
                        label: "GPIO.cleanup",
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: "GPIO.cleanup()",
                        documentation: "Καθαρισμός όλων των GPIO ρυθμίσεων."
                    },
                    // Constants
                    { label: "GPIO.BCM", kind: monaco.languages.CompletionItemKind.Constant, insertText: "GPIO.BCM" },
                    { label: "GPIO.BOARD", kind: monaco.languages.CompletionItemKind.Constant, insertText: "GPIO.BOARD" },
                    { label: "GPIO.OUT", kind: monaco.languages.CompletionItemKind.Constant, insertText: "GPIO.OUT" },
                    { label: "GPIO.IN", kind: monaco.languages.CompletionItemKind.Constant, insertText: "GPIO.IN" },
                    { label: "GPIO.HIGH", kind: monaco.languages.CompletionItemKind.Constant, insertText: "GPIO.HIGH" },
                    { label: "GPIO.LOW", kind: monaco.languages.CompletionItemKind.Constant, insertText: "GPIO.LOW" },
                    { label: "GPIO.PUD_UP", kind: monaco.languages.CompletionItemKind.Constant, insertText: "GPIO.PUD_UP" },
                    { label: "GPIO.PUD_DOWN", kind: monaco.languages.CompletionItemKind.Constant, insertText: "GPIO.PUD_DOWN" },
                    // gpiozero LED
                    {
                        label: "LED",
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: "led = LED(${1:pin})",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: "Δημιουργία αντικειμένου LED (gpiozero)."
                    },
                    {
                        label: "led.on",
                        kind: monaco.languages.CompletionItemKind.Method,
                        insertText: "led.on()",
                        documentation: "Ενεργοποίηση LED."
                    },
                    {
                        label: "led.off",
                        kind: monaco.languages.CompletionItemKind.Method,
                        insertText: "led.off()",
                        documentation: "Απενεργοποίηση LED."
                    },
                    // gpiozero Button
                    {
                        label: "Button",
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: "button = Button(${1:pin})",
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: "Δημιουργία αντικειμένου Button (gpiozero)."
                    }
                ];
                return { suggestions: suggestions };
            }
        });
    }
};

window.CodeEditorManager = CodeEditorManager;
