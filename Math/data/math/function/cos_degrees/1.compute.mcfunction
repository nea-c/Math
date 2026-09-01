data modify storage math: internal.x set from storage math: a
data modify storage math: internal.x set compute default float math:.common/rad
execute if data storage math: {internal:{x:0.0f}} run data modify storage math: ans set value 1.0f
execute if data storage math: {internal:{x:0.0f}} run return 1
function math:.common/cos/0.start
data modify storage math: ans set compute default float math:.common/input/x
