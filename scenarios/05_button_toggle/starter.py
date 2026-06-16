import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)

# Το κουμπί στο GPIO 18 (pin 12), το LED στο GPIO 17 (pin 11)
btn_pin = 18
led_pin = 17

# Ρύθμιση του LED ως OUTPUT
GPIO.setup(led_pin, GPIO.OUT)

# Ρύθμιση του Κουμπιού ως INPUT με pull-down αντίσταση
# Έτσι, όταν το κουμπί δεν πατιέται, η τιμή είναι LOW
GPIO.setup(btn_pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

# Μεταβλητές για την αποθήκευση της κατάστασης
led_state = False
last_button_state = GPIO.LOW

try:
    while True:
        # Διάβασμα της τρέχουσας κατάστασης του κουμπιού
        current_button_state = GPIO.input(btn_pin)
        
        # Αν το κουμπί μόλις πατήθηκε (από LOW πήγε HIGH)
        if current_button_state == GPIO.HIGH and last_button_state == GPIO.LOW:
            # Αλλάζουμε την κατάσταση του LED
            led_state = not led_state
            GPIO.output(led_pin, led_state)
            
            # Μικρή καθυστέρηση (debounce) για να αποφύγουμε πολλαπλά "κλικ"
            time.sleep(0.05)
            
        # Αποθηκεύουμε την τρέχουσα κατάσταση για τον επόμενο έλεγχο
        last_button_state = current_button_state
        
        # Μικρή αναμονή για να μην υπερφορτώνεται η CPU
        time.sleep(0.01)

except KeyboardInterrupt:
    GPIO.cleanup()
