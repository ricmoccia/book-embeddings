#include <ogdf/basic/Graph_d.h>
//#include <ogdf/basic/EdgeArray.h>
//#include <ogdf/basic/NodeArray.h>
#include <ogdf/basic/simple_graph_alg.h>
#include <ogdf/basic/extended_graph_alg.h>
#include <ogdf/decomposition/BCTree.h>
#include <ogdf/fileformats/GraphIO.h>
#include <ogdf/energybased/FMMMLayout.h>
#include <ogdf/basic/CombinatorialEmbedding.h>
#include <iostream>
#include <unordered_map>
#include <sstream>
#include <string>
#include <vector>
#include <queue>

using namespace ogdf;

class TreeNode
{
	public:
		int id;
		int value;
		bool isCutpoint;
		std::vector<TreeNode*> neighbors;
		std::unordered_map<int, std::vector<std::vector<TreeNode*>>> children;
		std::unordered_map<int, TreeNode*> parent;

		TreeNode(int idOfTreeNode, int val, bool cutpoint) {
			id = idOfTreeNode;
			value = val;
			isCutpoint = cutpoint;
		}

		TreeNode() {
			id = -1;
			value = -1;
			isCutpoint = false;
		}

		void addNeighbor(TreeNode* neighbor) {
			neighbors.push_back(neighbor);
		}

		void addChild(int treeId, TreeNode* child, int childType) {
			if (children.find(treeId) == children.end()) {
				std::vector<std::vector<TreeNode*>> newTree(3);
				children[treeId] = newTree;
			}
			children[treeId][childType].push_back(child);
		}

		void setParent(int treeId, TreeNode* parentNode) {
			parent[treeId] = parentNode;
		}

		TreeNode* getParent(int treeId) {
			if (parent.find(treeId) == parent.end()) {
				return nullptr;
			}
			return parent[treeId];
		}

		std::vector<TreeNode*> getChildren(int treeId, int childType) {
			if (children.find(treeId) == children.end()) {
				std::vector<std::vector<TreeNode*>> newTree(3);
				children[treeId] = newTree;
				return std::vector<TreeNode*>();
			}
			if (children.size() == 0) {
				return std::vector<TreeNode*>();
			}
			return children[treeId][childType];
		}

		std::vector<TreeNode*> getNeighbors() {
			return neighbors;
		}

		bool hasRooting(int treeId) {
			return !(children.find(treeId) == children.end());
		}
};

// -----------------------------------------------------------------------------
// FPQNode: nodo di un FPQ-tree.
//
// In questo contesto un FPQ-tree contiene SOLO nodi di tipo P (libera
// permutazione dei figli) e nodi di tipo F (ordine dei figli FISSO). Non
// abbiamo nodi Q. Le foglie sono vertici del grafo originale (numerici).
//
// La costruzione e' fatta da `OneStackLayoutsEnumerator::buildFPQTree(...)`
// a partire dal BCT radicato e codifica tutte e sole le permutazioni dei figli
// ai cutpoint per quella radicazione (slide BCT2FPQtree.pptx).
//
// Convenzione di disegno (lato JS, prossimo step):
//   - P_NODE       -> cerchio chiaro, label "P"
//   - F_NODE_BLOCK -> rettangolo, label "B<blockIndex>"   (corrisponde a un blocco)
//   - F_NODE_GADGET-> rettangolo vuoto                     (gadget di un cutpoint)
//   - LEAF         -> testo nudo con il valore del vertice (cutpoint o no)
//
// `blockIndex` e' valorizzato solo per F_NODE_BLOCK; per gli altri tipi vale -1.
// `value` e' valorizzato solo per LEAF; per gli altri tipi vale -1.
// -----------------------------------------------------------------------------
enum class FPQType { P_NODE, F_NODE_BLOCK, F_NODE_GADGET, LEAF };

class FPQNode {
public:
	int id;                          // univoco nell'FPQ-tree
	FPQType type;
	int value;                       // solo per LEAF: indice del vertice nel grafo
	int blockIndex;                  // solo per F_NODE_BLOCK: indice della componente
	std::vector<FPQNode*> children;  // figli in ordine (importante per F_NODE_*)

	FPQNode(int nodeId, FPQType t)
		: id(nodeId), type(t), value(-1), blockIndex(-1) {}

	void addChild(FPQNode* c) {
		children.push_back(c);
	}
};

class BCTPermutationEnumerator {
public:
    TreeNode* root;
    int treeId;
    std::unordered_map<int, std::unordered_map<int, std::vector<int>>> permutations;
    bool hasNext;

	BCTPermutationEnumerator() {
        root = nullptr;
        treeId = -1;
		hasNext = false;
    }

    BCTPermutationEnumerator(TreeNode* rootNode) {
        root = rootNode;
        treeId = rootNode->value;
		hasNext = true;
        _initialize();
    }

    bool hasNextPermutation() {
        return hasNext;
    }

    std::vector<int> getNextPermutation() {
        bool toPermute = true;
        std::vector<int> order;
        std::queue<TreeNode*> queue;
        queue.push(root);

        while (!queue.empty()) {
            TreeNode* u = queue.front();
            queue.pop();

            if (u->isCutpoint) {
                //std::cout << "nel cutpoint " << u->value << std::endl;

				for (int childType: {0, 2}) {
					std::vector<TreeNode*> children = u->getChildren(treeId, childType);

					if (children.size() > 1) {
						for (int indexOfChild: permutations[u->value][childType]) {
							queue.push(children[indexOfChild]);
						}
						if (toPermute) {
							if (std::next_permutation(permutations[u->value][childType].begin(), permutations[u->value][childType].end())) {
								toPermute = false;
							}
							else {
								std::vector<int> firstPermutation;
								for (int i = 0; i < permutations[u->value][childType].size(); i++) {
									firstPermutation.push_back(i);
								}
								permutations[u->value][childType] = firstPermutation;
							}
						}
					} else {
						for (TreeNode* child: children) {
							queue.push(child);
						}
					}
				}
            }
            else {
                //std::cout << "nella componente " << u->value << std::endl;
                order.push_back(u->value);
                for (int childType = 0; childType < 3; childType++) {
                    for (TreeNode* child: u->getChildren(treeId, childType)) {
                        queue.push(child);
                    }
                }
            }
        }

        if (toPermute) {
            hasNext = false;
        }
        return order;
    }

private:

