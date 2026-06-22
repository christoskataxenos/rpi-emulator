from backend.simulator.circuit import CircuitManager, Component, Wire
from backend.simulator.gpio_state import GPIORegistry, LogicState

class PhysicsEngine:
    def __init__(self, registry: GPIORegistry):
        self.registry = registry

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

    def _resolve_node_state(self, driving_states: list) -> LogicState:
        has_high = False
        has_low = False
        for state in driving_states:
            if state == LogicState.ERROR:
                return LogicState.ERROR
            elif state == LogicState.HIGH:
                has_high = True
            elif state == LogicState.LOW:
                has_low = True
                
        if has_high and has_low:
            return LogicState.ERROR
        elif has_high:
            return LogicState.HIGH
        elif has_low:
            return LogicState.LOW
        else:
            return LogicState.HIGH_Z

    # Ο νέος αλγόριθμος προσομοίωσης βασισμένος στη λογική του Logisim (Tick-based Propagation)
    def solve_circuit(self, circuit: CircuitManager, max_ticks=1000) -> dict:
        nodes = self._find_nodes(circuit)
        warnings = []
        component_states = {}
        
        # Λεξικό για την αποθήκευση της κατάστασης που προσπαθεί να επιβάλει 
        # κάθε ακροδέκτης στο καλώδιο (driving state)
        driving_states = {}
        
        node_states = [LogicState.HIGH_Z] * len(nodes)
        
        # Επανάληψη (ticks) μέχρι το κύκλωμα να ισορροπήσει ή να φτάσουμε το όριο
        changed = False
        for tick in range(max_ticks):
            changed = False
            
            # Βήμα 1: Τα εξαρτήματα υπολογίζουν τι θα βγάλουν (driving) με βάση το τι διαβάζουν
            for comp in circuit.components.values():
                if comp.type == "RPI":
                    gnd_pins = {6, 9, 14, 20, 25, 30, 34, 39}
                    five_v_pins = {2, 4}
                    three_v_pins = {1, 17}
                    
                    for term in comp.terminals:
                        pin_num = int(term.replace("pin", ""))
                        ref = (comp.id, term)
                        old_state = driving_states.get(ref, LogicState.HIGH_Z)
                        new_state = LogicState.HIGH_Z
                        
                        if pin_num in gnd_pins:
                            new_state = LogicState.LOW
                        elif pin_num in five_v_pins or pin_num in three_v_pins:
                            new_state = LogicState.HIGH
                        else:
                            pin_state = self.registry.pins.get(pin_num)
                            if pin_state and pin_state.mode == "OUTPUT":
                                new_state = pin_state.state
                                
                        if new_state != old_state:
                            driving_states[ref] = new_state
                            changed = True
                            
                elif comp.type == "BUTTON":
                    # Το κουμπί συνδέει το A με το B όταν πατιέται
                    is_pressed = comp.properties.get("pressed", False)
                    ref_a = (comp.id, "terminal_a")
                    ref_b = (comp.id, "terminal_b")
                    
                    old_a = driving_states.get(ref_a, LogicState.HIGH_Z)
                    old_b = driving_states.get(ref_b, LogicState.HIGH_Z)
                    
                    if is_pressed:
                        # Οδηγεί στο A ό,τι διαβάζει από το B, και αντίστροφα
                        read_b = comp.terminal_states.get("terminal_b", LogicState.HIGH_Z)
                        read_a = comp.terminal_states.get("terminal_a", LogicState.HIGH_Z)
                        new_a = read_b
                        new_b = read_a
                    else:
                        new_a = LogicState.HIGH_Z
                        new_b = LogicState.HIGH_Z
                        
                    if new_a != old_a:
                        driving_states[ref_a] = new_a
                        changed = True
                    if new_b != old_b:
                        driving_states[ref_b] = new_b
                        changed = True

                elif comp.type == "RESISTOR":
                    # Στο ψηφιακό μοντέλο, η αντίσταση απλά περνάει τη λογική κατάσταση
                    ref_a = (comp.id, "terminal_a")
                    ref_b = (comp.id, "terminal_b")
                    read_b = comp.terminal_states.get("terminal_b", LogicState.HIGH_Z)
                    read_a = comp.terminal_states.get("terminal_a", LogicState.HIGH_Z)
                    
                    old_a = driving_states.get(ref_a, LogicState.HIGH_Z)
                    old_b = driving_states.get(ref_b, LogicState.HIGH_Z)
                    
                    if old_a != read_b:
                        driving_states[ref_a] = read_b
                        changed = True
                    if old_b != read_a:
                        driving_states[ref_b] = read_a
                        changed = True

                elif comp.type == "PIR":
                    # Το PIR οδηγεί την έξοδο 'out' σε HIGH αν ανιχνευθεί κίνηση, αλλιώς LOW
                    is_active = comp.properties.get("motion", False)
                    ref_out = (comp.id, "out")
                    old_out = driving_states.get(ref_out, LogicState.HIGH_Z)
                    new_out = LogicState.HIGH if is_active else LogicState.LOW
                    if new_out != old_out:
                        driving_states[ref_out] = new_out
                        changed = True

            # Βήμα 2: Επίλυση των κόμβων (Node Resolution)
            for i, node in enumerate(nodes):
                node_driving = [driving_states.get(ref, LogicState.HIGH_Z) for ref in node]
                resolved = self._resolve_node_state(node_driving)
                node_states[i] = resolved
                
                # Ενημέρωση των εξαρτημάτων για τη νέα κατάσταση του κόμβου
                for ref in node:
                    comp_id, term = ref
                    comp = circuit.components[comp_id]
                    if comp.terminal_states.get(term) != resolved:
                        comp.terminal_states[term] = resolved
                        changed = True
                        
            # Αν δεν άλλαξε τίποτα σε αυτό το tick, το κύκλωμα ισορρόπησε!
            if not changed:
                break
                
        # Έλεγχος αν τερμάτισε λόγω max_ticks (ταλάντωση)
        if changed:
            warnings.append({
                "type": "OSCILLATION",
                "message": f"Το κύκλωμα δεν ισορρόπησε μετά από {max_ticks} ticks (πιθανή ταλάντωση)."
            })

        # Τελική αξιολόγηση οπτικών καταστάσεων (LEDs, Buzzers)
        for comp in circuit.components.values():
            if comp.type == "LED":
                anode = comp.terminal_states.get("anode", LogicState.HIGH_Z)
                cathode = comp.terminal_states.get("cathode", LogicState.HIGH_Z)
                # Το LED ανάβει ψηφιακά όταν η Άνοδος είναι HIGH και η Κάθοδος LOW
                if anode == LogicState.HIGH and cathode == LogicState.LOW:
                    component_states[comp.id] = "lit"
                else:
                    component_states[comp.id] = "off"
                    
            elif comp.type == "BUZZER":
                pos = comp.terminal_states.get("positive", LogicState.HIGH_Z)
                neg = comp.terminal_states.get("negative", LogicState.HIGH_Z)
                if pos == LogicState.HIGH and neg == LogicState.LOW:
                    component_states[comp.id] = "sounding"
                else:
                    component_states[comp.id] = "silent"

        # Ενημέρωση των GPIO INPUT pins του RPi
        for node_idx, node in enumerate(nodes):
            resolved = node_states[node_idx]
            for comp_id, term in node:
                if comp_id == "RPI":
                    pin_num = int(term.replace("pin", ""))
                    pin_state = self.registry.pins.get(pin_num)
                    
                    if pin_state and pin_state.mode == "INPUT":
                        if resolved == LogicState.HIGH:
                            self.registry.set_pin_state(pin_num, LogicState.HIGH)
                        elif resolved == LogicState.LOW:
                            self.registry.set_pin_state(pin_num, LogicState.LOW)
                        else: # HIGH_Z
                            # Εφαρμογή των εσωτερικών αντιστάσεων Pull-Up / Pull-Down
                            if pin_state.pull == "PUD_UP":
                                self.registry.set_pin_state(pin_num, LogicState.HIGH)
                            elif pin_state.pull == "PUD_DOWN":
                                self.registry.set_pin_state(pin_num, LogicState.LOW)
                            else:
                                self.registry.set_pin_state(pin_num, LogicState.HIGH_Z)
                                
        # Έλεγχος για βραχυκυκλώματα
        for node_idx, state in enumerate(node_states):
            if state == LogicState.ERROR:
                warnings.append({
                    "type": "SHORT_CIRCUIT",
                    "message": "Ανιχνεύθηκε βραχυκύκλωμα (Διένεξη HIGH και LOW στο ίδιο καλώδιο)!"
                })
                break

        return {
            "component_states": component_states,
            "warnings": warnings
        }
