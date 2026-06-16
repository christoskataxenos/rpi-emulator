# Raspberry Pi Educational Emulator Suite

Welcome to the **Raspberry Pi Educational Emulator Suite**. This cross-platform tool allows students and hobbyists to visually design, wire, and program Raspberry Pi GPIO circuits using Python code entirely in simulation.

---

## Features
- **Interactive 2D Canvas**: Drag-and-drop LEDs, resistors, buttons, and buzzers. Click terminals to wire connections.
- **Python GPIO Shims**: Intercepts `import RPi.GPIO` and `from gpiozero import ...` library calls from client code and routes them in real-time to the simulator.
- **Real-Time Physics Engine**: Models Ohm's Law and flags short circuits or overcurrent LED connections.
- **Integrated Monaco Editor**: Modern, high-performance editor with autocompletions/IntelliSense for RPi.GPIO/gpiozero.
- **Interactive GPIO Monitor**: Glowing 40-pin header grid showing live logic states (HIGH/LOW/PWM).
- **Educational Scenarios**: Loaded tutorials with pre-wired circuits and starter templates.

---

## Quick-Start Instructions

### 1. Installation
Install dependencies for your system:
```bash
# Install backend requirements
pip install -r backend/requirements.txt

# Install desktop PyQt6 requirements
pip install -r desktop/requirements.txt

# (Optional) Install pytest for running tests
pip install pytest
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
Verify the installation by running unit tests:
```bash
pytest tests/
```