    void _initialize() {
        std::queue<TreeNode*> queue;
        queue.push(root);

        while (!queue.empty()) {
            TreeNode* u = queue.front();
            queue.pop();

            if (u->isCutpoint) {

                std::vector<TreeNode*> sourceChildren = u->getChildren(treeId, 0);
                if (sourceChildren.size() > 1) {
                    std::vector<int> permutation;
                    for (int i = 0; i < sourceChildren.size(); i++) {
                        permutation.push_back(i);
                    }
                    permutations[u->value][0] = permutation;
                    std::cout << "il cutpoint " << u->value << " ha " << permutation.size() << " figli sorgente permutabili" << std::endl;
                }

                std::vector<TreeNode*> sinkChildren = u->getChildren(treeId, 2);
                if (sinkChildren.size() > 1) {
                    std::vector<int> permutation;
                    for (int i = 0; i < sinkChildren.size(); i++) {
                        permutation.push_back(i);
                    }
                    permutations[u->value][2] = permutation;
                    std::cout << "il cutpoint " << u->value << " ha " << permutation.size() << " figli pozzo permutabili" << std::endl;
                }
                
            }
			for (int childType = 0; childType < 3; childType++) {
				for (TreeNode* child: u->getChildren(treeId, childType)) {
					queue.push(child);
				}
			}
        }
    }
};

class OneStackLayoutsEnumerator {
	public:
		Graph* G;

		OneStackLayoutsEnumerator() {
			G = nullptr;
		}

		OneStackLayoutsEnumerator(Graph* graph) {
			G = graph;
			_initialize();
		}

		bool hasNext() {
			if (numberOfOneStackLayouts == 0) {
				return false;
			}
			return enumerator.hasNextPermutation() || currentRooting < rootings.size() - 1;
		}

		Array<int, int> getNext() {
			
			if (!enumerator.hasNextPermutation()) {
				currentRooting++;
				if (currentRooting > rootings.size() - 1) {
					return Array<int, int>();
				}
				rootBCT(treeNodeOfComponent[rootings[currentRooting]]);
				enumerator = BCTPermutationEnumerator(treeNodeOfComponent[rootings[currentRooting]]);
			}

			std::vector<int> order = enumerator.getNextPermutation();

			std::cout << "MARCATORE_TEST_FUNZIONA: questo non era nel codice prima" << std::endl;

			std::cout << "ORDINE BLOCCHI: ";
			for (int block: order) {
				std::cout << " " << block;
			}
			std::cout << std::endl;

			// NUOVO: emetti il BCT della radicazione corrente, cosi' il frontend
			// puo' visualizzare albero-e-layout in coppia.
			printBCT(treeNodeOfComponent[rootings[currentRooting]]);

			// NUOVO (Step D): costruisci e stampa l'FPQ-tree corrispondente.
			// L'FPQ-tree dipende solo dal RADICAMENTO, non dalla permutazione corrente
			// dei figli ai cutpoint. Lo costruiamo comunque ad ogni getNext() per
			// semplicita' (e' O(|V|) sul BCT); volendo si potrebbe cachare e
			// ricostruirlo solo quando currentRooting cambia.
			FPQNode* fpqRoot = buildFPQTree(treeNodeOfComponent[rootings[currentRooting]]);
			printFPQ(fpqRoot);
			cleanupFPQ();

			Array<int, int> result = mergeLayouts(&order, treeNodeOfComponent[rootings[currentRooting]]);
			resultsCounter++;

			return result;
		}

		int numberOfLayouts() {
			return numberOfOneStackLayouts;
		}

	private:
		Array<Graph, int> biconnectedComponentsGraphs;
		int numberOfBiconnectedComponents;
		Array<Array<node, int>, int> sourceAndSinkOfComponents;
		Array<Array<int, int>, int> topologicalOrders;
		std::unordered_map<int, std::vector<int>> componentsOfNode;
		std::vector<int> cutpoints;
		Array<TreeNode*, int> treeNodeOfComponent;
		std::vector<int> orderOfComponents;
		std::vector<int> rootings;
		BCTPermutationEnumerator enumerator;
		int resultsCounter;
		int currentRooting;
		int numberOfOneStackLayouts;

		void _initialize() {
			std::cout << "---- INIZIO FASE 1 ----" << std::endl;
			std::cout << "il grafo ha " << G->numberOfNodes() << " nodi e " << G->numberOfEdges() << " archi" << std::endl;

			numberOfOneStackLayouts = 0;

			// verifica se il grafo è outerplanare
			if (!isOuterPlanar(G)) {
				std::cout << "il grafo non è outerplanare" << std::endl;
				std::cout << "---- FINE FASE 1 ----" << std::endl;
				return;
			}

			// calcolo delle componenti biconnesse
			biconnectedComponentsGraphs = getBiconnectedComponentsGraphs(G);
			numberOfBiconnectedComponents = biconnectedComponentsGraphs.size();

			// verifica se ogni componente ha una sola sorgente e un solo pozzo
			if (!getSourceAndSinkOfComponents()) {
				return;
			}

			// verifica se esiste un cammino hamiltoniano sulla outerface di ogni componente biconnessa
			if (!checkHamiltonianPaths()) {
				return;
			}

			// commentata linea 185 del file NodeArray.h "OGDF_ASSERT(v->graphOf() == m_pGraph);"
			// ottieni l'ordine topologico di ogni componente biconnessa
			topologicalOrders = getTopologicalOrders();

			std::cout << "---- FINE FASE 1 ----" << std::endl << std::endl;

			std::cout << "---- INIZIO FASE 2 ----" << std::endl;

			// componentsOfNode è una mappa di vettori che contengono per ogni nodo le componenti a cui esso appartiene

			// popola componentsOfNode
			for (int i = 0; i < numberOfBiconnectedComponents; i++) {
				for (node v : biconnectedComponentsGraphs[i].nodes) {
					componentsOfNode[v->index()].push_back(i);
				}
			}

			// per memorizzare quali sono i cutpoint di ogni componente

			// trova i cutpoint
			for (node v: G->nodes) {
				if (componentsOfNode[v->index()].size() > 1) {
					cutpoints.push_back(v->index());
				}
			}

			// treeNodeOfComponent è una mappa che restituisce il TreeNode dal valore del TreeNode
			treeNodeOfComponent = createBCT();

			// -----------------------------------------------------------------------------
			// RIFORMULAZIONE (R.Moccia): calcolo diretto delle radici ammissibili.
			// Sostituisce la coppia computeRestrictions + findOtherRoots dell'algoritmo
			// originale di Carlini. Un blocco B e' una radice ammissibile se la sua
			// sorgente locale s(B) puo' comparire come primo vertice globale in almeno
			// un 1-stack layout. Per la Proposizione A questo equivale a:
			//   1) s(B) ha indegree 0 nel grafo originale (nessun blocco "sta sempre prima")
			//   2) nessun cammino nel BCT etichettato 2-0-2-0... (o collegamento diretto)
			//      che termina con un lato 1 (nessun blocco "sta sempre sopra"), che
			//      equivale a dire che radicando il BCT in B nessun cutpoint ha un
			//      blocco figlio collegato con etichetta 1 (cutpoint ristretto).
			// Se nessun blocco soddisfa queste condizioni, il DAG non ammette 1-stack
			// layout (questo include anche il caso delle coppie conflittuali di cutpoint).
			// -----------------------------------------------------------------------------
			rootings = findAdmissibleRoots();

			if (rootings.empty()) {
				std::cout << "nessuna radice ammissibile: il DAG non ammette 1-stack layout" << std::endl;
				std::cout << "---- FINE FASE 2 ----" << std::endl;
				return;
			}

			std::cout << "RADICI AMMISSIBILI (insieme R): ";
			for (int root: rootings) {
				std::cout << root << " ";
			}
			std::cout << std::endl;

			// scelgo la prima radice ammissibile come radicamento iniziale
			int rootBlock = rootings[0];
			TreeNode* rootOfBCT = treeNodeOfComponent[rootBlock];
			// rootBCT e' idempotente: se findAdmissibleRoots ha gia' radicato per
			// rootBlock, questa chiamata non rifa nulla.
			rootBCT(rootOfBCT);

			resultsCounter = 0;

			std::cout << "################################### BCT RADICATO NELLA COMPONENTE " << rootBlock << std::endl;
	
			enumerator = BCTPermutationEnumerator(rootOfBCT);
			currentRooting = 0;

			numberOfOneStackLayouts = getNumberOfLayouts();
			return;
		}

