from fastapi.testclient import TestClient
from backend.main import app, circuit_manager

# Δημιουργία του client δοκιμών για το FastAPI
client: TestClient = TestClient(app)


def test_load_circuit_success() -> None:
    # Καθαρισμός του κυκλώματος πριν τη δοκιμή
    circuit_manager.clear_circuit()
    
    # Ορισμός του σώματος του αιτήματος για επιτυχή φόρτωση κυκλώματος
    payload: dict = {
        "components": [
            {
                "id": "LED1",
                "type": "LED",
                "properties": {"color": "red"}
            },
            {
                "id": "R1",
                "type": "RESISTOR",
                "properties": {"resistance": 330}
            }
        ],
        "wires": [
            {
                "from_component": "RPI",
                "from_terminal": "pin11",
                "to_component": "LED1",
                "to_terminal": "anode",
                "color": "#ff0000"
            },
            {
                "from_component": "LED1",
                "from_terminal": "cathode",
                "to_component": "R1",
                "to_terminal": "terminal_a",
                "color": "#ff0000"
            },
            {
                "from_component": "R1",
                "from_terminal": "terminal_b",
                "to_component": "RPI",
                "to_terminal": "pin6",
                "color": "#000000"
            }
        ]
    }
    
    # Εκτέλεση της κλήσης POST
    response = client.post("/api/circuit/load", json = payload)
    
    # Επιβεβαίωση ότι η κλήση ήταν επιτυχής
    assert response.status_code == 200
    
    data: dict = response.json()
    assert data["status"] == "success"
    # 3 εξαρτήματα (RPI + LED1 + R1)
    assert len(data["circuit"]["components"]) == 3
    assert len(data["circuit"]["wires"]) == 3
    
    # Επιβεβαίωση ότι τα στοιχεία ενημερώθηκαν στον circuit_manager
    assert "LED1" in circuit_manager.components
    assert "R1" in circuit_manager.components
    assert len(circuit_manager.wires) == 3


def test_load_circuit_duplicate_component_error() -> None:
    # Καθαρισμός του κυκλώματος
    circuit_manager.clear_circuit()
    
    # Δοκιμή με διπλό component ID, το οποίο πρέπει να προκαλέσει σφάλμα (edge case)
    payload_duplicate: dict = {
        "components": [
            {
                "id": "LED1",
                "type": "LED",
                "properties": {}
            },
            {
                "id": "LED1",
                "type": "LED",
                "properties": {}
            }
        ],
        "wires": []
    }
    
    # Εκτέλεση κλήσης POST
    response = client.post("/api/circuit/load", json = payload_duplicate)
    
    # Επιβεβαίωση σφάλματος HTTP 400 Bad Request
    assert response.status_code == 400
    assert "Αποτυχία προσθήκης εξαρτήματος" in response.json()["detail"]
