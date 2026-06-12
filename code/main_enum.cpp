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

/**
 * @brief A node of the Block-Cut Tree (BCT).
 *
 * The BCT alternates two kinds of nodes:
 *   - @b block nodes (@c isCutpoint == false) represent a biconnected
 *     component of the input graph; @c value is the index of that component.
 *   - @b cutpoint nodes (@c isCutpoint == true) represent a cutpoint vertex
 *     of the input graph; @c value is the vertex index in the original DAG.
 *
 * The same TreeNode object can be re-rooted under different choices of the
 * BCT root. To support this without rebuilding the tree, parent and children
 * are stored as maps keyed by the value of the chosen root block:
 *   - @c parent[treeId]    : the parent of this node when the BCT is rooted
 *                            at the block whose value is @c treeId.
 *   - @c children[treeId]  : a 3-slot vector indexed by edge type
 *                            (0 = source, 1 = intermediate, 2 = sink) holding
 *                            the children for that rooting.
 *
 * The undirected neighbor list (@c neighbors) is independent of any rooting.
 */
class TreeNode
{
	public:
		int id;                                                                ///< Unique id of this TreeNode in the BCT.
		int value;                                                             ///< Component index (block) or vertex index (cutpoint).
		bool isCutpoint;                                                       ///< True if this node represents a cutpoint vertex.
		std::vector<TreeNode*> neighbors;                                      ///< Undirected adjacency in the BCT.
		std::unordered_map<int, std::vector<std::vector<TreeNode*>>> children; ///< children[treeId][type] -> list of children.
		std::unordered_map<int, TreeNode*> parent;                             ///< parent[treeId] -> parent in that rooting.

		/**
		 * @brief Construct a TreeNode with explicit id, value and role.
		 * @param idOfTreeNode Unique id within the BCT.
		 * @param val          Component index (block) or vertex index (cutpoint).
		 * @param cutpoint     Whether this node represents a cutpoint.
		 */
		TreeNode(int idOfTreeNode, int val, bool cutpoint) {
			id = idOfTreeNode;
			value = val;
			isCutpoint = cutpoint;
		}

		/// Default constructor, leaves the node in an invalid state.
		TreeNode() {
			id = -1;
			value = -1;
			isCutpoint = false;
		}

		/// Add @p neighbor to the undirected adjacency.
		void addNeighbor(TreeNode* neighbor) {
			neighbors.push_back(neighbor);
		}

		/**
		 * @brief Add a child for a specific rooting and edge type.
		 * @param treeId     Value of the root block of the rooting.
		 * @param child      Child TreeNode.
		 * @param childType  0 = source, 1 = intermediate, 2 = sink.
		 */
		void addChild(int treeId, TreeNode* child, int childType) {
			if (children.find(treeId) == children.end()) {
				std::vector<std::vector<TreeNode*>> newTree(3);
				children[treeId] = newTree;
			}
			children[treeId][childType].push_back(child);
		}

		/// Set the parent of this node under rooting @p treeId.
		void setParent(int treeId, TreeNode* parentNode) {
			parent[treeId] = parentNode;
		}

		/// @return The parent of this node under rooting @p treeId, or nullptr if not set.
		TreeNode* getParent(int treeId) {
			if (parent.find(treeId) == parent.end()) {
				return nullptr;
			}
			return parent[treeId];
		}

		/**
		 * @brief Get the children of this node for a given rooting and type.
		 * @param treeId     Value of the root block of the rooting.
		 * @param childType  0 = source, 1 = intermediate, 2 = sink.
		 * @return List of children (possibly empty).
		 */
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

		/// @return The undirected neighbors in the BCT.
		std::vector<TreeNode*> getNeighbors() {
			return neighbors;
		}

		/// @return True if this node has been rooted under rooting @p treeId.
		bool hasRooting(int treeId) {
			return !(children.find(treeId) == children.end());
		}
};

// =============================================================================
// FPQNode: node of an FPQ-tree.
//
// In our setting an FPQ-tree contains ONLY P-nodes (children freely
// permutable) and F-nodes (children with a FIXED order). There are no
// Q-nodes. Leaves are vertices of the original graph (numeric values).
//
// The tree is built by OneStackLayoutsEnumerator::buildFPQTree(...) starting
// from the rooted BCT and encodes all and only the orderings of the children
// at the cutpoints for that rooting (see BCT2FPQtree.pptx).
//
// Drawing convention (handled JS-side):
//   - P_NODE        -> light circle, label "P"
//   - F_NODE_BLOCK  -> rectangle, label "B<blockIndex>" (one F-node per block)
//   - F_NODE_GADGET -> empty rectangle (the gadget that expands a cutpoint)
//   - LEAF          -> plain text with the vertex value (cutpoint or not)
//
// `blockIndex` is set only for F_NODE_BLOCK; for other types it is -1.
// `value`      is set only for LEAF;        for other types it is -1.
// =============================================================================

/**
 * @brief The four kinds of nodes in an FPQ-tree.
 */
enum class FPQType {
    P_NODE,         ///< Free permutation of children.
    F_NODE_BLOCK,   ///< F-node corresponding to a biconnected block.
    F_NODE_GADGET,  ///< F-node corresponding to the gadget expanding a cutpoint.
    LEAF            ///< A leaf carrying a graph vertex index.
};

/**
 * @brief A node of the FPQ-tree.
 *
 * Each node has a unique @c id within the tree. Depending on @c type either
 * @c blockIndex (for F_NODE_BLOCK) or @c value (for LEAF) is meaningful.
 * The order of @c children is significant for F-nodes and irrelevant for
 * P-nodes (but it is kept stable for rendering).
 */
class FPQNode {
public:
	int id;                          ///< Unique id of this FPQ node.
	FPQType type;                    ///< Node kind (P / F_BLOCK / F_GADGET / LEAF).
	int value;                       ///< LEAF only: index of the graph vertex.
	int blockIndex;                  ///< F_NODE_BLOCK only: index of the component.
	std::vector<FPQNode*> children;  ///< Children in order (matters for F-nodes).

	/**
	 * @brief Construct an FPQ node of a given type.
	 * @param nodeId Unique id of this node.
	 * @param t      Node type.
	 */
	FPQNode(int nodeId, FPQType t)
		: id(nodeId), type(t), value(-1), blockIndex(-1) {}

	/// Append a child to this node (order matters for F-nodes).
	void addChild(FPQNode* c) {
		children.push_back(c);
	}
};

/**
 * @brief Enumerator of all valid orderings of the children of cutpoints in a
 *        rooted BCT.
 *
 * Given a BCT rooted at a block, every cutpoint @c c has a (possibly empty)
 * list of source-type (type-0) and sink-type (type-2) block children. The
 * children inside each of those two lists can be permuted freely; this class
 * iterates over the Cartesian product of all such permutations.
 *
 * The current state of the iteration is kept in @c permutations, indexed by
 * cutpoint value and edge type. After each call to @c getNextPermutation
 * @c permutations is advanced (lexicographically) for the next call.
 *
 * Because the advance happens DURING @c getNextPermutation, the state of
 * @c permutations at return-time no longer matches the order that was just
 * produced. To allow callers (e.g. BCT/FPQ printers) to know the permutation
 * actually used for the order they are about to render, we expose a separate
 * snapshot @c lastUsedPermutations that is filled with the state just before
 * the advance.
 */
