# Εισαγωγή των απαραίτητων βιβλιοθηκών για τη διαχείριση διεργασιών και αρχείων
import subprocess
import os
import sys
import uuid
import threading
from typing import Dict, Callable, Optional

# Λεξικό για την αποθήκευση των ενεργών διεργασιών ανά session id
active_processes: Dict[str, subprocess.Popen] = {}


# Κλάση που διαχειρίζεται την ασφαλή εκτέλεση του κώδικα του μαθητή
class CodeExecutor:
    def __init__(self, shims_dir: str):
        # Αποθήκευση της διαδρομής των shims
        self.shims_dir = os.path.abspath(shims_dir)

    # Συνάρτηση για την εκτέλεση του κώδικα σε ξεχωριστή διεργασία
    def run_code(self, code_content: str, on_output: Callable[[str, str], None], on_exit: Callable[[str, int], None]) -> str:
        # Δημιουργία ενός μοναδικού αναγνωριστικού για αυτή την εκτέλεση
        session_id = str(uuid.uuid4())
        
        # Ορισμός του προσωρινού αρχείου κώδικα
        temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "runs")
        os.makedirs(temp_dir, exist_ok = True)
        
        script_path = os.path.join(temp_dir, f"script_{session_id}.py")
        
        # Εγγραφή του κώδικα στο προσωρινό αρχείο
        with open(script_path, "w", encoding = "utf-8") as file:
            file.write(code_content)
            
        # Ρύθμιση των μεταβλητών περιβάλλοντος (env variables)
        env = os.environ.copy()
        
        # Προσθήκη των shims στο PYTHONPATH ώστε η Python να τα βρει κατά το import
        if "PYTHONPATH" in env:
            env["PYTHONPATH"] = f"{self.shims_dir}{os.pathsep}{env['PYTHONPATH']}"
        else:
            env["PYTHONPATH"] = self.shims_dir
            
        # Απενεργοποίηση του buffering για να λαμβάνουμε άμεσα τα print statements
        env["PYTHONUNBUFFERED"] = "1"
        
        # Εκκίνηση της διεργασίας με τη χρήση του sys.executable (τρέχον Python binary)
        # Χρησιμοποιούμε Popen για να μην μπλοκάρει η εκτέλεση του backend
        process = subprocess.Popen(
            [sys.executable, "-u", script_path],
            env = env,
            stdout = subprocess.PIPE,
            stderr = subprocess.PIPE,
            text = True,
            bufsize = 1
        )
        
        # Αποθήκευση της διεργασίας στο λεξικό με τις ενεργές διεργασίες
        active_processes[session_id] = process
        
        # Δημιουργία threads για την ανάγνωση του stdout και stderr σε πραγματικό χρόνο
        stdout_thread = threading.Thread(
            target = self._read_stream,
            args = (process.stdout, session_id, "stdout", on_output),
            daemon = True
        )
        stderr_thread = threading.Thread(
            target = self._read_stream,
            args = (process.stderr, session_id, "stderr", on_output),
            daemon = True
        )
        
        # Εκκίνηση των threads
        stdout_thread.start()
        stderr_thread.start()
        
        # Δημιουργία thread για την αναμονή τερματισμού της διεργασίας
        wait_thread = threading.Thread(
            target = self._wait_for_process,
            args = (process, session_id, script_path, on_exit),
            daemon = True
        )
        wait_thread.start()
        
        return session_id

    # Βοηθητική μέθοδος για την ανάγνωση του stream (stdout ή stderr)
    def _read_stream(self, stream, session_id: str, stream_type: str, callback: Callable[[str, str], None]):
        # Διαβάζουμε γραμμή προς γραμμή μέχρι να κλείσει το stream
        for line in iter(stream.readline, ""):
            callback(stream_type, line)
        stream.close()

    # Βοηθητική μέθοδος που περιμένει τον τερματισμό της διεργασίας και καθαρίζει τα αρχεία
    def _wait_for_process(self, process: subprocess.Popen, session_id: str, script_path: str, callback: Callable[[str, int], None]):
        # Αναμονή τερματισμού
        exit_code = process.wait()
        
        # Αφαίρεση της διεργασίας από το λεξικό
        if session_id in active_processes:
            del active_processes[session_id]
            
        # Διαγραφή του προσωρινού αρχείου κώδικα
        try:
            if os.path.exists(script_path):
                os.remove(script_path)
        except Exception as error:
            print(f"[Executor Warning] Αποτυχία διαγραφής του αρχείου {script_path}: {error}")
            
        # Κλήση του callback εξόδου
        callback(session_id, exit_code)

    # Μέθοδος για τον βίαιο τερματισμό μιας διεργασίας από το χρήστη
    def stop_code(self, session_id: str) -> bool:
        if session_id in active_processes:
            process = active_processes[session_id]
            try:
                # Τερματισμός της διεργασίας
                process.terminate()
                # Αναμονή για λίγο και μετά kill αν δεν έχει κλείσει
                try:
                    process.wait(timeout = 1.0)
                except subprocess.TimeoutExpired:
                    process.kill()
                return True
            except Exception as error:
                print(f"[Executor Warning] Αποτυχία τερματισμού διεργασίας {session_id}: {error}")
                return False
        return False
