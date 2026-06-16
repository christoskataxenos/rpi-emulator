// Module διαχείρισης του Monaco Code Editor
const CodeEditorManager = {
    editor: null,

    init() {
        // Ρύθμιση του RequireJS για φόρτωση του Monaco Editor από το CDN
        require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs" } });
        
        require(["vs/editor/editor.main"], () => {
            // Ορισμός του θέματος VS Code Dark
            monaco.editor.defineTheme("rpi-dark-theme", {
                base: "vs-dark",
                inherit: true,
                rules: [
                    { token: "comment", foreground: "6A9955" },
                    { token: "keyword", foreground: "569CD6" },
                    { token: "string", foreground: "CE9178" }
                ],
                colors: {
                    "editor.background": "#0b0e14",
                    "editor.lineHighlightBackground": "#171d26"
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
            
            // Φόρτωση του πρώτου σεναρίου
            App.load_scenario("01_blink_led");
        });
    },

    // Λήψη του κώδικα από τον editor
    get_code() {
        return this.editor ? this.editor.getValue() : "";
    },

    // Ορισμός του κώδικα στον editor
    set_code(code) {
        if (this.editor) {
            this.editor.setValue(code);
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
