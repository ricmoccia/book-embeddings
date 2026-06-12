// =============================================================================
// Shared state
// =============================================================================
//
// `bcts` and `fpqs` are kept parallel to `layouts`: for each index i,
// `layouts[i]` is the i-th 1-stack layout, `bcts[i]` is the (rooted) BCT that
// generated it, and `fpqs[i]` is the corresponding FPQ-tree. The C++ side
// emits the BCT and then the FPQ for a given layout *before* the matching
// "RESULT: ..." line (see the patched getNext() in main_enum.cpp), so by the
// time we push a new layout we already have its BCT and FPQ ready in
// `bcts[i]` / `fpqs[i]`.
//
// `blocks` holds, for each biconnected block, the list of its edges. It is
// emitted only once per WASM session (it is a static property of the input
// graph). `edgeToBlock` is a derived index that maps an edge key
// `"<from>-<to>"` to its block index, used by `drawLayout` to color edges
// after their block.
//
// The 24 default layouts are hardcoded as a fallback for the initial demo
// without WebAssembly: in that case `bcts`, `fpqs`, `blocks` are empty and
// the corresponding panels show a placeholder until the user clicks
// "Compute Layouts".
// =============================================================================

var graph = {
    nodes: [{"id": "0","label": "0"},{"id": "1","label": "1"},{"id": "2","label": "2"},{"id": "3","label": "3"},{"id": "4","label": "4"},{"id":"5","label": "5"},{"id": "6","label": "6"},{"id": "7","label": "7"},{"id": "8","label": "8"},{"id": "9","label": "9"},{"id":"10","label": "10"}],
    edges: [{"from": "0","to": "1"},{"from": "0","to": "2"},{"from": "0","to": "8"},{"from": "1","to": "2"},{"from": "1","to": "3"},{"from": "1","to": "10"},{"from": "4","to": "3"},{"from": "5","to": "3"},{"from": "6","to": "3"},{"from": "7","to": "3"},{"from": "7","to": "6"},{"from": "9","to": "6"}]
};
var layouts = [["0","8","1","10","4","5","7","9","6","3","2"],["0","8","1","4","5","7","9","6","3","10","2"],["0","8","1","10","4","7","9","6","5","3","2"],["0","8","1","4","7","9","6","5","3","10","2"],["0","8","1","10","5","4","7","9","6","3","2"],["0","8","1","5","4","7","9","6","3","10","2"],["0","8","1","10","5","7","9","6","4","3","2"],["0","8","1","5","7","9","6","4","3","10","2"],["0","8","1","10","7","9","6","4","5","3","2"],["0","8","1","7","9","6","4","5","3","10","2"],["0","8","1","10","7","9","6","5","4","3","2"],["0","8","1","7","9","6","5","4","3","10","2"],["0","1","10","4","5","7","9","6","3","2","8"],["0","1","4","5","7","9","6","3","10","2","8"],["0","1","10","4","7","9","6","5","3","2","8"],["0","1","4","7","9","6","5","3","10","2","8"],["0","1","10","5","4","7","9","6","3","2","8"],["0","1","5","4","7","9","6","3","10","2","8"],["0","1","10","5","7","9","6","4","3","2","8"],["0","1","5","7","9","6","4","3","10","2","8"],["0","1","10","7","9","6","4","5","3","2","8"],["0","1","7","9","6","4","5","3","10","2","8"],["0","1","10","7","9","6","5","4","3","2","8"],["0","1","7","9","6","5","4","3","10","2","8"]];
var bcts = [];          // filled by the WASM, parallel to `layouts`.
var fpqs = [];          // filled by the WASM, parallel to `layouts`.
var blocks = [];        // blocks[i] = array of edges {from,to} of the i-th biconnected block.
var edgeToBlock = new Map(); // key "<from>-<to>" -> block index. Built once from `blocks`.
var currentBCT = null;  // BCT being built while the C++ is still emitting it.
var currentFPQ = null;  // FPQ being built while the C++ is still emitting it.
var currentBlocks = null;     // blocks being built while the C++ is still emitting them.
var bctNetwork = null;        // last vis.Network drawn in the BCT panel (for refit on resize).
var fpqNetwork = null;        // last vis.Network drawn in the FPQ panel (for refit on resize).
var currentIndex = 0;
var numberOfLayouts = 24;

// =============================================================================
// Appearance constants (declared up-front so they are usable during the
// initial drawBCT/drawFPQ calls below; `const` declarations are subject to
// the temporal dead zone, so they MUST appear before any function that
// reads them is invoked at top level).
// =============================================================================

/**
 * Edge-color/label conventions for the BCT, encoding the role of the cutpoint
 * in the child block. Colors are deliberately dark/saturated so they remain
 * readable on top of the pastel block-chromatism palette.
 */
const BCT_EDGE_STYLE = {
    0: { color: '#1a7e1a', label: 's', name: 'source cutpoint' },
    1: { color: '#b71c1c', label: 'i', name: 'intermediate cutpoint' },
    2: { color: '#0d47a1', label: 't', name: 'sink cutpoint' }
};

/**
 * Pastel palette used to give every biconnected block a unique color.
 * Light enough to keep the dark BCT_EDGE_STYLE colors readable on top.
 * Cycles via modulo if the graph has more blocks than entries (large graphs
 * are rare in this didactic tool, and even with cycling adjacent blocks
 * typically get distinct colors).
 */
const BLOCK_COLOR_PALETTE = [
    '#f4a6a6', // pastel red
    '#f9c98a', // pastel orange
    '#f6e58d', // pastel yellow
    '#b8e0a6', // pastel green
    '#a6d8e0', // pastel cyan
    '#a6b8e0', // pastel blue
    '#c8a6e0', // pastel violet
    '#e0a6c8', // pastel pink
    '#d4b48a', // pastel tan
    '#8acabf', // pastel teal
    '#bfb48a', // pastel khaki
    '#b48ad4'  // pastel lavender
];

updateStatistics();
drawLayout(graph, layouts[currentIndex]);
drawBCT(bcts[currentIndex]);                  // shows the placeholder on first load.
drawFPQ(fpqs[currentIndex], bcts[currentIndex]); // idem.

// =============================================================================
// Graph file reading
// =============================================================================

