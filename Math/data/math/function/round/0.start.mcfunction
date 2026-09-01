data remove storage math: ans
data modify storage math: internal.x set from storage math: a
data modify storage math: ans set compute default float {"type":"minecraft:round","input":{"type":"minecraft:storage","storage":"math:","path":"internal.x"}}
data remove storage math: internal
