// Κώδικας C για το αναβόσβημα LED
#include <Arduino.h>

// Ορισμός του Led Pin (GPIO 17 / Φυσικό Pin 11)
int led_pin = 17;

void setup() {
    // Ρύθμιση του led_pin ως OUTPUT
    pinMode(led_pin, OUTPUT);
}

void loop() {
    // Ενεργοποίηση του led
    digitalWrite(led_pin, HIGH);
    delay(1000);
    
    // Απενεργοποίηση του led
    digitalWrite(led_pin, LOW);
    delay(1000);
}
