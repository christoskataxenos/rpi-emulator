import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)

btn_pin = 18    # Αισθητήρας πόρτας (Κουμπί)
led_pin = 17    # Προειδοποιητικό Φως (LED)
buzzer_pin = 23 # Σειρήνα (Buzzer)

# Ρύθμιση των εξόδων
GPIO.setup(led_pin, GPIO.OUT)
GPIO.setup(buzzer_pin, GPIO.OUT)

# Ρύθμιση εισόδου με Pull-Down (0 = Πόρτα κλειστή, 1 = Πόρτα άνοιξε)
GPIO.setup(btn_pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

# Αρχικοποίηση Συναγερμού (σβηστός)
alarm_triggered = False
GPIO.output(led_pin, GPIO.LOW)
GPIO.output(buzzer_pin, GPIO.LOW)

print("Ο συναγερμός οπλίστηκε. Περιμένω παραβίαση...")

try:
    while True:
        # Αν διαβάσουμε HIGH σημαίνει ότι η πόρτα άνοιξε (το κουμπί πατήθηκε)
        if GPIO.input(btn_pin) == GPIO.HIGH:
            alarm_triggered = True
            print("ΠΡΟΣΟΧΗ! Παραβίαση! Ο συναγερμός ενεργοποιήθηκε!")
            
        # Αν ο συναγερμός έχει χτυπήσει
        if alarm_triggered:
            # Αναβοσβήνει το LED και κάνει μπιπ το buzzer
            GPIO.output(led_pin, GPIO.HIGH)
            GPIO.output(buzzer_pin, GPIO.HIGH)
            time.sleep(0.2)
            
            GPIO.output(led_pin, GPIO.LOW)
            GPIO.output(buzzer_pin, GPIO.LOW)
            time.sleep(0.2)
            
            # Μόνο με Ctrl+C (Stop) σταματάει ο συναγερμός
        else:
            time.sleep(0.1)

except KeyboardInterrupt:
    print("Απενεργοποίηση συναγερμού.")
    GPIO.cleanup()
