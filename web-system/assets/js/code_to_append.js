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
                console.error('Error while reading the file:', error);
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
    layout.forEach(label => {
        mapping.set(label, i);
        i += 1;
    });

    graph.nodes.forEach(node => {
        nodes.add({ id: mapping.get(node.label), label: node.label, x: mapping.get(node.label) * 75, y: 0 });
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
        interaction: { dragNodes: false, zoomView: true }
    };

    const network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, options);
    network.on("doubleClick", () => network.fit());
    network.once("afterDrawing", () => network.fit());

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
        interaction: { dragNodes: false, zoomView: true }
    };

    const network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, options);
    network.on("doubleClick", () => network.fit());
    // Auto-fit zoom to the panel size on the first draw.
    network.once("afterDrawing", () => network.fit());
}