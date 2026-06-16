# Κλάση που αναπαριστά μια σύνδεση (καλώδιο) μεταξύ δύο ακροδεκτών
class Wire:
    def __init__(self, from_component: str, from_terminal: str, to_component: str, to_terminal: str, color: str = "#ff0000"):
        # Το όνομα του πρώτου εξαρτήματος (π.χ. "R1", "LED1", "RPI")
        self.from_component = from_component
        # Ο ακροδέκτης του πρώτου εξαρτήματος (π.χ. "A", "K", "pin11")
        self.from_terminal = from_terminal
        # Το όνομα του δεύτερου εξαρτήματος
        self.to_component = to_component
        # Ο ακροδέκτης του δεύτερου εξαρτήματος
        self.to_terminal = to_terminal
        # Το χρώμα του καλωδίου για οπτική αναπαράσταση
        self.color = color

    def to_dict(self) -> dict:
        return {
            "from_component": self.from_component,
            "from_terminal": self.from_terminal,
            "to_component": self.to_component,
            "to_terminal": self.to_terminal,
            "color": self.color
        }


# Κλάση που αναπαριστά ένα εξάρτημα στο κύκλωμα
class Component:
    def __init__(self, comp_id: str, comp_type: str, properties: dict = None):
        # Μοναδικό αναγνωριστικό (π.χ. "LED1")
        self.id = comp_id
        # Τύπος εξαρτήματος (LED, RESISTOR, BUTTON, BUZZER)
        self.type = comp_type
        # Ιδιότητες (π.χ. {"resistance": 330} για αντίσταση)
        self.properties = properties or {}
        # Οι ακροδέκτες του εξαρτήματος
        self.terminals = self._init_terminals()

    # Βοηθητική μέθοδος για τον ορισμό των ακροδεκτών ανάλογα με τον τύπο
    def _init_terminals(self) -> list:
        if self.type == "LED":
            return ["anode", "cathode"]
        elif self.type == "RESISTOR":
            return ["terminal_a", "terminal_b"]
        elif self.type == "BUTTON":
            return ["terminal_a", "terminal_b"]
        elif self.type == "BUZZER":
            return ["positive", "negative"]
        elif self.type == "RPI":
            # Το RPi έχει 40 pins ως ακροδέκτες
            return [f"pin{i}" for i in range(1, 41)]
        return []

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "properties": self.properties,
            "terminals": self.terminals
        }


# Κλάση διαχείρισης του κυκλώματος
class CircuitManager:
    def __init__(self):
        # Λεξικό με όλα τα εξαρτήματα (κλειδί το ID)
        self.components = {}
        # Λίστα με όλα τα καλώδια
        self.wires = []
        
        # Προσθήκη του ίδιου του Raspberry Pi ως βασικό εξάρτημα
        self.add_component("RPI", "RPI")

    # Μέθοδος προσθήκης εξαρτήματος
    def add_component(self, comp_id: str, comp_type: str, properties: dict = None) -> bool:
        if comp_id in self.components:
            return False
        self.components[comp_id] = Component(comp_id, comp_type, properties)
        return True

    # Μέθοδος αφαίρεσης εξαρτήματος
    def remove_component(self, comp_id: str) -> bool:
        if comp_id == "RPI":
            return False  # Το RPi δεν αφαιρείται
        if comp_id in self.components:
            del self.components[comp_id]
            # Αφαίρεση και όλων των καλωδίων που συνδέονται με αυτό το εξάρτημα
            self.wires = [
                w for w in self.wires
                if w.from_component != comp_id and w.to_component != comp_id
            ]
            return True
        return False

    # Μέθοδος προσθήκης καλωδίου
    def add_wire(self, from_comp: str, from_term: str, to_comp: str, to_term: str, color: str = "#ff0000") -> bool:
        # Έλεγχος αν υπάρχουν τα εξαρτήματα και οι ακροδέκτες
        if from_comp not in self.components or to_comp not in self.components:
            return False
        if from_term not in self.components[from_comp].terminals or to_term not in self.components[to_comp].terminals:
            return False
            
        # Προσθήκη του καλωδίου
        new_wire = Wire(from_comp, from_term, to_comp, to_term, color)
        self.wires.append(new_wire)
        return True

    # Μέθοδος αφαίρεσης καλωδίου
    def remove_wire(self, from_comp: str, from_term: str, to_comp: str, to_term: str) -> bool:
        initial_count = len(self.wires)
        self.wires = [
            w for w in self.wires
            if not (
                (w.from_component == from_comp and w.from_terminal == from_term and
                 w.to_component == to_comp and w.to_terminal == to_term) or
                (w.from_component == to_comp and w.from_terminal == to_term and
                 w.to_component == from_comp and w.to_terminal == from_term)
            )
        ]
        return len(self.wires) < initial_count

    # Καθαρισμός όλου του κυκλώματος (εκτός από το RPi)
    def clear_circuit(self):
        self.components = {"RPI": Component("RPI", "RPI")}
        self.wires = []

    def get_circuit_data(self) -> dict:
        return {
            "components": [c.to_dict() for c in self.components.values()],
            "wires": [w.to_dict() for w in self.wires]
        }
