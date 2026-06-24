# Raspberry Pi Educational Emulator Suite

Ένας ολοκληρωμένος, διαδραστικός και εκπαιδευτικός εξομοιωτής Raspberry Pi GPIO, ο οποίος επιτρέπει σε μαθητές και χομπίστες να σχεδιάζουν κυκλώματα, να συνδέουν εξαρτήματα (LEDs, αντιστάσεις, αισθητήρες) και να τα προγραμματίζουν σε **Python** ή **C/C++** — εξ ολοκλήρου σε περιβάλλον εξομοίωσης, χωρίς την ανάγκη για πραγματικό hardware.

---

## 🚀 Αρχιτεκτονική & Νέο Desktop Client (.NET WPF)

Η εφαρμογή έχει αναβαθμιστεί ριζικά. Η παλιά υλοποίηση desktop με PyQt6 αντικαταστάθηκε από μια **native desktop εφαρμογή σε .NET WPF (C#)**, προσφέροντας βέλτιστη απόδοση στα Windows, native drag-and-drop καμβά σχεδίασης και αυτόματη διαχείριση (supervision) του FastAPI backend server.

```
┌────────────────────────────────────────────────────────┐
│               WPF Desktop Application (C#)             │
│  - Drag-and-drop Canvas & Visual Wiring                │
│  - Real-time 40-Pin GPIO Grid                          │
│  - Built-in Editor & Real-time Console                 │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP REST & WebSockets
┌──────────────────────────▼─────────────────────────────┐
│                 FastAPI Backend (Python)               │
│  - Physics Engine (Ohm's Law, Short-Circuit Check)     │
│  - Sandboxed Runner (Prevents Uvicorn reloads)         │
│  - C++ to Python Transpiler (Arduino HAL Shims)       │
└────────────────────────────────────────────────────────┘
```

---

## ✨ Κύρια Χαρακτηριστικά

### 🖥️ Native Client (.NET WPF)
- **Visual Design Canvas**: Σχεδιασμός κυκλωμάτων με drag-and-drop εξαρτημάτων. Δημιουργία καλωδιώσεων (wiring) κάνοντας κλικ στα terminals των εξαρτημάτων και στα pins του RPi.
- **Interactive 40-Pin RPi Matrix**: Δυναμικό grid που απεικονίζει σε πραγματικό χρόνο την κατάσταση (INPUT/OUTPUT/PWM), το pull-up/pull-down configuration και τις λογικές τιμές (HIGH/LOW) κάθε pin.
- **Real-time Console Output**: Άμεση ανακατεύθυνση του `stdout` και `stderr` από τον κώδικα που εκτελείται στο panel της κονσόλας με χρωματική κωδικοποίηση.
- **Automatic Process Supervision**: Η WPF εφαρμογή ελέγχει αν η θύρα `8000` είναι ελεύθερη, εκκινεί αυτόματα το FastAPI backend (uvicorn) στο παρασκήνιο και το τερματίζει με ασφάλεια κατά το κλείσιμο.
- **Warning Banner**: Δυναμική προειδοποίηση στο UI σε περίπτωση βραχυκυκλώματος ή υπερέντασης (overcurrent) στα LEDs, προστατεύοντας την "εικονική" πλακέτα.

### 🔌 C/C++ Transpiler (Μεταφραστής C σε Python)
- **Arduino/STM32-like HAL support**: Το backend ενσωματώνει έναν έξυπνο transpiler (`backend/sandbox/transpiler.py`). Αν ο χρήστης γράψει κώδικα C/C++ (π.χ. με δομή `setup()` και `loop()`, `pinMode()`, `digitalWrite()`), το σύστημα τον μεταφράζει αυτόματα σε Python κώδικα που εκτελείται πάνω στα GPIO shims.
- **Σενάριο C**: Περιλαμβάνεται έτοιμο εργαστήριο (`scenarios/07_dsd_blink_c`) με starter κώδικα C για άμεση δοκιμή της λειτουργίας.

### 🔒 Ασφαλής & Σταθερός Code Executor (Sandbox Freeze Fix)
- **Uvicorn Reload Protection**: Ο κώδικας του μαθητή εκτελείται πλέον σε έναν απομονωμένο προσωρινό κατάλογο του συστήματος (`tempfile.gettempdir()`) αντί για τον φάκελο εργασίας του project. Αυτό αποτρέπει το uvicorn watchdog από το να προκαλεί συνεχόμενα restarts και παγώματα (freezes) του backend.
- **Real-time WebSockets**: Τα shims στέλνουν άμεσα τις καταστάσεις τους στο backend, το οποίο με τη σειρά του τις εκπέμπει μέσω WebSockets στο WPF UI.

### 🌡️ Εμπλουτισμένη Βιβλιοθήκη Εξαρτημάτων & Αισθητήρων
- **Βασικά Εξαρτήματα**: LEDs (κόκκινο, πράσινο, κίτρινο), Αντιστάσεις (330Ω, 10kΩ), Push Buttons, Buzzers.
- **Αισθητήρες (Sensors)**: DHT11 (Θερμοκρασία/Υγρασία), PIR (Ανιχνευτής Κίνησης), LDR (Φωτοαντιστάτης), HC-SR04 (Υπερήχων).
- **Αναλογικό Ποτενσιόμετρο**: Επιτρέπει τον έλεγχο αναλογικών σημάτων.
- **Interactive UI Sliders**: Κάνοντας κλικ στους αισθητήρες, ανοίγει μενού με sliders για τη ρύθμιση φυσικών τιμών (π.χ. θερμοκρασία, απόσταση σε cm, φωτεινότητα) σε πραγματικό χρόνο.

### 📚 Tutorial Mode & Project Management
- **Scenario System**: Έτοιμα εκπαιδευτικά σενάρια με οδηγίες, στόχους, διαγράμματα σύνδεσης και διαδραστική λίστα ελέγχου (checkboxes) με progress bar.
- **Save/Load (.rpi)**: Εξαγωγή και εισαγωγή ολόκληρου του workspace (κύκλωμα, καλώδια και κώδικας) σε ένα ενιαίο αρχείο `.rpi` για εύκολη αποθήκευση της προόδου.

---

## 🛠️ Δομή του Project

```
rpi-emulator/
├── backend/                  # FastAPI server, GPIO shims & Sandbox
│   ├── main.py               # API Endpoints (REST & WebSockets)
│   ├── sandbox/              
│   │   ├── executor.py       # Εκτελεστής κώδικα (αποφυγή uvicorn reload)
│   │   └── transpiler.py     # Transpiler από C σε Python
│   ├── shims/                # GPIO Mocked Libraries (RPi.GPIO, gpiozero, dht)
│   └── simulator/            
│       ├── circuit.py        # Διαχείριση εξαρτημάτων & συνδέσεων
│       ├── gpio_state.py     # Registry καταστάσεων των pins
│       └── physics.py        # Κινητήρας φυσικής & Ohm's Law
├── desktop/                  # .NET WPF Desktop App (C#)
│   ├── MainWindow.xaml       # UI Διεπαφή (Canvas, Editor, Pins Grid)
│   ├── MainWindow.xaml.cs    # Logic & Backend Connection
│   ├── CircuitComponent.cs   # Data Model Εξαρτημάτων
│   ├── GpioPin.cs            # Data Model GPIO Pins
│   └── VisualWire.cs         # Data Model Καλωδίων
├── frontend/                 # Web Client Frontend (HTML/CSS/JS - Option A)
├── scenarios/                # Εκπαιδευτικά σενάρια (starter.py, circuit.json, README.md)
└── tests/                    # Unit και integration tests
```

---

## 🚀 Οδηγίες Εγκατάστασης & Εκτέλεσης

### Προαπαιτούμενα
1. **Python 3.10+** (εγκατεστημένη στο PATH) — [Λήψη Python](https://www.python.org/downloads/)
2. **.NET Runtime / SDK** (.NET 8.0+ για την εκτέλεση της WPF εφαρμογής) — [Λήψη .NET](https://dotnet.microsoft.com/download)

### 1. Εγκατάσταση Εξαρτήσεων Backend
Ανοίξτε ένα τερματικό και εγκαταστήστε τα Python πακέτα:
```bash
pip install -r backend/requirements.txt
```

### 2. Εκτέλεση της Desktop Εφαρμογής (WPF)
- **Μέσω Visual Studio / dotnet CLI**:
  Μεταβείτε στον κατάλογο `desktop` και εκτελέστε:
  ```bash
  dotnet run --project desktop/RpiEmulatorDesktop.csproj
  ```
  *(Η WPF εφαρμογή θα εντοπίσει αυτόματα ότι το backend δεν τρέχει και θα το εκκινήσει στη θύρα 8000).*

### 3. Εναλλακτική Εκτέλεση (Web Client στο Browser)
Αν θέλετε να χρησιμοποιήσετε την browser έκδοση:
1. Εκκινήστε χειροκίνητα το backend:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```
2. Ανοίξτε το αρχείο `frontend/index.html` στον browser σας ή επισκεφθείτε τη διεύθυνση [http://localhost:8000](http://localhost:8000).

---

## 🧪 Εκτέλεση Tests

Για να επιβεβαιώσετε ότι όλα λειτουργούν σωστά (shims, transpiler, physics engine):
```powershell
# Windows PowerShell
$env:PYTHONPATH="backend/shims;."
python -m pytest
```
