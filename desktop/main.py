# Εισαγωγή των απαραίτητων βιβλιοθηκών για το GUI και το σύστημα
import sys
import os
import time
import threading
import uvicorn
from PyQt6.QtWidgets import QApplication, QMainWindow
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtCore import QUrl

# Προσθέτουμε τον τρέχοντα φάκελο στο sys.path για να μπορεί να εισαχθεί το backend module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


# Συνάρτηση που εκτελείται σε ξεχωριστό thread για την εκκίνηση του FastAPI
def start_backend_server():
    from backend.main import app
    # Εκτέλεση του uvicorn σε localhost στη θύρα 8000
    uvicorn.run(app, host = "127.0.0.1", port = 8000, log_level = "warning")


# Κύριο παράθυρο της desktop εφαρμογής
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        # Ορισμός τίτλου παραθύρου και διαστάσεων
        self.setWindowTitle("Virtual Raspberry Pi Laboratory")
        self.resize(1280, 850)
        
        # Δημιουργία του WebView στοιχείου για την προβολή του frontend
        self.browser = QWebEngineView()
        
        # Φόρτωση της διεύθυνσης του τοπικού εξομοιωτή
        self.browser.setUrl(QUrl("http://127.0.0.1:8000"))
        
        # Ορισμός του browser ως το κεντρικό widget του παραθύρου
        self.setCentralWidget(self.browser)


# Κύρια συνάρτηση εισόδου της εφαρμογής
def main():
    # 1. Εκκίνηση του backend server σε ξεχωριστό thread
    server_thread = threading.Thread(target = start_backend_server, daemon = True)
    server_thread.start()
    
    # Αναμονή 1.5 δευτερολέπτου για να προλάβει να ξεκινήσει ο server
    time.sleep(1.5)
    
    # 2. Εκκίνηση της QApplication και του παραθύρου PyQt6
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    
    # Τερματισμός της εφαρμογής όταν κλείσει το παράθυρο
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
