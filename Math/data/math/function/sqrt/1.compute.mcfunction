data modify storage math: internal.x set from storage math: a
execute if data storage math: {internal:{x:0.0f}} run return run data modify storage math: ans set value 0.0f
data modify storage math: ans set compute default float math:sqrt/00
