# Raspberry Pi Educational Emulator Suite

A cross-platform educational tool that allows students and hobbyists to visually design, wire, and program Raspberry Pi GPIO circuits using Python — entirely in simulation, no physical hardware required.

---

## Key Features

### Circuit Design
- **Interactive 2D Canvas** — drag-and-drop components onto the breadboard; wire connections by clicking terminals
- **Component Library**: LEDs (multi-color via right-click), Resistors (330Ω / 10kΩ), Button, Buzzer, DHT11, PIR, LDR, Ultrasonic HC-SR04, Potentiometer
- **Interactive Controls** — click any sensor or potentiometer to open a floating settings popover and adjust values (temperature, light level, distance) in real time
- **Real-Time Physics Engine** — models Ohm's Law; flags short circuits and overcurrent LED connections

### Code Editor
- **Monaco Editor** (VS Code engine) with autocompletion and IntelliSense for GPIO shims
- **Python GPIO Shims** — mocked libraries that intercept standard calls:
  - `import RPi.GPIO as GPIO`
  - `from gpiozero import LED, Button, MotionSensor, LightSensor, DistanceSensor, Potentiometer`
  - `import dht`
- **Live Console Output** — real-time stdout/stderr from executing Python code

### Tutorial Mode
- **Guided Lesson Overlay** — each scenario includes a structured guide that slides in over the circuit without hiding it
- **Three-tab layout**:
  - **Goals** — learning objectives with intro text
  - **Circuit** — numbered wiring steps with callout notes
  - **Instructions** — interactive checklist with checkboxes per step
- **Progress Bar** — tracks completed steps (N / Total) with animated fill
- **Step Interaction** — click anywhere on a step card (or the checkbox) to mark it done; completed steps show strikethrough styling

### Project Management
- **Save / Load** — export the full workspace (circuit + Python code) as a single `.rpi` project file and reload it at any time
- **Scenario System** — pre-built educational scenarios, each with a `README.md`, `starter.py`, and `circuit.json`

---

## Quick Start

### 1. Install Dependencies

```bash
# Backend requirements
pip install -r backend/requirements.txt

# Desktop (PyQt6) requirements — only needed for Option B
pip install -r desktop/requirements.txt
```

### 2. Run the App

**Option A — Web App (runs in browser)**
```bash
uvicorn backend.main:app --reload --port 8000
```
Then open: [http://localhost:8000](http://localhost:8000)

**Option B — Desktop App (native PyQt6 WebView)**
```bash
python desktop/main.py
```

### 3. Run Tests

```powershell
# Windows PowerShell
$env:PYTHONPATH="backend/shims;."
python -m pytest
```
```bash
# Linux / macOS
PYTHONPATH="backend/shims:." pytest
```

---

## Project Structure

```
rpi-emulator/
├── backend/          # FastAPI server, GPIO shims, circuit engine
├── frontend/
│   ├── index.html    # Main UI
│   ├── css/main.css  # Design system
│   └── js/
│       ├── app.js        # App controller + TutorialOverlay
│       ├── breadboard.js # Canvas rendering
│       ├── editor.js     # Monaco editor integration
│       ├── websocket.js  # Real-time GPIO state
│       └── ...
├── scenarios/        # Educational scenarios (README.md + starter.py + circuit.json)
│   ├── 01_blink_led/
│   ├── 02_button_input/
│   ├── 03_traffic_light/
│   └── ...
├── desktop/          # PyQt6 desktop wrapper
└── tests/            # Unit and integration tests
```

---

## Adding a New Scenario

Each scenario is a folder under `scenarios/` containing three files:

| File | Purpose |
|---|---|
| `README.md` | Lesson content parsed into Goals / Circuit / Instructions tabs |
| `starter.py` | Initial Python code loaded into the editor |
| `circuit.json` | Pre-wired components and connections |

The `README.md` is parsed automatically by the Tutorial Mode overlay. Use these headings to structure it:

```markdown
# Scenario Title

Intro paragraph shown in the sidebar preview.

## Στόχοι
- Learning objective one
- Learning objective two

## Το Κύκλωμα
1. First wiring step
2. Second wiring step

> [!NOTE]
> Any safety or context note shown as a callout.

## Οδηγίες
1. First interactive step (becomes a checkbox)
2. Second interactive step
```
