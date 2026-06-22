# Εισαγωγή των απαραίτητων βιβλιοθηκών
import RPi.GPIO as GPIO
import time

# Χρήση της αρίθμησης BCM
GPIO.setmode(GPIO.BCM)

# Ορισμός των GPIO pins
button_pin = 18  # Φυσικό Pin 12
led_pin = 17     # Φυσικό Pin 11

# Ρύθμιση του led_pin ως OUTPUT
GPIO.setup(led_pin, GPIO.OUT)

# Ρύθμιση του button_pin ως INPUT με εσωτερική pull-down αντίσταση
# Έτσι, όταν το κουμπί δεν είναι πατημένο, η είσοδος διαβάζει 0 (LOW)
GPIO.setup(button_pin, GPIO.IN, pull_up_down = GPIO.PUD_DOWN)

try:
    print("Το πρόγραμμα ξεκίνησε. Πατήστε το κουμπί στο κύκλωμα!")
    while True:
        # Ανάγνωση της κατάστασης του κουμπιού
        button_state = GPIO.input(button_pin)
        
        # Αν το κουμπί είναι πατημένο (HIGH/1)
        if button_state == GPIO.HIGH:
            GPIO.output(led_pin, GPIO.HIGH) # Ανάβουμε το LED
        else:
            GPIO.output(led_pin, GPIO.LOW)  # Σβήνουμε το LED
            
        # Μικρή καθυστέρηση για αποφυγή υπερβολικής χρήσης CPU
        time.sleep(0.05)
except KeyboardInterrupt:
    # Καθαρισμός κατά την έξοδο
    GPIO.cleanup()