		bool isOuterPlanar(Graph* G) {
			node dummyNode = G->newNode();
			for (node v : G->nodes) {
				G->newEdge(dummyNode, v);
			}
			if (isPlanar(*G)) {
				G->delNode(dummyNode);
				return true;
			}
			return false;
		}

		bool hasHamiltonianPath(int source, int sink, std::unordered_map<int, std::vector<int>>* adj, int targetSize) {
			if (source == sink){
				return targetSize == 1;
			}
			bool result = false;
			for (int target: (*adj)[source]) {
				result = result || hasHamiltonianPath(target, sink, adj, targetSize - 1);
			}
			return result;
		}

		Array<node, int> getSourceAndSink(Graph* G)
		{
			Array<node, int> nullResult({nullptr, nullptr});
			Array<node, int> sourceAndSink({nullptr, nullptr});

			for (node v : G->nodes) {
				if (v->indeg() == 0) {
					if (sourceAndSink[0] != nullptr) {
						return nullResult;
					}
					else {
						sourceAndSink[0] = v;
					}
				}
				if (v->outdeg() == 0) {
					if (sourceAndSink[1] != nullptr) {
						return nullResult;
					}
					else {
						sourceAndSink[1] = v;
					}
				}
			}
			return sourceAndSink;
		}

		Array<int, int> mergeLayouts(std::vector<int>* orderOfComponents, TreeNode* rootOfBCT) {
			
			Array<int, int> currentLayout = topologicalOrders[(*orderOfComponents)[0]];

			// fusione dei layout delle componenti biconnesse
			for (int i = 1; i < orderOfComponents->size(); i++) {
				int component = (*orderOfComponents)[i];

				//std::cout << "layout attuale: ";
				//printArray(currentLayout);

				Array<int, int> orderToAdd = topologicalOrders[component];
				int cutpoint = treeNodeOfComponent[component]->getParent(rootOfBCT->value)->value;

				//std::cout << "la componente " << component << " è collegata al grafo G_" << i << " tramite il cutpoint " << cutpoint << std::endl;
				//printArray(orderToAdd);

				int newLayoutSize = currentLayout.size() + orderToAdd.size() - 1;
				Array<int, int> newLayout(newLayoutSize);

			
				if (cutpoint == sourceAndSinkOfComponents[component][0]->index()) {
					//std::cout << "CASISTICA SORGENTE" << std::endl;
					int j = 0;
					while (j < currentLayout.size()) {
						if (currentLayout[j] != cutpoint) {
							newLayout[j] = currentLayout[j];
						} 
						else {
							newLayout[j] = currentLayout[j];
							j++;
							break;
						}
						j++;
					}
					for (int k = 1; k < orderToAdd.size(); k++) {
						newLayout[j + k - 1] = orderToAdd[k];
					}
					while (j < currentLayout.size()) {
						newLayout[j + orderToAdd.size() - 1] = currentLayout[j];
						j++;
					}
				}
				else if (cutpoint == sourceAndSinkOfComponents[component][1]->index()){
					//std::cout << "CASISTICA POZZO" << std::endl;
					int j = 0;
					if (cutpoint != currentLayout[0]) {
						while (j + 1 < currentLayout.size()) {
							if (currentLayout[j + 1] != cutpoint) {
								newLayout[j] = currentLayout[j];
							} 
							else {
								newLayout[j] = currentLayout[j];
								j++;
								break;
							}
							j++;
						}
					}			
					for (int k = 0; k < orderToAdd.size() - 1; k++) {
						newLayout[j + k] = orderToAdd[k];
					}
					while (j < currentLayout.size()) {
						newLayout[j + orderToAdd.size() - 1] = currentLayout[j];
						j++;
					}
				}
				
				currentLayout = newLayout;
			}
			return currentLayout;
		}

		Array<Graph, int> getBiconnectedComponentsGraphs(Graph* G) {
			EdgeArray<int> edgeArray = EdgeArray<int>(*G);

			int numberOfBiconnectedComponents = biconnectedComponents(*G, edgeArray);
			std::cout << "il grafo ha " << numberOfBiconnectedComponents << " componenti biconnesse" << std::endl;

			Array<Graph, int> biconnectedComponentsGraphs(numberOfBiconnectedComponents);

			Array<Graph, int> test;
			test.init(numberOfBiconnectedComponents);
			test[0] = *G;

			Array<std::unordered_map<int, node>, int> biconnectedComponentsNodeMaps(numberOfBiconnectedComponents);

			int edgeIndex = 0;
			for (edge e: G->edges) {
				std::cout << "edge,component = " << edgeIndex << "," << edgeArray[e] << std::endl;
				edgeIndex++;
			}

			for (edge e: G->edges) {
				// commentata linea 187 del file EdgeArray.h "OGDF_ASSERT(e->graphOf() == m_pGraph);"
				Graph* currentGraph = &biconnectedComponentsGraphs[edgeArray[e]];
				std::unordered_map<int, node>* currentMap = &biconnectedComponentsNodeMaps[edgeArray[e]];

				int u_index = e->source()->index();
				int v_index = e->target()->index();

				if (currentMap->find(u_index) == currentMap->end()) {
					(*currentMap)[u_index] = currentGraph->newNode(u_index);
				}
				if (currentMap->find(v_index) == currentMap->end()) {
					(*currentMap)[v_index] = currentGraph->newNode(v_index);
				}

				currentGraph->newEdge((*currentMap)[u_index], (*currentMap)[v_index]);
			}

			return biconnectedComponentsGraphs;
		}

