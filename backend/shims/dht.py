import urllib.request
import json
import RPi.GPIO as GPIO


# Κλάση για την προσομοίωση του αισθητήρα DHT11
class DHT11:
    def __init__(self, pin: int):
        # Αποθήκευση του pin σύνδεσης
        self.pin = pin
        self._temperature = 0.0
        self._humidity = 0.0

    def measure(self):
        # Εύρεση του physical pin ανάλογα με το GPIO mode (BCM ή BOARD)
        try:
            # Προσπαθούμε να μεταφράσουμε το pin χρησιμοποιώντας τη συνάρτηση του RPi.GPIO shim
            board_pin = GPIO._translate_pin(self.pin)
        except Exception:
            # Αν αποτύχει, θεωρούμε BCM ως προεπιλογή
            board_pin = GPIO.BCM_TO_BOARD.get(self.pin, self.pin)

        rpi_terminal = f"pin{board_pin}"

        # Λήψη των δεδομένων του κυκλώματος από το backend API
        try:
            req = urllib.request.Request(f"{GPIO.BACKEND_URL}/api/circuit")
            with urllib.request.urlopen(req) as response:
                circuit_data = json.loads(response.read().decode("utf-8"))
        except Exception as error:
            print(f"[DHT11 Shim Error] Αποτυχία σύνδεσης με το backend: {error}")
            return

        # Εύρεση των καλωδίων που συνδέονται με αυτό το pin του Raspberry Pi
        connected_comps = []
        for wire in circuit_data.get("wires", []):
            other_comp = None
            if (
                wire["from_component"] == "RPI"
                and wire["from_terminal"] == rpi_terminal
            ):
                other_comp = wire["to_component"]
            elif wire["to_component"] == "RPI" and wire["to_terminal"] == rpi_terminal:
                other_comp = wire["from_component"]
            if other_comp:
                connected_comps.append(other_comp)

        # Εύρεση του component τύπου DHT11 στο κύκλωμα
        dht_comp = None
        for comp in circuit_data.get("components", []):
            if comp["type"] == "DHT11" and comp["id"] in connected_comps:
                dht_comp = comp
                break

        if dht_comp:
            # Ανάγνωση των ιδιοτήτων θερμοκρασίας και υγρασίας από το component
            self._temperature = float(dht_comp["properties"].get("temperature", 0.0))
            self._humidity = float(dht_comp["properties"].get("humidity", 0.0))
        else:
            print(
                f"[DHT11 Shim Warning] Δεν βρέθηκε αισθητήρας DHT11 συνδεδεμένος στο pin {self.pin}"
            )

    def temperature(self) -> float:
        # Επιστροφή της θερμοκρασίας
        return self._temperature

    def humidity(self) -> float:
        # Επιστροφή της υγρασίας
        return self._humidity
