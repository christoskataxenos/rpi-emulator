#nullable disable
using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;

namespace RpiEmulatorDesktop
{
    // Κλάση που αναπαριστά ένα καλώδιο (wire) στον καμβά σχεδίασης
    public class VisualWire : INotifyPropertyChanged
    {
        private string _state = "HIGH_Z";
        private Point _startPoint;
        private Point _endPoint;

        public event PropertyChangedEventHandler PropertyChanged;

        // Το όνομα του πρώτου εξαρτήματος (π.χ. "RPI", "LED1")
        public string FromComponent { get; }

        // Ο ακροδέκτης του πρώτου εξαρτήματος (π.χ. "pin17", "anode")
        public string FromTerminal { get; }

        // Το όνομα του δεύτερου εξαρτήματος
        public string ToComponent { get; }

        // Ο ακροδέκτης του δεύτερου εξαρτήματος (π.χ. "terminal_a")
        public string ToTerminal { get; }

        // Το χρώμα του καλωδίου σε Hex
        public string Color { get; }

        // Η λογική κατάσταση του καλωδίου (LOW, HIGH, HIGH_Z, ERROR)
        public string State
        {
            get => _state;
            set
            {
                if (_state != value)
                {
                    _state = value;
                    OnPropertyChanged();
                }
            }
        }

        // Το σημείο έναρξης της γραμμής στον καμβά
        public Point StartPoint
        {
            get => _startPoint;
            set
            {
                if (_startPoint != value)
                {
                    _startPoint = value;
                    OnPropertyChanged();
                }
            }
        }

        // Το σημείο τερματισμού της γραμμής στον καμβά
        public Point EndPoint
        {
            get => _endPoint;
            set
            {
                if (_endPoint != value)
                {
                    _endPoint = value;
                    OnPropertyChanged();
                }
            }
        }

        public VisualWire(string fromComp, string fromTerm, string toComp, string toTerm, string color)
        {
            FromComponent = fromComp;
            FromTerminal = fromTerm;
            ToComponent = toComp;
            ToTerminal = toTerm;
            Color = string.IsNullOrEmpty(color) ? "#FF0000" : color;
        }

        protected void OnPropertyChanged([CallerMemberName] string propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
