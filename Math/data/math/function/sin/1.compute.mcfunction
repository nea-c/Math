data modify storage math: internal.x set from storage math: a
execute if data storage math: {internal:{x:0.0f}} run data modify storage math: ans set compute default float math:.common/input/x
execute if data storage math: {internal:{x:0.0f}} run return 1
function math:.common/sin/0.start
data modify storage math: ans set compute default float math:.common/input/x
