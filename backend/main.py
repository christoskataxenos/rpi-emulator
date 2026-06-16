# Εισαγωγή των απαραίτητων πακέτων για το FastAPI και την ασύγχρονη λειτουργία
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import asyncio
import json
import os
from typing import List, Dict, Set

# Εισαγωγή των κλάσεων του εξομοιωτή μας
from backend.simulator.gpio_state import GPIORegistry
from backend.simulator.circuit import CircuitManager
from backend.simulator.physics import PhysicsEngine
from backend.sandbox.executor import CodeExecutor

# Δημιουργία της εφαρμογής FastAPI
app = FastAPI(title = "Raspberry Pi Educational Simulator API")

# Ρύθμιση CORS ώστε το frontend να μπορεί να καλεί το API
app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"],
)

# Αρχικοποίηση των βασικών στοιχείων του συστήματος
gpio_registry = GPIORegistry()
circuit_manager = CircuitManager()
physics_engine = PhysicsEngine(gpio_registry)

# Η διαδρομή για τα shims είναι στο ίδιο επίπεδο με το backend
shims_directory = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shims")
code_executor = CodeExecutor(shims_directory)

# Λίστα με τους ενεργούς συνδεδεμένους WebSocket πελάτες (frontends)
active_sockets: List[WebSocket] = []

# Ουρά συμβάντων για την αποστολή αλλαγών εισόδου στα shims (SSE)
# Χρησιμοποιούμε asyncio.Queue για ασύγχρονη επικοινωνία
gpio_event_queue = asyncio.Queue()


# Μοντέλα Pydantic για την επικύρωση των δεδομένων εισόδου στις REST κλήσεις
class PinSetupModel(BaseModel):
    pin_number: int
    mode: str
    pull: str = "PUD_OFF"


class PinOutputModel(BaseModel):
    pin_number: int
    state: int


class PinPWMModel(BaseModel):
    pin_number: int
    is_pwm: bool
    duty_cycle: float
    frequency: float


class ComponentModel(BaseModel):
    id: str
    type: str
    properties: dict = {}


class WireModel(BaseModel):
    from_component: str
    from_terminal: str
    to_component: str
    to_terminal: str
    color: str = "#ff0000"


class WireDeleteModel(BaseModel):
    from_component: str
    from_terminal: str
    to_component: str
    to_terminal: str


class CodeRunModel(BaseModel):
    code: str


# Βοηθητική συνάρτηση για την αποστολή μηνύματος σε όλα τα συνδεδεμένα WebSockets
async def broadcast_message(message: dict):
    # Δημιουργία αντιγράφου της λίστας για αποφυγή σφαλμάτων κατά τη διαγραφή
    for socket in list(active_sockets):
        try:
            await socket.send_json(message)
        except Exception:
            active_sockets.remove(socket)


# REST Endpoint: Ρύθμιση της λειτουργίας ενός GPIO pin (Setup)
@app.post("/api/gpio/setup")
async def setup_pin(data: PinSetupModel):
    print(f"[DEBUG setup] pin={data.pin_number}, mode='{data.mode}', pull='{data.pull}'")
    gpio_registry.set_pin_mode(data.pin_number, data.mode)
    gpio_registry.set_pin_pull(data.pin_number, data.pull)
    
    # Ενημέρωση του frontend για την αλλαγή ρυθμίσεων
    await broadcast_message({
        "type": "gpio_setup",
        "pin_number": data.pin_number,
        "mode": data.mode,
        "pull": data.pull
    })
    return {"status": "success"}


# REST Endpoint: Ορισμός της τιμής εξόδου ενός pin (Output)
@app.post("/api/gpio/output")
async def output_pin(data: PinOutputModel):
    gpio_registry.set_pin_state(data.pin_number, data.state)
    
    # Ενημέρωση του frontend για τη νέα κατάσταση του pin
    await broadcast_message({
        "type": "gpio_state_change",
        "pin_number": data.pin_number,
        "state": data.state
    })
    
    # Επίλυση του κυκλώματος μετά από κάθε αλλαγή κατάστασης pin
    solve_results = physics_engine.solve_circuit(circuit_manager)
    pin_state_obj = gpio_registry.pins.get(data.pin_number)
    print(f"[DEBUG output] pin={data.pin_number}, state={data.state}, mode='{pin_state_obj.mode if pin_state_obj else 'UNKNOWN'}', solve={solve_results}")
    await broadcast_message({
        "type": "circuit_solved",
        "data": solve_results
    })
    
    return {"status": "success"}


