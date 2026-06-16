# Εισαγωγή του RPi.GPIO shim για τον έλεγχο των pin
import RPi.GPIO as GPIO
import time
import threading

# Κλάση που αναπαριστά μια απλή δίοδο LED στο gpiozero
class LED:
    def __init__(self, pin: int):
        self.pin = pin
        # Ρύθμιση του pin ως εξόδου μέσω του RPi.GPIO
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.pin, GPIO.OUT)
        # Αρχικοποίηση σε LOW κατάσταση
        GPIO.output(self.pin, GPIO.LOW)

    # Ενεργοποίηση του LED
    def on(self):
        GPIO.output(self.pin, GPIO.HIGH)

    # Απενεργοποίηση του LED
    def off(self):
        GPIO.output(self.pin, GPIO.LOW)

    # Εναλλαγή της κατάστασης του LED
    def toggle(self):
        current = GPIO.input(self.pin)
        GPIO.output(self.pin, GPIO.LOW if current == GPIO.HIGH else GPIO.HIGH)

    # Ιδιότητα (property) για την ανάγνωση ή γραφή της τιμής του LED
    @property
    def value(self) -> int:
        return GPIO.input(self.pin)

    @value.setter
    def value(self, val: int):
        GPIO.output(self.pin, GPIO.HIGH if val else GPIO.LOW)

    @property
    def is_lit(self) -> bool:
        return GPIO.input(self.pin) == GPIO.HIGH


# Κλάση που αναπαριστά ένα κουμπί (Button) στο gpiozero
class Button:
    def __init__(self, pin: int, pull_up: bool = True):
        self.pin = pin
        self.pull_up = pull_up
        
        GPIO.setmode(GPIO.BCM)
        # Καθορισμός pull-up ή pull-down αντίστασης
        pull_val = GPIO.PUD_UP if pull_up else GPIO.PUD_DOWN
        GPIO.setup(self.pin, GPIO.IN, pull_val)
        
        # Καθορισμός των callbacks για το πάτημα και το άφημα του κουμπιού
        self._when_pressed = None
        self._when_released = None
        
        # Ενεργοποίηση ανίχνευσης συμβάντων και για τις δύο μεταβάσεις (rising/falling)
        GPIO.add_event_detect(self.pin, GPIO.BOTH, self._event_handler)

    # Διαχείριση των συμβάντων αλλαγής κατάστασης του pin
    def _event_handler(self, pin_num: int):
        current_state = GPIO.input(self.pin)
        
        # Αν η αντίσταση είναι pull-up, το πάτημα δίνει 0 (LOW) και το άφημα 1 (HIGH)
        # Αν είναι pull-down, το πάτημα δίνει 1 (HIGH) και το άφημα 0 (LOW)
        if self.pull_up:
            is_pressed_now = (current_state == GPIO.LOW)
        else:
            is_pressed_now = (current_state == GPIO.HIGH)
            
        if is_pressed_now and self._when_pressed:
            self._when_pressed()
        elif not is_pressed_now and self._when_released:
            self._when_released()

    @property
    def is_pressed(self) -> bool:
        state = GPIO.input(self.pin)
        return state == GPIO.LOW if self.pull_up else state == GPIO.HIGH

    # Ορισμός callback για το πάτημα
    @property
    def when_pressed(self):
        return self._when_pressed

    @when_pressed.setter
    def when_pressed(self, callback):
        self._when_pressed = callback

    # Ορισμός callback για το άφημα
    @property
    def when_released(self):
        return self._when_released

    @when_released.setter
    def when_released(self, callback):
        self._when_released = callback

    # Αναμονή μέχρι να πατηθεί το κουμπί
    def wait_for_press(self, timeout: float = None):
        start_time = time.time()
        while not self.is_pressed:
            time.sleep(0.05)
            if timeout and (time.time() - start_time) > timeout:
                break

    # Αναμονή μέχρι να απελευθερωθεί το κουμπί
    def wait_for_release(self, timeout: float = None):
        start_time = time.time()
        while self.is_pressed:
            time.sleep(0.05)
            if timeout and (time.time() - start_time) > timeout:
                break


# Κλάση που αναπαριστά έναν βομβητή (Buzzer) στο gpiozero
class Buzzer:
    def __init__(self, pin: int):
        self.pin = pin
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.pin, GPIO.OUT)
        GPIO.output(self.pin, GPIO.LOW)

    def on(self):
        GPIO.output(self.pin, GPIO.HIGH)

    def off(self):
        GPIO.output(self.pin, GPIO.LOW)

    def toggle(self):
        current = GPIO.input(self.pin)
        GPIO.output(self.pin, GPIO.LOW if current == GPIO.HIGH else GPIO.HIGH)

    @property
    def value(self) -> int:
        return GPIO.input(self.pin)

    @value.setter
    def value(self, val: int):
        GPIO.output(self.pin, GPIO.HIGH if val else GPIO.LOW)


# Κλάση που αναπαριστά ένα LED με ρυθμιζόμενη φωτεινότητα (PWM) στο gpiozero
class PWMLED:
    def __init__(self, pin: int, frequency: float = 100.0):
        self.pin = pin
        self.frequency = frequency
        
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.pin, GPIO.OUT)
        
        # Δημιουργία και εκκίνηση του PWM
        self.pwm = GPIO.PWM(self.pin, self.frequency)
        self.pwm.start(0.0)
        self._value = 0.0

    @property
    def value(self) -> float:
        return self._value

    @value.setter
    def value(self, val: float):
        # Ο περιορισμός της τιμής στο διάστημα [0.0, 1.0]
        val = max(0.0, min(1.0, float(val)))
        self._value = val
        # Το gpiozero δέχεται τιμές 0.0-1.0, αλλά το RPi.GPIO δέχεται duty cycle 0.0-100.0
        self.pwm.ChangeDutyCycle(val * 100.0)

    def on(self):
        self.value = 1.0

    def off(self):
        self.value = 0.0

    def toggle(self):
        self.value = 1.0 - self.value
