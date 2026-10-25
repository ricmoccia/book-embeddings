#!/usr/bin/env bash
# =============================================================================
# API experimentation for the 1-page upward book-embedding enumeration library.
#
# Run it from the `code` folder (where enum.exe lives), in MSYS2 MINGW64:
#
#     bash experiment.sh 2>&1 | tee results.txt
#
# then send results.txt. It runs three experiments:
#   1. Correctness  — unranking reproduces the enumerated set exactly (bijection).
#   2. Structure    — the mixed-radix `bases` (rootings + P-node sizes).
#   3. Performance  — the k-th layout is extracted in ~constant wall-clock time,
#                     independent of k and of the (possibly huge) total count.
#
# Note: experiment 1 enumerates every layout, so it only runs on SMALL graphs;
# complexGraph2 (864 layouts) is the heavy one and takes a couple of minutes.
# =============================================================================

EX="../graph file examples"          # folder holding the test graphs
ENUM=./enum.exe
TIMEFORMAT='    real %R s'           # clean one-line timing for the `time` builtin

# spines produced by full enumeration (legacy text protocol), sorted & unique
spines_legacy() {
    "$ENUM" "$(cat "$1")" 2>/dev/null \
        | grep "^RESULT:" | sed 's/RESULT: //; s/ *$//' | sort -u
}
# spines produced by unranking every rank 0..N-1, sorted & unique
spines_unrank() {
    local G="$1" N k
    N=$("$ENUM" count "$G" | grep -o '[0-9]\+' | head -1)
    for ((k = 0; k < N; k++)); do "$ENUM" rank "$G" "$k"; done \
        | grep -o '"spine":\[[^]]*\]' | sed 's/"spine":\[//; s/\]//; s/,/ /g' | sort -u
}

echo "#############################################################"
echo "# EXPERIMENT 1 - Correctness: unranking == enumeration"
echo "#############################################################"
printf "%-16s %9s %9s %9s %7s   %s\n" graph count enum unrank diff result
for name in es3 graph8 es2 graph13 graph9 graph20 graph15 complexGraph2; do
    G="$EX/$name"
    if [ ! -f "$G" ]; then printf "%-16s   (file not found)\n" "$name"; continue; fi
    N=$("$ENUM" count "$G" | grep -o '[0-9]\+' | head -1)
    spines_legacy "$G" > /tmp/L.txt
    spines_unrank "$G" > /tmp/U.txt
    L=$(wc -l < /tmp/L.txt); U=$(wc -l < /tmp/U.txt)
    miss=$(comm -23 /tmp/L.txt /tmp/U.txt | wc -l)
    extra=$(comm -13 /tmp/L.txt /tmp/U.txt | wc -l)
    diff=$((miss + extra))
    if [ "$diff" -eq 0 ]; then res="OK"; else res="FAIL (missing=$miss extra=$extra)"; fi
    printf "%-16s %9s %9s %9s %7s   %s\n" "$name" "$N" "$L" "$U" "$diff" "$res"
done

echo
echo "#############################################################"
echo "# EXPERIMENT 2 - Structure: the mixed-radix 'bases'"
echo "#############################################################"
for name in graph20 complexGraph2 graph18; do
    G="$EX/$name"
    [ -f "$G" ] || continue
    echo "--- $name ---"
    "$ENUM" bases "$G"
    echo
done

echo
echo "#############################################################"
echo "# EXPERIMENT 3 - Performance: constant-time unranking"
echo "#############################################################"
for name in graph18 graph22; do
    G="$EX/$name"
    [ -f "$G" ] || continue
    N=$("$ENUM" count "$G" | grep -o '[0-9]\+' | head -1)
    echo "--- $name : $N layouts ---"
    echo -n "  count (analytic, no enumeration):"
    time "$ENUM" count "$G" > /dev/null
    for k in 0 $((N / 4)) $((N / 2)) $((3 * N / 4)) $((N - 1)); do
        echo "  extract rank $k of $N:"
        time "$ENUM" rank "$G" "$k" > /dev/null
    done
    echo
done

echo "done."
