# Εισαγωγή απαραίτητων βιβλιοθηκών από την standard library της Python
import urllib.request
import urllib.parse
import json
import threading
import time

# Σταθερές που χρησιμοποιούνται στο RPi.GPIO
BOARD = "BOARD"
BCM = "BCM"

OUT = "OUTPUT"
IN = "INPUT"

HIGH = 1
LOW = 0

PUD_OFF = "PUD_OFF"
PUD_UP = "PUD_UP"
PUD_DOWN = "PUD_DOWN"

RISING = "RISING"
FALLING = "FALLING"
BOTH = "BOTH"

# Καθολικές μεταβλητές για τη διαμόρφωση του shim
# Ορισμός της διεύθυνσης του backend εξομοιωτή
BACKEND_URL = "http://127.0.0.1:8000"
current_mode = None
event_callbacks = {}
stream_thread = None
stream_running = False

# Αντιστοίχιση των φυσικών pins (BOARD) σε BCM GPIO numbers
BOARD_TO_BCM = {
    3: 2, 5: 3, 7: 4, 8: 14, 10: 15, 11: 17, 12: 18, 13: 27, 15: 22, 16: 23, 18: 24,
    19: 10, 21: 9, 22: 25, 23: 11, 24: 8, 26: 7, 29: 5, 31: 6, 32: 12, 33: 13, 35: 19,
    36: 16, 37: 26, 38: 20, 40: 21
}


BCM_TO_BOARD = {bcm: board for board, bcm in BOARD_TO_BCM.items()}


# Βοηθητική συνάρτηση για τη μετατροπή του pin σύμφωνα με το mode (BCM ή BOARD) σε φυσικό pin (BOARD)
def _translate_pin(pin: int) -> int:
    global current_mode
    if current_mode == BCM:
        if pin in BCM_TO_BOARD:
            return BCM_TO_BOARD[pin]
        else:
            raise ValueError(f"Το BCM pin {pin} δεν είναι έγκυρο GPIO pin.")
    return pin


# Συνάρτηση για την απενεργοποίηση ή ενεργοποίηση προειδοποιήσεων (no-op στο shim)
def setwarnings(state: bool):
    pass


# Συνάρτηση για τον ορισμό του συστήματος αρίθμησης των pins (BCM ή BOARD)
def setmode(mode: str):
    global current_mode
    if mode not in [BOARD, BCM]:
        raise ValueError("Το mode πρέπει να είναι BOARD ή BCM.")
    current_mode = mode


# Συνάρτηση για τη λήψη του τρέχοντος mode
def getmode() -> str:
    global current_mode
    return current_mode


