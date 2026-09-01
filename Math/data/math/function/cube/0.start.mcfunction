data remove storage math: ans
data modify storage math: internal.x set from storage math: a
data modify storage math: ans set compute default float {"type":"minecraft:pow","base":{"type":"minecraft:storage","storage":"math:","path":"internal.x"},"exponent":3}
data remove storage math: internal
