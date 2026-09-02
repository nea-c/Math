data remove storage math: ans
data modify storage math: ans set compute default float {"type":"minecraft:min","inputs":[{"type":"minecraft:max","inputs":[{"type":"minecraft:storage","storage":"math:","path":"a"},{"type":"minecraft:storage","storage":"math:","path":"min"}]},{"type":"minecraft:storage","storage":"math:","path":"max"}]}
data remove storage math: internal