/**
 * Read the content of the file currently selected in #fileInput as text.
 * @returns {Promise<string>} Resolves with the file content, rejects with an
 *                            error message if no file is chosen or reading fails.
 */
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
// Buttons and user interaction
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('run').addEventListener('click', function() {
        fileToString()
            .then(fileString => {
                graph = getGraphFromFileString(fileString);
                layouts = [];
                bcts = [];
                fpqs = [];
                blocks = [];
                edgeToBlock = new Map();
                currentBCT = null;
                currentFPQ = null;
                currentBlocks = null;
                currentIndex = 0;
                // `callMain` is an Emscripten runtime method. Recent Emscripten
                // versions no longer leak it to the global scope, so resolve it
                // from the Module object (with a fallback to a bare global for
                // older builds). It must be listed in EXPORTED_RUNTIME_METHODS
                // at compile time, otherwise Module.callMain is undefined too.
                const wasmCallMain =
                    (typeof Module !== 'undefined' && Module.callMain) ||
                    (typeof callMain === 'function' ? callMain : null);
                if (typeof wasmCallMain !== 'function') {
                    console.error('callMain is not available: add "callMain" to ' +
                        'EXPORTED_RUNTIME_METHODS in compile-wasm.ps1 and rebuild.');
                    return;
                }
                wasmCallMain([fileString]);
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
                console.error('Error while reading the file:', error);
            });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('next').addEventListener('click', function() {
        fileToString()
            .then(fileString => {
                if (currentIndex == layouts.length - 1) {
                    // `_printNextLayout` is only present if exported via
                    // EXPORTED_FUNCTIONS. It currently is not (only `_main` is),
                    // and main() already enumerates every layout up-front, so
                    // this branch is a no-op. Guard it to avoid a TypeError if
                    // someone presses Next on the very last layout.
                    var computeNextLayout = (typeof Module !== 'undefined')
                        ? Module["_printNextLayout"] : null;
                    if (typeof computeNextLayout === 'function') {
                        computeNextLayout();
                    }
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
// Graph (de)serialization to/from text file
// =============================================================================

/**
 * Serialize the current `graph` object into the text format expected by the
 * C++ side: nodes one per line, then edges as "from,to" lines.
 * @returns {string} Plain text representation of the graph.
 */
function getGraphString() {
    let graphString = "";
    graph.nodes.forEach((node) => graphString += node.id + "\n");
    graph.edges.forEach((edge) => graphString += edge.from + "," + edge.to + "\n");
    return graphString;
}

/**
 * Parse the textual graph description (same format as `getGraphString`) into
 * an in-memory `{ nodes, edges }` structure.
 * @param {string} fileString  Text content of a graph file.
 * @returns {{nodes: Array<{id:string,label:string}>, edges: Array<{from:string,to:string}>}}
 */
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
// Parsing of messages emitted by the WebAssembly module
// =============================================================================
//
// The C++ side writes various kinds of lines to stdout. They are forwarded
// here by the patch in update_binary.py (which replaces the `out` callback
// with `getDataFromWasm` inside put_char). The recognized prefixes are:
//
//   "NUMBER OF LAYOUTS: <n>"              -> updates numberOfLayouts
//   "RESULT: <v0> <v1> ..."               -> pushes a new layout
//
//   "BLOCKS_BEGIN count=<n>"              -> begin block decomposition
//   "BLOCK_EDGE block=<i> from=<u> to=<v>"
//   "BLOCKS_END"                          -> end block decomposition
//                                            (emitted ONCE per WASM session,
//                                            blocks are a static property of
//                                            the input graph)
//
//   "BCT_BEGIN root=<id>"                 -> begin BCT description
//   "BCT_NODE id=<id> kind=<block|cutpoint> value=<v>"
//   "BCT_EDGE from=<id> to=<id> type=<0|1|2>"
//   "BCT_END"                             -> end BCT description
//
//   "FPQ_BEGIN root=<id>"                 -> begin FPQ-tree description
//   "FPQ_NODE id=<id> type=<P|F_BLOCK|F_GADGET|LEAF> [block=<i>] [value=<v>]"
//   "FPQ_EDGE from=<id> to=<id> pos=<k>"  -> pos = child index inside its parent
//   "FPQ_END"                             -> end FPQ-tree description
//
// Everything else is debug output and ends up only in console.log.
// =============================================================================

/**
 * Dispatch a single stdout line emitted by the WASM module to the appropriate
 * state-updating branch. Unrecognized lines are simply logged.
 * @param {string} message  One full line of WASM stdout (no trailing newline).
 */
function getDataFromWasm(message) {
    console.log(message);

    if (typeof message !== 'string') return;

    // --- Blocks (biconnected decomposition, emitted once) ---
    if (message.startsWith('BLOCKS_BEGIN')) {
        const m = message.match(/count=(\d+)/);
        const count = m ? parseInt(m[1], 10) : 0;
        currentBlocks = [];
        for (let i = 0; i < count; i++) currentBlocks.push([]);
        return;
    }
    if (message.startsWith('BLOCK_EDGE')) {
        if (!currentBlocks) return;
        const b = parseInt(message.match(/block=(\d+)/)[1], 10);
        const from = parseInt(message.match(/from=(\d+)/)[1], 10);
        const to   = parseInt(message.match(/to=(\d+)/)[1], 10);
        if (currentBlocks[b]) currentBlocks[b].push({ from, to });
        return;
    }
    if (message.startsWith('BLOCKS_END')) {
        if (currentBlocks) {
            blocks = currentBlocks;
            edgeToBlock = buildEdgeToBlock(blocks);
            currentBlocks = null;
        }
        return;
    }

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

    // --- Layout / counts ---
    if (message.startsWith('RESULT: ')) {
        let layout = message.replace('RESULT: ', '').split(' ').map(item => item.trim());
        layout.pop(); // strip the trailing empty token.
        layouts.push(layout);
        return;
    }
    if (message.startsWith('NUMBER OF LAYOUTS: ')) {
        numberOfLayouts = parseInt(message.replace('NUMBER OF LAYOUTS: ', '').split(' ').map(item => item.trim())[0], 10);
        updateStatistics();
        return;
    }
}

/**
 * Build the "edge -> block index" lookup map from the block decomposition.
 * The key encodes the unordered edge as "<min>-<max>" so that direction in
 * the layout view does not affect the lookup.
 * @param {Array<Array<{from:number,to:number}>>} blocksArr  Block list.
 * @returns {Map<string, number>} Map from edge key to block index.
 */
function buildEdgeToBlock(blocksArr) {
    const map = new Map();
    for (let i = 0; i < blocksArr.length; i++) {
        for (const e of blocksArr[i]) {
            const a = Math.min(e.from, e.to);
            const b = Math.max(e.from, e.to);
            map.set(a + '-' + b, i);
        }
    }
    return map;
}

/**
 * Look up the block index of an edge in O(1) regardless of orientation.
 * @param {string|number} from  Source endpoint of the edge.
 * @param {string|number} to    Target endpoint of the edge.
 * @returns {number}            Block index, or -1 if the edge is unknown
 *                              (typically before the WASM has been run).
 */
function blockOfEdge(from, to) {
    const a = Math.min(parseInt(from, 10), parseInt(to, 10));
    const b = Math.max(parseInt(from, 10), parseInt(to, 10));
    const v = edgeToBlock.get(a + '-' + b);
    return (v === undefined) ? -1 : v;
}

// =============================================================================
// Block-chromatism palette
// =============================================================================
//
// The `BLOCK_COLOR_PALETTE` array itself is declared near the top of the
// file (it is needed during the initial drawBCT/drawFPQ calls). Here we just
// define the accessor function and document the palette's role.
//
// Every biconnected block is assigned a unique pastel color. The palette is
// deliberately light so that the dark/saturated BCT edge colors (source/
// intermediate/sink) stay readable on top of it. If the input graph has more
// blocks than palette entries the colors cycle (acceptable: large graphs are
// rare in this didactic tool, and even with cycling adjacent blocks usually
// get distinct colors).
// =============================================================================

/**
 * Return the pastel color associated with a given block index. Cycles through
 * `BLOCK_COLOR_PALETTE` if the index exceeds the palette length.
 * @param {number} i  Block index (0-based).
 * @returns {string}  Hex color string, e.g. "#f4a6a6".
 */
function blockColor(i) {
    if (i < 0) return '#cccccc';
    return BLOCK_COLOR_PALETTE[i % BLOCK_COLOR_PALETTE.length];
}

function updateStatistics() {
    document.getElementById("index").innerText = "layout " + (currentIndex + 1) + " of " + numberOfLayouts;
}

// =============================================================================
// 1-stack layout drawing (top-right panel)
// =============================================================================
//
// Vertices are laid out on a horizontal line in the order given by `layout`,
// edges are drawn as curves above (or below) the line by vis-network's
// `curvedCW` smoothing. Each edge is colored after its biconnected block
// (block chromatism): edges in the same block share a color, which matches
// the color used for that block's node in the BCT and FPQ panels. If the
// block decomposition is not available yet (e.g. the initial demo without
// running the WASM), edges fall back to black.
// =============================================================================

/**
 * Draw the 1-stack layout in the #network DOM element.
 * @param {{nodes:Array,edges:Array}} graph   Graph being visualized.
 * @param {Array<string>}             layout  Vertex labels in the chosen
 *                                            stack order (left-to-right).
 */
function drawLayout(graph, layout) {
    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();
    const mapping = new Map();

    let i = 0;
    layout.forEach(label => { mapping.set(label, i); i += 1; });

    // VERTICAL spine: nodes stacked top-to-bottom (x = 0); arcs bow to the RIGHT.
    const V = 75;
    graph.nodes.forEach(node => {
        nodes.add({ id: mapping.get(node.label), label: node.label, x: 0, y: mapping.get(node.label) * V });
    });

    graph.edges.forEach(edge => {
        const b = blockOfEdge(edge.from, edge.to);
        const c = (b >= 0) ? blockColor(b) : 'black';
        edges.add({
            from: mapping.get(edge.from),
            to:   mapping.get(edge.to),
            color: { color: c, highlight: c, hover: c },
            width: 2
        });
    });

    // Reserve room on the RIGHT so the arcs are not clipped; the spine then sits
    // on the left of the panel. HEAD ~ the widest arc's rightward extent.
    let maxSpan = 0;
    graph.edges.forEach(edge => {
        const a = mapping.get(edge.from), bb = mapping.get(edge.to);
        if (a != null && bb != null) maxSpan = Math.max(maxSpan, Math.abs(a - bb));
    });
    const HEAD = maxSpan * V * 0.55;   // tune if arcs clip / too much room
    if (HEAD > 0) {
        const midY = (i - 1) * V / 2;
        const invisible = {
            size: 0, shape: 'dot', label: '',
            color: { background: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)' },
            physics: false, fixed: { x: true, y: true }
        };
        nodes.add(Object.assign({ id: '__padRight', x: HEAD,         y: midY }, invisible));
        nodes.add(Object.assign({ id: '__padLeft',  x: -HEAD * 0.10, y: midY }, invisible));
    }

    const options = {
        nodes: {
            color: { background: "#76e0f5", border: "black",
                     highlight: { background: "#bbffff", border: "black" } },
            font: { color: "black", size: 16 },
            borderWidth: 1
        },
        edges: {
            arrows: { to: true },
            smooth: { type: 'curvedCW' }   // se gli archi vanno a SINISTRA, usa 'curvedCCW'
        },
        interaction: { dragNodes: false },
        physics: { enabled: false }
    };

    const container = document.getElementById("network");
    const data = { nodes: nodes, edges: edges };
    const network = new vis.Network(container, data, options);
    network.setSize(container.offsetWidth, container.offsetHeight);
    network.once("afterDrawing", () => network.fit());
    network.on("doubleClick", () => network.fit());
    network.on("afterDrawing", function (ctx) {
        const dataURL = ctx.canvas.toDataURL();
        document.getElementById('canvasImg').href = dataURL;
    });
}

// =============================================================================
// BCT drawing (bottom-left panel)
// =============================================================================
//
// We use a manual "tidy tree" layout (same algorithm as drawFPQ) instead of
// vis-network's hierarchical layout, because we want absolute control over
// the left-to-right order of children: the C++ side emits BCT_EDGE entries
// in the order dictated by the current permutation (see
// orderedChildrenOfCutpoint in main_enum.cpp), and we must preserve that
// order so flipping through layouts visibly rearranges the BCT in lockstep
// with the layout itself.
//
// Graphical conventions:
//   - Block nodes (biconnected components):
//        rectangle filled with the block's chromatism color, label "B<i>".
//        Same color is used for the corresponding F_NODE_BLOCK in the FPQ
//        panel and for the edges of that block in the layout panel.
//   - Cutpoint nodes (cut vertices):
//        ellipse with the standard cyan background, label "<v>".
//   - Edge colors encode the role of the cutpoint in the child block,
//        deliberately chosen dark/saturated to contrast with the pastel
//        block palette:
//          type=0 (source cutpoint)       -> dark green   "s"
//          type=1 (intermediate cutpoint) -> dark red     "i"
//          type=2 (sink cutpoint)         -> dark blue    "t"
//
// A small legend is rendered below the network area so the meaning of the
// edge colors is self-documenting. The legend is inserted via inline CSS
// (no need to touch styles.css).
//
// The `BCT_EDGE_STYLE` map itself is declared near the top of the file
// (it is needed during the initial drawBCT call to render the legend).
// =============================================================================

/**
 * Ensure the BCT legend block exists in the DOM, sitting just below the
 * #bct-network panel. The legend lists the three edge-type colors. Idempotent:
 * if the legend is already in the DOM, it is left untouched.
 */
function ensureBCTLegend() {
    if (document.getElementById('bct-legend')) return;
    const host = document.getElementById('bct-network');
    if (!host || !host.parentElement) return;
    const legend = document.createElement('div');
    legend.id = 'bct-legend';
    legend.style.cssText = [
        'display:flex',
        'flex-wrap:wrap',
        'gap:12px',
        'align-items:center',
        'justify-content:center',
        'padding:4px 8px',
        'margin-top:4px',
        'font-size:12px',
        'color:#222',
        'font-family:sans-serif'
    ].join(';');
    const swatch = (color, label) => {
        const item = document.createElement('span');
        item.style.cssText = 'display:inline-flex;align-items:center;gap:4px;';
        const dot = document.createElement('span');
        dot.style.cssText = `display:inline-block;width:18px;height:3px;background:${color};border-radius:1px;`;
        const txt = document.createElement('span');
        txt.textContent = label;
        item.appendChild(dot);
        item.appendChild(txt);
        return item;
    };
    legend.appendChild(swatch(BCT_EDGE_STYLE[0].color, BCT_EDGE_STYLE[0].name));
    legend.appendChild(swatch(BCT_EDGE_STYLE[1].color, BCT_EDGE_STYLE[1].name));
    legend.appendChild(swatch(BCT_EDGE_STYLE[2].color, BCT_EDGE_STYLE[2].name));
    host.parentElement.insertBefore(legend, host.nextSibling);
}

/**
 * Draw the BCT corresponding to the current layout. Uses an explicit
 * "tidy tree" layout so that the visual order of children matches the order
 * in which the C++ emitted their edges (which itself reflects the current
 * permutation of cutpoint children).
 *
 * @param {?{nodes:Array,edges:Array,root:number}} bct  BCT description, or
 *      null/empty to draw the placeholder.
 */
function drawBCT(bct) {
    const container = document.getElementById('bct-network');

    if (!bct || !bct.nodes || bct.nodes.length === 0) {
        // Only inject a fallback placeholder if the container does not
        // already contain a `.placeholder` element. This way the placeholder
        // text defined in index.html survives the initial draw and the
        // HTML stays the single source of truth for the message shown when
        // no BCT is available.
        if (!container.querySelector('.placeholder')) {
            container.innerHTML =
                '<div class="placeholder">Upload Graph File and press Compute Layouts to visualize the BCT for the current layout.</div>';
        }
        ensureBCTLegend();
        bctNetwork = null;
        return;
    }

    container.innerHTML = '';

    // --- Build "children of X, in emission order" index. --------------------
    // BCT_EDGE messages are emitted in the order dictated by the current
    // permutation, so simply preserving their relative order is enough.
    const childrenOf = new Map();
    for (const n of bct.nodes) childrenOf.set(n.id, []);
    for (const e of bct.edges) {
        const arr = childrenOf.get(e.from);
        if (arr) arr.push(e.to);
    }

    // --- Tidy-tree layout (same recursive scheme used in drawFPQ). ----------
    const positions = new Map();
    function layoutSubtree(nodeId, depth, xStart) {
        const children = childrenOf.get(nodeId) || [];
        if (children.length === 0) {
            const c = xStart + 0.5;
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

    if (bct.root != null && childrenOf.has(bct.root)) {
        layoutSubtree(bct.root, 0, 0);
    } else {
        // Defensive fallback: shouldn't happen if C++ always emits BCT_BEGIN root=...
        let i = 0;
        for (const n of bct.nodes) positions.set(n.id, { x: i++, level: 0 });
    }

    const X_UNIT = 70;
    const Y_UNIT = 70;

    const visNodes = new vis.DataSet(bct.nodes.map(n => {
        const p = positions.get(n.id) || { x: 0, level: 0 };
        if (n.kind === 'block') {
            return {
                id: n.id,
                label: 'B' + n.value,
                shape: 'box',
                color: { background: blockColor(n.value), border: 'black' },
                font: { color: 'black', size: 14 },
                borderWidth: 1,
                x: p.x * X_UNIT,
                y: p.level * Y_UNIT,
                fixed: { x: true, y: true }
            };
        }
        // Cutpoint
        return {
            id: n.id,
            label: String(n.value),
            shape: 'ellipse',
            color: { background: '#76e0f5', border: 'black' },
            font: { color: 'black', size: 14 },
            borderWidth: 1,
            x: p.x * X_UNIT,
            y: p.level * Y_UNIT,
            fixed: { x: true, y: true }
        };
    }));

    const visEdges = new vis.DataSet(bct.edges.map(e => {
        const style = BCT_EDGE_STYLE[e.type] || { color: 'black', label: '?' };
        return {
            from: e.from,
            to: e.to,
            label: style.label,
            color: { color: style.color },
            font: { size: 11, color: style.color, strokeWidth: 0, align: 'middle' },
            arrows: { to: { enabled: false } },
            smooth: false,
            width: 1.5
        };
    }));

    const options = {
        layout: { hierarchical: { enabled: false }, randomSeed: 0 },
        physics: { enabled: false },
        interaction: { dragNodes: false, zoomView: true },
        autoResize: false // we refit explicitly via observeNetPanel's ResizeObserver.
    };

    const network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, options);
    network.on("doubleClick", () => network.fit());
    network.once("afterDrawing", () => network.fit());

    bctNetwork = network;
    observeNetPanel('bct-network');
    ensureBCTLegend();
}

// =============================================================================
// FPQ-tree drawing (bottom-right panel)
// =============================================================================
//
// Graphical conventions (kept consistent with the BCT panel where it makes
// sense, to ease cross-reading):
//   - F_BLOCK  (one for each biconnected block) -> rectangle filled with the
//                                                   block's chromatism color,
//                                                   label "B<i>"
//   - F_GADGET (cutpoint gadget wrapper)         -> small empty grey rectangle
//   - P_NODE   (free permutation of children)    -> light green ellipse, "P"
//   - LEAF, cutpoint vertex                      -> cyan ellipse, "<v>"
//   - LEAF, regular vertex                       -> bare text, "<v>"
//
// To distinguish "cutpoint leaf" from "regular leaf" we need to know which
// graph vertices are cutpoints: we recover that from the corresponding BCT
// passed as the second argument. By construction `bcts[i]` and `fpqs[i]`
// are paired.
//
// LAYOUT: explicit (x, y) coordinates are computed via the classic recursive
// "tidy tree" / subtree-width algorithm; vis-network's own hierarchical
// layout is disabled. The FPQ-tree is a strict tree (one parent per node,
// no cycles), so this layout produces zero crossings. It also respects the
// `pos` ordering of children, which is significant for F-nodes (and for
// P-nodes it encodes the current permutation).
//
// Algorithm:
//   - every leaf occupies one horizontal slot;
//   - every internal node is centered on the midpoint between its first and
//     its last child;
//   - children are visited in order of `pos`.
// =============================================================================

/**
 * Draw the FPQ-tree associated with the current layout.
 * @param {?{nodes:Array,edges:Array,root:number}} fpq  FPQ-tree description.
 * @param {?{nodes:Array,edges:Array,root:number}} bct  Companion BCT (used to
 *      identify which leaf values correspond to cutpoints).
 */
function drawFPQ(fpq, bct) {
    const container = document.getElementById('fpq-network');

    if (!fpq || !fpq.nodes || fpq.nodes.length === 0) {
        // See note in drawBCT: do not clobber a placeholder already defined
        // in the HTML; the HTML is the single source of truth for this text.
        if (!container.querySelector('.placeholder')) {
            container.innerHTML =
                '<div class="placeholder">Upload Graph File and press Compute Layouts to visualize the FPQ tree for the current layout.</div>';
        }
        setFPQPanelHeight(300); // back to the standard panel height.
        fpqNetwork = null;
        return;
    }

    container.innerHTML = '';

    // Set of cutpoint vertex values, recovered from the companion BCT.
    const cutpointValues = new Set();
    if (bct && bct.nodes) {
        for (const n of bct.nodes) {
            if (n.kind === 'cutpoint') cutpointValues.add(n.value);
        }
    }

    // --- Build children index, sorted by `pos`. ----------------------------
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

    // --- Recursive tidy-tree layout. ---------------------------------------
    // positions: id -> { x, level } in abstract coordinates (slot = 1 unit).
    const positions = new Map();

    function layoutSubtree(nodeId, depth, xStart) {
        const children = childrenOf.get(nodeId) || [];
        if (children.length === 0) {
            const c = xStart + 0.5; // center the leaf inside its slot.
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
        // Fallback: if for any reason there is no clear root, place nodes
        // arbitrarily (this should not happen in practice).
        let i = 0;
        for (const n of fpq.nodes) {
            positions.set(n.id, { x: i++, level: 0 });
        }
    }

    // Pixels per horizontal / vertical slot. Increase X_UNIT if nodes look
    // too close, Y_UNIT if the levels are too squashed together.
    const X_UNIT = 60;
    const Y_UNIT = 75;

    // Size the FPQ panel to the tree's vertical extent: a small (shallow) tree
    // keeps the standard panel height, a deep tree gets a taller panel (up to a
    // cap) so it is drawn larger instead of being zoomed down to fit. The width
    // is left to the grid column (kept fixed so the two bottom panels stay
    // aligned); very wide trees are handled by network.fit() + pan/zoom.
    let maxLevel = 0;
    for (const p of positions.values()) if (p.level > maxLevel) maxLevel = p.level;
    const STD_H = 300, MAX_H = 840, CHROME = 64;
    let targetH = (maxLevel + 2) * Y_UNIT + CHROME;
    targetH = Math.max(STD_H, Math.min(MAX_H, targetH));
    setFPQPanelHeight(targetH);

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
                    color: { background: blockColor(n.blockIndex), border: 'black' },
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
        smooth: false, // straight lines look better in a clean tree layout.
        width: 1
    })));

    const options = {
        layout: { hierarchical: { enabled: false }, randomSeed: 0 },
        physics: { enabled: false },
        interaction: { dragNodes: false, zoomView: true },
        autoResize: false // we refit explicitly via observeNetPanel's ResizeObserver.
    };

    const network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, options);
    network.on("doubleClick", () => network.fit());
    // Auto-fit zoom to the panel size on the first draw.
    network.once("afterDrawing", () => network.fit());

    fpqNetwork = network;
    observeNetPanel('fpq-network');
}

// =============================================================================
// PNG Download buttons
// =============================================================================
//
// Each of the 3 graphic panels (1-stack layout, BCT, FPQ) gets a small button
// in its top-right corner that saves the panel's canvas as a PNG file. The
// pre-existing "Download Image" label in the controls panel (which used to
// save only the 1-stack layout via a hidden input + #canvasImg anchor) is
// repurposed in place to trigger the download of all 3 panels at once: it
// keeps its `.btn-left` styling, font, background, position, and the camera
// icon to the right of the label, but its text is changed and its click
// handler is rewired.
//
// Buttons are wired via JS (idempotent, same pattern as ensureBCTLegend), so
// no changes are required in either index.html.
//
// Filename convention: `<prefix>-<k>.png` where k is the 1-based layout number
// shown in the navigation bar ("layout X of Y"). Examples for layout 17:
//   layout-17.png   bct-17.png   fpq-17.png
// =============================================================================

/**
 * Ensure a download button is present in each graphic panel and that the
 * existing "Download Image" label has been repurposed to download all 3
 * panels. Idempotent.
 */
function ensureDownloadButtons() {
    addPanelDownloadButton('network',     'Download 1-stack layout as PNG', 'layout');
    addPanelDownloadButton('bct-network', 'Download BCT as PNG',            'bct');
    addPanelDownloadButton('fpq-network', 'Download FPQ tree as PNG',       'fpq');
    repurposeImageDownloadButton();
}

/**
 * Inject a small download button in the top-right corner of the panel that
 * hosts the given vis-network container. The panel is given `position:relative`
 * (if it isn't already) so the absolutely-positioned button anchors to it.
 * @param {string} containerId    ID of the vis-network container element.
 * @param {string} title          Tooltip / accessible label.
 * @param {string} fileNamePrefix Prefix for the generated filename.
 */
function addPanelDownloadButton(containerId, title, fileNamePrefix) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const panel = container.parentElement;
    if (!panel) return;
    if (panel.querySelector('.panel-download-btn')) return; // already added
    const cs = window.getComputedStyle(panel);
    if (!cs.position || cs.position === 'static') panel.style.position = 'relative';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'panel-download-btn';
    btn.title = title;
    btn.textContent = '\u2B07 PNG'; // down arrow + PNG
    btn.style.cssText =
        'position:absolute; top:6px; right:8px; z-index:5; ' +
        'font-size:11px; padding:2px 8px; cursor:pointer; ' +
        'background:#ffffff; border:1px solid #cccccc; border-radius:3px;';
    btn.addEventListener('click', () => downloadPanelImage(containerId, fileNamePrefix));
    panel.appendChild(btn);
}

/**
 * Take over the visible "Download Image" control in the controls panel and
 * turn it into the trigger for downloading all 3 panel images at once.
 *
 * The visible control is the <label for="imageDownload" class="btn-left">.
 * It carries the .btn-left CSS class (so box / font / background / position
 * are defined by styles.css) and a Font Awesome camera icon to the right of
 * the label text. We modify the label IN PLACE so all of this styling is
 * preserved exactly:
 *   - drop the `for` attribute so clicking no longer fires the hidden
 *     #imageDownload input that drove the old single-image download path;
 *   - update the <span class="btn-text"> text to "Download all images";
 *   - keep the existing camera icon (or restore it defensively);
 *   - install a click listener that calls downloadAllPanels().
 *
 * The hidden helper input (#imageDownload) and the helper anchor (#canvasImg)
 * are no longer needed and are tidied up: the input is removed, the anchor
 * stays in the DOM (drawLayout's afterDrawing handler keeps referring to it
 * by id) but is emptied, stripped of its `download` attribute and hidden.
 *
 * The dataset flag prevents duplicate wiring on repeated calls.
 */
function repurposeImageDownloadButton() {
    const label = document.querySelector('label[for="imageDownload"]');
    if (!label) return;
    if (label.dataset.repurposed === '1') return;

    // Disarm the native label->input click forwarding.
    label.removeAttribute('for');

    // Update the visible text; the camera icon next to it stays in place.
    const textSpan = label.querySelector('.btn-text');
    if (textSpan) textSpan.textContent = 'Download all images';

    // Defensive: ensure the icon is the camera one (it already is per the
    // current HTML, but this makes the wiring resilient to small markup
    // changes).
    const icon = label.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-camera fa-lg';

    // Now route clicks to our handler.
    label.style.cursor = 'pointer';
    label.addEventListener('click', (e) => {
        e.preventDefault();
        downloadAllPanels();
    });
    label.dataset.repurposed = '1';

    // Tidy up the now-dead helper input that used to forward clicks to the
    // anchor. Removing it is safe because nothing else references it.
    const hidden = document.getElementById('imageDownload');
    if (hidden) hidden.remove();

    // Keep #canvasImg in the DOM because drawLayout's afterDrawing handler
    // still calls document.getElementById('canvasImg').href = dataURL on each
    // redraw; calling it on a missing element would throw. We just make sure
    // it has no content and isn't visible.
    const anchor = document.getElementById('canvasImg');
    if (anchor) {
        anchor.textContent = '';
        anchor.removeAttribute('download');
        anchor.style.display = 'none';
    }
}

/**
 * Save the canvas drawn inside a given vis-network container as a PNG file.
 * No-op if the canvas hasn't been rendered yet (e.g. before the WASM has run
 * for the BCT/FPQ panels). The filename is `<prefix>-<k>.png` with k = 1-based
 * layout number (matches the "layout X of Y" display).
 * @param {string} containerId  ID of the vis-network container element.
 * @param {string} prefix       Filename prefix.
 */
function downloadPanelImage(containerId, prefix) {
    const canvas = document.querySelector('#' + containerId + ' canvas');
    if (!canvas) {
        console.warn('downloadPanelImage: no canvas in #' + containerId +
                     ' (panel not rendered yet)');
        return;
    }
    const k = (typeof currentIndex === 'number' && currentIndex >= 0)
              ? (currentIndex + 1) : 0;
    const filename = prefix + '-' + k + '.png';
    const dataURL = canvas.toDataURL('image/png');
    triggerImageDownload(dataURL, filename);
}

/**
 * Download all 3 graphic panels of the currently displayed layout as three
 * separate PNG files. Panels that haven't been rendered yet are skipped (a
 * warning is logged for each).
 *
 * Note: some browsers (notably Chrome) ask the user to allow multiple
 * downloads from the same site the first time this happens. Accept and the
 * three files will arrive in the usual download folder.
 */
function downloadAllPanels() {
    const targets = [
        { container: 'network',     prefix: 'layout' },
        { container: 'bct-network', prefix: 'bct'    },
        { container: 'fpq-network', prefix: 'fpq'    }
    ];
    let downloaded = 0;
    for (const t of targets) {
        if (document.querySelector('#' + t.container + ' canvas')) {
            downloadPanelImage(t.container, t.prefix);
            downloaded++;
        } else {
            console.warn('downloadAllPanels: skipping #' + t.container +
                         ' (no canvas rendered)');
        }
    }
    if (downloaded === 0) {
        console.warn('downloadAllPanels: nothing to download \u2014 run an ' +
                     'enumeration first (Compute Layouts).');
    }
}

/**
 * Create a hidden anchor and click it to save a data URL as a file. The
 * anchor lives in the DOM only long enough to be activated, then is removed.
 * @param {string} dataURL   Data URL produced by HTMLCanvasElement.toDataURL.
 * @param {string} filename  Filename presented to the user in the save dialog.
 */
function triggerImageDownload(dataURL, filename) {
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// --- Wiring ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    ensureDownloadButtons();
});
// =============================================================================
// Ranking / Unranking controls
// =============================================================================
//
// The C++ enumerator (see main_enum.cpp / main()) emits every layout in a
// fixed canonical order:
//
//     for each rooting rho in `rootings` (in order):
//         for each permutation pi (lexicographic, via std::next_permutation
//                                  on the cutpoint children in BFS order):
//             emit layout(rho, pi)
//
// Therefore the position of a layout in the parallel arrays `layouts[]`,
// `bcts[]`, `fpqs[]` IS its rank. Consequences (all O(1), pure JS, no need to
// touch the C++):
//   - RANK    (current layout -> integer): `currentIndex`.
//   - UNRANK  (integer k -> layout): set `currentIndex = k` and redraw.
//
// The set of layouts sharing the same rooting is exactly one contiguous run in
// the arrays. Grouping `bcts[]` by the *root block* of each entry recovers the
// rootings: each run is one admissible root block, and its length is the number
// of permutations of that rooting (N_rho = product of the factorials of the
// P-node sizes). This is what feeds the segmented bar:
//   - one segment per admissible root block,
//   - segment width proportional to its layout count,
//   - segment colored with the block-chromatism color (same color the block
//     gets in the BCT and as F_BLOCK in the FPQ tree),
//   - segment labeled "B<i>" with its inclusive rank range "<start>-<end>".
//
// Identifiers shown in the UI are 1-based, matching the "layout X of Y"
// navigation bar at the bottom: the rank readout, the unrank range and the
// segment ranges all use the same numbering as the arrows, so the numbers line
// up exactly. Internally `currentIndex` and the group start/end stay 0-based
// (they index the parallel arrays); the +1 is applied only at display time, and
// the unrank input is converted back with -1. (Note: the Di Battista/Grosso/
// Maragno/Patrignani ranking paper uses 0-based ranks; switching back is just a
// matter of dropping the +1/-1 offsets here.)
// =============================================================================

/**
 * Groups of consecutive layouts sharing the same rooting (admissible root
 * block). Rebuilt lazily from `bcts[]`. Each entry:
 *   { rootBlock:<blockIndex>, start:<firstRank>, count:<n>, end:<lastRank> }
 * @type {Array<{rootBlock:number,start:number,count:number,end:number}>}
 */
var rootingGroups = [];

/** `bcts.length` the groups were last built for (cache key). @type {number} */
var rootingGroupsForLength = -1;

/** `rootingGroupsForLength` the bar segments were last rendered for. */
var rankBarBuiltForLength = -2;

/**
 * Total number of enumerated layouts currently available. After "Compute
 * Layouts" this equals `bcts.length`; for the initial hard-coded demo (no
 * WASM, empty `bcts`) it falls back to `numberOfLayouts`.
 * @returns {number}
 */
function rankTotal() {
    return (bcts.length > 0) ? bcts.length : numberOfLayouts;
}

/**
 * Root block index of a given BCT entry. The BCT root TreeNode is a block node
 * whose `value` is the biconnected-block index (same index used by
 * `blockColor` and by the FPQ F_BLOCK nodes). Falls back to the FPQ root's
 * `blockIndex` if, for any reason, the BCT root node is not a block.
 * @param {{root:number,nodes:Array}} bct  BCT description.
 * @param {number} i                       Index into the parallel arrays.
 * @returns {number} Block index, or -1 if undeterminable.
 */
function rootBlockValueOf(bct, i) {
    if (bct && bct.nodes != null && bct.root != null) {
        for (const n of bct.nodes) {
            if (n.id === bct.root) {
                if (n.kind === 'block') return n.value;
                break;
            }
        }
    }
    const fpq = fpqs[i];
    if (fpq && fpq.nodes) {
        for (const n of fpq.nodes) {
            if (n.id === fpq.root && n.type === 'F_BLOCK') return n.blockIndex;
        }
    }
    return -1;
}

/**
 * (Re)build `rootingGroups` from `bcts[]` if the data changed since last time.
 * Cheap to call on every refresh: it no-ops unless `bcts.length` changed.
 */
function rebuildRootingGroupsIfNeeded() {
    if (bcts.length === rootingGroupsForLength && rootingGroups.length > 0) return;
    rootingGroupsForLength = bcts.length;
    rootingGroups = [];
    for (let i = 0; i < bcts.length; i++) {
        const rb = rootBlockValueOf(bcts[i], i);
        const last = rootingGroups[rootingGroups.length - 1];
        if (!last || last.rootBlock !== rb) {
            rootingGroups.push({ rootBlock: rb, start: i, count: 1 });
        } else {
            last.count++;
        }
    }
    for (const g of rootingGroups) g.end = g.start + g.count - 1;
}

/**
 * Decompose a global rank into (rooting, perm).
 * @param {number} k Global 0-based rank.
 * @returns {?{rooting:number,perm:number,rootBlock:number,count:number}}
 *          null if k is outside every group.
 */
function decomposeRank(k) {
    for (let r = 0; r < rootingGroups.length; r++) {
        const g = rootingGroups[r];
        if (k >= g.start && k <= g.end) {
            return { rooting: r, perm: k - g.start, rootBlock: g.rootBlock, count: g.count };
        }
    }
    return null;
}

/**
 * Compose a (rooting, perm) pair back into a global rank.
 * @param {number} rooting Index into `rootingGroups`.
 * @param {number} perm    Permutation index within that rooting.
 * @returns {number} Global rank, or -1 if either index is out of range.
 */
function composeRank(rooting, perm) {
    if (rooting < 0 || rooting >= rootingGroups.length) return -1;
    const g = rootingGroups[rooting];
    if (perm < 0 || perm >= g.count) return -1;
    return g.start + perm;
}

/**
 * Parse the unrank text field. Accepts a single global rank, e.g. "17".
 * @param {string} text Raw input.
 * @returns {{ok:true,k:number}|{ok:false,msg:string}}
 */
function parseUnrank(text) {
    const t = String(text).trim();
    if (t === '') return { ok: false, msg: 'Empty input' };
    const m = t.match(/^(\d+)$/);
    if (m) return { ok: true, k: parseInt(m[1], 10) };
    return { ok: false, msg: 'Enter a whole number' };
}

/**
 * Jump to the layout of a given global rank, redrawing all panels. The wrapped
 * `updateStatistics` (see below) refreshes the ranking UI as a side effect.
 * @param {number} k Global 0-based rank.
 * @returns {boolean} true if the jump happened, false if k was out of range.
 */
function goToLayout(k) {
    const N = rankTotal();
    if (!(Number.isInteger(k) && k >= 0 && k < N)) return false;
    currentIndex = k;
    updateStatistics();
    drawLayout(graph, layouts[currentIndex]);
    drawBCT(bcts[currentIndex]);
    drawFPQ(fpqs[currentIndex], bcts[currentIndex]);
    return true;
}

// --- UI ----------------------------------------------------------------------

/**
 * Inject styling for the Controls panel (#buttons): shrink the control buttons
 * (.btn-left) so the whole content — including the ranking section — fits inside
 * the fixed-height panel without overflowing. All .btn-left buttons share the
 * rule, so they stay equal in size to one another. An id selector (#buttons ...)
 * overrides whatever the .btn-left rules in styles.css set, so this needs no
 * change to the stylesheet. Idempotent.
 */
function ensureControlsPanelStyle() {
    if (document.getElementById('controls-style')) return;
    const st = document.createElement('style');
    st.id = 'controls-style';
    st.textContent =
        // Compact, uniformly-sized control buttons.
        '#buttons .btn-left{padding:5px 10px;font-size:13px;line-height:1.2;' +
        'min-height:0;height:auto;margin-bottom:6px;}' +
        '#buttons .btn-left i{font-size:1em;}' +
        '#buttons #fileName{margin:4px 0;font-size:12px;}';
    (document.head || document.documentElement).appendChild(st);
}

/**
 * Inject the ranking/unranking controls into the bottom of the Controls panel
 * (#buttons), below the download buttons. Idempotent (same pattern as
 * ensureBCTLegend / ensureDownloadButtons), so no changes are needed in either
 * index.html. The segmented bar, the rank readout and the unrank input are all
 * built here once; their dynamic content is refreshed by refreshRankUI().
 */
function ensureRankingControls() {
    if (document.getElementById('ranking-controls')) return;
    const host = document.getElementById('buttons');
    if (!host) return;

    const wrap = document.createElement('div');
    wrap.id = 'ranking-controls';
    wrap.style.cssText =
        'margin-top:8px; padding-top:8px; border-top:1px solid #ddd; ' +
        'font-family:sans-serif; color:#222;';

    const title = document.createElement('div');
    title.textContent = 'Ranking / Unranking';
    title.style.cssText = 'font-weight:600; margin-bottom:2px;';
    wrap.appendChild(title);

    const sub = document.createElement('div');
    sub.textContent = 'Permutation map \u2014 one segment per admissible root block';
    sub.style.cssText = 'font-size:11px; color:#666; margin-bottom:4px;';
    wrap.appendChild(sub);

    // Segmented bar + position marker.
    const barWrap = document.createElement('div');
    barWrap.id = 'rank-bar-wrap';
    barWrap.style.cssText = 'position:relative; margin:4px 0 8px;';

    const bar = document.createElement('div');
    bar.id = 'rank-bar';
    bar.style.cssText =
        'display:flex; height:32px; border:1px solid #bbb; ' +
        'border-radius:4px; overflow:hidden; background:#f3f3f3;';
    barWrap.appendChild(bar);

    const marker = document.createElement('div');
    marker.id = 'rank-marker';
    marker.style.cssText =
        'position:absolute; top:-4px; height:40px; width:0; ' +
        'transform:translateX(-50%); pointer-events:none; ' +
        'border-left:2px solid #111; display:none;';
    const tri = document.createElement('div');
    tri.style.cssText =
        'position:absolute; top:-1px; left:-4px; width:0; height:0; ' +
        'border-left:4px solid transparent; border-right:4px solid transparent; ' +
        'border-top:6px solid #111;';
    marker.appendChild(tri);
    barWrap.appendChild(marker);

    wrap.appendChild(barWrap);

    // Rank readout + inline navigation arrows (so you can step through layouts
    // without scrolling down to the bottom navigation bar).
    const rankRow = document.createElement('div');
    rankRow.style.cssText = 'margin-bottom:8px;';

    const rankLbl = document.createElement('div');
    rankLbl.textContent = 'Rank (current layout)';
    rankLbl.style.cssText = 'font-size:13px; margin-bottom:2px;';

    const navRow = document.createElement('div');
    navRow.style.cssText =
        'display:flex; align-items:center; justify-content:center; gap:10px; ' +
        'background:#fafafa; border:1px solid #e0e0e0; border-radius:3px; padding:3px 6px;';

    const prevBtn = document.createElement('button');
    prevBtn.id = 'rank-prev';
    prevBtn.type = 'button';
    prevBtn.title = 'Previous layout';
    prevBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
    prevBtn.style.cssText =
        'border:none; background:transparent; cursor:pointer; ' +
        'font-size:15px; padding:2px 8px; color:#08175a;';

    const rankVal = document.createElement('span');
    rankVal.id = 'rank-current';
    rankVal.innerHTML = '&mdash;';
    rankVal.style.cssText =
        'font-family:monospace; font-size:13px; min-width:96px; text-align:center;';

    const nextBtn = document.createElement('button');
    nextBtn.id = 'rank-next';
    nextBtn.type = 'button';
    nextBtn.title = 'Next layout';
    nextBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
    nextBtn.style.cssText =
        'border:none; background:transparent; cursor:pointer; ' +
        'font-size:15px; padding:2px 8px; color:#08175a;';

    navRow.appendChild(prevBtn);
    navRow.appendChild(rankVal);
    navRow.appendChild(nextBtn);

    const rankDetail = document.createElement('div');
    rankDetail.id = 'rank-detail';
    rankDetail.style.cssText =
        'font-size:11px; color:#666; text-align:center; min-height:14px; margin-top:3px;';

    rankRow.appendChild(rankLbl);
    rankRow.appendChild(navRow);
    rankRow.appendChild(rankDetail);
    wrap.appendChild(rankRow);

    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) goToLayout(currentIndex - 1);
    });
    nextBtn.addEventListener('click', () => {
        if (currentIndex < rankTotal() - 1) goToLayout(currentIndex + 1);
    });

    // Unrank input.
    const unrankRow = document.createElement('div');
    const unrankLbl = document.createElement('label');
    unrankLbl.setAttribute('for', 'unrank-input');
    unrankLbl.style.cssText = 'display:block; font-size:13px; margin-bottom:2px;';
    unrankLbl.innerHTML =
        'Unrank <span style="color:#666;">(go to rank <span id="unrank-hint">&mdash;</span>)</span>';
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex; gap:6px; align-items:center;';
    const input = document.createElement('input');
    input.id = 'unrank-input';
    input.type = 'text';
    input.placeholder = 'e.g. 10';
    input.style.cssText = 'flex:1 1 auto; min-width:0; padding:4px 6px;';
    const goBtn = document.createElement('button');
    goBtn.id = 'unrank-go';
    goBtn.type = 'button';
    goBtn.textContent = 'Go';
    goBtn.style.cssText = 'flex:0 0 auto; padding:4px 12px; cursor:pointer;';
    inputRow.appendChild(input);
    inputRow.appendChild(goBtn);
    const err = document.createElement('div');
    err.id = 'unrank-error';
    err.style.cssText = 'color:#b71c1c; font-size:12px; min-height:14px; margin-top:2px;';
    unrankRow.appendChild(unrankLbl);
    unrankRow.appendChild(inputRow);
    unrankRow.appendChild(err);
    wrap.appendChild(unrankRow);

    host.appendChild(wrap);

    // Wiring.
    goBtn.addEventListener('click', handleUnrank);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleUnrank(); }
    });
}

