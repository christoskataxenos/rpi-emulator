# Εισαγωγή των απαραίτητων βιβλιοθηκών
import re

# Ελέγχει αν το αρχείο περιέχει κώδικα C/C++
def is_c_code(code: str) -> bool:
    # Ανίχνευση λέξεων-κλειδιών και δομών C
    has_include = "#include" in code
    has_setup_loop = "void setup" in code or "void loop" in code
    has_main = "int main" in code
    has_braces = "{" in code and "}" in code and ";" in code
    return has_include or has_setup_loop or has_main or has_braces

# Μετατρέπει τον C κώδικα σε Python
def transpile_c_to_python(c_code: str) -> str:
    # 1. Καθαρισμός των σχολίων multiline /* ... */
    # Αντικαθιστούμε τα multiline σχόλια με κενό
    clean_code = re.sub(r"/\*.*?\*/", "", c_code, flags = re.DOTALL)
    
    # 2. Προετοιμασία των έτοιμων Python blocks για εισαγωγή στην αρχή του αρχείου
    py_header = """# -*- coding: utf-8 -*-
# Αυτόματο transpiled αρχείο από C++ σε Python
import RPi.GPIO as GPIO
import time
import urllib.request
import json

# Αρχικοποίηση GPIO
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

# Ορισμός σταθερών C σε Python
HIGH = 1
LOW = 0
OUTPUT = GPIO.OUT
INPUT = GPIO.IN
GPIO_PIN_SET = 1
GPIO_PIN_RESET = 0

GPIOA = "GPIOA"
GPIOB = "GPIOB"
GPIOC = "GPIOC"

GPIO_PIN_0 = 0
GPIO_PIN_1 = 1
GPIO_PIN_2 = 2
GPIO_PIN_3 = 3
GPIO_PIN_4 = 4
GPIO_PIN_5 = 5
GPIO_PIN_6 = 6
GPIO_PIN_7 = 7
GPIO_PIN_8 = 8
GPIO_PIN_9 = 9
GPIO_PIN_10 = 10
GPIO_PIN_11 = 11
GPIO_PIN_12 = 12
GPIO_PIN_13 = 13
GPIO_PIN_14 = 14
GPIO_PIN_15 = 15

# Βοηθητική μέθοδος για την ανάγνωση ιδιοτήτων εξαρτημάτων από το API
def _find_comp_properties(pin, comp_type):
    try:
        board_pin = GPIO._translate_pin(pin)
    except Exception:
        board_pin = GPIO.BCM_TO_BOARD.get(pin, pin)
    rpi_terminal = f"pin{board_pin}"
    try:
        req = urllib.request.Request("http://127.0.0.1:8000/api/circuit")
        with urllib.request.urlopen(req) as response:
            circuit_data = json.loads(response.read().decode("utf-8"))
    except Exception:
        return {}

    connected_comps = []
    for wire in circuit_data.get("wires", []):
        other_comp = None
        if wire["from_component"] == "RPI" and wire["from_terminal"] == rpi_terminal:
            other_comp = wire["to_component"]
        elif wire["to_component"] == "RPI" and wire["to_terminal"] == rpi_terminal:
            other_comp = wire["from_component"]
        if other_comp:
            connected_comps.append(other_comp)

    for comp in circuit_data.get("components", []):
        if comp["type"] == comp_type and comp["id"] in connected_comps:
            return comp.get("properties", {})
    return {}

# Arduino API shims
def pinMode(pin, mode):
    GPIO.setup(pin, mode)

def digitalWrite(pin, state):
    GPIO.output(pin, state)

def digitalRead(pin):
    return GPIO.input(pin)

def analogRead(pin):
    props_ldr = _find_comp_properties(pin, "LDR")
    if props_ldr:
        return int(float(props_ldr.get("light_intensity", 0)) * 10.23)
    props_pot = _find_comp_properties(pin, "POTENTIOMETER")
    if props_pot:
        return int(float(props_pot.get("value", 0)) * 1023)
    return 0

def delay(ms):
    time.sleep(ms / 1000.0)

class SerialClass:
    def begin(self, baud):
        pass
    def print(self, text):
        print(text, end="")
    def println(self, text):
        print(text)

Serial = SerialClass()

# STM32 API shims
def HAL_GPIO_WritePin(port, pin, state):
    GPIO.setup(pin, GPIO.OUT)
    GPIO.output(pin, state)

def HAL_GPIO_ReadPin(port, pin):
    GPIO.setup(pin, GPIO.IN)
    return GPIO.input(pin)

def HAL_Delay(ms):
    time.sleep(ms / 1000.0)

def HAL_Init():
    pass

def SystemClock_Config():
    pass

def MX_GPIO_Init():
    pass

"""
    
    # 3. Ανάλυση γραμμή-προς-γραμμή και μετατροπή δομών
    lines = clean_code.split("\n")
    py_lines = []
    
    indent_level = 0
    has_setup = False
    has_loop = False
    has_main = False
    
    for line in lines:
        stripped = line.strip()
        
        # Αφαίρεση C directives και βιβλιοθηκών
        if stripped.startswith("#include"):
            continue
            
        # Μετατροπή inline σχολίων // σε #
        if "//" in stripped:
            parts = stripped.split("//", 1)
            # Αν το σχόλιο δεν είναι μέσα σε string
            if '"' not in parts[0] or parts[0].count('"') % 2 == 0:
                stripped = parts[0].strip() + " # " + parts[1].strip()
                
        # Έλεγχος για άνοιγμα/κλείσιμο curly braces
        if stripped == "{":
            indent_level += 1
            continue
        elif stripped == "}":
            indent_level = max(0, indent_level - 1)
            continue
            
        # Αφαίρεση } στο τέλος γραμμής και { στο τέλος γραμμής
        is_closing = False
        if stripped.endswith("}"):
            is_closing = True
            stripped = stripped[:-1].strip()
            
        is_opening = False
        if stripped.endswith("{"):
            is_opening = True
            stripped = stripped[:-1].strip()
            
        # Μετάφραση C structures (if, else, while, for)
        # if (cond) -> if cond:
        stripped = re.sub(r"\bif\s*\((.*?)\)", r"if \1:", stripped)
        # else if (cond) -> elif cond:
        stripped = re.sub(r"\belse\s+if\s*\((.*?)\)", r"elif \1:", stripped)
        # else -> else:
        if stripped == "else":
            stripped = "else:"
            
        # while (cond) -> while cond:
        stripped = re.sub(r"\bwhile\s*\((.*?)\)", r"while \1:", stripped)
        
        # Για απλότητα, αντικαθιστούμε το while 1 ή while true σε while True:
        stripped = stripped.replace("while 1:", "while True:")
        stripped = stripped.replace("while true:", "while True:")
        
        # Αφαίρεση C τύπων δεδομένων από μεταβλητές
        # 1. Δηλώσεις με αρχικοποίηση (π.χ. int ledPin = 13;)
        stripped = re.sub(r"\b(int|float|double|char|bool|uint16_t|uint8_t|uint32_t|int32_t)\b\s+([a-zA-Z0-9_]+)\s*=\s*([^;]+)", r"\2 = \3", stripped)
        # 2. Δηλώσεις χωρίς αρχικοποίηση (π.χ. int sensorVal;)
        stripped = re.sub(r"\b(int|float|double|char|bool|uint16_t|uint8_t|uint32_t|int32_t)\b\s+([a-zA-Z0-9_]+)\s*;?$", r"\2 = 0", stripped)
        
        # Αφαίρεση του semicolon ; στο τέλος της γραμμής
        if stripped.endswith(";"):
            stripped = stripped[:-1].strip()
            
        # Αντικατάσταση boolean τιμών
        stripped = re.sub(r"\btrue\b", "True", stripped)
        stripped = re.sub(r"\bfalse\b", "False", stripped)
        stripped = re.sub(r"\bNULL\b", "None", stripped)
        
        # Μετατροπή πινάκων π.χ. int pins[] = {1, 2} -> pins = [1, 2]
        stripped = re.sub(r"\b(int|float|double|char|bool)\b\s+([a-zA-Z0-9_]+)\[\]\s*=\s*\{(.*?)\}", r"\2 = [\3]", stripped)
        
        # Μετάφραση ορισμών συναρτήσεων
        # void setup() -> def setup():
        if "void setup" in stripped:
            stripped = "def setup():"
            has_setup = True
        # void loop() -> def loop():
        elif "void loop" in stripped:
            stripped = "def loop():"
            has_loop = True
        # int main(...) -> def main():
        elif "int main" in stripped:
            stripped = "def main():"
            has_main = True
        # void function_name(...) -> def function_name(...):
        else:
            func_match = re.match(r"^\b(void|int|float|double|char|bool)\b\s+([a-zA-Z0-9_]+)\s*\((.*?)\)", stripped)
            if func_match:
                params = func_match.group(3)
                # Αφαίρεση τύπων από τις παραμέτρους
                # π.χ. int pin, int state -> pin, state
                cleaned_params = re.sub(r"\b(int|float|double|char|bool|uint16_t|uint8_t)\b\s+", "", params)
                stripped = f"def {func_match.group(2)}({cleaned_params}):"
                
        # Προσθήκη άνω-κάτω τελείας : αν ανοίγει block και δεν έχει μπει ήδη
        if is_opening and not stripped.endswith(":"):
            stripped += ":"
            
        # Προσθήκη της γραμμής με σωστή εσοχή
        if stripped:
            indent = "    " * indent_level
            py_lines.append(f"{indent}{stripped}")
            
        # Αν κλείνει block, μειώνουμε το level για την επόμενη γραμμή
        if is_closing:
            indent_level = max(0, indent_level - 1)
            
        if is_opening:
            indent_level += 1
            
    # Συνένωση των γραμμών σε τελικό κώδικα
    transpiled_code = py_header + "\n" + "\n".join(py_lines) + "\n\n"
    
    # 4. Προσθήκη του entry point ανάλογα με τον τύπο του C προγράμματος
    if has_main:
        transpiled_code += '''
if __name__ == "__main__":
    main()
'''
    elif has_setup or has_loop:
        transpiled_code += '''
if __name__ == "__main__":
    try:
        setup()
        while True:
            loop()
            time.sleep(0.01) # Αποφυγή 100% CPU usage
    except KeyboardInterrupt:
        pass
'''
    return transpiled_code
