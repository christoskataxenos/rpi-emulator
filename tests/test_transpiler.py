import pytest
import os
import sys

# Προσθήκη του root φακέλου στο path για να βρει το backend module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "shims")))

from backend.sandbox.transpiler import is_c_code, transpile_c_to_python
import RPi.GPIO as GPIO

# 1. Επιτυχές Unit Test για ανίχνευση κώδικα C (Passing Test)
def test_is_c_code_detection():
    # Δοκιμή ανίχνευσης κώδικα Arduino
    arduino_code = """
    #include <Arduino.h>
    void setup() {
        pinMode(13, OUTPUT);
    }
    void loop() {
        digitalWrite(13, HIGH);
        delay(1000);
    }
    """
    assert is_c_code(arduino_code) is True

    # Δοκιμή ανίχνευσης κώδικα STM32
    stm32_code = """
    #include "main.h"
    int main(void) {
        HAL_Init();
        while (1) {
            HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);
            HAL_Delay(1000);
        }
    }
    """
    assert is_c_code(stm32_code) is True

    # Δοκιμή ανίχνευσης κανονικού κώδικα Python (δεν πρέπει να ανιχνευθεί ως C)
    python_code = """
    import time
    def main():
        print("Hello world")
        time.sleep(1)
    if __name__ == "__main__":
        main()
    """
    assert is_c_code(python_code) is False

# 2. Οριακή περίπτωση / Edge Case: Άδειος κώδικας ή μη ολοκληρωμένος κώδικας
def test_transpiler_edge_cases():
    # Δοκιμή με άδειο string
    assert is_c_code("") is False
    
    # Δοκιμή με κώδικα C χωρίς headers αλλά με braces και semicolons
    minimal_c = "int x = 5; { x = 6; }"
    assert is_c_code(minimal_c) is True
    
    # Μετάφραση απλού κώδικα C και έλεγχος αν αφαιρέθηκαν οι C τύποι
    transpiled = transpile_c_to_python("int ledPin = 13; float value = 1.23;")
    assert "ledPin = 13" in transpiled
    assert "value = 1.23" in transpiled
    assert "int ledPin" not in transpiled
    assert "float value" not in transpiled

# 3. Δοκιμή ορθής μετάφρασης και εκτέλεσης κώδικα Arduino
def test_transpile_and_execute_arduino():
    arduino_code = """
    int led_pin = 13;
    void setup() {
        pinMode(led_pin, OUTPUT);
    }
    void loop() {
        digitalWrite(led_pin, HIGH);
        delay(50);
        digitalWrite(led_pin, LOW);
        delay(50);
    }
    """
    
    # Μετάφραση σε Python
    python_code = transpile_c_to_python(arduino_code)
    
    # Έλεγχος των δομών στον παραγόμενο Python κώδικα
    assert "def setup():" in python_code
    assert "def loop():" in python_code
    assert "pinMode(led_pin, OUTPUT)" in python_code
    assert "digitalWrite(led_pin, HIGH)" in python_code
    
    # Δημιουργία περιβάλλοντος εκτέλεσης (Mocking GPIO)
    GPIO.setmode(GPIO.BCM)
    
    # Εκτέλεση του παραγόμενου κώδικα Python μέσω exec()
    # για να επαληθεύσουμε ότι είναι συντακτικά ορθός και τρέχει
    exec_scope = {}
    try:
        exec(python_code, exec_scope)
        # Καλούμε το setup()
        exec_scope["setup"]()
        # Καλούμε το loop()
        exec_scope["loop"]()
        
        # Το led_pin (GPIO 13) πρέπει να έχει ρυθμιστεί ως έξοδος
        # Στο mock RPi.GPIO, ελέγχουμε την κατάσταση
        # BCM pin 13 αντιστοιχεί στο BOARD pin 33
        state = GPIO.input(13)
        # Αφού στο loop() κάναμε digitalWrite(led_pin, LOW) τελευταίο, πρέπει να είναι LOW (0)
        assert state == 0
    except Exception as error:
        pytest.fail(f"Αποτυχία εκτέλεσης του transpiled κώδικα: {error}")

# 4. Δοκιμή ορθής μετάφρασης και εκτέλεσης κώδικα STM32 HAL
def test_transpile_and_execute_stm32():
    stm32_code = """
    #include "main.h"
    int led_pin = 5;
    int main(void) {
        HAL_Init();
        SystemClock_Config();
        MX_GPIO_Init();
        
        HAL_GPIO_WritePin(GPIOA, led_pin, GPIO_PIN_SET);
        HAL_Delay(10);
        HAL_GPIO_WritePin(GPIOA, led_pin, GPIO_PIN_RESET);
        HAL_Delay(10);
        return 0;
    }
    """
    
    # Μετάφραση σε Python
    python_code = transpile_c_to_python(stm32_code)
    
    # Έλεγχος των δομών
    assert "def main():" in python_code
    assert "HAL_Init()" in python_code
    assert "HAL_GPIO_WritePin(GPIOA, led_pin, GPIO_PIN_SET)" in python_code
    
    # Δημιουργία περιβάλλοντος εκτέλεσης
    GPIO.setmode(GPIO.BCM)
    
    exec_scope = {}
    try:
        exec(python_code, exec_scope)
        # Καλούμε τη main()
        exec_scope["main"]()
        
        # Το led_pin (GPIO 5) πρέπει να είναι LOW (0) στο τέλος της main()
        state = GPIO.input(5)
        assert state == 0
    except Exception as error:
        pytest.fail(f"Αποτυχία εκτέλεσης του transpiled stm32 κώδικα: {error}")

if __name__ == "__main__":
    pytest.main()