# REST Endpoint: Ανάγνωση της τιμής ενός pin (Input)
@app.get("/api/gpio/input/{pin_number}")
async def input_pin(pin_number: int):
    # Επίλυση του κυκλώματος για να βεβαιωθούμε ότι έχουμε την πιο πρόσφατη τιμή
    physics_engine.solve_circuit(circuit_manager)
    state = gpio_registry.get_pin_state(pin_number)
    return {"pin_number": pin_number, "state": state}


# REST Endpoint: Ρύθμιση PWM σε pin
@app.post("/api/gpio/pwm")
async def pwm_pin(data: PinPWMModel):
    gpio_registry.set_pin_pwm(data.pin_number, data.is_pwm, data.duty_cycle, data.frequency)
    await broadcast_message({
        "type": "gpio_pwm",
        "pin_number": data.pin_number,
        "is_pwm": data.is_pwm,
        "duty_cycle": data.duty_cycle,
        "frequency": data.frequency
    })
    return {"status": "success"}


# REST Endpoint: Επαναφορά όλων των pins στην αρχική κατάσταση
@app.post("/api/gpio/cleanup")
async def cleanup_pins():
    global gpio_registry
    gpio_registry = GPIORegistry()
    await broadcast_message({"type": "gpio_cleanup"})
    return {"status": "success"}


# REST Endpoints: Διαχείριση κυκλώματος (Components)
@app.post("/api/circuit/component")
async def add_component(data: ComponentModel):
    success = circuit_manager.add_component(data.id, data.type, data.properties)
    if not success:
        raise HTTPException(status_code = 400, detail = "Το εξάρτημα υπάρχει ήδη.")
    
    solve_results = physics_engine.solve_circuit(circuit_manager)
    await broadcast_message({
        "type": "circuit_change",
        "circuit": circuit_manager.get_circuit_data(),
        "solve_results": solve_results
    })
    return {"status": "success"}


@app.delete("/api/circuit/component/{comp_id}")
async def remove_component(comp_id: str):
    success = circuit_manager.remove_component(comp_id)
    if not success:
        raise HTTPException(status_code = 404, detail = "Το εξάρτημα δεν βρέθηκε.")
        
    solve_results = physics_engine.solve_circuit(circuit_manager)
    await broadcast_message({
        "type": "circuit_change",
        "circuit": circuit_manager.get_circuit_data(),
        "solve_results": solve_results
    })
    return {"status": "success"}


# REST Endpoints: Διαχείριση κυκλώματος (Wires)
@app.post("/api/circuit/wire")
async def add_wire(data: WireModel):
    success = circuit_manager.add_wire(
        data.from_component, data.from_terminal,
        data.to_component, data.to_terminal, data.color
    )
    if not success:
        raise HTTPException(status_code = 400, detail = "Αποτυχία σύνδεσης καλωδίου.")
        
    solve_results = physics_engine.solve_circuit(circuit_manager)
    await broadcast_message({
        "type": "circuit_change",
        "circuit": circuit_manager.get_circuit_data(),
        "solve_results": solve_results
    })
    return {"status": "success"}


@app.post("/api/circuit/wire/delete")
async def delete_wire(data: WireDeleteModel):
    success = circuit_manager.remove_wire(
        data.from_component, data.from_terminal,
        data.to_component, data.to_terminal
    )
    if not success:
        raise HTTPException(status_code = 404, detail = "Το καλώδιο δεν βρέθηκε.")
        
    solve_results = physics_engine.solve_circuit(circuit_manager)
    await broadcast_message({
        "type": "circuit_change",
        "circuit": circuit_manager.get_circuit_data(),
        "solve_results": solve_results
    })
    return {"status": "success"}


@app.post("/api/circuit/clear")
async def clear_circuit():
    circuit_manager.clear_circuit()
    await broadcast_message({
        "type": "circuit_change",
        "circuit": circuit_manager.get_circuit_data(),
        "solve_results": {"component_states": {}, "warnings": []}
    })
    return {"status": "success"}


@app.get("/api/circuit")
async def get_circuit():
    return circuit_manager.get_circuit_data()


