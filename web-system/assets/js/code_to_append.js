// =============================================================================
// Stato condiviso
// =============================================================================
//
// Manteniamo `bcts` e `fpqs` paralleli a `layouts`: per ogni i, layouts[i] e'
// l'i-esimo 1-stack layout, bcts[i] e' il BCT (radicato) che lo ha generato,
// e fpqs[i] e' l'FPQ-tree corrispondente. Il C++ stampa il BCT e poi l'FPQ
// *prima* di stampare la riga "RESULT: ..." dello stesso layout (vedi patch
// su getNext() in main_enum.cpp), quindi al momento del push di un nuovo
// layout abbiamo gia' il BCT e l'FPQ corrispondenti in bcts[i] / fpqs[i].
//
// I 24 layout di default sono hardcoded come fallback per la demo iniziale
// senza WebAssembly: in quel caso bcts e fpqs sono vuoti e i due riquadri
// mostrano un placeholder finche' l'utente non clicca "Compute Layouts".
// =============================================================================

var graph = {
    nodes: [{"id": "0","label": "0"},{"id": "1","label": "1"},{"id": "2","label": "2"},{"id": "3","label": "3"},{"id": "4","label": "4"},{"id":"5","label": "5"},{"id": "6","label": "6"},{"id": "7","label": "7"},{"id": "8","label": "8"},{"id": "9","label": "9"},{"id":"10","label": "10"}],
    edges: [{"from": "0","to": "1"},{"from": "0","to": "2"},{"from": "0","to": "8"},{"from": "1","to": "2"},{"from": "1","to": "3"},{"from": "1","to": "10"},{"from": "4","to": "3"},{"from": "5","to": "3"},{"from": "6","to": "3"},{"from": "7","to": "3"},{"from": "7","to": "6"},{"from": "9","to": "6"}]
};
var layouts = [["0","8","1","10","4","5","7","9","6","3","2"],["0","8","1","4","5","7","9","6","3","10","2"],["0","8","1","10","4","7","9","6","5","3","2"],["0","8","1","4","7","9","6","5","3","10","2"],["0","8","1","10","5","4","7","9","6","3","2"],["0","8","1","5","4","7","9","6","3","10","2"],["0","8","1","10","5","7","9","6","4","3","2"],["0","8","1","5","7","9","6","4","3","10","2"],["0","8","1","10","7","9","6","4","5","3","2"],["0","8","1","7","9","6","4","5","3","10","2"],["0","8","1","10","7","9","6","5","4","3","2"],["0","8","1","7","9","6","5","4","3","10","2"],["0","1","10","4","5","7","9","6","3","2","8"],["0","1","4","5","7","9","6","3","10","2","8"],["0","1","10","4","7","9","6","5","3","2","8"],["0","1","4","7","9","6","5","3","10","2","8"],["0","1","10","5","4","7","9","6","3","2","8"],["0","1","5","4","7","9","6","3","10","2","8"],["0","1","10","5","7","9","6","4","3","2","8"],["0","1","5","7","9","6","4","3","10","2","8"],["0","1","10","7","9","6","4","5","3","2","8"],["0","1","7","9","6","4","5","3","10","2","8"],["0","1","10","7","9","6","5","4","3","2","8"],["0","1","7","9","6","5","4","3","10","2","8"]];
var bcts = []; // popolato dal WASM, parallelo a `layouts`
var fpqs = []; // popolato dal WASM, parallelo a `layouts`
var currentBCT = null; // BCT in costruzione mentre il C++ sta ancora stampando
var currentFPQ = null; // FPQ in costruzione mentre il C++ sta ancora stampando
var currentIndex = 0;
var numberOfLayouts = 24;

updateStatistics();
drawLayout(graph, layouts[currentIndex]);
drawBCT(bcts[currentIndex]); // mostra il placeholder al primo caricamento
drawFPQ(fpqs[currentIndex], bcts[currentIndex]); // idem

// =============================================================================
// Lettura del file di grafo
// =============================================================================

