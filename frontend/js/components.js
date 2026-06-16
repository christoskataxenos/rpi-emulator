// Διαχείριση της εργαλειοθήκης εξαρτημάτων και του Drag and Drop
const ComponentsDrawer = {
    init() {
        // Επιλογή όλων των συρόμενων στοιχείων
        const draggable_cards = document.querySelectorAll(".component-card.draggable");
        
        draggable_cards.forEach(card => {
            // Έναρξη του συρσίματος
            card.addEventListener("dragstart", (event) => {
                const component_data = {
                    type: card.dataset.type,
                    color: card.dataset.color || null,
                    resistance: card.dataset.resistance ? parseInt(card.dataset.resistance) : null
                };
                
                // Αποθήκευση των δεδομένων του εξαρτήματος στη μεταφορά δεδομένων
                event.dataTransfer.setData("application/json", JSON.stringify(component_data));
                event.dataTransfer.effectAllowed = "copy";
                
                card.classList.add("dragging");
            });

            // Τερματισμός του συρσίματος
            card.addEventListener("dragend", () => {
                card.classList.remove("dragging");
            });
        });
    }
};

window.ComponentsDrawer = ComponentsDrawer;