/**
 * Rebuild the segments of the rank bar from `rootingGroups`. One flex child per
 * rooting, width proportional to its layout count, filled with the block color
 * and labeled "B<i>" plus its inclusive rank range. Clicking a segment jumps to
 * the first layout of that rooting. When no structure is available yet (initial
 * demo, before Compute Layouts) a single hint cell is shown instead.
 */
function renderRankBarSegments() {
    const bar = document.getElementById('rank-bar');
    if (!bar) return;
    bar.innerHTML = '';

    if (rootingGroups.length === 0) {
        const ph = document.createElement('div');
        ph.textContent = 'Run "Compute Layouts" to see the rooting structure';
        ph.style.cssText =
            'flex:1 1 auto; display:flex; align-items:center; justify-content:center; ' +
            'font-size:11px; color:#888; padding:0 6px; text-align:center;';
        bar.appendChild(ph);
        return;
    }

    rootingGroups.forEach((g, idx) => {
        const seg = document.createElement('div');
        seg.className = 'rank-seg';
        seg.style.cssText =
            'flex:' + g.count + ' 1 0; min-width:0; box-sizing:border-box; ' +
            'border-right:' + (idx < rootingGroups.length - 1 ? '1px solid rgba(0,0,0,.35)' : 'none') + '; ' +
            'background:' + blockColor(g.rootBlock) + '; ' +
            'display:flex; flex-direction:column; align-items:center; justify-content:center; ' +
            'cursor:pointer; overflow:hidden; padding:2px 1px; line-height:1.15;';
        seg.title =
            'Rooting ' + (idx + 1) + ': initial block B' + g.rootBlock +
            ' \u2014 ranks ' + (g.start + 1) + '\u2013' + (g.end + 1) + ' (' + g.count + ' layouts)';

        const lbl = document.createElement('div');
        lbl.textContent = 'B' + g.rootBlock;
        lbl.style.cssText = 'font-weight:700; font-size:12px; color:#000; white-space:nowrap;';

        const rng = document.createElement('div');
        rng.textContent = (g.start + 1) + '\u2013' + (g.end + 1);
        rng.style.cssText = 'font-size:10px; color:#000; opacity:.75; white-space:nowrap;';

        seg.appendChild(lbl);
        seg.appendChild(rng);
        seg.addEventListener('click', () => goToLayout(g.start));
        bar.appendChild(seg);
    });
}

