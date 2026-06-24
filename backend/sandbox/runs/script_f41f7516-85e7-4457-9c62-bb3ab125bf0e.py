# Εισαγωγή των απαραίτητων βιβλιοθηκών για τον έλεγχο των pin και την καθυστέρηση
import RPi.GPIO as GPIO
import time

# Ορισμός του συστήματος αρίθμησης των pins σε BCM
GPIO.setmode(GPIO.BCM)

# Το pin 11 αντιστοιχεί στο GPIO 17
led_pin = 17

# Ρύθμιση του pin ως OUTPUT
GPIO.setup(led_pin, GPIO.OUT)

try:
    # Βρόχος για το αναβόσβημα του LED επ' άπειρον
    while True:
        # Ενεργοποίηση του LED (HIGH)
        GPIO.output(led_pin, GPIO.HIGH)
        # Αναμονή για 1 δευτερόλεπτο
        time.sleep(1.0)
        
        # Απενεργοποίηση του LED (LOW)
        GPIO.output(led_pin, GPIO.LOW)
        # Αναμονή για 1 δευτερόλεπτο
        time.sleep(1.0)
except KeyboardInterrupt:
    # Καθαρισμός των GPIO καταστάσεων κατά την έξοδο με Ctrl+C
    GPIO.cleanup()
