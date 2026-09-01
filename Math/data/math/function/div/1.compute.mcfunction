data modify storage math: internal.x set from storage math: b
execute if data storage math: {internal:{x:0.0f}} run return 1
data modify storage math: internal.x set from storage math: a
data modify storage math: internal.y set from storage math: b
data modify storage math: ans set compute default float math:.common/div
