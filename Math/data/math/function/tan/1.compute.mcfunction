data modify storage math: internal.x set from storage math: a
execute if data storage math: {internal:{x:0.0f}} run return run data modify storage math: ans set compute default float math:.common/input/x
function math:.common/tan/0.start
data modify storage math: internal.x set from storage math: internal.w_tan_cos
data modify storage math: ans set compute default float math:tan/00
