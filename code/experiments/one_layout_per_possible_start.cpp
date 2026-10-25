// one_layout_per_possible_start.cpp
// Compila su Windows includendo tutto il codice dal repo (main_enum.cpp) ma disabilitando il suo main.

#include <ogdf/basic/Graph.h>
#include <ogdf/basic/NodeArray.h>

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <optional>
#include <sstream>
#include <string>
#include <type_traits>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

// -------------
// Trick: includi main_enum.cpp ma rinomina il suo "main" per evitare doppio entry-point
// -------------
#define main main_enum_disabled_main
#include "main_enum.cpp"
#undef main

using ogdf::Graph;
using ogdf::node;
using ogdf::edge;

// ------------------------
// Parsing del formato "graph file examples":
// lista vertici (una riga con un numero), poi archi "u,v"
// ------------------------
static inline std::string trim(std::string s) {
    auto notSpace = [](unsigned char c){ return !std::isspace(c); };
    s.erase(s.begin(), std::find_if(s.begin(), s.end(), notSpace));
    s.erase(std::find_if(s.rbegin(), s.rend(), notSpace).base(), s.end());
    return s;
}
static inline bool isCommentOrEmpty(const std::string& line) {
    std::string t = trim(line);
    return t.empty() || t[0] == '#';
}
static bool parseInt(const std::string& s, int& out) {
    char* end=nullptr;
    long v = std::strtol(s.c_str(), &end, 10);
    if(!end || *end!='\0') return false;
    out = (int)v;
    return true;
}
static bool parseEdgeLine(const std::string& line, int& u, int& v) {
    std::string t = trim(line);
    if (t.find(',') != std::string::npos) {
        auto pos = t.find(',');
        std::string a = trim(t.substr(0,pos));
        std::string b = trim(t.substr(pos+1));
        return parseInt(a,u) && parseInt(b,v);
    } else {
        std::istringstream iss(t);
        return (iss >> u >> v);
    }
}

struct ParsedFile {
    std::vector<int> vertexLabels;
    std::vector<std::pair<int,int>> edgesLabels;
};

static ParsedFile readGraphExamplesFormat(const std::string& path) {
    std::ifstream fin(path);
    if(!fin) {
        std::cerr << "Errore: non riesco ad aprire " << path << "\n";
        std::exit(1);
    }

    ParsedFile pf;
    std::unordered_set<int> seen;

    std::string line;
    while(std::getline(fin,line)) {
        if(isCommentOrEmpty(line)) continue;
        std::string t = trim(line);

        int u,v;
        // se sembra un arco, prendilo come arco
        if(parseEdgeLine(t,u,v) && (t.find(',')!=std::string::npos)) {
            pf.edgesLabels.push_back({u,v});
            if(!seen.count(u)) { seen.insert(u); pf.vertexLabels.push_back(u); }
            if(!seen.count(v)) { seen.insert(v); pf.vertexLabels.push_back(v); }
            continue;
        }

        // altrimenti è un vertice (riga con un int)
        int x;
        if(!parseInt(t,x)) {
            std::cerr << "Errore: riga non riconosciuta: '" << t << "'\n";
            std::exit(1);
        }
        if(!seen.count(x)) { seen.insert(x); pf.vertexLabels.push_back(x); }
    }
    return pf;
}

// ------------------------
// Wrapper per metodi enumeratore (nomi diversi possibili)
// ------------------------
template <typename E>
auto enumHasNextImpl(E& e, int) -> decltype(e.hasNextLayout(), bool()) { return e.hasNextLayout(); }
template <typename E>
auto enumHasNextImpl(E& e, long) -> decltype(e.hasNext(), bool()) { return e.hasNext(); }
template <typename E>
bool enumHasNext(E& e) { return enumHasNextImpl(e, 0); }

template <typename E>
auto enumGetNextImpl(E& e, int) -> decltype(e.getNextLayout()) { return e.getNextLayout(); }
template <typename E>
auto enumGetNextImpl(E& e, long) -> decltype(e.getNext()) { return e.getNext(); }
template <typename E>
auto enumGetNextImpl(E& e, ...) -> decltype(e.next()) { return e.next(); }
template <typename E>
auto enumGetNext(E& e) { return enumGetNextImpl(e, 0); }

// ------------------------
// Layout -> label
// ------------------------
template <typename X>
static int layoutElemToLabel(const X& x,
                             const ogdf::NodeArray<int>& nodeLabel,
                             const std::vector<int>& indexToLabel) {
    if constexpr (std::is_convertible_v<X, ogdf::node>) {
        ogdf::node nd = (ogdf::node)x;
        return nodeLabel[nd];
    } else if constexpr (std::is_integral_v<std::decay_t<X>>) {
        int k = (int)x;
        if (0 <= k && k < (int)indexToLabel.size() && indexToLabel[k] != -1) return indexToLabel[k];
        return k;
    } else {
        return (int)x;
    }
}

template <typename LayoutContainer>
static std::vector<int> extractOrderLabels(const LayoutContainer& layout,
                                          const ogdf::NodeArray<int>& nodeLabel,
                                          const std::vector<int>& indexToLabel) {
    std::vector<int> out;
    for (const auto& x : layout) out.push_back(layoutElemToLabel(x, nodeLabel, indexToLabel));
    return out;
}

