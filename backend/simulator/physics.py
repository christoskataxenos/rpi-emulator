# Εισαγωγή των απαραίτητων κλάσεων για τη διαχείριση του κυκλώματος
from backend.simulator.circuit import CircuitManager, Component, Wire
from backend.simulator.gpio_state import GPIORegistry

# Σταθερές για τα ηλεκτρικά χαρακτηριστικά των εξαρτημάτων
LED_FORWARD_VOLTAGE = 2.0  # Πτώση τάσης LED σε Volt
LED_INTERNAL_RESISTANCE = 50.0  # Εσωτερική αντίσταση LED σε Ohm
LED_MAX_CURRENT = 0.025  # Μέγιστο επιτρεπτό ρεύμα LED σε Amperes (25mA)
LED_MIN_CURRENT = 0.001  # Ελάχιστο ρεύμα για να ανάψει το LED (1mA)

BUZZER_RESISTANCE = 100.0  # Αντίσταση βομβητή σε Ohm
BUZZER_MIN_CURRENT = 0.005  # Ελάχιστο ρεύμα για να ακουστεί ο βομβητής (5mA)


# Κλάση που εκτελεί τους ηλεκτρικούς υπολογισμούς (Ohm's Law, κτλ)
class PhysicsEngine:
    def __init__(self, registry: GPIORegistry):
        self.registry = registry

    # Συνάρτηση ομαδοποίησης των συνδεδεμένων ακροδεκτών σε "ηλεκτρικούς κόμβους"
    def _find_nodes(self, circuit: CircuitManager) -> list:
        # Δημιουργία λίστας με όλους τους ακροδέκτες ως ξεχωριστά σύνολα
        nodes = []
        terminal_to_node = {}
        
        for comp in circuit.components.values():
            for term in comp.terminals:
                term_ref = (comp.id, term)
                new_set = {term_ref}
                nodes.append(new_set)
                terminal_to_node[term_ref] = new_set
                
        # Ένωση των συνόλων που συνδέονται με καλώδιο
        for wire in circuit.wires:
            ref_a = (wire.from_component, wire.from_terminal)
            ref_b = (wire.to_component, wire.to_terminal)
            
            node_a = terminal_to_node.get(ref_a)
            node_b = terminal_to_node.get(ref_b)
            
            if node_a and node_b and node_a != node_b:
                # Συγχώνευση των δύο κόμβων
                merged_node = node_a.union(node_b)
                nodes.remove(node_a)
                nodes.remove(node_b)
                nodes.append(merged_node)
                
                # Ενημέρωση των δεικτών
                for term_ref in merged_node:
                    terminal_to_node[term_ref] = merged_node
                    
        return nodes

    # Βοηθητική μέθοδος για την εύρεση της τάσης ενός κόμβου αν συνδέεται σε πηγή
    def _get_node_voltage(self, node: set) -> float:
        # Λίστα με τα pins του RPi που παρέχουν σταθερή τάση
        gnd_pins = {6, 9, 14, 20, 25, 30, 34, 39}
        five_v_pins = {2, 4}
        three_v_pins = {1, 17}
        
        for comp_id, term in node:
            if comp_id == "RPI":
                pin_num = int(term.replace("pin", ""))
                
                # Έλεγχος σταθερών πηγών τροφοδοσίας
                if pin_num in gnd_pins:
                    return 0.0
                elif pin_num in five_v_pins:
                    return 5.0
                elif pin_num in three_v_pins:
                    return 3.3
                    
                # Έλεγχος GPIO pins που είναι ρυθμισμένα ως OUTPUT
                pin_state = self.registry.pins.get(pin_num)
                if pin_state and pin_state.mode == "OUTPUT":
                    # HIGH = 3.3V, LOW = 0V
                    return 3.3 if pin_state.state == 1 else 0.0
                    
        return -1.0  # Δεν συνδέεται άμεσα σε πηγή τάσης

    # Βοηθητική μέθοδος για τον εντοπισμό αν ένας κόμβος είναι Ground
    def _is_gnd_node(self, node: set) -> bool:
        gnd_pins = {6, 9, 14, 20, 25, 30, 34, 39}
        for comp_id, term in node:
            if comp_id == "RPI":
                pin_num = int(term.replace("pin", ""))
                if pin_num in gnd_pins:
                    return True
        return False

    # Βοηθητική μέθοδος για τον εντοπισμό αν ένας κόμβος είναι GPIO INPUT pin
    def _get_gpio_inputs_in_node(self, node: set) -> list:
        inputs = []
        for comp_id, term in node:
            if comp_id == "RPI":
                pin_num = int(term.replace("pin", ""))
                pin_state = self.registry.pins.get(pin_num)
                if pin_state and pin_state.mode == "INPUT":
                    inputs.append(pin_num)
        return inputs

    # Κύρια μέθοδος επίλυσης και ανάλυσης του κυκλώματος
    def solve_circuit(self, circuit: CircuitManager) -> dict:
        nodes = self._find_nodes(circuit)
        
        # Λεξικά για την αποθήκευση των αποτελεσμάτων
        warnings = []
        component_states = {}  # LED: "lit"/"off", Buzzer: "sounding"/"silent"
        node_voltages = {}
        
        # Βρίσκουμε ποιοι κόμβοι συνδέονται με πηγές (Vcc ή GPIO Out) και Ground
        source_nodes = []
        gnd_nodes = []  # Λίστα GND κόμβων (φυσικά GND pins + GPIO OUTPUT LOW)
        
        for i, node in enumerate(nodes):
            volts = self._get_node_voltage(node)
            if volts >= 0:
                node_voltages[i] = volts
                if volts > 0:
                    source_nodes.append((i, volts))
            if self._is_gnd_node(node):
                if i not in gnd_nodes:
                    gnd_nodes.append(i)
                node_voltages[i] = 0.0

        # Επίσης αναγνωρίζουμε GPIO OUTPUT LOW (0V) ως έγκυρους κόμβους GND
        # Αυτό επιτρέπει κυκλώματα τύπου VCC → R → LED → GPIO_OUT_LOW
        for i in list(node_voltages.keys()):
            if node_voltages[i] == 0.0 and i not in gnd_nodes:
                gnd_nodes.append(i)

        # Backward compat: κρατάμε το πρώτο GND node για αναφορά
        gnd_node = gnd_nodes[0] if gnd_nodes else None

        # Έλεγχος για βραχυκύκλωμα (direct Vcc to GND)
        for src_idx, volts in source_nodes:
            if src_idx in gnd_nodes:
                warnings.append({
                    "type": "SHORT_CIRCUIT",
                    "message": "Ανιχνεύθηκε βραχυκύκλωμα! Πηγή τροφοδοσίας συνδέεται απευθείας με τη γείωση (GND)."
                })

        # Αναπαράσταση του κυκλώματος ως γράφου για εύρεση μονοπατιών
        # Δημιουργούμε λίστα γειτνίασης μεταξύ των ηλεκτρικών κόμβων
        adj = {i: [] for i in range(len(nodes))}
        
        # Αντιστοίχιση των ακροδεκτών στον δείκτη του κόμβου τους
        term_to_node_idx = {}
        for idx, node in enumerate(nodes):
            for term in node:
                term_to_node_idx[term] = idx

        # Προσθήκη των εξαρτημάτων ως ακμές του γράφου
        for comp in circuit.components.values():
            if comp.type == "RPI":
                continue
                
            # Κάθε εξάρτημα MVP έχει 2 ακροδέκτες
            terms = comp.terminals
            ref_a = (comp.id, terms[0])
            ref_b = (comp.id, terms[1])
            
            node_a_idx = term_to_node_idx.get(ref_a)
            node_b_idx = term_to_node_idx.get(ref_b)
            
            if node_a_idx is not None and node_b_idx is not None:
                adj[node_a_idx].append((node_b_idx, comp))
                adj[node_b_idx].append((node_a_idx, comp))

        # Εύρεση μονοπατιών από τις πηγές τάσης προς ΟΛΟΥΣ τους κόμβους GND
        # Αυτό υποστηρίζει και GPIO OUTPUT LOW ως sink (VCC → R → LED → GPIO)
        activated_inputs = set()
        already_processed = set()  # Αποφυγή διπλής επεξεργασίας ίδιων μονοπατιών
        
        for src_idx, volts in source_nodes:
            if not gnd_nodes:
                break
            
            for gnd_n in gnd_nodes:
                if src_idx == gnd_n:
                    continue  # Skip: πηγή και GND στον ίδιο κόμβο (βραχυκύκλωμα)
                
                # Αναζήτηση μονοπατιού (DFS) από src_idx σε gnd_n
                paths = self._find_paths_to_gnd(src_idx, gnd_n, adj)
                
                for path in paths:
                    # Μοναδικό κλειδί για αποφυγή διπλής επεξεργασίας
                    path_key = (src_idx, gnd_n, tuple(c.id for c in path))
                    if path_key in already_processed:
                        continue
                    already_processed.add(path_key)
                    
                    # Τάση πηγής μείον τάση sink (για GPIO OUTPUT LOW = 0V)
                    sink_voltage = node_voltages.get(gnd_n, 0.0)
                    effective_voltage = volts - sink_voltage

                    # Υπολογισμός συνολικής αντίστασης και πτώσης τάσης στο μονοπάτι
                    total_resistance = 0.0
                    voltage_drop = 0.0
                    has_led = False
                    led_comp = None
                    button_open = False
                    buzzer_comp = None
                    
                    for comp in path:
                        if comp.type == "RESISTOR":
                            total_resistance += float(comp.properties.get("resistance", 1000.0))
                        elif comp.type == "LED":
                            has_led = True
                            led_comp = comp
                            voltage_drop += LED_FORWARD_VOLTAGE
                            total_resistance += LED_INTERNAL_RESISTANCE
                        elif comp.type == "BUZZER":
                            buzzer_comp = comp
                            total_resistance += BUZZER_RESISTANCE
                        elif comp.type == "BUTTON":
                            # Αν το κουμπί δεν είναι πατημένο, το κύκλωμα είναι ανοιχτό
                            is_pressed = comp.properties.get("pressed", False)
                            if not is_pressed:
                                button_open = True

                    # Αν κάποιο κουμπί είναι ανοιχτό, δεν περνάει ρεύμα
                    if button_open:
                        continue

                    # Υπολογισμός ρεύματος με βάση την πραγματική διαφορά δυναμικού
                    remaining_voltage = effective_voltage - voltage_drop
                    if remaining_voltage <= 0:
                        current = 0.0
                    else:
                        # Αν δεν υπάρχει αντίσταση (total_resistance = 0), έχουμε βραχυκύκλωμα
                        if total_resistance == 0:
                            current = 999.0  # Πολύ μεγάλο ρεύμα
                        else:
                            current = remaining_voltage / total_resistance

                    # Έλεγχος ορίων και προειδοποιήσεις
                    if current == 999.0:
                        warnings.append({
                            "type": "SHORT_CIRCUIT",
                            "message": "Ανιχνεύθηκε βραχυκύκλωμα στο μονοπάτι! Πηγή συνδεδεμένη απευθείας στη γείωση."
                        })
                    else:
                        # Ανάλυση της κατάστασης του LED
                        if has_led and led_comp:
                            if current >= LED_MIN_CURRENT:
                                component_states[led_comp.id] = "lit"
                                # Αν το ρεύμα ξεπερνά το μέγιστο επιτρεπτό
                                if current > LED_MAX_CURRENT:
                                    warnings.append({
                                        "type": "OVERCURRENT",
                                        "component_id": led_comp.id,
                                        "message": f"Προειδοποίηση: Το LED '{led_comp.id}' διαρρέεται από υπερβολικό ρεύμα ({current*1000:.1f} mA). Χρησιμοποιήστε αντίσταση για προστασία!"
                                    })
                            else:
                                component_states[led_comp.id] = "off"
                                
                        # Ανάλυση της κατάστασης του Buzzer
                        if buzzer_comp:
                            if current >= BUZZER_MIN_CURRENT:
                                component_states[buzzer_comp.id] = "sounding"
                            else:
                                component_states[buzzer_comp.id] = "silent"

        # Ενημέρωση των GPIO INPUT pins ανάλογα με τη σύνδεσή τους σε πηγές τάσης
        # Για κάθε κόμβο που συνδέεται με μια πηγή τάσης (Vcc > 1.8V), αν περιέχει GPIO INPUT,
        # το GPIO INPUT τίθεται σε HIGH.
        for idx, node in enumerate(nodes):
            volts = node_voltages.get(idx, -1.0)
            
            # Αν ο κόμβος δεν συνδέεται άμεσα σε πηγή, ελέγχουμε αν συνδέεται μέσω κλειστού κουμπιού σε Vcc
            if volts < 0:
                # Αναζήτηση αν συνδέεται με κάποιον κόμβο που έχει τάση
                for src_idx, src_volts in source_nodes:
                    paths = self._find_paths_between_nodes(src_idx, idx, adj)
                    for path in paths:
                        # Έλεγχος αν το μονοπάτι είναι κλειστό (χωρίς ανοιχτά κουμπιά)
                        button_open = False
                        for comp in path:
                            if comp.type == "BUTTON" and not comp.properties.get("pressed", False):
                                button_open = True
                                break
                        if not button_open:
                            volts = src_volts
                            node_voltages[idx] = volts
                            break
                    if volts >= 0:
                        break

            # Ενημέρωση των GPIO inputs στον καταχωρητή (registry)
            gpio_inputs = self._get_gpio_inputs_in_node(node)
            for pin_num in gpio_inputs:
                pin_state = self.registry.pins.get(pin_num)
                # Αν η τάση στον κόμβο είναι > 1.8V, το pin διαβάζει 1 (HIGH)
                # Διαφορετικά, εξαρτάται από το pull (PUD_UP -> 1, PUD_DOWN -> 0)
                if volts >= 1.8:
                    self.registry.set_pin_state(pin_num, 1)
                    activated_inputs.add(pin_num)
                else:
                    if pin_state and pin_state.pull == "PUD_UP":
                        self.registry.set_pin_state(pin_num, 1)
                    else:
                        self.registry.set_pin_state(pin_num, 0)

        # Επαναφορά των input pins που δεν συνδέονται σε τάση και δεν έχουν pull-up
        for pin_num, pin_state in self.registry.pins.items():
            if pin_state.mode == "INPUT" and pin_num not in activated_inputs:
                if pin_state.pull == "PUD_UP":
                    self.registry.set_pin_state(pin_num, 1)
                else:
                    self.registry.set_pin_state(pin_num, 0)

        return {
            "component_states": component_states,
            "warnings": warnings
        }

    # Βοηθητική μέθοδος εύρεσης μονοπατιών από src σε dest στον γράφο
    def _find_paths_to_gnd(self, src: int, dest: int, adj: dict) -> list:
        paths = []
        self._dfs_find_paths(src, dest, adj, set(), [], paths)
        return paths

    # Βοηθητική μέθοδος εύρεσης μονοπατιών μεταξύ δύο τυχαίων κόμβων
    def _find_paths_between_nodes(self, src: int, dest: int, adj: dict) -> list:
        paths = []
        self._dfs_find_paths(src, dest, adj, set(), [], paths)
        return paths

    # Αναδρομική συνάρτηση DFS για εύρεση όλων των απλών μονοπατιών
    def _dfs_find_paths(self, curr: int, dest: int, adj: dict, visited: set, current_path: list, all_paths: list):
        if curr == dest:
            all_paths.append(list(current_path))
            return
            
        visited.add(curr)
        
        for neighbor, comp in adj[curr]:
            if neighbor not in visited:
                current_path.append(comp)
                self._dfs_find_paths(neighbor, dest, adj, visited, current_path, all_paths)
                current_path.pop()
                
        visited.remove(curr)