		bool getSourceAndSinkOfComponents() {
			sourceAndSinkOfComponents.init(biconnectedComponentsGraphs.size());

			// verifica se ogni componente ha una sola sorgente e un solo pozzo
			for (int i = 0; i < biconnectedComponentsGraphs.size(); i++) {
				//draw(&biconnectedComponentsGraphs[i], "Component" + to_string(i) + ".svg" );

				Array<node, int> sourceAndSink = getSourceAndSink(&biconnectedComponentsGraphs[i]);
				//std::cout << "componente " << i << ": sorgente " << sourceAndSink[0] << ", pozzo " << sourceAndSink[1] << std::endl;

				if (sourceAndSink[0] != nullptr && sourceAndSink[1] != nullptr) {
					sourceAndSinkOfComponents[i] = sourceAndSink;
				}
				else {
					std::cout << "la componente biconnessa " << i << " non ha una sola sorgente e un solo pozzo" << std::endl;
					std::cout << "---- FINE FASE 1 ----" << std::endl;
					return false;
				}
			}
			return true;
		}

		bool checkHamiltonianPaths() {
			for (int i = 0; i < sourceAndSinkOfComponents.size(); i++) {
				node source = sourceAndSinkOfComponents[i][0];
				node sink = sourceAndSinkOfComponents[i][1];

				std::unordered_map<int, std::vector<int>> adj;
				for (edge e: biconnectedComponentsGraphs[i].edges) {
					adj[e->source()->index()].push_back(e->target()->index());
				}

				bool found = false;
				for (int target: adj[source->index()]){
					if (target == sink->index()) {
						found = true;
						break;
					}
				}
				bool hasHamiltonian = hasHamiltonianPath(source->index(), sink->index(), &adj, biconnectedComponentsGraphs[i].numberOfNodes());
				if (!found || !hasHamiltonian) {
					std::cout << "la componente biconnessa " << i << " non contiene un cammino hamiltoniano sulla outerface" << std::endl;
					std::cout << "---- FINE FASE 1 ----" << std::endl;
					return false;
				}
			}
			return true;
		}

		Array<Array<int, int>, int> getTopologicalOrders() {
			Array<Array<int, int>, int> topologicalOrders(biconnectedComponentsGraphs.size());

			// calcolo dell'ordine topologico dei nodi di ogni componente biconnessa
			for (int i = 0; i < biconnectedComponentsGraphs.size(); i++) {
				NodeArray<int> nodeArray = NodeArray<int>(biconnectedComponentsGraphs[i]);
				topologicalNumbering(biconnectedComponentsGraphs[i], nodeArray);

				Array<int, int> topologicalOrder(biconnectedComponentsGraphs[i].numberOfNodes());

				for (node v : biconnectedComponentsGraphs[i].nodes) {
					topologicalOrder[nodeArray[v]] = v->index();
				}

				topologicalOrders[i] = topologicalOrder;

				std::cout << "ordine topologico della componente " << i << ": ";
				std::cout << "[";
				int j = 0;
				while (j < topologicalOrders[i].size() - 1) {
					std::cout << topologicalOrders[i][j] << ", ";
					j++;
				}
				std::cout << topologicalOrders[i][j] << "]" << std::endl;
			}
			return topologicalOrders;
		}

		Array<TreeNode*, int> createBCT() {
			Array<TreeNode*, int> treeNodeOfComponent(numberOfBiconnectedComponents);

			int idOfTreeNode = 0;

			// creazione dei TreeNode per le componenti
			for (int i = 0; i < numberOfBiconnectedComponents; i++) {
				TreeNode* componentTreeNode = new TreeNode(idOfTreeNode, i, false);
				treeNodeOfComponent[i] = componentTreeNode;

				idOfTreeNode++;
			}

			// creazione dei TreeNode per i cutpoint
			for (int cutpoint : cutpoints) {
				TreeNode* cutpointTreeNode = new TreeNode(idOfTreeNode, cutpoint, true);

				// collegamento dei TreeNode rappresentanti i cutpoint alle componenti di cui i cutpoint fanno parte
				for (int component : componentsOfNode[cutpoint]) {
					cutpointTreeNode->addNeighbor(treeNodeOfComponent[component]);
					treeNodeOfComponent[component]->addNeighbor(cutpointTreeNode);
					//std::cout << "il cutpoint " << cutpoint << " è stato collegato alla componente " << treeNodeOfComponent[component]->value << std::endl;
				}
				idOfTreeNode++;
			}

			std::cout << "costruito il BCT contenente " << cutpoints.size() << " cutpoint e " << numberOfBiconnectedComponents << " componenti biconnesse" << std::endl;
			return treeNodeOfComponent;
		}

		std::vector<int> rootBCT(TreeNode* rootOfBCT, int parentCutpoint = -1) {
			std::unordered_map<int, bool> visited;
			std::queue<TreeNode*> queue;

			// ordine delle componenti
			std::vector<int> orderOfComponents;

			visited[rootOfBCT->id] = true;
			queue.push(rootOfBCT);

			bool existsRooting = rootOfBCT->hasRooting(rootOfBCT->value);

			// BST sul BCT non radicato per radicarlo e trovare l'ordine delle componenti (grado di libertà)
			while (!queue.empty()) {
				TreeNode* u = queue.front();
				queue.pop();
				if (!u->isCutpoint) {
					orderOfComponents.push_back(u->value);
				}

				// esplora tutti i nodi adiacenti e salva i figli del nodo (grado di libertà sull'ordine)
				for (TreeNode* neighbor : u->neighbors) {
					if (!visited[neighbor->id]) {
						visited[neighbor->id] = true;
						queue.push(neighbor);
						if (!existsRooting) {
							int childrenType = -1;
							if (neighbor->isCutpoint) {
								if (sourceAndSinkOfComponents[u->value][0]->index() == neighbor->value) {
									childrenType = 0; // sorgente
								}
								else if (sourceAndSinkOfComponents[u->value][1]->index() == neighbor->value) {
									childrenType = 2; // pozzo
								}
								else {
									childrenType = 1; // intermedio
								}
							}
							else {
								if (sourceAndSinkOfComponents[neighbor->value][0]->index() == u->value) {
									childrenType = 0;
								}
								else if (sourceAndSinkOfComponents[neighbor->value][1]->index() == u->value) {
									childrenType = 2;
								}
								else {
									childrenType = 1;
								}
								neighbor->setParent(rootOfBCT->id, u);
							}
							u->addChild(rootOfBCT->id, neighbor, childrenType);
						}
					}
				}
			}
			return orderOfComponents;
		}

