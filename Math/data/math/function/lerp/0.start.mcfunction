data remove storage math: ans
data modify storage math: ans set compute default float {"type":"minecraft:add","inputs":[{"type":"minecraft:storage","storage":"math:","path":"a"},{"type":"minecraft:mul","inputs":[{"type":"minecraft:storage","storage":"math:","path":"t"},{"type":"minecraft:sub","left":{"type":"minecraft:storage","storage":"math:","path":"b"},"right":{"type":"minecraft:storage","storage":"math:","path":"a"}}]}]}
data remove storage math: internal
