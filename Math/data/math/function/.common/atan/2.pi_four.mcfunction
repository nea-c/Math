data modify storage math: internal.w_atan_numerator set compute default float {"type":"minecraft:add","inputs":[{"type":"minecraft:storage","storage":"math:","path":"internal.x"},-1]}
data modify storage math: internal.x set compute default float {"type":"minecraft:add","inputs":[{"type":"minecraft:storage","storage":"math:","path":"internal.x"},1]}
data modify storage math: internal.y set value 1.0f
function math:.common/reciprocal/0.start
data modify storage math: internal.x set compute default float math:.common/atan/reduced