		// -----------------------------------------------------------------------------
		// printBCT: stampa il BCT radicato in `root` su stdout in un formato
		// parsabile dal frontend JS. Viene chiamato in getNext() prima di emettere
		// il RESULT, in modo che ogni layout sia preceduto dal BCT che lo ha
		// generato (il BCT puo' cambiare tra un layout e l'altro perche' la
		// permutazione dei figli ai cutpoint non cambia la struttura, ma il
		// passaggio a un nuovo radicamento si').
		//
		// Formato emesso (una riga per messaggio):
		//   BCT_BEGIN root=<id>
		//   BCT_NODE id=<id> kind=<block|cutpoint> value=<v>
		//   ... (un BCT_NODE per ogni nodo del BCT, in ordine BFS)
		//   BCT_EDGE from=<id> to=<id> type=<0|1|2>
		//   ... (un BCT_EDGE per ogni arco padre->figlio nell'albero radicato)
		//   BCT_END
		//
		// dove:
		//   - <id>    e' il TreeNode::id (univoco nel BCT)
		//   - <v>     e' TreeNode::value (indice della componente per i blocchi,
		//             indice del vertice del DAG per i cutpoint)
		//   - type=0  cutpoint nel ruolo di sorgente nel blocco
		//     type=1  cutpoint intermedio
		//     type=2  cutpoint nel ruolo di pozzo nel blocco
		// -----------------------------------------------------------------------------
		void printBCT(TreeNode* root) {
			std::cout << "BCT_BEGIN root=" << root->id << std::endl;

			std::queue<TreeNode*> q;
			std::unordered_map<int, bool> visited;

			// Pass 1: emette tutti i nodi in ordine BFS.
			q.push(root);
			visited[root->id] = true;
			while (!q.empty()) {
				TreeNode* u = q.front();
				q.pop();
				std::cout << "BCT_NODE id=" << u->id
						<< " kind=" << (u->isCutpoint ? "cutpoint" : "block")
						<< " value=" << u->value << std::endl;
				for (int childType = 0; childType < 3; childType++) {
					for (TreeNode* child : u->getChildren(root->value, childType)) {
						if (!visited[child->id]) {
							visited[child->id] = true;
							q.push(child);
						}
					}
				}
			}

			// Pass 2: emette tutti gli archi padre->figlio con il loro tipo.
			visited.clear();
			q.push(root);
			visited[root->id] = true;
			while (!q.empty()) {
				TreeNode* u = q.front();
				q.pop();
				for (int childType = 0; childType < 3; childType++) {
					for (TreeNode* child : u->getChildren(root->value, childType)) {
						if (!visited[child->id]) {
							visited[child->id] = true;
							std::cout << "BCT_EDGE from=" << u->id
									<< " to=" << child->id
									<< " type=" << childType << std::endl;
							q.push(child);
						}
					}
				}
			}

			std::cout << "BCT_END" << std::endl;
		}

		// =============================================================================
		// COSTRUZIONE FPQ-TREE A PARTIRE DA UN BCT RADICATO
		//
		// Riferimento: BCT2FPQtree.pptx (R.Moccia).
		//
		// Idea ricorsiva, due procedure:
		//
		//   buildFPQBlock(B, parentCutpoint):
		//     scorre i vertici di B in ordine locale (= topologicalOrders[B->value]),
		//     skip parentCutpoint (gia' rappresentato nel padre),
		//     ogni cutpoint con figli BCT diventa un gadget,
		//     gli altri vertici diventano foglie.
		//     Wrappa in F_NODE_BLOCK.
		//
		//   buildFPQCutpointGadget(c):
		//     separa i figli BCT di c in type-2 (sinistra) e type-0 (destra),
		//     espande ricorsivamente ciascun figlio con buildFPQBlock(., c),
		//     costruisce  F_NODE_GADGET( [P(type2)?] , LEAF(c) , [P(type0)?] )
		//     con tre semplificazioni:
		//       * lato vuoto: ometti il P
		//       * lato con un solo blocco: niente P, metti direttamente quel sottoalbero
		//       * (la regola sui vertici non-cutpoint e' gestita in buildFPQBlock)
		//
		// `currentRootId` (= root->id del BCT radicato corrente) e' usato per
		// interrogare TreeNode::getChildren e getParent. `nextFPQId` e
		// `allFPQNodes` tengono traccia degli id e dei nodi creati per cleanup.
		// =============================================================================

		int nextFPQId;
		std::vector<FPQNode*> allFPQNodes;

		FPQNode* makeFPQNode(FPQType t) {
			FPQNode* n = new FPQNode(nextFPQId++, t);
			allFPQNodes.push_back(n);
			return n;
		}

		FPQNode* makeFPQLeaf(int vertexValue) {
			FPQNode* n = makeFPQNode(FPQType::LEAF);
			n->value = vertexValue;
			return n;
		}

		// Espande un blocco. parentCutpointVertex == -1 per il blocco radice
		// (nessun vertice da saltare).
		FPQNode* buildFPQBlock(TreeNode* blockNode, int parentCutpointVertex, int currentRootId) {
			int blockIdx = blockNode->value;
			Array<int, int> localOrder = topologicalOrders[blockIdx];

			// Mappa: vertex_index -> TreeNode* del cutpoint, ma solo per i cutpoint
			// che sono FIGLI di blockNode in questa radicazione (e quindi vanno espansi).
			// I cutpoint figli di blockNode sono nei children di blockNode con qualsiasi
			// childType (per un blocco-padre i figli cutpoint si trovano in tutti i tipi
			// 0/1/2 a seconda del ruolo del cutpoint nel blocco).
			std::unordered_map<int, TreeNode*> cutpointChildOf;
			for (int childType = 0; childType < 3; childType++) {
				for (TreeNode* child : blockNode->getChildren(currentRootId, childType)) {
					if (child->isCutpoint) {
						cutpointChildOf[child->value] = child;
					}
				}
			}

			std::vector<FPQNode*> fChildren;
			for (int i = 0; i < localOrder.size(); i++) {
				int v = localOrder[i];

				// (1) skip del cutpoint padre: gia' rappresentato nel gadget sopra
				if (v == parentCutpointVertex) continue;

				// (2) se v e' un cutpoint figlio di blockNode in questo radicamento,
				//     espandi con il gadget
				auto it = cutpointChildOf.find(v);
				if (it != cutpointChildOf.end()) {
					FPQNode* gadget = buildFPQCutpointGadget(it->second, currentRootId);
					fChildren.push_back(gadget);
				} else {
					// (3) vertice normale (non cutpoint, o cutpoint senza figli in
					//     questo radicamento -> non puo' succedere per definizione di BCT)
					fChildren.push_back(makeFPQLeaf(v));
				}
			}

			// Nota: in una versione precedente qui semplificavamo restituendo
			// direttamente fChildren[0] quando size()==1, per "elidere" i blocchi
			// degeneri. Ora teniamo sempre l'F_NODE_BLOCK anche con un solo figlio
			// per preservare la corrispondenza 1-a-1 blocco <-> F-node e rendere
			// l'albero piu' tracciabile visivamente.

			FPQNode* f = makeFPQNode(FPQType::F_NODE_BLOCK);
			f->blockIndex = blockIdx;
			f->children = fChildren;
			return f;
		}

