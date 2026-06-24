# Raspberry Pi Educational Emulator Suite

An integrated, interactive, and educational Raspberry Pi GPIO emulator, which allows students and hobbyists to design circuits, connect components (LEDs, resistors, sensors) and program them in **Python** or **C/C++** — entirely in an emulated environment, without the need for actual hardware.

---

## 🚀 Architecture & New Desktop Client (.NET WPF)

The application has been radically upgraded. The old desktop implementation with PyQt6 has been replaced by a **native desktop application in .NET WPF (C#)**, offering optimal performance on Windows, a native drag-and-drop design canvas, and automatic management (supervision) of the FastAPI backend server.

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

## ✨ Main Features

### 🖥️ Native Client (.NET WPF)
- **Visual Design Canvas**: Circuit design with drag-and-drop components. Wire creation by clicking on component terminals and RPi pins.
- **Interactive 40-Pin RPi Matrix**: A dynamic grid displaying in real-time the state (INPUT/OUTPUT/PWM), the pull-up/pull-down configuration, and the logic values (HIGH/LOW) of each pin.
- **Real-time Console Output**: Direct redirection of `stdout` and `stderr` from the running code to the console panel with color coding.
- **Automatic Process Supervision**: The WPF application checks if port `8000` is free, automatically starts the FastAPI backend (uvicorn) in the background, and terminates it safely upon closing.
- **Warning Banner**: A dynamic warning in the UI in case of a short circuit or overcurrent in LEDs, protecting the "virtual" board.

### 🔌 C/C++ Transpiler (C to Python Translator)
- **Arduino/STM32-like HAL support**: The backend integrates a smart transpiler (`backend/sandbox/transpiler.py`). If the user writes C/C++ code (e.g. with a `setup()` and `loop()`, `pinMode()`, `digitalWrite()` structure), the system automatically translates it into Python code running on top of the GPIO shims.
- **C Scenario**: A ready-to-use laboratory (`scenarios/07_dsd_blink_c`) is included with C starter code for immediate testing.

### 🔒 Secure & Stable Code Executor (Sandbox Freeze Fix)
- **Uvicorn Reload Protection**: Student code now runs in an isolated temporary system directory (`tempfile.gettempdir()`) instead of the project's working folder. This prevents the uvicorn watchdog from causing continuous backend restarts and freezes.
- **Real-time WebSockets**: The shims immediately send their states to the backend, which in turn broadcasts them via WebSockets to the WPF UI.

### 🌡️ Rich Library of Components & Sensors
- **Basic Components**: LEDs (red, green, yellow), Resistors (330Ω, 10kΩ), Push Buttons, Buzzers.
- **Sensors**: DHT11 (Temperature/Humidity), PIR (Motion Detector), LDR (Light-dependent resistor / Photoresistor), HC-SR04 (Ultrasonic).
- **Analog Potentiometer**: Allows control of analog signals.
- **Interactive UI Sliders**: Clicking on sensors opens a menu with sliders to adjust physical values (e.g. temperature, distance in cm, brightness) in real-time.

### 📚 Tutorial Mode & Project Management
- **Scenario System**: Ready educational scenarios with instructions, goals, wiring diagrams, and an interactive checklist (checkboxes) with a progress bar.
- **Save/Load (.rpi)**: Export and import of the entire workspace (circuit, wires, and code) into a single `.rpi` file for easy saving of progress.

---

## 🛠️ Project Structure

```
rpi-emulator/
├── backend/                  # FastAPI server, GPIO shims & Sandbox
│   ├── main.py               # API Endpoints (REST & WebSockets)
│   ├── sandbox/              
│   │   ├── executor.py       # Code executor (prevents uvicorn reload)
│   │   └── transpiler.py     # C to Python transpiler
│   ├── shims/                # GPIO Mocked Libraries (RPi.GPIO, gpiozero, dht)
│   └── simulator/            
│       ├── circuit.py        # Component & wiring management
│       ├── gpio_state.py     # Pin state registry
│       └── physics.py        # Physics engine & Ohm's Law
├── desktop/                  # .NET WPF Desktop App (C#)
│   ├── MainWindow.xaml       # UI Interface (Canvas, Editor, Pins Grid)
│   ├── MainWindow.xaml.cs    # Logic & Backend Connection
│   ├── CircuitComponent.cs   # Component Data Model
│   ├── GpioPin.cs            # GPIO Pins Data Model
│   └── VisualWire.cs         # Wire Data Model
├── frontend/                 # Web Client Frontend (HTML/CSS/JS - Option A)
├── scenarios/                # Educational scenarios (starter.py, circuit.json, README.md)
└── tests/                    # Unit and integration tests
```

---

## 🚀 Installation & Running Instructions

### Prerequisites
1. **Python 3.10+** (added to PATH) — [Download Python](https://www.python.org/downloads/)
2. **.NET Runtime / SDK** (.NET 8.0+ to run the WPF application) — [Download .NET](https://dotnet.microsoft.com/download)

### 1. Install Backend Dependencies
Open a terminal and install the Python packages:
```bash
pip install -r backend/requirements.txt
```

### 2. Run the Desktop Application (WPF)
- **Via Visual Studio / dotnet CLI**:
  Navigate to the `desktop` directory and run:
  ```bash
  dotnet run --project desktop/RpiEmulatorDesktop.csproj
  ```
  *(The WPF application will automatically detect if the backend is not running and start it on port 8000).*

### 3. Alternative Execution (Web Client in Browser)
If you want to use the browser version:
1. Start the backend manually:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```
2. Open the `frontend/index.html` file in your browser or visit [http://localhost:8000](http://localhost:8000).

---

## 🧪 Running Tests

To verify that everything works correctly (shims, transpiler, physics engine):
```powershell
# Windows PowerShell
$env:PYTHONPATH="backend/shims;."
python -m pytest
```