static void printLayout(const std::vector<int>& order) {
    for (size_t i=0;i<order.size();++i)
        std::cout << order[i] << (i+1==order.size() ? "" : " ");
    std::cout << "\n";
}

static void usage(const char* prog) {
    std::cerr << "Uso:\n"
              << "  " << prog << " <path_graph>\n"
              << "  " << prog << " <path_graph> --only <v>\n";
    std::exit(1);
}

int main(int argc, char** argv) {
    if (argc != 2 && argc != 4) usage(argv[0]);

    std::string path = argv[1];
    std::optional<int> only;
    if (argc == 4) {
        if (std::string(argv[2]) != "--only") usage(argv[0]);
        int v;
        if (!parseInt(argv[3], v)) usage(argv[0]);
        only = v;
    }

    // 1) leggi file
    ParsedFile pf = readGraphExamplesFormat(path);

    // 2) costruisci OGDF Graph e mapping label->node
    Graph G;
    std::unordered_map<int, node> labelToNode;
    labelToNode.reserve(pf.vertexLabels.size());

    // crea nodi
    for (int lab : pf.vertexLabels) {
        labelToNode[lab] = G.newNode();
    }

    // NodeArray per risalire da node al label
    ogdf::NodeArray<int> nodeLabel(G);
    for (auto& kv : labelToNode) nodeLabel[kv.second] = kv.first;

    // crea archi
    for (auto [uLab, vLab] : pf.edgesLabels) {
        G.newEdge(labelToNode.at(uLab), labelToNode.at(vLab));
    }

    // indexToLabel (se l'enumeratore restituisce indici)
    int maxIndex = -1;
    for (node nd : G.nodes) maxIndex = std::max(maxIndex, nd->index());
    std::vector<int> indexToLabel(maxIndex + 1, -1);
    for (node nd : G.nodes) indexToLabel[nd->index()] = nodeLabel[nd];

    // 3) sorgenti del DAG
    std::unordered_map<int,int> indeg;
    for (int lab : pf.vertexLabels) indeg[lab] = 0;
    for (edge e : G.edges) indeg[nodeLabel[e->target()]]++;

    std::vector<int> sources;
    for (int lab : pf.vertexLabels) if (indeg[lab] == 0) sources.push_back(lab);
    std::unordered_set<int> sourcesSet(sources.begin(), sources.end());

    // 4) enumeratore (dal codice incluso di main_enum.cpp)
    OneStackLayoutsEnumerator E(&G);

    std::unordered_map<int, std::vector<int>> oneLayoutForStart;

    while (enumHasNext(E)) {
        auto layout = enumGetNext(E);
        auto order = extractOrderLabels(layout, nodeLabel, indexToLabel);
        if (order.empty()) continue;

        int start = order.front();

        if (only.has_value()) {
            if (start == *only) {
                std::cout << "Layout trovato che inizia con " << *only << ":\n";
                printLayout(order);
                return 0;
            }
            continue;
        }

        // consideriamo "vertici iniziali possibili" = appaiono primi in almeno un one-stack layout
        if (!sourcesSet.count(start)) continue;
        if (!oneLayoutForStart.count(start)) oneLayoutForStart[start] = std::move(order);

        // ottimizzazione: se abbiamo un layout per tutte le sorgenti, possiamo fermarci
        if (oneLayoutForStart.size() == sources.size()) break;
    }

    if (only.has_value()) {
        std::cout << "Nessun layout trovato che inizi con " << *only << ".\n";
        return 0;
    }

    std::sort(sources.begin(), sources.end());

    std::vector<int> possibleStarts;
    for (auto& kv : oneLayoutForStart) possibleStarts.push_back(kv.first);
    std::sort(possibleStarts.begin(), possibleStarts.end());

    std::cout << "Sorgenti del DAG (indegree=0): ";
    for (size_t i=0;i<sources.size();++i) std::cout << sources[i] << (i+1==sources.size()?"":" ");
    std::cout << "\n";

    std::cout << "Vertici che POSSONO essere primi in un 1-page layout (trovati): ";
    for (size_t i=0;i<possibleStarts.size();++i) std::cout << possibleStarts[i] << (i+1==possibleStarts.size()?"":" ");
    std::cout << "\n\n";

    std::cout << "Un layout per ciascun vertice iniziale possibile:\n";
    for (int s : possibleStarts) {
        std::cout << "- start = " << s << " : ";
        printLayout(oneLayoutForStart[s]);
    }

    std::vector<int> impossibleSources;
    for (int s : sources) if (!oneLayoutForStart.count(s)) impossibleSources.push_back(s);
    if (!impossibleSources.empty()) {
        std::cout << "\nSorgenti che NON risultano prime in alcun one-stack layout: ";
        for (size_t i=0;i<impossibleSources.size();++i)
            std::cout << impossibleSources[i] << (i+1==impossibleSources.size()?"":" ");
        std::cout << "\n";
    }

    return 0;
}