/**
 * Move the position marker to the current layout and highlight the current
 * segment. The marker's horizontal position is (currentIndex + 0.5) / N across
 * the whole bar: because each segment's flex weight equals its layout count,
 * one layout maps to one equal slice of the bar width, so this percentage lands
 * exactly on the current layout's slot regardless of segment sizes.
 */
function updateRankMarker() {
    const marker = document.getElementById('rank-marker');
    if (!marker) return;
    const N = rankTotal();
    if (N <= 0 || currentIndex < 0 || rootingGroups.length === 0) {
        marker.style.display = 'none';
    } else {
        marker.style.display = 'block';
        marker.style.left = ((currentIndex + 0.5) / N * 100) + '%';
    }

    const bar = document.getElementById('rank-bar');
    if (bar) {
        const d = (currentIndex >= 0) ? decomposeRank(currentIndex) : null;
        let idx = 0;
        for (const seg of bar.children) {
            if (seg.classList && seg.classList.contains('rank-seg')) {
                seg.style.boxShadow = (d && d.rooting === idx) ? 'inset 0 0 0 2px #111' : 'none';
                idx++;
            }
        }
    }
}

/**
 * Refresh all dynamic parts of the ranking UI: rebuild groups/segments if the
 * dataset changed, update the unrank range hint, the rank readout (both the
 * 0-based rank and the decomposed rooting/perm form plus the 1-based "layout X
 * of Y"), and reposition the marker. Safe to call any time; no-ops if the UI
 * has not been injected yet.
 */
