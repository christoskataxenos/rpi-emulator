#nullable disable
using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace RpiEmulatorDesktop
{
    // Κλάση που αναπαριστά ένα pin του Raspberry Pi και υποστηρίζει την ενημέρωση του UI
    public class GpioPin : INotifyPropertyChanged
    {
        private string _mode = "INPUT";
        private string _state = "HIGH_Z";
        private bool _isPwm = false;
        private double _dutyCycle = 0.0;
        private double _frequency = 0.0;
        private bool _isPressed = false;

        public event PropertyChangedEventHandler PropertyChanged;

        // Ο αριθμός του pin (1-40)
        public int PinNumber { get; }

        // Το όνομα του pin (π.χ. GPIO 17, 3.3V, GND)
        public string Name { get; }

        // Ο τύπος του pin ("VCC3", "VCC5", "GND", "GPIO")
        public string Type { get; }

        // Συντεταγμένες για τη σχεδίαση των καλωδίων (κέντρο του node)
        public double CanvasX => 15 + 22.5 + ((PinNumber - 1) % 2) * 20;
        public double CanvasY => 20 + 32 + ((PinNumber - 1) / 2) * 16.2;

        // Συντεταγμένες για την τοποθέτηση του Ellipse στον καμβά (top-left)
        public double CanvasLeft => CanvasX - 4;
        public double CanvasTop => CanvasY - 4;

        // Κατασκευαστής της κλάσης GpioPin
        public GpioPin(int pinNumber, string name, string type)
        {
            PinNumber = pinNumber;
            Name = name;
            Type = type;

            // Αρχικοποίηση λειτουργίας για τα pins τροφοδοσίας και γείωσης
            if (Type == "VCC3" || Type == "VCC5" || Type == "GND")
            {
                _mode = Type;
                _state = Type == "GND" ? "LOW" : "HIGH";
            }
        }

        // Η λειτουργία του pin (INPUT, OUTPUT, VCC3, VCC5, GND)
        public string Mode
        {
            get => _mode;
            set
            {
                if (_mode != value)
                {
                    _mode = value;
                    OnPropertyChanged();
                    OnPropertyChanged(nameof(IsInput));
                    OnPropertyChanged(nameof(DisplayState));
                }
            }
        }

        // Η κατάσταση της λογικής τιμής του pin (LOW, HIGH, HIGH_Z, ERROR)
        public string State
        {
            get => _state;
            set
            {
                if (_state != value)
                {
                    _state = value;
                    OnPropertyChanged();
                    OnPropertyChanged(nameof(DisplayState));
                }
            }
        }

        // Αν το pin λειτουργεί με PWM (διαμόρφωση εύρους παλμού)
        public bool IsPwm
        {
            get => _isPwm;
            set
            {
                if (_isPwm != value)
                {
                    _isPwm = value;
                    OnPropertyChanged();
                    OnPropertyChanged(nameof(DisplayState));
                }
            }
        }

        // Ο κύκλος εργασίας (duty cycle) του PWM
        public double DutyCycle
        {
            get => _dutyCycle;
            set
            {
                if (Math.Abs(_dutyCycle - value) > 0.001)
                {
                    _dutyCycle = value;
                    OnPropertyChanged();
                    OnPropertyChanged(nameof(DisplayState));
                }
            }
        }

        // Η συχνότητα του PWM
        public double Frequency
        {
            get => _frequency;
            set
            {
                if (Math.Abs(_frequency - value) > 0.001)
                {
                    _frequency = value;
                    OnPropertyChanged();
                }
            }
        }

        // Αν το κουμπί προσομοίωσης εισόδου είναι πατημένο από τον χρήστη
        public bool IsPressed
        {
            get => _isPressed;
            set
            {
                if (_isPressed != value)
                {
                    _isPressed = value;
                    OnPropertyChanged();
                }
            }
        }

        // Επιστρέφει true αν το pin είναι ρυθμισμένο ως είσοδος (INPUT) ώστε να είναι διαδραστικό
        public bool IsInput => Mode == "INPUT";

        // Κείμενο για την προβολή της κατάστασης στο UI
        public string DisplayState
        {
            get
            {
                if (Type == "VCC3") return "3.3V";
                if (Type == "VCC5") return "5.0V";
                if (Type == "GND") return "GND";
                if (IsPwm) return $"PWM ({DutyCycle:F0}%)";
                if (State == "HIGH") return "1 (HIGH)";
                if (State == "LOW") return "0 (LOW)";
                return "HIGH_Z";
            }
        }

        // Μέθοδος ειδοποίησης αλλαγής ιδιότητας
        protected void OnPropertyChanged([CallerMemberName] string propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
