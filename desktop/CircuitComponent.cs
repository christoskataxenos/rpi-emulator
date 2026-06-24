#nullable disable
using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace RpiEmulatorDesktop
{
    // Κλάση που αναπαριστά ένα εξάρτημα του κυκλώματος (LED, Button, Buzzer, κλπ.)
    public class CircuitComponent : INotifyPropertyChanged
    {
        private string _state = "off"; // lit/off για LED, sounding/silent για Buzzer, pressed/released για Button
        private bool _isPressed = false;
        private bool _isMotionActive = false; // Για PIR: ανίχνευση κίνησης
        private double _sensorValue = 50.0;  // Γενική τιμή αισθητήρα (0-100) για LDR, POT, ULTRASONIC, DHT11
        private double _sensorValue2 = 50.0; // Δευτερεύουσα τιμή για DHT11 (υγρασία)
        private double _x = 200;
        private double _y = 100;

        public event PropertyChangedEventHandler PropertyChanged;

        // Το μοναδικό αναγνωριστικό του εξαρτήματος (π.χ. LED1, BTN1)
        public string Id { get; }

        // Ο τύπος του εξαρτήματος (LED, RESISTOR, BUTTON, BUZZER, κλπ.)
        public string Type { get; }

        // Οι ιδιότητες του εξαρτήματος (π.χ. αντίσταση, χρώμα)
        public System.Collections.Generic.Dictionary<string, object> Properties { get; }

        public CircuitComponent(string id, string type, System.Collections.Generic.Dictionary<string, object> properties)
        {
            Id = id;
            Type = type;
            Properties = properties ?? new System.Collections.Generic.Dictionary<string, object>();

            // Αρχικοποίηση συντεταγμένων από τις ιδιότητες του backend
            if (Properties.TryGetValue("x", out var xVal) && double.TryParse(xVal?.ToString(), out double x))
            {
                _x = x;
            }
            if (Properties.TryGetValue("y", out var yVal) && double.TryParse(yVal?.ToString(), out double y))
            {
                _y = y;
            }
        }

        // Συντεταγμένη X στον καμβά
        public double X
        {
            get => _x;
            set
            {
                if (Math.Abs(_x - value) > 0.01)
                {
                    _x = value;
                    OnPropertyChanged();
                }
            }
        }

        // Συντεταγμένη Y στον καμβά
        public double Y
        {
            get => _y;
            set
            {
                if (Math.Abs(_y - value) > 0.01)
                {
                    _y = value;
                    OnPropertyChanged();
                }
            }
        }

        // Η κατάσταση του εξαρτήματος
        public string State
        {
            get => _state;
            set
            {
                if (_state != value)
                {
                    _state = value;
                    OnPropertyChanged();
                    OnPropertyChanged(nameof(IsLit));
                    OnPropertyChanged(nameof(IsSounding));
                    OnPropertyChanged(nameof(DisplayState));
                }
            }
        }

        // Αν το κουμπί είναι πατημένο
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

        // Βοηθητική ιδιότητα: Αν το LED είναι αναμμένο
        public bool IsLit => Type == "LED" && State == "lit";

        // Βοηθητική ιδιότητα: Αν το buzzer παράγει ήχο
        public bool IsSounding => Type == "BUZZER" && State == "sounding";

        // PIR: Ενεργή ανίχνευση κίνησης
        public bool IsMotionActive
        {
            get => _isMotionActive;
            set
            {
                if (_isMotionActive != value)
                {
                    _isMotionActive = value;
                    OnPropertyChanged();
                    OnPropertyChanged(nameof(DisplayState));
                }
            }
        }

        // Γενική τιμή αισθητήρα (0-100): LDR φωτεινότητα, Potentiometer, Ultrasonic απόσταση, DHT11 θερμοκρασία
        public double SensorValue
        {
            get => _sensorValue;
            set
            {
                if (Math.Abs(_sensorValue - value) > 0.01)
                {
                    _sensorValue = value;
                    OnPropertyChanged();
                    OnPropertyChanged(nameof(DisplayState));
                }
            }
        }

        // Δευτερεύουσα τιμή αισθητήρα: Χρησιμοποιείται για DHT11 υγρασία (%)
        public double SensorValue2
        {
            get => _sensorValue2;
            set
            {
                if (Math.Abs(_sensorValue2 - value) > 0.01)
                {
                    _sensorValue2 = value;
                    OnPropertyChanged();
                    OnPropertyChanged(nameof(DisplayState));
                }
            }
        }

        // Το χρώμα του LED (προεπιλογή: Red αν δεν ορίζεται)
        public string LedColor
        {
            get
            {
                if (Properties != null && Properties.TryGetValue("color", out var colorVal))
                {
                    return colorVal?.ToString()?.ToLower() ?? "red";
                }
                return "red";
            }
        }

        // Λεκτική περιγραφή της κατάστασης για προβολή
        public string DisplayState
        {
            get
            {
                if (Type == "LED")
                {
                    string colorName = LedColor switch
                    {
                        "red"    => "Κόκκινο",
                        "green"  => "Πράσινο",
                        "yellow" => "Κίτρινο",
                        "blue"   => "Μπλε",
                        "white"  => "Λευκό",
                        "orange" => "Πορτοκαλί",
                        _        => LedColor
                    };
                    return $"{colorName} — {(State == "lit" ? "ΑΝΑΜΜΕΝΟ" : "ΣΒΗΣΤΟ")}";
                }
                if (Type == "BUZZER")
                    return State == "sounding" ? "ΗΧΕΙ" : "ΣΙΩΠΗΛΟ";
                if (Type == "BUTTON")
                    return IsPressed ? "ΠΑΤΗΜΕΝΟ" : "ΕΛΕΥΘΕΡΟ";
                if (Type == "RESISTOR")
                {
                    if (Properties != null && Properties.TryGetValue("resistance", out var resVal))
                        return $"{resVal} Ω";
                    return "Αντίσταση";
                }
                if (Type == "PIR")
                    return _isMotionActive ? "ΚΙΝΗΣΗ ΑΝΙΧΝΕΥΘΗΚΕ" : "Αναμένει...";
                if (Type == "LDR")
                    return $"Φωτεινότητα: {_sensorValue:F0}%";
                if (Type == "POTENTIOMETER")
                    return $"Θέση: {_sensorValue:F0}%";
                if (Type == "ULTRASONIC")
                {
                    // Η SensorValue είναι 0-100 → μετατρέπουμε σε cm (2-400)
                    double cm = 2.0 + (_sensorValue / 100.0) * 398.0;
                    return $"Απόσταση: {cm:F0} cm";
                }
                if (Type == "DHT11")
                    return $"Θερμ: {_sensorValue:F0}°C  Υγρ: {_sensorValue2:F0}%";
                return Type;
            }
        }

        protected void OnPropertyChanged([CallerMemberName] string propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
