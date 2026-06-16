# Εισαγωγή του pytest και των κλάσεων προς δοκιμή
import pytest
from backend.simulator.gpio_state import GPIORegistry, GPIOPin


# 1. Επιτυχές Unit Test (Passing Test)
# Ελέγχει ότι η αρχικοποίηση και ο ορισμός τιμών στα GPIO pins λειτουργεί σωστά
def test_gpio_registry_set_get():
    # Δημιουργία καταχωρητή pins
    registry = GPIORegistry()
    
    # Επιλογή του pin 17 (αντιστοιχεί στο GPIO 17)
    pin_number = 17
    
    # Έλεγχος ότι η αρχική κατάσταση είναι INPUT και η τιμή είναι 0
    assert registry.pins[pin_number].mode == "INPUT"
    assert registry.get_pin_state(pin_number) == 0
    
    # Αλλαγή της λειτουργίας σε OUTPUT
    registry.set_pin_mode(pin_number, "OUTPUT")
    assert registry.pins[pin_number].mode == "OUTPUT"
    
    # Ορισμός της κατάστασης σε HIGH (1)
    registry.set_pin_state(pin_number, 1)
    assert registry.get_pin_state(pin_number) == 1
    
    # Ορισμός της κατάστασης σε LOW (0)
    registry.set_pin_state(pin_number, 0)
    assert registry.get_pin_state(pin_number) == 0


# 2. Οριακό Σφάλμα (Failing Edge Case Test - Σηματοδοτείται ως αναμενόμενη αποτυχία ή skip αν λείπει η παραμετροποίηση)
# Ελέγχει τη συμπεριφορά όταν προσπαθούμε να προσπελάσουμε ένα μη υπαρκτό pin (π.χ. pin 99)
def test_gpio_invalid_pin_edge_case():
    registry = GPIORegistry()
    invalid_pin = 99
    
    # Αναμένουμε ότι η προσπάθεια λήψης κατάστασης μη υπαρκτού pin θα επιστρέψει 0 και δεν θα προκαλέσει κατάρρευση
    state = registry.get_pin_state(invalid_pin)
    assert state == 0
    
    # Αναμένουμε ότι η προσπάθεια ορισμού κατάστασης σε μη υπαρκτό pin δεν θα προκαλέσει KeyError
    # Αυτό ελέγχει την ανθεκτικότητα του κώδικα (robustness)
    try:
        registry.set_pin_state(invalid_pin, 1)
        registry.set_pin_mode(invalid_pin, "OUTPUT")
    except KeyError:
        pytest.fail("Η εφαρμογή κατέρρευσε με KeyError για μη έγκυρο pin!")