function refreshRankUI() {
    if (!document.getElementById('ranking-controls')) return;

    rebuildRootingGroupsIfNeeded();
    if (rankBarBuiltForLength !== rootingGroupsForLength) {
        renderRankBarSegments();
        rankBarBuiltForLength = rootingGroupsForLength;
    }

    const N = rankTotal();

    const hint = document.getElementById('unrank-hint');
    if (hint) hint.textContent = (N > 0) ? ('1 \u2013 ' + N) : '\u2014';

    const rc = document.getElementById('rank-current');
    const detail = document.getElementById('rank-detail');
    if (rc) {
        if (currentIndex < 0 || N === 0) {
            rc.innerHTML = '&mdash;';
            if (detail) detail.textContent = '';
        } else {
            // Display is 1-based to match the "layout X of Y" navigation bar.
            rc.textContent = 'rank ' + (currentIndex + 1) + ' of ' + N;
            const d = decomposeRank(currentIndex);
            if (detail) {
                detail.textContent = d
                    ? ('initial block B' + d.rootBlock +
                       ' \u00b7 perm ' + (d.perm + 1) + ' of ' + d.count)
                    : '';
            }
        }
    }

    // Enable/disable the inline navigation arrows at the ends.
    const prevBtn = document.getElementById('rank-prev');
    const nextBtn = document.getElementById('rank-next');
    const atStart = !(currentIndex > 0);
    const atEnd = !(currentIndex >= 0 && currentIndex < N - 1);
    if (prevBtn) {
        prevBtn.disabled = atStart;
        prevBtn.style.opacity = atStart ? '0.35' : '1';
        prevBtn.style.cursor = atStart ? 'default' : 'pointer';
    }
    if (nextBtn) {
        nextBtn.disabled = atEnd;
        nextBtn.style.opacity = atEnd ? '0.35' : '1';
        nextBtn.style.cursor = atEnd ? 'default' : 'pointer';
    }

    updateRankMarker();
}

