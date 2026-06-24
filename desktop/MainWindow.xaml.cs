#nullable disable
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Shapes;

namespace RpiEmulatorDesktop
{
    // Η κύρια κλάση του παραθύρου της εφαρμογής
    public partial class MainWindow : Window
    {
        private readonly HttpClient _httpClient = new HttpClient();
        private ClientWebSocket _webSocket;
        private Process _backendProcess;
        private string _activeSessionId;
        private CancellationTokenSource _wsCts;
        private bool _isExecuting = false;

        // Λίστες με τα pins για το UI Data Binding
        public ObservableCollection<GpioPin> OddPins { get; } = new ObservableCollection<GpioPin>();
        public ObservableCollection<GpioPin> EvenPins { get; } = new ObservableCollection<GpioPin>();
        public ObservableCollection<CircuitComponent> Components { get; } = new ObservableCollection<CircuitComponent>();
        public ObservableCollection<VisualWire> Wires { get; } = new ObservableCollection<VisualWire>();
        public List<GpioPin> AllPins => _pinsMap.Values.ToList();
        private readonly Dictionary<int, GpioPin> _pinsMap = new Dictionary<int, GpioPin>();

        // Μεταβλητές για Drag & Drop των εξαρτημάτων
        private bool _isDragging = false;
        private CircuitComponent _draggedComponent;
        private Point _dragStartPoint;
        private double _compDragStartX;
        private double _compDragStartY;

        // Μεταβλητές για Wiring (Σύνδεση καλωδίων)
        private bool _isWiring = false;
        private string _wireStartComponentId;
        private string _wireStartTerminalName;
        private Point _wireStartCanvasPoint;

        // Ορισμός των 40 pins του Raspberry Pi (Όνομα, Τύπος)
        private readonly (string Name, string Type)[] _pinDefinitions = new[]
        {
            ("3.3V", "VCC3"),    ("5V", "VCC5"),
            ("GPIO 2", "GPIO"),  ("5V", "VCC5"),
            ("GPIO 3", "GPIO"),  ("GND", "GND"),
            ("GPIO 4", "GPIO"),  ("GPIO 14", "GPIO"),
            ("GND", "GND"),     ("GPIO 15", "GPIO"),
            ("GPIO 17", "GPIO"), ("GPIO 18", "GPIO"),
            ("GPIO 27", "GPIO"), ("GND", "GND"),
            ("GPIO 22", "GPIO"), ("GPIO 23", "GPIO"),
            ("3.3V", "VCC3"),   ("GPIO 24", "GPIO"),
            ("GPIO 10", "GPIO"), ("GND", "GND"),
            ("GPIO 9", "GPIO"),  ("GPIO 25", "GPIO"),
            ("GPIO 11", "GPIO"), ("GPIO 8", "GPIO"),
            ("GND", "GND"),     ("GPIO 7", "GPIO"),
            ("GPIO 0", "GPIO"),  ("GPIO 1", "GPIO"),
            ("GPIO 5", "GPIO"),  ("GND", "GND"),
            ("GPIO 6", "GPIO"),  ("GPIO 12", "GPIO"),
            ("GPIO 13", "GPIO"), ("GND", "GND"),
            ("GPIO 19", "GPIO"), ("GPIO 16", "GPIO"),
            ("GPIO 26", "GPIO"), ("GPIO 20", "GPIO"),
            ("GND", "GND"),     ("GPIO 21", "GPIO")
        };

        public MainWindow()
        {
            InitializeComponent();
            InitializePins();

            // Σύνδεση των λιστών pins με τα στοιχεία ελέγχου του UI
            OddPinsControl.ItemsSource = OddPins;
            EvenPinsControl.ItemsSource = EvenPins;
            ComponentsListBox.ItemsSource = Components;
            WiresItemsControl.ItemsSource = Wires;
            PinsCanvasControl.ItemsSource = AllPins;
            ComponentsCanvasControl.ItemsSource = Components;

            // Εκκίνηση της ροής εργασίας (Backend -> Scenarios -> WebSocket)
            Loaded += MainWindow_Loaded;
            Closing += MainWindow_Closing;
        }

        // Αρχικοποίηση των 40 pins και διαχωρισμός σε Μονά/Ζυγά
        private void InitializePins()
        {
            for (int i = 1; i <= 40; i++)
            {
                var def = _pinDefinitions[i - 1];
                var pin = new GpioPin(i, def.Name, def.Type);
                _pinsMap[i] = pin;

                if (i % 2 == 1)
                {
                    OddPins.Add(pin);
                }
                else
                {
                    EvenPins.Add(pin);
                }
            }
        }

        // Event handler κατά τη φόρτωση του παραθύρου
        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            StartBackend();
            
