import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)

# Το GPIO 18 (Pin 12) υποστηρίζει PWM
led_pin = 18

# Ρύθμιση του pin ως εξόδου
GPIO.setup(led_pin, GPIO.OUT)

# Δημιουργία αντικειμένου PWM στο pin με συχνότητα 100Hz
pwm = GPIO.PWM(led_pin, 100)

# Εκκίνηση του PWM με κύκλο λειτουργίας 0 (σβηστό)
pwm.start(0)

try:
    while True:
        # Αύξηση της φωτεινότητας (0 έως 100)
        for duty_cycle in range(0, 101, 5):
            pwm.ChangeDutyCycle(duty_cycle)
            time.sleep(0.05)
            
        # Μείωση της φωτεινότητας (100 έως 0)
        for duty_cycle in range(100, -1, -5):
            pwm.ChangeDutyCycle(duty_cycle)
            time.sleep(0.05)
            
except KeyboardInterrupt:
    # Διακοπή του PWM και καθαρισμός των pins
    pwm.stop()
    GPIO.cleanup()
