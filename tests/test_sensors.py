import pytest
from fastapi.testclient import TestClient
from backend.main import app, circuit_manager
import backend.shims.dht as dht
import backend.shims.gpiozero as gpiozero
import RPi.GPIO as GPIO

# Ρύθμιση της διεύθυνσης BACKEND_URL για τα shims κατά τη διάρκεια των δοκιμών
GPIO.BACKEND_URL = "http://testserver"


# 1. Επιτυχές Unit Test για τους αισθητήρες (Passing Test)
def test_sensors_and_shims_success():
    # Δημιουργία TestClient
    client = TestClient(app)

    # Καθαρισμός κυκλώματος
    circuit_manager.clear_circuit()

    # Προσθήκη αισθητήρα DHT11 στο κύκλωμα
    circuit_manager.add_component(
        "DHT1", "DHT11", {"temperature": 23.5, "humidity": 65.0}
    )

    # Σύνδεση του DHT11 Pin Data με το Pin 7 (GPIO 4) του Raspberry Pi
    circuit_manager.add_wire("RPI", "pin7", "DHT1", "data")

    # Χρησιμοποιούμε mock για το urlopen ώστε να διαβάζει από τον τοπικό circuit_manager
    import urllib.request
    import io
    import json

    original_urlopen = urllib.request.urlopen

    def mock_urlopen(url_or_req):
        url = url_or_req.full_url if hasattr(url_or_req, "full_url") else url_or_req
        if "api/circuit" in url:
            data = circuit_manager.get_circuit_data()
            return io.BytesIO(json.dumps(data).encode("utf-8"))
        return original_urlopen(url_or_req)

    urllib.request.urlopen = mock_urlopen

    try:
        # Δημιουργία και μέτρηση μέσω του DHT11 shim
        # Το Pin BCM 4 αντιστοιχεί στο physical pin 7
        GPIO.setmode(GPIO.BCM)
        sensor = dht.DHT11(4)
        sensor.measure()

        # Έλεγχος αν διαβάστηκαν σωστά οι τιμές
        assert sensor.temperature() == 23.5
        assert sensor.humidity() == 65.0
    finally:
        # Επαναφορά της αρχικής μεθόδου
        urllib.request.urlopen = original_urlopen


# 2. Οριακό Σφάλμα / Edge Case Test
def test_sensor_not_connected_edge_case():
    # Έλεγχος συμπεριφοράς όταν ο αισθητήρας δεν είναι συνδεδεμένος στο pin
    import urllib.request
    import io
    import json

    # Καθαρισμός κυκλώματος
    circuit_manager.clear_circuit()

    original_urlopen = urllib.request.urlopen

    def mock_urlopen(url_or_req):
        data = circuit_manager.get_circuit_data()
        return io.BytesIO(json.dumps(data).encode("utf-8"))

    urllib.request.urlopen = mock_urlopen

    try:
        # Δημιουργία DHT11 σε pin 17 που δεν έχει συνδέσεις
        GPIO.setmode(GPIO.BCM)
        sensor = dht.DHT11(17)
        sensor.measure()

        # Οι τιμές πρέπει να επιστρέφουν 0.0 χωρίς να κρασάρει η εκτέλεση
        assert sensor.temperature() == 0.0
        assert sensor.humidity() == 0.0
    finally:
        urllib.request.urlopen = original_urlopen


# 3. Παράδειγμα Χρήσης (Typical Usage Example)
if __name__ == "__main__":
    # Απλό παράδειγμα χρήσης των shims των αισθητήρων
    print("=== Παράδειγμα Χρήσης Αισθητήρων ===")
    print("1. Αρχικοποίηση PIR αισθητήρα στο GPIO 17")
    pir = gpiozero.MotionSensor(17)
    print(f"Ανίχνευση κίνησης: {pir.motion_detected}")
