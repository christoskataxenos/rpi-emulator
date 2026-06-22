# Raspberry Pi Educational Emulator Suite

Welcome to the **Raspberry Pi Educational Emulator Suite**. This cross-platform educational tool allows students and hobbyists to visually design, wire, and program Raspberry Pi GPIO circuits using Python code entirely in simulation—no physical hardware required!

---

## 🚀 Key Features

- **Interactive 2D Canvas**: Drag-and-drop components onto the breadboard. Wire connections dynamically by clicking terminals.
- **Upgraded Component Library**:
  - **LEDs**: Single LED component supporting multi-color configuration (Red, Green, Blue, Yellow, White) via right-click.
  - **Sensors & Analog Inputs**: **DHT11** (Temperature & Humidity), **PIR** (Motion detector), **LDR** (Light Intensity), **Ultrasonic (HC-SR04)** (Distance), and **Potentiometer** (Analog voltage dial).
- **Interactive Controls (Sliders & Toggles)**: Click on any sensor or potentiometer to open a floating popover settings menu to manipulate values (e.g., temperature, light, motion) in real-time.
- **Universal Project Save & Load**: Save your entire workspace (Python code editor + breadboard wiring) as a single `.rpi` project file and load it back anytime.
- **Python GPIO & Sensor Shims**: Mocked libraries intercepting standard GPIO and sensor calls:
  - `import RPi.GPIO as GPIO`
  - `from gpiozero import LED, Button, MotionSensor, LightSensor, DistanceSensor, Potentiometer`
  - `import dht` (for DHT11 measurements)
- **Real-Time Physics Engine**: Models Ohm's Law and flags short circuits or overcurrent LED connections.
- **Integrated Code Editor**: Modern code editor with autocompletions/IntelliSense for GPIO shims.

---

## 🛠️ Quick-Start Instructions

### 1. Installation

Install dependencies for your system:
```bash
# Install backend requirements
pip install -r backend/requirements.txt

# Install desktop PyQt6 requirements (if running in desktop mode)
pip install -r desktop/requirements.txt
```

### 2. Run the App

#### Option A: Web App Mode (Runs in Browser)
Start the FastAPI server:
```bash
uvicorn backend.main:app --reload --port 8000
```
Then navigate to: [http://localhost:8000](http://localhost:8000)

#### Option B: Desktop App Mode (Native PyQt6 WebView)
Run the desktop wrapper launcher:
```bash
python desktop/main.py
```

### 3. Run the Tests
Verify the installation by running unit and integration tests (make sure to set the `PYTHONPATH` so python discovers the shims):
```powershell
# Windows PowerShell
$env:PYTHONPATH="backend/shims;."
python -m pytest
```
```bash
# Linux/macOS
PYTHONPATH="backend/shims:." pytest
```