class BCTPermutationEnumerator {
public:
    TreeNode* root;     ///< Root TreeNode of the BCT for this enumeration.
    int treeId;         ///< Value of the root block (key into TreeNode maps).

    /// permutations[cutpoint][type] -> indices [0..k-1] in current order.
    std::unordered_map<int, std::unordered_map<int, std::vector<int>>> permutations;

    /// Snapshot of @c permutations just before the last @c next_permutation
    /// advance. This is what produced the most recent @c getNextPermutation
    /// result and should be used by external consumers (BCT/FPQ printers).
    std::unordered_map<int, std::unordered_map<int, std::vector<int>>> lastUsedPermutations;

    bool hasNext;       ///< True as long as more permutations are available.

    /// Default constructor; leaves the object in an invalid state.
	BCTPermutationEnumerator() {
        root = nullptr;
        treeId = -1;
		hasNext = false;
    }

    /**
     * @brief Build an enumerator over the rooted BCT given by @p rootNode.
     * @param rootNode The TreeNode of the root block.
     */
    BCTPermutationEnumerator(TreeNode* rootNode) {
        root = rootNode;
        treeId = rootNode->value;
		hasNext = true;
        _initialize();
    }

    /// @return True if more permutations are available.
    bool hasNextPermutation() {
        return hasNext;
    }

    /**
     * @brief Compute the next valid ordering of the biconnected components
     *        following the current cutpoint permutations, then advance the
     *        state for the next call.
     *
     * On entry, @c permutations holds the next permutation to be applied. We
     * first @b snapshot it into @c lastUsedPermutations, then use it to build
     * the component order, and finally advance @c permutations with
     * @c std::next_permutation. This way external code can render the BCT/FPQ
     * with children in the exact order that produced the returned layout.
     *
     * @return The order in which the biconnected components must be visited
     *         to produce the corresponding 1-stack layout.
     */
    std::vector<int> getNextPermutation() {
        // Snapshot the state that is about to be used to build the order.
        lastUsedPermutations = permutations;

        bool toPermute = true;
        std::vector<int> order;
        std::queue<TreeNode*> queue;
        queue.push(root);

        while (!queue.empty()) {
            TreeNode* u = queue.front();
            queue.pop();

            if (u->isCutpoint) {
				for (int childType: {0, 2}) {
					std::vector<TreeNode*> children = u->getChildren(treeId, childType);

					if (children.size() > 1) {
							// mergeLayouts() splices each SOURCE (type-0) child block immediately
							// after the cutpoint, which reverses the processing order in the
							// spine. Enqueue source children in REVERSE permutation order so the
							// resulting spine reads left-to-right in lexicographic order, matching
							// the BCT and FPQ panels. Sink (type-2) children keep their order.
							if (childType == 0) {
								for (auto rit = permutations[u->value][childType].rbegin();
									rit != permutations[u->value][childType].rend(); ++rit) {
									queue.push(children[*rit]);
								}
							} else {
								for (int indexOfChild: permutations[u->value][childType]) {
									queue.push(children[indexOfChild]);
								}
							}

							// Advance the odometer: move this cutpoint's permutation to the
							// next one; on wrap-around reset it and carry to the next cutpoint.
							// (This is what enumerates ALL layouts of a rooting, not just the first.)
							if (toPermute) {
								if (std::next_permutation(permutations[u->value][childType].begin(), permutations[u->value][childType].end())) {
									toPermute = false;
								}
								else {
									std::vector<int> firstPermutation;
									for (int i = 0; i < (int)permutations[u->value][childType].size(); i++) {
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
                // A block node: emit it and enqueue all children regardless of type.
                order.push_back(u->value);
                for (int childType = 0; childType < 3; childType++) {
                    for (TreeNode* child: u->getChildren(treeId, childType)) {
                        queue.push(child);
                    }
                }
            }
        }

        if (toPermute) {
            // No cutpoint had a permutation to advance: this was the last one.
            hasNext = false;
        }
        return order;
    }

private:

    /**
     * @brief Initialize @c permutations with the identity ordering for every
     *        permutable cutpoint.
     */
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
                    for (int i = 0; i < (int)sourceChildren.size(); i++) {
                        permutation.push_back(i);
                    }
                    permutations[u->value][0] = permutation;
                    std::cout << "cutpoint " << u->value << " has " << permutation.size() << " permutable source children" << std::endl;
                }

                std::vector<TreeNode*> sinkChildren = u->getChildren(treeId, 2);
                if (sinkChildren.size() > 1) {
                    std::vector<int> permutation;
                    for (int i = 0; i < (int)sinkChildren.size(); i++) {
                        permutation.push_back(i);
                    }
                    permutations[u->value][2] = permutation;
                    std::cout << "cutpoint " << u->value << " has " << permutation.size() << " permutable sink children" << std::endl;
                }

            }
			for (int childType = 0; childType < 3; childType++) {
				for (TreeNode* child: u->getChildren(treeId, childType)) {
					queue.push(child);
				}
			}
        }

        // Also initialize lastUsedPermutations so it is always queryable.
        lastUsedPermutations = permutations;
    }
};

/**
 * @brief Enumerator of all valid 1-stack book embeddings (1-stack layouts) of
 *        an outerplanar DAG.
 *
 * The algorithm follows Carlini's thesis with Moccia's reformulation:
 *   1. Decompose the input graph into biconnected components and build the BCT.
 *   2. Find the set @c R of admissible root blocks (Proposition A): a block
 *      @c B is admissible iff its local source is a global source AND rooting
 *      the BCT at @c B introduces no restricted cutpoint.
 *   3. For each admissible rooting, enumerate all valid orderings of the
 *      children of the cutpoints (handled by @c BCTPermutationEnumerator).
 *   4. Merge the local topological orders of the biconnected components
 *      according to the chosen ordering to produce the global 1-stack layout.
 *
 * Each call to @c getNext returns the next 1-stack layout and emits to stdout
 * the corresponding BCT and FPQ-tree descriptions (parsed by the JS frontend).
 *
 * The block-to-edges mapping is emitted ONCE on the first call to @c getNext
 * (it is a static property of the graph) so the frontend can render block
 * chromatism: each biconnected block gets a unique color used consistently
 * in the 1-stack layout (edges), in the BCT (block nodes) and in the FPQ-tree
 * (F_BLOCK nodes).
 */
class OneStackLayoutsEnumerator {
	public:
		Graph* G;   ///< Input graph (not owned).

		/// Default constructor; leaves the enumerator in an invalid state.
		OneStackLayoutsEnumerator() {
			G = nullptr;
		}