		// Espande un cutpoint nel suo gadget F( [P(type2)?], LEAF(c), [P(type0)?] ).
		FPQNode* buildFPQCutpointGadget(TreeNode* cutpointNode, int currentRootId) {
			int cVertex = cutpointNode->value;

			// type-2: cutpoint e' SINK del blocco figlio -> figli a SINISTRA di c
			std::vector<TreeNode*> type2Blocks = cutpointNode->getChildren(currentRootId, 2);
			// type-0: cutpoint e' SOURCE del blocco figlio -> figli a DESTRA di c
			std::vector<TreeNode*> type0Blocks = cutpointNode->getChildren(currentRootId, 0);

			FPQNode* gadget = makeFPQNode(FPQType::F_NODE_GADGET);

			// --- Lato sinistro (type-2) ---
			if (!type2Blocks.empty()) {
				std::vector<FPQNode*> leftSubtrees;
				for (TreeNode* childBlock : type2Blocks) {
					leftSubtrees.push_back(buildFPQBlock(childBlock, cVertex, currentRootId));
				}
				if (leftSubtrees.size() == 1) {
					gadget->addChild(leftSubtrees[0]);  // semplificazione: niente P se 1 solo
				} else {
					FPQNode* p = makeFPQNode(FPQType::P_NODE);
					p->children = leftSubtrees;
					gadget->addChild(p);
				}
			}

			// --- Il cutpoint c stesso ---
			gadget->addChild(makeFPQLeaf(cVertex));

			// --- Lato destro (type-0) ---
			if (!type0Blocks.empty()) {
				std::vector<FPQNode*> rightSubtrees;
				for (TreeNode* childBlock : type0Blocks) {
					rightSubtrees.push_back(buildFPQBlock(childBlock, cVertex, currentRootId));
				}
				if (rightSubtrees.size() == 1) {
					gadget->addChild(rightSubtrees[0]);
				} else {
					FPQNode* p = makeFPQNode(FPQType::P_NODE);
					p->children = rightSubtrees;
					gadget->addChild(p);
				}
			}

			return gadget;
		}

		// Entry point: costruisce e ritorna l'FPQ-tree per il BCT radicato in rootBlock.
		// Resetta lo stato interno (nextFPQId e allFPQNodes) prima di iniziare. Il
		// chiamante deve poi liberare tutto con cleanupFPQ() quando ha finito di
		// usare il tree.
		FPQNode* buildFPQTree(TreeNode* rootBlock) {
			nextFPQId = 0;
			allFPQNodes.clear();
			// il blocco radice non ha parent cutpoint -> -1
			// Nota: usiamo rootBlock->value come treeId (chiave nella map children/parent),
			// coerentemente con `printBCT` e gli altri usi nel codice. Per i blocchi
			// `id == value` per costruzione (vedi createBCT), quindi per la radice non
			// c'e' differenza, ma il resto del codice usa ->value e ci adeguiamo.
			return buildFPQBlock(rootBlock, -1, rootBlock->value);
		}

		void cleanupFPQ() {
			for (FPQNode* n : allFPQNodes) delete n;
			allFPQNodes.clear();
		}

		// -----------------------------------------------------------------------------
		// printFPQ: stampa l'FPQ-tree su stdout in un formato parallelo a printBCT,
		// parsabile dal frontend JS. Viene chiamato in getNext() subito dopo printBCT
		// in modo che ogni layout sia preceduto da BCT + FPQ.
		//
		// Formato:
		//   FPQ_BEGIN root=<id>
		//   FPQ_NODE id=<id> type=<P|F_BLOCK|F_GADGET|LEAF> [block=<i>] [value=<v>]
		//   ... (un FPQ_NODE per ogni nodo, in ordine BFS)
		//   FPQ_EDGE from=<id> to=<id> pos=<k>
		//   ... (un FPQ_EDGE per ogni arco padre->figlio, pos = indice del figlio)
		//   FPQ_END
		//
		// `pos` su FPQ_EDGE serve al frontend a disegnare i figli di un F-node
		// nell'ordine corretto (per i P-node l'ordine non e' significativo ma lo
		// stampiamo lo stesso per uniformita').
		// -----------------------------------------------------------------------------
		const char* fpqTypeToStr(FPQType t) {
			switch (t) {
				case FPQType::P_NODE: return "P";
				case FPQType::F_NODE_BLOCK: return "F_BLOCK";
				case FPQType::F_NODE_GADGET: return "F_GADGET";
				case FPQType::LEAF: return "LEAF";
			}
			return "?";
		}

		void printFPQ(FPQNode* root) {
			if (root == nullptr) {
				std::cout << "FPQ_BEGIN root=-1" << std::endl;
				std::cout << "FPQ_END" << std::endl;
				return;
			}

			std::cout << "FPQ_BEGIN root=" << root->id << std::endl;

			// Pass 1: tutti i nodi in BFS
			std::queue<FPQNode*> q;
			q.push(root);
			while (!q.empty()) {
				FPQNode* u = q.front(); q.pop();
				std::cout << "FPQ_NODE id=" << u->id
				          << " type=" << fpqTypeToStr(u->type);
				if (u->type == FPQType::F_NODE_BLOCK) {
					std::cout << " block=" << u->blockIndex;
				}
				if (u->type == FPQType::LEAF) {
					std::cout << " value=" << u->value;
				}
				std::cout << std::endl;
				for (FPQNode* c : u->children) q.push(c);
			}

			// Pass 2: tutti gli archi padre->figlio
			q.push(root);
			while (!q.empty()) {
				FPQNode* u = q.front(); q.pop();
				for (size_t k = 0; k < u->children.size(); k++) {
					FPQNode* c = u->children[k];
					std::cout << "FPQ_EDGE from=" << u->id
					          << " to=" << c->id
					          << " pos=" << k << std::endl;
					q.push(c);
				}
			}

			std::cout << "FPQ_END" << std::endl;
		}