/**
 * Handle a click on "Go" (or Enter in the input): parse the field, validate the
 * resulting rank against the available range, and jump. Errors are shown inline
 * in #unrank-error.
 */
function handleUnrank() {
    const input = document.getElementById('unrank-input');
    const err = document.getElementById('unrank-error');
    if (!input) return;
    const res = parseUnrank(input.value);
    if (!res.ok) { if (err) err.textContent = res.msg; return; }
    const N = rankTotal();
    // Input is 1-based (matches the navigation bar); convert to a 0-based index.
    const idx = res.k - 1;
    if (!(idx >= 0 && idx < N)) {
        if (err) err.textContent = 'Out of range (1\u2013' + N + ')';
        return;
    }
    if (err) err.textContent = '';
    goToLayout(idx);
}

// --- Hook into updateStatistics so the UI refreshes on Run / Next / Prev -----
// updateStatistics() is already called from every navigation path, so wrapping
// it keeps the ranking UI in sync without touching those listeners. The guard
// makes the wrap idempotent (defensive against the patcher double-append issue
// documented in HANDOVER_3).
if (typeof updateStatistics === 'function' && !updateStatistics.__rankWrapped) {
    const _baseUpdateStatistics = updateStatistics;
    updateStatistics = function () {
        _baseUpdateStatistics.apply(this, arguments);
        try { refreshRankUI(); } catch (e) { /* UI not built yet; ignore */ }
    };
    updateStatistics.__rankWrapped = true;
}