# Συνάρτηση για τη ρύθμιση ενός pin ως εισόδου ή εξόδου
def setup(pin: int, mode: str, pull_up_down: str = PUD_OFF):
    bcm_pin = _translate_pin(pin)
    
    # Προετοιμασία των δεδομένων για αποστολή στο backend
    data = {
        "pin_number": bcm_pin,
        "mode": mode,
        "pull": pull_up_down
    }
    
    # Αποστολή HTTP POST αιτήματος για ενημέρωση του backend
    encoded_data = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/gpio/setup",
        data = encoded_data,
        headers = {"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req)
    except Exception as error:
        # Σε περίπτωση που το backend δεν είναι ενεργό, εμφανίζουμε ένα μήνυμα
        print(f"[Shim Warning] Δεν ήταν δυνατή η σύνδεση στο backend για το setup του pin {bcm_pin}: {error}")


# Συνάρτηση για τον ορισμό της τιμής εξόδου ενός pin (HIGH/LOW)
def output(pin: int, state: int):
    bcm_pin = _translate_pin(pin)
    
    data = {
        "pin_number": bcm_pin,
        "state": state
    }
    
    encoded_data = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/gpio/output",
        data = encoded_data,
        headers = {"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req)
    except Exception as error:
        print(f"[Shim Warning] Σφάλμα κατά την έξοδο τιμής στο pin {bcm_pin}: {error}")


# Συνάρτηση για την ανάγνωση της κατάστασης εισόδου ενός pin
def input(pin: int) -> int:
    bcm_pin = _translate_pin(pin)
    
    try:
        response = urllib.request.urlopen(f"{BACKEND_URL}/api/gpio/input/{bcm_pin}")
        result = json.loads(response.read().decode("utf-8"))
        return result.get("state", 0)
    except Exception as error:
        print(f"[Shim Warning] Σφάλμα κατά την ανάγνωση εισόδου του pin {bcm_pin}: {error}")
        return 0


# Συνάρτηση για τον καθαρισμό των ρυθμίσεων των pins στο τέλος του προγράμματος
def cleanup():
    global stream_running
    stream_running = False
    
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/gpio/cleanup",
        data = b"",
        method = "POST"
    )
    try:
        urllib.request.urlopen(req)
    except Exception as error:
        print(f"[Shim Warning] Σφάλμα κατά τον καθαρισμό των GPIO: {error}")


# Κλάση για τη διαχείριση της λειτουργικότητας PWM (Pulse Width Modulation)
class PWM:
    def __init__(self, pin: int, frequency: float):
        self.pin = _translate_pin(pin)
        self.frequency = frequency
        self.duty_cycle = 0.0

    # Έναρξη του PWM με συγκεκριμένο duty cycle
    def start(self, duty_cycle: float):
        self.duty_cycle = duty_cycle
        self._update_backend(True)

    # Αλλαγή της συχνότητας λειτουργίας
    def ChangeFrequency(self, frequency: float):
        self.frequency = frequency
        self._update_backend(True)

    # Αλλαγή του duty cycle
    def ChangeDutyCycle(self, duty_cycle: float):
        self.duty_cycle = duty_cycle
        self._update_backend(True)

    # Τερματισμός του PWM στο pin
    def stop(self):
        self._update_backend(False)

    # Βοηθητική μέθοδος για την αποστολή των στοιχείων PWM στο backend
    def _update_backend(self, is_active: bool):
        data = {
            "pin_number": self.pin,
            "is_pwm": is_active,
            "duty_cycle": self.duty_cycle,
            "frequency": self.frequency
        }
        encoded_data = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(
            f"{BACKEND_URL}/api/gpio/pwm",
            data = encoded_data,
            headers = {"Content-Type": "application/json"}
        )
        try:
            urllib.request.urlopen(req)
        except Exception as error:
            print(f"[Shim Warning] Σφάλμα ενημέρωσης PWM για το pin {self.pin}: {error}")


# Background thread που ακούει για αλλαγές από το backend (SSE stream)
def _listen_to_events():
    global stream_running, event_callbacks
    
    while stream_running:
        try:
            response = urllib.request.urlopen(f"{BACKEND_URL}/api/gpio/stream", timeout = 10)
            while stream_running:
                line = response.readline()
                if not line:
                    break
                    
                line_str = line.decode("utf-8").strip()
                if line_str.startswith("data:"):
                    json_data = line_str[5:].strip()
                    event = json.loads(json_data)
                    
                    pin = event.get("pin")
                    state = event.get("state")
                    
                    # Έλεγχος αν υπάρχει εγγεγραμμένο callback για αυτό το pin
                    if pin in event_callbacks:
                        callback_info = event_callbacks[pin]
                        edge = callback_info["edge"]
                        callback_func = callback_info["callback"]
                        last_state = callback_info["last_state"]
                        
                        # Ανίχνευση της σωστής μετάβασης (rising, falling, κτλ)
                        trigger = False
                        if edge == RISING and last_state == 0 and state == 1:
                            trigger = True
                        elif edge == FALLING and last_state == 1 and state == 0:
                            trigger = True
                        elif edge == BOTH and last_state != state:
                            trigger = True
                            
                        callback_info["last_state"] = state
                        
                        if trigger:
                            # Εκτέλεση του callback σε ξεχωριστό thread για να μην κολλάει το stream
                            threading.Thread(target = callback_func, args = (pin,)).start()
                            
        except Exception:
            # Αν αποτύχει η σύνδεση, περιμένουμε λίγο και ξαναπροσπαθούμε
            time.sleep(1)


# Συνάρτηση για την προσθήκη ανίχνευσης συμβάντων (interrupts)
def add_event_detect(pin: int, edge: str, callback, bouncetime: int = 200):
    global stream_thread, stream_running, event_callbacks
    bcm_pin = _translate_pin(pin)
    
    # Αποθήκευση του callback
    event_callbacks[bcm_pin] = {
        "edge": edge,
        "callback": callback,
        "last_state": input(pin),
        "bouncetime": bouncetime
    }
    
    # Έναρξη του νήματος ακρόασης αν δεν έχει ήδη ξεκινήσει
    if not stream_running:
        stream_running = True
        stream_thread = threading.Thread(target = _listen_to_events, daemon = True)
        stream_thread.start()