		// -----------------------------------------------------------------------------
		// NUOVA FUNZIONE (riformulazione R.Moccia)
		// findAdmissibleRoots: calcola direttamente l'insieme R = {B | B e' una radice
		// ammissibile} senza passare per la coppia computeRestrictions + findOtherRoots.
		//
		// Per la Proposizione A, un blocco B e' una radice ammissibile se e solo se:
		//   (1) la sua sorgente locale s(B) e' una sorgente globale del DAG, ovvero
		//       ha indegree 0 nel grafo originale. Equivalentemente, s(B) deve essere
		//       sorgente in TUTTI i blocchi che la contengono (non puo' essere ne'
		//       intermedia ne' pozzo in nessun altro blocco). Questa e' la condizione
		//       "non esiste un blocco che sta sempre prima di B".
		//   (2) radicando il BCT in B nessun cutpoint ha un blocco figlio collegato
		//       con etichetta 1 (cioe' nessun cutpoint e' "ristretto"). Questa e'
		//       esattamente la condizione "non esiste un cammino nel BCT etichettato
		//       2-0-2-0... o un collegamento diretto che termina con un lato 1",
		//       cioe' "non esiste un blocco che sta sempre sopra B".
		//
		// Se R risulta vuoto allora il DAG non ammette alcun 1-stack layout; questo
		// caso comprende anche la presenza di una coppia conflittuale di cutpoint.
		// -----------------------------------------------------------------------------
		std::vector<int> findAdmissibleRoots() {
			std::vector<int> admissible;

			for (int blockIdx = 0; blockIdx < numberOfBiconnectedComponents; blockIdx++) {

				// ----------- Condizione (1): s(B) deve essere sorgente globale -----------
				// s(B) e' sorgente globale se e solo se in ogni blocco che la contiene
				// essa e' la sorgente locale (cioe' tutti i lati del BCT incidenti a s(B)
				// sono etichettati 0). Riusiamo direttamente sourceAndSinkOfComponents
				// e componentsOfNode che sono gia' stati popolati.
				int srcIndex = sourceAndSinkOfComponents[blockIdx][0]->index();
				bool isGlobalSource = true;
				for (int compIdx : componentsOfNode[srcIndex]) {
					if (sourceAndSinkOfComponents[compIdx][0]->index() != srcIndex) {
						// in qualche altro blocco s(B) non e' sorgente
						// (e' intermedia o pozzo) -> esiste un blocco che "sta sempre prima"
						isGlobalSource = false;
						break;
					}
				}
				if (!isGlobalSource) {
					std::cout << "blocco " << blockIdx << " scartato: la sua sorgente "
					          << srcIndex << " non e' una sorgente globale" << std::endl;
					continue;
				}

				// ----------- Condizione (2): nessun cutpoint ristretto radicando in B -----------
				// Radicando il BCT in blockIdx, verifico che nessun cutpoint abbia
				// un blocco figlio collegato con etichetta 1 (non c'e' un blocco
				// che "sta sempre sopra" via cammini 2-0-2-0... che terminano con 1).
				TreeNode* rootTreeNode = treeNodeOfComponent[blockIdx];
				rootBCT(rootTreeNode); // idempotente

				bool noRestriction = true;
				std::queue<TreeNode*> bfsQueue;
				bfsQueue.push(rootTreeNode);
				while (!bfsQueue.empty()) {
					TreeNode* u = bfsQueue.front();
					bfsQueue.pop();
					if (u->isCutpoint) {
						// se u (cutpoint) ha un figlio blocco collegato con etichetta 1
						// allora u e' un cutpoint ristretto: B non e' ammissibile
						if (!u->getChildren(blockIdx, 1).empty()) {
							noRestriction = false;
							break;
						}
					}
					for (int childType = 0; childType < 3; childType++) {
						for (TreeNode* child : u->getChildren(blockIdx, childType)) {
							bfsQueue.push(child);
						}
					}
				}

				if (noRestriction) {
					admissible.push_back(blockIdx);
					std::cout << "blocco " << blockIdx << " e' una radice ammissibile" << std::endl;
				}
				else {
					std::cout << "blocco " << blockIdx << " scartato: radicando in esso "
					          << "esiste un cutpoint ristretto" << std::endl;
				}
			}

			return admissible;
		}

		// Le seguenti procedure (computeRestrictions, findOtherRoots) facevano parte
		// dell'algoritmo originale di Carlini e sono state sostituite dalla nuova
		// findAdmissibleRoots. Le mantengo qui per riferimento e per non rompere
		// eventuale codice esterno che le richiamasse, ma non sono piu' usate da
		// _initialize.

		void findOtherRoots(TreeNode* treeNode, int treeId, int parentType) {
			if (treeNode->isCutpoint) {
				//std::cout << "-----------" << std::endl;
				//std::cout << "cutpoint: " << treeNode->value << ", parentType: " << parentType << std::endl;
				for (int childType = 0; childType < 3; childType++) {
					for (TreeNode* componentNode: treeNode->getChildren(treeId, childType)) {
						if (childType == parentType) {
							rootings.push_back(componentNode->value);
						}
						findOtherRoots(componentNode, treeId, childType);
					}
				}
			}
			else {
				//std::cout << "-----------" << std::endl;
				//std::cout << "componente: " << treeNode->value << ", parentType: " << parentType << std::endl;
				for (TreeNode* cutpointNode: treeNode->getChildren(treeId, 0)) {
					findOtherRoots(cutpointNode, treeId, 0);
				}
				for (TreeNode* cutpointNode: treeNode->getChildren(treeId, 2)) {
					findOtherRoots(cutpointNode, treeId, 2);
				}
			}
		}