function fileToString() {
    return new Promise((resolve, reject) => {
        const fileInput = document.getElementById('fileInput');
        if (fileInput.files.length === 0) {
            reject('Choose a file');
            return;
        }
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function() {
            try {
                resolve(reader.result);
            } catch (error) {
                reject('Error reading file: ' + error);
            }
        };
        reader.onerror = function() {
            reject('Error reading file: ' + reader.error);
        };
        reader.readAsText(file);
    });
}

// =============================================================================
// Bottoni e interazione
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('run').addEventListener('click', function() {
        fileToString()
            .then(fileString => {
                graph = getGraphFromFileString(fileString);
                layouts = [];
                bcts = [];
                fpqs = [];
                currentBCT = null;
                currentFPQ = null;
                currentIndex = 0;
                callMain([fileString]);
                if (numberOfLayouts == 0) {
                    currentIndex = -1;
                    updateStatistics();
                    drawLayout({nodes: [], edges: []}, []);
                    drawBCT(null);
                    drawFPQ(null, null);
                }
                else {
                    updateStatistics();
                    drawLayout(graph, layouts[currentIndex]);
                    drawBCT(bcts[currentIndex]);
                    drawFPQ(fpqs[currentIndex], bcts[currentIndex]);
                }
            })
            .catch(error => {
                console.error('Errore durante la lettura del file:', error);
            });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('next').addEventListener('click', function() {
        fileToString()
            .then(fileString => {
                if (currentIndex == layouts.length - 1) {
                    var computeNextLayout = Module["_printNextLayout"];
                    computeNextLayout();
                }
                if (currentIndex < numberOfLayouts - 1) {
                    currentIndex++;
                    updateStatistics();
                    drawLayout(graph, layouts[currentIndex]);
                    drawBCT(bcts[currentIndex]);
                    drawFPQ(fpqs[currentIndex], bcts[currentIndex]);
                }
            })
            .catch(error => {
                if (currentIndex < numberOfLayouts - 1) {
                    currentIndex++;
                    updateStatistics();
                    drawLayout(graph, layouts[currentIndex]);
                    drawBCT(bcts[currentIndex]);
                    drawFPQ(fpqs[currentIndex], bcts[currentIndex]);
                }
            });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('prev').addEventListener('click', function() {
        if (currentIndex > 0) {
            currentIndex--;
            updateStatistics();
            drawLayout(graph, layouts[currentIndex]);
            drawBCT(bcts[currentIndex]);
            drawFPQ(fpqs[currentIndex], bcts[currentIndex]);
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('downloadGraph').addEventListener('click', function() {
        const graphString = getGraphString();
        const blob = new Blob([graphString], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'graph';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});

document.getElementById('fileInput').addEventListener('change', function() {
    var fileName = this.files[0].name;
    document.getElementById('fileName').textContent = 'Selected file: ' + fileName;
    document.getElementById("run").style.display = "block";
});

// =============================================================================
// Serializzazione/parsing del grafo (file di testo)
// =============================================================================

function getGraphString() {
    let graphString = "";
    graph.nodes.forEach((node) => graphString += node.id + "\n");
    graph.edges.forEach((edge) => graphString += edge.from + "," + edge.to + "\n");
    return graphString;
}

function getGraphFromFileString(fileString) {
    const G = { nodes: [], edges: [] };
    let i = 0;
    let current = "";
    let readingNodes = true;
    let sourceNode = -1;

    while (i < fileString.length) {
        if (fileString[i] == '\n') {
            if (readingNodes) {
                G.nodes.push({id: current, label: current});
            } else {
                G.edges.push({from: sourceNode, to: current});
            }
            current = "";
        } else if (fileString[i] == ',') {
            sourceNode = current;
            current = "";
            readingNodes = false;
        } else if (fileString[i] != '\r') {
            current = current + fileString[i];
        }
        i++;
    }
    if (current.length > 0) {
        if (readingNodes) {
            G.nodes.push({id: current, label: current});
        } else {
            G.edges.push({from: sourceNode, to: current});
        }
    }
    return G;
}

// =============================================================================
// Parsing dei messaggi che arrivano dal WebAssembly
// =============================================================================
//
// Il C++ scrive su stdout righe di vario tipo. Le redirigiamo qui tramite la
// patch in update_binary.py (sostituisce `out` con `getDataFromWasm` dentro
// put_char). Riconosciamo i seguenti prefissi:
//
//   "NUMBER OF LAYOUTS: <n>"              -> aggiorna numberOfLayouts
//   "RESULT: <v0> <v1> ..."               -> push di un nuovo layout
//
//   "BCT_BEGIN root=<id>"                 -> inizio descrizione BCT
//   "BCT_NODE id=<id> kind=<block|cutpoint> value=<v>"
//   "BCT_EDGE from=<id> to=<id> type=<0|1|2>"
//   "BCT_END"                             -> fine descrizione BCT
//
//   "FPQ_BEGIN root=<id>"                 -> inizio descrizione FPQ-tree
//   "FPQ_NODE id=<id> type=<P|F_BLOCK|F_GADGET|LEAF> [block=<i>] [value=<v>]"
//   "FPQ_EDGE from=<id> to=<id> pos=<k>"  -> pos = indice del figlio nel padre
//   "FPQ_END"                             -> fine descrizione FPQ-tree
//
// Tutto il resto e' debug e finisce solo in console.log.
// =============================================================================

function getDataFromWasm(message) {
    console.log(message);

    if (typeof message !== 'string') return;

    // --- BCT ---
    if (message.startsWith('BCT_BEGIN')) {
        const m = message.match(/root=(-?\d+)/);
        currentBCT = {
            nodes: [],
            edges: [],
            root: m ? parseInt(m[1], 10) : null
        };
        return;
    }
    if (message.startsWith('BCT_NODE')) {
        if (!currentBCT) return;
        const id    = parseInt(message.match(/id=(\d+)/)[1], 10);
        const kind  = message.match(/kind=(\w+)/)[1];
        const value = parseInt(message.match(/value=(\d+)/)[1], 10);
        currentBCT.nodes.push({ id, kind, value });
        return;
    }
    if (message.startsWith('BCT_EDGE')) {
        if (!currentBCT) return;
        const from = parseInt(message.match(/from=(\d+)/)[1], 10);
        const to   = parseInt(message.match(/to=(\d+)/)[1], 10);
        const type = parseInt(message.match(/type=(\d+)/)[1], 10);
        currentBCT.edges.push({ from, to, type });
        return;
    }
    if (message.startsWith('BCT_END')) {
        if (currentBCT) {
            bcts.push(currentBCT);
            currentBCT = null;
        }
        return;
    }

    // --- FPQ ---
    if (message.startsWith('FPQ_BEGIN')) {
        const m = message.match(/root=(-?\d+)/);
        currentFPQ = {
            nodes: [],
            edges: [],
            root: m ? parseInt(m[1], 10) : null
        };
        return;
    }
    if (message.startsWith('FPQ_NODE')) {
        if (!currentFPQ) return;
        const id        = parseInt(message.match(/id=(\d+)/)[1], 10);
        const type      = message.match(/type=(\w+)/)[1];
        const blockMatch = message.match(/block=(\d+)/);
        const valueMatch = message.match(/value=(\d+)/);
        currentFPQ.nodes.push({
            id,
            type, // 'P' | 'F_BLOCK' | 'F_GADGET' | 'LEAF'
            blockIndex: blockMatch ? parseInt(blockMatch[1], 10) : -1,
            value:      valueMatch ? parseInt(valueMatch[1], 10) : -1
        });
        return;
    }
    if (message.startsWith('FPQ_EDGE')) {
        if (!currentFPQ) return;
        const from = parseInt(message.match(/from=(\d+)/)[1], 10);
        const to   = parseInt(message.match(/to=(\d+)/)[1], 10);
        const pos  = parseInt(message.match(/pos=(\d+)/)[1], 10);
        currentFPQ.edges.push({ from, to, pos });
        return;
    }
    if (message.startsWith('FPQ_END')) {
        if (currentFPQ) {
            fpqs.push(currentFPQ);
            currentFPQ = null;
        }
        return;
    }

    // --- Layout / conteggio ---
    if (message.startsWith('RESULT: ')) {
        let layout = message.replace('RESULT: ', '').split(' ').map(item => item.trim());
        layout.pop(); // rimuove l'elemento vuoto finale
        layouts.push(layout);
        return;
    }
    if (message.startsWith('NUMBER OF LAYOUTS: ')) {
        numberOfLayouts = parseInt(message.replace('NUMBER OF LAYOUTS: ', '').split(' ').map(item => item.trim())[0], 10);
        updateStatistics();
        return;
    }
}

function updateStatistics() {
    document.getElementById("index").innerText = "layout " + (currentIndex + 1) + " of " + numberOfLayouts;
}

// =============================================================================
// Disegno del 1-stack layout (riquadro top-right) - INVARIATO rispetto a prima
// =============================================================================

function drawLayout(graph, layout) {
    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();
    const mapping = new Map();

    let i = 0;
    layout.forEach(label => {
        mapping.set(label, i);
        i += 1;
    });

    graph.nodes.forEach(node => {
        nodes.add({ id: mapping.get(node.label), label: node.label, x: mapping.get(node.label) * 75, y: 0 });
    });

    graph.edges.forEach(edge => {
        edges.add({ from: mapping.get(edge.from), to: mapping.get(edge.to) });
    });

    const options = {
        nodes: {
            color: {
                background: "#76e0f5",
                border: "black",
                highlight: { background: "#bbffff", border: "black" }
            },
            font: { color: "black", size: 16 },
            borderWidth: 1
        },
        edges: {
            color: "black",
            arrows: { to: true },
            smooth: { type: 'curvedCW' }
        },
        interaction: { dragNodes: false },
        physics: { enabled: false }
    };

    const container = document.getElementById("network");
    const data = { nodes: nodes, edges: edges };
    const network = new vis.Network(container, data, options);
    network.setSize(container.offsetWidth, container.offsetHeight);

    network.on("doubleClick", () => network.fit());
    network.on("afterDrawing", function(ctx) {
        const dataURL = ctx.canvas.toDataURL();
        document.getElementById('canvasImg').href = dataURL;
    });
}

// =============================================================================
// Disegno del BCT (riquadro bottom-left)
// =============================================================================
//
// Usiamo il layout "hierarchical" di vis-network con direzione UD (up-down)
// e sortMethod "directed": dato che noi emettiamo gli archi parent->child,
// la radice del BCT viene posizionata in alto e l'albero si sviluppa verso
// il basso. E' un layout Sugiyama-like, molto vicino a Reingold-Tilford per
// alberi piccoli.
//
// Convenzioni grafiche:
//   - Blocchi (componenti biconnesse) -> rettangolo arancione, label "B<i>"
//   - Cutpoint (vertici di taglio)    -> ellisse celeste, label "<v>"
//   - Tipi di lato del BCT (relativi al ruolo del cutpoint nel blocco):
//        type=0 (sorgente)     -> verde,    label "s"
//        type=1 (intermedio)   -> rosso,    label "i"
//        type=2 (pozzo)        -> blu,      label "t"
// =============================================================================

const BCT_EDGE_STYLE = {
    0: { color: '#2ca02c', label: 's' },
    1: { color: '#d62728', label: 'i' },
    2: { color: '#1f77b4', label: 't' }
};

function drawBCT(bct) {
    const container = document.getElementById('bct-network');

    if (!bct || !bct.nodes || bct.nodes.length === 0) {
        container.innerHTML =
            '<div class="placeholder">Press <em>Compute Layouts</em> to visualize the BCT for the current layout.</div>';
        return;
    }

    container.innerHTML = '';

    const visNodes = new vis.DataSet(bct.nodes.map(n => ({
        id: n.id,
        label: n.kind === 'block' ? ('B' + n.value) : String(n.value),
        shape: n.kind === 'block' ? 'box' : 'ellipse',
        color: n.kind === 'block'
            ? { background: '#ffd591', border: 'black' }
            : { background: '#76e0f5', border: 'black' },
        font: { color: 'black', size: 14 },
        borderWidth: 1
    })));

    const visEdges = new vis.DataSet(bct.edges.map(e => {
        const style = BCT_EDGE_STYLE[e.type] || { color: 'black', label: '?' };
        return {
            from: e.from,
            to: e.to,
            label: style.label,
            color: { color: style.color },
            font: { size: 11, color: style.color, strokeWidth: 0, align: 'middle' },
            arrows: { to: { enabled: false } },
            smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 },
            width: 1.5
        };
    }));

    const options = {
        layout: {
            hierarchical: {
                enabled: true,
                direction: 'UD',
                sortMethod: 'directed',
                levelSeparation: 70,
                nodeSpacing: 90,
                treeSpacing: 120
            }
        },
        physics: { enabled: false },
        interaction: { dragNodes: false, zoomView: true }
    };

    const network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, options);
    network.on("doubleClick", () => network.fit());
}

// =============================================================================
// Disegno dell'FPQ-tree (riquadro bottom-right)
// =============================================================================
//
// Convenzioni grafiche (allineate al BCT dove possibile, per leggibilita'):
//   - F_BLOCK   (corrisponde a un blocco)    -> rettangolo arancione, label "B<i>"
//   - F_GADGET  (gadget di un cutpoint)      -> rettangolo grigio chiaro vuoto
//   - P_NODE    (libera permutazione)        -> ellisse verde chiaro, label "P"
//   - LEAF se il vertice e' un cutpoint      -> ellisse celeste, label "<v>"
//   - LEAF se il vertice e' "normale"        -> testo nudo, label "<v>"
//
// Per distinguere LEAF cutpoint da LEAF normale ci serve sapere quali vertici
// del grafo sono cutpoint: lo ricaviamo dal BCT corrispondente, passato come
// secondo argomento. Per costruzione bcts[i] e fpqs[i] sono accoppiati.
//
// LAYOUT: calcoliamo coordinate (x, y) esplicite con il classico algoritmo
// ricorsivo "subtree width" (tidy tree) e disabilitiamo il layout di vis-network.
// L'FPQ-tree e' un albero in senso stretto (un solo padre per ogni nodo, niente
// cicli), quindi questo layout produce zero incroci. Inoltre rispetta l'ordine
// di `pos` sui figli, che e' significativo per gli F-node.
//
// Algoritmo:
//   - ogni foglia occupa 1 slot orizzontale;
//   - ogni nodo interno e' centrato sulla media tra il primo e l'ultimo figlio;
//   - i figli vengono visitati in ordine di `pos`.
// =============================================================================

function drawFPQ(fpq, bct) {
    const container = document.getElementById('fpq-network');

    if (!fpq || !fpq.nodes || fpq.nodes.length === 0) {
        container.innerHTML =
            '<div class="placeholder">Press <em>Compute Layouts</em> to visualize the FPQ tree for the current layout.</div>';
        return;
    }

    container.innerHTML = '';

    // Insieme dei vertici cutpoint del grafo, ricavato dal BCT corrispondente.
    const cutpointValues = new Set();
    if (bct && bct.nodes) {
        for (const n of bct.nodes) {
            if (n.kind === 'cutpoint') cutpointValues.add(n.value);
        }
    }

    // --- Costruisci l'indice dei figli, ordinati per `pos` crescente ---
    const childrenOf = new Map();
    for (const n of fpq.nodes) childrenOf.set(n.id, []);
    const sortedEdges = [...fpq.edges].sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from;
        return a.pos - b.pos;
    });
    for (const e of sortedEdges) {
        const arr = childrenOf.get(e.from);
        if (arr) arr.push(e.to);
    }

    // --- Tidy tree layout ricorsivo ---
    // positions: id -> { x, level } in coordinate astratte (slot = 1 unita').
    const positions = new Map();

    function layoutSubtree(nodeId, depth, xStart) {
        const children = childrenOf.get(nodeId) || [];
        if (children.length === 0) {
            const c = xStart + 0.5; // centra la foglia nello slot
            positions.set(nodeId, { x: c, level: depth });
            return { width: 1, center: c };
        }
        let x = xStart;
        const childCenters = [];
        for (const child of children) {
            const r = layoutSubtree(child, depth + 1, x);
            childCenters.push(r.center);
            x += r.width;
        }
        const center = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
        positions.set(nodeId, { x: center, level: depth });
        return { width: x - xStart, center: center };
    }

    if (fpq.root != null && childrenOf.has(fpq.root)) {
        layoutSubtree(fpq.root, 0, 0);
    } else {
        // Fallback: se per qualche motivo non c'e' una root chiara, posiziona
        // i nodi in modo arbitrario (non dovrebbe accadere nella pratica).
        let i = 0;
        for (const n of fpq.nodes) {
            positions.set(n.id, { x: i++, level: 0 });
        }
    }

    // Pixel per slot orizzontale / verticale. Aumenta X_UNIT se vedi nodi
    // troppo vicini, Y_UNIT se i livelli sono troppo schiacciati.
    const X_UNIT = 60;
    const Y_UNIT = 75;

    const visNodes = new vis.DataSet(fpq.nodes.map(n => {
        const p = positions.get(n.id) || { x: 0, level: 0 };
        const base = {
            id: n.id,
            x: p.x * X_UNIT,
            y: p.level * Y_UNIT,
            fixed: { x: true, y: true }
        };

        switch (n.type) {
            case 'F_BLOCK':
                return Object.assign(base, {
                    label: 'B' + n.blockIndex,
                    shape: 'box',
                    color: { background: '#ffd591', border: 'black' },
                    font: { color: 'black', size: 14 },
                    borderWidth: 1
                });
            case 'F_GADGET':
                return Object.assign(base, {
                    label: ' ',
                    shape: 'box',
                    color: { background: '#e8e8e8', border: '#888' },
                    font: { color: '#888', size: 1 },
                    borderWidth: 1,
                    widthConstraint: { minimum: 24 },
                    heightConstraint: { minimum: 14 }
                });
            case 'P':
                return Object.assign(base, {
                    label: 'P',
                    shape: 'ellipse',
                    color: { background: '#b6f0b6', border: 'black' },
                    font: { color: 'black', size: 14 },
                    borderWidth: 1
                });
            case 'LEAF':
            default: {
                const isCp = cutpointValues.has(n.value);
                if (isCp) {
                    return Object.assign(base, {
                        label: String(n.value),
                        shape: 'ellipse',
                        color: { background: '#76e0f5', border: 'black' },
                        font: { color: 'black', size: 14 },
                        borderWidth: 1
                    });
                }
                return Object.assign(base, {
                    label: String(n.value),
                    shape: 'text',
                    font: { color: 'black', size: 14 }
                });
            }
        }
    }));

    const visEdges = new vis.DataSet(sortedEdges.map(e => ({
        from: e.from,
        to: e.to,
        color: { color: '#666' },
        arrows: { to: { enabled: false } },
        smooth: false, // linee dritte: stanno meglio in un tree-layout pulito
        width: 1
    })));

    const options = {
        layout: { hierarchical: { enabled: false }, randomSeed: 0 },
        physics: { enabled: false },
        interaction: { dragNodes: false, zoomView: true }
    };

    const network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, options);
    network.on("doubleClick", () => network.fit());
    // Adatta automaticamente lo zoom alla dimensione del pannello al primo draw.
    network.once("afterDrawing", () => network.fit());
}