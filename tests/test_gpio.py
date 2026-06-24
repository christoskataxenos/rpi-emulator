import pytest
from backend.simulator.gpio_state import GPIORegistry, GPIOPin, LogicState
from backend.simulator.circuit import CircuitManager
from backend.simulator.physics import PhysicsEngine

# 1. Επιτυχές Unit Test (Passing Test)
def test_gpio_registry_set_get():
    registry = GPIORegistry()
    pin_number = 17
    
    assert registry.pins[pin_number].mode == "INPUT"
    assert registry.get_pin_state(pin_number) == LogicState.HIGH_Z
    
    registry.set_pin_mode(pin_number, "OUTPUT")
    assert registry.pins[pin_number].mode == "OUTPUT"
    
    registry.set_pin_state(pin_number, LogicState.HIGH)
    assert registry.get_pin_state(pin_number) == LogicState.HIGH
    
    registry.set_pin_state(pin_number, LogicState.LOW)
    assert registry.get_pin_state(pin_number) == LogicState.LOW

# 2. Οριακό Σφάλμα
def test_gpio_invalid_pin_edge_case():
    registry = GPIORegistry()
    invalid_pin = 99
    
    state = registry.get_pin_state(invalid_pin)
    assert state == LogicState.HIGH_Z
    try:
        registry.set_pin_state(invalid_pin, LogicState.HIGH)
        registry.set_pin_mode(invalid_pin, "OUTPUT")
    except KeyError:
        pytest.fail("Η εφαρμογή κατέρρευσε με KeyError για μη έγκυρο pin!")

def test_gpio_integer_state_conversion():
    registry = GPIORegistry()
    pin = 17
    
    # Check that setting an integer value 1 converts it to LogicState.HIGH
    registry.set_pin_state(pin, 1)
    assert registry.get_pin_state(pin) == LogicState.HIGH
    assert registry.get_pin_state(pin) == 1
    
    # Check that setting a boolean True converts it to LogicState.HIGH
    registry.set_pin_state(pin, True)
    assert registry.get_pin_state(pin) == LogicState.HIGH
    assert registry.get_pin_state(pin) is LogicState.HIGH
    
    # Check that setting an integer value 0 converts it to LogicState.LOW
    registry.set_pin_state(pin, 0)
    assert registry.get_pin_state(pin) == LogicState.LOW
    assert registry.get_pin_state(pin) == 0

# 3. Δοκιμή 4-State Logic (Logisim propagation)
def test_physics_engine_short_circuit():
    circuit = CircuitManager()
    physics = PhysicsEngine(registry=GPIORegistry())
    
    # Βραχυκύκλωμα: 5V (pin 2) κατευθείαν σε GND (pin 6)
    circuit.add_wire("RPI", "pin2", "RPI", "pin6")
    
    res = physics.solve_circuit(circuit)
    
    # Πρέπει να υπάρχει προειδοποίηση για SHORT_CIRCUIT
    warnings = res["warnings"]
    assert len(warnings) > 0
    assert any(w["type"] == "SHORT_CIRCUIT" for w in warnings)

def test_physics_engine_led():
    circuit = CircuitManager()
    physics = PhysicsEngine(registry=GPIORegistry())
    
    # Προσθήκη LED
    circuit.add_component("LED1", "LED")
    
    # Σύνδεση LED: Anode -> 5V (pin 2), Cathode -> GND (pin 6)
    circuit.add_wire("RPI", "pin2", "LED1", "anode")
    circuit.add_wire("RPI", "pin6", "LED1", "cathode")
    
    res = physics.solve_circuit(circuit)
    
    # Το LED πρέπει να είναι lit
    states = res["component_states"]
    assert states["LED1"] == "lit"

def test_physics_engine_high_to_low_transition_no_short_circuit():
    circuit = CircuitManager()
    registry = GPIORegistry()
    physics = PhysicsEngine(registry)
    
    # Setup LED and Resistor circuit
    circuit.add_component("LED1", "LED")
    circuit.add_component("R1", "RESISTOR")
    circuit.add_wire("RPI", "pin11", "R1", "terminal_a")
    circuit.add_wire("R1", "terminal_b", "LED1", "anode")
    circuit.add_wire("LED1", "cathode", "RPI", "pin6")
    
    registry.set_pin_mode(11, "OUTPUT")
    
    # 1. Transition to HIGH
    registry.set_pin_state(11, LogicState.HIGH)
    res = physics.solve_circuit(circuit)
    assert len(res["warnings"]) == 0
    assert res["component_states"]["LED1"] == "lit"
    
    # 2. Transition to LOW
    registry.set_pin_state(11, LogicState.LOW)
    res = physics.solve_circuit(circuit)
    assert len(res["warnings"]) == 0
    assert res["component_states"]["LED1"] == "off"


# 4. Έλεγχος της νέας REST API κλήσης μαζικής φόρτωσης κυκλώματος
def test_api_load_circuit():
    from fastapi.testclient import TestClient
    from backend.main import app
    
    client = TestClient(app)
    
    # Δεδομένα κυκλώματος για δοκιμή
    payload = {
        "components": [
            {"id": "LED1", "type": "LED", "properties": {"color": "red", "x": 450, "y": 180}},
            {"id": "R1", "type": "RESISTOR", "properties": {"resistance": 330, "x": 550, "y": 180}}
        ],
        "wires": [
            {"from_component": "RPI", "from_terminal": "pin11", "to_component": "R1", "to_terminal": "terminal_a", "color": "orange"},
            {"from_component": "R1", "from_terminal": "terminal_b", "to_component": "LED1", "to_terminal": "anode", "color": "red"},
            {"from_component": "LED1", "from_terminal": "cathode", "to_component": "RPI", "to_terminal": "pin6", "color": "black"}
        ]
    }
    
    response = client.post("/api/circuit/load", json = payload)
    assert response.status_code == 200
    
    res_data = response.json()
    assert res_data["status"] == "success"
    
    # Επιβεβαίωση ότι τα εξαρτήματα προστέθηκαν σωστά
    components = res_data["circuit"]["components"]
    assert any(c["id"] == "LED1" for c in components)
    assert any(c["id"] == "R1" for c in components)