		bool computeRestrictions(int* betterRoot) {
			
			int rootBlock = orderOfComponents[0];
			Array<bool, int> restrictedInComponent(orderOfComponents.size());
			Array<int, int> positionOfComponent(orderOfComponents.size());

			for (int i = 0; i < orderOfComponents.size(); i++) {
				positionOfComponent[orderOfComponents[i]] = i;
				restrictedInComponent[i] = false;
			}

			for (int i = orderOfComponents.size() - 1; i >= 0; i--) {
				int currentBlock = orderOfComponents[i];
				TreeNode* currentBlockTreeNode = treeNodeOfComponent[currentBlock];
				int countRestricted = 0;

				for (TreeNode* cutpointTreeNode: currentBlockTreeNode->getNeighbors()) {
					//std::cout << "analizzando cutpoint " << cutpointTreeNode->value << " nella componente " << currentBlock << std::endl;
					for (int childType = 0; childType < 3; childType++) {
						bool found = false;
						for (TreeNode* otherComponentTreeNode: cutpointTreeNode->getChildren(rootBlock, childType)) {
							int otherComponent = otherComponentTreeNode->value;
							if (positionOfComponent[otherComponent] > positionOfComponent[currentBlock]) {
								//std::cout << "il cutpoint " << cutpointTreeNode->value << " fa parte della componente " << otherComponent << std::endl;
								//std::cout << "il cutpoint " << cutpointTreeNode->value << " in " << otherComponent << " è di tipo: " << childType << std::endl;

								if (childType == 1 || restrictedInComponent[otherComponent]) {
									countRestricted++;
									restrictedInComponent[currentBlock] = true;
									//std::cout << "il cutpoint " << cutpointTreeNode->value << " è ristretto, trovato con componente " << otherComponent << std::endl;
									if (*betterRoot == -1) {
										*betterRoot = otherComponent;
									}
									found = true;
									break;
								}
							}
						}
						if (found) {
							break;
						}
					}
				}
				//std::cout << "NUMERO NODI RISTRETTI PER LA COMPONENTE " << component << ": " << countRestricted << std::endl;
				if (countRestricted > 1) {
					std::cout << "TROVATA COPPIA CONFLITTUALE" << std::endl;
					std::cout << "---- FINE FASE 2 ----" << std::endl;
					return false;
				}
			}
			return true;
		}

		// -----------------------------------------------------------------------------
		//  FIX 2: getNumberOfLayouts
		//  - Implementa la formula ESATTA della tesi (Sez. 3.2):
		//        N = Σ_{B ∈ R}  ∏_{p ∈ P(T_B)} |p|!
		//    invece di assumere |R| * single_product. Cosi il conteggio è corretto
		//    anche se per qualunque motivo il numero di permutazioni differisce tra
		//    radicamenti (la tesi sostiene siano uguali, ma calcoliamo davvero).
		//  - Richiede che il BCT sia stato radicato (con rootBCT) per ogni radice in
		//    "rootings" prima di chiamare questa funzione.
		// -----------------------------------------------------------------------------
		int getNumberOfLayouts() {
			long long total = 0;
		
			for (int rootBlockIdx : rootings) {
				TreeNode* root = treeNodeOfComponent[rootBlockIdx];
		
				// Assicurati che il BCT sia radicato per questa radice. rootBCT è
				// idempotente: se l'albero è già radicato per `root`, non rifa nulla
				// (vedi `existsRooting` in rootBCT).
				rootBCT(root);
		
				long long prod = 1;
				std::queue<TreeNode*> queue;
				queue.push(root);
		
				while (!queue.empty()) {
					TreeNode* u = queue.front();
					queue.pop();
		
					if (u->isCutpoint) {
						std::vector<TreeNode*> sourceChildren =
							u->getChildren(root->value, 0);
						for (long long n = (long long)sourceChildren.size(); n > 1; n--) {
							prod *= n;
						}
						std::vector<TreeNode*> sinkChildren =
							u->getChildren(root->value, 2);
						for (long long n = (long long)sinkChildren.size(); n > 1; n--) {
							prod *= n;
						}
					}
					for (int childType = 0; childType < 3; childType++) {
						for (TreeNode* child : u->getChildren(root->value, childType)) {
							queue.push(child);
						}
					}
				}
				total += prod;
			}
			return (int)total;
		}

		void printRestrictions(std::vector<int>* cutpoints, std::unordered_map<int, TreeNode*>* restrictingComponentOfCutpoint) {
			std::cout << "CAUSE RESTRIZIONI:" << std::endl;
			for (int cutpoint: *cutpoints) {
				if (restrictingComponentOfCutpoint->find(cutpoint) != restrictingComponentOfCutpoint->end()) {
					std::cout << "il cutpoint " << cutpoint << " è ristretto a causa della componente " << (*restrictingComponentOfCutpoint)[cutpoint]->value << std::endl;
				}
			}
		}
};

void draw(Graph* G, string fileName)
{
	GraphAttributes GA(*G, GraphAttributes::nodeGraphics |
		GraphAttributes::edgeGraphics |
        GraphAttributes::nodeLabel |
        GraphAttributes::nodeStyle |
        GraphAttributes::edgeType |
        GraphAttributes::edgeArrow |
        GraphAttributes::edgeStyle );

	for (node v : G->nodes) {
		GA.fillColor(v) = Color( "#FFDDAA" ); 
        GA.height(v) = 15.0;
        GA.width(v) = 15.0;
        GA.shape(v) = Shape::Ellipse; 

        GA.label(v) = to_string(v->index());
	}

	for (edge e : G->edges) {
        GA.arrowType(e) = ogdf::EdgeArrow::Last;
        GA.strokeColor(e) = Color("#000000");
	}

	FMMMLayout fmmm;
    fmmm.call(GA);
	
	GraphIO::drawSVG(GA, "OutputSVG-" + fileName);
}

void readGraphFromArg(Graph* G, const char* graphString)
{
	std::unordered_map<int, node> nodes;
	int i = 0;
	string current = "";
	bool readingNodes = true;
	int sourceNode = -1;

	while (graphString[i] != '\0') {
		if (graphString[i] == '\n') {
			int index = std::stoi(current);
			if (readingNodes) {
			    nodes[index] = G->newNode(index);
			}
			else {
				G->newEdge(nodes[sourceNode], nodes[index]);
			}
			current = "";
		}
		else if (graphString[i] == ',') {
			sourceNode = std::stoi(current);
			current = "";
			readingNodes = false;
		}
		else {
			current = current + graphString[i];
		}
		i++;
	}
	if (current.length() > 0) {
		int index = std::stoi(current);
		if (readingNodes) {
			nodes[index] = G->newNode(index);
		}
		else {
			G->newEdge(nodes[sourceNode], nodes[index]);
		}
	}
}

int main(int argc, char* argv[])
{
	Graph G;

	if (argc == 2) {
        //std::cout << "input string: " << argv[1] << std::endl;
		try {
			readGraphFromArg(&G, argv[1]);
			draw(&G, "DAG.svg");
			OneStackLayoutsEnumerator enumerator = OneStackLayoutsEnumerator(&G);
			std::cout << "NUMBER OF LAYOUTS: " << enumerator.numberOfLayouts() <<std::endl;
			while (enumerator.hasNext()) {
				Array<int, int> result = enumerator.getNext();

				std::cout << "RESULT: ";
				for (int n: result) {
					std::cout << n << " ";
				}
				std::cout << std::endl << std::endl;
			}
		}
		catch (const std::runtime_error& e) {
			std::cerr << "runtime error: " << e.what() << std::endl;
		}
    }
	else {
		std::cout << "error with the number of arguments (must be one string)" << std::endl;
		return 1;
	}

	return 0;
}