# REST Endpoint: Εκτέλεση κώδικα Python
@app.post("/api/execute")
async def execute_code(data: CodeRunModel):
    # Λήψη του τρέχοντος event loop από το κύριο thread
    loop = asyncio.get_running_loop()

    # Callback για την προώθηση των logs εκτύπωσης (print) στο frontend
    def handle_output(stream_type: str, line: str):
        # Δημιουργούμε async loop task χρησιμοποιώντας το loop του κυρίου thread
        asyncio.run_coroutine_threadsafe(
            broadcast_message({
                "type": "console_log",
                "stream": stream_type,
                "text": line
            }),
            loop
        )

    # Callback όταν η διεργασία τερματίσει
    def handle_exit(session_id: str, exit_code: int):
        # Δημιουργούμε async loop task χρησιμοποιώντας το loop του κυρίου thread
        asyncio.run_coroutine_threadsafe(
            broadcast_message({
                "type": "execution_finished",
                "session_id": session_id,
                "exit_code": exit_code
            }),
            loop
        )

    session_id = code_executor.run_code(data.code, handle_output, handle_exit)
    return {"session_id": session_id}


# REST Endpoint: Διακοπή εκτέλεσης κώδικα Python
@app.post("/api/execute/stop/{session_id}")
async def stop_code(session_id: str):
    success = code_executor.stop_code(session_id)
    return {"status": "success" if success else "error"}


# SSE Endpoint: Ροή συμβάντων για το shim (Server-Sent Events)
# Όταν πατηθεί ένα κουμπί στο frontend, στέλνεται event εδώ και το RPi.GPIO shim το διαβάζει
@app.get("/api/gpio/stream")
async def stream_gpio_events():
    async def event_generator():
        while True:
            # Αναμονή για νέο event από την ουρά
            event = await gpio_event_queue.get()
            yield f"data: {json.dumps(event)}\n\n"
            gpio_event_queue.task_done()

    return StreamingResponse(event_generator(), media_type = "text/event-stream")


# REST Endpoint: Προσομοίωση συμβάντος εισόδου από το UI (π.χ. πάτημα κουμπιού)
@app.post("/api/simulator/input")
async def simulate_input(data: dict):
    # Παράδειγμα body: {"pin": 18, "pressed": True}
    pin = data.get("pin")
    pressed = data.get("pressed", False)
    
    # Εύρεση του κουμπιού στο κύκλωμα και ενημέρωση των properties του
    for comp in circuit_manager.components.values():
        if comp.type == "BUTTON":
            # Έλεγχος αν συνδέεται με αυτό το pin (μέσω καλωδίων)
            # Για απλότητα, ενημερώνουμε το button property άμεσα
            if comp.id == data.get("component_id"):
                comp.properties["pressed"] = pressed
                
    # Επίλυση κυκλώματος για ενημέρωση των τάσεων και των GPIO inputs
    solve_results = physics_engine.solve_circuit(circuit_manager)
    
    # Ενημέρωση των WebSocket clients για τις νέες καταστάσεις εξαρτημάτων
    await broadcast_message({
        "type": "circuit_solved",
        "data": solve_results
    })
    
    # Αν αλλάξει η κατάσταση ενός GPIO input, στέλνουμε το event στο shim
    for pin_num, pin_state in gpio_registry.pins.items():
        if pin_state.mode == "INPUT":
            await gpio_event_queue.put({
                "pin": pin_num,
                "state": pin_state.state
            })
            
    return {"status": "success", "solve_results": solve_results}


# WebSocket Endpoint: Σύνδεση με το Web UI
@app.websocket("/api/websocket")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_sockets.append(websocket)
    try:
        # Στέλνουμε την τρέχουσα κατάσταση κατά τη σύνδεση
        await websocket.send_json({
            "type": "init",
            "pins": gpio_registry.get_all_states(),
            "circuit": circuit_manager.get_circuit_data()
        })
        
        while True:
            # Απλώς κρατάμε τη σύνδεση ανοιχτή και ακούμε για τυχόν μηνύματα (αν χρειαστεί)
            data = await websocket.receive_text()
            # Μπορούμε να προσθέσουμε διαχείριση μηνυμάτων από το UI αν χρειαστεί
            
    except WebSocketDisconnect:
        active_sockets.remove(websocket)
    except Exception:
        if websocket in active_sockets:
            active_sockets.remove(websocket)

# Προσάρτηση των στατικών αρχείων για τα σενάρια/μαθήματα
scenarios_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scenarios")
app.mount("/scenarios", StaticFiles(directory = scenarios_dir), name = "scenarios")

# Προσάρτηση των στατικών αρχείων του frontend για την εξυπηρέτηση του web UI
frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")
app.mount("/", StaticFiles(directory = frontend_dir, html = True), name = "static")