// =============================================================================
// FPQ panel auto-sizing
// =============================================================================
//
// The 2x2 grid (#grid in styles.css) uses fixed 420px rows, and .panel has
// overflow:hidden, so a tall FPQ tree would be squashed/zoomed to fit inside
// the fixed cell. To let big trees breathe, we:
//   1. let the bottom grid row grow (grid-template-rows: 420px minmax(420px,
//      auto)) via an injected stylesheet (an id selector overrides styles.css,
//      and the responsive media query is replicated so single-column layout
//      still works);
//   2. set an explicit min-height on the FPQ panel proportional to the tree
//      depth (drawFPQ), clamped between the standard height and a cap;
//   3. refit both bottom networks whenever their panel is resized, via a
//      ResizeObserver, so the BCT panel (which shares the row and therefore the
//      new height) stays visually aligned and both trees re-center smoothly.
// =============================================================================

/**
 * Inject the stylesheet that lets the bottom grid row grow with its content.
 * Idempotent. An id selector overrides the fixed rows declared in styles.css;
 * the max-width:900px media query is replicated so the single-column responsive
 * layout keeps working (with the FPQ row, the 4th one, allowed to grow).
 */
function ensureFPQResizeStyle() {
    if (document.getElementById('fpq-resize-style')) return;
    const st = document.createElement('style');
    st.id = 'fpq-resize-style';
    st.textContent =
        '#grid{grid-template-rows:420px minmax(420px,auto);}' +
        '@media (max-width:900px){#grid{' +
        'grid-template-rows:auto 380px 380px minmax(380px,auto);}}';
    (document.head || document.documentElement).appendChild(st);
}

/**
 * Set the min-height of the FPQ panel (the .panel wrapping #fpq-network). With
 * the growable bottom row this drives how tall the panel — and the shared row —
 * becomes. A CSS transition makes the change smooth; the ResizeObserver refits
 * the networks live during the animation.
 * @param {number} px Target panel min-height in pixels.
 */
function setFPQPanelHeight(px) {
    const c = document.getElementById('fpq-network');
    if (!c || !c.parentElement) return;
    const panel = c.parentElement;
    if (panel.style.transition.indexOf('min-height') === -1) {
        panel.style.transition = 'min-height 0.25s ease';
    }
    panel.style.minHeight = px + 'px';
}

/**
 * Resize a vis Network's canvas to fill its (possibly resized) container and
 * re-fit the graph into view. No-op if the network is null or the call throws.
 * @param {?object} net A vis.Network instance.
 */
function refitNetwork(net) {
    if (!net) return;
    try {
        net.setSize('100%', '100%');
        net.redraw();
        net.fit();
    } catch (e) { /* network destroyed / not ready; ignore */ }
}

/**
 * Observe a network panel (.net container) and refit its current network
 * whenever the container is resized (e.g. when the FPQ panel grows and the
 * shared bottom row changes height). Set up at most once per container; the
 * observer reads the current global network instance each time, so it keeps
 * working across redraws. Falls back to a no-op if ResizeObserver is missing.
 * @param {string} containerId 'bct-network' or 'fpq-network'.
 */
function observeNetPanel(containerId) {
    observeNetPanel._seen = observeNetPanel._seen || {};
    if (observeNetPanel._seen[containerId]) return;
    if (typeof ResizeObserver === 'undefined') { observeNetPanel._seen[containerId] = true; return; }
    const c = document.getElementById(containerId);
    if (!c) return;
    const ro = new ResizeObserver(() => {
        const net = (containerId === 'fpq-network') ? fpqNetwork
                  : (containerId === 'bct-network') ? bctNetwork : null;
        refitNetwork(net);
    });
    ro.observe(c);
    observeNetPanel._seen[containerId] = true;
}

// --- Wiring ------------------------------------------------------------------

