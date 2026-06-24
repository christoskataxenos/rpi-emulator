from enum import IntEnum

class LogicState(IntEnum):
    LOW = 0
    HIGH = 1
    HIGH_Z = 2
    ERROR = 3

# Κλάση που αναπαριστά την κατάσταση ενός συγκεκριμένου pin του Raspberry Pi
class GPIOPin:
    def __init__(self, pin_number: int):
        # Ο αριθμός του pin (π.χ. GPIO 17)
        self.pin_number = pin_number
        
        # Η λειτουργία του pin: "INPUT" ή "OUTPUT"
        self.mode = "INPUT"
        
        # Η τιμή της κατάστασης: LOW, HIGH, HIGH_Z, ERROR
        self.state = LogicState.HIGH_Z
        
        # Ρύθμιση pull-up/pull-down αντίστασης: "UP", "DOWN" ή "NONE"
        self.pull = "NONE"
        
        # Σημαία που δείχνει αν το pin λειτουργεί ως PWM
        self.is_pwm = False
        
        # Ο κύκλος εργασίας (duty cycle) για το PWM (από 0.0 έως 100.0)
        self.pwm_duty_cycle = 0.0
        
        # Η συχνότητα του PWM σε Hz
        self.pwm_frequency = 0.0

    # Μέθοδος για τη μετατροπή της κατάστασης του pin σε λεξικό (dict)
    def to_dict(self) -> dict:
        return {
            "pin_number": self.pin_number,
            "mode": self.mode,
            "state": self.state.name,
            "pull": self.pull,
            "is_pwm": self.is_pwm,
            "pwm_duty_cycle": self.pwm_duty_cycle,
            "pwm_frequency": self.pwm_frequency
        }


# Κλάση που διαχειρίζεται την κατάσταση όλων των GPIO pins του εξομοιωτή
class GPIORegistry:
    def __init__(self):
        # Αποθηκεύει την κατάσταση των 40 GPIO pins του Raspberry Pi
        # Χρησιμοποιούμε λεξικό με κλειδί τον αριθμό του pin
        self.pins = {}
        for pin in range(1, 41):
            self.pins[pin] = GPIOPin(pin)

    # Μέθοδος για την ενημέρωση της λειτουργίας ενός pin (INPUT/OUTPUT)
    def set_pin_mode(self, pin_number: int, mode: str):
        if pin_number in self.pins:
            self.pins[pin_number].mode = mode
            if mode == "INPUT":
                self.pins[pin_number].state = LogicState.HIGH_Z

    # Μέθοδος για τον ορισμό της κατάστασης ενός pin
    def set_pin_state(self, pin_number: int, state: LogicState):
        if pin_number in self.pins:
            # Ενημερώνουμε την κατάσταση του pin, μετατρέποντας τυχόν int/bool σε LogicState
            if isinstance(state, int) and not isinstance(state, LogicState):
                try:
                    state = LogicState(state)
                except ValueError:
                    pass
            self.pins[pin_number].state = state

    # Μέθοδος για τη λήψη της τρέχουσας κατάστασης ενός pin
    def get_pin_state(self, pin_number: int) -> LogicState:
        if pin_number in self.pins:
            return self.pins[pin_number].state
        return LogicState.HIGH_Z

    # Μέθοδος για τον ορισμό των ρυθμίσεων PWM
    def set_pin_pwm(self, pin_number: int, is_pwm: bool, duty_cycle: float = 0.0, frequency: float = 0.0):
        if pin_number in self.pins:
            self.pins[pin_number].is_pwm = is_pwm
            self.pins[pin_number].pwm_duty_cycle = duty_cycle
            self.pins[pin_number].pwm_frequency = frequency

    # Μέθοδος για τον ορισμό της αντίστασης pull-up/pull-down
    def set_pin_pull(self, pin_number: int, pull: str):
        if pin_number in self.pins:
            self.pins[pin_number].pull = pull
            if self.pins[pin_number].mode == "INPUT" and self.pins[pin_number].state == LogicState.HIGH_Z:
                if pull == "PUD_UP":
                    self.pins[pin_number].state = LogicState.HIGH
                elif pull == "PUD_DOWN":
                    self.pins[pin_number].state = LogicState.LOW

    # Μέθοδος για τη λήψη των καταστάσεων όλων των pins σε μορφή λίστας από λεξικά
    def get_all_states(self) -> list:
        return [pin.to_dict() for pin in self.pins.values()]
