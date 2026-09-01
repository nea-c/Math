data remove storage math: ans
data modify storage math: internal.x set from storage math: a
data modify storage math: ans set compute default float {"type":"minecraft:div","left":1,"right":{"type":"minecraft:storage","storage":"math:","path":"internal.x"}}
data remove storage math: internal
