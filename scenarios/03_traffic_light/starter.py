import RPi.GPIO as GPIO
import time

# Ορισμός του συστήματος αρίθμησης των pins σε BCM
GPIO.setmode(GPIO.BCM)

# Αντιστοίχιση των pins στα χρώματα του φαναριού
led_red = 17
led_yellow = 27
led_green = 22

# Ρύθμιση των pins ως OUTPUT
GPIO.setup(led_red, GPIO.OUT)
GPIO.setup(led_yellow, GPIO.OUT)
GPIO.setup(led_green, GPIO.OUT)

try:
    while True:
        # Πράσινο φως για 3 δευτερόλεπτα
        GPIO.output(led_red, GPIO.LOW)
        GPIO.output(led_yellow, GPIO.LOW)
        GPIO.output(led_green, GPIO.HIGH)
        time.sleep(3.0)
        
        # Κίτρινο φως για 1 δευτερόλεπτο
        GPIO.output(led_green, GPIO.LOW)
        GPIO.output(led_yellow, GPIO.HIGH)
        time.sleep(1.0)
        
        # Κόκκινο φως για 3 δευτερόλεπτα
        GPIO.output(led_yellow, GPIO.LOW)
        GPIO.output(led_red, GPIO.HIGH)
        time.sleep(3.0)
except KeyboardInterrupt:
    # Καθαρισμός των GPIO καταστάσεων κατά την έξοδο με Ctrl+C
    GPIO.cleanup()