            // Αναμονή μέχρι να είναι έτοιμος ο server
            bool isReady = await WaitForBackendReadyAsync(15, 1000);
            if (isReady)
            {
                AppendConsole("Το backend είναι έτοιμο. Φόρτωση σεναρίων...");
                await LoadScenariosAsync();
                StartWebSocketConnection();
            }
            else
            {
                AppendConsole("Σφάλμα: Δεν ήταν δυνατή η σύνδεση με το backend server.");
                MessageBox.Show("Αδυναμία σύνδεσης με το backend server. Παρακαλώ βεβαιωθείτε ότι η Python είναι εγκατεστημένη.", "Σφάλμα Σύνδεσης", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // Event handler κατά το κλείσιμο του παραθύρου
        private void MainWindow_Closing(object sender, CancelEventArgs e)
        {
            // Διακοπή λήψης WebSocket
            _wsCts?.Cancel();
            _webSocket?.Dispose();

            // Διακοπή τρέχουσας εκτέλεσης κώδικα
            if (_isExecuting && !string.IsNullOrEmpty(_activeSessionId))
            {
                // Σύγχρονη κλήση API για διακοπή
                try
                {
                    var task = _httpClient.PostAsync($"http://127.0.0.1:8000/api/execute/stop/{_activeSessionId}", null);
                    task.Wait(1000);
                }
                catch { }
            }

            // Τερματισμός της διεργασίας Python backend
            if (_backendProcess != null && !_backendProcess.HasExited)
            {
                try
                {
                    // Τερματισμός ολόκληρου του process tree
                    _backendProcess.Kill(true);
                }
                catch { }
            }
        }

        #region Διαχείριση Backend Process

        // Έλεγχος αν η θύρα (port) χρησιμοποιείται ήδη
        private bool IsPortInUse(int port)
        {
            try
            {
                using (var tcpClient = new TcpClient())
                {
                    var result = tcpClient.BeginConnect("127.0.0.1", port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(200));
                    if (success)
                    {
                        tcpClient.EndConnect(result);
                        return true;
                    }
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }

        // Εκκίνηση του Python Backend Server
        private void StartBackend()
        {
            if (IsPortInUse(8000))
            {
                AppendConsole("Ανιχνεύτηκε ήδη ενεργό backend στη θύρα 8000. Σύνδεση...");
                return;
            }

            AppendConsole("Εκκίνηση του Python backend server...");

            string workspaceRoot = GetWorkspaceRoot();
            string pythonPath = "python";

            // Έλεγχος αν υπάρχει το virtual environment του project
            string venvPath = System.IO.Path.Combine(workspaceRoot, ".venv", "Scripts", "python.exe");
            if (File.Exists(venvPath))
            {
                pythonPath = venvPath;
                AppendConsole($"Χρήση Virtual Environment: {venvPath}");
            }
            else
            {
                AppendConsole("Χρήση καθολικής εγκατάστασης Python.");
            }

            try
            {
                _backendProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = pythonPath,
                        Arguments = "backend/main.py",
                        WorkingDirectory = workspaceRoot,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    }
                };

                _backendProcess.OutputDataReceived += (s, e) =>
                {
                    if (e.Data != null)
                    {
                        // Φιλτράρισμα uvicorn logs για καθαρή κονσόλα
                        if (!e.Data.Contains("GET /api/websocket") && !e.Data.Contains("WebSocket connection"))
                        {
                            AppendConsole($"[Backend] {e.Data}");
                        }
                    }
                };

                _backendProcess.ErrorDataReceived += (s, e) =>
                {
                    if (e.Data != null)
                    {
                        AppendConsole($"[Backend Error] {e.Data}");
                    }
                };

                _backendProcess.Start();
                _backendProcess.BeginOutputReadLine();
                _backendProcess.BeginErrorReadLine();
            }
            catch (Exception ex)
            {
                AppendConsole($"Σφάλμα κατά την εκκίνηση της Python: {ex.Message}");
            }
        }

        // Ανίχνευση του φακέλου εργασίας (Workspace Root)
        private string GetWorkspaceRoot()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            if (baseDir.Contains("bin"))
            {
                return System.IO.Path.GetFullPath(System.IO.Path.Combine(baseDir, "..", "..", "..", ".."));
            }
            return System.IO.Path.GetFullPath(System.IO.Path.Combine(baseDir, ".."));
        }

        // Αναμονή μέχρι να είναι προσβάσιμο το backend API
        private async Task<bool> WaitForBackendReadyAsync(int retries, int delayMs)
        {
            for (int i = 0; i < retries; i++)
            {
                try
                {
                    var response = await _httpClient.GetAsync("http://127.0.0.1:8000/api/scenarios");
                    if (response.IsSuccessStatusCode)
                    {
                        return true;
                    }
                }
                catch
                {
                    // Παράλειψη σφαλμάτων σύνδεσης κατά την εκκίνηση
                }
                await Task.Delay(delayMs);
            }
            return false;
        }

        #endregion

        #region REST API Κλήσεις (Σενάρια & Κυκλώματα)

        // Φόρτωση των διαθέσιμων σεναρίων από το API
        private async Task LoadScenariosAsync()
        {
            try
            {
                var response = await _httpClient.GetStringAsync("http://127.0.0.1:8000/api/scenarios");
                var scenarios = JsonSerializer.Deserialize<List<ScenarioItem>>(response, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                
                Dispatcher.Invoke(() =>
                {
                    ScenariosListBox.ItemsSource = scenarios;
                });
            }
            catch (Exception ex)
            {
                AppendConsole($"Αποτυχία λήψης σεναρίων: {ex.Message}");
            }
        }

        // Event handler κατά την αλλαγή επιλεγμένου σεναρίου
        private async void ScenariosListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (ScenariosListBox.SelectedItem is ScenarioItem selected)
            {
                AppendConsole($"Φόρτωση σεναρίου: {selected.Title}");
                await LoadScenarioDetailsAsync(selected.Id);
            }
        }

        // Φόρτωση των λεπτομερειών ενός σεναρίου (README, Κώδικας, Κύκλωμα)
        private async Task LoadScenarioDetailsAsync(string scenarioId)
        {
            try
            {
                // 1. Φόρτωση README.md
                try
                {
                    string readme = await _httpClient.GetStringAsync($"http://127.0.0.1:8000/scenarios/{scenarioId}/README.md");
                    ScenarioReadmeText.Text = readme;
                }
                catch
                {
                    ScenarioReadmeText.Text = "Δεν βρέθηκε αρχείο README.md για αυτό το σενάριο.";
                }

                // 2. Φόρτωση starter.py κώδικα
                try
                {
                    string code = await _httpClient.GetStringAsync($"http://127.0.0.1:8000/scenarios/{scenarioId}/starter.py");
                    CodeEditor.Text = code;
                }
                catch
                {
                    CodeEditor.Text = "";
                }

                // 3. Φόρτωση κυκλώματος (circuit.json) και αποστολή στο backend
                try
                {
                    string circuitJson = await _httpClient.GetStringAsync($"http://127.0.0.1:8000/scenarios/{scenarioId}/circuit.json");
                    using (JsonDocument doc = JsonDocument.Parse(circuitJson))
                    {
                        var root = doc.RootElement;
                        var components = root.GetProperty("components");
                        
                        // Προετοιμασία των components φιλτράροντας το RPI
                        var componentsPayload = new List<object>();
                        foreach (var comp in components.EnumerateArray())
                        {
                            string id = comp.GetProperty("id").GetString();
                            if (id == "RPI") continue;

                            string type = comp.GetProperty("type").GetString();
                            var properties = comp.TryGetProperty("properties", out var propVal) ? propVal : (object)new Dictionary<string, object>();

                            componentsPayload.Add(new { id, type, properties });
                        }

                        var wires = root.GetProperty("wires");

                        var payload = new
                        {
                            components = componentsPayload,
                            wires
                        };

                        string requestBody = JsonSerializer.Serialize(payload);
                        var content = new StringContent(requestBody, Encoding.UTF8, "application/json");
                        var response = await _httpClient.PostAsync("http://127.0.0.1:8000/api/circuit/load", content);
                        
                        if (!response.IsSuccessStatusCode)
                        {
                            AppendConsole("Σφάλμα κατά τη φόρτωση του κυκλώματος στο backend.");
                        }
                    }
                }
                catch (Exception ex)
                {
                    AppendConsole($"Σημείωση: Δεν φορτώθηκε κύκλωμα για το σενάριο: {ex.Message}");
                }
            }
            catch (Exception ex)
            {
                AppendConsole($"Σφάλμα κατά τη φόρτωση λεπτομερειών σεναρίου: {ex.Message}");
            }
        }

        #endregion

        #region WebSocket Επικοινωνία

        // Εκκίνηση σύνδεσης WebSocket για real-time ενημερώσεις
        private void StartWebSocketConnection()
        {
            _wsCts = new CancellationTokenSource();
            Task.Run(() => ReceiveWebSocketDataAsync(_wsCts.Token));
        }

        // Ασύγχρονη λήψη δεδομένων μέσω WebSocket
        private async Task ReceiveWebSocketDataAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    _webSocket = new ClientWebSocket();
                    AppendConsole("Σύνδεση με το WebSocket του εξομοιωτή...");
                    await _webSocket.ConnectAsync(new Uri("ws://127.0.0.1:8000/api/websocket"), token);
                    AppendConsole("WebSocket: Συνδέθηκε με επιτυχία!");

                    byte[] buffer = new byte[8192];
                    while (_webSocket.State == WebSocketState.Open && !token.IsCancellationRequested)
                    {
                        var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", token);
                            break;
                        }

                        string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        ParseWebSocketMessage(message);
                    }
                }
                catch (Exception ex)
                {
                    if (!token.IsCancellationRequested)
                    {
                        AppendConsole($"WebSocket Αποσύνδεση / Σφάλμα: {ex.Message}. Επανασύνδεση σε 3 δευτερόλεπτα...");
                        await Task.Delay(3000, token);
                    }
                }
            }
        }

        // Επεξεργασία μηνύματος WebSocket
        private void ParseWebSocketMessage(string jsonStr)
        {
            try
            {
                using (JsonDocument doc = JsonDocument.Parse(jsonStr))
                {
                    var root = doc.RootElement;
                    string type = root.GetProperty("type").GetString();

                    switch (type)
                    {
                        case "init":
                            var pins = root.GetProperty("pins");
                            foreach (var pinObj in pins.EnumerateArray())
                            {
                                int pinNumber = pinObj.GetProperty("pin_number").GetInt32();
                                string mode = pinObj.GetProperty("mode").GetString();
                                string state = ParseJsonState(pinObj.GetProperty("state"));
                                bool isPwm = pinObj.GetProperty("is_pwm").GetBoolean();
                                double dutyCycle = pinObj.GetProperty("pwm_duty_cycle").GetDouble();
                                double freq = pinObj.GetProperty("pwm_frequency").GetDouble();

                                UpdatePinProperties(pinNumber, mode, state, isPwm, dutyCycle, freq);
                            }
                            if (root.TryGetProperty("circuit", out var initCircuit))
                            {
                                UpdateCircuitComponents(initCircuit);
                            }
                            break;

                        case "circuit_change":
                            if (root.TryGetProperty("circuit", out var changeCircuit))
                            {
                                UpdateCircuitComponents(changeCircuit);
                            }
                            if (root.TryGetProperty("solve_results", out var changeSolve))
                            {
                                UpdateCircuitSolved(changeSolve);
                            }
                            break;

                        case "circuit_solved":
                            if (root.TryGetProperty("data", out var solveData))
                            {
                                UpdateCircuitSolved(solveData);
                            }
                            break;

                        case "gpio_setup":
                            int setupPinNum = root.GetProperty("pin_number").GetInt32();
                            string setupMode = root.GetProperty("mode").GetString();
                            UpdatePinProperties(setupPinNum, setupMode, null, null, null, null);
                            break;

                        case "gpio_state_change":
                            int changePinNum = root.GetProperty("pin_number").GetInt32();
                            string changeState = ParseJsonState(root.GetProperty("state"));
                            UpdatePinProperties(changePinNum, null, changeState, null, null, null);
                            break;

                        case "gpio_pwm":
                            int pwmPinNum = root.GetProperty("pin_number").GetInt32();
                            bool isPinPwm = root.GetProperty("is_pwm").GetBoolean();
                            double duty = root.GetProperty("duty_cycle").GetDouble();
                            double frequency = root.GetProperty("frequency").GetDouble();
                            UpdatePinProperties(pwmPinNum, null, null, isPinPwm, duty, frequency);
                            break;

                        case "gpio_cleanup":
                            foreach (var pin in _pinsMap.Values)
                            {
                                if (pin.Type == "GPIO")
                                {
                                    pin.Mode = "INPUT";
                                    pin.State = "HIGH_Z";
                                    pin.IsPwm = false;
                                    pin.DutyCycle = 0.0;
                                    pin.Frequency = 0.0;
                                }
                            }
                            break;

                        case "console_log":
                            string text = root.GetProperty("text").GetString();
                            AppendConsole(text, false);
                            break;

                        case "execution_finished":
                            int exitCode = root.GetProperty("exit_code").GetInt32();
                            AppendConsole($"\n[System] Ο κώδικας τερμάτισε με κωδικό εξόδου: {exitCode}");
                            SetExecutionState(false);
                            break;
                    }
                }
            }
            catch (Exception ex)
            {
                // Σφάλμα επεξεργασίας JSON
                Debug.WriteLine($"JSON Parse Error: {ex.Message}");
            }
        }

        // Βοηθητική μέθοδος για την ανάγνωση της κατάστασης (State) από το JSON
        private string ParseJsonState(JsonElement stateElement)
        {
            if (stateElement.ValueKind == JsonValueKind.Number)
            {
                int val = stateElement.GetInt32();
                return val switch
                {
                    0 => "LOW",
                    1 => "HIGH",
                    2 => "HIGH_Z",
                    _ => "ERROR"
                };
            }
            return stateElement.GetString();
        }

        // Ενημέρωση των ιδιοτήτων ενός Pin με ασφάλεια νημάτων (thread-safe)
        private void UpdatePinProperties(int pinNumber, string mode, string state, bool? isPwm, double? duty, double? freq)
        {
            if (_pinsMap.TryGetValue(pinNumber, out var pin))
            {
                Dispatcher.Invoke(() =>
                {
                    if (mode != null) pin.Mode = mode;
                    if (state != null) pin.State = state;
                    if (isPwm.HasValue) pin.IsPwm = isPwm.Value;
                    if (duty.HasValue) pin.DutyCycle = duty.Value;
                    if (freq.HasValue) pin.Frequency = freq.Value;

                    RecalculateWireStates();
                });
            }
        }

        #endregion

        #region Λογική Εκτέλεσης Κώδικα (Run / Stop)

        // Event handler για το πάτημα του κουμπιού Run
        private async void RunButton_Click(object sender, RoutedEventArgs e)
        {
            if (_isExecuting) return;

            string code = CodeEditor.Text;
            if (string.IsNullOrWhiteSpace(code))
            {
                MessageBox.Show("Παρακαλώ εισάγετε κώδικα Python για εκτέλεση.", "Κενός Κώδικας", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            ConsoleOutput.Clear();
            AppendConsole("[System] Έναρξη εκτέλεσης κώδικα...");
            SetExecutionState(true);

            try
            {
                var payload = new { code };
                string jsonBody = JsonSerializer.Serialize(payload);
                var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("http://127.0.0.1:8000/api/execute", content);
                if (response.IsSuccessStatusCode)
                {
                    var responseStr = await response.Content.ReadAsStringAsync();
                    using (JsonDocument doc = JsonDocument.Parse(responseStr))
                    {
                        _activeSessionId = doc.RootElement.GetProperty("session_id").GetString();
                    }
                }
                else
                {
                    AppendConsole("[System Error] Αποτυχία αποστολής κώδικα για εκτέλεση.");
                    SetExecutionState(false);
                }
            }
            catch (Exception ex)
            {
                AppendConsole($"[System Error] Σφάλμα επικοινωνίας: {ex.Message}");
                SetExecutionState(false);
            }
        }

        // Event handler για το πάτημα του κουμπιού Stop
        private async void StopButton_Click(object sender, RoutedEventArgs e)
        {
            if (!_isExecuting || string.IsNullOrEmpty(_activeSessionId)) return;

            AppendConsole("[System] Αίτημα διακοπής εκτέλεσης...");
            StopButton.IsEnabled = false;

            try
            {
                var response = await _httpClient.PostAsync($"http://127.0.0.1:8000/api/execute/stop/{_activeSessionId}", null);
                if (!response.IsSuccessStatusCode)
                {
                    AppendConsole("[System Error] Αποτυχία αποστολής εντολής διακοπής.");
                    StopButton.IsEnabled = true;
                }
            }
            catch (Exception ex)
            {
                AppendConsole($"[System Error] Σφάλμα κατά τη διακοπή: {ex.Message}");
                StopButton.IsEnabled = true;
            }
        }

        // Ορισμός κατάστασης εκτέλεσης και ενημέρωση των στοιχείων του UI
        private void SetExecutionState(bool executing)
        {
            _isExecuting = executing;
            Dispatcher.Invoke(() =>
            {
                RunButton.IsEnabled = !executing;
                StopButton.IsEnabled = executing;
                StatusLabel.Text = executing ? "Κατάσταση: Εκτελείται..." : "Κατάσταση: Έτοιμο";
            });
        }

        #endregion

        #region Προσομοίωση Εισόδων (Button Press)

        // Event handler όταν πατηθεί το κουμπί προσομοίωσης εισόδου ενός Pin (Mouse Down)
        private async void InputButton_PreviewMouseDown(object sender, MouseButtonEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is GpioPin pin)
            {
                pin.IsPressed = true;
                await SendSimulationInputAsync(pin.PinNumber, true);
            }
        }

        // Event handler όταν απελευθερωθεί το κουμπί προσομοίωσης εισόδου ενός Pin (Mouse Up)
        private async void InputButton_PreviewMouseUp(object sender, MouseButtonEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is GpioPin pin)
            {
                pin.IsPressed = false;
                await SendSimulationInputAsync(pin.PinNumber, false);
            }
        }

        // Event handler όταν πατηθεί το κουμπί προσομοίωσης εισόδου ενός εξαρτήματος (Mouse Down)
        private async void CompButton_PreviewMouseDown(object sender, MouseButtonEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is CircuitComponent comp)
            {
                comp.IsPressed = true;
                await SendSimulationInputAsync(0, true, comp.Id);
            }
        }

        // Event handler όταν απελευθερωθεί το κουμπί προσομοίωσης εισόδου ενός εξαρτήματος (Mouse Up)
        private async void CompButton_PreviewMouseUp(object sender, MouseButtonEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is CircuitComponent comp)
            {
                comp.IsPressed = false;
                await SendSimulationInputAsync(0, false, comp.Id);
            }
        }

        // Αποστολή αιτήματος προσομοίωσης εισόδου στο backend API
        private async Task SendSimulationInputAsync(int pinNumber, bool pressed, string componentId = "RPI")
        {
            try
            {
                object payload;
                if (componentId == "RPI")
                {
                    payload = new
                    {
                        pin = pinNumber,
                        pressed = pressed,
                        component_id = "RPI"
                    };
                }
                else
                {
                    payload = new
                    {
                        pressed = pressed,
                        component_id = componentId
                    };
                }

                string requestBody = JsonSerializer.Serialize(payload);
                var content = new StringContent(requestBody, Encoding.UTF8, "application/json");
                
                await _httpClient.PostAsync("http://127.0.0.1:8000/api/simulator/input", content);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error sending input simulation: {ex.Message}");
            }
        }

        #endregion

        #region Διαχείριση Εξαρτημάτων Κυκλώματος (Sync)

        // Ενημέρωση της λίστας εξαρτημάτων και των καλωδίων από τα δεδομένα κυκλώματος του backend
        private void UpdateCircuitComponents(JsonElement circuitElement)
        {
            if (circuitElement.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            Dispatcher.Invoke(() =>
            {
                var selectedItem = ComponentsListBox.SelectedItem as CircuitComponent;

                Components.Clear();

                if (circuitElement.TryGetProperty("components", out var componentsArray))
                {
                    foreach (var compObj in componentsArray.EnumerateArray())
                    {
                        string id = compObj.GetProperty("id").GetString();
                        if (id == "RPI")
                        {
                            continue;
                        }

                        string type = compObj.GetProperty("type").GetString();

                        var properties = new Dictionary<string, object>();
                        if (compObj.TryGetProperty("properties", out var propsElement))
                        {
                            foreach (var prop in propsElement.EnumerateObject())
                            {
                                if (prop.Value.ValueKind == JsonValueKind.String)
                                {
                                    properties[prop.Name] = prop.Value.GetString();
                                }
                                else if (prop.Value.ValueKind == JsonValueKind.Number)
                                {
                                    properties[prop.Name] = prop.Value.GetDouble();
                                }
                                else if (prop.Value.ValueKind == JsonValueKind.True || prop.Value.ValueKind == JsonValueKind.False)
                                {
                                    properties[prop.Name] = prop.Value.GetBoolean();
                                }
                            }
                        }

                        var comp = new CircuitComponent(id, type, properties);
                        Components.Add(comp);
                    }
                }

                if (selectedItem != null)
                {
                    var match = Components.FirstOrDefault(c => c.Id == selectedItem.Id);
                    if (match != null)
                    {
                        ComponentsListBox.SelectedItem = match;
                    }
                }

                // Φόρτωση των καλωδίων (wires) από το backend
                Wires.Clear();
                if (circuitElement.TryGetProperty("wires", out var wiresArray))
                {
                    foreach (var wireObj in wiresArray.EnumerateArray())
                    {
                        string fromComp = wireObj.GetProperty("from_component").GetString();
                        string fromTerm = wireObj.GetProperty("from_terminal").GetString();
                        string toComp = wireObj.GetProperty("to_component").GetString();
                        string toTerm = wireObj.GetProperty("to_terminal").GetString();
                        string color = wireObj.TryGetProperty("color", out var colVal) ? colVal.GetString() : "#FFCC00";
                        string state = wireObj.TryGetProperty("state", out var stVal) ? stVal.GetString() : "HIGH_Z";

                        var wire = new VisualWire(fromComp, fromTerm, toComp, toTerm, color)
                        {
                            State = state
                        };

                        // Υπολογισμός των θέσεων έναρξης και λήξης στον καμβά
                        wire.StartPoint = GetNodePosition(fromComp, fromTerm);
                        wire.EndPoint = GetNodePosition(toComp, toTerm);
                        Wires.Add(wire);
                    }
                }

                // Επανυπολογισμός των λογικών καταστάσεων των καλωδίων
                RecalculateWireStates();
            });
        }

        // Ενημέρωση των καταστάσεων των εξαρτημάτων (π.χ. lit/sounding) και των warnings
        private void UpdateCircuitSolved(JsonElement solveElement)
        {
            Dispatcher.Invoke(() =>
            {
                if (solveElement.TryGetProperty("component_states", out var statesObj))
                {
                    foreach (var stateProp in statesObj.EnumerateObject())
                    {
                        string compId = stateProp.Name;
                        string compState = stateProp.Value.GetString();

                        var comp = Components.FirstOrDefault(c => c.Id == compId);
                        if (comp != null)
                        {
                            comp.State = compState;
                            if (comp.Type == "BUTTON")
                            {
                                comp.IsPressed = compState == "pressed";
                            }
                        }
                    }
                }

                if (solveElement.TryGetProperty("warnings", out var warningsArray) && warningsArray.GetArrayLength() > 0)
                {
                    var firstWarning = warningsArray[0];
                    string msg = firstWarning.GetProperty("message").GetString();
                    WarningText.Text = msg;
                    WarningBanner.Visibility = Visibility.Visible;
                }
                else
                {
                    WarningBanner.Visibility = Visibility.Collapsed;
                }

                // Επανυπολογισμός των λογικών καταστάσεων των καλωδίων μετά την επίλυση
                RecalculateWireStates();
            });
        }

        #endregion

        #region Διαδραστικός Καμβάς Σχεδίασης (Canvas Interactivity)

        // Υπολογισμός της συντεταγμένης ενός ακροδέκτη στον καμβά
        private Point GetNodePosition(string componentId, string terminalName)
        {
            if (componentId == "RPI")
            {
                // Αν είναι pin του RPi, το terminalName είναι της μορφής "pinX" (π.χ. "pin17")
                string pinStr = terminalName.Replace("pin", "");
                if (int.TryParse(pinStr, out int pinNum))
                {
                    if (_pinsMap.TryGetValue(pinNum, out var pin))
                    {
                        return new Point(pin.CanvasX, pin.CanvasY);
                    }
                }
                return new Point(0, 0);
            }
            else
            {
                // Αν είναι κοινό εξάρτημα, βρίσκουμε το εξάρτημα στον καμβά
                var comp = Components.FirstOrDefault(c => c.Id == componentId);
                if (comp == null)
                {
                    return new Point(0, 0);
                }

                // Καθορισμός offset με βάση την αριστερή/δεξιά πλευρά του εξαρτήματος
                bool isLeftTerminal = terminalName == "anode" || terminalName == "terminal_a" || terminalName == "positive" || terminalName == "left";
                
                double offsetX = isLeftTerminal ? 10 : 50;
                double offsetY = 20;

                return new Point(comp.X + offsetX, comp.Y + offsetY);
            }
        }

        // Υπολογισμός και ενημέρωση της κατάστασης των Wires (HIGH, LOW, HIGH_Z, ERROR) με BFS/DFS
        private void RecalculateWireStates()
        {
            if (Wires.Count == 0)
            {
                return;
            }

            // 1. Δημιουργία Adjacency list για τους συνδεδεμένους ακροδέκτες
            var adj = new Dictionary<string, List<(string Target, VisualWire Wire)>>();
            
            foreach (var wire in Wires)
            {
                string refA = $"{wire.FromComponent}.{wire.FromTerminal}";
                string refB = $"{wire.ToComponent}.{wire.ToTerminal}";

                if (!adj.ContainsKey(refA))
                {
                    adj[refA] = new List<(string, VisualWire)>();
                }
                if (!adj.ContainsKey(refB))
                {
                    adj[refB] = new List<(string, VisualWire)>();
                }

                adj[refA].Add((refB, wire));
                adj[refB].Add((refA, wire));
            }

            // 2. Εύρεση συνεκτικών συνιστωσών (Connected Components)
            var visited = new HashSet<string>();
            foreach (var startNode in adj.Keys)
            {
                if (visited.Contains(startNode))
                {
                    continue;
                }

                var componentNodes = new List<string>();
                var componentWires = new List<VisualWire>();
                var queue = new Queue<string>();
                queue.Enqueue(startNode);
                visited.Add(startNode);

                while (queue.Count > 0)
                {
                    var curr = queue.Dequeue();
                    componentNodes.Add(curr);

                    foreach (var edge in adj[curr])
                    {
                        if (!componentWires.Contains(edge.Wire))
                        {
                            componentWires.Add(edge.Wire);
                        }
                        if (!visited.Contains(edge.Target))
                        {
                            visited.Add(edge.Target);
                            queue.Enqueue(edge.Target);
                        }
                    }
                }

                // 3. Καθορισμός της κατάστασης του κόμβου με βάση τα pins που περιέχει
                string resolvedState = "HIGH_Z";
                var drivingStates = new List<string>();

                foreach (var nodeRef in componentNodes)
                {
                    if (nodeRef.StartsWith("RPI.pin"))
                    {
                        string pinStr = nodeRef.Substring(7);
                        if (int.TryParse(pinStr, out int pinNum))
                        {
                            // Έλεγχος σταθερών pins (VCC/GND)
                            var gndPins = new HashSet<int> { 6, 9, 14, 20, 25, 30, 34, 39 };
                            var fiveVPins = new HashSet<int> { 2, 4 };
                            var threeVPins = new HashSet<int> { 1, 17 };

                            if (gndPins.Contains(pinNum))
                            {
                                drivingStates.Add("LOW");
                            }
                            else if (fiveVPins.Contains(pinNum) || threeVPins.Contains(pinNum))
                            {
                                drivingStates.Add("HIGH");
                            }
                            else if (_pinsMap.TryGetValue(pinNum, out var pin))
                            {
                                // Αν είναι GPIO, ελέγχουμε την κατάστασή του
                                if (pin.Mode == "OUTPUT")
                                {
                                    drivingStates.Add(pin.State);
                                }
                                else if (pin.Mode == "INPUT" && pin.State != "HIGH_Z")
                                {
                                    drivingStates.Add(pin.State);
                                }
                            }
                        }
                    }
                }

                // Επίλυση κατάστασης:
                bool hasHigh = drivingStates.Contains("HIGH");
                bool hasLow = drivingStates.Contains("LOW");
                bool hasError = drivingStates.Contains("ERROR");

                if (hasError || (hasHigh && hasLow))
                {
                    resolvedState = "ERROR";
                }
                else if (hasHigh)
                {
                    resolvedState = "HIGH";
                }
                else if (hasLow)
                {
                    resolvedState = "LOW";
                }
                else
                {
                    resolvedState = "HIGH_Z";
                }

                // 4. Ενημέρωση των καλωδίων αυτού του κόμβου
                foreach (var wire in componentWires)
                {
                    wire.State = resolvedState;
                }
            }
        }

        // Event Handler: MouseDown πάνω σε εξάρτημα για Dragging
        private void Component_MouseDown(object sender, MouseButtonEventArgs e)
        {
            // Αν το κλικ έγινε σε Button (π.χ. "Press") ή Ellipse (ακροδέκτης), αφήνουμε το event να συνεχίσει
            if (e.OriginalSource is Button || e.OriginalSource is Ellipse)
                return;

            if (sender is Border border && border.DataContext is CircuitComponent comp)
            {
                e.Handled = true;
                _isDragging = true;
                _draggedComponent = comp;
                _dragStartPoint = e.GetPosition(DesignCanvas);
                _compDragStartX = comp.X;
                _compDragStartY = comp.Y;
                border.CaptureMouse();
            }
        }

        // Event Handler: MouseMove πάνω σε εξάρτημα για Dragging
        private void Component_MouseMove(object sender, MouseEventArgs e)
        {
            if (_isDragging && _draggedComponent != null && e.LeftButton == MouseButtonState.Pressed)
            {
                Point mousePos = e.GetPosition(DesignCanvas);
                double newX = _compDragStartX + (mousePos.X - _dragStartPoint.X);
                double newY = _compDragStartY + (mousePos.Y - _dragStartPoint.Y);

                // Περιορισμός εντός ορίων καμβά
                newX = Math.Max(0, Math.Min(DesignCanvas.ActualWidth - 60, newX));
                newY = Math.Max(0, Math.Min(DesignCanvas.ActualHeight - 40, newY));

                _draggedComponent.X = newX;
                _draggedComponent.Y = newY;

                // Ενημέρωση των καλωδίων που συνδέονται με αυτό το εξάρτημα
                foreach (var wire in Wires)
                {
                    if (wire.FromComponent == _draggedComponent.Id)
                    {
                        wire.StartPoint = GetNodePosition(wire.FromComponent, wire.FromTerminal);
                    }
                    if (wire.ToComponent == _draggedComponent.Id)
                    {
                        wire.EndPoint = GetNodePosition(wire.ToComponent, wire.ToTerminal);
                    }
                }
            }
        }

        // Event Handler: MouseUp μετά το Dragging εξαρτήματος
        private async void Component_MouseUp(object sender, MouseButtonEventArgs e)
        {
            if (_isDragging && _draggedComponent != null)
            {
                if (sender is UIElement el)
                {
                    el.ReleaseMouseCapture();
                }
                _isDragging = false;
                await SaveComponentPropertiesAsync(_draggedComponent);
                _draggedComponent = null;
            }
        }

        // Αποστολή των συντεταγμένων X/Y στο backend API για αποθήκευση
        private async Task SaveComponentPropertiesAsync(CircuitComponent comp)
        {
            try
            {
                var props = new Dictionary<string, object>(comp.Properties)
                {
                    ["x"] = comp.X,
                    ["y"] = comp.Y
                };
                string requestBody = JsonSerializer.Serialize(props);
                var content = new StringContent(requestBody, Encoding.UTF8, "application/json");
                await _httpClient.PutAsync($"http://127.0.0.1:8000/api/circuit/component/{comp.Id}/properties", content);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error saving component coordinates: {ex.Message}");
            }
        }

        // Event Handler: MouseDown στο Canvas (Ακύρωση Wiring)
        private void DesignCanvas_MouseDown(object sender, MouseButtonEventArgs e)
        {
            if (_isWiring)
            {
                CancelWiring();
            }
        }

        // Event Handler: MouseMove στο Canvas (Σχεδίαση προσωρινού καλωδίου)
        private void DesignCanvas_MouseMove(object sender, MouseEventArgs e)
        {
            if (_isWiring)
            {
                Point mousePos = e.GetPosition(DesignCanvas);
                TempWireLine.X2 = mousePos.X;
                TempWireLine.Y2 = mousePos.Y;
            }
        }

        // Event Handler: MouseUp στο Canvas
        private void DesignCanvas_MouseUp(object sender, MouseButtonEventArgs e)
        {
            // Προαιρετικό
        }

        // Ακύρωση της σχεδίασης καλωδίου
        private void CancelWiring()
        {
            _isWiring = false;
            TempWireLine.Visibility = Visibility.Collapsed;
            _wireStartComponentId = null;
            _wireStartTerminalName = null;
        }

        // Event Handler: Click σε ακροδέκτη εξαρτήματος ή pin του RPi
        private void TerminalNode_MouseDown(object sender, MouseButtonEventArgs e)
        {
            e.Handled = true; // Αποφυγή drag/drop του εξαρτήματος
            
            if (sender is Ellipse ellipse)
            {
                string componentId = null;
                string terminalName = null;
                Point anchorPos = new Point(0, 0);

                if (ellipse.DataContext is CircuitComponent comp)
                {
                    // Click σε ακροδέκτη εξαρτήματος
                    string side = ellipse.Tag?.ToString(); // "left" ή "right"
                    componentId = comp.Id;
                    terminalName = MapTerminalSideToName(comp.Type, side);
                    anchorPos = GetNodePosition(componentId, terminalName);
                }
                else if (ellipse.Tag is int pinNum)
                {
                    // Click σε RPi pin
                    componentId = "RPI";
                    terminalName = $"pin{pinNum}";
                    if (_pinsMap.TryGetValue(pinNum, out var pin))
                    {
                        anchorPos = new Point(pin.CanvasX, pin.CanvasY);
                    }
                }
                else if (ellipse.Tag != null && int.TryParse(ellipse.Tag.ToString(), out int pinNumFromStr))
                {
                    // Click σε RPi pin (ασφαλής μετατροπή)
                    componentId = "RPI";
                    terminalName = $"pin{pinNumFromStr}";
                    if (_pinsMap.TryGetValue(pinNumFromStr, out var pin))
                    {
                        anchorPos = new Point(pin.CanvasX, pin.CanvasY);
                    }
                }

                if (componentId != null && terminalName != null)
                {
                    HandleTerminalClick(componentId, terminalName, anchorPos);
                }
            }
        }

        // Χαρτογράφηση της πλευράς του node στο όνομα ακροδέκτη του backend
        private string MapTerminalSideToName(string compType, string side)
        {
            return compType switch
            {
                "LED"      => side == "left" ? "anode" : "cathode",
                "RESISTOR" => side == "left" ? "terminal_a" : "terminal_b",
                "BUTTON"   => side == "left" ? "terminal_a" : "terminal_b",
                "LDR"      => side == "left" ? "terminal_a" : "terminal_b",
                "BUZZER"   => side == "left" ? "positive" : "negative",
                "DHT11"    => side == "left" ? "vcc" : "data",   // GND μέσω context menu
                "PIR"      => side == "left" ? "vcc" : "out",    // GND μέσω context menu
                "ULTRASONIC" => side == "left" ? "vcc" : "trig", // echo/gnd στο tooltip
                "POTENTIOMETER" => side == "left" ? "vcc" : "wiper", // GND μέσω context menu
                _ => side
            };
        }

        // Διαχείριση κλικ σε node (Έναρξη / Ολοκλήρωση Wiring)
        private async void HandleTerminalClick(string componentId, string terminalName, Point anchorPos)
        {
            if (!_isWiring)
            {
                // Έναρξη σχεδίασης καλωδίου
                _isWiring = true;
                _wireStartComponentId = componentId;
                _wireStartTerminalName = terminalName;
                _wireStartCanvasPoint = anchorPos;

                TempWireLine.X1 = anchorPos.X;
                TempWireLine.Y1 = anchorPos.Y;
                TempWireLine.X2 = anchorPos.X;
                TempWireLine.Y2 = anchorPos.Y;
                
                string colorHex = "#FF3B30";
                if (WireColorComboBox.SelectedItem is ComboBoxItem item && item.Tag != null)
                {
                    colorHex = item.Tag.ToString();
                }

                TempWireLine.Stroke = (System.Windows.Media.Brush)new System.Windows.Media.BrushConverter().ConvertFromString(colorHex);
                TempWireLine.Visibility = Visibility.Visible;
            }
            else
            {
                // Ολοκλήρωση σχεδίασης καλωδίου
                string endComponentId = componentId;
                string endTerminalName = terminalName;

                if (_wireStartComponentId == endComponentId && _wireStartTerminalName == endTerminalName)
                {
                    CancelWiring();
                    return;
                }

                string colorHex = "#FF3B30";
                if (WireColorComboBox.SelectedItem is ComboBoxItem item && item.Tag != null)
                {
                    colorHex = item.Tag.ToString();
                }

                CancelWiring();

                try
                {
                    var payload = new
                    {
                        from_component = _wireStartComponentId,
                        from_terminal = _wireStartTerminalName,
                        to_component = endComponentId,
                        to_terminal = endTerminalName,
                        color = colorHex
                    };

                    string requestBody = JsonSerializer.Serialize(payload);
                    var content = new StringContent(requestBody, Encoding.UTF8, "application/json");
                    var response = await _httpClient.PostAsync("http://127.0.0.1:8000/api/circuit/wire", content);
                    if (!response.IsSuccessStatusCode)
                    {
                        AppendConsole("Σφάλμα κατά τη σύνδεση του καλωδίου στο backend.");
                    }
                }
                catch (Exception ex)
                {
                    AppendConsole($"Σφάλμα αποστολής καλωδίου: {ex.Message}");
                }
            }
        }

        #endregion

        // === LED HANDLERS ===

        // Κλικ στο κουμπί "+ LED" — ανοίγει το context menu με τα χρώματα
        private void AddLedDropdown_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.ContextMenu != null)
            {
                btn.ContextMenu.PlacementTarget = btn;
                btn.ContextMenu.Placement = System.Windows.Controls.Primitives.PlacementMode.Bottom;
                btn.ContextMenu.IsOpen = true;
            }
        }

        // Επιλογή χρώματος LED από το dropdown menu (νέο LED)
        private async void AddLedColor_Click(object sender, RoutedEventArgs e)
        {
            if (sender is MenuItem item && item.Tag is string color)
            {
                await AddComponentAsync("LED", new Dictionary<string, object> { ["color"] = color });
            }
        }

        // Αλλαγή χρώματος υπάρχοντος LED μέσω context menu (δεξί κλικ στον καμβά)
        private async void ChangeLedColor_Click(object sender, RoutedEventArgs e)
        {
            if (sender is not MenuItem item) return;
            string newColor = item.Tag?.ToString();
            if (string.IsNullOrEmpty(newColor)) return;

            // Βρίσκουμε το component μέσω του DataContext του ContextMenu
            var contextMenu = item.Parent as ContextMenu;
            while (contextMenu?.Parent is MenuItem parentItem)
                contextMenu = parentItem.Parent as ContextMenu;
            
            if (contextMenu?.PlacementTarget is Border border && border.DataContext is CircuitComponent comp)
            {
                if (comp.Type != "LED") return;
                try
                {
                    // Ενημέρωση μέσω backend API
                    var payload = new Dictionary<string, object> { ["color"] = newColor };
                    string body = JsonSerializer.Serialize(payload);
                    var content = new StringContent(body, Encoding.UTF8, "application/json");
                    var response = await _httpClient.PutAsync(
                        $"http://127.0.0.1:8000/api/circuit/component/{comp.Id}/properties", content);
                    if (!response.IsSuccessStatusCode)
                        AppendConsole($"Αποτυχία αλλαγής χρώματος LED {comp.Id}.");
                }
                catch (Exception ex)
                {
                    AppendConsole($"Σφάλμα αλλαγής χρώματος: {ex.Message}");
                }
            }
        }

        // === ΥΠΟΛΟΙΠΑ COMPONENTS TOOLBAR ===

        // Προσθήκη Αντίστασης
        private async void AddResistor_Click(object sender, RoutedEventArgs e)
        {
            await AddComponentAsync("RESISTOR", new Dictionary<string, object> { ["resistance"] = 330 });
        }

        // Προσθήκη Διακόπτη (Button)
        private async void AddButton_Click(object sender, RoutedEventArgs e)
        {
            await AddComponentAsync("BUTTON", new Dictionary<string, object>());
        }

        // Προσθήκη Βομβητή (Buzzer)
        private async void AddBuzzer_Click(object sender, RoutedEventArgs e)
        {
            await AddComponentAsync("BUZZER", new Dictionary<string, object>());
        }

        // === ΝΕΟΙ ΑΙΣΘΗΤΗΡΕΣ ===

        // Προσθήκη DHT11 (Αισθητήρας θερμοκρασίας/υγρασίας)
        private async void AddDht11_Click(object sender, RoutedEventArgs e)
        {
            await AddComponentAsync("DHT11", new Dictionary<string, object>
                { ["temperature"] = 25.0, ["humidity"] = 50.0 });
        }

        // Προσθήκη PIR (Αισθητήρας κίνησης)
        private async void AddPir_Click(object sender, RoutedEventArgs e)
        {
            await AddComponentAsync("PIR", new Dictionary<string, object> { ["motion"] = false });
        }

        // Προσθήκη LDR (Φωτοαντίσταση)
        private async void AddLdr_Click(object sender, RoutedEventArgs e)
        {
            await AddComponentAsync("LDR", new Dictionary<string, object> { ["light"] = 50.0 });
        }

        // Προσθήκη Ultrasonic HC-SR04
        private async void AddUltrasonic_Click(object sender, RoutedEventArgs e)
        {
            await AddComponentAsync("ULTRASONIC", new Dictionary<string, object> { ["distance"] = 100.0 });
        }

        // Προσθήκη Ποτενσιόμετρου
        private async void AddPotentiometer_Click(object sender, RoutedEventArgs e)
        {
            await AddComponentAsync("POTENTIOMETER", new Dictionary<string, object> { ["value"] = 50.0 });
        }

        // PIR: Toggle ανίχνευσης κίνησης
        private async void PirToggle_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is CircuitComponent comp && comp.Type == "PIR")
            {
                comp.IsMotionActive = !comp.IsMotionActive;
                await SendSensorValueAsync(comp.Id, "motion", comp.IsMotionActive ? 1.0 : 0.0, isBool: true);
            }
        }

        // Generic: Αποστολή τιμής αισθητήρα στο backend
        private System.Threading.CancellationTokenSource _sensorDebounce;
        private async Task SendSensorValueAsync(string compId, string propertyKey, double value, bool isBool = false)
        {
            // Debounce 120ms ώστε να μην στέλνουμε σε κάθε pixel του slider
            _sensorDebounce?.Cancel();
            _sensorDebounce = new System.Threading.CancellationTokenSource();
            var token = _sensorDebounce.Token;

            try
            {
                await Task.Delay(120, token);
                if (token.IsCancellationRequested) return;

                // Χτίζουμε το properties dict με τη σωστή τιμή
                object val = isBool ? (value > 0 ? (object)true : false) : (object)value;
                var payload = new Dictionary<string, object> { [propertyKey] = val };
                string body = JsonSerializer.Serialize(payload);
                var content = new StringContent(body, Encoding.UTF8, "application/json");
                var response = await _httpClient.PutAsync(
                    $"http://127.0.0.1:8000/api/circuit/component/{compId}/properties", content);
                if (!response.IsSuccessStatusCode)
                    AppendConsole($"Σφάλμα αποστολής τιμής αισθητήρα {compId}.");
            }
            catch (TaskCanceledException) { /* Debounced — φυσιολογικό */ }
            catch (Exception ex)
            {
                AppendConsole($"Σφάλμα επικοινωνίας αισθητήρα: {ex.Message}");
            }
        }

        // DHT11 Slider θερμοκρασίας (0-50°C)
        private async void DhtTempSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (sender is Slider s && s.DataContext is CircuitComponent comp)
            {
                comp.SensorValue = e.NewValue;
                await SendSensorValueAsync(comp.Id, "temperature", e.NewValue);
            }
        }

        // DHT11 Slider υγρασίας (0-100%)
        private async void DhtHumSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (sender is Slider s && s.DataContext is CircuitComponent comp)
            {
                comp.SensorValue2 = e.NewValue;
                await SendSensorValueAsync(comp.Id, "humidity", e.NewValue);
            }
        }

        // LDR Slider φωτεινότητας (0-100%)
        private async void LdrSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (sender is Slider s && s.DataContext is CircuitComponent comp)
            {
                comp.SensorValue = e.NewValue;
                await SendSensorValueAsync(comp.Id, "light", e.NewValue);
            }
        }

        // Ultrasonic Slider απόστασης (2-400cm, slider 0-100%)
        private async void UltrasonicSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (sender is Slider s && s.DataContext is CircuitComponent comp)
            {
                comp.SensorValue = e.NewValue;
                double cm = 2.0 + (e.NewValue / 100.0) * 398.0;
                await SendSensorValueAsync(comp.Id, "distance", cm);
            }
        }

        // Potentiometer Slider (0-100%)
        private async void PotSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (sender is Slider s && s.DataContext is CircuitComponent comp)
            {
                comp.SensorValue = e.NewValue;
                await SendSensorValueAsync(comp.Id, "value", e.NewValue);
            }
        }

        // Βοηθητική μέθοδος προσθήκης εξαρτήματος στο backend
        private async Task AddComponentAsync(string type, Dictionary<string, object> properties)
        {
            try
            {
                string prefix = type switch
                {
                    "LED"           => "LED",
                    "RESISTOR"      => "R",
                    "BUTTON"        => "BTN",
                    "BUZZER"        => "BZ",
                    "DHT11"         => "DHT",
                    "PIR"           => "PIR",
                    "LDR"           => "LDR",
                    "ULTRASONIC"    => "US",
                    "POTENTIOMETER" => "POT",
                    _ => "COMP"
                };

                int index = 1;
                while (Components.Any(c => c.Id == $"{prefix}{index}"))
                {
                    index++;
                }
                string id = $"{prefix}{index}";

                // Ορισμός αρχικών συντεταγμένων
                var rand = new Random();
                double startX = 200 + rand.Next(-30, 30);
                double startY = 150 + rand.Next(-30, 30);

                properties["x"] = startX;
                properties["y"] = startY;

                var payload = new
                {
                    id = id,
                    type = type,
                    properties = properties
                };

                string requestBody = JsonSerializer.Serialize(payload);
                var content = new StringContent(requestBody, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync("http://127.0.0.1:8000/api/circuit/component", content);
                if (!response.IsSuccessStatusCode)
                {
                    AppendConsole($"Σφάλμα κατά την προσθήκη εξαρτήματος {id}.");
                }
            }
            catch (Exception ex)
            {
                AppendConsole($"Σφάλμα προσθήκης εξαρτήματος: {ex.Message}");
            }
        }

        // Διαγραφή εξαρτήματος από το κύκλωμα
        private async void DeleteComponent_Click(object sender, RoutedEventArgs e)
        {
            if (sender is MenuItem menuItem && menuItem.DataContext is CircuitComponent comp)
            {
                try
                {
                    var response = await _httpClient.DeleteAsync($"http://127.0.0.1:8000/api/circuit/component/{comp.Id}");
                    if (!response.IsSuccessStatusCode)
                    {
                        AppendConsole($"Αποτυχία διαγραφής εξαρτήματος {comp.Id}.");
                    }
                }
                catch (Exception ex)
                {
                    AppendConsole($"Σφάλμα διαγραφής εξαρτήματος: {ex.Message}");
                }
            }
        }

        // Διαγραφή καλωδίου από το κύκλωμα
        private async void DeleteWire_Click(object sender, RoutedEventArgs e)
        {
            if (sender is MenuItem menuItem && menuItem.DataContext is VisualWire wire)
            {
                try
                {
                    var payload = new
                    {
                        from_component = wire.FromComponent,
                        from_terminal = wire.FromTerminal,
                        to_component = wire.ToComponent,
                        to_terminal = wire.ToTerminal
                    };
                    string requestBody = JsonSerializer.Serialize(payload);
                    var content = new StringContent(requestBody, Encoding.UTF8, "application/json");
                    var response = await _httpClient.PostAsync("http://127.0.0.1:8000/api/circuit/wire/delete", content);
                    if (!response.IsSuccessStatusCode)
                    {
                        AppendConsole("Αποτυχία διαγραφής καλωδίου.");
                    }
                }
                catch (Exception ex)
                {
                    AppendConsole($"Σφάλμα διαγραφής καλωδίου: {ex.Message}");
                }
            }
        }

        // Καθαρισμός όλου του κυκλώματος
        private async void ClearCircuit_Click(object sender, RoutedEventArgs e)
        {
            var result = MessageBox.Show("Είστε σίγουροι ότι θέλετε να καθαρίσετε όλο το κύκλωμα;", "Καθαρισμός Καμβά", MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (result == MessageBoxResult.Yes)
            {
                try
                {
                    var response = await _httpClient.PostAsync("http://127.0.0.1:8000/api/circuit/clear", null);
                    if (!response.IsSuccessStatusCode)
                    {
                        AppendConsole("Αποτυχία καθαρισμού κυκλώματος.");
                    }
                }
                catch (Exception ex)
                {
                    AppendConsole($"Σφάλμα κατά τον καθαρισμό: {ex.Message}");
                }
            }
        }



        #region Βοηθητικές Μέθοδοι UI

        // Προσθήκη κειμένου στην κονσόλα της εφαρμογής
        private void AppendConsole(string text, bool addNewLine = true)
        {
            Dispatcher.Invoke(() =>
            {
                ConsoleOutput.AppendText(text + (addNewLine ? "\n" : ""));
                ConsoleOutput.ScrollToEnd();
            });
        }

        #endregion
    }

    // Κλάση αναπαράστασης του σεναρίου για το ListBox
    public class ScenarioItem
    {
        public string Id { get; set; }
        public string Title { get; set; }
        public string Difficulty { get; set; }
        public string Number { get; set; }
    }
}