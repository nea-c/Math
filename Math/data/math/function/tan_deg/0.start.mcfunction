data remove storage math: ans
data modify storage math: internal.x set compute default float {"type":"mul","inputs":[{"type":"storage","storage":"math:","path":"a"},0.01745329251994329576923690768489]}
function math:tan/1.compute
data remove storage math: internal