		/**
		 * @brief Build an enumerator for the given graph.
		 * @param graph Input outerplanar DAG (not owned by this object).
		 */
		OneStackLayoutsEnumerator(Graph* graph) {
			G = graph;
			_initialize();
		}

		/// @return True if there are more 1-stack layouts to enumerate.
		bool hasNext() {
			if (numberOfOneStackLayouts == 0) {
				return false;
			}
			return enumerator.hasNextPermutation() || currentRooting < (int)rootings.size() - 1;
		}

		/**
		 * @brief Produce the next 1-stack layout.
		 *
		 * Emits to stdout, in order:
		 *   - (only on the first call) a BLOCK_* block describing the
		 *     biconnected components edge by edge;
		 *   - a BCT_* block describing the rooted BCT, with the children of
		 *     each cutpoint listed in the order of the current permutation;
		 *   - an FPQ_* block describing the FPQ-tree, with each P-node's
		 *     children listed in the order of the current permutation.
		 *
		 * After these, the caller (main) prints the actual layout from the
		 * returned Array, prefixed by "RESULT: ".
		 *
		 * @return The vertex order of the next 1-stack layout.
		 */
		Array<int, int> getNext() {

			if (!enumerator.hasNextPermutation()) {
				currentRooting++;
				if (currentRooting > (int)rootings.size() - 1) {
					return Array<int, int>();
				}
				rootBCT(treeNodeOfComponent[rootings[currentRooting]]);
				enumerator = BCTPermutationEnumerator(treeNodeOfComponent[rootings[currentRooting]]);
			}

			std::vector<int> order = enumerator.getNextPermutation();

			// Emit the block-to-edges mapping the first time only: the
			// biconnected decomposition does not depend on the rooting or on
			// the current permutation, so once is enough.
			if (!blocksEmitted) {
				printBlocks();
				blocksEmitted = true;
			}

			std::cout << "BLOCKS ORDER: ";
			for (int block: order) {
				std::cout << " " << block;
			}
			std::cout << std::endl;

			// Emit the rooted BCT, using the CURRENT permutation (the one
			// that just produced `order`) to decide the left-to-right order
			// of children at each cutpoint. This gives a 1-to-1 correspondence
			// between every layout and its BCT visualization.
			printBCT(treeNodeOfComponent[rootings[currentRooting]],
					 enumerator.lastUsedPermutations);

			// Same idea for the FPQ-tree: P-node children are arranged in the
			// order specified by the current permutation, so that flipping
			// through layouts visibly reorders the P-node's subtrees.
			FPQNode* fpqRoot = buildFPQTree(treeNodeOfComponent[rootings[currentRooting]],
											enumerator.lastUsedPermutations);
			printFPQ(fpqRoot);
			cleanupFPQ();

			Array<int, int> result = mergeLayouts(&order, treeNodeOfComponent[rootings[currentRooting]]);
			resultsCounter++;

			return result;
		}

		/// @return The total number of 1-stack layouts found.
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
		bool blocksEmitted = false;  ///< True after printBlocks() has run once.

