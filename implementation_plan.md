# RPi-Emulator: Raspberry Pi Educational Emulator Suite

## Overview

A cross-platform educational tool that lets students visually wire up a Raspberry Pi,
program its GPIO pins in Python, and see the hardware respond in real-time — all without
any physical hardware. Built for students, hobbyists, and university courses. 
Target timeline: **6–12 months** to full platform, with a working MVP in **~2 months**.

---

## User Review Required

> [!IMPORTANT]
> **Backend Framework**: Use **FastAPI only** — it handles WebSockets natively (needed for real-time GPIO event streaming), is async-first, and is lighter.
> - **Phase 3–4**: If we add teacher dashboards + accounts, we can add SQLAlchemy + auth to FastAPI.

> [!IMPORTANT]
> **Desktop App Wrapper**: We will use PyQt6/PySide6 for the desktop app wrapper to match the Python-centric architecture.

---

## Open Questions

> [!NOTE]
> - **Project Name**: `rpi-emulator`
> - **License**: TBD (likely MIT or GPL-3.0)
> - **Teacher Dashboard**: LAN-based local server dashboard in Phase 3.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                     RPi-Emulator Suite                                 │
│                                                                        │
│  ┌──────────────────┐    ┌──────────────────┐    ┌────────────────┐   │
│  │  Frontend (Web)  │    │  Desktop Wrapper │    │  VS Code Ext.  │   │
│  │  HTML/CSS/JS     │    │  PyQt6 WebView   │    │  (Phase 3)     │   │
│  │  2D Breadboard   │◄───│  (wraps webapp)  │    │                │   │
│  │  Circuit Editor  │    └──────────────────┘    └────────────────┘   │
│  └────────┬─────────┘                                                  │
│           │ WebSocket + REST API                                        │
│  ┌────────▼─────────────────────────────────────────────────────────┐  │
│  │                  FastAPI Backend (Python)                         │  │
│  │  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │  │
│  │  │  GPIO       │  │  Code Execution  │  │  Electronics        │ │  │
│  │  │  Simulator  │  │  Engine          │  │  Physics Engine     │ │  │
│  │  │  (State Mgr)│  │  (Python sandbox)│  │  (Ohm's Law, V/I)  │ │  │
│  │  └─────────────┘  └──────────────────┘  └─────────────────────┘ │  │
│  │  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │  │
│  │  │  RPi.GPIO   │  │  gpiozero        │  │  Circuit Graph      │ │  │
│  │  │  Shim/Stub  │  │  Shim/Stub       │  │  Engine             │ │  │
│  │  └─────────────┘  └──────────────────┘  └─────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│           │ (Phase 2 only)                                              │
│  ┌────────▼─────────┐                                                  │
│  │  QEMU Bridge     │  ← Full RPi OS emulation (Phase 2 stretch goal)  │
│  │  (optional mode) │                                                   │
│  └──────────────────┘                                                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Proposed Changes / Implementation Phases

### Phase 1 — Core MVP (Month 1–2)
*Goal: A working app where a student can place an LED on a breadboard, write Python code, and see it blink.*

---

#### Project Structure
```
rpi-emulator/
├── backend/                  # FastAPI Python backend
│   ├── main.py               # FastAPI app entry point
│   ├── api/
│   │   ├── gpio.py           # GPIO state REST endpoints
│   │   ├── execution.py      # Code execution endpoints
│   │   └── websocket.py      # WebSocket event streaming
│   ├── simulator/
│   │   ├── gpio_state.py     # GPIO pin state machine (HIGH/LOW/PWM)
│   │   ├── circuit.py        # Circuit graph (nodes = components, edges = wires)
│   │   ├── physics.py        # Electronics: Ohm's law, voltage dividers, short circuit detection
│   │   └── components/       # Component models (LED, button, resistor, etc.)
│   │       ├── base.py
│   │       ├── led.py
│   │       ├── button.py
│   │       ├── resistor.py
│   │       └── buzzer.py
│   ├── shims/
│   │   ├── RPi/              # RPi.GPIO shim — intercepted GPIO calls routed to simulator
│   │   │   └── GPIO.py
│   │   └── gpiozero/         # gpiozero shim — routes to simulator
│   │       └── __init__.py
│   ├── sandbox/
│   │   └── executor.py       # Sandboxed Python code runner (subprocess isolation)
│   └── requirements.txt
│
├── frontend/                 # Web frontend
│   ├── index.html
│   ├── css/
│   │   └── main.css
│   ├── js/
│   │   ├── app.js            # Main app controller
│   │   ├── breadboard.js     # 2D breadboard canvas (HTML5 Canvas or SVG)
│   │   ├── components.js     # Draggable component library panel
│   │   ├── wiring.js         # Wire drawing / connection logic
│   │   ├── editor.js         # Monaco code editor integration
│   │   ├── console.js        # Output console
│   │   └── websocket.js      # Real-time GPIO event listener
│   └── assets/
│       ├── components/       # SVG icons for components (LED, button, etc.)
│       └── boards/           # RPi board SVG images (Pi4, Pi3B+, Zero W, Pico)
│
├── desktop/                  # PyQt6 desktop wrapper
│   ├── main.py               # PyQt6 app, embeds WebView pointing to backend
│   └── requirements.txt
│
├── scenarios/                # Pre-built educational scenarios
│   ├── 01_blink_led/
│   │   ├── circuit.json      # Circuit layout (components + wires)
│   │   ├── starter.py        # Starter Python code
│   │   └── README.md         # Step-by-step tutorial text
│   └── 02_button_input/
│       ├── circuit.json
│       ├── starter.py
│       └── README.md
│
├── docs/                     # Documentation
└── README.md
```

---

#### `backend/simulator/gpio_state.py`
- Maintains a dictionary of all 40 GPIO pins for each RPi model
- Tracks: `mode` (INPUT/OUTPUT/PWM), `state` (HIGH/LOW), `pull` (UP/DOWN/NONE), `pwm_duty_cycle`
- Broadcasts pin state changes via WebSocket to the frontend

#### `backend/simulator/circuit.py`
- Circuit graph: components as nodes, wires as edges
- Validates connections: detects unconnected pins, missing resistors, short circuits
- Feeds into physics engine for voltage/current calculations

#### `backend/simulator/physics.py`
- **Ohm's Law engine**: calculates voltage across each component, current through each branch
- **Warning system**: LED without resistor (→ overvoltage warning), short circuit detection
- **Component ratings**: each component has max voltage/current; warnings shown in UI if exceeded

#### `backend/shims/RPi/GPIO.py`
- A **drop-in replacement** for the real `RPi.GPIO` library
- Student code does `import RPi.GPIO as GPIO` — this intercept version routes all calls to the FastAPI backend GPIO state engine
- Supports: `setup()`, `output()`, `input()`, `PWM()`, `add_event_detect()`, `cleanup()`

#### `backend/shims/gpiozero/__init__.py`
- Drop-in replacement for `gpiozero`
- Supports: `LED`, `Button`, `Buzzer`, `PWMLED`, `MotionSensor` (Phase 1 basics)
- Internally calls GPIO shim

#### `backend/sandbox/executor.py`
- Runs student Python code in a **subprocess** with:
  - Injected `PYTHONPATH` pointing to the shims folder
  - `stdout`/`stderr` captured and streamed back via WebSocket
  - **Timeout**: kills process after N seconds (configurable)
  - **Resource limits**: no network access, limited file system access (using subprocess + environment control)

#### `frontend/js/breadboard.js`
- 2D flat breadboard rendered on HTML5 Canvas (or SVG)
- Accurate breadboard hole grid with bus rails (power/ground)
- Drag-and-drop component placement from the component palette
- Wire drawing: click a pin → click another → wire is drawn
- Color-coded wires (user can change color)
- Visual feedback: LED glows when GPIO pin is HIGH, button highlights on click

#### `frontend/js/editor.js`
- Embeds **Monaco Editor** (VS Code's editor engine) in the browser
- Pre-configured with Python syntax highlighting + autocompletion for RPi.GPIO and gpiozero
- Run button → sends code to backend `/execute` endpoint
- Stop button → kills the running sandbox process
- Output panel shows `stdout`, `stderr`, and GPIO event log

#### `scenarios/01_blink_led/`
- **Tutorial 1: Blink an LED** — the classic "Hello World" of electronics
  - Pre-wired circuit (LED + 330Ω resistor between GPIO17 and GND)
  - Starter Python code with blanks for students to fill in
  - Step-by-step instructions panel

---

### Phase 2 — Components & Physics Expansion (Month 3–4)

- Add more components: DHT11 sensor, 7-segment display, servo motor, relay, I2C LCD
- Expand physics engine: current through parallel/series circuits, capacitor/inductor basics
- Logic Analyzer view: show signal timing for PWM, I2C clock/data, SPI
- **Optional QEMU bridge**: spike/research full Raspberry Pi OS boot mode
- Import Python scripts from file
- Export circuit as PNG/PDF (for lab reports)
- Add 5 more guided scenarios (button input, PWM dimming, sensor reading, servo control, relay)

---

### Phase 3 — Platform & Collaboration (Month 5–7)

- **Teacher/Server Mode**: FastAPI backend becomes a local LAN server
  - Teacher runs `rpi-emulator --server` on their machine
  - Students connect via browser: `http://teacher-laptop:8000`
  - Teacher dashboard: see all connected students, their active circuits, code execution logs
  - Assign scenarios to students, view submission history
- **Student accounts**: simple username/password stored locally on the teacher's server (SQLite + SQLAlchemy)
- **Scenario library**: teachers can create and share custom lab scenarios as `.rpiscenario` zip files
- Import Fritzing `.fzz` circuit files

---

### Phase 4 — Power Features (Month 8–12)

- **VS Code Extension**: connects to local FastAPI backend, shows GPIO state panel in VS Code sidebar
- **RPi Model Selector**: switch between Pi 4, Pi 3B+, Pi Zero W, Pi Pico (RP2040) — each with correct pinout
- **Scratch/Block Editor**: visual programming (Blockly) that generates Python for beginners
- **Cloud sync** (optional): save projects to a personal cloud account
- **QEMU Full Mode**: boot actual Raspberry Pi OS Lite in the background, route GPIO calls through a kernel bridge
- **Plugin system**: community can add new component simulations

---

## Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend | **FastAPI** (Python 3.11+) | Async, WebSocket support, fast |
| GPIO Simulation | Custom Python state machine | Intercepts RPi.GPIO + gpiozero calls |
| Electronics Physics | Custom Python (numpy) | Ohm's law, circuit graph analysis |
| Code Sandbox | `subprocess` + env isolation | Run student code safely |
| Frontend | **Vanilla HTML/CSS/JavaScript** | No framework overhead, works in any browser |
| Code Editor | **Monaco Editor** (CDN) | VS Code's engine, Python support |
| Breadboard UI | **HTML5 Canvas** or **SVG** | 2D drag-and-drop circuit editor |
| Desktop Wrapper | **PyQt6** (Phase 1), **Tauri** (long-term) | Python-native now, performance later |
| VS Code Extension | TypeScript | Standard extension API |
| Database (Phase 3) | **SQLite** + SQLAlchemy | Lightweight, local-first teacher server |
| Package/Dist | **PyInstaller** or **uv** | Bundle Python app for distribution |

---

## Key Technical Decisions

### GPIO Interception Strategy
Student code runs like this:
```python
import RPi.GPIO as GPIO          # ← our shim, not real library
GPIO.setmode(GPIO.BCM)
GPIO.setup(17, GPIO.OUT)
GPIO.output(17, GPIO.HIGH)       # ← this sends a WebSocket message to frontend
                                 #    frontend turns the LED on in the breadboard
```
The shim uses `requests` or `httpx` to call the FastAPI backend synchronously. The backend updates GPIO state and broadcasts to all connected WebSocket clients (the frontend).

### Event-Driven Hardware Interaction
When a student clicks a button component in the breadboard:
1. Frontend sends a WebSocket message: `{"event": "gpio_input", "pin": 18, "state": "HIGH"}`
2. Backend updates GPIO state for pin 18
3. If student code has `GPIO.add_event_detect(18, GPIO.RISING, callback=my_function)`, the running subprocess is notified via a shared Queue/pipe
4. The callback fires, student code runs the handler

### Circuit Physics (Simplified)
- Circuit represented as a **weighted graph**: nodes = junctions, edges = components (resistors, LEDs, wires)
- **Modified Nodal Analysis (MNA)**: standard electrical engineering technique to solve for voltages/currents
- Simplified for education: treat RPi GPIO as ideal voltage sources (3.3V)
- LED model: forward voltage drop (2V typical), max current 20mA
- Warning thresholds configurable per component

---

## Verification Plan

### Phase 1 MVP Validation
1. **Unit tests** (`pytest`): GPIO shim correctly intercepts all RPi.GPIO calls
2. **Integration test**: Run a `blink.py` script → verify GPIO state toggles at correct timing
3. **Frontend test**: Drag LED to breadboard → connect pins → run blink code → LED animates
4. **Physics test**: LED without resistor → warning banner appears
5. **Cross-platform**: Run on Windows 11, Ubuntu 22.04, macOS 14 and verify behavior

### Manual Verification
- Student workflow: open app → choose "Blink LED" scenario → read tutorial → run code → see LED blink → modify delay → observe change
- Instructor workflow: open app → create blank circuit → drag components → wire manually → write own code → run → export circuit image
