# Changelog / Ιστορικό Αλλαγών

Όλες οι σημαντικές αλλαγές στο project **Raspberry Pi Educational Emulator Suite** καταγράφονται σε αυτό το αρχείο, εστιάζοντας στη μετάβαση από την αρχική έκδοση (Early MVP) στην τρέχουσα έκδοση (.NET WPF).

---

## [V1.0.0] - Τρέχουσα Έκδοση (Μετάβαση σε .NET WPF & Νέες Δυνατότητες)

### 🖥️ Native .NET WPF Desktop Client (Αντικατάσταση PyQt6)
- **Πλήρης Κατάργηση του PyQt6**: Αφαιρέθηκε ο Pyqt6 WebView wrapper και όλες οι βαριές εξαρτήσεις του GUI από την Python (όπως το `PyQtWebEngine`).
- **Native GUI (C# / XAML)**:
  - Σχεδιασμός native καμβά με Drag & Drop για την τοποθέτηση εξαρτημάτων.
  - Δυναμική σχεδίαση καλωδίων (visual wiring) με επιλογή χρώματος καλωδίου (Κόκκινο, Μαύρο, Μπλε, Πράσινο, Κίτρινο).
  - Native Grid απεικόνισης των 40 GPIO pins του Raspberry Pi με live κατάσταση.
  - Ενσωματωμένος Code Editor και Native Console Output.
- **Process Supervision**: Η desktop εφαρμογή αναλαμβάνει την αυτόματη εκκίνηση και τον ασφαλή τερματισμό του FastAPI backend server στο παρασκήνιο.

### 🔌 C/C++ Transpiler (Μεταφραστής C σε Python)
- **Υποστήριξη Κώδικα C/C++**: Ενσωμάτωση μηχανισμού (`backend/sandbox/transpiler.py`) που ανιχνεύει αν ο εισαγόμενος κώδικας είναι C/C++ (σύνταξη Arduino/STM32 HAL) και τον μεταφράζει αυτόματα σε Python.
- **Arduino APIs Shims**: Υλοποίηση shims για τις βασικές συναρτήσεις της C όπως `pinMode()`, `digitalWrite()`, `digitalRead()`, `analogRead()`, `delay()`, `setup()` και `loop()`.
- **Νέο Σενάριο**: Προσθήκη του σεναρίου `07_dsd_blink_c` που επιδεικνύει το αναβοσβήσιμο LED γραμμένο σε C.

### 🔒 Επίλυση Παγώματος Backend (Sandbox Code Execution Freeze Fix)
- **Αποφυγή Uvicorn Reloads**: Η εκτέλεση του κώδικα μεταφέρθηκε από τον φάκελο εργασίας του project στον προσωρινό κατάλογο του συστήματος (`tempfile.gettempdir()`). Αυτό αποτρέπει το watchdog του uvicorn από το να ανιχνεύει αλλαγές αρχείων και να προκαλεί συνεχείς επανεκκινήσεις (freezes) του server.

### 🌡️ Προηγμένοι Αισθητήρες & Interactive Sliders
- **Νέα Εξαρτήματα**: Προσθήκη αισθητήρων DHT11 (Θερμοκρασίας/Υγρασίας), PIR (Κίνησης), LDR (Φωτός), Ultrasonic HC-SR04 (Απόστασης) και αναλογικού Ποτενσιόμετρου.
- **Live UI Sliders**: Δυνατότητα ρύθμισης των τιμών των αισθητήρων κατά την εκτέλεση του κώδικα μέσω αναδυόμενων ρυθμιστικών (sliders) στο UI.

### 📚 Tutorial Mode & Checklists
- **Ανασχεδιασμός Οδηγιών**: Προσθήκη συστήματος Tutorial Mode που διαβάζει τα `README.md` των σεναρίων και τα χωρίζει σε:
  - **Στόχοι** (Learning Goals)
  - **Κύκλωμα** (Wiring Diagram / Steps)
  - **Οδηγίες** (Checklist με αυτόματο Progress Bar και strikethrough εφέ).

### ⚡ Φυσικός Κινητήρας & Ασφάλεια Κυκλωμάτων
- **Ohm's Law Solver**: Υπολογισμός τάσεων και ρευμάτων σε πραγματικό χρόνο.
- **Short Circuit / Overcurrent Detection**: Ανίχνευση βραχυκυκλωμάτων και υπερέντασης στα LED (π.χ. LED χωρίς αντίσταση) με εμφάνιση dynamic Warning Banner στο desktop UI.

### 💾 Διαχείριση Projects (.rpi)
- **Save / Load Workspace**: Δυνατότητα αποθήκευσης ολόκληρης της διάταξης του καμβά (εξαρτήματα, συνδέσεις καλωδίων) μαζί με τον κώδικα σε αρχείο `.rpi` και επαναφόρτωσής του.

---

## [Early MVP] - Αρχική Έκδοση (Πρώτο Πρωτότυπο)

### Χαρακτηριστικά
- **GUI**: Απλή desktop εφαρμογή PyQt6 που φόρτωνε ένα WebView με HTML5/JavaScript καμβά.
- **Βασικά Εξαρτήματα**: Μόνο LED, Αντίσταση, Button και Buzzer.
- **Απλό Code Execution**: Απλή εκτέλεση Python κώδικα τοπικά που προκαλούσε παγώματα στον FastAPI server.
- **Σενάρια**: Βασικά σενάρια Blink LED και Button Input χωρίς διαδραστικό checklist.