		/**
		 * @brief Main initialization pipeline (phases 1 and 2 of the algorithm).
		 *
		 * Phase 1 checks structural feasibility:
		 *   - the graph must be outerplanar;
		 *   - every biconnected component must have a unique source and sink;
		 *   - every biconnected component must contain a Hamiltonian path on
		 *     its outer face.
		 *
		 * Phase 2 builds the BCT, finds the admissible roots and prepares the
		 * permutation enumerator for the first admissible rooting.
		 */
		void _initialize() {
			std::cout << "---- PHASE 1 BEGIN ----" << std::endl;
			std::cout << "the graph has " << G->numberOfNodes() << " nodes and " << G->numberOfEdges() << " edges" << std::endl;

			numberOfOneStackLayouts = 0;

			// Check whether the graph is outerplanar.
			if (!isOuterPlanar(G)) {
				std::cout << "the graph is not outerplanar" << std::endl;
				std::cout << "---- PHASE 1 END ----" << std::endl;
				return;
			}

			// Compute the biconnected components.
			biconnectedComponentsGraphs = getBiconnectedComponentsGraphs(G);
			numberOfBiconnectedComponents = biconnectedComponentsGraphs.size();

			// Check that every component has exactly one source and one sink.
			if (!getSourceAndSinkOfComponents()) {
				return;
			}

			// Check that every biconnected component contains a Hamiltonian
			// path on its outer face.
			if (!checkHamiltonianPaths()) {
				return;
			}

			// Note: line 185 of NodeArray.h "OGDF_ASSERT(v->graphOf() == m_pGraph);"
			// has been commented out to allow this call.
			// Compute the topological order of each biconnected component.
			topologicalOrders = getTopologicalOrders();

			std::cout << "---- PHASE 1 END ----" << std::endl << std::endl;

			std::cout << "---- PHASE 2 BEGIN ----" << std::endl;

			// componentsOfNode maps each vertex to the list of components it
			// belongs to.

			// Populate componentsOfNode.
			for (int i = 0; i < numberOfBiconnectedComponents; i++) {
				for (node v : biconnectedComponentsGraphs[i].nodes) {
					componentsOfNode[v->index()].push_back(i);
				}
			}

			// Find the cutpoints: vertices that belong to more than one component.
			for (node v: G->nodes) {
				if ((int)componentsOfNode[v->index()].size() > 1) {
					cutpoints.push_back(v->index());
				}
			}

			// Build the BCT (treeNodeOfComponent maps a component index to its TreeNode).
			treeNodeOfComponent = createBCT();

			// -----------------------------------------------------------------------------
			// REFORMULATION (R.Moccia): direct computation of the admissible
			// roots. Replaces the original computeRestrictions + findOtherRoots
			// pair from Carlini's algorithm. A block B is an admissible root iff:
			//   1) the local source s(B) has indegree 0 in the original graph
			//      (no block must "always come before" B);
			//   2) when the BCT is rooted at B, no cutpoint has a block child
			//      attached with label 1 (no restricted cutpoints, i.e. no
			//      block must "always be above" B).
			// If no block satisfies these conditions the DAG admits no 1-stack
			// layout (this includes the case of conflicting cutpoint pairs).
			// -----------------------------------------------------------------------------
			rootings = findAdmissibleRoots();

			if (rootings.empty()) {
				std::cout << "no admissible root: the DAG does not admit any 1-stack layout" << std::endl;
				std::cout << "---- PHASE 2 END ----" << std::endl;
				return;
			}

			std::cout << "ADMISSIBLE ROOTS (set R): ";
			for (int root: rootings) {
				std::cout << root << " ";
			}
			std::cout << std::endl;

			// Pick the first admissible root as the initial rooting.
			int rootBlock = rootings[0];
			TreeNode* rootOfBCT = treeNodeOfComponent[rootBlock];
			// rootBCT is idempotent: if findAdmissibleRoots has already rooted
			// for rootBlock, this call does nothing.
			rootBCT(rootOfBCT);

			resultsCounter = 0;

			std::cout << "################ BCT ROOTED AT COMPONENT " << rootBlock << std::endl;

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

		/**
		 * @brief Merge the topological orders of the biconnected components
		 *        according to the chosen component ordering into a single
		 *        1-stack layout.
		 *
		 * Iterates over the component ordering and, for each subsequent
		 * component, inserts its local order around the cutpoint that connects
		 * it to the already-built partial layout. The cutpoint is either the
		 * source or the sink of the incoming component; the two cases need a
		 * different splicing rule.
		 *
		 * @param orderOfComponents Component order produced by the enumerator.
		 * @param rootOfBCT         Current rooted BCT (for parent lookup).
		 * @return The resulting global vertex order (1-stack layout).
		 */
		Array<int, int> mergeLayouts(std::vector<int>* orderOfComponents, TreeNode* rootOfBCT) {
			
			Array<int, int> currentLayout = topologicalOrders[(*orderOfComponents)[0]];

			// Merge the orders of the biconnected components one by one.
			for (int i = 1; i < (int)orderOfComponents->size(); i++) {
				int component = (*orderOfComponents)[i];

				Array<int, int> orderToAdd = topologicalOrders[component];
				int cutpoint = treeNodeOfComponent[component]->getParent(rootOfBCT->value)->value;

				int newLayoutSize = currentLayout.size() + orderToAdd.size() - 1;
				Array<int, int> newLayout(newLayoutSize);

			
				if (cutpoint == sourceAndSinkOfComponents[component][0]->index()) {
					// Cutpoint is the SOURCE of the incoming component.
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
					// Cutpoint is the SINK of the incoming component.
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

		/**
		 * @brief Decompose @p G into its biconnected components.
		 *
		 * Uses OGDF's biconnectedComponents and then rebuilds each component
		 * as its own Graph so we can manipulate them independently.
		 *
		 * @param G Input graph.
		 * @return One Graph per biconnected component.
		 */
		Array<Graph, int> getBiconnectedComponentsGraphs(Graph* G) {
			EdgeArray<int> edgeArray = EdgeArray<int>(*G);

			int numberOfBiconnectedComponents = biconnectedComponents(*G, edgeArray);
			std::cout << "the graph has " << numberOfBiconnectedComponents << " biconnected components" << std::endl;

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
				// NOTE: line 187 of EdgeArray.h "OGDF_ASSERT(e->graphOf() == m_pGraph);" must be commented out.
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

		/**
		 * @brief For every biconnected component, find its unique source and
		 *        sink (or fail).
		 * @return True on success, false if any component does not have
		 *         exactly one source and one sink.
		 */
		bool getSourceAndSinkOfComponents() {
			sourceAndSinkOfComponents.init(biconnectedComponentsGraphs.size());

			for (int i = 0; i < biconnectedComponentsGraphs.size(); i++) {

				Array<node, int> sourceAndSink = getSourceAndSink(&biconnectedComponentsGraphs[i]);

				if (sourceAndSink[0] != nullptr && sourceAndSink[1] != nullptr) {
					sourceAndSinkOfComponents[i] = sourceAndSink;
				}
				else {
					std::cout << "biconnected component " << i << " does not have exactly one source and one sink" << std::endl;
					std::cout << "---- PHASE 1 END ----" << std::endl;
					return false;
				}
			}
			return true;
		}

		/**
		 * @brief Check that every biconnected component has a Hamiltonian
		 *        path on its outer face from its local source to its local sink.
		 * @return True on success, false if any component fails the test.
		 */
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
					std::cout << "biconnected component " << i << " does not contain a Hamiltonian path on its outer face" << std::endl;
					std::cout << "---- PHASE 1 END ----" << std::endl;
					return false;
				}
			}
			return true;
		}

		/**
		 * @brief Compute a topological order for the vertices of each
		 *        biconnected component.
		 * @return One Array per component, listing its vertex indices in
		 *         topological order.
		 */
		Array<Array<int, int>, int> getTopologicalOrders() {
			Array<Array<int, int>, int> topologicalOrders(biconnectedComponentsGraphs.size());

			for (int i = 0; i < biconnectedComponentsGraphs.size(); i++) {
				NodeArray<int> nodeArray = NodeArray<int>(biconnectedComponentsGraphs[i]);
				topologicalNumbering(biconnectedComponentsGraphs[i], nodeArray);

				Array<int, int> topologicalOrder(biconnectedComponentsGraphs[i].numberOfNodes());

				for (node v : biconnectedComponentsGraphs[i].nodes) {
					topologicalOrder[nodeArray[v]] = v->index();
				}

				topologicalOrders[i] = topologicalOrder;

				std::cout << "topological order of component " << i << ": ";
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

		/**
		 * @brief Build the (initially un-rooted) BCT.
		 *
		 * Creates one TreeNode per biconnected component and one per cutpoint,
		 * then connects each cutpoint to the components it belongs to.
		 *
		 * @return Map from component index to its block TreeNode.
		 */
		Array<TreeNode*, int> createBCT() {
			Array<TreeNode*, int> treeNodeOfComponent(numberOfBiconnectedComponents);

			int idOfTreeNode = 0;

			// Create the TreeNodes for the biconnected components.
			for (int i = 0; i < numberOfBiconnectedComponents; i++) {
				TreeNode* componentTreeNode = new TreeNode(idOfTreeNode, i, false);
				treeNodeOfComponent[i] = componentTreeNode;

				idOfTreeNode++;
			}

			// Create the TreeNodes for the cutpoints and link them to their components.
			for (int cutpoint : cutpoints) {
				TreeNode* cutpointTreeNode = new TreeNode(idOfTreeNode, cutpoint, true);

				for (int component : componentsOfNode[cutpoint]) {
					cutpointTreeNode->addNeighbor(treeNodeOfComponent[component]);
					treeNodeOfComponent[component]->addNeighbor(cutpointTreeNode);
				}
				idOfTreeNode++;
			}

			std::cout << "BCT built with " << cutpoints.size() << " cutpoints and " << numberOfBiconnectedComponents << " biconnected components" << std::endl;
			return treeNodeOfComponent;
		}

		/**
		 * @brief Root the BCT at @p rootOfBCT (idempotent).
		 *
		 * Performs a BFS on the un-rooted BCT starting at @p rootOfBCT and
		 * assigns parent/child relationships, classifying each BCT edge by
		 * type (0 = source, 1 = intermediate, 2 = sink) depending on the role
		 * of the cutpoint in the incident block.
		 *
		 * @param rootOfBCT       TreeNode chosen as the root.
		 * @param parentCutpoint  (Unused, kept for API compatibility.)
		 * @return The component order visited by the BFS.
		 */
		std::vector<int> rootBCT(TreeNode* rootOfBCT, int parentCutpoint = -1) {
			std::unordered_map<int, bool> visited;
			std::queue<TreeNode*> queue;

			// Order of the components.
			std::vector<int> orderOfComponents;

			visited[rootOfBCT->id] = true;
			queue.push(rootOfBCT);

			bool existsRooting = rootOfBCT->hasRooting(rootOfBCT->value);

			// BFS over the un-rooted BCT to root it and find the component order
			// (degree of freedom).
			while (!queue.empty()) {
				TreeNode* u = queue.front();
				queue.pop();
				if (!u->isCutpoint) {
					orderOfComponents.push_back(u->value);
				}

				// Visit every neighbor and record children.
				for (TreeNode* neighbor : u->neighbors) {
					if (!visited[neighbor->id]) {
						visited[neighbor->id] = true;
						queue.push(neighbor);
						if (!existsRooting) {
							int childrenType = -1;
							if (neighbor->isCutpoint) {
								if (sourceAndSinkOfComponents[u->value][0]->index() == neighbor->value) {
									childrenType = 0; // source
								}
								else if (sourceAndSinkOfComponents[u->value][1]->index() == neighbor->value) {
									childrenType = 2; // sink
								}
								else {
									childrenType = 1; // intermediate
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

		// =========================================================================
		// Output of the block decomposition (BLOCKS_BEGIN ... BLOCKS_END)
		// =========================================================================

		/**
		 * @brief Emit on stdout the mapping "biconnected block -> set of edges"
		 *        in a format parsable by the JS frontend.
		 *
		 * Output format:
		 * @code
		 *   BLOCKS_BEGIN count=<n>
		 *   BLOCK_EDGE block=<i> from=<u> to=<v>
		 *   ...
		 *   BLOCKS_END
		 * @endcode
		 *
		 * The frontend uses this mapping to assign a unique color to each
		 * biconnected block: edges in the 1-stack layout are colored after
		 * their block, and the same color is reused for the block node in the
		 * BCT and for the F_NODE_BLOCK in the FPQ-tree. This is called only
		 * once per WASM invocation because the biconnected decomposition is
		 * a static property of the input graph.
		 */
		void printBlocks() {
			std::cout << "BLOCKS_BEGIN count=" << numberOfBiconnectedComponents << std::endl;
			for (int i = 0; i < numberOfBiconnectedComponents; i++) {
				for (edge e : biconnectedComponentsGraphs[i].edges) {
					std::cout << "BLOCK_EDGE block=" << i
							  << " from=" << e->source()->index()
							  << " to=" << e->target()->index() << std::endl;
				}
			}
			std::cout << "BLOCKS_END" << std::endl;
		}

		// =========================================================================
		// Output of the BCT (BCT_BEGIN ... BCT_END)
		// =========================================================================

		/**
		 * @brief Helper used by @c printBCT to traverse the children of a
		 *        cutpoint @p u in the order specified by @p currentPermutations.
		 *
		 * Source-type (type-0) and sink-type (type-2) children are listed in
		 * permuted order if the cutpoint has more than one of them.
		 * Intermediate (type-1) children should not occur in a valid rooting
		 * but are listed in natural order as a defensive fallback.
		 *
		 * The convention used for the FPQ-tree is followed: type-2 children
		 * are emitted on the LEFT (i.e. before) and type-0 children on the
		 * RIGHT (after) the cutpoint itself, so that the visual layout of the
		 * BCT and the FPQ-tree are consistent.
		 *
		 * @param u                     A cutpoint TreeNode.
		 * @param rootValue             Value of the BCT root (key into TreeNode maps).
		 * @param currentPermutations   Current permutation state (per cutpoint, per type).
		 * @return The children of @p u in the desired emission order.
		 */
		std::vector<TreeNode*> orderedChildrenOfCutpoint(
				TreeNode* u, int rootValue,
				const std::unordered_map<int, std::unordered_map<int, std::vector<int>>>& currentPermutations) {

			std::vector<TreeNode*> ordered;

			auto appendInPermutedOrder = [&](int type) {
				std::vector<TreeNode*> kids = u->getChildren(rootValue, type);
				if (kids.empty()) return;
				auto itC = currentPermutations.find(u->value);
				if (itC != currentPermutations.end()) {
					auto itT = itC->second.find(type);
					if (itT != itC->second.end() && itT->second.size() == kids.size()) {
						for (int idx : itT->second) ordered.push_back(kids[idx]);
						return;
					}
				}
				// No permutation recorded (size 0 or 1, or first call): use natural order.
				for (TreeNode* k : kids) ordered.push_back(k);
			};

			// Order: type-2 (sinks) on the left, then type-1 (defensive), then type-0 (sources) on the right.
			appendInPermutedOrder(2);
			for (TreeNode* k : u->getChildren(rootValue, 1)) ordered.push_back(k);
			appendInPermutedOrder(0);

			return ordered;
		}

		/**
		 * @brief Emit the rooted BCT on stdout in a parsable format.
		 *
		 * Called from @c getNext before emitting the layout, so each layout
		 * in the frontend can be visualized next to the BCT that generated it.
		 * The children of every cutpoint are emitted in the order determined
		 * by @p currentPermutations, so flipping through layouts visibly
		 * rearranges the BCT in lockstep with the permutation.
		 *
		 * Output format:
		 * @code
		 *   BCT_BEGIN root=<id>
		 *   BCT_NODE id=<id> kind=<block|cutpoint> value=<v>
		 *   ...
		 *   BCT_EDGE from=<id> to=<id> type=<0|1|2>
		 *   ...
		 *   BCT_END
		 * @endcode
		 *
		 * Edge types:
		 *   - type=0  cutpoint plays the role of source in the child block;
		 *   - type=1  cutpoint is intermediate (should not appear in valid rootings);
		 *   - type=2  cutpoint plays the role of sink in the child block.
		 *
		 * @param root                   Root TreeNode of the BCT.
		 * @param currentPermutations    Permutation state used to order cutpoint children.
		 */
		void printBCT(TreeNode* root,
					  const std::unordered_map<int, std::unordered_map<int, std::vector<int>>>& currentPermutations) {

			std::cout << "BCT_BEGIN root=" << root->id << std::endl;

			std::queue<TreeNode*> q;
			std::unordered_map<int, bool> visited;

			auto childrenOrdered = [&](TreeNode* u) -> std::vector<TreeNode*> {
				if (u->isCutpoint) {
					return orderedChildrenOfCutpoint(u, root->value, currentPermutations);
				}
				// Block node: children are cutpoints; natural order is fine.
				std::vector<TreeNode*> ordered;
				for (int t = 0; t < 3; t++) {
					for (TreeNode* c : u->getChildren(root->value, t)) ordered.push_back(c);
				}
				return ordered;
			};

			// Pass 1: emit all nodes in BFS order.
			q.push(root);
			visited[root->id] = true;
			while (!q.empty()) {
				TreeNode* u = q.front();
				q.pop();
				std::cout << "BCT_NODE id=" << u->id
						<< " kind=" << (u->isCutpoint ? "cutpoint" : "block")
						<< " value=" << u->value << std::endl;
				for (TreeNode* child : childrenOrdered(u)) {
					if (!visited[child->id]) {
						visited[child->id] = true;
						q.push(child);
					}
				}
			}

			// Pass 2: emit all parent->child edges with their type.
			visited.clear();
			q.push(root);
			visited[root->id] = true;
			while (!q.empty()) {
				TreeNode* u = q.front();
				q.pop();
				for (TreeNode* child : childrenOrdered(u)) {
					if (!visited[child->id]) {
						visited[child->id] = true;
						// Recover the type of this parent->child edge. We
						// look child up among u's children for the 3 types.
						int edgeType = 1; // defensive default
						for (int t = 0; t < 3; t++) {
							for (TreeNode* k : u->getChildren(root->value, t)) {
								if (k == child) { edgeType = t; break; }
							}
						}
						std::cout << "BCT_EDGE from=" << u->id
								<< " to=" << child->id
								<< " type=" << edgeType << std::endl;
						q.push(child);
					}
				}
			}

			std::cout << "BCT_END" << std::endl;
		}

		// =========================================================================
		// FPQ-tree construction from a rooted BCT
		//
		// Reference: BCT2FPQtree.pptx (R.Moccia).
		//
		// Two mutually recursive helpers:
		//
		//   buildFPQBlock(B, parentCutpointVertex):
		//     iterates over the local topological order of B (=
		//     topologicalOrders[B->value]), skipping the parent cutpoint
		//     (already represented in the parent gadget). Each cutpoint that
		//     has BCT-children becomes a gadget; the other vertices become
		//     leaves. Everything is wrapped in an F_NODE_BLOCK.
		//
		//   buildFPQCutpointGadget(c):
		//     separates the BCT children of c into
		//       - type-2 (cutpoint is the SINK of the block -> block on the LEFT of c)
		//       - type-0 (cutpoint is the SOURCE of the block -> block on the RIGHT of c)
		//     expands each recursively with buildFPQBlock(., c). Builds
		//       F_NODE_GADGET( [P(type2)?], LEAF(c), [P(type0)?] )
		//     with the three simplifications from slide 11:
		//       - empty side  -> the P is omitted;
		//       - single child on a side -> no P, that subtree directly;
		//       - non-cutpoint vertices in B -> plain leaves (handled in buildFPQBlock).
		//
		// `currentRootId` (= root->id of the currently rooted BCT) is used to
		// query TreeNode::getChildren / getParent. `nextFPQId` and
		// `allFPQNodes` keep track of created ids/nodes for cleanup.
		//
		// `currentPermutations` is the permutation state of the
		// BCTPermutationEnumerator: it determines the left-to-right order of
		// the children of a P-node (so the FPQ visualization reflects the
		// permutation that produced the current layout).
		// =========================================================================

		int nextFPQId;                       ///< Counter for unique FPQ node ids.
		std::vector<FPQNode*> allFPQNodes;   ///< All FPQ nodes created, for cleanup.

		/**
		 * @brief Factory: allocate and register an FPQ node of the given type.
		 * @param t Type of the node.
		 * @return Pointer to a newly-allocated FPQNode tracked for cleanup.
		 */
		FPQNode* makeFPQNode(FPQType t) {
			FPQNode* n = new FPQNode(nextFPQId++, t);
			allFPQNodes.push_back(n);
			return n;
		}

		/**
		 * @brief Factory: allocate and register a LEAF FPQ node.
		 * @param vertexValue Graph vertex value to store in the leaf.
		 * @return Pointer to a newly-allocated leaf node.
		 */
		FPQNode* makeFPQLeaf(int vertexValue) {
			FPQNode* n = makeFPQNode(FPQType::LEAF);
			n->value = vertexValue;
			return n;
		}

		/**
		 * @brief Expand a block of the BCT into an F_NODE_BLOCK subtree.
		 *
		 * @param blockNode              TreeNode of the block to expand.
		 * @param parentCutpointVertex   Vertex value of the cutpoint that connects
		 *                               @p blockNode to its parent in the rooted BCT,
		 *                               or -1 if @p blockNode is the root block (no
		 *                               parent vertex to skip).
		 * @param currentRootId          Value of the BCT root (key for children/parent maps).
		 * @param currentPermutations    Permutation state used to order P-node children.
		 * @return The newly-built F_NODE_BLOCK subtree.
		 */
		FPQNode* buildFPQBlock(TreeNode* blockNode, int parentCutpointVertex, int currentRootId,
				const std::unordered_map<int, std::unordered_map<int, std::vector<int>>>& currentPermutations) {
			int blockIdx = blockNode->value;
			Array<int, int> localOrder = topologicalOrders[blockIdx];

			// Map: vertex_index -> TreeNode* of the cutpoint, but only for the
			// cutpoints that are CHILDREN of blockNode in this rooting (and thus
			// must be expanded into gadgets). For a parent block, cutpoint children
			// can occur with any childType (0/1/2) according to the role of the
			// cutpoint in the block.
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

				// (1) Skip the parent cutpoint: it is already represented in the gadget above.
				if (v == parentCutpointVertex) continue;

				// (2) If v is a cutpoint child of blockNode in this rooting, expand it as a gadget.
				auto it = cutpointChildOf.find(v);
				if (it != cutpointChildOf.end()) {
					FPQNode* gadget = buildFPQCutpointGadget(it->second, currentRootId, currentPermutations);
					fChildren.push_back(gadget);
				} else {
					// (3) Plain vertex (not a cutpoint, or cutpoint with no children
					//     in this rooting -- impossible by BCT definition for a cutpoint child).
					fChildren.push_back(makeFPQLeaf(v));
				}
			}

			// Note: a previous version returned fChildren[0] directly when size()==1,
			// to "elide" degenerate blocks. We now always keep the F_NODE_BLOCK so we
			// preserve a 1-to-1 correspondence between blocks and F-nodes, which makes
			// the resulting tree easier to read.

			FPQNode* f = makeFPQNode(FPQType::F_NODE_BLOCK);
			f->blockIndex = blockIdx;
			f->children = fChildren;
			return f;
		}

		/**
		 * @brief Expand a cutpoint into its gadget
		 *        F( [P(type2)?], LEAF(c), [P(type0)?] ).
		 *
		 * @param cutpointNode          TreeNode of the cutpoint to expand.
		 * @param currentRootId         Value of the BCT root.
		 * @param currentPermutations   Permutation state used to order P-node children.
		 * @return The newly-built F_NODE_GADGET subtree.
		 */
		FPQNode* buildFPQCutpointGadget(TreeNode* cutpointNode, int currentRootId,
				const std::unordered_map<int, std::unordered_map<int, std::vector<int>>>& currentPermutations) {
			int cVertex = cutpointNode->value;

			// type-2: cutpoint is the SINK of the child block -> children on the LEFT of c.
			std::vector<TreeNode*> type2Blocks = cutpointNode->getChildren(currentRootId, 2);
			// type-0: cutpoint is the SOURCE of the child block -> children on the RIGHT of c.
			std::vector<TreeNode*> type0Blocks = cutpointNode->getChildren(currentRootId, 0);

			// Apply the current permutation, if any, to reorder these vectors.
			// The permutation entries from BCTPermutationEnumerator are keyed
			// by cutpoint VALUE (graph vertex index) and edge type (0 or 2).
			auto applyPermutation = [&](std::vector<TreeNode*>& vec, int type) {
				if (vec.size() <= 1) return;
				auto itC = currentPermutations.find(cVertex);
				if (itC == currentPermutations.end()) return;
				auto itT = itC->second.find(type);
				if (itT == itC->second.end()) return;
				const std::vector<int>& perm = itT->second;
				if (perm.size() != vec.size()) return;
				std::vector<TreeNode*> permuted;
				permuted.reserve(vec.size());
				for (int idx : perm) permuted.push_back(vec[idx]);
				vec = permuted;
			};
			applyPermutation(type2Blocks, 2);
			applyPermutation(type0Blocks, 0);

			FPQNode* gadget = makeFPQNode(FPQType::F_NODE_GADGET);

			// --- Left side (type-2) ---
			if (!type2Blocks.empty()) {
				std::vector<FPQNode*> leftSubtrees;
				for (TreeNode* childBlock : type2Blocks) {
					leftSubtrees.push_back(buildFPQBlock(childBlock, cVertex, currentRootId, currentPermutations));
				}
				if (leftSubtrees.size() == 1) {
					gadget->addChild(leftSubtrees[0]);  // simplification: no P when single child
				} else {
					FPQNode* p = makeFPQNode(FPQType::P_NODE);
					p->children = leftSubtrees;
					gadget->addChild(p);
				}
			}

			// --- The cutpoint c itself ---
			gadget->addChild(makeFPQLeaf(cVertex));

			// --- Right side (type-0) ---
			if (!type0Blocks.empty()) {
				std::vector<FPQNode*> rightSubtrees;
				for (TreeNode* childBlock : type0Blocks) {
					rightSubtrees.push_back(buildFPQBlock(childBlock, cVertex, currentRootId, currentPermutations));
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

		/**
		 * @brief Entry point: build and return the FPQ-tree for the BCT rooted
		 *        at @p rootBlock.
		 *
		 * Resets the internal state (@c nextFPQId and @c allFPQNodes) before
		 * starting. The caller must free everything via @c cleanupFPQ when
		 * done using the tree.
		 *
		 * @param rootBlock              Root block of the BCT.
		 * @param currentPermutations    Permutation state used to order P-node children.
		 * @return The root of the newly-built FPQ-tree.
		 */
		FPQNode* buildFPQTree(TreeNode* rootBlock,
				const std::unordered_map<int, std::unordered_map<int, std::vector<int>>>& currentPermutations) {
			nextFPQId = 0;
			allFPQNodes.clear();
			// The root block has no parent cutpoint -> -1.
			// Note: we use rootBlock->value as treeId (the key for children/parent maps),
			// consistently with printBCT and the rest of the code. For blocks
			// `id == value` by construction (see createBCT), so for the root there is
			// no difference, but the rest of the code uses ->value and we follow.
			return buildFPQBlock(rootBlock, -1, rootBlock->value, currentPermutations);
		}

		/// Free every FPQ node allocated since the last @c buildFPQTree call.
		void cleanupFPQ() {
			for (FPQNode* n : allFPQNodes) delete n;
			allFPQNodes.clear();
		}

		// =========================================================================
		// Output of the FPQ-tree (FPQ_BEGIN ... FPQ_END)
		// =========================================================================

		/**
		 * @brief Map an @c FPQType value to its string representation used in
		 *        the textual output.
		 */
		const char* fpqTypeToStr(FPQType t) {
			switch (t) {
				case FPQType::P_NODE: return "P";
				case FPQType::F_NODE_BLOCK: return "F_BLOCK";
				case FPQType::F_NODE_GADGET: return "F_GADGET";
				case FPQType::LEAF: return "LEAF";
			}
			return "?";
		}

		/**
		 * @brief Emit the FPQ-tree on stdout in a format parallel to @c printBCT.
		 *
		 * Called from @c getNext right after @c printBCT, so every layout is
		 * preceded by both BCT and FPQ.
		 *
		 * Output format:
		 * @code
		 *   FPQ_BEGIN root=<id>
		 *   FPQ_NODE id=<id> type=<P|F_BLOCK|F_GADGET|LEAF> [block=<i>] [value=<v>]
		 *   ...
		 *   FPQ_EDGE from=<id> to=<id> pos=<k>
		 *   ...
		 *   FPQ_END
		 * @endcode
		 *
		 * @c pos on FPQ_EDGE tells the frontend the index of the child within
		 * the parent's children list. It is significant for F-nodes (order
		 * matters) and irrelevant but printed for P-nodes (uniformity).
		 *
		 * @param root Root of the FPQ-tree, or nullptr for an empty output.
		 */
		void printFPQ(FPQNode* root) {
			if (root == nullptr) {
				std::cout << "FPQ_BEGIN root=-1" << std::endl;
				std::cout << "FPQ_END" << std::endl;
				return;
			}

			std::cout << "FPQ_BEGIN root=" << root->id << std::endl;

			// Pass 1: all nodes in BFS order.
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

			// Pass 2: all parent->child edges with the child's position.
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
		// findAdmissibleRoots (reformulation by R.Moccia)
		// -----------------------------------------------------------------------------
		/**
		 * @brief Compute the set R = { B | B is an admissible root }.
		 *
		 * Replaces the original Carlini pair @c computeRestrictions +
		 * @c findOtherRoots. By Proposition A, a block B is an admissible
		 * root iff:
		 *   - (1) its local source s(B) is a global source of the DAG (i.e.
		 *         has indegree 0 in the original graph). Equivalently, s(B)
		 *         must be the local source in EVERY block that contains it
		 *         (it cannot be intermediate or sink anywhere). This is the
		 *         "no block always comes before B" condition.
		 *   - (2) rooting the BCT at B, no cutpoint has a block child attached
		 *         with label 1 (no restricted cutpoint). This is exactly the
		 *         "no path 2-0-2-0... or direct edge ending with a 1-edge"
		 *         condition, i.e. "no block always lies above B".
		 *
		 * If R is empty the DAG admits no 1-stack layout; this includes the
		 * case of conflicting cutpoint pairs.
		 *
		 * @return The list of admissible root block indices.
		 */
		std::vector<int> findAdmissibleRoots() {
			std::vector<int> admissible;

			for (int blockIdx = 0; blockIdx < numberOfBiconnectedComponents; blockIdx++) {

				// ----------- Condition (1): s(B) must be a global source -----------
				// s(B) is a global source iff in every block containing it, it
				// is the local source (i.e. all BCT edges incident to s(B) are
				// labelled 0). We reuse sourceAndSinkOfComponents and
				// componentsOfNode which are already populated.
				int srcIndex = sourceAndSinkOfComponents[blockIdx][0]->index();
				bool isGlobalSource = true;
				for (int compIdx : componentsOfNode[srcIndex]) {
					if (sourceAndSinkOfComponents[compIdx][0]->index() != srcIndex) {
						// In some other block s(B) is not the source
						// (it is intermediate or sink) -> some block "always comes before".
						isGlobalSource = false;
						break;
					}
				}
				if (!isGlobalSource) {
					std::cout << "block " << blockIdx << " discarded: its source "
					          << srcIndex << " is not a global source" << std::endl;
					continue;
				}

				// ----------- Condition (2): no restricted cutpoint when rooting at B -----------
				// Rooting the BCT at blockIdx, verify that no cutpoint has a
				// block child attached with label 1 (no block "always lies above"
				// via paths 2-0-2-0... ending with a 1-edge).
				TreeNode* rootTreeNode = treeNodeOfComponent[blockIdx];
				rootBCT(rootTreeNode); // idempotent

				bool noRestriction = true;
				std::queue<TreeNode*> bfsQueue;
				bfsQueue.push(rootTreeNode);
				while (!bfsQueue.empty()) {
					TreeNode* u = bfsQueue.front();
					bfsQueue.pop();
					if (u->isCutpoint) {
						// If u (cutpoint) has a block child attached with label 1
						// then u is a restricted cutpoint: B is not admissible.
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
					std::cout << "block " << blockIdx << " is an admissible root" << std::endl;
				}
				else {
					std::cout << "block " << blockIdx << " discarded: rooting it would leave "
					          << "a restricted cutpoint in the BCT" << std::endl;
				}
			}

			return admissible;
		}

		// The following procedures (computeRestrictions, findOtherRoots) were part
		// of Carlini's original algorithm and have been superseded by the new
		// findAdmissibleRoots. They are kept here for reference and to avoid
		// breaking any external code that might still reference them, but they
		// are no longer used by _initialize.

		/**
		 * @brief Legacy: recursively collects additional valid root candidates.
		 *
		 * Walks the BCT rooted at @p treeNode and, every time it encounters a
		 * cutpoint whose role with respect to its parent equals one of its block
		 * children's role, records that block as another valid rooting.
		 *
		 * @param treeNode    Current BCT node.
		 * @param treeId      The block id used to identify the current rooting.
		 * @param parentType  Edge label between @p treeNode and its parent in the
		 *                    rooted BCT (0 = source, 1 = intermediate, 2 = sink).
		 *
		 * @note Superseded by findAdmissibleRoots; kept for backward compatibility.
		 */
		void findOtherRoots(TreeNode* treeNode, int treeId, int parentType) {
			if (treeNode->isCutpoint) {
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
				for (TreeNode* cutpointNode: treeNode->getChildren(treeId, 0)) {
					findOtherRoots(cutpointNode, treeId, 0);
				}
				for (TreeNode* cutpointNode: treeNode->getChildren(treeId, 2)) {
					findOtherRoots(cutpointNode, treeId, 2);
				}
			}
		}

		/**
		 * @brief Legacy: detects restricted cutpoints in the current rooting.
		 *
		 * Implements the original Carlini restriction-propagation pass. For each
		 * block in @c orderOfComponents (visited from the deepest to the root)
		 * inspects its cutpoints; if any cutpoint is found to be "restricted"
		 * (intermediate role in a deeper component or inherits restriction from
		 * such a component) the block itself is marked as restricted. As soon as
		 * a block accumulates more than one restricted cutpoint a "conflicting
		 * pair" has been found and no admissible rooting exists for the current
		 * choice of root block.
		 *
		 * @param[out] betterRoot  If a restriction is propagated up, the component
		 *                         responsible for it is reported here as a hint
		 *                         for choosing a different root.
		 * @return @c true if no conflicting pair was found, @c false otherwise.
		 *
		 * @note Superseded by findAdmissibleRoots; kept for backward compatibility.
		 */
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
					for (int childType = 0; childType < 3; childType++) {
						bool found = false;
						for (TreeNode* otherComponentTreeNode: cutpointTreeNode->getChildren(rootBlock, childType)) {
							int otherComponent = otherComponentTreeNode->value;
							if (positionOfComponent[otherComponent] > positionOfComponent[currentBlock]) {
								if (childType == 1 || restrictedInComponent[otherComponent]) {
									countRestricted++;
									restrictedInComponent[currentBlock] = true;
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
				if (countRestricted > 1) {
					std::cout << "CONFLICTING PAIR FOUND" << std::endl;
					std::cout << "---- PHASE 2 END ----" << std::endl;
					return false;
				}
			}
			return true;
		}

		/**
		 * @brief Counts the total number of valid 1-stack layouts.
		 *
		 * Implements the EXACT formula from the thesis (Sec. 3.2):
		 * @f[
		 *     N = \sum_{B \in R} \prod_{p \in P(T_B)} |p|!
		 * @f]
		 * where @f$R@f$ is the set of admissible roots and @f$P(T_B)@f$ is the
		 * set of permutable groups (source-children and sink-children of each
		 * cutpoint in the BCT rooted at @f$B@f$).
		 *
		 * This is preferable to the cheaper @f$|R| \cdot \text{single\_product}@f$
		 * shortcut because it computes the count even if, for any reason, the
		 * number of permutations per rooting differs (the thesis proves equality
		 * but here it is actually computed).
		 *
		 * @return Total number of distinct 1-stack layouts.
		 *
		 * @pre rootBCT must have been called for every root in @c rootings, or
		 *      will be called internally on demand (it is idempotent).
		 */
		int getNumberOfLayouts() {
			long long total = 0;

			for (int rootBlockIdx : rootings) {
				TreeNode* root = treeNodeOfComponent[rootBlockIdx];

				// Ensure the BCT is rooted at this root. rootBCT is idempotent: if
				// the tree is already rooted at `root` it returns immediately
				// (see `existsRooting` check inside rootBCT).
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

		/**
		 * @brief Debug helper: prints the cause of each cutpoint restriction.
		 *
		 * @param cutpoints                       Pointer to the vector of cutpoint vertices.
		 * @param restrictingComponentOfCutpoint  Map from a cutpoint to the block
		 *                                        whose presence makes it restricted.
		 */
		void printRestrictions(std::vector<int>* cutpoints, std::unordered_map<int, TreeNode*>* restrictingComponentOfCutpoint) {
			std::cout << "RESTRICTION CAUSES:" << std::endl;
			for (int cutpoint: *cutpoints) {
				if (restrictingComponentOfCutpoint->find(cutpoint) != restrictingComponentOfCutpoint->end()) {
					std::cout << "cutpoint " << cutpoint << " is restricted due to component " << (*restrictingComponentOfCutpoint)[cutpoint]->value << std::endl;
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