(function () {
    function init() {
        ensureControlsPanelStyle();
        ensureFPQResizeStyle();
        ensureRankingControls();
        refreshRankUI();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// =============================================================================
// Auto-compute on upload
// =============================================================================
// Drop the separate "Compute Layouts" step: hide the #run button and run the
// computation as soon as a graph file is chosen, by programmatically clicking
// the (now hidden) #run button, which already holds the full compute + redraw
// logic. JS-only; index.html is left untouched.
// =============================================================================
(function () {
    function hideRunButton() {
        if (document.getElementById('auto-run-style')) return;
        const st = document.createElement('style');
        st.id = 'auto-run-style';
        // !important beats the inline display:block the change-listener sets.
        st.textContent = '#run{display:none !important;}';
        (document.head || document.documentElement).appendChild(st);
    }
    function init() {
        hideRunButton();
        const fileInput = document.getElementById('fileInput');
        const run = document.getElementById('run');
        if (!fileInput || !run) return;
        fileInput.addEventListener('change', function () {
            // Defer so the pre-existing change-listener (#fileName) runs first.
            setTimeout(function () { run.click(); }, 0);
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// =============================================================================
// Task 3: show the failure reason in the 1-stack layout panel
// =============================================================================
// When the DAG admits no 1-stack layout the C++ explains why on stdout (it is
// otherwise only logged). We capture that reason and render it inside #network
// (top-right) instead of leaving the panel blank.
// =============================================================================

var lastLayoutError = null;

/** Map a raw C++ stdout line to a friendly reason, or null if not a known one. */
function matchLayoutError(msg) {
    if (msg.indexOf('not outerplanar') !== -1)
        return 'The graph is not outerplanar, so it admits no 1-page book embedding.';
    if (msg.indexOf('exactly one source and one sink') !== -1)
        return 'A biconnected component does not have exactly one source and one sink.';
    if (msg.indexOf('Hamiltonian path') !== -1)
        return 'A biconnected component has no Hamiltonian path on its outer face.';
    if (msg.indexOf('no admissible root') !== -1)
        return 'No admissible root block exists for this DAG.';
    return null;
}

/** Render an error message inside the #network (1-stack layout) panel. */
function showLayoutErrorOverlay(container, text) {
    container.innerHTML =
        '<div class="placeholder" style="color:#b71c1c; font-weight:600; ' +
        'padding:0 16px; text-align:center; line-height:1.4;">' +
        'No layout could be built.<br>' +
        '<span style="font-weight:400; color:#444;">' + text + '</span></div>';
}

// Capture the reason as the WASM emits it (reset at the start of each run).
if (typeof getDataFromWasm === 'function' && !getDataFromWasm.__errWrapped) {
    const _baseGetData = getDataFromWasm;
    getDataFromWasm = function (message) {
        try {
            if (typeof message === 'string') {
                if (message.indexOf('---- PHASE 1 BEGIN ----') !== -1) lastLayoutError = null;
                const er = matchLayoutError(message);
                if (er) lastLayoutError = er;
            }
        } catch (e) { /* ignore */ }
        return _baseGetData.apply(this, arguments);
    };
    getDataFromWasm.__errWrapped = true;
}

// When an empty layout is drawn, show the captured reason (or a generic one).
if (typeof drawLayout === 'function' && !drawLayout.__errWrapped) {
    const _baseDrawLayoutErr = drawLayout;
    drawLayout = function (g, l) {
        _baseDrawLayoutErr.apply(this, arguments);
        const container = document.getElementById('network');
        if (container && (!l || l.length === 0)) {
            showLayoutErrorOverlay(container,
                lastLayoutError || 'The DAG admits no valid 1-stack layout.');
        }
    };
    drawLayout.__errWrapped = true;
}

// =============================================================================
// Task 4: better use of screen space
// =============================================================================
//   1. Adaptive columns: the left column (Controls + BCT) is kept narrower
//      than the right (1-stack layout + FPQ, which benefit from width); the
//      right side widens further as the graph grows.
//   2. The grid fills the viewport: the TOP row grows to absorb the wasted
//      space; the bottom row stays minmax(420px, auto) so the FPQ auto-sizing
//      keeps working untouched.
// Below 900px the responsive single-column rules take over (inline cleared).
// =============================================================================

var _gridSizingNodes = -2;

function ensureGridGapStyle() {
    if (document.getElementById('grid-gap-style')) return;
    const st = document.createElement('style');
    st.id = 'grid-gap-style';
    st.textContent = '#grid{gap:10px;}';
    (document.head || document.documentElement).appendChild(st);
}

/** Column template for a node count: left 0.40 (small) -> 0.30 (large). */
function adaptiveColumns(nodeCount) {
    const n = Math.max(1, nodeCount | 0);
    let leftFrac = 0.30 - (n - 8) * 0.006;
    leftFrac = Math.max(0.24, Math.min(0.30, leftFrac));
    return (leftFrac * 100).toFixed(1) + '% ' + ((1 - leftFrac) * 100).toFixed(1) + '%';
}

/** Apply adaptive columns + viewport-filling rows (inline beats the stylesheet). */
function applyGridSizing() {
    const grid = document.getElementById('grid');
    if (!grid) return;

    if (window.innerWidth <= 900) {
        grid.style.gridTemplateColumns = '';
        grid.style.gridTemplateRows = '';
    } else {
        // col1 (Controls + BCT) stretta; col2 (FPQ) e col3 (layout) larghe.
        grid.style.gridTemplateColumns = 'minmax(220px, 0.85fr) 1.4fr 1.4fr';

        const gridTop = grid.getBoundingClientRect().top;
        const footer = document.getElementById('footer');
        const footerH = footer ? footer.offsetHeight : 0;
        const margin = 8, gap = 10;
        const gridH = Math.max(520, window.innerHeight - gridTop - footerH - margin);
        const controlsH = 210;                       // riga piccola del Controls (tune)
        const bottomH = gridH - controlsH - gap;
        grid.style.gridTemplateRows = controlsH + 'px ' + bottomH + 'px';
    }

    fitControlsContent();
    try { refitNetwork(typeof bctNetwork !== 'undefined' ? bctNetwork : null); } catch (e) {}
    try { refitNetwork(typeof fpqNetwork !== 'undefined' ? fpqNetwork : null); } catch (e) {}
}

(function () {
    let t = null;
    function onResize() { clearTimeout(t); t = setTimeout(applyGridSizing, 120); }
    function init() {
        ensureGridGapStyle();
        applyGridSizing();
        window.addEventListener('resize', onResize);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    // Re-apply columns when the current graph's node count changes.
    if (typeof drawLayout === 'function' && !drawLayout.__gridWrapped) {
        const _baseDrawLayoutGrid = drawLayout;
        drawLayout = function (g, l) {
            _baseDrawLayoutGrid.apply(this, arguments);
            const n = (g && g.nodes) ? g.nodes.length : -1;
            if (n !== _gridSizingNodes && window.innerWidth > 900) applyGridSizing();
        };
        drawLayout.__gridWrapped = true;
    }
})();

// =============================================================================
// Layout polish: full-width grid + Controls panel that never clips (issues 1 & 3)
// =============================================================================
(function () {
    function ensureLayoutPolishStyle() {
        if (document.getElementById('layout-polish-style')) return;
        const st = document.createElement('style');
        st.id = 'layout-polish-style';
        st.textContent =
            '#container{padding:16px 20px;}' +
            '#grid{max-width:none;}' +
            '#buttons{overflow-y:auto; overflow-x:hidden; justify-content:flex-start;}' +
            '#buttons-up, #buttons-down{flex-wrap:nowrap;}' +
            '#ranking-controls, #ranking-controls *{box-sizing:border-box;}' +
            '#ranking-controls input{max-width:100%;}';
        (document.head || document.documentElement).appendChild(st);
        if (typeof applyGridSizing === 'function') setTimeout(applyGridSizing, 0);
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', ensureLayoutPolishStyle);
    else ensureLayoutPolishStyle();
})();

// =============================================================================
// Compact chrome: smaller top nav bar + slimmer footer (less scrolling).
// =============================================================================
(function () {
    function ensureChromeCompactStyle() {
        if (document.getElementById('chrome-compact-style')) return;
        const st = document.createElement('style');
        st.id = 'chrome-compact-style';
        st.textContent =
            'nav{padding:0 16px;}' +
            'nav h1{font-size:1.15rem; padding:0;}' +
            'nav ul li{padding:8px 14px;}' +
            'nav .site-brand img{height:34px !important;}' +
            '#footer{padding:1.2em 0;}';
        (document.head || document.documentElement).appendChild(st);
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', ensureChromeCompactStyle);
    else ensureChromeCompactStyle();
})();

// =============================================================================
// Controls panel: content scales to fit its box (no inner scrollbar).
// =============================================================================
function fitControlsContent() {
    try {
        const panel = document.getElementById('buttons');
        if (!panel) return;
        const title = panel.querySelector('.panel-title');
        let inner = panel.querySelector('#controls-inner');
        if (!inner) {
            inner = document.createElement('div');
            inner.id = 'controls-inner';
            inner.style.transformOrigin = 'top center';
            inner.style.width = '100%';
            panel.appendChild(inner);
        }
        // Pull every content child (not the title, not the wrapper) into inner.
        Array.from(panel.children).forEach(ch => {
            if (ch === title || ch === inner) return;
            inner.appendChild(ch);
        });
        inner.style.transform = 'scale(1)';
        const avail = panel.clientHeight - (title ? title.offsetHeight : 0) - 24;
        const need = inner.scrollHeight;
        const k = (need > avail && need > 0) ? Math.max(0.6, avail / need) : 1;
        inner.style.transform = 'scale(' + k + ')';
    } catch (e) { /* ignore */ }
}

(function () {
    function ensureControlsFitStyle() {
        if (document.getElementById('controls-fit2-style')) return;
        const st = document.createElement('style');
        st.id = 'controls-fit2-style';
        st.textContent =
            '#buttons{overflow:hidden;}' +                                  // no scrollbar
            '#buttons .btn-left{padding:4px 9px; font-size:12px; margin-bottom:5px;}' +
            '#ranking-controls{margin-top:8px; padding-top:8px;}';
        (document.head || document.documentElement).appendChild(st);
    }

    // Keep the FPQ panel from growing past its (now fixed) grid cell.
    if (typeof setFPQPanelHeight === 'function' && !setFPQPanelHeight.__neutralized) {
        setFPQPanelHeight = function () {
            const c = document.getElementById('fpq-network');
            if (c && c.parentElement) c.parentElement.style.minHeight = '0px';
        };
        setFPQPanelHeight.__neutralized = true;
    }

    // Re-fit the controls after the rank/segment content changes.
    if (typeof updateStatistics === 'function' && !updateStatistics.__fitWrapped) {
        const _b = updateStatistics;
        updateStatistics = function () { _b.apply(this, arguments); requestAnimationFrame(fitControlsContent); };
        updateStatistics.__fitWrapped = true;
    }

    function init() {
        ensureControlsFitStyle();
        requestAnimationFrame(fitControlsContent);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.addEventListener('resize', function () { requestAnimationFrame(fitControlsContent); });
})();

// =============================================================================
// Three-section layout: [Controls / BCT] | [FPQ] | [vertical 1-stack layout]
// Panels are reordered purely via CSS grid placement (DOM untouched).
// =============================================================================
function ensureThreeSectionStyle() {
    if (document.getElementById('three-section-style')) return;
    const st = document.createElement('style');
    st.id = 'three-section-style';
    st.textContent =
        '#grid > .panel:nth-child(1){grid-column:1;grid-row:1;}' +            // Controls  (top-left)
        '#grid > .panel:nth-child(3){grid-column:1;grid-row:2;}' +            // BCT       (bottom-left)
        '#grid > .panel:nth-child(4){grid-column:2;grid-row:1 / span 2;}' +  // FPQ       (middle, full height)
        '#grid > .panel:nth-child(2){grid-column:3;grid-row:1 / span 2;}' +  // 1-Stack   (right, full height)
        '@media (max-width:900px){#grid > .panel{grid-column:auto !important;grid-row:auto !important;}}';
    (document.head || document.documentElement).appendChild(st);
}
(function () {
    function init() {
        ensureThreeSectionStyle();
        if (typeof applyGridSizing === 'function') applyGridSizing();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();